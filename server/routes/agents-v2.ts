import { Express } from "express";
import { AuthedRequest, requireAuth } from "../middleware";
import {
  getSessions, getSession, getLeads, getExecutionLogs,
  updateSession, createAction, updateAction, createLead, updateLead,
} from "../modules/agent-runtime";
import { executeAction, getActionHandlers } from "../modules/agent-actions";
import { processIncomingMessage } from "../modules/agent-router";
import { loadData } from "../data";
import { saveData } from "../data";
import { pauseAi, resumeAi } from "../modules/agent-control";
import { nowIso } from "../helpers";

function runtimeOf(data: any) {
  const raw = data.__agentRuntime || {};
  return {
    sessions: Array.isArray(raw.sessions) ? raw.sessions : [],
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    executionLogs: Array.isArray(raw.executionLogs) ? raw.executionLogs : [],
    leads: Array.isArray(raw.leads) ? raw.leads : [],
  };
}

export function registerAgentRoutes(app: Express) {
  // === AGENT RUNTIME API ===

  // Sessions
  app.get("/api/v2/agents/sessions", requireAuth, async (_req, res) => {
    const sessions = await getSessions();
    res.json({ sessions });
  });

  app.get("/api/v2/agents/sessions/:id", requireAuth, async (req, res) => {
    const session = await getSession(req.params.id);
    if (!session) return res.status(404).json({ error: "Sessao nao encontrada" });
    res.json({ session });
  });

  app.patch("/api/v2/agents/sessions/:id", requireAuth, async (req, res) => {
    const session = await updateSession(req.params.id, req.body);
    if (!session) return res.status(404).json({ error: "Sessao nao encontrada" });
    res.json({ session });
  });

  // Actions
  app.get("/api/v2/agents/actions", requireAuth, async (_req, res) => {
    const data = await loadData(req.user?.tenantId);
    const rt = runtimeOf(data);
    res.json({ actions: rt.actions });
  });

  app.get("/api/v2/agents/actions/types", requireAuth, async (_req, res) => {
    const types = getActionHandlers();
    res.json({ types });
  });

  // Human handoff / AI pause controls
  app.get("/api/v2/agents/conversation-controls", requireAuth, async (_req, res) => {
    const data = await loadData(req.user?.tenantId);
    res.json({ controls: data.agentConversationControls || [] });
  });

  app.post("/api/v2/agents/conversation-controls/:contactId/pause", requireAuth, async (req: AuthedRequest, res) => {
    const control = await pauseAi({
      contactId: req.params.contactId,
      connectionId: req.body?.connectionId,
      contactPhone: req.body?.contactPhone || req.params.contactId,
      channel: "whatsapp",
      reason: req.body?.reason || "pausa_manual",
      pausedBy: req.user?.name || "usuario",
      resumeAt: req.body?.resumeAt,
    });
    res.json({ control });
  });

  app.post("/api/v2/agents/conversation-controls/:contactId/resume", requireAuth, async (req: AuthedRequest, res) => {
    const control = await resumeAi(req.params.contactId, req.body?.connectionId, req.user?.name || "usuario");
    if (!control) return res.status(404).json({ error: "Controle de conversa nao encontrado" });
    res.json({ control });
  });

  app.post("/api/v2/agents/actions", requireAuth, async (req: AuthedRequest, res) => {
    const { sessionId, agentId, type, input } = req.body || {};
    if (!sessionId || !agentId || !type) {
      return res.status(400).json({ error: "sessionId, agentId e type sao obrigatorios" });
    }
    const action = await createAction(sessionId, agentId, type, input || {});
    const session = await getSession(sessionId);
    if (!session) return res.status(404).json({ error: "Sessao nao encontrada" });

    await updateAction(action.id, { status: "executing" });
    const result = await executeAction(session, type, input || {});
    await updateAction(action.id, {
      status: result.success ? "completed" : "failed",
      output: result.output,
      completedAt: new Date().toISOString(),
    });

    res.json({ action, result });
  });

  // Leads
  app.get("/api/v2/agents/leads", requireAuth, async (req, res) => {
    const stage = req.query.stage as string | undefined;
    const agentId = req.query.agentId as string | undefined;
    let leads = await getLeads();
    if (stage) leads = leads.filter(l => l.stage === stage);
    if (agentId) leads = leads.filter(l => l.assignedAgentId === agentId);
    res.json({ leads });
  });

  app.get("/api/v2/agents/leads/:id", requireAuth, async (req, res) => {
    const data = await loadData(req.user?.tenantId);
    const rt = runtimeOf(data);
    const lead = rt.leads.find((l: any) => l.id === req.params.id);
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado" });
    res.json({ lead });
  });

  app.post("/api/v2/agents/leads", requireAuth, async (req, res) => {
    const { sessionId, name, phone, need, urgency, source, agentId } = req.body || {};
    if (!sessionId || !name || !phone) {
      return res.status(400).json({ error: "sessionId, name e phone sao obrigatorios" });
    }
    const lead = await createLead(sessionId, name, phone, need || "", urgency || "baixa", source || "api", agentId || "");
    res.json({ lead });
  });

  app.patch("/api/v2/agents/leads/:id", requireAuth, async (req, res) => {
    const lead = await updateLead(req.params.id, req.body);
    if (!lead) return res.status(404).json({ error: "Lead nao encontrado" });
    res.json({ lead });
  });

  // Execution logs
  app.get("/api/v2/agents/logs", requireAuth, async (req, res) => {
    const agentId = req.query.agentId as string | undefined;
    const limit = Number(req.query.limit) || 100;
    const logs = await getExecutionLogs(agentId, limit);
    res.json({ logs });
  });

  // Procedure catalog used by procedure/beauty/aesthetics agents
  app.get("/api/v2/agents/procedures", requireAuth, async (_req, res) => {
    const data = await loadData(req.user?.tenantId);
    res.json({ procedures: data.procedureCatalog || [] });
  });

  app.post("/api/v2/agents/procedures", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const body = req.body || {};
    const name = String(body.name || "").trim();
    if (!name) return res.status(400).json({ error: "Nome do procedimento e obrigatorio" });
    const now = nowIso();
    const item = {
      id: `proc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name,
      aliases: Array.isArray(body.aliases) ? body.aliases.map(String) : [],
      category: String(body.category || "Geral"),
      specialty: String(body.specialty || "Geral"),
      doctorId: body.doctorId ? String(body.doctorId) : undefined,
      doctorName: body.doctorName ? String(body.doctorName) : undefined,
      description: String(body.description || ""),
      mediaUrl: body.mediaUrl ? String(body.mediaUrl) : undefined,
      mediaType: body.mediaType || undefined,
      mediaCaption: body.mediaCaption ? String(body.mediaCaption) : undefined,
      price: body.price !== undefined ? Number(body.price) : undefined,
      requiresEvaluation: body.requiresEvaluation !== false,
      isActive: body.isActive !== false,
      createdAt: now,
      updatedAt: now,
    };
    data.procedureCatalog = data.procedureCatalog || [];
    data.procedureCatalog.push(item as any);
    await saveData(data);
    res.json({ procedure: item });
  });

  app.patch("/api/v2/agents/procedures/:id", requireAuth, async (req, res) => {
    const data = await loadData(req.user?.tenantId);
    const procedures = data.procedureCatalog || [];
    const idx = procedures.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Procedimento nao encontrado" });
    procedures[idx] = { ...procedures[idx], ...req.body, updatedAt: nowIso() };
    data.procedureCatalog = procedures;
    await saveData(data);
    res.json({ procedure: procedures[idx] });
  });

  // Metrics
  app.get("/api/v2/agents/metrics", requireAuth, async (_req, res) => {
    const data = await loadData(req.user?.tenantId);
    const rt = runtimeOf(data);
    const agents = data.serviceAgents.filter(a => a.status === "active");

    const metrics = agents.map(agent => {
      const agentSessions = rt.sessions.filter((s: any) => s.agentId === agent.id);
      const agentActions = rt.actions.filter((a: any) => a.agentId === agent.id);
      const agentLogs = rt.executionLogs.filter((l: any) => l.agentId === agent.id);
      const agentLeads = rt.leads.filter((l: any) => l.assignedAgentId === agent.id);
      const completedActions = agentActions.filter((a: any) => a.status === "completed");
      const successfulLogs = agentLogs.filter((l: any) => l.success);

      const now = Date.now();
      const responseTimes = agentLogs.map((l: any) => l.latencyMs).filter(Boolean);
      const avgResponseTime = responseTimes.length > 0
        ? responseTimes.reduce((a: number, b: number) => a + b, 0) / responseTimes.length
        : 0;

      return {
        agentId: agent.id,
        agentName: agent.name,
        totalSessions: agentSessions.length,
        activeSessions: agentSessions.filter((s: any) => s.status === "active").length,
        resolvedSessions: agentSessions.filter((s: any) => s.status === "resolved").length,
        escalatedSessions: agentSessions.filter((s: any) => s.status === "waiting_human").length,
        avgResponseTime,
        messagesProcessed: agentSessions.reduce((sum: number, s: any) => sum + (s.messageCount || 0), 0),
        actionsExecuted: agentActions.length,
        successRate: agentActions.length > 0 ? (completedActions.length / agentActions.length) * 100 : 0,
        leadsCreated: agentLeads.length,
        appointmentsBooked: agentLeads.filter((l: any) => l.stage === "agendado" || l.stage === "convertido").length,
        periodStart: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
        periodEnd: new Date().toISOString(),
      };
    });

    res.json({ metrics });
  });

  // Incoming message router (for webhook integration)
  app.post("/api/v2/agents/incoming", requireAuth, async (req, res) => {
    const { text, from, senderName, channel } = req.body || {};
    if (!text || !from) {
      return res.status(400).json({ error: "text e from sao obrigatorios" });
    }

    const result = await processIncomingMessage({
      text, from,
      senderName: senderName || from,
      channel: channel || "whatsapp",
    });

    res.json(result);
  });

  // Pipeline summary (for dashboard)
  app.get("/api/v2/agents/pipeline", requireAuth, async (_req, res) => {
    const data = await loadData(req.user?.tenantId);
    const rt = runtimeOf(data);

    const stages = ["novo", "contatado", "qualificado", "agendando", "agendado", "convertido", "perdido"];
    const pipeline = stages.map(stage => ({
      stage,
      leads: rt.leads.filter((l: any) => l.stage === stage),
      count: rt.leads.filter((l: any) => l.stage === stage).length,
    }));

    const activeSessions = rt.sessions.filter((s: any) => s.status === "active");
    const escalatedSessions = rt.sessions.filter((s: any) => s.status === "waiting_human");

    res.json({
      pipeline,
      totalLeads: rt.leads.length,
      activeSessions: activeSessions.length,
      escalatedSessions: escalatedSessions.length,
      conversionRate: rt.leads.length > 0
        ? (rt.leads.filter((l: any) => l.stage === "convertido").length / rt.leads.length * 100).toFixed(1)
        : "0.0",
    });
  });
}
