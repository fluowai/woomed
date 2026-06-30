import { NextFunction, Response } from "express";
import { loadData } from "./data";
import { mergeDefaultPlans } from "./saas-defaults";
import { AuthedRequest } from "./middleware";

export function resolveTenantPlan(data: Awaited<ReturnType<typeof loadData>>, tenantId?: string) {
  if (!tenantId) return undefined;
  const tenant = data.tenants.find(item => item.id === tenantId);
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

export async function requireLimit(entity: "users" | "patients" | "doctors", req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.tenantId) return next();
  const data = await loadData();
  const plan = resolveTenantPlan(data, req.user.tenantId);
  const limit = Number(plan?.limits?.[entity] || 0);
  if (!limit) return next();
  const count = entity === "users"
    ? data.users.filter(user => user.tenantId === req.user!.tenantId).length
    : entity === "patients"
      ? data.patients.filter(patient => (patient as any).tenantId === req.user!.tenantId).length
      : data.doctors.filter(doctor => (doctor as any).tenantId === req.user!.tenantId).length;
  if (count >= limit) {
    return res.status(402).json({ error: "Limite do plano atingido.", code: "PLAN_LIMIT_REACHED", entity, limit });
  }
  next();
}

export function limitGuard(entity: "users" | "patients" | "doctors") {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    requireLimit(entity, req, res, next).catch(next);
  };
}
