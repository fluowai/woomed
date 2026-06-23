import { loadData, saveData, AppData } from "../data";
import { GEMINI_API_KEY, HAS_GEMINI_KEY } from "../config";
import type {
  ServiceAgent, ServiceAgent as AgentConfig,
  Patient, Appointment, Doctor
} from "../../src/types";
import type {
  AgentSession, AgentAction, AgentExecutionLog, AgentLead,
  AgentActionType, LeadStage, UrgencyLevel, AgentSessionStatus
} from "../../src/agent-types";
import { registerForFollowUp, unregisterFromFollowUp } from "./followup";

const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

interface RuntimeData {
  sessions: AgentSession[];
  actions: AgentAction[];
  executionLogs: AgentExecutionLog[];
  leads: AgentLead[];
}

function getRuntime(data: AppData): RuntimeData {
  const raw = (data as any).__agentRuntime || {};
  return {
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    executionLogs: Array.isArray(raw.executionLogs) ? raw.executionLogs : [],
    leads: Array.isArray(raw.leads) ? raw.leads : [],
  };
}

function setRuntime(data: AppData, rt: RuntimeData) {
  (data as any).__agentRuntime = rt;
}

export async function getSessions(): Promise<AgentSession[]> {
  const data = await loadData();
  return getRuntime(data).sessions;
}

export async function getSession(sessionId: string): Promise<AgentSession | null> {
  const data = await loadData();
  return getRuntime(data).sessions.find(s => s.id === sessionId) || null;
}

export async function getLeads(): Promise<AgentLead[]> {
  const data = await loadData();
  return getRuntime(data).leads;
}

export async function getExecutionLogs(agentId?: string, limit = 100): Promise<AgentExecutionLog[]> {
  const data = await loadData();
  let logs = getRuntime(data).executionLogs;
  if (agentId) logs = logs.filter(l => l.agentId === agentId);
  return logs.slice(-limit).reverse();
}

function nextId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

async function persist() {
  const data = await loadData();
  await saveData(data);
}

export function matchAgent(message: string, channel: string, agents: AgentConfig[]): AgentConfig | null {
  const msg = message.toLowerCase();

  const ranked = agents
    .filter(a => a.status === "active")
    .map(a => {
      let score = 0;
      if (a.channel === channel) score += 3;
      const keywords = a.objective.toLowerCase().split(/\s+/);
      for (const kw of keywords) {
        if (kw.length > 3 && msg.includes(kw)) score += 1;
      }
      for (const kb of a.knowledgeBase) {
        if (msg.includes(kb.toLowerCase())) score += 2;
      }
      if (a.rules.some(r => msg.includes(r.toLowerCase().slice(0, 20)))) score += 1;
      return { agent: a, score };
    })
    .sort((a, b) => b.score - a.score);

  return ranked.length > 0 && ranked[0].score > 0 ? ranked[0].agent : null;
}

export async function findOrCreateSession(
  contactId: string, contactName: string, contactPhone: string,
  channel: string, agentId: string, agentName: string
): Promise<AgentSession> {
  const data = await loadData();
  const rt = getRuntime(data);
  const now = new Date().toISOString();

  let session = rt.sessions.find(
    s => s.contactId === contactId && s.agentId === agentId && s.status === "active"
  );

  if (session) {
    session.lastMessageAt = now;
    session.messageCount++;
    await saveData(data);
    return session;
  }

  session = {
    id: nextId("sess"),
    agentId, agentName, contactId, contactName, contactPhone,
    channel, status: "active", leadStage: "novo", urgency: "baixa",
    context: {}, messageCount: 1, lastMessageAt: now,
    createdAt: now, updatedAt: now,
  };
  rt.sessions.push(session);
  await saveData(data);
  registerForFollowUp(session).catch(() => {});
  return session;
}

export async function updateSession(sessionId: string, updates: Partial<AgentSession>): Promise<AgentSession | null> {
  const data = await loadData();
  const rt = getRuntime(data);
  const session = rt.sessions.find(s => s.id === sessionId);
  if (!session) return null;
  const oldStatus = session.status;
  Object.assign(session, updates, { updatedAt: new Date().toISOString() });
  await saveData(data);
  if (updates.status && updates.status !== oldStatus && (updates.status === "resolved" || updates.status === "expired")) {
    unregisterFromFollowUp(sessionId).catch(() => {});
  }
  return session;
}

export async function createAction(sessionId: string, agentId: string, type: AgentActionType, input: Record<string, unknown>): Promise<AgentAction> {
  const data = await loadData();
  const rt = getRuntime(data);
  const action: AgentAction = {
    id: nextId("act"),
    sessionId, agentId, type,
    status: "pending", input,
    createdAt: new Date().toISOString(),
  };
  rt.actions.push(action);
  await saveData(data);
  return action;
}

export async function updateAction(actionId: string, updates: Partial<AgentAction>): Promise<AgentAction | null> {
  const data = await loadData();
  const rt = getRuntime(data);
  const action = rt.actions.find(a => a.id === actionId);
  if (!action) return null;
  Object.assign(action, updates);
  if (updates.status === "completed" || updates.status === "failed") action.completedAt = new Date().toISOString();
  await saveData(data);
  return action;
}

export async function logExecution(
  sessionId: string, agentId: string, action: AgentActionType,
  prompt: string, response: string, success: boolean, latencyMs: number, error?: string
): Promise<void> {
  const data = await loadData();
  const rt = getRuntime(data);
  const log: AgentExecutionLog = {
    id: nextId("log"),
    sessionId, agentId, action, prompt, response,
    modelUsed: "gemini-2.0-flash",
    tokensUsed: 0, latencyMs, success, error,
    createdAt: new Date().toISOString(),
  };
  rt.executionLogs.push(log);
  await saveData(data);
}

export async function createLead(sessionId: string, name: string, phone: string, need: string, urgency: UrgencyLevel, source: string, agentId: string): Promise<AgentLead> {
  const data = await loadData();
  const rt = getRuntime(data);
  const now = new Date().toISOString();
  const lead: AgentLead = {
    id: nextId("lead"),
    sessionId, name, phone, need, urgency,
    stage: "novo", source, notes: "",
    assignedAgentId: agentId,
    firstContactAt: now, lastContactAt: now,
    createdAt: now,
  };
  rt.leads.push(lead);
  await saveData(data);
  return lead;
}

export async function updateLead(leadId: string, updates: Partial<AgentLead>): Promise<AgentLead | null> {
  const data = await loadData();
  const rt = getRuntime(data);
  const lead = rt.leads.find(l => l.id === leadId);
  if (!lead) return null;
  Object.assign(lead, updates, { lastContactAt: new Date().toISOString() });
  if (updates.stage === "convertido" && !lead.convertedAt) lead.convertedAt = new Date().toISOString();
  await saveData(data);
  return lead;
}

function filterExpiredSessions(rt: RuntimeData): RuntimeData {
  const now = Date.now();
  rt.sessions = rt.sessions.filter(s => {
    if (s.status !== "active") return true;
    const elapsed = now - new Date(s.lastMessageAt).getTime();
    return elapsed < SESSION_TIMEOUT_MS;
  });
  return rt;
}
