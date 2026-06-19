import { loadData, saveData } from "../data";
import { HAS_GEMINI_KEY, GEMINI_API_KEY, WHATSMEOW_API_URL } from "../config";
import type { AgentSession, AgentLead } from "../../src/agent-types";
import { nowIso } from "../helpers";

interface FollowUpConfig {
  enabled: boolean;
  intervals: number[];
  messageTemplate: string;
}

interface FollowUpEntry {
  sessionId: string;
  leadId?: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  channel: string;
  agentId: string;
  connectionId?: string;
  lastContactAt: string;
  nextFollowUpAt: string;
  followUpCount: number;
  stage: string;
  createdAt: string;
}

const DEFAULT_INTERVALS = [1, 24, 72];
const ABANDONMENT_HOURS = 2;

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  if (!HAS_GEMINI_KEY) return "";
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { headers: { "User-Agent": "consultio-med" } } });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: userMessage,
    config: { systemInstruction: systemPrompt }
  });
  return response.text || "";
}

function getFollowUpData(data: any): { entries: FollowUpEntry[] } {
  if (!data.__followUp) data.__followUp = { entries: [] };
  return data.__followUp;
}

export async function registerForFollowUp(session: AgentSession, lead?: AgentLead): Promise<void> {
  const data = await loadData();
  const fu = getFollowUpData(data as any);

  const existingIdx = fu.entries.findIndex(e => e.sessionId === session.id);
  if (existingIdx >= 0) fu.entries.splice(existingIdx, 1);

  const entry: FollowUpEntry = {
    sessionId: session.id,
    leadId: lead?.id,
    contactId: session.contactId,
    contactName: session.contactName,
    contactPhone: session.contactPhone,
    channel: session.channel,
    agentId: session.agentId,
    lastContactAt: nowIso(),
    nextFollowUpAt: addHours(nowIso(), 1),
    followUpCount: 0,
    stage: session.leadStage || "novo",
    createdAt: nowIso(),
  };

  fu.entries.push(entry);
  (data as any).__followUp = fu;
  await saveData(data);
}

export async function unregisterFromFollowUp(sessionId: string): Promise<void> {
  const data = await loadData();
  const fu = getFollowUpData(data as any);
  fu.entries = fu.entries.filter(e => e.sessionId !== sessionId);
  (data as any).__followUp = fu;
  await saveData(data);
}

export async function checkFollowUps(): Promise<void> {
  const data = await loadData();
  const fu = getFollowUpData(data as any);
  const now = new Date();
  const dueEntries = fu.entries.filter(e => new Date(e.nextFollowUpAt) <= now);

  for (const entry of dueEntries) {
    try {
      await processFollowUp(entry, data);
    } catch (err) {
      console.error(`[FollowUp] Error processing ${entry.sessionId}:`, err);
    }
  }
}

async function processFollowUp(entry: FollowUpEntry, data: any): Promise<void> {
  const rt = data.__agentRuntime || { sessions: [] };
  const session = rt.sessions.find((s: any) => s.id === entry.sessionId);

  if (!session || session.status === "resolved" || session.status === "expired") {
    const fu = getFollowUpData(data);
    fu.entries = fu.entries.filter(e => e.sessionId !== entry.sessionId);
    data.__followUp = fu;
    await saveData(data);
    return;
  }

  const intervals = DEFAULT_INTERVALS;
  const nextIntervalIdx = entry.followUpCount;

  if (nextIntervalIdx >= intervals.length) {
    const fu = getFollowUpData(data);
    fu.entries = fu.entries.filter(e => e.sessionId !== entry.sessionId);
    data.__followUp = fu;

    const lead = rt.leads?.find((l: any) => l.sessionId === entry.sessionId);
    if (lead && lead.stage !== "convertido" && lead.stage !== "perdido") {
      lead.stage = "perdido";
      lead.notes += " | Lead perdido por falta de resposta após follow-ups";
    }
    if (session) session.status = "expired";
    data.__agentRuntime = rt;
    await saveData(data);
    return;
  }

  const message = await generateFollowUpMessage(entry, nextIntervalIdx, data);

  if (entry.channel === "whatsapp" && message && entry.connectionId) {
    await sendWhatsAppMessage(entry.connectionId, entry.contactId, message);
  }

  entry.followUpCount++;
  entry.lastContactAt = nowIso();
  entry.nextFollowUpAt = addHours(nowIso(), intervals[Math.min(nextIntervalIdx + 1, intervals.length - 1)]);

  const fu = getFollowUpData(data);
  const idx = fu.entries.findIndex(e => e.sessionId === entry.sessionId);
  if (idx >= 0) fu.entries[idx] = entry;
  data.__followUp = fu;
  await saveData(data);

  if (rt.executionLogs) {
    rt.executionLogs.push({
      id: `followup-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      sessionId: entry.sessionId,
      agentId: entry.agentId,
      action: "enviar_lembrete",
      prompt: `Follow-up #${entry.followUpCount} automático`,
      response: message,
      modelUsed: "followup-system",
      tokensUsed: 0,
      latencyMs: 0,
      success: true,
      createdAt: nowIso(),
    });
    data.__agentRuntime = rt;
  }
  await saveData(data);
}

async function generateFollowUpMessage(entry: FollowUpEntry, attempt: number, data: any): Promise<string> {
  const templates = [
    `Olá ${entry.contactName}! Tudo bem? 😊 Passando para saber se você ainda tem interesse em agendar uma consulta. Estamos à disposição!`,
    `Olá ${entry.contactName}! Ainda está pensando na consulta? 🏥 Temos horários disponíveis esta semana. É só me avisar!`,
    `Olá ${entry.contactName}! Tudo bem? 😊 Gostaria de reforçar que estamos com horários disponíveis. Posso ajudar com alguma informação?`,
  ];

  if (attempt < templates.length) return templates[attempt];

  if (HAS_GEMINI_KEY) {
    const rt = data.__agentRuntime || {};
    const agent = data.serviceAgents?.find((a: any) => a.id === entry.agentId);
    const systemPrompt = `Você é um assistente de clínica médica. Gere uma mensagem curta e amigável de follow-up para reengajar um paciente que parou de responder. A mensagem deve ser educada, oferecer ajuda e não ser invasiva. Responda em português do Brasil.`;
    const prompt = `Nome do paciente: ${entry.contactName}
Estágio: ${entry.stage}
Número de follow-ups já enviados: ${entry.followUpCount}
Gere uma mensagem personalizada de follow-up (máximo 200 caracteres).`;
    try {
      const raw = await callLLM(systemPrompt, prompt);
      if (raw) return raw.slice(0, 300);
    } catch {}
  }

  return `Olá ${entry.contactName}! 😊 Passando para saber se precisa de algo. Estamos aqui para ajudar!`;
}

async function sendWhatsAppMessage(connectionId: string, to: string, text: string): Promise<void> {
  if (!WHATSMEOW_API_URL) return;
  try {
    await fetch(`${WHATSMEOW_API_URL}/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, to, text }),
    });
  } catch (err) {
    console.error(`[FollowUp] WhatsApp send failed:`, err);
  }
}

function addHours(isoDate: string, hours: number): string {
  const date = new Date(isoDate);
  date.setHours(date.getHours() + hours);
  return date.toISOString();
}

export async function findAbandonedSessions(): Promise<void> {
  const data: any = await loadData();
  const rt = data.__agentRuntime || { sessions: [] };
  const fu = getFollowUpData(data);

  const now = Date.now();
  const abandonmentMs = ABANDONMENT_HOURS * 60 * 60 * 1000;

  for (const session of rt.sessions) {
    if (session.status !== "active") continue;
    if (session.leadStage === "convertido" || session.leadStage === "perdido") continue;

    const alreadyRegistered = fu.entries.some(e => e.sessionId === session.id);
    if (alreadyRegistered) continue;

    const elapsed = now - new Date(session.lastMessageAt).getTime();
    if (elapsed >= abandonmentMs) {
      const lead = rt.leads?.find((l: any) => l.sessionId === session.id);
      const entry: FollowUpEntry = {
        sessionId: session.id,
        leadId: lead?.id,
        contactId: session.contactId,
        contactName: session.contactName,
        contactPhone: session.contactPhone,
        channel: session.channel,
        agentId: session.agentId,
        connectionId: (data as any).whatsappConnections?.[0]?.id,
        lastContactAt: session.lastMessageAt,
        nextFollowUpAt: nowIso(),
        followUpCount: 0,
        stage: session.leadStage || "novo",
        createdAt: nowIso(),
      };
      fu.entries.push(entry);
    }
  }

  data.__followUp = fu;
  data.__agentRuntime = rt;
  await saveData(data);
}
