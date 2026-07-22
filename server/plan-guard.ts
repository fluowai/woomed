import { NextFunction, Response } from "express";
import { loadData } from "./data";
import { mergeDefaultPlans } from "./saas-defaults";
import { AuthedRequest } from "./middleware";

export function resolveTenantPlan(data: Awaited<ReturnType<typeof loadData>>, tenantId?: string) {
  if (!tenantId || !data) return undefined;
  const tenants = Array.isArray(data.tenants) ? data.tenants : [];
  const tenant = tenants.find(item => item.id === tenantId);
  const plans = mergeDefaultPlans(data.plans);
  return plans.find(plan => plan.id === tenant?.planId) || plans.find(plan => plan.code === "STARTER");
}

export async function requireFeature(feature: string, req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.tenantId) return next();
  const data = await loadData();
  const plan = resolveTenantPlan(data, req.user.tenantId);
  if (plan && plan.features?.[feature] === false) {
    return res.status(402).json({ error: "Recurso indisponivel no plano atual.", code: "PLAN_FEATURE_DISABLED", feature });
  }
  next();
}

export function featureGuard(feature: string) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    requireFeature(feature, req, res, next).catch(next);
  };
}

export type GuardEntity = "users" | "patients" | "doctors" | "agents" | "whatsapp_connections";

export async function requireLimit(entity: GuardEntity, req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.tenantId) return next();
  const data = await loadData();
  const plan = resolveTenantPlan(data, req.user.tenantId);
  const limitKey = entity;
  const limit = Number(plan?.limits?.[limitKey] || 0);
  if (!limit) return next();
  
  const users = Array.isArray(data?.users) ? data.users : [];
  const patients = Array.isArray(data?.patients) ? data.patients : [];
  const doctors = Array.isArray(data?.doctors) ? data.doctors : [];
  const serviceAgents = Array.isArray(data?.serviceAgents) ? data.serviceAgents : [];
  const whatsappConnections = Array.isArray(data?.whatsappConnections) ? data.whatsappConnections : [];

  let count = 0;
  if (entity === "users") {
    count = users.filter(user => user.tenantId === req.user!.tenantId).length;
  } else if (entity === "patients") {
    count = patients.filter(patient => (patient as any).tenantId === req.user!.tenantId).length;
  } else if (entity === "doctors") {
    count = doctors.filter(doctor => (doctor as any).tenantId === req.user!.tenantId).length;
  } else if (entity === "agents") {
    count = serviceAgents.filter(agent => (agent as any).tenantId === req.user!.tenantId).length;
  } else if (entity === "whatsapp_connections") {
    count = whatsappConnections.filter(conn => (conn as any).tenantId === req.user!.tenantId).length;
  }

  if (count >= limit) {
    const labels: Record<GuardEntity, string> = {
      users: "usuários de sistema",
      patients: "pacientes",
      doctors: "médicos/profissionais",
      agents: "agentes de IA",
      whatsapp_connections: "conexões de WhatsApp"
    };
    return res.status(402).json({
      error: `Limite do plano atingido para ${labels[entity] || entity}. (Limite: ${limit})`,
      code: "PLAN_LIMIT_REACHED",
      entity,
      limit,
      current: count
    });
  }
  next();
}

export function limitGuard(entity: GuardEntity) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    requireLimit(entity, req, res, next).catch(next);
  };
}
