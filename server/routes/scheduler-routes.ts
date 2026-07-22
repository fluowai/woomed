import { Express } from "express";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { loadData, saveData } from "../data";
import {
  getSchedulerStatus, generateAndScheduleReminders, scheduleReminder, startScheduler, stopScheduler
} from "../modules/scheduler";
import {
  checkFollowUps, findAbandonedSessions, registerForFollowUp
} from "../modules/followup";

export function registerSchedulerRoutes(app: Express) {
  app.get("/api/v2/scheduler/status", requireAuth, async (_req, res) => {
    const status = await getSchedulerStatus();
    res.json(status);
  });

  app.post("/api/v2/scheduler/tick", requireAuth, requireRoles("admin"), async (_req, res) => {
    const { generateAndScheduleReminders } = await import("../modules/scheduler");
    await generateAndScheduleReminders();
    const { findAbandonedSessions, checkFollowUps } = await import("../modules/followup");
    await findAbandonedSessions();
    await checkFollowUps();
    res.json({ ok: true, message: "Tick executado manualmente" });
  });

  app.post("/api/v2/scheduler/restart", requireAuth, requireRoles("admin"), async (_req, res) => {
    stopScheduler();
    startScheduler();
    res.json({ ok: true, message: "Scheduler reiniciado" });
  });

  app.post("/api/v2/scheduler/reminders/generate", requireAuth, requireRoles("admin"), async (_req, res) => {
    await generateAndScheduleReminders();
    res.json({ ok: true, message: "Lembretes gerados a partir dos templates" });
  });

  app.post("/api/v2/scheduler/reminders", requireAuth, async (req: AuthedRequest, res) => {
    const { patientId, appointmentId, channel, destination, message, scheduledFor } = req.body || {};
    if (!patientId || !destination || !message || !scheduledFor) {
      return res.status(400).json({ error: "patientId, destination, message e scheduledFor sao obrigatorios" });
    }
    const reminder = await scheduleReminder({
      patientId, appointmentId, channel: channel || "whatsapp",
      destination, message, scheduledFor,
    });
    res.json({ reminder });
  });

  app.post("/api/v2/followup/check", requireAuth, requireRoles("admin"), async (_req, res) => {
    await findAbandonedSessions();
    await checkFollowUps();
    res.json({ ok: true, message: "Follow-up check executado" });
  });

  app.get("/api/v2/followup/queue", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const fu = (data as any).__followUp || { entries: [] };
    const rt = (data as any).__agentRuntime || { sessions: [], leads: [] };
    const enriched = fu.entries.map((e: any) => {
      const session = rt.sessions.find((s: any) => s.id === e.sessionId);
      const lead = rt.leads.find((l: any) => l.sessionId === e.sessionId);
      return { ...e, session, lead };
    });
    res.json({ entries: enriched, count: enriched.length });
  });

  app.post("/api/v2/followup/unregister/:sessionId", requireAuth, async (req, res) => {
    const { unregisterFromFollowUp } = await import("../modules/followup");
    await unregisterFromFollowUp(req.params.sessionId);
    res.json({ ok: true });
  });

  app.post("/api/v2/followup/register", requireAuth, async (req: AuthedRequest, res) => {
    const { registerForFollowUp } = await import("../modules/followup");
    const data = await loadData(req.user?.tenantId);
    const { sessionId } = req.body || {};
    if (!sessionId) return res.status(400).json({ error: "sessionId obrigatorio" });
    const rt = (data as any).__agentRuntime || { sessions: [] };
    const session = rt.sessions.find((s: any) => s.id === sessionId);
    if (!session) return res.status(404).json({ error: "Sessao nao encontrada" });
    await registerForFollowUp(session);
    res.json({ ok: true, message: "Follow-up registrado manualmente" });
  });

  app.post("/api/v2/followup/process-now", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    await findAbandonedSessions();
    await checkFollowUps();
    const data = await loadData(req.user?.tenantId);
    const fu = (data as any).__followUp || { entries: [] };
    res.json({ ok: true, entriesProcessed: fu.entries.length, message: "Follow-ups processados" });
  });

  app.patch("/api/v2/followup/entry/:sessionId", requireAuth, async (req, res) => {
    const data = await loadData(req.user?.tenantId);
    const fu = (data as any).__followUp || { entries: [] };
    const idx = fu.entries.findIndex((e: any) => e.sessionId === req.params.sessionId);
    if (idx === -1) return res.status(404).json({ error: "Entry not found" });
    const allowed = ["nextFollowUpAt", "followUpCount", "stage"];
    for (const field of allowed) {
      if (req.body[field] !== undefined) fu.entries[idx][field] = req.body[field];
    }
    (data as any).__followUp = fu;
    await saveData(data);
    res.json({ entry: fu.entries[idx] });
  });
}
