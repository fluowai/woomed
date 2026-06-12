import { randomUUID } from "crypto";
import { WebSocket } from "ws";
import { AppData } from "./data";
import { WhatsAppConnection, WhatsAppConnectionStatus, WhatsAppConversation, WhatsAppMessage, WhatsAppMessageType, WhatsAppParticipant } from "../src/types";
import { nowIso } from "./helpers";
import { WHATSMEOW_API_URL, WHATSMEOW_API_TOKEN } from "./config";

export const whatsappSockets = new Set<WebSocket>();

export function broadcastWhatsAppRealtime(type: string, payload: unknown) {
  const packet = JSON.stringify({ type, payload, at: nowIso() });
  for (const socket of whatsappSockets) {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(packet);
    }
  }
}

export function normalizeWhatsAppNumber(input = "") {
  const digits = String(input).replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("55")) return digits;
  if (digits.length === 11 || digits.length === 10) return `55${digits}`;
  return digits;
}

export function isValidWhatsAppNumber(input = "") {
  const normalized = normalizeWhatsAppNumber(input);
  if (!/^55\d{10,11}$/.test(normalized)) return false;
  const areaCode = Number(normalized.slice(2, 4));
  return areaCode >= 11 && areaCode <= 99;
}

export function formatWhatsAppPhone(input = "") {
  const normalized = normalizeWhatsAppNumber(input);
  return normalized ? `+${normalized}` : "";
}

export function jidToNumber(jid = "") {
  return normalizeWhatsAppNumber(String(jid).split("@")[0]);
}

export function isGroupJid(jid = "") {
  return String(jid).endsWith("@g.us");
}

export function isNewsletterJid(jid = "") {
  return String(jid).endsWith("@newsletter");
}

export function firstText(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function initialsAvatar(seed: string) {
  return `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(seed || "WhatsApp")}`;
}

export function sanitizeConnection(connection: WhatsAppConnection) {
  return connection;
}

export function normalizeConnectionStatus(value: unknown, fallback: WhatsAppConnectionStatus = "disconnected") {
  const status = String(value || "").toLowerCase();
  if (["disconnected", "connecting", "qr", "connected", "error"].includes(status)) {
    return status as WhatsAppConnectionStatus;
  }
  if (status.includes("open") || status.includes("online")) return "connected";
  if (status.includes("qr")) return "qr";
  if (status.includes("connect")) return "connecting";
  if (status.includes("error") || status.includes("fail")) return "error";
  return fallback;
}

export async function callWhatsmeowBridge<T>(pathName: string, init: RequestInit = {}): Promise<T | null> {
  if (!WHATSMEOW_API_URL) return null;

  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (WHATSMEOW_API_TOKEN) headers.set("Authorization", `Bearer ${WHATSMEOW_API_TOKEN}`);

  const response = await fetch(`${WHATSMEOW_API_URL}${pathName}`, {
    ...init,
    headers
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = body && typeof body === "object" && "error" in body ? String((body as { error: unknown }).error) : "Bridge Whatsmeow indisponivel.";
    throw new Error(error);
  }

  return body as T;
}

export function inferMessageType(payload: Record<string, unknown>): WhatsAppMessageType {
  const rawType = firstText(payload.type, payload.messageType, payload.mediaType, payload.mimeType, payload.mimetype).toLowerCase();
  const fileName = firstText(payload.fileName, payload.filename, payload.documentName, payload.name).toLowerCase();
  if (rawType.includes("image")) return "image";
  if (rawType.includes("audio")) return "audio";
  if (rawType.includes("video")) return "video";
  if (rawType.includes("document") || rawType.includes("pdf") || rawType.includes("msword") || rawType.includes("officedocument")) return "document";
  if (rawType.includes("text") || rawType.includes("conversation")) return "text";
  if (fileName.endsWith(".pdf") || fileName.endsWith(".doc") || fileName.endsWith(".docx")) return "document";
  if (firstText(payload.imageUrl, payload.mediaUrl, payload.url)) return "image";
  return "text";
}

function numberValue(...values: unknown[]) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return undefined;
}

export function normalizeWhatsAppParticipant(raw: Record<string, unknown>, fallbackIndex = 0): WhatsAppParticipant {
  const jid = firstText(raw.jid, raw.id, raw.participant, raw.senderJid);
  const number = jidToNumber(jid) || normalizeWhatsAppNumber(firstText(raw.phone, raw.number));
  const pushName = firstText(raw.pushName, raw.pushname, raw.name, raw.notify);
  const name = pushName || (number ? formatWhatsAppPhone(number) : `Participante ${fallbackIndex + 1}`);

  return {
    id: jid || number || `participant-${fallbackIndex}`,
    jid: jid || (number ? `${number}@s.whatsapp.net` : `participant-${fallbackIndex}`),
    phone: number ? formatWhatsAppPhone(number) : undefined,
    name,
    pushName: pushName || undefined,
    profileImageUrl: firstText(raw.profileImageUrl, raw.pictureUrl, raw.profilePicUrl, raw.avatarUrl, raw.photoUrl) || initialsAvatar(name)
  };
}

export function findOrCreateConversation(
  data: AppData,
  connectionId: string,
  raw: Record<string, unknown>
) {
  const chatJid = firstText(raw.chatJid, raw.chat, raw.conversationJid, raw.remoteJid, raw.from, raw.jid);
  const senderJid = firstText(raw.senderJid, raw.sender, raw.participant, raw.from);
  const conversationJid = chatJid || senderJid;
  const group = isGroupJid(conversationJid);
  const normalizedPhone = group ? "" : jidToNumber(conversationJid);
  const pushName = firstText(raw.pushName, raw.pushname, raw.notifyName, raw.notify, raw.senderName, raw.name);
  const groupName = firstText(raw.groupName, raw.groupSubject, raw.subject, raw.chatName, raw.name);
  const directTitle = pushName || (normalizedPhone ? formatWhatsAppPhone(normalizedPhone) : "Contato sem nome");
  const title = group ? groupName || "Grupo sem nome" : directTitle;
  const participantsPayload = Array.isArray(raw.participants) ? raw.participants : [];
  const participants = participantsPayload
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item, index) => normalizeWhatsAppParticipant(item, index));
  const profileImageUrl = firstText(raw.profileImageUrl, raw.pictureUrl, raw.profilePicUrl, raw.avatarUrl, raw.groupPictureUrl, raw.groupPhotoUrl, raw.photoUrl) || initialsAvatar(title);
  const conversationId = firstText(raw.conversationId) || `${connectionId}:${conversationJid || "unknown"}`;
  let conversation = data.whatsappConversations.find(item =>
    item.connectionId === connectionId && (item.jid === conversationJid || item.id === conversationId)
  );

  if (!conversation) {
    conversation = {
      id: conversationId,
      connectionId,
      jid: conversationJid,
      kind: group ? "group" : "direct",
      title,
      leadName: title,
      pushName: pushName || undefined,
      phone: normalizedPhone ? formatWhatsAppPhone(normalizedPhone) : undefined,
      normalizedPhone: normalizedPhone || undefined,
      profileImageUrl,
      groupName: group ? title : undefined,
      participantCount: participants.length || undefined,
      participants,
      lastMessagePreview: "",
      unreadCount: 0,
      updatedAt: nowIso()
    };
    data.whatsappConversations.unshift(conversation);
  } else {
    conversation.title = title || conversation.title;
    conversation.pushName = pushName || conversation.pushName;
    conversation.phone = normalizedPhone ? formatWhatsAppPhone(normalizedPhone) : conversation.phone;
    conversation.normalizedPhone = normalizedPhone || conversation.normalizedPhone;
    conversation.profileImageUrl = profileImageUrl || conversation.profileImageUrl;
    conversation.groupName = group ? title : conversation.groupName;
    conversation.participants = participants.length ? participants : conversation.participants;
    conversation.participantCount = participants.length || conversation.participantCount;
    conversation.updatedAt = nowIso();
  }

  return conversation;
}

export function buildWhatsAppMessage(
  connection: WhatsAppConnection,
  conversation: WhatsAppConversation,
  raw: Record<string, unknown>
): WhatsAppMessage {
  const fromMe = Boolean(raw.fromMe || raw.isFromMe);
  const senderJid = firstText(raw.senderJid, raw.sender, raw.participant, raw.from) || conversation.jid;
  const senderNumber = jidToNumber(senderJid) || normalizeWhatsAppNumber(firstText(raw.senderPhone, raw.phone, raw.number));
  const pushName = firstText(raw.pushName, raw.pushname, raw.notifyName, raw.senderName, raw.name);
  const participantName = conversation.participants.find(item => item.jid === senderJid || normalizeWhatsAppNumber(item.phone) === senderNumber)?.name;
  const senderDisplayName = fromMe
    ? connection.name
    : pushName || participantName || (senderNumber ? formatWhatsAppPhone(senderNumber) : conversation.leadName);
  const body = firstText(raw.body, raw.text, raw.conversation, raw.caption, raw.message);
  const type = inferMessageType(raw);
  const timestamp = firstText(raw.timestamp, raw.createdAt, raw.messageTimestamp) || nowIso();
  if (conversation.kind === "group" && !fromMe && senderJid && !conversation.participants.some(item => item.jid === senderJid)) {
    conversation.participants.push({
      id: senderJid,
      jid: senderJid,
      phone: senderNumber ? formatWhatsAppPhone(senderNumber) : undefined,
      name: senderDisplayName,
      pushName: pushName || undefined,
      profileImageUrl: firstText(raw.senderProfileImageUrl, raw.senderPictureUrl, raw.senderPhotoUrl) || initialsAvatar(senderDisplayName)
    });
    conversation.participantCount = Math.max(conversation.participantCount || 0, conversation.participants.length);
  }

  return {
    id: firstText(raw.id) || `wa-msg-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    connectionId: connection.id,
    conversationId: conversation.id,
    messageId: firstText(raw.messageId, raw.id) || randomUUID(),
    fromMe,
    senderJid,
    senderPhone: senderNumber ? formatWhatsAppPhone(senderNumber) : undefined,
    senderPushName: pushName || undefined,
    senderDisplayName,
    body,
    type,
    mediaUrl: firstText(raw.mediaUrl, raw.imageUrl, raw.audioUrl, raw.videoUrl, raw.documentUrl, raw.fileUrl, raw.url) || undefined,
    mediaMimeType: firstText(raw.mediaMimeType, raw.mimeType, raw.mimetype) || undefined,
    mediaFileName: firstText(raw.mediaFileName, raw.fileName, raw.filename, raw.documentName) || undefined,
    mediaSize: numberValue(raw.mediaSize, raw.fileSize, raw.size),
    mediaDurationSeconds: numberValue(raw.mediaDurationSeconds, raw.durationSeconds, raw.seconds),
    thumbnailUrl: firstText(raw.thumbnailUrl, raw.jpegThumbnailUrl, raw.previewUrl) || undefined,
    timestamp,
    status: fromMe ? "sent" : "received"
  };
}
