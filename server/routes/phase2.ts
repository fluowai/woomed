import { randomUUID } from "crypto";
import { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { loadData, saveData } from "../data";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { audit, nowIso } from "../helpers";
import { waitingListSchema, scheduleBlockSchema, medicalTemplateSchema, accountsPayableSchema, paymentGatewaySchema } from "../schemas";
import { ensureEncrypted, ensureDecrypted } from "../crypto";
import {
  PatientDocument, WaitingListEntry, ScheduleBlock, MedicalTemplate,
  AccountsPayable, PaymentGatewayConfig, DreEntry
} from "../../src/types";
import { dataService, TABLES } from "../data-service";

const uploadsDir = path.join(process.cwd(), "uploads", "documents");
const storage = multer.diskStorage({
  destination: async (_req, _file, cb) => {
    await fs.mkdir(uploadsDir, { recursive: true });
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 20 * 1024 * 1024 } });

export function registerPhase2Routes(app: Express) {
  // === PATIENT DOCUMENTS ===
  app.post("/api/v2/patients/:patientId/documents", requireAuth, requireRoles("admin", "doctor", "reception"), upload.single("file"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const patient = data.patients.find(p => p.id === req.params.patientId);
    if (!patient) return res.status(404).json({ error: "Paciente nao encontrado." });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Arquivo obrigatorio." });
    const doc: PatientDocument = {
      id: `doc-${Date.now()}`, patientId: req.params.patientId,
      name: req.body.name || file.originalname, type: req.body.type || "outro",
      url: `/uploads/documents/${file.filename}`, uploadedAt: nowIso(),
      uploadedBy: req.user!.id, notes: req.body.notes || ""
    };
    const created = await dataService.createOne<PatientDocument>(TABLES.patientDocuments, doc, req.user!, "patientDocuments", req.user?.tenantId);
    res.json({ document: doc });
  });

  app.get("/api/v2/patients/:patientId/documents", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const docs = data.patientDocuments.filter(d => d.patientId === req.params.patientId);
    res.json(docs);
  });

  app.delete("/api/v2/patients/documents/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.patientDocuments, req.params.id, req.user!, "patientDocuments");
    const data = await loadData();
    const doc = data.patientDocuments.find(d => d.id === req.params.id);
    if (doc) {
      try { await fs.unlink(path.join(process.cwd(), doc.url)); } catch { }
    }
    if (!ok) return res.status(404).json({ error: "Documento nao encontrado." });
    res.json({ ok: true });
  });

  // === WAITING LIST ===
  app.get("/api/v2/waiting-list", requireAuth, async (_req, res) => {
    const data = await loadData();
    res.json(data.waitingList.sort((a, b) => a.created_at?.localeCompare(b.created_at || "") || 0));
  });

  app.post("/api/v2/waiting-list", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const parsed = waitingListSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const entry: WaitingListEntry = { id: `wl-${Date.now()}`, ...parsed.data, status: "waiting", created_at: nowIso() };
    const created = await dataService.createOne<WaitingListEntry>(TABLES.waitingList, entry, req.user!, "waitingList", req.user?.tenantId);
    res.json({ entry: created });
  });

  app.patch("/api/v2/waiting-list/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.waitingList.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Entrada na lista de espera nao encontrada." });
    if (req.body.status === "notified") data.waitingList[idx].notifiedAt = nowIso();
    const updated = await dataService.updateOne<WaitingListEntry>(TABLES.waitingList, req.params.id, { ...req.body, ...(req.body.status === "notified" ? { notifiedAt: nowIso() } : {}) }, req.user!, "waitingList");
    await audit(data, req.user!, "update", "waiting_list", req.params.id, data.waitingList[idx]?.status);
    res.json({ entry: updated || data.waitingList[idx] });
  });

  app.delete("/api/v2/waiting-list/:id", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.waitingList, req.params.id, req.user!, "waitingList");
    if (!ok) return res.status(404).json({ error: "Entrada na lista de espera nao encontrada." });
    res.json({ ok: true });
  });

  app.post("/api/v2/waiting-list/:id/notify", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const entry = data.waitingList.find(e => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: "Entrada nao encontrada." });
    const updated = await dataService.updateOne<WaitingListEntry>(TABLES.waitingList, req.params.id, { status: "notified", notifiedAt: nowIso() }, req.user!, "waitingList");
    await audit(data, req.user!, "notify", "waiting_list", entry.id, `Notificado: ${entry.patientName}`);
    res.json({ entry: updated || entry });
  });

  app.post("/api/v2/waiting-list/auto-schedule", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { doctorId, cancelledDate, cancelledTime } = req.body || {};
    if (!doctorId || !cancelledDate) return res.status(400).json({ error: "Profissional e data do cancelamento obrigatorios." });
    const candidates = data.waitingList.filter(e =>
      e.doctorId === doctorId && e.status === "waiting" &&
      (!e.preferredDate || e.preferredDate <= cancelledDate)
    ).sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    if (candidates.length === 0) return res.json({ notified: false, message: "Nenhum paciente na lista de espera para este profissional." });
    const next = candidates[0];
    const updateData: Partial<WaitingListEntry> = { status: "notified", notifiedAt: nowIso() };
    if (cancelledTime && !next.preferredTime) updateData.preferredTime = cancelledTime;
    if (!next.preferredDate) updateData.preferredDate = cancelledDate;
    await dataService.updateOne<WaitingListEntry>(TABLES.waitingList, next.id, updateData, req.user!, "waitingList");
    await audit(data, req.user!, "auto_schedule", "waiting_list", next.id, `Auto-notificado apos cancelamento: ${next.patientName}`);
    res.json({ notified: true, entry: { ...next, ...updateData }, message: `Paciente ${next.patientName} notificado.` });
  });

  // === SCHEDULE BLOCKS ===
  app.get("/api/v2/schedule-blocks", requireAuth, async (req, res) => {
    const data = await loadData();
    const doctorId = String(req.query.doctorId || "");
    const blocks = data.scheduleBlocks.filter(b => !doctorId || b.doctorId === doctorId).sort((a, b) => a.date.localeCompare(b.date));
    res.json(blocks);
  });

  app.post("/api/v2/schedule-blocks", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = scheduleBlockSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const block: ScheduleBlock = { id: `block-${Date.now()}`, ...parsed.data, createdAt: nowIso() };
    const created = await dataService.createOne<ScheduleBlock>(TABLES.scheduleBlocks, block, req.user!, "scheduleBlocks", req.user?.tenantId);
    res.json({ block: created });
  });

  app.delete("/api/v2/schedule-blocks/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.scheduleBlocks, req.params.id, req.user!, "scheduleBlocks");
    if (!ok) return res.status(404).json({ error: "Bloqueio de agenda nao encontrado." });
    res.json({ ok: true });
  });

  // === MEDICAL TEMPLATES ===
  app.get("/api/v2/medical-templates", requireAuth, async (req, res) => {
    const data = await loadData();
    const specialty = String(req.query.specialty || "");
    const templateType = String(req.query.templateType || "");
    const templates = data.medicalTemplates.filter(t =>
      (!specialty || t.specialty === specialty) &&
      (!templateType || t.templateType === templateType)
    );
    res.json(templates);
  });

  app.post("/api/v2/medical-templates", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const parsed = medicalTemplateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const template: MedicalTemplate = { id: `tmpl-${Date.now()}`, ...parsed.data, createdAt: nowIso() };
    const created = await dataService.createOne<MedicalTemplate>(TABLES.medicalTemplates, template, req.user!, "medicalTemplates", req.user?.tenantId);
    res.json({ template: created });
  });

  app.put("/api/v2/medical-templates/:id", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const updated = await dataService.updateOne<MedicalTemplate>(TABLES.medicalTemplates, req.params.id, req.body as Partial<MedicalTemplate>, req.user!, "medicalTemplates");
    if (!updated) return res.status(404).json({ error: "Template nao encontrado." });
    res.json({ template: updated });
  });

  app.delete("/api/v2/medical-templates/:id", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.medicalTemplates, req.params.id, req.user!, "medicalTemplates");
    if (!ok) return res.status(404).json({ error: "Template nao encontrado." });
    res.json({ ok: true });
  });

  // === PRESCRIPTIONS ===
  app.post("/api/v2/prescriptions/generate", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const { patientName, doctorName, doctorCrm, medications, notes, diagnosis } = req.body || {};
    if (!patientName || !doctorName || !medications?.length) {
      return res.status(400).json({ error: "Paciente, medico e medicamentos obrigatorios." });
    }
    const prescription = { id: `rx-${Date.now()}`, patientName, doctorName, doctorCrm: doctorCrm || "", diagnosis: diagnosis || "", medications: medications as string[], notes: notes || "", issuedAt: nowIso() };
    const data = await loadData();
    const patient = data.patients.find(p => p.fullName.toUpperCase() === patientName.toUpperCase());
    if (patient && data.medicalRecords[patient.id]) {
      const record = data.medicalRecords[patient.id];
      record.entries.unshift({
        id: `e-${Date.now()}`, date: nowIso().split("T")[0], doctorName,
        notes: `Prescricao digital: ${medications.join(", ")}. ${notes}`, diagnosis,
        prescription: medications.join("; "), isDigitalPrescription: true, doctorCrm
      });
    }
    await audit(data, req.user!, "generate_prescription", "prescription", prescription.id, `${patientName} - ${doctorName}`);
    await saveData(data);
    res.json({ prescription });
  });

  // === MEDICAL RECORD ENTRIES (V2) ===
  app.post("/api/v2/medical-records/:patientId/entries", requireAuth, requireRoles("admin", "doctor"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const record = data.medicalRecords[req.params.patientId];
    const patient = data.patients.find(p => p.id === req.params.patientId);
    if (!record || !patient) return res.status(404).json({ error: "Paciente ou prontuario nao encontrado." });
    const entry = req.body;
    if (!entry?.notes) return res.status(400).json({ error: "Evolucao clinica obrigatoria." });
    const newEntry = { ...entry, id: `e-${Date.now()}`, date: entry.date || nowIso().split("T")[0], attachments: entry.attachments || [], isDigitalPrescription: entry.isDigitalPrescription || false, doctorCrm: entry.doctorCrm || "" };
    record.entries.unshift(newEntry);
    data.appointments = data.appointments.map(a =>
      a.patientName.toUpperCase() === patient.fullName.toUpperCase() && a.date === newEntry.date
        ? { ...a, recordStatus: "incluso", status: "atendido" } : a
    );
    await audit(data, req.user!, "create_entry", "medical_record", req.params.patientId, newEntry.doctorName);
    await saveData(data);
    res.json({ entry: newEntry, medicalRecord: record, appointments: data.appointments });
  });

  // === ACCOUNTS PAYABLE ===
  app.get("/api/v2/accounts-payable", requireAuth, async (req, res) => {
    const data = await loadData();
    const status = String(req.query.status || "");
    const items = data.accountsPayable.filter(a => !status || a.status === status).sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    res.json(items);
  });

  app.post("/api/v2/accounts-payable", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const parsed = accountsPayableSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const item: AccountsPayable = { id: `ap-${Date.now()}`, ...parsed.data, status: "pending", createdAt: nowIso() };
    const created = await dataService.createOne<AccountsPayable>(TABLES.accountsPayable, item, req.user!, "accountsPayable", req.user?.tenantId);
    res.json({ item: created });
  });

  app.patch("/api/v2/accounts-payable/:id", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.accountsPayable.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Conta a pagar nao encontrada." });
    const updateFields: Partial<AccountsPayable> = { ...req.body };
    if (req.body.status === "paid") updateFields.paidAt = nowIso();
    const updated = await dataService.updateOne<AccountsPayable>(TABLES.accountsPayable, req.params.id, updateFields, req.user!, "accountsPayable");
    await audit(data, req.user!, "update", "accounts_payable", req.params.id, updateFields.status || data.accountsPayable[idx].status);
    res.json({ item: updated || data.accountsPayable[idx] });
  });

  app.delete("/api/v2/accounts-payable/:id", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const ok = await dataService.deleteOne(TABLES.accountsPayable, req.params.id, req.user!, "accountsPayable");
    if (!ok) return res.status(404).json({ error: "Conta a pagar nao encontrada." });
    res.json({ ok: true });
  });

  // === DRE ===
  app.get("/api/v2/dre", requireAuth, requireRoles("admin", "finance"), async (req, res) => {
    const data = await loadData();
    const month = String(req.query.month || nowIso().slice(0, 7));
    const transactions = data.financeTransactions.filter(t => t.date.startsWith(month));
    const payables = data.accountsPayable.filter(a => a.dueDate.startsWith(month));
    const revenueBySource: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};
    let revenue = 0, expenses = 0;
    for (const tx of transactions) {
      if (tx.type === "receita") { revenue += tx.value; revenueBySource[tx.category] = (revenueBySource[tx.category] || 0) + tx.value; }
      else { expenses += tx.value; expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.value; }
    }
    for (const ap of payables) {
      if (ap.status === "paid" || ap.status === "overdue") { expenses += ap.value; expensesByCategory[ap.category] = (expensesByCategory[ap.category] || 0) + ap.value; }
    }
    res.json({ month, revenue, expenses, netResult: revenue - expenses, revenueBySource, expensesByCategory } satisfies DreEntry);
  });

  // === PAYMENT GATEWAY ===
  app.get("/api/v2/payment-gateway", requireAuth, requireRoles("admin", "finance"), async (_req, res) => {
    const data = await loadData();
    const decryptedConfig = data.paymentGatewayConfig.map(cfg => ({ ...cfg, apiKey: ensureDecrypted(cfg.apiKey), secretKey: cfg.secretKey ? ensureDecrypted(cfg.secretKey) : undefined, webhookSecret: cfg.webhookSecret ? ensureDecrypted(cfg.webhookSecret) : undefined }));
    res.json(decryptedConfig);
  });

  app.post("/api/v2/payment-gateway", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const parsed = paymentGatewaySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const config: PaymentGatewayConfig = { ...parsed.data, enabled: true, apiKey: ensureEncrypted(parsed.data.apiKey), secretKey: parsed.data.secretKey ? ensureEncrypted(parsed.data.secretKey) : undefined, webhookSecret: parsed.data.webhookSecret ? ensureEncrypted(parsed.data.webhookSecret) : undefined };
    const data = await loadData();
    const existing = data.paymentGatewayConfig.findIndex(g => g.provider === config.provider);
    if (existing >= 0) { data.paymentGatewayConfig[existing] = config; } else { data.paymentGatewayConfig.push(config); }
    await audit(data, req.user!, "configure", "payment_gateway", config.provider, `${config.provider} ${config.enabled ? "ativado" : "desativado"}`);
    await saveData(data);
    res.json({ config: { ...config, apiKey: ensureDecrypted(config.apiKey), secretKey: config.secretKey ? ensureDecrypted(config.secretKey) : undefined, webhookSecret: config.webhookSecret ? ensureDecrypted(config.webhookSecret) : undefined } });
  });

  app.patch("/api/v2/payment-gateway/:provider", requireAuth, requireRoles("admin", "finance"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.paymentGatewayConfig.findIndex(g => g.provider === req.params.provider);
    if (idx === -1) return res.status(404).json({ error: "Gateway nao encontrado." });
    const updateData = { ...req.body };
    if (updateData.apiKey) updateData.apiKey = ensureEncrypted(updateData.apiKey);
    if (updateData.secretKey) updateData.secretKey = ensureEncrypted(updateData.secretKey);
    if (updateData.webhookSecret) updateData.webhookSecret = ensureEncrypted(updateData.webhookSecret);
    data.paymentGatewayConfig[idx] = { ...data.paymentGatewayConfig[idx], ...updateData };
    await audit(data, req.user!, "update", "payment_gateway", req.params.provider, data.paymentGatewayConfig[idx].enabled ? "ativado" : "desativado");
    await saveData(data);
    const cfg = data.paymentGatewayConfig[idx];
    res.json({ config: { ...cfg, apiKey: ensureDecrypted(cfg.apiKey), secretKey: cfg.secretKey ? ensureDecrypted(cfg.secretKey) : undefined, webhookSecret: cfg.webhookSecret ? ensureDecrypted(cfg.webhookSecret) : undefined } });
  });

  app.delete("/api/v2/payment-gateway/:provider", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.paymentGatewayConfig.findIndex(g => g.provider === req.params.provider);
    if (idx === -1) return res.status(404).json({ error: "Gateway nao encontrado." });
    data.paymentGatewayConfig.splice(idx, 1);
    await audit(data, req.user!, "delete", "payment_gateway", req.params.provider, "Gateway removido");
    await saveData(data);
    res.json({ ok: true });
  });

  // === PIX SIMULATION ===
  app.post("/api/v2/payments/pix", requireAuth, requireRoles("admin", "finance", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { appointmentId, value } = req.body || {};
    if (!appointmentId || !value) return res.status(400).json({ error: "Agendamento e valor obrigatorios." });
    const apt = data.appointments.find(a => a.id === appointmentId);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    const pixConfig = data.paymentGatewayConfig.find(g => g.provider === "pix");
    const payment = { id: `pix-${Date.now()}`, appointmentId, patientName: apt.patientName, value: Number(value), pixKey: pixConfig?.pixKey || "cliente@pix.key", status: "pending" as const, qrCode: `pix-simulado-${Date.now()}`, createdAt: nowIso() };
    apt.paymentStatus = "paid";
    await audit(data, req.user!, "create_pix", "payment", payment.id, `${apt.patientName} R$ ${value}`);
    await saveData(data);
    res.json({ payment });
  });

  // === EXPORT CSV/XLSX ===
  app.get("/api/v2/export/:entity", requireAuth, async (req, res) => {
    const data = await loadData();
    const entity = req.params.entity;
    const format = String(req.query.format || "csv");
    let rows: Record<string, unknown>[] = [];
    let headers: string[] = [];
    switch (entity) {
      case "patients": headers = ["id", "fullName", "birthDate", "cpf", "phone", "email", "healthPlan"]; rows = data.patients as unknown as Record<string, unknown>[]; break;
      case "appointments": headers = ["id", "doctorId", "date", "timeStart", "timeEnd", "patientName", "status", "type", "paymentStatus"]; rows = data.appointments as unknown as Record<string, unknown>[]; break;
      case "finance": headers = ["id", "date", "description", "value", "category", "type", "status"]; rows = data.financeTransactions as unknown as Record<string, unknown>[]; break;
      case "accounts-payable": headers = ["id", "description", "value", "category", "dueDate", "status", "supplier"]; rows = data.accountsPayable as unknown as Record<string, unknown>[]; break;
      case "waiting-list": headers = ["id", "patientName", "doctorId", "preferredDate", "preferredTime", "procedure", "status"]; rows = data.waitingList as unknown as Record<string, unknown>[]; break;
      case "inventory": headers = ["id", "name", "category", "quantity", "minQuantity", "unit", "supplier"]; rows = data.inventoryItems as unknown as Record<string, unknown>[]; break;
      default: return res.status(404).json({ error: "Entidade nao suportada para exportacao." });
    }
    if (format === "csv") {
      const csvHeader = headers.join(",");
      const csvRows = rows.map(row => headers.map(h => { const val = String((row as any)[h] ?? ""); return val.includes(",") || val.includes("\"") || val.includes("\n") ? `"${val.replace(/"/g, "\"\"")}"` : val; }).join(","));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${entity}-${nowIso().split("T")[0]}.csv"`);
      res.send("\ufeff" + csvHeader + "\n" + csvRows.join("\n"));
    } else if (format === "excel" || format === "xlsx") {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(entity);
      sheet.columns = headers.map(h => ({ header: h, key: h, width: 20 }));
      rows.forEach(row => sheet.addRow(row));
      const buffer = await workbook.xlsx.writeBuffer();
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename="${entity}-${nowIso().split("T")[0]}.xlsx"`);
      res.send(Buffer.from(buffer));
    } else {
      res.status(400).json({ error: "Formato deve ser csv ou xlsx." });
    }
  });

  // === WHATSAPP CONFIRMATION / REMINDER ===
  app.post("/api/v2/appointments/:id/send-confirmation", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    const patient = data.patients.find(p => p.fullName.toUpperCase() === apt.patientName.toUpperCase());
    const doctorName = data.doctors.find(d => d.id === apt.doctorId)?.name || "nossa equipe";
    const message = `Ola ${apt.patientName}, sua consulta esta confirmada para ${apt.date} as ${apt.timeStart} com o Dr(a). ${doctorName}.`;
    if (patient?.phone) {
      try {
        const { callWhatsmeowBridge } = await import("../whatsapp-utils");
        if (process.env.WHATSMEOW_API_URL) {
          await callWhatsmeowBridge("/messages/send", { method: "POST", body: JSON.stringify({ to: patient.phone.replace(/\D/g, ""), text: message }) });
        }
      } catch { }
    }
    const updated = await dataService.updateAppointment(req.params.id, { status: "confirmado" } as any, req.user!);
    await audit(data, req.user!, "send_confirmation", "appointment", apt.id, `${apt.patientName} - ${message}`);
    res.json({ appointment: updated || { ...apt, status: "confirmado" }, message });
  });

  app.post("/api/v2/appointments/:id/send-reminder", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    const patient = data.patients.find(p => p.fullName.toUpperCase() === apt.patientName.toUpperCase());
    const message = `Lembrete: ${apt.patientName}, voce tem consulta amanha (${apt.date}) as ${apt.timeStart}. Confirme sua presenca!`;
    if (patient?.phone) {
      try {
        const { callWhatsmeowBridge } = await import("../whatsapp-utils");
        if (process.env.WHATSMEOW_API_URL) {
          await callWhatsmeowBridge("/messages/send", { method: "POST", body: JSON.stringify({ to: patient.phone.replace(/\D/g, ""), text: message }) });
        }
      } catch { }
    }
    const updated = await dataService.updateAppointment(req.params.id, { status: apt.status } as any, req.user!);
    await audit(data, req.user!, "send_reminder", "appointment", apt.id, `${apt.patientName} - Lembrete enviado`);
    res.json({ appointment: updated || apt, message });
  });
}
