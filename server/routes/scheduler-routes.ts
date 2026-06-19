import { Express } from "express";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { loadData } from "../data";
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

  app.get("/api/v2/followup/queue", requireAuth, async (_req, res) => {
    const data = await loadData();
    const fu = (data as any).__followUp || { entries: [] };
    res.json({ entries: fu.entries, count: fu.entries.length });
  });

  app.post("/api/v2/followup/unregister/:sessionId", requireAuth, async (req, res) => {
    const { unregisterFromFollowUp } = await import("../modules/followup");
    await unregisterFromFollowUp(req.params.sessionId);
    res.json({ ok: true });
  });
}
