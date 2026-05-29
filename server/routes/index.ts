import { randomUUID } from "crypto";
import { Express } from "express";
import { loadData, saveData, AppData } from "../data";
import { AuthedRequest, sessions, getToken, requireAuth, requireRoles } from "../middleware";
import { audit, getServicePrice, isSlotAvailable, buildSuggestions, addMinutes, normalize, nowIso } from "../helpers";
import { patientSchema, appointmentSchema, financeTransactionSchema, agentSchema, campaignSchema } from "../schemas";
import {
  Patient, Appointment, FinanceTransaction, ServiceAgent, MarketingCampaign,
  TissGuide, InventoryItem, ReferralRecord, ReferenceMaterial, HelpTicket
} from "../../src/types";

export function registerRoutes(app: Express) {
  const legacyPinLoginEnabled = process.env.ENABLE_LEGACY_PIN_LOGIN === "true" || process.env.NODE_ENV !== "production";

  // AUTH
  app.get("/api/auth/users", async (_req, res) => {
    if (!legacyPinLoginEnabled) return res.status(404).json({ error: "Login legado desativado." });
    const data = await loadData();
    res.json(data.users.map(u => { const { pin, ...rest } = u; return rest; }));
  });

  app.post("/api/auth/login", async (req, res) => {
    if (!legacyPinLoginEnabled) return res.status(403).json({ error: "Login por PIN desativado neste ambiente." });
    const { userId, pin } = req.body || {};
    const data = await loadData();
    const serverUser = data.users.find(u => u.id === userId && u.pin === pin);
    if (!serverUser) return res.status(401).json({ error: "Usuario ou PIN invalido." });
    const user = { id: serverUser.id, name: serverUser.name, role: serverUser.role, specialty: serverUser.specialty };
    const token = crypto.randomUUID();
    sessions.set(token, user);
    audit(data, user, "login", "session", token, "Entrada no sistema");
    await saveData(data);
    res.json({ token, user, state: buildState(data, user) });
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
  app.post("/api/patients", requireAuth, requireRoles(["admin", "doctor", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = patientSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    }
    const p = parsed.data;
    if (!p.lgpdConsent) {
      return res.status(400).json({ error: "Consentimento LGPD para tratamento de dados e obrigatorio para cadastrar paciente." });
    }
    const newPatient: Patient = { id: `p-${Date.now()}`, fullName: p.fullName, birthDate: p.birthDate, cpf: p.cpf, phone: p.phone, email: p.email, avatarUrl: p.avatarUrl, address: p.address, lgpdConsent: true, lgpdConsentAt: nowIso() };
    data.patients.push(newPatient);
    data.medicalRecords[newPatient.id] = { patientId: newPatient.id, bloodType: "Desconhecido", gender: "Nao informado", allergies: [], medications: [], chronicDiseases: [], entries: [] };
    audit(data, req.user!, "create", "patient", newPatient.id, newPatient.fullName);
    audit(data, req.user!, "lgpd_consent_granted", "lgpd_consent", newPatient.id, "treatment:true");
    await saveData(data);
    res.json({ patient: newPatient, medicalRecord: data.medicalRecords[newPatient.id] });
  });

  app.put("/api/patients/:id", requireAuth, requireRoles(["admin", "doctor", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const index = data.patients.findIndex(p => p.id === req.params.id);
    if (index === -1) return res.status(404).json({ error: "Paciente nao encontrado." });
    const prevName = data.patients[index].fullName;
    const updated = { ...data.patients[index], ...req.body, id: req.params.id } as Patient;
    data.patients[index] = updated;
    if (prevName !== updated.fullName) {
      data.appointments = data.appointments.map(a => a.patientName.toUpperCase() === prevName.toUpperCase() ? { ...a, patientName: updated.fullName.toUpperCase() } : a);
    }
    audit(data, req.user!, "update", "patient", updated.id, updated.fullName);
    await saveData(data);
    res.json({ patient: updated, appointments: data.appointments });
  });

  app.delete("/api/patients/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.patients.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Paciente nao encontrado." });
    const removed = data.patients.splice(idx, 1)[0];
    delete data.medicalRecords[removed.id];
    audit(data, req.user!, "delete", "patient", removed.id, removed.fullName);
    await saveData(data);
    res.json({ ok: true });
  });

  // APPOINTMENTS
  app.post("/api/appointments", requireAuth, requireRoles(["admin", "doctor", "reception"]), async (req: AuthedRequest, res) => {
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
    const apt: Appointment = { id: `apt-${Date.now()}`, doctorId, date, timeStart, timeEnd, patientName: patient.fullName.toUpperCase(), status: "agendado", type: type || "Consulta Particular", isPrivate: normalize(type || "").includes("particular"), observations, arrival: "N/A", recordStatus: "pendente", paymentStatus: price.value === 0 ? "free" : "pending" };
    data.appointments.push(apt);
    audit(data, req.user!, "create", "appointment", apt.id, `${apt.patientName} ${date} ${timeStart}`);
    await saveData(data);
    res.json({ appointment: apt });
  });

  app.patch("/api/appointments/:id/status", requireAuth, requireRoles(["admin", "doctor", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    apt.status = req.body.status;
    if (apt.status === "paciente_no_local" && (!apt.arrival || apt.arrival === "N/A")) {
      apt.arrival = new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    audit(data, req.user!, "update_status", "appointment", apt.id, apt.status);
    await saveData(data);
    res.json({ appointment: apt });
  });

  app.patch("/api/appointments/:id/payment", requireAuth, requireRoles(["admin", "finance", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    apt.paymentStatus = req.body.paymentStatus || "paid";
    audit(data, req.user!, "confirm_payment", "appointment", apt.id, apt.patientName);
    await saveData(data);
    res.json({ appointment: apt });
  });

  app.delete("/api/appointments/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.appointments.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Agendamento nao encontrado." });
    const removed = data.appointments.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "appointment", removed.id, `${removed.patientName} ${removed.date}`);
    await saveData(data);
    res.json({ ok: true });
  });

  // MEDICAL RECORDS
  app.patch("/api/medical-records/:patientId/metadata", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const record = data.medicalRecords[req.params.patientId];
    if (!record) return res.status(404).json({ error: "Prontuario nao encontrado." });
    data.medicalRecords[req.params.patientId] = { ...record, ...req.body };
    audit(data, req.user!, "update_metadata", "medical_record", req.params.patientId, "Ficha medica basica");
    await saveData(data);
    res.json({ medicalRecord: data.medicalRecords[req.params.patientId] });
  });

  app.post("/api/medical-records/:patientId/entries", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const record = data.medicalRecords[req.params.patientId];
    const patient = data.patients.find(p => p.id === req.params.patientId);
    if (!record || !patient) return res.status(404).json({ error: "Paciente ou prontuario nao encontrado." });
    const entry = req.body;
    if (!entry?.notes) return res.status(400).json({ error: "Evolucao clinica e obrigatoria." });
    const newEntry = { ...entry, id: `e-${Date.now()}`, date: entry.date || new Date().toISOString().split("T")[0] };
    record.entries = [newEntry, ...record.entries];
    data.appointments = data.appointments.map(a => a.patientName.toUpperCase() === patient.fullName.toUpperCase() && a.date === newEntry.date ? { ...a, recordStatus: "incluso", status: "atendido" } : a);
    audit(data, req.user!, "create_entry", "medical_record", req.params.patientId, newEntry.doctorName);
    await saveData(data);
    res.json({ entry: newEntry, medicalRecord: record, appointments: data.appointments });
  });

  // FINANCE
  app.post("/api/finance/transactions", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = financeTransactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const { description, value, category, type } = parsed.data;
    const tx: FinanceTransaction = { id: `fin-${Date.now()}`, date: new Date().toISOString().split("T")[0], description, value, category, type, status: "concluido", source: "manual" };
    data.financeTransactions.unshift(tx);
    audit(data, req.user!, "create", "finance_transaction", tx.id, tx.description);
    await saveData(data);
    res.json({ transaction: tx });
  });

  app.delete("/api/finance/transactions/:id", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.financeTransactions.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Transacao nao encontrada." });
    const removed = data.financeTransactions.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "finance_transaction", removed.id, removed.description);
    await saveData(data);
    res.json({ ok: true });
  });

  // AGENTS
  app.post("/api/agents", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = agentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const { name, channel, objective, tone, escalationTo, workingHours, rules, knowledgeBase } = parsed.data;
    const agent: ServiceAgent = { id: `agent-${Date.now()}`, name, channel, objective, tone: tone || "Profissional e acolhedor", status: "draft", escalationTo: escalationTo || "Recepcao", workingHours: workingHours || "Seg-Sex 08:00-18:00", rules: rules || [], knowledgeBase: knowledgeBase || [], createdAt: new Date().toISOString().split("T")[0] };
    data.serviceAgents.unshift(agent);
    audit(data, req.user!, "create", "service_agent", agent.id, `${agent.name} ${agent.channel}`);
    await saveData(data);
    res.json({ agent });
  });

  app.patch("/api/agents/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.serviceAgents.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Agente nao encontrado." });
    data.serviceAgents[idx] = { ...data.serviceAgents[idx], ...req.body };
    audit(data, req.user!, "update", "service_agent", req.params.id, data.serviceAgents[idx].status);
    await saveData(data);
    res.json({ agent: data.serviceAgents[idx] });
  });

  app.delete("/api/agents/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.serviceAgents.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Agente nao encontrado." });
    const removed = data.serviceAgents.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "service_agent", removed.id, removed.name);
    await saveData(data);
    res.json({ ok: true });
  });

  // CAMPAIGNS
  app.post("/api/marketing/campaigns", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = campaignSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const { name, audience, channel, goal, scheduledDate, budget } = parsed.data;
    const campaign: MarketingCampaign = { id: `camp-${Date.now()}`, name, audience, channel, status: "draft", goal: goal || "Gerar oportunidades de atendimento", scheduledDate: scheduledDate || new Date().toISOString().split("T")[0], budget: Number(budget), leads: 0 };
    data.marketingCampaigns.unshift(campaign);
    audit(data, req.user!, "create", "marketing_campaign", campaign.id, campaign.name);
    await saveData(data);
    res.json({ campaign });
  });

  app.patch("/api/marketing/campaigns/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.marketingCampaigns.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Campanha nao encontrada." });
    data.marketingCampaigns[idx] = { ...data.marketingCampaigns[idx], ...req.body };
    audit(data, req.user!, "update", "marketing_campaign", req.params.id, data.marketingCampaigns[idx].status);
    await saveData(data);
    res.json({ campaign: data.marketingCampaigns[idx] });
  });

  app.delete("/api/marketing/campaigns/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.marketingCampaigns.findIndex(c => c.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Campanha nao encontrada." });
    const removed = data.marketingCampaigns.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "marketing_campaign", removed.id, removed.name);
    await saveData(data);
    res.json({ ok: true });
  });

  // TISS
  app.post("/api/tiss/guides", requireAuth, requireRoles(["admin", "finance", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { patientName, operator, procedure, value = 0 } = req.body || {};
    if (!patientName || !operator || !procedure) return res.status(400).json({ error: "Paciente, operadora e procedimento sao obrigatorios." });
    const guide: TissGuide = { id: `tiss-${Date.now()}`, patientName, operator, procedure, status: "draft", value: Number(value), createdAt: new Date().toISOString().split("T")[0] };
    data.tissGuides.unshift(guide);
    audit(data, req.user!, "create", "tiss_guide", guide.id, `${guide.patientName} ${guide.operator}`);
    await saveData(data);
    res.json({ guide });
  });

  app.patch("/api/tiss/guides/:id", requireAuth, requireRoles(["admin", "finance", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.tissGuides.findIndex(g => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Guia TISS nao encontrada." });
    data.tissGuides[idx] = { ...data.tissGuides[idx], ...req.body };
    audit(data, req.user!, "update", "tiss_guide", req.params.id, data.tissGuides[idx].status);
    await saveData(data);
    res.json({ guide: data.tissGuides[idx] });
  });

  app.delete("/api/tiss/guides/:id", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.tissGuides.findIndex(g => g.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Guia TISS nao encontrada." });
    const removed = data.tissGuides.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "tiss_guide", removed.id, `${removed.patientName} ${removed.operator}`);
    await saveData(data);
    res.json({ ok: true });
  });

  // INVENTORY
  app.post("/api/inventory/items", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { name, category, quantity = 0, minQuantity = 0, unit = "unidades", expiresAt = "", supplier = "Nao informado" } = req.body || {};
    if (!name || !category) return res.status(400).json({ error: "Nome e categoria sao obrigatorios." });
    const item: InventoryItem = { id: `stock-${Date.now()}`, name, category, quantity: Number(quantity), minQuantity: Number(minQuantity), unit, expiresAt, supplier };
    data.inventoryItems.unshift(item);
    audit(data, req.user!, "create", "inventory_item", item.id, item.name);
    await saveData(data);
    res.json({ item });
  });

  app.patch("/api/inventory/items/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.inventoryItems.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Item de estoque nao encontrado." });
    data.inventoryItems[idx] = { ...data.inventoryItems[idx], ...req.body };
    audit(data, req.user!, "update", "inventory_item", req.params.id, data.inventoryItems[idx].name);
    await saveData(data);
    res.json({ item: data.inventoryItems[idx] });
  });

  app.delete("/api/inventory/items/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.inventoryItems.findIndex(i => i.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Item de estoque nao encontrado." });
    const removed = data.inventoryItems.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "inventory_item", removed.id, removed.name);
    await saveData(data);
    res.json({ ok: true });
  });

  // REFERRALS
  app.post("/api/referrals", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { patientName, referredName, reward } = req.body || {};
    if (!patientName || !referredName) return res.status(400).json({ error: "Paciente indicador e indicado sao obrigatorios." });
    const referral: ReferralRecord = { id: `referral-${Date.now()}`, patientName, referredName, status: "invited", reward: reward || "Credito em atendimento", createdAt: new Date().toISOString().split("T")[0] };
    data.referrals.unshift(referral);
    audit(data, req.user!, "create", "referral", referral.id, `${referral.patientName} -> ${referral.referredName}`);
    await saveData(data);
    res.json({ referral });
  });

  app.patch("/api/referrals/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.referrals.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Indicacao nao encontrada." });
    data.referrals[idx] = { ...data.referrals[idx], ...req.body };
    audit(data, req.user!, "update", "referral", req.params.id, data.referrals[idx].status);
    await saveData(data);
    res.json({ referral: data.referrals[idx] });
  });

  app.delete("/api/referrals/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.referrals.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Indicacao nao encontrada." });
    const removed = data.referrals.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "referral", removed.id, `${removed.patientName} -> ${removed.referredName}`);
    await saveData(data);
    res.json({ ok: true });
  });

  // REFERENCES
  app.post("/api/references", requireAuth, requireRoles(["admin", "doctor", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { title, category, url, summary } = req.body || {};
    if (!title || !category) return res.status(400).json({ error: "Titulo e categoria sao obrigatorios." });
    const ref: ReferenceMaterial = { id: `reference-${Date.now()}`, title, category, url: url || "", summary: summary || "", updatedAt: new Date().toISOString().split("T")[0] };
    data.references.unshift(ref);
    audit(data, req.user!, "create", "reference", ref.id, ref.title);
    await saveData(data);
    res.json({ reference: ref });
  });

  app.delete("/api/references/:id", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.references.findIndex(r => r.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Referencia nao encontrada." });
    const removed = data.references.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "reference", removed.id, removed.title);
    await saveData(data);
    res.json({ ok: true });
  });

  // HELP TICKETS
  app.post("/api/help/tickets", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { title, module, priority, description } = req.body || {};
    if (!title || !module) return res.status(400).json({ error: "Titulo e modulo sao obrigatorios." });
    const ticket: HelpTicket = { id: `help-${Date.now()}`, title, module, priority: priority || "medium", status: "open", description: description || "", createdAt: new Date().toISOString().split("T")[0] };
    data.helpTickets.unshift(ticket);
    audit(data, req.user!, "create", "help_ticket", ticket.id, ticket.title);
    await saveData(data);
    res.json({ ticket });
  });

  app.patch("/api/help/tickets/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.helpTickets.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Chamado nao encontrado." });
    data.helpTickets[idx] = { ...data.helpTickets[idx], ...req.body };
    audit(data, req.user!, "update", "help_ticket", req.params.id, data.helpTickets[idx].status);
    await saveData(data);
    res.json({ ticket: data.helpTickets[idx] });
  });

  app.delete("/api/help/tickets/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.helpTickets.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Chamado nao encontrado." });
    const removed = data.helpTickets.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "help_ticket", removed.id, removed.title);
    await saveData(data);
    res.json({ ok: true });
  });

  // AUDIT
  app.get("/api/audit", requireAuth, requireRoles(["admin"]), async (_req, res) => {
    const data = await loadData();
    res.json(data.auditEvents.slice(-500).reverse());
  });

  // CHAT / AI
  app.post("/api/chat", requireAuth, async (req, res) => {
    try {
      const { message, context } = req.body;
      const { HAS_GEMINI_KEY, GEMINI_API_KEY } = await import("../config");
      if (HAS_GEMINI_KEY) {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { headers: { "User-Agent": "consultio-med" } } });
        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: message,
          config: { systemInstruction: `Voce e um assistente operacional do Consultio Med. Responda em portugues, com foco em agenda, pacientes, financeiro e prontuario. Nao invente dados clinicos. Contexto: ${JSON.stringify(context)}` }
        });
        return res.json({ text: response.text });
      }
      const msg = String(message || "").toLowerCase();
      let text = "";
      if (msg.includes("horario") || msg.includes("horário") || msg.includes("agenda")) text = "Posso analisar a agenda atual e sugerir horarios livres. Use o botao Novo Agendamento para validar conflitos.";
      else if (msg.includes("financeiro") || msg.includes("pagamento")) text = "No financeiro voce acompanha recebidos, pendentes, despesas e confirmar pagamentos.";
      else text = "Estou pronto para apoiar a rotina da clinica. Posso ajudar com agenda, pacientes, prontuarios e financeiro.";
      res.json({ text });
    } catch (error) {
      console.error("Chat Error:", error);
      res.status(500).json({ error: "Erro ao processar sua solicitacao." });
    }
  });

  // SUGGESTIONS
  app.post("/api/suggestions", requireAuth, async (req, res) => {
    try {
      const data = await loadData();
      const { doctor, doctorId, requestedSlot, currentAppointments } = req.body;
      const selectedDoctor = doctor || data.doctors.find(d => d.id === doctorId);
      if (!selectedDoctor || !requestedSlot?.date || !requestedSlot?.time) return res.status(400).json({ error: "Profissional, data e horario obrigatorios." });
      const apts = Array.isArray(currentAppointments) ? currentAppointments : data.appointments.filter(a => a.doctorId === selectedDoctor.id);
      res.json(buildSuggestions(selectedDoctor, requestedSlot, apts));
    } catch (error) {
      console.error("Suggestion Error:", error);
      res.status(500).json({ error: "Erro ao gerar sugestoes." });
    }
  });
}

function buildState(data: AppData, user: { id: string; name: string; role: string }) {
  return {
    user,
    patients: data.patients,
    doctors: data.doctors,
    appointments: data.appointments,
    medicalRecords: data.medicalRecords,
    financeTransactions: data.financeTransactions,
    servicePrices: data.servicePrices,
    auditEvents: user.role === "admin" ? data.auditEvents.slice(-200).reverse() : [],
    serviceAgents: data.serviceAgents,
    marketingCampaigns: data.marketingCampaigns,
    tissGuides: data.tissGuides,
    inventoryItems: data.inventoryItems,
    referrals: data.referrals,
    references: data.references,
    helpTickets: data.helpTickets
  };
}
