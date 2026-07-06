import { Request, Response, NextFunction } from "express";
import { AuthedRequest } from "./middleware";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export function getTenantId(req: AuthedRequest): string {
  return req.user?.tenantId || "single-tenant";
}

// Middleware that ensures tenant context is available on every request
export function tenantContext(req: AuthedRequest, _res: Response, next: NextFunction) {
  const tenantId = getTenantId(req);
  (req as any).tenantId = tenantId;
  next();
}

// Filter arrays by tenant_id
export function filterByTenant<T extends { tenantId?: string }>(items: T[], tenantId: string): T[] {
  if (!tenantId || tenantId === "single-tenant") return items;
  return items.filter(item => item.tenantId === tenantId || !item.tenantId);
}

// Scoped access helper - retorna apenas itens do tenant
export function scopedByTenant<T extends { tenantId?: string }>(
  items: T[],
  tenantId?: string,
  includeGlobal = false
): T[] {
  if (!tenantId) return includeGlobal ? items.filter(item => !item.tenantId) : [];
  return items.filter(
    item => item.tenantId === tenantId || (includeGlobal && !item.tenantId)
  );
}

// Scoped medical records by tenant patient IDs
export function scopedMedicalRecords(
  medicalRecords: Record<string, any>,
  patients: { id: string; tenantId?: string }[],
  tenantId?: string
): Record<string, any> {
  if (!tenantId) return {};
  const patientIds = new Set(
    patients.filter(p => !tenantId || p.tenantId === tenantId).map(p => p.id)
  );
  return Object.fromEntries(
    Object.entries(medicalRecords).filter(([pid]) => patientIds.has(pid))
  );
}

export function getTenantFromEmail(email: string): string {
  const domain = email.split("@")[1]?.split(".")[0] || "default";
  return domain;
}
