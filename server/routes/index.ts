import { randomUUID } from "crypto";
import { Express } from "express";
import { loadData, saveData, AppData } from "../data";
import { AuthedRequest, sessions, getToken, requireAuth, requireRoles } from "../middleware";
import { audit, getServicePrice, isSlotAvailable, buildSuggestions, addMinutes, normalize, nowIso, sanitizeUpdate } from "../helpers";
import { patientSchema, appointmentSchema, financeTransactionSchema, agentSchema, campaignSchema } from "../schemas";
import {
  Patient, Appointment, FinanceTransaction, ServiceAgent, MarketingCampaign,
  TissGuide, InventoryItem, ReferralRecord, ReferenceMaterial, HelpTicket,
  LlmProviderConfig, NeuralKnowledgeItem, MedicalRecordEntry
} from "../../src/types";
import { dataService, TABLES } from "../data-service";
import { getAuditEvents } from "../audit";

function ensureId() {
  return randomUUID();
}

export function registerRoutes(app: Express) {
  // HEALTH
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime(), timestamp: new Date().toISOString() });
  });

  // AUTH
  app.post("/api/auth/login", async (req, res) => {
    return res.status(403).json({ error: "Login por PIN desativado. Use /api/v2/auth/login com email e senha.", code: "LEGACY_AUTH_DISABLED" });
  });

  app.post("/api/auth/logout", requireAuth, async (req: AuthedRequest, res) => {
    const token = getToken(req);
    if (token) sessions.delete(token);
    res.json({ ok: true });
  });

  app.get("/api/bootstrap", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    res.json(buildState(data, req.user!));
  });

  // PATIENTS
  app.post("/api/patients", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
    const parsed = patientSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const p = parsed.data;
    if (!p.lgpdConsent) return res.status(400).json({ error: "Consentimento LGPD obrigatorio." });

    const newPatient: Patient = {
      id: ensureId(), fullName: p.fullName, birthDate: p.birthDate,
      cpf: p.cpf, phone: p.phone, email: p.email, avatarUrl: p.avatarUrl,
      address: p.address, lgpdConsent: true, lgpdConsentAt: nowIso()
    };
    const created = await dataService.createPatient(newPatient, req.user!, req.user?.tenantId);
    res.json({ patient: created, medicalRecord: { patientId: created.id, bloodType: "Desconhecido", gender: "Nao informado", allergies: [], medications: [], chronicDiseases: [], entries: [] } });
  });

  app.put("/api/patients/:id", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updatePatient(req.params.id, req.body as Partial<Patient>, req.user!);
    if (!updated) return res.status(404).json({ error: "Paciente nao encontrado." });
    const data = await loadData();
    res.json({ patient: updated, appointments: data.appointments });
  });

  app.delete("/api/patients/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deletePatient(req.params.id, req.user!);
    if (!ok) return res.status(404).json({ error: "Paciente nao encontrado." });
    res.json({ ok: true });
  });

  // APPOINTMENTS
  app.post("/api/appointments", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = appointmentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const { patientId, doctorId, date, timeStart, type, observations } = parsed.data;
    const patient = data.patients.find(p => p.id === patientId);
    const doctor = data.doctors.find(d => d.id === doctorId);
    if (!patient || !doctor) return res.status(400).json({ error: "Paciente ou profissional nao encontrado." });
    const timeEnd = addMinutes(timeStart, 30);
    const avail = isSlotAvailable(doctor, date, timeStart, timeEnd, data.appointments);
    if (!avail.ok) return res.status(409).json({ error: avail.reason });
    const price = getServicePrice(type || "Consulta Particular", data.servicePrices);
    const apt: Appointment = {
      id: ensureId(), doctorId, date, timeStart, timeEnd,
      patientName: patient.fullName.toUpperCase(), status: "agendado",
      type: type || "Consulta Particular", isPrivate: normalize(type || "").includes("particular"),
      observations, arrival: "N/A", recordStatus: "pendente",
      paymentStatus: price.value === 0 ? "free" : "pending"
    };
    const created = await dataService.createAppointment(apt, req.user!, req.user?.tenantId);
    res.json({ appointment: created });
  });

  app.patch("/api/appointments/:id/status", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    apt.status = req.body.status;
    if (apt.status === "paciente_no_local" && (!apt.arrival || apt.arrival === "N/A")) {
      apt.arrival = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    const updated = await dataService.updateAppointment(req.params.id, { status: apt.status, arrival: apt.arrival } as Partial<Appointment>, req.user!);
    await audit(data, req.user!, "update_status", "appointment", apt.id, apt.status);
    res.json({ appointment: updated || apt });
  });

  app.patch("/api/appointments/:id/payment", requireAuth, requireRoles("admin", "finance", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    apt.paymentStatus = req.body.paymentStatus || "paid";
    const updated = await dataService.updateAppointment(req.params.id, { paymentStatus: apt.paymentStatus } as Partial<Appointment>, req.user!);
    await audit(data, req.user!, "confirm_payment", "appointment", apt.id, apt.patientName);
    res.json({ appointment: updated || apt });
  });

  app.delete("/api/appointments/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteAppointment(req.params.id, req.user!);
    if (!ok) return res.status(404).json({ error: "Agendamento nao encontrado." });
    res.json({ ok: true });
  });

  // MEDICAL RECORDS
  app.patch("/api/medical-records/:patientId/metadata", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const record = data.medicalRecords[req.params.patientId];
    if (!record) return res.status(404).json({ error: "Prontuario nao encontrado." });
    data.medicalRecords[req.params.patientId] = { ...record, ...req.body };
    await audit(data, req.user!, "update_metadata", "medical_record", req.params.patientId, "Ficha medica basica");
    await saveData(data);
    res.json({ medicalRecord: data.medicalRecords[req.params.patientId] });
  });

  app.post("/api/medical-records/:patientId/entries", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const record = data.medicalRecords[req.params.patientId];
    const patient = data.patients.find(p => p.id === req.params.patientId);
    if (!record || !patient) return res.status(404).json({ error: "Paciente ou prontuario nao encontrado." });
    const entry = req.body;
    if (!entry?.notes) return res.status(400).json({ error: "Evolucao clinica e obrigatoria." });
    const newEntry = { ...entry, id: randomUUID(), date: entry.date || new Date().toISOString().split("T")[0] };
    record.entries = [newEntry, ...record.entries];
    data.appointments = data.appointments.map(a =>
      a.patientName.toUpperCase() === patient.fullName.toUpperCase() && a.date === newEntry.date
        ? { ...a, recordStatus: "incluso", status: "atendido" } : a
    );
    await audit(data, req.user!, "create_entry", "medical_record", req.params.patientId, newEntry.doctorName);
    await saveData(data);
    res.json({ entry: newEntry, medicalRecord: record, appointments: data.appointments });
  });

  // FINANCE
  app.post("/api/finance/transactions", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const parsed = financeTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const { description, value, category, type } = parsed.data;
    const tx: FinanceTransaction = {
      id: ensureId(), date: new Date().toISOString().split("T")[0],
      description, value, category, type, status: "concluido", source: "manual"
    };
    const created = await dataService.createFinanceTransaction(tx, req.user!, req.user?.tenantId);
    res.json({ transaction: created });
  });

  app.delete("/api/finance/transactions/:id", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteFinanceTransaction(req.params.id, req.user!);
    if (!ok) return res.status(404).json({ error: "Transacao nao encontrada." });
    res.json({ ok: true });
  });

  // AGENTS
  app.post("/api/agents", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const parsed = agentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const fields = parsed.data;
    const agent: ServiceAgent = {
      id: ensureId(), name: fields.name, channel: fields.channel,
      objective: fields.objective, tone: fields.tone || "Profissional e acolhedor",
      status: "draft", escalationTo: fields.escalationTo || "Recepcao",
      workingHours: fields.workingHours || "Seg-Sex 08:00-18:00",
      rules: fields.rules || [], knowledgeBase: fields.knowledgeBase || [],
      connectionId: fields.connectionId || undefined,
      createdAt: new Date().toISOString().split("T")[0]
    };
    const created = await dataService.createOne<ServiceAgent>(TABLES.serviceAgents, agent, req.user!, "serviceAgents", req.user?.tenantId);
    res.json({ agent: created });
  });

  app.patch("/api/agents/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<ServiceAgent>(TABLES.serviceAgents, req.params.id, req.body as Partial<ServiceAgent>, req.user!, "serviceAgents");
    if (!updated) return res.status(404).json({ error: "Agente nao encontrado." });
    res.json({ agent: updated });
  });

  app.delete("/api/agents/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.serviceAgents, req.params.id, req.user!, "serviceAgents");
    if (!ok) return res.status(404).json({ error: "Agente nao encontrado." });
    res.json({ ok: true });
  });

  app.post("/api/agent-templates/:id/use", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const template = data.agentTemplates.find(item => item.id === req.params.id);
    if (!template) return res.status(404).json({ error: "Modelo de agente nao encontrado." });
    const agent: ServiceAgent = {
      id: ensureId(), name: String(req.body?.name || template.name),
      channel: template.channel, objective: template.objective,
      tone: template.tone, status: "draft",
      escalationTo: template.escalationTo, workingHours: template.workingHours,
      rules: template.rules, knowledgeBase: template.knowledgeBase,
      connectionId: req.body?.connectionId || undefined,
      createdAt: new Date().toISOString().split("T")[0]
    };
    const created = await dataService.createOne<ServiceAgent>(TABLES.serviceAgents, agent, req.user!, "serviceAgents", req.user?.tenantId);
    res.json({ agent: created });
  });

  // LLM PROVIDERS
  app.post("/api/llms", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { name, provider, model, apiKey, endpoint, temperature = 0.35, maxTokens = 1200, isDefault = false } = req.body || {};
    if (!name || !provider || !model) return res.status(400).json({ error: "Nome, provedor e modelo obrigatorios." });
    if (isDefault) data.llmProviderConfigs = data.llmProviderConfigs.map(item => ({ ...item, isDefault: false }));
    const now = nowIso();
    const llm: LlmProviderConfig = {
      id: randomUUID(), name: String(name).trim(), provider, model: String(model).trim(),
      apiKeyMasked: apiKey ? `****${String(apiKey).slice(-4)}` : "Nao configurada",
      endpoint: endpoint || undefined, temperature: Number(temperature),
      maxTokens: Number(maxTokens), isDefault: Boolean(isDefault) || data.llmProviderConfigs.length === 0,
      isActive: true, createdAt: now, updatedAt: now
    };
    const created = await dataService.createOne<LlmProviderConfig>(TABLES.llmProviderConfigs, llm, req.user!, "llmProviderConfigs", req.user?.tenantId);
    res.json({ llm: created });
  });

  app.patch("/api/llms/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.llmProviderConfigs.findIndex(item => item.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "LLM nao encontrada." });
    if (req.body?.isDefault) data.llmProviderConfigs = data.llmProviderConfigs.map(item => ({ ...item, isDefault: false }));
    const current = data.llmProviderConfigs[idx];
    const allowedFields: (keyof LlmProviderConfig)[] = ["name", "provider", "model", "endpoint", "temperature", "maxTokens", "isDefault", "isActive"];
    const patch = sanitizeUpdate<LlmProviderConfig>(req.body, allowedFields);
    data.llmProviderConfigs[idx] = { ...current, ...patch, updatedAt: nowIso() };
    await saveData(data);
    const updated = await dataService.updateOne<LlmProviderConfig>(TABLES.llmProviderConfigs, req.params.id, patch, req.user!, "llmProviderConfigs");
    res.json({ llm: data.llmProviderConfigs[idx] });
  });

  app.delete("/api/llms/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.llmProviderConfigs, req.params.id, req.user!, "llmProviderConfigs");
    if (!ok) return res.status(404).json({ error: "LLM nao encontrada." });
    res.json({ ok: true });
  });

  // NEURAL KNOWLEDGE
  app.post("/api/neural/knowledge", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { title, category, content, sourceType = "manual", sourceUrl, targetAgentIds = [], tags = [] } = req.body || {};
    if (!title || !content) return res.status(400).json({ error: "Titulo e conhecimento obrigatorios." });
    const now = nowIso();
    const item: NeuralKnowledgeItem = {
      id: ensureId(), title: String(title).trim(), category: String(category || "Geral").trim(),
      content: String(content).trim(), sourceType, sourceUrl: sourceUrl || undefined,
      targetAgentIds: Array.isArray(targetAgentIds) ? targetAgentIds : [],
      tags: Array.isArray(tags) ? tags : String(tags || "").split(",").map(s => s.trim()).filter(Boolean),
      status: "indexed", createdAt: now, updatedAt: now
    };
    const created = await dataService.createOne<NeuralKnowledgeItem>(TABLES.neuralKnowledge, item, req.user!, "neuralKnowledge", req.user?.tenantId);
    res.json({ item: created });
  });

  app.patch("/api/neural/knowledge/:id", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<NeuralKnowledgeItem>(TABLES.neuralKnowledge, req.params.id, req.body as Partial<NeuralKnowledgeItem>, req.user!, "neuralKnowledge");
    if (!updated) return res.status(404).json({ error: "Conhecimento nao encontrado." });
    res.json({ item: updated });
  });

  app.delete("/api/neural/knowledge/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.neuralKnowledge, req.params.id, req.user!, "neuralKnowledge");
    if (!ok) return res.status(404).json({ error: "Conhecimento nao encontrado." });
    res.json({ ok: true });
  });

  // CAMPAIGNS
  app.post("/api/marketing/campaigns", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const { name, audience, channel, goal, scheduledDate, budget } = parsed.data;
    const campaign: MarketingCampaign = {
      id: ensureId(), name, audience, channel, status: "draft",
      goal: goal || "Gerar oportunidades de atendimento",
      scheduledDate: scheduledDate || new Date().toISOString().split("T")[0],
      budget: Number(budget), leads: 0
    };
    const created = await dataService.createOne<MarketingCampaign>(TABLES.marketingCampaigns, campaign, req.user!, "marketingCampaigns", req.user?.tenantId);
    res.json({ campaign: created });
  });

  app.patch("/api/marketing/campaigns/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<MarketingCampaign>(TABLES.marketingCampaigns, req.params.id, req.body as Partial<MarketingCampaign>, req.user!, "marketingCampaigns");
    if (!updated) return res.status(404).json({ error: "Campanha nao encontrada." });
    res.json({ campaign: updated });
  });

  app.delete("/api/marketing/campaigns/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.marketingCampaigns, req.params.id, req.user!, "marketingCampaigns");
    if (!ok) return res.status(404).json({ error: "Campanha nao encontrada." });
    res.json({ ok: true });
  });

  // TISS
  app.post("/api/tiss/guides", requireAuth, requireRoles("admin", "finance", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { patientName, operator, procedure, value = 0 } = req.body || {};
    if (!patientName || !operator || !procedure) return res.status(400).json({ error: "Paciente, operadora e procedimento obrigatorios." });
    const guide: TissGuide = {
      id: ensureId(), patientName, operator, procedure,
      status: "draft", value: Number(value),
      createdAt: new Date().toISOString().split("T")[0]
    };
    const created = await dataService.createOne<TissGuide>(TABLES.tissGuides, guide, req.user!, "tissGuides", req.user?.tenantId);
    res.json({ guide: created });
  });

  app.patch("/api/tiss/guides/:id", requireAuth, requireRoles("admin", "finance", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<TissGuide>(TABLES.tissGuides, req.params.id, req.body as Partial<TissGuide>, req.user!, "tissGuides");
    if (!updated) return res.status(404).json({ error: "Guia TISS nao encontrada." });
    res.json({ guide: updated });
  });

  app.delete("/api/tiss/guides/:id", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.tissGuides, req.params.id, req.user!, "tissGuides");
    if (!ok) return res.status(404).json({ error: "Guia TISS nao encontrada." });
    res.json({ ok: true });
  });

  // INVENTORY
  app.post("/api/inventory/items", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { name, category, quantity = 0, minQuantity = 0, unit = "unidades", expiresAt = "", supplier = "Nao informado" } = req.body || {};
    if (!name || !category) return res.status(400).json({ error: "Nome e categoria obrigatorios." });
    const item: InventoryItem = {
      id: ensureId(), name, category, quantity: Number(quantity),
      minQuantity: Number(minQuantity), unit, expiresAt, supplier
    };
    const created = await dataService.createOne<InventoryItem>(TABLES.inventoryItems, item, req.user!, "inventoryItems", req.user?.tenantId);
    res.json({ item: created });
  });

  app.patch("/api/inventory/items/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<InventoryItem>(TABLES.inventoryItems, req.params.id, req.body as Partial<InventoryItem>, req.user!, "inventoryItems");
    if (!updated) return res.status(404).json({ error: "Item de estoque nao encontrado." });
    res.json({ item: updated });
  });

  app.delete("/api/inventory/items/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.inventoryItems, req.params.id, req.user!, "inventoryItems");
    if (!ok) return res.status(404).json({ error: "Item de estoque nao encontrado." });
    res.json({ ok: true });
  });

  // REFERRALS
  app.post("/api/referrals", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { patientName, referredName, reward } = req.body || {};
    if (!patientName || !referredName) return res.status(400).json({ error: "Paciente indicador e indicado obrigatorios." });
    const referral: ReferralRecord = {
      id: ensureId(), patientName, referredName,
      status: "invited", reward: reward || "Credito em atendimento",
      createdAt: new Date().toISOString().split("T")[0]
    };
    const created = await dataService.createOne<ReferralRecord>(TABLES.referrals, referral, req.user!, "referrals", req.user?.tenantId);
    res.json({ referral: created });
  });

  app.patch("/api/referrals/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<ReferralRecord>(TABLES.referrals, req.params.id, req.body as Partial<ReferralRecord>, req.user!, "referrals");
    if (!updated) return res.status(404).json({ error: "Indicacao nao encontrada." });
    res.json({ referral: updated });
  });

  app.delete("/api/referrals/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.referrals, req.params.id, req.user!, "referrals");
    if (!ok) return res.status(404).json({ error: "Indicacao nao encontrada." });
    res.json({ ok: true });
  });

  // REFERENCES
  app.post("/api/references", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { title, category, url, summary } = req.body || {};
    if (!title || !category) return res.status(400).json({ error: "Titulo e categoria obrigatorios." });
    const ref: ReferenceMaterial = {
      id: ensureId(), title, category, url: url || "",
      summary: summary || "", updatedAt: new Date().toISOString().split("T")[0]
    };
    const created = await dataService.createOne<ReferenceMaterial>(TABLES.referenceMaterials, ref, req.user!, "references", req.user?.tenantId);
    res.json({ reference: created });
  });

  app.delete("/api/references/:id", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.referenceMaterials, req.params.id, req.user!, "references");
    if (!ok) return res.status(404).json({ error: "Referencia nao encontrada." });
    res.json({ ok: true });
  });

  // HELP TICKETS
  app.post("/api/help/tickets", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { title, module, priority, description } = req.body || {};
    if (!title || !module) return res.status(400).json({ error: "Titulo e modulo obrigatorios." });
    const ticket: HelpTicket = {
      id: ensureId(), title, module, priority: priority || "medium",
      status: "open", description: description || "",
      createdAt: new Date().toISOString().split("T")[0]
    };
    const created = await dataService.createOne<HelpTicket>(TABLES.helpTickets, ticket, req.user!, "helpTickets", req.user?.tenantId);
    res.json({ ticket: created });
  });

  app.patch("/api/help/tickets/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<HelpTicket>(TABLES.helpTickets, req.params.id, req.body as Partial<HelpTicket>, req.user!, "helpTickets");
    if (!updated) return res.status(404).json({ error: "Chamado nao encontrado." });
    res.json({ ticket: updated });
  });

  app.delete("/api/help/tickets/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.helpTickets, req.params.id, req.user!, "helpTickets");
    if (!ok) return res.status(404).json({ error: "Chamado nao encontrado." });
    res.json({ ok: true });
  });

  // AUDIT
  app.get("/api/audit", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const events = await getAuditEvents(req.user?.tenantId);
    res.json(events.slice(0, 500));
  });

  // CHAT / AI - Multi-Provider
  app.post("/api/chat", requireAuth, async (req: AuthedRequest, res) => {
    try {
      const { message, messages: history, context, provider } = req.body;
      const { callAI } = await import("../ai-service");
      
      // Support both single message and conversation history
      const conversationMessages = history && Array.isArray(history)
        ? history
        : [{ role: "user" as const, content: String(message || "") }];

      // If provider specified by frontend (from LLM configs), use it
      let selectedProvider = provider;

      // Auto-detect from active LLM configs if no provider specified
      if (!selectedProvider) {
        const data = await loadData();
        const defaultLlm = data.llmProviderConfigs?.find(l => l.isDefault && l.isActive);
        if (defaultLlm) {
          // We'd need the decrypted key - for now, use env vars as source of truth
          selectedProvider = {
            name: defaultLlm.provider,
            model: defaultLlm.model,
            apiKey: undefined // env var will be auto-detected
          };
        }
      }

      const text = await callAI(conversationMessages, context, selectedProvider);
      return res.json({ text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Erro ao processar solicitacao." });
    }
  });


  // SUGGESTIONS
  app.post("/api/suggestions", requireAuth, async (req, res) => {
    try {
      const data = await loadData();
      const { doctor, doctorId, requestedSlot, currentAppointments } = req.body;
      const selectedDoctor = doctor || data.doctors.find(d => d.id === doctorId);
      if (!selectedDoctor || !requestedSlot?.date || !requestedSlot?.time)
        return res.status(400).json({ error: "Profissional, data e horario obrigatorios." });
      const apts = Array.isArray(currentAppointments) ? currentAppointments : data.appointments.filter(a => a.doctorId === selectedDoctor.id);
      res.json(buildSuggestions(selectedDoctor, requestedSlot, apts));
    } catch (error) {
      console.error("Suggestion Error:", error);
      res.status(500).json({ error: "Erro ao gerar sugestoes." });
    }
  });
}

function buildState(data: AppData, user: { id: string; name: string; role: string }) {
  const role = user.role;
  const financeRoles = ["admin", "finance", "super_admin"];
  return {
    user,
    patients: data.patients,
    doctors: data.doctors,
    appointments: data.appointments,
    medicalRecords: role === "admin" || role === "doctor" || role === "super_admin" ? data.medicalRecords : {},
    financeTransactions: financeRoles.includes(role) ? data.financeTransactions : [],
    servicePrices: data.servicePrices,
    auditEvents: role === "admin" || role === "super_admin" ? data.auditEvents.slice(-200).reverse() : [],
    serviceAgents: data.serviceAgents,
    marketingCampaigns: data.marketingCampaigns,
    tissGuides: financeRoles.includes(role) ? data.tissGuides : [],
    inventoryItems: data.inventoryItems,
    referrals: data.referrals,
    references: data.references,
    helpTickets: data.helpTickets,
    llmProviderConfigs: role === "admin" || role === "super_admin" ? data.llmProviderConfigs : [],
    agentTemplates: data.agentTemplates,
    neuralKnowledge: data.neuralKnowledge,
    patientDocuments: data.patientDocuments,
    waitingList: data.waitingList,
    scheduleBlocks: data.scheduleBlocks,
    medicalTemplates: data.medicalTemplates,
    accountsPayable: financeRoles.includes(role) ? data.accountsPayable : [],
    paymentGatewayConfig: role === "admin" || role === "super_admin" ? data.paymentGatewayConfig : [],
    tenants: role === "super_admin" ? data.tenants : [],
    plans: role === "super_admin" ? data.plans : []
  };
}
