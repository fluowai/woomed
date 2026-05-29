import { Express } from "express";
import { WebSocketServer, WebSocket } from "ws";
import { Server } from "http";
import { loadData, saveData } from "../data";
import { AuthedRequest, sessions, requireAuth, requireRoles } from "../middleware";
import { audit, nowIso } from "../helpers";
import {
  broadcastWhatsAppRealtime, sanitizeConnection, normalizeConnectionStatus,
  normalizeWhatsAppNumber, formatWhatsAppPhone, firstText, findOrCreateConversation,
  buildWhatsAppMessage, callWhatsmeowBridge, initialsAvatar, whatsappSockets
} from "../whatsapp-utils";
import { WHATSMEOW_API_URL } from "../config";

export function registerWhatsAppRoutes(app: Express, httpServer: Server) {
  const wss = new WebSocketServer({ server: httpServer, path: "/api/whatsapp/ws" });

  wss.on("connection", (socket, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const token = url.searchParams.get("token") || "";
    const user = sessions.get(token);
    if (!user) { socket.close(1008, "Sessao invalida."); return; }
    whatsappSockets.add(socket);
    socket.send(JSON.stringify({ type: "ready", payload: { userId: user.id }, at: nowIso() }));
    socket.on("close", () => whatsappSockets.delete(socket));
    socket.on("error", () => whatsappSockets.delete(socket));
  });

  app.get("/api/whatsapp/connections", requireAuth, async (_req, res) => {
    const data = await loadData();
    res.json({ bridgeConfigured: Boolean(WHATSMEOW_API_URL), connections: data.whatsappConnections.map(sanitizeConnection) });
  });

  app.post("/api/whatsapp/connections", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { name, phoneNumber } = req.body || {};
    const normalizedPhone = normalizeWhatsAppNumber(phoneNumber);
    if (!name || !normalizedPhone) return res.status(400).json({ error: "Nome e numero WhatsApp sao obrigatorios." });
    if (data.whatsappConnections.find(c => c.normalizedPhone === normalizedPhone)) return res.status(409).json({ error: "Ja existe conexao com este numero." });
    const connection = { id: `wa-${Date.now()}`, name: String(name).trim(), phoneNumber: formatWhatsAppPhone(normalizedPhone), normalizedPhone, provider: "whatsmeow" as const, status: "disconnected" as const, profileImageUrl: initialsAvatar(String(name)), createdAt: nowIso(), updatedAt: nowIso() };
    data.whatsappConnections.unshift(connection);
    audit(data, req.user!, "create", "whatsapp_connection", connection.id, connection.phoneNumber);
    await saveData(data);
    broadcastWhatsAppRealtime("whatsapp.connection", sanitizeConnection(connection));
    res.json({ connection, bridgeConfigured: Boolean(WHATSMEOW_API_URL) });
  });

  app.delete("/api/whatsapp/connections/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.whatsappConnections.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Conexao nao encontrada." });
    const removed = data.whatsappConnections.splice(idx, 1)[0];
    data.whatsappConversations = data.whatsappConversations.filter(c => c.connectionId !== removed.id);
    data.whatsappMessages = data.whatsappMessages.filter(m => m.connectionId !== removed.id);
    audit(data, req.user!, "delete", "whatsapp_connection", removed.id, removed.phoneNumber);
    await saveData(data);
    broadcastWhatsAppRealtime("whatsapp.connection.deleted", { id: removed.id });
    res.json({ ok: true });
  });

  app.post("/api/whatsapp/connections/:id/connect", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const conn = data.whatsappConnections.find(c => c.id === req.params.id);
    if (!conn) return res.status(404).json({ error: "Conexao nao encontrada." });
    conn.status = "connecting"; conn.error = undefined; conn.updatedAt = nowIso();
    try {
      const bridgeResp = await callWhatsmeowBridge<Record<string, unknown>>(`/connections/${conn.id}/connect`, { method: "POST", body: JSON.stringify({ id: conn.id, name: conn.name, phoneNumber: conn.normalizedPhone }) });
      if (!bridgeResp) { conn.status = "error"; conn.error = "Configure WHATSMEOW_API_URL para conectar."; }
      else {
        conn.status = normalizeConnectionStatus(bridgeResp.status, firstText(bridgeResp.qrCode, bridgeResp.qr) ? "qr" : "connecting");
        conn.qrCode = firstText(bridgeResp.qrCode, bridgeResp.qr) || undefined;
        conn.deviceJid = firstText(bridgeResp.deviceJid, bridgeResp.jid) || conn.deviceJid;
        conn.profileImageUrl = firstText(bridgeResp.profileImageUrl, bridgeResp.pictureUrl) || conn.profileImageUrl;
        conn.error = firstText(bridgeResp.error) || undefined;
        if (conn.status === "connected") conn.lastSyncAt = nowIso();
      }
    } catch (e) { conn.status = "error"; conn.error = e instanceof Error ? e.message : "Falha ao conectar."; }
    conn.updatedAt = nowIso();
    audit(data, req.user!, "connect", "whatsapp_connection", conn.id, conn.status);
    await saveData(data);
    broadcastWhatsAppRealtime("whatsapp.connection", sanitizeConnection(conn));
    res.json({ connection: conn, bridgeConfigured: Boolean(WHATSMEOW_API_URL) });
  });

  app.post("/api/whatsapp/connections/:id/disconnect", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const conn = data.whatsappConnections.find(c => c.id === req.params.id);
    if (!conn) return res.status(404).json({ error: "Conexao nao encontrada." });
    try { await callWhatsmeowBridge(`/connections/${conn.id}/disconnect`, { method: "POST" }); } catch (e) { conn.error = e instanceof Error ? e.message : "Falha ao desconectar."; }
    conn.status = "disconnected"; conn.qrCode = undefined; conn.updatedAt = nowIso();
    audit(data, req.user!, "disconnect", "whatsapp_connection", conn.id, conn.phoneNumber);
    await saveData(data);
    broadcastWhatsAppRealtime("whatsapp.connection", sanitizeConnection(conn));
    res.json({ connection: conn });
  });

  app.post("/api/whatsapp/connections/:id/sync", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const conn = data.whatsappConnections.find(c => c.id === req.params.id);
    if (!conn) return res.status(404).json({ error: "Conexao nao encontrada." });
    try {
      const bridgeResp = await callWhatsmeowBridge<Record<string, unknown>>(`/connections/${conn.id}/sync`, { method: "POST" });
      if (bridgeResp) {
        const rawConversations = Array.isArray(bridgeResp.conversations) ? bridgeResp.conversations : [];
        for (const raw of rawConversations) { if (raw && typeof raw === "object") findOrCreateConversation(data, conn.id, raw as Record<string, unknown>); }
        const rawMessages = Array.isArray(bridgeResp.messages) ? bridgeResp.messages : [];
        for (const raw of rawMessages) {
          if (!raw || typeof raw !== "object") continue;
          const conv = findOrCreateConversation(data, conn.id, raw as Record<string, unknown>);
          const msg = buildWhatsAppMessage(conn, conv, raw as Record<string, unknown>);
          if (!data.whatsappMessages.some(m => m.connectionId === msg.connectionId && m.conversationId === msg.conversationId && m.messageId === msg.messageId)) data.whatsappMessages.push(msg);
        }
        conn.status = normalizeConnectionStatus(bridgeResp.status, conn.status);
        conn.profileImageUrl = firstText(bridgeResp.profileImageUrl, bridgeResp.pictureUrl) || conn.profileImageUrl;
      }
      conn.lastSyncAt = nowIso(); conn.updatedAt = conn.lastSyncAt;
      data.whatsappConversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      audit(data, req.user!, "sync", "whatsapp_connection", conn.id, "Sincronizacao WhatsApp");
      await saveData(data);
      broadcastWhatsAppRealtime("whatsapp.sync", { connection: conn, conversations: data.whatsappConversations.filter(c => c.connectionId === conn.id) });
      res.json({ connection: conn, conversations: data.whatsappConversations.filter(c => c.connectionId === conn.id), messages: data.whatsappMessages.filter(m => m.connectionId === conn.id) });
    } catch (e) {
      conn.status = "error"; conn.error = e instanceof Error ? e.message : "Falha ao sincronizar."; conn.updatedAt = nowIso();
      await saveData(data);
      broadcastWhatsAppRealtime("whatsapp.connection", sanitizeConnection(conn));
      res.status(502).json({ error: conn.error, connection: conn });
    }
  });

  app.get("/api/whatsapp/conversations", requireAuth, async (req, res) => {
    const data = await loadData();
    const connectionId = String(req.query.connectionId || "");
    res.json({ conversations: data.whatsappConversations.filter(c => !connectionId || c.connectionId === connectionId).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) });
  });

  app.patch("/api/whatsapp/conversations/:id/lead", requireAuth, requireRoles(["admin", "doctor", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const conv = data.whatsappConversations.find(c => c.id === req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversa nao encontrada." });
    const leadName = String(req.body?.leadName || "").trim();
    if (!leadName) return res.status(400).json({ error: "Nome do lead e obrigatorio." });
    conv.leadName = leadName; conv.updatedAt = nowIso();
    audit(data, req.user!, "update_lead", "whatsapp_conversation", conv.id, leadName);
    await saveData(data);
    broadcastWhatsAppRealtime("whatsapp.conversation", conv);
    res.json({ conversation: conv });
  });

  app.get("/api/whatsapp/conversations/:id/messages", requireAuth, async (req, res) => {
    const data = await loadData();
    const conv = data.whatsappConversations.find(c => c.id === req.params.id);
    if (!conv) return res.status(404).json({ error: "Conversa nao encontrada." });
    conv.unreadCount = 0; await saveData(data);
    res.json({ conversation: conv, messages: data.whatsappMessages.filter(m => m.conversationId === conv.id).sort((a, b) => a.timestamp.localeCompare(b.timestamp)) });
  });

  app.post("/api/whatsapp/messages", requireAuth, requireRoles(["admin", "doctor", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { conversationId, body } = req.body || {};
    const conv = data.whatsappConversations.find(c => c.id === conversationId);
    if (!conv) return res.status(404).json({ error: "Conversa nao encontrada." });
    const conn = data.whatsappConnections.find(c => c.id === conv.connectionId);
    if (!conn) return res.status(404).json({ error: "Conexao nao encontrada." });
    const text = String(body || "").trim();
    if (!text) return res.status(400).json({ error: "Mensagem vazia." });
    let bridgeMessageId = "";
    try {
      const bridgeResp = await callWhatsmeowBridge<Record<string, unknown>>("/messages/send", { method: "POST", body: JSON.stringify({ connectionId: conn.id, to: conv.jid, text }) });
      bridgeMessageId = firstText(bridgeResp?.messageId, bridgeResp?.id);
    } catch (e) { if (WHATSMEOW_API_URL) return res.status(502).json({ error: e instanceof Error ? e.message : "Falha ao enviar." }); }
    const msg = { id: `wa-msg-${Date.now()}`, connectionId: conn.id, conversationId: conv.id, messageId: bridgeMessageId || (await import("crypto")).randomUUID(), fromMe: true, senderJid: conn.deviceJid || `${conn.normalizedPhone}@s.whatsapp.net`, senderPhone: conn.phoneNumber, senderDisplayName: conn.name, body: text, type: "text" as const, timestamp: nowIso(), status: "sent" as const };
    data.whatsappMessages.push(msg);
    conv.lastMessagePreview = text; conv.updatedAt = msg.timestamp; conv.unreadCount = 0;
    audit(data, req.user!, "send", "whatsapp_message", msg.id, conv.leadName);
    await saveData(data);
    broadcastWhatsAppRealtime("whatsapp.message", { conversation: conv, message: msg });
    res.json({ conversation: conv, message: msg });
  });

  app.post("/api/whatsapp/webhook", async (req, res) => {
    const { WHATSMEOW_WEBHOOK_SECRET } = await import("../config");
    if (WHATSMEOW_WEBHOOK_SECRET && req.header("x-whatsmeow-secret") !== WHATSMEOW_WEBHOOK_SECRET) return res.status(401).json({ error: "Webhook nao autorizado." });
    const data = await loadData();
    const payload = (req.body || {}) as Record<string, unknown>;
    const connectionId = firstText(payload.connectionId, payload.sessionId, payload.deviceId) || data.whatsappConnections[0]?.id;
    const conn = data.whatsappConnections.find(c => c.id === connectionId);
    if (!conn) return res.status(404).json({ error: "Conexao nao encontrada." });
    const eventType = firstText(payload.event, payload.type).toLowerCase();
    const hasMessageShape = Boolean(firstText(payload.body, payload.text, payload.conversation, payload.caption, payload.message, payload.chatJid, payload.remoteJid, payload.from));
    if (eventType.includes("connection") || eventType.includes("session") || eventType.includes("device") || (!hasMessageShape && firstText(payload.status))) {
      conn.status = normalizeConnectionStatus(payload.status, conn.status);
      conn.deviceJid = firstText(payload.deviceJid, payload.jid) || conn.deviceJid;
      conn.profileImageUrl = firstText(payload.profileImageUrl, payload.pictureUrl) || conn.profileImageUrl;
      conn.qrCode = firstText(payload.qrCode, payload.qr) || conn.qrCode;
      conn.error = firstText(payload.error) || undefined; conn.updatedAt = nowIso();
      if (conn.status === "connected") conn.lastSyncAt = conn.updatedAt;
      await saveData(data);
      broadcastWhatsAppRealtime("whatsapp.connection", sanitizeConnection(conn));
      return res.json({ ok: true, connection: conn });
    }
    const conversation = findOrCreateConversation(data, conn.id, payload);
    const message = buildWhatsAppMessage(conn, conversation, payload);
    const dupIdx = data.whatsappMessages.findIndex(m => m.connectionId === message.connectionId && m.conversationId === message.conversationId && m.messageId === message.messageId);
    if (dupIdx >= 0) data.whatsappMessages[dupIdx] = { ...data.whatsappMessages[dupIdx], ...message };
    else data.whatsappMessages.push(message);
    const previewPrefix = conversation.kind === "group" && !message.fromMe ? `${message.senderDisplayName}: ` : "";
    conversation.lastMessagePreview = `${previewPrefix}${message.body || message.type}`;
    conversation.updatedAt = message.timestamp;
    if (!message.fromMe) conversation.unreadCount += 1;
    data.whatsappConversations.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    await saveData(data);
    broadcastWhatsAppRealtime("whatsapp.message", { conversation, message });
    res.json({ ok: true, conversation, message });
  });
}
