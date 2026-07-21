import { randomUUID } from "crypto";
import { Express } from "express";
import { z } from "zod";
import { loadData, saveData } from "../data";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { audit, nowIso } from "../helpers";
import { dataService, TABLES } from "../data-service";
import { featureGuard } from "../plan-guard";
import {
  LeadSource, CrmPipeline, CrmLead, CrmOpportunity, CrmInteraction, CrmTask
} from "../../src/types";

const leadSourceSchema = z.object({
  name: z.string().min(2),
  channel: z.enum(["whatsapp","instagram","facebook","site","google_ads","meta_ads","indicacao","email","telefone","presencial","outro"]).default("outro"),
  isActive: z.boolean().default(true)
});

const pipelineSchema = z.object({
  name: z.string().min(2),
  description: z.string().default(""),
  stages: z.array(z.object({ name: z.string(), order: z.number(), probability: z.number() })).default([]),
  isDefault: z.boolean().default(false),
  isActive: z.boolean().default(true)
});

const leadSchema = z.object({
  fullName: z.string().min(2),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().min(8),
  source: z.enum(["whatsapp","instagram","facebook","site","google_ads","meta_ads","indicacao","email","telefone","presencial","outro"]).default("outro"),
  rating: z.enum(["frio","morno","quente"]).default("morno"),
  tags: z.array(z.string()).default([]),
  notes: z.string().optional(),
  estimatedValue: z.number().default(0),
  assignedTo: z.string().optional(),
  pipelineId: z.string().optional(),
  sourceId: z.string().optional(),
  campaignId: z.string().optional(),
  channelConversationId: z.string().optional()
});

const opportunitySchema = z.object({
  pipelineId: z.string().min(1),
  leadId: z.string().optional(),
  patientId: z.string().optional(),
  title: z.string().min(2),
  value: z.number().default(0),
  probability: z.number().min(0).max(100).default(0),
  expectedCloseDate: z.string().optional(),
  assignedTo: z.string().optional(),
  notes: z.string().optional(),
  stage: z.enum(["lead_qualificado","agendamento_pendente","agendado","compareceu","proposta","fechado","perdido"]).default("lead_qualificado")
});

const taskSchema = z.object({
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  title: z.string().min(2),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.enum(["low","medium","high","urgent"]).default("medium"),
  status: z.enum(["pending","in_progress","completed","cancelled"]).default("pending"),
  assignedTo: z.string().optional()
});

const interactionSchema = z.object({
  leadId: z.string().optional(),
  opportunityId: z.string().optional(),
  patientId: z.string().optional(),
  channel: z.enum(["whatsapp","instagram","facebook","site","google_ads","meta_ads","indicacao","email","telefone","presencial","outro"]).default("outro"),
  type: z.string().min(1),
  summary: z.string().min(1),
  details: z.record(z.string(), z.unknown()).default({})
});

function scopedCrm<T extends { tenantId?: string }>(items: T[], tenantId?: string): T[] {
  if (!tenantId) return items;
  return items.filter(item => !item.tenantId || item.tenantId === tenantId);
}

export function registerCrmRoutes(app: Express) {
  app.use("/api/crm", requireAuth, featureGuard("crm"));

  // ---- Lead Sources ----
  app.get("/api/crm/lead-sources", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const sources = scopedCrm(data.leadSources || [], req.user?.tenantId);
    res.json(sources);
  });

  app.post("/api/crm/lead-sources", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const parsed = leadSourceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const source: LeadSource = {
      id: randomUUID(),
      name: parsed.data.name,
      channel: parsed.data.channel,
      isActive: parsed.data.isActive,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData(req.user?.tenantId);
    if (!data.leadSources) data.leadSources = [];
    if (req.user?.tenantId) (source as any).tenantId = req.user.tenantId;
    data.leadSources.push(source);
    await saveData(data);
    res.json({ source });
  });

  app.patch("/api/crm/lead-sources/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const sources = data.leadSources || [];
    const idx = sources.findIndex((s: any) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Fonte de lead nao encontrada." });
    sources[idx] = { ...sources[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ source: sources[idx] });
  });

  app.delete("/api/crm/lead-sources/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const sources = data.leadSources || [];
    const idx = sources.findIndex((s: any) => s.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Fonte de lead nao encontrada." });
    sources.splice(idx, 1);
    await saveData(data);
    res.json({ ok: true });
  });

  // ---- Pipelines ----
  app.get("/api/crm/pipelines", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const pipelines = scopedCrm(data.crmPipelines || [], req.user?.tenantId);
    res.json(pipelines);
  });

  app.post("/api/crm/pipelines", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = pipelineSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const pipeline: CrmPipeline = {
      id: randomUUID(),
      name: parsed.data.name,
      description: parsed.data.description,
      stages: parsed.data.stages,
      isDefault: parsed.data.isDefault,
      isActive: parsed.data.isActive,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData(req.user?.tenantId);
    if (!data.crmPipelines) data.crmPipelines = [];
    if (req.user?.tenantId) (pipeline as any).tenantId = req.user.tenantId;
    if (pipeline.isDefault) data.crmPipelines = data.crmPipelines.map((p: any) => ({ ...p, isDefault: false }));
    data.crmPipelines.push(pipeline);
    await saveData(data);
    res.json({ pipeline });
  });

  app.patch("/api/crm/pipelines/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const pipelines = data.crmPipelines || [];
    const idx = pipelines.findIndex((p: any) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Pipeline nao encontrado." });
    if (req.body.isDefault) pipelines.forEach((p: any) => p.isDefault = false);
    pipelines[idx] = { ...pipelines[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ pipeline: pipelines[idx] });
  });

  app.delete("/api/crm/pipelines/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const pipelines = data.crmPipelines || [];
    const idx = pipelines.findIndex((p: any) => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Pipeline nao encontrado." });
    pipelines.splice(idx, 1);
    await saveData(data);
    res.json({ ok: true });
  });

  // ---- Leads ----
  app.get("/api/crm/leads", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    let leads = scopedCrm([...(data.crmLeads || [])], req.user?.tenantId);
    const { status, source, rating, assignedTo, search } = req.query as Record<string, string>;
    if (status) leads = leads.filter(l => l.status === status);
    if (source) leads = leads.filter(l => l.source === source);
    if (rating) leads = leads.filter(l => l.rating === rating);
    if (assignedTo) leads = leads.filter(l => l.assignedTo === assignedTo);
    if (search) {
      const s = search.toLowerCase();
      leads = leads.filter(l => l.fullName.toLowerCase().includes(s) || l.phone.includes(s) || (l.email || "").toLowerCase().includes(s));
    }
    leads.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(leads);
  });

  app.post("/api/crm/leads", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const parsed = leadSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const lead: CrmLead = {
      id: randomUUID(),
      fullName: parsed.data.fullName,
      email: parsed.data.email || undefined,
      phone: parsed.data.phone,
      normalizedPhone: parsed.data.phone.replace(/\D/g, ""),
      source: parsed.data.source,
      rating: parsed.data.rating,
      tags: parsed.data.tags,
      notes: parsed.data.notes,
      estimatedValue: parsed.data.estimatedValue,
      assignedTo: parsed.data.assignedTo,
      pipelineId: parsed.data.pipelineId,
      sourceId: parsed.data.sourceId,
      campaignId: parsed.data.campaignId,
      channelConversationId: parsed.data.channelConversationId,
      customFields: {},
      status: "new",
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData(req.user?.tenantId);
    if (!data.crmLeads) data.crmLeads = [];
    if (req.user?.tenantId) (lead as any).tenantId = req.user.tenantId;
    data.crmLeads.push(lead);
    await audit(data, req.user!, "create", "lead", lead.id, lead.fullName);
    await saveData(data);
    res.json({ lead });
  });

  app.patch("/api/crm/leads/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const leads = data.crmLeads || [];
    const idx = leads.findIndex((l: any) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Lead nao encontrado." });
    const oldStatus = leads[idx].status;
    leads[idx] = { ...leads[idx], ...req.body, updatedAt: nowIso() };
    if (oldStatus !== leads[idx].status) {
      await audit(data, req.user!, "update_status", "lead", leads[idx].id, `${oldStatus} -> ${leads[idx].status}`);
    }
    await saveData(data);
    res.json({ lead: leads[idx] });
  });

  app.delete("/api/crm/leads/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const leads = data.crmLeads || [];
    const idx = leads.findIndex((l: any) => l.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Lead nao encontrado." });
    const removed = leads.splice(idx, 1)[0];
    await audit(data, req.user!, "delete", "lead", removed.id, removed.fullName);
    await saveData(data);
    res.json({ ok: true });
  });

  app.post("/api/crm/leads/:id/convert", requireAuth, requireRoles("admin", "reception"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const leads = data.crmLeads || [];
    const leadIdx = leads.findIndex((l: any) => l.id === req.params.id);
    if (leadIdx === -1) return res.status(404).json({ error: "Lead nao encontrado." });
    const lead = leads[leadIdx];
    if (lead.convertedToPatientId) return res.status(400).json({ error: "Lead ja convertido em paciente." });
    const patient = {
      id: randomUUID(),
      fullName: lead.fullName,
      birthDate: "",
      cpf: "",
      phone: lead.phone,
      email: lead.email || "",
      avatarUrl: undefined,
      address: { street: "", city: "", state: "", zip: "" },
      lgpdConsent: false,
      lgpdConsentAt: undefined,
      consentVersion: 1,
      marketingOptIn: false,
      tags: lead.tags,
    };
    if (!data.patients) data.patients = [];
    data.patients.push(patient);
    if (!data.medicalRecords) data.medicalRecords = {};
    data.medicalRecords[patient.id] = {
      patientId: patient.id, bloodType: "Desconhecido", gender: "Nao informado",
      allergies: [], medications: [], chronicDiseases: [], entries: []
    };
    lead.convertedToPatientId = patient.id;
    lead.convertedAt = nowIso();
    lead.status = "won";
    lead.updatedAt = nowIso();
    await audit(data, req.user!, "convert_lead", "lead", lead.id, `${lead.fullName} -> paciente`);
    await saveData(data);
    res.json({ lead, patient });
  });

  // ---- Opportunities ----
  app.get("/api/crm/opportunities", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    let opps = scopedCrm([...(data.crmOpportunities || [])], req.user?.tenantId);
    const { pipelineId, stage, assignedTo } = req.query as Record<string, string>;
    if (pipelineId) opps = opps.filter(o => o.pipelineId === pipelineId);
    if (stage) opps = opps.filter(o => o.stage === stage);
    if (assignedTo) opps = opps.filter(o => o.assignedTo === assignedTo);
    opps.sort((a, b) => a.stageOrder - b.stageOrder);
    res.json(opps);
  });

  app.post("/api/crm/opportunities", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const parsed = opportunitySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const stageOrder = { lead_qualificado: 0, agendamento_pendente: 1, agendado: 2, compareceu: 3, proposta: 4, fechado: 5, perdido: 6 }[parsed.data.stage] || 0;
    const opp: CrmOpportunity = {
      id: randomUUID(),
      pipelineId: parsed.data.pipelineId,
      leadId: parsed.data.leadId,
      patientId: parsed.data.patientId,
      stage: parsed.data.stage,
      stageOrder,
      title: parsed.data.title,
      value: parsed.data.value,
      probability: parsed.data.probability,
      expectedCloseDate: parsed.data.expectedCloseDate,
      assignedTo: parsed.data.assignedTo,
      notes: parsed.data.notes,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData(req.user?.tenantId);
    if (!data.crmOpportunities) data.crmOpportunities = [];
    data.crmOpportunities.push(opp);
    await saveData(data);
    res.json({ opportunity: opp });
  });

  app.patch("/api/crm/opportunities/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const opps = data.crmOpportunities || [];
    const idx = opps.findIndex((o: any) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Oportunidade nao encontrada." });
    opps[idx] = { ...opps[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ opportunity: opps[idx] });
  });

  app.patch("/api/crm/opportunities/:id/stage", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const opps = data.crmOpportunities || [];
    const idx = opps.findIndex((o: any) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Oportunidade nao encontrada." });
    const { stage } = req.body;
    if (!stage) return res.status(400).json({ error: "Estgio obrigatorio." });
    const stageOrder = { lead_qualificado: 0, agendamento_pendente: 1, agendado: 2, compareceu: 3, proposta: 4, fechado: 5, perdido: 6 }[stage as string] || 0;
    opps[idx].stage = stage;
    opps[idx].stageOrder = stageOrder;
    opps[idx].updatedAt = nowIso();
    await audit(data, req.user!, "move_stage", "opportunity", opps[idx].id, stage);
    await saveData(data);
    res.json({ opportunity: opps[idx] });
  });

  app.delete("/api/crm/opportunities/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const opps = data.crmOpportunities || [];
    const idx = opps.findIndex((o: any) => o.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Oportunidade nao encontrada." });
    opps.splice(idx, 1);
    await saveData(data);
    res.json({ ok: true });
  });

  // ---- Interactions ----
  app.get("/api/crm/interactions", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    let interactions = scopedCrm([...(data.crmInteractions || [])], req.user?.tenantId);
    const { leadId, patientId } = req.query as Record<string, string>;
    if (leadId) interactions = interactions.filter(i => i.leadId === leadId);
    if (patientId) interactions = interactions.filter(i => i.patientId === patientId);
    interactions.sort((a, b) => new Date(b.performedAt).getTime() - new Date(a.performedAt).getTime());
    res.json(interactions);
  });

  app.post("/api/crm/interactions", requireAuth, async (req: AuthedRequest, res) => {
    const parsed = interactionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const interaction: CrmInteraction = {
      id: randomUUID(),
      leadId: parsed.data.leadId,
      opportunityId: parsed.data.opportunityId,
      patientId: parsed.data.patientId,
      channel: parsed.data.channel,
      type: parsed.data.type,
      summary: parsed.data.summary,
      details: parsed.data.details,
      performedBy: req.user!.id,
      performedAt: nowIso(),
      createdAt: nowIso()
    };
    const data = await loadData(req.user?.tenantId);
    if (!data.crmInteractions) data.crmInteractions = [];
    data.crmInteractions.push(interaction);
    if (interaction.leadId) {
      const lead = (data.crmLeads || []).find((l: any) => l.id === interaction.leadId);
      if (lead) {
        lead.status = lead.status === "new" ? "contacted" : lead.status;
        lead.updatedAt = nowIso();
      }
    }
    await saveData(data);
    res.json({ interaction });
  });

  // ---- Tasks ----
  app.get("/api/crm/tasks", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    let tasks = scopedCrm([...(data.crmTasks || [])], req.user?.tenantId);
    const { leadId, opportunityId, assignedTo, status } = req.query as Record<string, string>;
    if (leadId) tasks = tasks.filter(t => t.leadId === leadId);
    if (opportunityId) tasks = tasks.filter(t => t.opportunityId === opportunityId);
    if (assignedTo) tasks = tasks.filter(t => t.assignedTo === assignedTo);
    if (status) tasks = tasks.filter(t => t.status === status);
    tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json(tasks);
  });

  app.post("/api/crm/tasks", requireAuth, async (req: AuthedRequest, res) => {
    const parsed = taskSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map(e => `${e.path.join(".")}: ${e.message}`).join("; ") });
    const task: CrmTask = {
      id: randomUUID(),
      leadId: parsed.data.leadId,
      opportunityId: parsed.data.opportunityId,
      title: parsed.data.title,
      description: parsed.data.description,
      dueDate: parsed.data.dueDate,
      priority: parsed.data.priority,
      status: parsed.data.status,
      assignedTo: parsed.data.assignedTo,
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    const data = await loadData(req.user?.tenantId);
    if (!data.crmTasks) data.crmTasks = [];
    data.crmTasks.push(task);
    await saveData(data);
    res.json({ task });
  });

  app.patch("/api/crm/tasks/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const tasks = data.crmTasks || [];
    const idx = tasks.findIndex((t: any) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Tarefa nao encontrada." });
    if (req.body.status === "completed" && !tasks[idx].completedAt) tasks[idx].completedAt = nowIso();
    tasks[idx] = { ...tasks[idx], ...req.body, updatedAt: nowIso() };
    await saveData(data);
    res.json({ task: tasks[idx] });
  });

  app.delete("/api/crm/tasks/:id", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const tasks = data.crmTasks || [];
    const idx = tasks.findIndex((t: any) => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Tarefa nao encontrada." });
    tasks.splice(idx, 1);
    await saveData(data);
    res.json({ ok: true });
  });
}
