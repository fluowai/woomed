import { randomUUID } from "crypto";
import { Express } from "express";
import { z } from "zod";
import { loadData, saveData } from "../data";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { audit, nowIso } from "../helpers";
import { featureGuard } from "../plan-guard";
import {
  NpsSurvey, NpsResponse, NpsMetrics,
  LgpdConsentTemplate, LgpdPatientConsent, LgpdDataSubjectRequest, LgpdSensitiveAccessLog,
  AutomationTemplate, AutomationReminder,
  PatientPortalLogin, PatientPortalToken, PatientSatisfactionRating,
  ProfessionalUnit, ProfessionalRoom
} from "../../src/types";

const npsSurveySchema = z.object({
  name: z.string().min(2),
  question: z.string().default("De 0 a 10, o quanto voce recomendaria nossa clinica para um amigo ou familiar?"),
  sendAfterHours: z.number().default(24),
  isActive: z.boolean().default(true)
});

const consentTemplateSchema = z.object({
  type: z.enum(["tratamento_dados","comunicacao_whatsapp","comunicacao_email","comunicacao_sms","pesquisa_satisfacao","termo_servico","politica_privacidade"]),
  title: z.string().min(2),
  description: z.string().min(5),
  isRequired: z.boolean().default(true),
  isActive: z.boolean().default(true)
});

const dsarSchema = z.object({
  patientId: z.string().min(1),
  type: z.enum(["export","rectification","anonymization","deletion","access"]),
  description: z.string().optional(),
  requestData: z.record(z.string(), z.unknown()).default({})
});

const sensitiveLogSchema = z.object({
  patientId: z.string().min(1),
  accessType: z.enum(["view","edit","export"]),
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  reason: z.string().default("")
});

const automationTemplateSchema = z.object({
  name: z.string().min(2),
  channel: z.enum(["whatsapp","sms","email"]).default("whatsapp"),
  triggerEvent: z.enum(["appointment_confirmed","appointment_reminder","post_appointment","birthday","no_show","custom"]),
  delayMinutes: z.number().default(0),
  messageTemplate: z.string().min(1),
  variables: z.array(z.string()).default([]),
  isActive: z.boolean().default(true)
});

const reminderSchema = z.object({
  templateId: z.string().optional(),
  appointmentId: z.string().optional(),
  patientId: z.string().min(1),
  channel: z.enum(["whatsapp","sms","email"]).default("whatsapp"),
  destination: z.string().min(1),
  message: z.string().min(1),
  scheduledFor: z.string().min(1)
});

const unitSchema = z.object({
  name: z.string().min(2),
  address: z.record(z.string(), z.unknown()).default({}),
  phone: z.string().optional(),
  isActive: z.boolean().default(true)
});

const roomSchema = z.object({
  unitId: z.string().min(1),
  name: z.string().min(2),
  isActive: z.boolean().default(true)
});

export function registerModules360Routes(app: Express) {
  app.use("/api/v2/nps", requireAuth, featureGuard("nps_lgpd"));
  app.use("/api/v2/lgpd", requireAuth, featureGuard("nps_lgpd"));
  app.use("/api/v2/automation", requireAuth, featureGuard("automacao"));

  // ============================================================
  // NPS / SATISFAÇÃO
  // ============================================================
  app.get("/api/v2/nps/surveys", requireAuth, async (_req: AuthedRequest, res) => {
    const data = await loadData();
    res.json(data.npsSurveys || []);
  });

  app.post("/api/v2/nps/surveys", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = npsSurveySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const survey: NpsSurvey = {
      id: randomUUID(),
      name: parsed.data.name,
      question: parsed.data.question,
      sendAfterHours: parsed.data.sendAfterHours,
      isActive: parsed.data.isActive,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData();
    if (!data.npsSurveys) data.npsSurveys = [];
    data.npsSurveys.push(survey);
    await saveData(data);
    res.json({ survey });
  });

  app.patch("/api/v2/nps/surveys/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const surveys = data.npsSurveys || [];
    const idx = surveys.findIndex((s: any) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Pesquisa NPS nao encontrada." });
    surveys[idx] = { ...surveys[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ survey: surveys[idx] });
  });

  app.delete("/api/v2/nps/surveys/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const surveys = data.npsSurveys || [];
    const idx = surveys.findIndex((s: any) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Pesquisa NPS nao encontrada." });
    surveys.splice(idx, 1);
    await saveData(data);
    res.json({ ok: true });
  });

  app.get("/api/v2/nps/responses", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    let responses = [...(data.npsResponses || [])];
    const { surveyId, patientId, startDate, endDate } = req.query as Record<string, string>;
    if (surveyId) responses = responses.filter(r => r.surveyId === surveyId);
    if (patientId) responses = responses.filter(r => r.patientId === patientId);
    if (startDate) responses = responses.filter(r => new Date(r.respondedAt) >= new Date(startDate));
    if (endDate) responses = responses.filter(r => new Date(r.respondedAt) <= new Date(endDate));
    responses.sort((a, b) => new Date(b.respondedAt).getTime() - new Date(a.respondedAt).getTime());
    res.json(responses);
  });

  app.post("/api/v2/nps/responses", requireAuth, async (req: AuthedRequest, res) => {
    const { surveyId, patientId, appointmentId, score, comment } = req.body || {};
    if (!surveyId || !patientId || score === undefined) return res.status(400).json({ error: "surveyId, patientId e score obrigatorios." });
    if (score < 0 || score > 10) return res.status(400).json({ error: "Score deve ser entre 0 e 10." });
    const category = score >= 9 ? "promotor" : score >= 7 ? "neutro" : "detrator";
    const response: NpsResponse = {
      id: randomUUID(),
      surveyId, patientId, appointmentId,
      score, category, comment,
      respondedAt: nowIso(),
      createdAt: nowIso()
    };
    const data = await loadData();
    if (!data.npsResponses) data.npsResponses = [];
    data.npsResponses.push(response);
    await saveData(data);
    res.json({ response });
  });

  app.get("/api/v2/nps/metrics", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const responses = data.npsResponses || [];
    const { startDate, endDate } = req.query as Record<string, string>;
    let filtered = [...responses];
    if (startDate) filtered = filtered.filter(r => new Date(r.respondedAt) >= new Date(startDate as string));
    if (endDate) filtered = filtered.filter(r => new Date(r.respondedAt) <= new Date(endDate as string));
    const total = filtered.length;
    const promoters = filtered.filter((r: any) => r.category === "promotor").length;
    const detractors = filtered.filter((r: any) => r.category === "detrator").length;
    const neutrals = filtered.filter((r: any) => r.category === "neutro").length;
    const npsScore = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;
    const responsesByScore: Record<number, number> = {};
    for (let i = 0; i <= 10; i++) responsesByScore[i] = 0;
    filtered.forEach((r: any) => { responsesByScore[r.score] = (responsesByScore[r.score] || 0) + 1; });
    const metrics: NpsMetrics = {
      totalResponses: total,
      npsScore,
      promoters,
      promotersPercent: total > 0 ? Math.round((promoters / total) * 100) : 0,
      neutrals,
      neutralsPercent: total > 0 ? Math.round((neutrals / total) * 100) : 0,
      detractors,
      detractorsPercent: total > 0 ? Math.round((detractors / total) * 100) : 0,
      responsesByScore,
      period: { start: startDate || "all", end: endDate || "all" }
    };
    res.json(metrics);
  });

  // ============================================================
  // LGPD
  // ============================================================
  app.get("/api/v2/lgpd/consent-templates", requireAuth, async (_req: AuthedRequest, res) => {
    const data = await loadData();
    res.json(data.lgpdConsentTemplates || []);
  });

  app.post("/api/v2/lgpd/consent-templates", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = consentTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const data = await loadData();
    const templates = data.lgpdConsentTemplates || [];
    const currentVersion = templates.filter((t: any) => t.type === parsed.data.type).length + 1;
    const template: LgpdConsentTemplate = {
      id: randomUUID(),
      type: parsed.data.type,
      title: parsed.data.title,
      description: parsed.data.description,
      version: currentVersion,
      isRequired: parsed.data.isRequired,
      isActive: parsed.data.isActive,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    if (!data.lgpdConsentTemplates) data.lgpdConsentTemplates = [];
    data.lgpdConsentTemplates.push(template);
    await saveData(data);
    res.json({ template });
  });

  app.patch("/api/v2/lgpd/consent-templates/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const templates = data.lgpdConsentTemplates || [];
    const idx = templates.findIndex((t: any) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Template de consentimento nao encontrado." });
    templates[idx] = { ...templates[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ template: templates[idx] });
  });

  app.get("/api/v2/lgpd/patient-consents/:patientId", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const consents = (data.lgpdPatientConsents || []).filter((c: any) => c.patientId === req.params.patientId);
    res.json(consents);
  });

  app.post("/api/v2/lgpd/patient-consents/:patientId/:templateId/grant", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    if (!data.lgpdPatientConsents) data.lgpdPatientConsents = [];
    const existing = data.lgpdPatientConsents.findIndex(
      (c: any) => c.patientId === req.params.patientId && c.consentTemplateId === req.params.templateId && c.status === "granted"
    );
    if (existing >= 0) return res.status(400).json({ error: "Consentimento ja concedido." });
    const consent: LgpdPatientConsent = {
      id: randomUUID(),
      patientId: req.params.patientId,
      consentTemplateId: req.params.templateId,
      status: "granted",
      grantedAt: nowIso(),
      createdAt: nowIso()
    };
    data.lgpdPatientConsents.push(consent);
    await saveData(data);
    res.json({ consent });
  });

  app.post("/api/v2/lgpd/patient-consents/:patientId/:templateId/revoke", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const consents = data.lgpdPatientConsents || [];
    const idx = consents.findIndex((c: any) => c.patientId === req.params.patientId && c.consentTemplateId === req.params.templateId && c.status === "granted");
    if (idx === -1) return res.status(404).json({ error: "Consentimento ativo nao encontrado." });
    consents[idx].status = "revoked";
    consents[idx].revokedAt = nowIso();
    await saveData(data);
    res.json({ consent: consents[idx] });
  });

  app.post("/api/v2/lgpd/dsar", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = dsarSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const dsar: LgpdDataSubjectRequest = {
      id: randomUUID(),
      patientId: parsed.data.patientId,
      type: parsed.data.type,
      status: "pending",
      description: parsed.data.description,
      requestData: parsed.data.requestData,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData();
    if (!data.lgpdDataSubjectRequests) data.lgpdDataSubjectRequests = [];
    data.lgpdDataSubjectRequests.push(dsar);
    await audit(data, req.user!, "create_dsar", "lgpd", dsar.id, `Tipo: ${dsar.type}`);
    await saveData(data);
    res.json({ dsar });
  });

  app.get("/api/v2/lgpd/dsar", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    let requests = [...(data.lgpdDataSubjectRequests || [])];
    const { patientId, status } = req.query as Record<string, string>;
    if (patientId) requests = requests.filter(r => r.patientId === patientId);
    if (status) requests = requests.filter(r => r.status === status);
    requests.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(requests);
  });

  app.patch("/api/v2/lgpd/dsar/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const requests = data.lgpdDataSubjectRequests || [];
    const idx = requests.findIndex((r: any) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Solicitacao DSAR nao encontrada." });
    if (req.body.status === "completed") requests[idx].processedAt = nowIso();
    requests[idx] = { ...requests[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ dsar: requests[idx] });
  });

  app.get("/api/v2/lgpd/sensitive-logs", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    let logs = [...(data.lgpdSensitiveAccessLogs || [])];
    const { patientId } = req.query as Record<string, string>;
    if (patientId) logs = logs.filter(l => l.patientId === patientId);
    logs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(logs);
  });

  app.post("/api/v2/lgpd/sensitive-logs", requireAuth, async (req: AuthedRequest, res) => {
    const parsed = sensitiveLogSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const log: LgpdSensitiveAccessLog = {
      id: randomUUID(),
      patientId: parsed.data.patientId,
      actorId: req.user!.id,
      actorName: req.user!.name,
      accessType: parsed.data.accessType,
      entityType: parsed.data.entityType,
      entityId: parsed.data.entityId,
      reason: parsed.data.reason,
      ipAddress: req.ip,
      userAgent: req.headers["user-agent"],
      createdAt: nowIso()
    };
    const data = await loadData();
    if (!data.lgpdSensitiveAccessLogs) data.lgpdSensitiveAccessLogs = [];
    data.lgpdSensitiveAccessLogs.push(log);
    await saveData(data);
    res.json({ log });
  });

  // ============================================================
  // AUTOMAÇÃO / LEMBRETES
  // ============================================================
  app.get("/api/v2/automation/templates", requireAuth, async (_req: AuthedRequest, res) => {
    const data = await loadData();
    res.json(data.automationTemplates || []);
  });

  app.post("/api/v2/automation/templates", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = automationTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const template: AutomationTemplate = {
      id: randomUUID(),
      name: parsed.data.name,
      channel: parsed.data.channel,
      triggerEvent: parsed.data.triggerEvent,
      delayMinutes: parsed.data.delayMinutes,
      messageTemplate: parsed.data.messageTemplate,
      variables: parsed.data.variables,
      isActive: parsed.data.isActive,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData();
    if (!data.automationTemplates) data.automationTemplates = [];
    data.automationTemplates.push(template);
    await saveData(data);
    res.json({ template });
  });

  app.patch("/api/v2/automation/templates/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const templates = data.automationTemplates || [];
    const idx = templates.findIndex((t: any) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Template de automacao nao encontrado." });
    templates[idx] = { ...templates[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ template: templates[idx] });
  });

  app.delete("/api/v2/automation/templates/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const templates = data.automationTemplates || [];
    const idx = templates.findIndex((t: any) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Template nao encontrado." });
    templates.splice(idx, 1);
    await saveData(data);
    res.json({ ok: true });
  });

  app.get("/api/v2/automation/reminders", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    let reminders = [...(data.automationReminders || [])];
    const { status, appointmentId, patientId } = req.query as Record<string, string>;
    if (status) reminders = reminders.filter(r => r.status === status);
    if (appointmentId) reminders = reminders.filter(r => r.appointmentId === appointmentId);
    if (patientId) reminders = reminders.filter(r => r.patientId === patientId);
    reminders.sort((a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime());
    res.json(reminders);
  });

  app.post("/api/v2/automation/reminders", requireAuth, async (req: AuthedRequest, res) => {
    const parsed = reminderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const reminder: AutomationReminder = {
      id: randomUUID(),
      templateId: parsed.data.templateId,
      appointmentId: parsed.data.appointmentId,
      patientId: parsed.data.patientId,
      channel: parsed.data.channel,
      destination: parsed.data.destination,
      message: parsed.data.message,
      status: "pending",
      scheduledFor: parsed.data.scheduledFor,
      createdAt: nowIso()
    };
    const data = await loadData();
    if (!data.automationReminders) data.automationReminders = [];
    data.automationReminders.push(reminder);
    await saveData(data);
    res.json({ reminder });
  });

  app.post("/api/v2/automation/reminders/:id/cancel", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const reminders = data.automationReminders || [];
    const idx = reminders.findIndex((r: any) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Lembrete nao encontrado." });
    reminders[idx].status = "failed";
    reminders[idx].error = "Cancelado pelo usuario";
    await saveData(data);
    res.json({ reminder: reminders[idx] });
  });

  // ============================================================
  // PORTAL DO PACIENTE
  // ============================================================
  app.post("/api/v2/portal/login", async (req: AuthedRequest, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email e senha obrigatorios." });
    const data = await loadData();
    const portalUsers = data.patientPortalLogins || [];
    const found = portalUsers.find((u: any) => u.email === email && u.isActive);
    if (!found) return res.status(401).json({ error: "Credenciais invalidas." });
    const bcrypt = await import("bcryptjs");
    const valid = await bcrypt.compare(password, found.passwordHash);
    if (!valid) return res.status(401).json({ error: "Credenciais invalidas." });
    found.lastLoginAt = nowIso();
    await saveData(data);
    const token = randomUUID();
    if (!data.patientPortalTokens) data.patientPortalTokens = [];
    data.patientPortalTokens.push({
      id: randomUUID(), patientId: found.patientId, token,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: nowIso()
    });
    await saveData(data);
    res.json({ token, patientId: found.patientId });
  });

  app.post("/api/v2/portal/request-access", async (req: AuthedRequest, res) => {
    const { patientId, email } = req.body || {};
    if (!patientId || !email) return res.status(400).json({ error: "patientId e email obrigatorios." });
    const data = await loadData();
    const patient = data.patients.find(p => p.id === patientId);
    if (!patient) return res.status(404).json({ error: "Paciente nao encontrado." });
    const bcryptjs = await import("bcryptjs");
    const tempPassword = Math.random().toString(36).slice(-8);
    const passwordHash = await bcryptjs.hash(tempPassword, 10);
    const login: PatientPortalLogin = {
      id: randomUUID(),
      patientId,
      email,
      passwordHash,
      isActive: true,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    if (!data.patientPortalLogins) data.patientPortalLogins = [];
    const existingIdx = data.patientPortalLogins.findIndex((u: any) => u.email === email);
    if (existingIdx >= 0) data.patientPortalLogins[existingIdx] = { ...data.patientPortalLogins[existingIdx], ...login, updatedAt: nowIso() };
    else data.patientPortalLogins.push(login);
    await saveData(data);
    res.json({ message: "Acesso criado. Envie a senha temporaria para o paciente.", tempPassword });
  });

  app.get("/api/v2/portal/appointments", async (req: AuthedRequest, res) => {
    const token = req.headers["x-portal-token"] as string;
    if (!token) return res.status(401).json({ error: "Token de acesso obrigatorio." });
    const data = await loadData();
    const portalTokens = data.patientPortalTokens || [];
    const found = portalTokens.find((t: any) => t.token === token && new Date(t.expiresAt) > new Date());
    if (!found) return res.status(401).json({ error: "Token invalido ou expirado." });
    const patientAppointments = data.appointments.filter(a => {
      const p = data.patients.find(pt => pt.id === found.patientId);
      return p && a.patientName === p.fullName.toUpperCase();
    });
    res.json(patientAppointments);
  });

  app.get("/api/v2/portal/medical-records", async (req: AuthedRequest, res) => {
    const token = req.headers["x-portal-token"] as string;
    if (!token) return res.status(401).json({ error: "Token de acesso obrigatorio." });
    const data = await loadData();
    const portalTokens = data.patientPortalTokens || [];
    const found = portalTokens.find((t: any) => t.token === token && new Date(t.expiresAt) > new Date());
    if (!found) return res.status(401).json({ error: "Token invalido ou expirado." });
    const record = data.medicalRecords[found.patientId];
    res.json(record || { entries: [] });
  });

  app.post("/api/v2/portal/satisfaction", async (req: AuthedRequest, res) => {
    const token = req.headers["x-portal-token"] as string;
    if (!token) return res.status(401).json({ error: "Token de acesso obrigatorio." });
    const { appointmentId, rating, feedback } = req.body || {};
    if (!rating || rating < 1 || rating > 5) return res.status(400).json({ error: "Avaliacao deve ser entre 1 e 5." });
    const data = await loadData();
    const portalTokens = data.patientPortalTokens || [];
    const found = portalTokens.find((t: any) => t.token === token && new Date(t.expiresAt) > new Date());
    if (!found) return res.status(401).json({ error: "Token invalido ou expirado." });
    const satisfaction: PatientSatisfactionRating = {
      id: randomUUID(),
      patientId: found.patientId,
      appointmentId,
      rating, feedback,
      createdAt: nowIso()
    };
    if (!data.patientSatisfactionRatings) data.patientSatisfactionRatings = [];
    data.patientSatisfactionRatings.push(satisfaction);
    await saveData(data);
    res.json({ satisfaction });
  });

  // ============================================================
  // PROFISSIONAIS / UNIDADES / SALAS
  // ============================================================
  app.get("/api/v2/professional-units", requireAuth, async (_req: AuthedRequest, res) => {
    const data = await loadData();
    res.json(data.professionalUnits || []);
  });

  app.post("/api/v2/professional-units", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = unitSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const unit: ProfessionalUnit = {
      id: randomUUID(),
      name: parsed.data.name,
      address: parsed.data.address as any,
      phone: parsed.data.phone,
      isActive: parsed.data.isActive,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData();
    if (!data.professionalUnits) data.professionalUnits = [];
    data.professionalUnits.push(unit);
    await saveData(data);
    res.json({ unit });
  });

  app.patch("/api/v2/professional-units/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const units = data.professionalUnits || [];
    const idx = units.findIndex((u: any) => u.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Unidade nao encontrada." });
    units[idx] = { ...units[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ unit: units[idx] });
  });

  app.get("/api/v2/professional-rooms", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    let rooms = [...(data.professionalRooms || [])];
    const { unitId } = req.query as Record<string, string>;
    if (unitId) rooms = rooms.filter(r => r.unitId === unitId);
    res.json(rooms);
  });

  app.post("/api/v2/professional-rooms", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = roomSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const room: ProfessionalRoom = {
      id: randomUUID(),
      unitId: parsed.data.unitId,
      name: parsed.data.name,
      isActive: parsed.data.isActive,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData();
    if (!data.professionalRooms) data.professionalRooms = [];
    data.professionalRooms.push(room);
    await saveData(data);
    res.json({ room });
  });

  app.patch("/api/v2/professional-rooms/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const rooms = data.professionalRooms || [];
    const idx = rooms.findIndex((r: any) => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Sala nao encontrada." });
    rooms[idx] = { ...rooms[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ room: rooms[idx] });
  });
}
