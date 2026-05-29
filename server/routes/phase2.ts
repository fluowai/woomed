import { randomUUID } from "crypto";
import { Express } from "express";
import multer from "multer";
import path from "path";
import fs from "fs/promises";
import { loadData, saveData } from "../data";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { audit, nowIso } from "../helpers";
import { waitingListSchema, scheduleBlockSchema, medicalTemplateSchema, accountsPayableSchema, paymentGatewaySchema } from "../schemas";
import {
  PatientDocument, WaitingListEntry, ScheduleBlock, MedicalTemplate,
  AccountsPayable, PaymentGatewayConfig, DreEntry
} from "../../src/types";

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
  app.post("/api/v2/patients/:patientId/documents", requireAuth, requireRoles(["admin", "doctor", "reception"]), upload.single("file"), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const patient = data.patients.find(p => p.id === req.params.patientId);
    if (!patient) return res.status(404).json({ error: "Paciente nao encontrado." });
    const file = req.file;
    if (!file) return res.status(400).json({ error: "Arquivo obrigatorio." });
    const doc: PatientDocument = {
      id: `doc-${Date.now()}`,
      patientId: req.params.patientId,
      name: req.body.name || file.originalname,
      type: req.body.type || "outro",
      url: `/uploads/documents/${file.filename}`,
      uploadedAt: nowIso(),
      uploadedBy: req.user!.id,
      notes: req.body.notes || ""
    };
    data.patientDocuments.push(doc);
    audit(data, req.user!, "upload_document", "patient", req.params.patientId, doc.name);
    await saveData(data);
    res.json({ document: doc });
  });

  app.get("/api/v2/patients/:patientId/documents", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const docs = data.patientDocuments.filter(d => d.patientId === req.params.patientId);
    res.json(docs);
  });

  app.delete("/api/v2/patients/documents/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.patientDocuments.findIndex(d => d.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Documento nao encontrado." });
    const removed = data.patientDocuments.splice(idx, 1)[0];
    try {
      const filePath = path.join(process.cwd(), removed.url);
      await fs.unlink(filePath);
    } catch { }
    audit(data, req.user!, "delete_document", "patient", removed.patientId, removed.name);
    await saveData(data);
    res.json({ ok: true });
  });

  // === WAITING LIST ===
  app.get("/api/v2/waiting-list", requireAuth, async (_req, res) => {
    const data = await loadData();
    res.json(data.waitingList.sort((a, b) => a.created_at.localeCompare(b.created_at)));
  });

  app.post("/api/v2/waiting-list", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = waitingListSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    }
    const entry: WaitingListEntry = {
      id: `wl-${Date.now()}`,
      ...parsed.data,
      status: "waiting",
      created_at: nowIso()
    };
    data.waitingList.push(entry);
    audit(data, req.user!, "create", "waiting_list", entry.id, entry.patientName);
    await saveData(data);
    res.json({ entry });
  });

  app.patch("/api/v2/waiting-list/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.waitingList.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Entrada na lista de espera nao encontrada." });
    data.waitingList[idx] = { ...data.waitingList[idx], ...req.body };
    if (req.body.status === "notified") data.waitingList[idx].notifiedAt = nowIso();
    audit(data, req.user!, "update", "waiting_list", req.params.id, data.waitingList[idx].status);
    await saveData(data);
    res.json({ entry: data.waitingList[idx] });
  });

  app.delete("/api/v2/waiting-list/:id", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.waitingList.findIndex(e => e.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Entrada na lista de espera nao encontrada." });
    const removed = data.waitingList.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "waiting_list", removed.id, removed.patientName);
    await saveData(data);
    res.json({ ok: true });
  });

  app.post("/api/v2/waiting-list/:id/notify", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const entry = data.waitingList.find(e => e.id === req.params.id);
    if (!entry) return res.status(404).json({ error: "Entrada nao encontrada." });
    entry.status = "notified";
    entry.notifiedAt = nowIso();
    audit(data, req.user!, "notify", "waiting_list", entry.id, `Notificado: ${entry.patientName}`);
    await saveData(data);
    res.json({ entry });
  });

  // Auto-schedule: when an appointment is cancelled, notify the next waiting entry for that doctor
  app.post("/api/v2/waiting-list/auto-schedule", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { doctorId, cancelledDate, cancelledTime } = req.body || {};
    if (!doctorId || !cancelledDate) return res.status(400).json({ error: "Profissional e data do cancelamento obrigatorios." });
    const candidates = data.waitingList.filter(e =>
      e.doctorId === doctorId && e.status === "waiting" &&
      (!e.preferredDate || e.preferredDate <= cancelledDate)
    ).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (candidates.length === 0) return res.json({ notified: false, message: "Nenhum paciente na lista de espera para este profissional." });
    const next = candidates[0];
    next.status = "notified";
    next.notifiedAt = nowIso();
    if (cancelledTime && !next.preferredTime) next.preferredTime = cancelledTime;
    if (!next.preferredDate) next.preferredDate = cancelledDate;
    audit(data, req.user!, "auto_schedule", "waiting_list", next.id, `Auto-notificado apos cancelamento: ${next.patientName}`);
    await saveData(data);
    res.json({ notified: true, entry: next, message: `Paciente ${next.patientName} notificado sobre horario disponivel.` });
  });

  // === SCHEDULE BLOCKS ===
  app.get("/api/v2/schedule-blocks", requireAuth, async (req, res) => {
    const data = await loadData();
    const doctorId = String(req.query.doctorId || "");
    const blocks = data.scheduleBlocks.filter(b => !doctorId || b.doctorId === doctorId)
      .sort((a, b) => a.date.localeCompare(b.date));
    res.json(blocks);
  });

  app.post("/api/v2/schedule-blocks", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = scheduleBlockSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    }
    const block: ScheduleBlock = {
      id: `block-${Date.now()}`,
      ...parsed.data,
      createdAt: nowIso()
    };
    data.scheduleBlocks.push(block);
    audit(data, req.user!, "create", "schedule_block", block.id, `${block.type} ${block.date}`);
    await saveData(data);
    res.json({ block });
  });

  app.delete("/api/v2/schedule-blocks/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.scheduleBlocks.findIndex(b => b.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Bloqueio de agenda nao encontrado." });
    const removed = data.scheduleBlocks.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "schedule_block", removed.id, `${removed.type} ${removed.date}`);
    await saveData(data);
    res.json({ ok: true });
  });

  // === MEDICAL TEMPLATES / PRESCRIPTIONS ===
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

  app.post("/api/v2/medical-templates", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = medicalTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    }
    const template: MedicalTemplate = {
      id: `tmpl-${Date.now()}`,
      ...parsed.data,
      createdAt: nowIso()
    };
    data.medicalTemplates.push(template);
    audit(data, req.user!, "create", "medical_template", template.id, template.name);
    await saveData(data);
    res.json({ template });
  });

  app.put("/api/v2/medical-templates/:id", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.medicalTemplates.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Template nao encontrado." });
    data.medicalTemplates[idx] = { ...data.medicalTemplates[idx], ...req.body };
    audit(data, req.user!, "update", "medical_template", req.params.id, data.medicalTemplates[idx].name);
    await saveData(data);
    res.json({ template: data.medicalTemplates[idx] });
  });

  app.delete("/api/v2/medical-templates/:id", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.medicalTemplates.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Template nao encontrado." });
    const removed = data.medicalTemplates.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "medical_template", removed.id, removed.name);
    await saveData(data);
    res.json({ ok: true });
  });

  // Digital prescription (generate a PDF-like prescription as text)
  app.post("/api/v2/prescriptions/generate", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const { patientName, doctorName, doctorCrm, medications, notes, diagnosis } = req.body || {};
    if (!patientName || !doctorName || !medications?.length) {
      return res.status(400).json({ error: "Paciente, medico e medicamentos sao obrigatorios." });
    }
    const prescription = {
      id: `rx-${Date.now()}`,
      patientName,
      doctorName,
      doctorCrm: doctorCrm || "",
      diagnosis: diagnosis || "",
      medications: medications as string[],
      notes: notes || "",
      issuedAt: nowIso()
    };
    // Attach to medical record
    const data = await loadData();
    const patient = data.patients.find(p => p.fullName.toUpperCase() === patientName.toUpperCase());
    if (patient && data.medicalRecords[patient.id]) {
      const record = data.medicalRecords[patient.id];
      record.entries.unshift({
        id: `e-${Date.now()}`,
        date: nowIso().split("T")[0],
        doctorName,
        notes: `Prescricao digital: ${medications.join(", ")}. ${notes}`,
        diagnosis,
        prescription: medications.join("; "),
        isDigitalPrescription: true,
        doctorCrm
      });
    }
    audit(data, req.user!, "generate_prescription", "prescription", prescription.id, `${patientName} - ${doctorName}`);
    await saveData(data);
    res.json({ prescription });
  });

  // Medical record entry with attachments
  app.post("/api/v2/medical-records/:patientId/entries", requireAuth, requireRoles(["admin", "doctor"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const record = data.medicalRecords[req.params.patientId];
    const patient = data.patients.find(p => p.id === req.params.patientId);
    if (!record || !patient) return res.status(404).json({ error: "Paciente ou prontuario nao encontrado." });
    const entry = req.body;
    if (!entry?.notes) return res.status(400).json({ error: "Evolucao clinica e obrigatoria." });
    const newEntry = {
      ...entry,
      id: `e-${Date.now()}`,
      date: entry.date || nowIso().split("T")[0],
      attachments: entry.attachments || [],
      isDigitalPrescription: entry.isDigitalPrescription || false,
      doctorCrm: entry.doctorCrm || ""
    };
    record.entries.unshift(newEntry);
    data.appointments = data.appointments.map(a =>
      a.patientName.toUpperCase() === patient.fullName.toUpperCase() && a.date === newEntry.date
        ? { ...a, recordStatus: "incluso", status: "atendido" } : a
    );
    audit(data, req.user!, "create_entry", "medical_record", req.params.patientId, newEntry.doctorName);
    await saveData(data);
    res.json({ entry: newEntry, medicalRecord: record, appointments: data.appointments });
  });

  // === ACCOUNTS PAYABLE ===
  app.get("/api/v2/accounts-payable", requireAuth, async (req, res) => {
    const data = await loadData();
    const status = String(req.query.status || "");
    const items = data.accountsPayable.filter(a => !status || a.status === status)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    res.json(items);
  });

  app.post("/api/v2/accounts-payable", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = accountsPayableSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    }
    const item: AccountsPayable = {
      id: `ap-${Date.now()}`,
      ...parsed.data,
      status: "pending",
      createdAt: nowIso()
    };
    data.accountsPayable.push(item);
    audit(data, req.user!, "create", "accounts_payable", item.id, item.description);
    await saveData(data);
    res.json({ item });
  });

  app.patch("/api/v2/accounts-payable/:id", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.accountsPayable.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Conta a pagar nao encontrada." });
    data.accountsPayable[idx] = { ...data.accountsPayable[idx], ...req.body };
    if (req.body.status === "paid") data.accountsPayable[idx].paidAt = nowIso();
    audit(data, req.user!, "update", "accounts_payable", req.params.id, data.accountsPayable[idx].status);
    await saveData(data);
    res.json({ item: data.accountsPayable[idx] });
  });

  app.delete("/api/v2/accounts-payable/:id", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.accountsPayable.findIndex(a => a.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Conta a pagar nao encontrada." });
    const removed = data.accountsPayable.splice(idx, 1)[0];
    audit(data, req.user!, "delete", "accounts_payable", removed.id, removed.description);
    await saveData(data);
    res.json({ ok: true });
  });

  // === DRE (Demonstração do Resultado do Exercício) ===
  app.get("/api/v2/dre", requireAuth, requireRoles(["admin", "finance"]), async (req, res) => {
    const data = await loadData();
    const month = String(req.query.month || nowIso().slice(0, 7));
    const transactions = data.financeTransactions.filter(t => t.date.startsWith(month));
    const payables = data.accountsPayable.filter(a => a.dueDate.startsWith(month));

    const revenueBySource: Record<string, number> = {};
    const expensesByCategory: Record<string, number> = {};
    let revenue = 0;
    let expenses = 0;

    for (const tx of transactions) {
      if (tx.type === "receita") {
        revenue += tx.value;
        revenueBySource[tx.category] = (revenueBySource[tx.category] || 0) + tx.value;
      } else {
        expenses += tx.value;
        expensesByCategory[tx.category] = (expensesByCategory[tx.category] || 0) + tx.value;
      }
    }

    for (const ap of payables) {
      if (ap.status === "paid" || ap.status === "overdue") {
        expenses += ap.value;
        expensesByCategory[ap.category] = (expensesByCategory[ap.category] || 0) + ap.value;
      }
    }

    const entry: DreEntry = {
      month,
      revenue,
      expenses,
      netResult: revenue - expenses,
      revenueBySource,
      expensesByCategory
    };
    res.json(entry);
  });

  // === PAYMENT GATEWAY ===
  app.get("/api/v2/payment-gateway", requireAuth, requireRoles(["admin", "finance"]), async (_req, res) => {
    const data = await loadData();
    res.json(data.paymentGatewayConfig);
  });

  app.post("/api/v2/payment-gateway", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const parsed = paymentGatewaySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    }
    const config: PaymentGatewayConfig = {
      ...parsed.data,
      enabled: true
    };
    const existing = data.paymentGatewayConfig.findIndex(g => g.provider === config.provider);
    if (existing >= 0) {
      data.paymentGatewayConfig[existing] = config;
    } else {
      data.paymentGatewayConfig.push(config);
    }
    audit(data, req.user!, "configure", "payment_gateway", config.provider, `${config.provider} ${config.enabled ? "ativado" : "desativado"}`);
    await saveData(data);
    res.json({ config });
  });

  app.patch("/api/v2/payment-gateway/:provider", requireAuth, requireRoles(["admin", "finance"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.paymentGatewayConfig.findIndex(g => g.provider === req.params.provider);
    if (idx === -1) return res.status(404).json({ error: "Gateway nao encontrado." });
    data.paymentGatewayConfig[idx] = { ...data.paymentGatewayConfig[idx], ...req.body };
    audit(data, req.user!, "update", "payment_gateway", req.params.provider, data.paymentGatewayConfig[idx].enabled ? "ativado" : "desativado");
    await saveData(data);
    res.json({ config: data.paymentGatewayConfig[idx] });
  });

  app.delete("/api/v2/payment-gateway/:provider", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const idx = data.paymentGatewayConfig.findIndex(g => g.provider === req.params.provider);
    if (idx === -1) return res.status(404).json({ error: "Gateway nao encontrado." });
    data.paymentGatewayConfig.splice(idx, 1);
    audit(data, req.user!, "delete", "payment_gateway", req.params.provider, "Gateway removido");
    await saveData(data);
    res.json({ ok: true });
  });

  // === PIX PAYMENT SIMULATION ===
  app.post("/api/v2/payments/pix", requireAuth, requireRoles(["admin", "finance", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const { appointmentId, value } = req.body || {};
    if (!appointmentId || !value) return res.status(400).json({ error: "Agendamento e valor obrigatorios." });
    const apt = data.appointments.find(a => a.id === appointmentId);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    const pixConfig = data.paymentGatewayConfig.find(g => g.provider === "pix");
    const pixKey = pixConfig?.pixKey || "cliente@pix.key";
    const payment = {
      id: `pix-${Date.now()}`,
      appointmentId,
      patientName: apt.patientName,
      value: Number(value),
      pixKey,
      status: "pending" as const,
      qrCode: `pix-simulado-${Date.now()}`,
      createdAt: nowIso()
    };
    audit(data, req.user!, "create_pix", "payment", payment.id, `${apt.patientName} R$ ${value}`);
    // Auto-confirm after "payment"
    apt.paymentStatus = "paid";
    await saveData(data);
    res.json({ payment });
  });

  // === CSV/EXCEL EXPORT ===
  app.get("/api/v2/export/:entity", requireAuth, async (req, res) => {
    const data = await loadData();
    const entity = req.params.entity;
    const format = String(req.query.format || "csv");

    let rows: Record<string, unknown>[] = [];
    let headers: string[] = [];

    switch (entity) {
      case "patients":
        headers = ["id", "fullName", "birthDate", "cpf", "phone", "email", "healthPlan"];
        rows = data.patients as unknown as Record<string, unknown>[];
        break;
      case "appointments":
        headers = ["id", "doctorId", "date", "timeStart", "timeEnd", "patientName", "status", "type", "paymentStatus"];
        rows = data.appointments as unknown as Record<string, unknown>[];
        break;
      case "finance":
        headers = ["id", "date", "description", "value", "category", "type", "status"];
        rows = data.financeTransactions as unknown as Record<string, unknown>[];
        break;
      case "accounts-payable":
        headers = ["id", "description", "value", "category", "dueDate", "status", "supplier"];
        rows = data.accountsPayable as unknown as Record<string, unknown>[];
        break;
      case "waiting-list":
        headers = ["id", "patientName", "doctorId", "preferredDate", "preferredTime", "procedure", "status"];
        rows = data.waitingList as unknown as Record<string, unknown>[];
        break;
      case "inventory":
        headers = ["id", "name", "category", "quantity", "minQuantity", "unit", "supplier"];
        rows = data.inventoryItems as unknown as Record<string, unknown>[];
        break;
      default:
        return res.status(404).json({ error: "Entidade nao suportada para exportacao." });
    }

    if (format === "csv") {
      const csvHeader = headers.join(",");
      const csvRows = rows.map(row =>
        headers.map(h => {
          const val = String((row as any)[h] ?? "");
          return val.includes(",") || val.includes("\"") || val.includes("\n")
            ? `"${val.replace(/"/g, "\"\"")}"`
            : val;
        }).join(",")
      );
      const csv = [csvHeader, ...csvRows].join("\n");
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="${entity}-${nowIso().split("T")[0]}.csv"`);
      // BOM for Excel compatibility
      res.send("\ufeff" + csv);
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

  // === WHATSAPP AUTO CONFIRMATION / REMINDER ===
  app.post("/api/v2/appointments/:id/send-confirmation", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    const patient = data.patients.find(p =>
      p.fullName.toUpperCase() === apt.patientName.toUpperCase()
    );
    const message = `Olá ${apt.patientName}, sua consulta está confirmada para ${apt.date} às ${apt.timeStart} com o Dr(a). ${data.doctors.find(d => d.id === apt.doctorId)?.name || "nossa equipe"}.`;
    if (patient?.phone) {
      try {
        const { callWhatsmeowBridge } = await import("../whatsapp-utils");
        if (process.env.WHATSMEOW_API_URL) {
          await callWhatsmeowBridge("/messages/send", {
            method: "POST",
            body: JSON.stringify({ to: patient.phone.replace(/\D/g, ""), text: message })
          });
        }
      } catch { }
    }
    apt.status = "confirmado";
    audit(data, req.user!, "send_confirmation", "appointment", apt.id, `${apt.patientName} - ${message}`);
    await saveData(data);
    res.json({ appointment: apt, message });
  });

  app.post("/api/v2/appointments/:id/send-reminder", requireAuth, requireRoles(["admin", "reception"]), async (req: AuthedRequest, res) => {
    const data = await loadData();
    const apt = data.appointments.find(a => a.id === req.params.id);
    if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
    const patient = data.patients.find(p =>
      p.fullName.toUpperCase() === apt.patientName.toUpperCase()
    );
    const message = `Lembrete: ${apt.patientName}, você tem consulta amanhã (${apt.date}) às ${apt.timeStart}. Confirme sua presença!`;
    if (patient?.phone) {
      try {
        const { callWhatsmeowBridge } = await import("../whatsapp-utils");
        if (process.env.WHATSMEOW_API_URL) {
          await callWhatsmeowBridge("/messages/send", {
            method: "POST",
            body: JSON.stringify({ to: patient.phone.replace(/\D/g, ""), text: message })
          });
        }
      } catch { }
    }
    audit(data, req.user!, "send_reminder", "appointment", apt.id, `${apt.patientName} - Lembrete enviado`);
    await saveData(data);
    res.json({ appointment: apt, message });
  });
}
