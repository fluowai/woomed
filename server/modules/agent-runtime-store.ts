import path from "path";
import fs from "fs/promises";

const RUNTIME_FILE = path.join(process.cwd(), "data", "agent-runtime.json");

interface RuntimeData {
  sessions: any[];
  actions: any[];
  executionLogs: any[];
  leads: any[];
}

let cached: RuntimeData | null = null;

async function ensureDir() {
  await fs.mkdir(path.dirname(RUNTIME_FILE), { recursive: true });
}

async function read(): Promise<RuntimeData> {
  if (cached) return cached;
  try {
    const raw = await fs.readFile(RUNTIME_FILE, "utf-8");
    cached = JSON.parse(raw);
    return cached!;
  } catch {
    cached = { sessions: [], actions: [], executionLogs: [], leads: [] };
    return cached;
  }
}

async function write(data: RuntimeData): Promise<void> {
  cached = data;
  await ensureDir();
  await fs.writeFile(RUNTIME_FILE, JSON.stringify(data), "utf-8");
}

export async function getSessions(): Promise<any[]> {
  const rt = await read();
  return rt.sessions;
}

export async function getLeads(): Promise<any[]> {
  const rt = await read();
  return rt.leads;
}

export async function getExecutionLogs(agentId?: string, limit = 100): Promise<any[]> {
  const rt = await read();
  let logs = rt.executionLogs;
  if (agentId) logs = logs.filter((l: any) => l.agentId === agentId);
  return logs.slice(-limit).reverse();
}

export async function getSession(sessionId: string): Promise<any | null> {
  const rt = await read();
  return rt.sessions.find((s: any) => s.id === sessionId) || null;
}

export async function addSession(session: any): Promise<void> {
  const rt = await read();
  rt.sessions.push(session);
  await write(rt);
}

export async function updateSession(sessionId: string, updates: any): Promise<any | null> {
  const rt = await read();
  const idx = rt.sessions.findIndex((s: any) => s.id === sessionId);
  if (idx === -1) return null;
  rt.sessions[idx] = { ...rt.sessions[idx], ...updates, updatedAt: new Date().toISOString() };
  await write(rt);
  return rt.sessions[idx];
}

export async function addAction(action: any): Promise<void> {
  const rt = await read();
  rt.actions.push(action);
  await write(rt);
}

export async function updateAction(actionId: string, updates: any): Promise<any | null> {
  const rt = await read();
  const idx = rt.actions.findIndex((a: any) => a.id === actionId);
  if (idx === -1) return null;
  rt.actions[idx] = { ...rt.actions[idx], ...updates };
  await write(rt);
  return rt.actions[idx];
}

export async function addLog(log: any): Promise<void> {
  const rt = await read();
  rt.executionLogs.push(log);
  await write(rt);
}

export async function addLead(lead: any): Promise<void> {
  const rt = await read();
  rt.leads.push(lead);
  await write(rt);
}

export async function updateLead(leadId: string, updates: any): Promise<any | null> {
  const rt = await read();
  const idx = rt.leads.findIndex((l: any) => l.id === leadId);
  if (idx === -1) return null;
  rt.leads[idx] = { ...rt.leads[idx], ...updates };
  await write(rt);
  return rt.leads[idx];
}

export async function removeExpiredSessions(maxAgeMs: number): Promise<number> {
  const rt = await read();
  const now = Date.now();
  const before = rt.sessions.length;
  rt.sessions = rt.sessions.filter((s: any) => {
    if (s.status !== "active") return true;
    const elapsed = now - new Date(s.lastMessageAt).getTime();
    return elapsed < maxAgeMs;
  });
  if (rt.sessions.length !== before) await write(rt);
  return before - rt.sessions.length;
}

export function clearCache() {
  cached = null;
}
