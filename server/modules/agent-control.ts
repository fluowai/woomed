import { loadData, saveData } from "../data";
import { nowIso } from "../helpers";
import type { AgentConversationControl, ChannelType } from "../../src/types";

function normalizeContact(value: string): string {
  return String(value || "").trim();
}

function controlId(contactId: string, connectionId?: string): string {
  return `ctrl-${connectionId || "default"}-${normalizeContact(contactId).replace(/[^a-zA-Z0-9@._-]/g, "")}`;
}

function getControls(data: any): AgentConversationControl[] {
  if (!Array.isArray(data.agentConversationControls)) data.agentConversationControls = [];
  return data.agentConversationControls;
}

export async function getConversationControl(contactId: string, connectionId?: string): Promise<AgentConversationControl | null> {
  const data = await loadData();
  const normalized = normalizeContact(contactId);
  return getControls(data).find(c => c.contactId === normalized && (!connectionId || c.connectionId === connectionId)) || null;
}

export async function ensureConversationControl(params: {
  contactId: string;
  contactPhone?: string;
  channel?: ChannelType;
  connectionId?: string;
}): Promise<AgentConversationControl> {
  const data = await loadData();
  const controls = getControls(data);
  const contactId = normalizeContact(params.contactId);
  let control = controls.find(c => c.contactId === contactId && c.connectionId === params.connectionId);
  const now = nowIso();

  if (!control) {
    control = {
      id: controlId(contactId, params.connectionId),
      contactId,
      contactPhone: params.contactPhone || contactId,
      channel: params.channel || "whatsapp",
      connectionId: params.connectionId,
      aiService: "active",
      createdAt: now,
      updatedAt: now,
    };
    controls.push(control);
  } else {
    control.contactPhone = params.contactPhone || control.contactPhone;
    control.channel = params.channel || control.channel;
    control.updatedAt = now;
  }

  data.agentConversationControls = controls;
  await saveData(data);
  return control;
}

export async function isAiPaused(contactId: string, connectionId?: string): Promise<boolean> {
  const control = await getConversationControl(contactId, connectionId);
  if (!control) return false;
  if (control.aiService !== "paused") return false;
  if (control.resumeAt && new Date(control.resumeAt) <= new Date()) {
    await resumeAi(contactId, connectionId, "auto_resume");
    return false;
  }
  return true;
}

export async function pauseAi(params: {
  contactId: string;
  contactPhone?: string;
  channel?: ChannelType;
  connectionId?: string;
  reason?: string;
  pausedBy?: string;
  resumeAt?: string;
}): Promise<AgentConversationControl> {
  const data = await loadData();
  const controls = getControls(data);
  const contactId = normalizeContact(params.contactId);
  let control = controls.find(c => c.contactId === contactId && c.connectionId === params.connectionId);
  const now = nowIso();

  if (!control) {
    control = {
      id: controlId(contactId, params.connectionId),
      contactId,
      contactPhone: params.contactPhone || contactId,
      channel: params.channel || "whatsapp",
      connectionId: params.connectionId,
      aiService: "paused",
      createdAt: now,
      updatedAt: now,
    };
    controls.push(control);
  }

  control.aiService = "paused";
  control.pausedReason = params.reason || "human_handoff";
  control.pausedBy = params.pausedBy || "system";
  control.pausedAt = now;
  control.resumeAt = params.resumeAt;
  control.lastHumanMessageAt = now;
  control.updatedAt = now;

  data.agentConversationControls = controls;
  await saveData(data);
  return control;
}

export async function resumeAi(contactId: string, connectionId?: string, resumedBy = "system"): Promise<AgentConversationControl | null> {
  const data = await loadData();
  const controls = getControls(data);
  const control = controls.find(c => c.contactId === normalizeContact(contactId) && (!connectionId || c.connectionId === connectionId));
  if (!control) return null;
  control.aiService = "active";
  control.pausedReason = undefined;
  control.resumeAt = undefined;
  control.updatedAt = nowIso();
  control.pausedBy = resumedBy;
  data.agentConversationControls = controls;
  await saveData(data);
  return control;
}

export async function markAiMessage(contactId: string, connectionId?: string): Promise<void> {
  const control = await ensureConversationControl({ contactId, connectionId, channel: "whatsapp" });
  control.lastAiMessageAt = nowIso();
  const data = await loadData();
  const controls = getControls(data);
  const idx = controls.findIndex(c => c.id === control.id);
  if (idx >= 0) controls[idx] = control;
  data.agentConversationControls = controls;
  await saveData(data);
}
