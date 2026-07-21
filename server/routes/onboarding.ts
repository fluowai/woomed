import { randomUUID } from "crypto";
import { Express } from "express";
import { loadData, saveData } from "../data";
import { generateTokens, hashPassword, validatePassword } from "../auth";
import { ensureCoreAuthSchema, isDatabaseAvailable, isSupabaseRestAvailable, query, queryOne, supabaseRestFindOne, supabaseRestInsert } from "../database";
import { nowIso } from "../helpers";
import { mergeDefaultPlans } from "../saas-defaults";
import { AppUser, Tenant } from "../../src/types";

function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function publicUser(user: AppUser) {
  return { id: user.id, name: user.name, role: user.role, specialty: user.specialty, tenantId: user.tenantId };
}

export function registerOnboardingRoutes(app: Express) {
  app.get("/api/v2/onboarding/plans", async (_req, res) => {
    const data = await loadData(req.user?.tenantId);
    const plans = mergeDefaultPlans(data.plans).filter(plan => plan.isActive);
    res.json({ plans });
  });

  app.post("/api/v2/onboarding/clinic", async (req, res) => {
    const data = await loadData(req.user?.tenantId);
    data.plans = mergeDefaultPlans(data.plans);

    const {
      clinicName,
      legalName,
      document,
      phone,
      ownerName,
      ownerEmail,
      password,
      planId,
      slug
    } = req.body || {};

    if (!clinicName || !ownerName || !ownerEmail || !password) {
      return res.status(400).json({ error: "Clinica, responsavel, email e senha sao obrigatorios." });
    }

    const passwordError = validatePassword(String(password));
    if (passwordError) return res.status(400).json({ error: passwordError });

    const normalizedEmail = String(ownerEmail).trim().toLowerCase();
    if (isDatabaseAvailable()) {
      await ensureCoreAuthSchema();
    }
    if (data.users.some(user => user.email?.toLowerCase() === normalizedEmail)) {
      return res.status(409).json({ error: "Ja existe um usuario com este email." });
    }
    if (isDatabaseAvailable()) {
      const existingDbUser = await queryOne<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [normalizedEmail]);
      if (existingDbUser) return res.status(409).json({ error: "Ja existe um usuario com este email." });
    } else if (isSupabaseRestAvailable()) {
      const existingRestUser = await supabaseRestFindOne<{ id: string }>("users", `select=id&email=eq.${encodeURIComponent(normalizedEmail)}`);
      if (existingRestUser) return res.status(409).json({ error: "Ja existe um usuario com este email." });
    }

    const baseSlug = slugify(String(slug || clinicName));
    if (!baseSlug) return res.status(400).json({ error: "Informe um nome de clinica valido." });
    if (data.tenants.some(tenant => tenant.slug.toLowerCase() === baseSlug)) {
      return res.status(409).json({ error: "Ja existe uma clinica com este subdominio." });
    }
    if (isDatabaseAvailable()) {
      const existingDbTenant = await queryOne<{ id: string }>("SELECT id FROM tenants WHERE LOWER(slug) = LOWER($1)", [baseSlug]);
      if (existingDbTenant) return res.status(409).json({ error: "Ja existe uma clinica com este subdominio." });
    } else if (isSupabaseRestAvailable()) {
      const existingRestTenant = await supabaseRestFindOne<{ id: string }>("tenants", `select=id&slug=eq.${encodeURIComponent(baseSlug)}`);
      if (existingRestTenant) return res.status(409).json({ error: "Ja existe uma clinica com este subdominio." });
    }

    const selectedPlan = planId ? data.plans.find(plan => plan.id === planId && plan.isActive) : data.plans.find(plan => plan.code === "STARTER");
    if (planId && !selectedPlan) return res.status(400).json({ error: "Plano selecionado nao encontrado." });

    const now = nowIso();
    const tenantId = randomUUID();
    const userId = randomUUID();
    const passwordHash = hashPassword(String(password));
    const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

    const tenant: Tenant = {
      id: tenantId,
      slug: baseSlug,
      legalName: String(legalName || clinicName).trim(),
      tradeName: String(clinicName).trim(),
      document: document ? String(document).trim() : undefined,
      ownerName: String(ownerName).trim(),
      ownerEmail: normalizedEmail,
      phone: phone ? String(phone).trim() : undefined,
      status: "trialing",
      planId: selectedPlan?.id,
      timezone: "America/Sao_Paulo",
      locale: "pt-BR",
      settings: { onboardingCompletedAt: now },
      trialEndsAt,
      createdAt: now,
      updatedAt: now
    };

    const appUser: AppUser & { email: string; passwordHash: string; pin: string; isActive: boolean } = {
      id: userId,
      tenantId,
      name: String(ownerName).trim(),
      email: normalizedEmail,
      role: "admin",
      pin: "",
      passwordHash,
      isActive: true
    };

    if (isDatabaseAvailable()) {
      try {
        await query(
          `INSERT INTO tenants (id, slug, legal_name, trade_name, document, owner_email, phone, status, plan_id, timezone, locale, settings, trial_ends_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, 'trialing', $8, 'America/Sao_Paulo', 'pt-BR', $9, $10)`,
          [
            tenant.id,
            tenant.slug,
            tenant.legalName,
            tenant.tradeName,
            tenant.document || null,
            tenant.ownerEmail || null,
            tenant.phone || null,
            tenant.planId || null,
            JSON.stringify(tenant.settings),
            tenant.trialEndsAt || null
          ]
        );
        await query(
          `INSERT INTO users (id, tenant_id, email, name, password_hash, role, specialty, is_active)
           VALUES ($1, $2, $3, $4, $5, 'admin', NULL, TRUE)`,
          [appUser.id, tenant.id, appUser.email, appUser.name, passwordHash]
        );
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Erro desconhecido";
        return res.status(500).json({ error: `Nao foi possivel criar a clinica no banco de dados: ${detail}` });
      }
    } else if (isSupabaseRestAvailable()) {
      try {
        await supabaseRestInsert("tenants", {
          id: tenant.id,
          slug: tenant.slug,
          legal_name: tenant.legalName,
          trade_name: tenant.tradeName,
          document: tenant.document || null,
          owner_email: tenant.ownerEmail || null,
          phone: tenant.phone || null,
          status: "trialing",
          plan_id: tenant.planId || null,
          timezone: "America/Sao_Paulo",
          locale: "pt-BR",
          settings: tenant.settings,
          trial_ends_at: tenant.trialEndsAt || null
        });
        await supabaseRestInsert("users", {
          id: appUser.id,
          tenant_id: tenant.id,
          email: appUser.email,
          name: appUser.name,
          password_hash: passwordHash,
          role: "admin",
          specialty: null,
          is_active: true,
          mfa_enabled: false
        });
      } catch (error) {
        const detail = error instanceof Error ? error.message : "Erro desconhecido";
        return res.status(500).json({ error: `Nao foi possivel criar a clinica no Supabase REST: ${detail}` });
      }
    }

    data.tenants.unshift(tenant);
    data.users.push(appUser);
    data.auditEvents.push({
      id: randomUUID(),
      createdAt: now,
      actorId: userId,
      actorName: appUser.name,
      action: "clinic_onboarding",
      entity: "tenant",
      entityId: tenant.id,
      details: `${tenant.tradeName} (${tenant.slug})`
    });

    await saveData(data);

    const user = publicUser(appUser);
    const tokens = generateTokens(user);
    res.json({
      ...tokens,
      user,
      tenant,
      state: {
        user,
        patients: [],
        doctors: [],
        appointments: [],
        medicalRecords: {},
        financeTransactions: [],
        servicePrices: data.servicePrices,
        auditEvents: [],
        serviceAgents: [],
        marketingCampaigns: [],
        tissGuides: [],
        inventoryItems: [],
        referrals: [],
        references: [],
        helpTickets: [],
        llmProviderConfigs: data.llmProviderConfigs,
        agentTemplates: data.agentTemplates,
        neuralKnowledge: data.neuralKnowledge,
        patientDocuments: [],
        waitingList: [],
        scheduleBlocks: [],
        medicalTemplates: [],
        accountsPayable: [],
        paymentGatewayConfig: [],
        tenants: [],
        plans: [],
        planFeatures: selectedPlan?.features || {},
        planLimits: selectedPlan?.limits || {},
        currentPlan: selectedPlan ? { id: selectedPlan.id, code: selectedPlan.code, name: selectedPlan.name } : undefined
      }
    });
  });
}
