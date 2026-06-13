// @ts-nocheck
import makeWASocket, { DisconnectReason, useMultiFileAuthState, fetchLatestBaileysVersion, WASocket, WAMessage } from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import QRCode from "qrcode";
import path from "path";
import fs from "fs";
import pino from "pino";

const logger = pino({ level: "silent" });
const sessionsDir = path.join(process.cwd(), "data", "baileys");

export const baileysSessions = new Map<string, WASocket>();

export async function connectBaileys(
  connectionId: string, 
  onUpdate: (update: { status: string; qr?: string; error?: string }) => void, 
  onMessage: (msg: WAMessage) => void
) {
  if (!fs.existsSync(sessionsDir)) fs.mkdirSync(sessionsDir, { recursive: true });
  
  const { state, saveCreds } = await useMultiFileAuthState(path.join(sessionsDir, connectionId));
  const { version } = await fetchLatestBaileysVersion();
  
  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    logger,
    browser: ['ConsultioMed', 'Chrome', '1.0.0']
  });

  baileysSessions.set(connectionId, sock);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;
    
    let qrDataUrl;
    if (qr) {
       qrDataUrl = await QRCode.toDataURL(qr);
       onUpdate({ status: 'qr', qr: qrDataUrl });
    }

    if (connection === 'close') {
        const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
        if (shouldReconnect) {
            onUpdate({ status: 'connecting' });
            connectBaileys(connectionId, onUpdate, onMessage);
        } else {
            onUpdate({ status: 'disconnected', error: 'Desconectado do WhatsApp' });
            baileysSessions.delete(connectionId);
            fs.rmSync(path.join(sessionsDir, connectionId), { recursive: true, force: true });
        }
    } else if (connection === 'open') {
        onUpdate({ status: 'connected' });
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", (m) => {
    if (m.type === "notify") {
      for (const msg of m.messages) {
        onMessage(msg);
      }
    }
  });

  return sock;
}

export async function disconnectBaileys(connectionId: string) {
  const sock = baileysSessions.get(connectionId);
  if (sock) {
    sock.logout();
    baileysSessions.delete(connectionId);
  }
}

export async function sendBaileysMessage(connectionId: string, jid: string, text: string) {
  const sock = baileysSessions.get(connectionId);
  if (!sock) throw new Error("WhatsApp não está conectado.");
  
  const sent = await sock.sendMessage(jid, { text });
  return sent;
}
