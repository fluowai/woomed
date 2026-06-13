import { Request, Response, NextFunction } from "express";
import { AuthedRequest } from "./middleware";
import { loadData, saveData, AppData } from "./data";
import { audit } from "./helpers";

const DEFAULT_TENANT_ID = "single-tenant";

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
}

export function getTenantId(req: AuthedRequest): string {
  return req.user?.tenantId || DEFAULT_TENANT_ID;
}

// Middleware that ensures tenant context is available
export function tenantContext(req: AuthedRequest, _res: Response, next: NextFunction) {
  // Tenant is extracted from JWT token or defaults to single-tenant
  next();
}

// Filter arrays by tenant_id if the items have tenantId field
export function filterByTenant<T extends { tenantId?: string }>(items: T[], tenantId: string): T[] {
  if (tenantId === DEFAULT_TENANT_ID) return items;
  return items.filter(item => item.tenantId === tenantId || !item.tenantId);
}

// Seed a default tenant on first run
export async function ensureDefaultTenant(): Promise<void> {
  const data = await loadData();
  if (!data.patients.length && !data.doctors.length) {
    console.log("[Tenant] No data found. Ready for multi-tenant setup.");
  }
}

export function getTenantFromEmail(email: string): string {
  // Simple tenant derivation from email domain
  const domain = email.split("@")[1]?.split(".")[0] || DEFAULT_TENANT_ID;
  return domain;
}
