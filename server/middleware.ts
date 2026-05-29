import { Request, Response, NextFunction } from "express";
import { AppUser } from "../src/types";
import { UserRole } from "../src/types";
import { verifyToken } from "./auth";

export type AuthedRequest = Request & { user?: AppUser };

export const sessions = new Map<string, AppUser>();

export function publicUser(user: AppUser & { pin?: string }): AppUser {
  const { id, name, role, specialty, tenantId } = user;
  return { id, name, role, specialty, tenantId };
}

export function getToken(req: Request) {
  const auth = req.headers.authorization || "";
  if (auth.startsWith("Bearer ")) return auth.slice("Bearer ".length);
  return req.header("x-session-token") || "";
}

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const token = getToken(req);
  const user = token ? sessions.get(token) || verifyToken(token) || undefined : undefined;
  if (!user) {
    return res.status(401).json({ error: "Sessao invalida ou expirada." });
  }
  req.user = user;
  next();
}

export function requireRoles(roles: UserRole[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Usuario sem permissao para esta acao." });
    }
    next();
  };
}
