package main

import (
	"bytes"
	"context"
	"crypto/subtle"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"

	"github.com/skip2/go-qrcode"
	"go.mau.fi/whatsmeow"
	waProto "go.mau.fi/whatsmeow/binary/proto"
	"go.mau.fi/whatsmeow/store/sqlstore"
	"go.mau.fi/whatsmeow/types"
	"go.mau.fi/whatsmeow/types/events"
	waLog "go.mau.fi/whatsmeow/util/log"
	"google.golang.org/protobuf/proto"
	_ "modernc.org/sqlite"
)

type bridge struct {
	mu            sync.RWMutex
	sessions      map[string]*session
	webhookURL    string
	webhookSecret string
	apiToken      string
	dataDir       string
}

type session struct {
	id            string
	name          string
	phoneNumber   string
	container     *sqlstore.Container
	client        *whatsmeow.Client
	status        string
	qrCode        string
	deviceJID     string
	lastError     string
	messages      []map[string]any
	conversations map[string]map[string]any
}

func main() {
	dataDir := env("WHATSMEOW_DATA_DIR", "./data")
	if err := os.MkdirAll(dataDir, 0o755); err != nil {
		log.Fatalf("failed to create data dir: %v", err)
	}

	b := &bridge{
		sessions:      map[string]*session{},
		webhookURL:    os.Getenv("APP_WEBHOOK_URL"),
		webhookSecret: os.Getenv("WHATSMEOW_WEBHOOK_SECRET"),
		apiToken:      os.Getenv("WHATSMEOW_API_TOKEN"),
		dataDir:       dataDir,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/health", b.health)
	mux.HandleFunc("/connections/", b.connections)
	mux.HandleFunc("/messages/send", b.auth(b.sendMessage))

	addr := ":" + env("PORT", "8080")
	log.Printf("Whatsmeow bridge listening on %s", addr)
	if err := http.ListenAndServe(addr, mux); err != nil {
		log.Fatal(err)
	}
}

func (b *bridge) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{"ok": true, "service": "whatsmeow-bridge"})
}

func (b *bridge) connections(w http.ResponseWriter, r *http.Request) {
	if !b.checkAuth(r) {
		writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
		return
	}

	path := strings.TrimPrefix(r.URL.Path, "/connections/")
	parts := strings.Split(strings.Trim(path, "/"), "/")
	if len(parts) != 2 {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
		return
	}

	id, action := parts[0], parts[1]
	switch action {
	case "connect":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		b.connect(w, r, id)
	case "disconnect":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		b.disconnect(w, id)
	case "sync":
		if r.Method != http.MethodPost {
			writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
			return
		}
		b.sync(w, id)
	default:
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "not found"})
	}
}

func (b *bridge) connect(w http.ResponseWriter, r *http.Request, id string) {
	var req struct {
		ID             string `json:"id"`
		Name           string `json:"name"`
		PhoneNumber    string `json:"phoneNumber"`
		FormattedPhone string `json:"formattedPhone"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil && !errors.Is(err, io.EOF) {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
		return
	}

	s, err := b.ensureSession(id, req.Name, req.PhoneNumber)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]any{"error": err.Error()})
		return
	}

	if s.client.Store.ID == nil {
		qrChan, err := s.client.GetQRChannel(context.Background())
		if err != nil {
			s.status = "error"
			s.lastError = err.Error()
			writeJSON(w, http.StatusInternalServerError, s.snapshot())
			return
		}
		go func() {
			for evt := range qrChan {
				switch evt.Event {
				case "code":
					s.qrCode = qrToDataURL(evt.Code)
					s.status = "qr"
					b.postWebhook(map[string]any{"event": "connection", "connectionId": s.id, "status": "qr", "qrCode": s.qrCode})
				case "success":
					s.status = "connected"
					s.qrCode = ""
					if s.client.Store.ID != nil {
						s.deviceJID = s.client.Store.ID.String()
					}
					b.postWebhook(map[string]any{"event": "connection", "connectionId": s.id, "status": "connected", "deviceJid": s.deviceJID})
				default:
					if evt.Error != nil {
						s.status = "error"
						s.lastError = evt.Error.Error()
						b.postWebhook(map[string]any{"event": "connection", "connectionId": s.id, "status": "error", "error": s.lastError})
					}
				}
			}
		}()
	}

	if !s.client.IsConnected() {
		s.status = "connecting"
		if err := s.client.Connect(); err != nil {
			s.status = "error"
			s.lastError = err.Error()
			writeJSON(w, http.StatusBadGateway, s.snapshot())
			return
		}
	}

	if s.client.Store.ID != nil {
		s.deviceJID = s.client.Store.ID.String()
	}
	if s.client.IsConnected() && s.client.IsLoggedIn() {
		s.status = "connected"
	}
	writeJSON(w, http.StatusOK, s.snapshot())
}

func (b *bridge) disconnect(w http.ResponseWriter, id string) {
	s := b.getSession(id)
	if s == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "connection not found"})
		return
	}
	s.client.Disconnect()
	s.status = "disconnected"
	s.qrCode = ""
	b.postWebhook(map[string]any{"event": "connection", "connectionId": s.id, "status": s.status})
	writeJSON(w, http.StatusOK, s.snapshot())
}

func (b *bridge) sync(w http.ResponseWriter, id string) {
	s := b.getSession(id)
	if s == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "connection not found"})
		return
	}
	if s.client.Store.ID != nil {
		s.deviceJID = s.client.Store.ID.String()
	}
	if s.client.IsConnected() && s.client.IsLoggedIn() {
		s.status = "connected"
	}
	conversations := make([]map[string]any, 0, len(s.conversations))
	for _, conv := range s.conversations {
		conversations = append(conversations, conv)
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"status":        s.status,
		"deviceJid":     s.deviceJID,
		"conversations": conversations,
		"messages":      s.messages,
	})
}

func (b *bridge) sendMessage(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		writeJSON(w, http.StatusMethodNotAllowed, map[string]any{"error": "method not allowed"})
		return
	}
	var req struct {
		ConnectionID string `json:"connectionId"`
		To           string `json:"to"`
		Text         string `json:"text"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": "invalid json"})
		return
	}
	s := b.getSession(req.ConnectionID)
	if s == nil {
		writeJSON(w, http.StatusNotFound, map[string]any{"error": "connection not found"})
		return
	}
	to, err := parseJID(req.To)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]any{"error": err.Error()})
		return
	}
	resp, err := s.client.SendMessage(context.Background(), to, &waProto.Message{Conversation: proto.String(req.Text)})
	if err != nil {
		writeJSON(w, http.StatusBadGateway, map[string]any{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{
		"id":        resp.ID,
		"messageId": resp.ID,
		"timestamp": resp.Timestamp,
	})
}

func (b *bridge) ensureSession(id, name, phone string) (*session, error) {
	b.mu.Lock()
	defer b.mu.Unlock()
	if s := b.sessions[id]; s != nil {
		return s, nil
	}

	sessionDir := filepath.Join(b.dataDir, safeID(id))
	if err := os.MkdirAll(sessionDir, 0o755); err != nil {
		return nil, err
	}
	dbLog := waLog.Stdout("Database-"+id, "WARN", true)
	container, err := sqlstore.New(context.Background(), "sqlite", "file:"+filepath.Join(sessionDir, "whatsmeow.db")+"?_pragma=foreign_keys(1)", dbLog)
	if err != nil {
		return nil, err
	}
	device, err := container.GetFirstDevice(context.Background())
	if err != nil {
		return nil, err
	}
	clientLog := waLog.Stdout("Client", "INFO", true)
	client := whatsmeow.NewClient(device, clientLog)
	s := &session{
		id:            id,
		name:          fallback(name, id),
		phoneNumber:   phone,
		container:     container,
		client:        client,
		status:        "disconnected",
		conversations: map[string]map[string]any{},
		messages:      []map[string]any{},
	}
	if client.Store.ID != nil {
		s.deviceJID = client.Store.ID.String()
	}
	client.AddEventHandler(func(evt any) {
		b.handleEvent(s, evt)
	})
	b.sessions[id] = s
	return s, nil
}

func (b *bridge) getSession(id string) *session {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.sessions[id]
}

func (b *bridge) handleEvent(s *session, evt any) {
	switch v := evt.(type) {
	case *events.Connected:
		s.status = "connected"
		if s.client.Store.ID != nil {
			s.deviceJID = s.client.Store.ID.String()
		}
		b.postWebhook(map[string]any{"event": "connection", "connectionId": s.id, "status": "connected", "deviceJid": s.deviceJID})
	case *events.Disconnected:
		s.status = "disconnected"
		b.postWebhook(map[string]any{"event": "connection", "connectionId": s.id, "status": "disconnected"})
	case *events.LoggedOut:
		s.status = "disconnected"
		b.postWebhook(map[string]any{"event": "connection", "connectionId": s.id, "status": "disconnected"})
	case *events.Message:
		payload := b.messagePayload(s, v)
		if payload == nil {
			return
		}
		s.messages = append([]map[string]any{payload}, s.messages...)
		if len(s.messages) > 200 {
			s.messages = s.messages[:200]
		}
		chatJID := fmt.Sprint(payload["chatJid"])
		s.conversations[chatJID] = conversationPayload(s, chatJID, payload)
		b.postWebhook(payload)
	}
}

func (b *bridge) messagePayload(s *session, evt *events.Message) map[string]any {
	msg := evt.Message
	if msg == nil {
		return nil
	}
	info := evt.Info
	chat := info.Chat.String()
	sender := info.Sender.String()
	if sender == "" {
		sender = chat
	}

	body := msg.GetConversation()
	msgType := "text"
	var mediaURL, mimeType, fileName string
	var fileSize uint64

	if ext := msg.GetExtendedTextMessage(); ext != nil {
		body = ext.GetText()
	}
	if img := msg.GetImageMessage(); img != nil {
		msgType = "image"
		body = firstNonEmpty(img.GetCaption(), body)
		mimeType = img.GetMimetype()
		fileSize = img.GetFileLength()
	}
	if audio := msg.GetAudioMessage(); audio != nil {
		msgType = "audio"
		mimeType = audio.GetMimetype()
		fileSize = audio.GetFileLength()
	}
	if video := msg.GetVideoMessage(); video != nil {
		msgType = "video"
		body = firstNonEmpty(video.GetCaption(), body)
		mimeType = video.GetMimetype()
		fileSize = video.GetFileLength()
	}
	if doc := msg.GetDocumentMessage(); doc != nil {
		msgType = "document"
		body = firstNonEmpty(doc.GetCaption(), body)
		mimeType = doc.GetMimetype()
		fileName = doc.GetFileName()
		fileSize = doc.GetFileLength()
	}
	if msgType != "text" {
		if data, err := s.client.DownloadAny(context.Background(), msg); err == nil && len(data) > 0 && len(data) <= 8*1024*1024 {
			mediaURL = dataURL(mimeType, data)
		}
	}

	pushName := info.PushName
	groupName := ""
	participants := []map[string]any{}
	groupPhoto := ""
	if info.IsGroup {
		groupInfo, err := s.client.GetGroupInfo(context.Background(), info.Chat)
		if err == nil && groupInfo != nil {
			groupName = groupInfo.Name
			for _, participant := range groupInfo.Participants {
				participants = append(participants, map[string]any{
					"jid":   participant.JID.String(),
					"phone": participant.JID.User,
					"name":  participant.JID.User,
				})
			}
		}
		groupPhoto = b.profilePicture(s, info.Chat)
	}

	senderPhoto := b.profilePicture(s, info.Sender)

	return map[string]any{
		"event":                 "message",
		"connectionId":          s.id,
		"messageId":             info.ID,
		"id":                    info.ID,
		"chatJid":               chat,
		"remoteJid":             chat,
		"senderJid":             sender,
		"fromMe":                info.IsFromMe,
		"pushName":              pushName,
		"senderName":            pushName,
		"senderProfileImageUrl": senderPhoto,
		"groupName":             groupName,
		"groupPictureUrl":       groupPhoto,
		"participants":          participants,
		"body":                  body,
		"type":                  msgType,
		"mediaUrl":              mediaURL,
		"mediaMimeType":         mimeType,
		"mediaFileName":         fileName,
		"mediaSize":             fileSize,
		"timestamp":             info.Timestamp.Format(time.RFC3339Nano),
	}
}

func conversationPayload(s *session, chatJID string, msg map[string]any) map[string]any {
	return map[string]any{
		"connectionId":       s.id,
		"chatJid":            chatJID,
		"jid":                chatJID,
		"groupName":          msg["groupName"],
		"groupPictureUrl":    msg["groupPictureUrl"],
		"pushName":           msg["pushName"],
		"profileImageUrl":    msg["senderProfileImageUrl"],
		"participants":       msg["participants"],
		"lastMessagePreview": msg["body"],
		"timestamp":          msg["timestamp"],
	}
}

func (b *bridge) profilePicture(s *session, jid types.JID) string {
	if jid.IsEmpty() {
		return ""
	}
	pic, err := s.client.GetProfilePictureInfo(context.Background(), jid, &whatsmeow.GetProfilePictureParams{Preview: true})
	if err != nil || pic == nil {
		return ""
	}
	return pic.URL
}

func (s *session) snapshot() map[string]any {
	return map[string]any{
		"id":              s.id,
		"name":            s.name,
		"phoneNumber":     s.phoneNumber,
		"status":          s.status,
		"qrCode":          s.qrCode,
		"deviceJid":       s.deviceJID,
		"error":           s.lastError,
		"profileImageUrl": "",
	}
}

func (b *bridge) postWebhook(payload map[string]any) {
	if b.webhookURL == "" {
		return
	}
	body, _ := json.Marshal(payload)
	req, err := http.NewRequest(http.MethodPost, b.webhookURL, bytes.NewReader(body))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/json")
	if b.webhookSecret != "" {
		req.Header.Set("x-whatsmeow-secret", b.webhookSecret)
	}
	client := &http.Client{Timeout: 10 * time.Second}
	resp, err := client.Do(req)
	if err == nil && resp.Body != nil {
		_ = resp.Body.Close()
	}
}

func (b *bridge) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if !b.checkAuth(r) {
			writeJSON(w, http.StatusUnauthorized, map[string]any{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

func (b *bridge) checkAuth(r *http.Request) bool {
	if b.apiToken == "" {
		return true
	}
	expected := "Bearer " + b.apiToken
	return subtle.ConstantTimeCompare([]byte(r.Header.Get("Authorization")), []byte(expected)) == 1
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func parseJID(raw string) (types.JID, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return types.EmptyJID, errors.New("empty jid")
	}
	if strings.Contains(raw, "@") {
		return types.ParseJID(raw)
	}
	digits := onlyDigits(raw)
	if digits == "" {
		return types.EmptyJID, errors.New("invalid jid")
	}
	return types.NewJID(digits, types.DefaultUserServer), nil
}

func qrToDataURL(code string) string {
	png, err := qrcode.Encode(code, qrcode.Medium, 320)
	if err != nil {
		return code
	}
	return "data:image/png;base64," + base64.StdEncoding.EncodeToString(png)
}

func env(key, fallbackValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return fallbackValue
}

func fallback(value, fallbackValue string) string {
	if strings.TrimSpace(value) != "" {
		return strings.TrimSpace(value)
	}
	return fallbackValue
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func onlyDigits(value string) string {
	var builder strings.Builder
	for _, ch := range value {
		if ch >= '0' && ch <= '9' {
			builder.WriteRune(ch)
		}
	}
	return builder.String()
}

func dataURL(mimeType string, data []byte) string {
	if strings.TrimSpace(mimeType) == "" {
		mimeType = http.DetectContentType(data)
	}
	return "data:" + mimeType + ";base64," + base64.StdEncoding.EncodeToString(data)
}

func safeID(value string) string {
	var builder strings.Builder
	for _, ch := range value {
		if (ch >= 'a' && ch <= 'z') || (ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9') || ch == '-' || ch == '_' {
			builder.WriteRune(ch)
		}
	}
	if builder.Len() == 0 {
		return "default"
	}
	return builder.String()
}
