import { Request, Response, NextFunction } from "express";
import { AppUser } from "../src/types";
import { UserRole } from "../src/types";
import { verifyToken } from "./auth";

export type AuthedRequest = Request & { user?: AppUser };

interface SessionEntry {
  user: AppUser;
  expiresAt: number;
}

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;
const sessions = new Map<string, SessionEntry>();
let lastCleanup = Date.now();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;

function cleanupExpiredSessions() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [token, entry] of sessions) {
    if (entry.expiresAt <= now) {
      sessions.delete(token);
    }
  }
}

export function setSession(token: string, user: AppUser) {
  cleanupExpiredSessions();
  sessions.set(token, { user, expiresAt: Date.now() + SESSION_TTL_MS });
}

export function deleteSession(token: string) {
  sessions.delete(token);
}

export function publicUser(user: AppUser & { pin?: string }): AppUser {
  const { id, name, role, specialty, tenantId } = user;
  return { id, name, role, specialty, tenantId };
}

export function getToken(req: Request): string {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  const sessionToken = req.header("x-session-token");
  if (sessionToken) return sessionToken;
  const cookie = req.headers.cookie;
  if (cookie) {
    const match = cookie.match(/(?:^|;\s*)token=([^;]+)/);
    if (match) return match[1];
  }
  return "";
}

export function resolveUser(token: string): AppUser | null {
  if (!token) return null;
  const entry = sessions.get(token);
  if (entry) {
    if (entry.expiresAt <= Date.now()) {
      sessions.delete(token);
      return null;
    }
    return entry.user;
  }
  const jwtUser = verifyToken(token);
  if (jwtUser) {
    const { id, name, role, specialty, tenantId } = jwtUser;
    return { id, name, role, specialty, tenantId };
  }
  return null;
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getToken(req);
  const user = token ? resolveUser(token) : null;
  if (!user) {
    return res.status(401).json({ error: "Sessao invalida ou expirada." });
  }
  req.user = user;
  next();
}

export function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const token = getToken(req);
  if (token) {
    req.user = resolveUser(token) || undefined;
  }
  next();
}

export function requireRoles(...roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(403).json({ error: "Usuario sem permissao para esta acao." });
    }
    if (req.user.role !== "super_admin" && !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Usuario sem permissao para esta acao." });
    }
    next();
  };
}

export type Permission =
  | "patients:read" | "patients:write" | "patients:delete"
  | "appointments:read" | "appointments:write" | "appointments:delete"
  | "medical_records:read" | "medical_records:write"
  | "finance:read" | "finance:write" | "finance:delete"
  | "users:read" | "users:write" | "users:delete"
  | "settings:read" | "settings:write"
  | "audit:read"
  | "crm:read" | "crm:write"
  | "ai:read" | "ai:write"
  | "backup:read" | "backup:write"
  | "all";

const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  super_admin: ["all"],
  admin: [
    "patients:read", "patients:write", "patients:delete",
    "appointments:read", "appointments:write", "appointments:delete",
    "medical_records:read", "medical_records:write",
    "finance:read", "finance:write", "finance:delete",
    "users:read", "users:write", "users:delete",
    "settings:read", "settings:write",
    "audit:read",
    "crm:read", "crm:write",
    "ai:read", "ai:write",
    "backup:read", "backup:write",
  ],
  doctor: [
    "patients:read", "patients:write",
    "appointments:read", "appointments:write",
    "medical_records:read", "medical_records:write",
    "crm:read",
    "ai:read",
  ],
  reception: [
    "patients:read", "patients:write",
    "appointments:read", "appointments:write",
    "crm:read", "crm:write",
  ],
  finance: [
    "patients:read",
    "appointments:read",
    "finance:read", "finance:write", "finance:delete",
    "crm:read",
  ],
};

export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[userRole];
  if (!perms) return false;
  return perms.includes("all") || perms.includes(permission);
}

export function requireTenant(req: AuthedRequest, res: Response, next: NextFunction) {
  if (!req.user?.tenantId) {
    return res.status(403).json({ error: "Tenant context nao disponivel. Acesso negado." });
  }
  next();
}

export function validateResourceTenant(resourceTenantId: string | undefined, userTenantId: string | undefined): boolean {
  if (!userTenantId) return false;
  if (!resourceTenantId) return false;
  return resourceTenantId === userTenantId;
}

export function validateTenantResource(data: { tenantId?: string | null } | null, userTenantId?: string): boolean {
  if (!userTenantId) return false;
  if (!data) return false;
  if (!data.tenantId) return false;
  return data.tenantId === userTenantId;
}

export function validateResourceTenantMiddleware(
  resourceFetcher: (id: string) => Promise<{ tenantId?: string } | null>
) {
  return async (req: AuthedRequest, res: Response, next: NextFunction) => {
    const resourceId = req.params.id;
    if (!resourceId) {
      return res.status(400).json({ error: "Resource ID required" });
    }

    const resource = await resourceFetcher(resourceId);
    if (!resource) {
      return res.status(404).json({ error: "Recurso nao encontrado." });
    }

    if (!validateTenantResource(resource, req.user?.tenantId)) {
      return res.status(403).json({ error: "Acesso negado. Recurso pertence a outro tenant." });
    }

    (req as any).resource = resource;
    next();
  };
}

export function requirePermission(...permissions: Permission[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Nao autenticado." });
    }
    const hasAll = permissions.every(p => hasPermission(req.user!.role, p));
    if (!hasAll) {
      return res.status(403).json({ error: "Permissao insuficiente." });
    }
    next();
  };
}
