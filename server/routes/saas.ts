import { randomUUID } from "crypto";
import { Express } from "express";
import { loadData, saveData } from "../data";
import { AuthedRequest, requireAuth, requireRoles } from "../middleware";
import { audit, nowIso, sanitizeUpdate } from "../helpers";
import { Tenant, SaaSPlan, PlatformOwner } from "../../src/types";
import { generateTokens } from "../auth";
import { buildState } from "./index";

export function registerSaaSRoutes(app: Express) {

  // ==================== TENANTS ====================

  app.get("/api/v2/saas/tenants", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    res.json({ tenants: data.tenants.sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
  });

  app.post("/api/v2/saas/tenants", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const { slug, legalName, tradeName, document, ownerName, ownerEmail, phone, planId } = req.body || {};
    if (!slug || !legalName) return res.status(400).json({ error: "slug e legalName sao obrigatorios." });
    if (data.tenants.find(t => t.slug === slug)) return res.status(409).json({ error: "Ja existe um tenant com este slug." });
    const now = nowIso();
    const tenant: Tenant = {
      id: `tenant-${Date.now()}`,
      slug: String(slug).trim().toLowerCase(),
      legalName: String(legalName).trim(),
      tradeName: String(tradeName || legalName).trim(),
      document: document || undefined,
      ownerName: ownerName || undefined,
      ownerEmail: ownerEmail || undefined,
      phone: phone || undefined,
      status: "trialing",
      planId: planId || undefined,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      settings: {},
      trialEndsAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
      createdAt: now,
      updatedAt: now
    };
    data.tenants.unshift(tenant);
    await audit(data, req.user!, "create", "saas_tenant", tenant.id, `${tenant.tradeName} (${tenant.slug})`);
    await saveData(data);
    res.json({ tenant });
  });

  app.patch("/api/v2/saas/tenants/:id", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const idx = data.tenants.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Tenant nao encontrado." });
    const allowedFields: (keyof Tenant)[] = ["legalName", "tradeName", "document", "ownerName", "ownerEmail", "phone", "status", "planId", "timezone", "locale", "settings", "trialEndsAt"];
    const sanitized = sanitizeUpdate<Tenant>(req.body, allowedFields);
    const updated: Tenant = { ...data.tenants[idx], ...sanitized, id: data.tenants[idx].id, updatedAt: nowIso() };
    data.tenants[idx] = updated;
    await audit(data, req.user!, "update", "saas_tenant", updated.id, req.body.status ? `Status: ${sanitized.status}` : updated.tradeName);
    await saveData(data);
    res.json({ tenant: updated });
  });

  app.delete("/api/v2/saas/tenants/:id", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const idx = data.tenants.findIndex(t => t.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Tenant nao encontrado." });
    const removed = data.tenants.splice(idx, 1)[0];
    await audit(data, req.user!, "delete", "saas_tenant", removed.id, removed.tradeName);
    await saveData(data);
    res.json({ ok: true });
  });

  app.post("/api/v2/saas/tenants/:id/access", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const tenant = data.tenants.find(t => t.id === req.params.id);
    if (!tenant) return res.status(404).json({ error: "Tenant nao encontrado." });
    if (tenant.status === "suspended" || tenant.status === "cancelled") {
      return res.status(400).json({ error: "Clinica suspensa ou cancelada." });
    }

    const user = {
      id: req.user!.id,
      name: `${req.user!.name} em ${tenant.tradeName}`,
      role: "admin" as const,
      tenantId: tenant.id,
    };
    const tokens = generateTokens(user);
    await audit(data, req.user!, "access", "saas_tenant", tenant.id, `Acesso ao painel da clinica ${tenant.tradeName}`);
    await saveData(data);
    res.json({ ...tokens, user, state: buildState(data, user), tenant });
  });

  // ==================== PLANS ====================

  app.get("/api/v2/saas/plans", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    res.json({ plans: data.plans.sort((a, b) => a.sortOrder - b.sortOrder) });
  });

  app.post("/api/v2/saas/plans", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const { code, name, description, priceCents, currency, billingInterval, limits, features } = req.body || {};
    if (!code || !name) return res.status(400).json({ error: "code e name sao obrigatorios." });
    if (data.plans.find(p => p.code === code)) return res.status(409).json({ error: "Ja existe um plano com este codigo." });
    const now = nowIso();
    const maxOrder = Math.max(...data.plans.map(p => p.sortOrder), 0);
    const plan: SaaSPlan = {
      id: `plan-${Date.now()}`,
      code: String(code).trim().toUpperCase(),
      name: String(name).trim(),
      description: String(description || "").trim(),
      priceCents: Number(priceCents) || 0,
      currency: String(currency || "BRL"),
      billingInterval: billingInterval || "month",
      limits: limits || { users: 1, patients: 100 },
      features: features || {},
      isActive: true,
      sortOrder: maxOrder + 1,
      createdAt: now,
      updatedAt: now
    };
    data.plans.push(plan);
    await audit(data, req.user!, "create", "saas_plan", plan.id, `${plan.name} (${plan.code})`);
    await saveData(data);
    res.json({ plan });
  });

  app.patch("/api/v2/saas/plans/:id", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const idx = data.plans.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Plano nao encontrado." });
    const allowedFields: (keyof SaaSPlan)[] = ["code", "name", "description", "priceCents", "currency", "billingInterval", "limits", "features", "isActive", "sortOrder"];
    const sanitized = sanitizeUpdate<SaaSPlan>(req.body, allowedFields);
    const updated: SaaSPlan = { ...data.plans[idx], ...sanitized, id: data.plans[idx].id, updatedAt: nowIso() };
    data.plans[idx] = updated;
    await audit(data, req.user!, "update", "saas_plan", updated.id, updated.name);
    await saveData(data);
    res.json({ plan: updated });
  });

  app.delete("/api/v2/saas/plans/:id", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const idx = data.plans.findIndex(p => p.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: "Plano nao encontrado." });
    const removed = data.plans.splice(idx, 1)[0];
    data.tenants = data.tenants.map(t => t.planId === removed.id ? { ...t, planId: undefined } : t);
    await audit(data, req.user!, "delete", "saas_plan", removed.id, removed.name);
    await saveData(data);
    res.json({ ok: true });
  });

  // ==================== DASHBOARD STATS ====================

  app.get("/api/v2/saas/stats", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    const data = await loadData(req.user?.tenantId);
    const activeTenants = data.tenants.filter(t => t.status === "active");
    const trialingTenants = data.tenants.filter(t => t.status === "trialing");
    const totalMRR = data.plans.reduce((sum, plan) => {
      const count = activeTenants.filter(t => t.planId === plan.id).length;
      return sum + (plan.priceCents * count);
    }, 0);
    res.json({
      stats: {
        totalTenants: data.tenants.length,
        activeTenants: activeTenants.length,
        trialingTenants: trialingTenants.length,
        totalPlans: data.plans.length,
        totalMRR,
        currency: "BRL"
      },
      recentActivity: [
        { title: "Total de Clinicas", desc: `${data.tenants.length} clinicas cadastradas na plataforma`, time: nowIso() },
        { title: "Receita Recorrente", desc: `MRR de R$ ${(totalMRR / 100).toFixed(2)}`, time: nowIso() },
        { title: "Em Trial", desc: `${trialingTenants.length} clinicas em periodo de trial`, time: nowIso() }
      ]
    });
  });
}
