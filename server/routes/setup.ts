import crypto from "crypto";
import fs from "fs";
import { Express } from "express";
import { loadData, saveData, dataFile, invalidateCache } from "../data";
import { hashPassword, generateTokens } from "../auth";
import { ensureCoreAuthSchema, isDatabaseAvailable, isSupabaseRestAvailable, query, queryOne, supabaseRestFindOne, supabaseRestInsert } from "../database";
import { requireAuth, requireRoles, AuthedRequest } from "../middleware";
import rateLimit from "express-rate-limit";

async function hasConfiguredSuperAdmin() {
  if (isDatabaseAvailable()) {
    try {
      const row = await queryOne<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE role = 'super_admin' AND COALESCE(is_active, TRUE) = TRUE) AS exists"
      );
      if (row?.exists) return true;
    } catch { /* fallthrough */ }
  }
  if (isSupabaseRestAvailable()) {
    try {
      const row = await supabaseRestFindOne<{ id: string }>("users", "select=id&role=eq.super_admin&is_active=eq.true");
      if (row) return true;
    } catch { /* fallthrough */ }
  }
  try {
    const data = await loadData();
    return (data.users || []).some(u => u.role === "super_admin" && u.isActive !== false);
  } catch {
    return false;
  }
}

const setupLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  message: { error: "Muitas tentativas de setup. Tente novamente em 1 hora." },
  standardHeaders: true,
  legacyHeaders: false,
});

export function registerSetupRoutes(app: Express) {
  app.get("/api/v2/setup/status", async (_req, res) => {
    try {
      res.json({ needsSetup: !(await hasConfiguredSuperAdmin()) });
    } catch (error) {
      res.status(500).json({ error: "Erro ao verificar status de setup." });
    }
  });

  app.post("/api/v2/setup/reset", requireAuth, requireRoles("super_admin"), async (req: AuthedRequest, res) => {
    try {
      if (fs.existsSync(dataFile)) {
        fs.unlinkSync(dataFile);
      }
      invalidateCache();
      res.json({ ok: true, message: "Dados resetados. Recarregue a pagina para o onboarding." });
    } catch (e) {
      res.status(500).json({ error: "Erro ao resetar dados." });
    }
  });

  app.post("/api/v2/setup/complete", setupLimiter, async (req, res) => {
    const data = await loadData();
    if (await hasConfiguredSuperAdmin()) {
      return res.status(400).json({ error: "Super admin ja configurado. Faca login." });
    }

    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatorios." });
    }
    if (password.length < 8) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 8 caracteres." });
    }

    const id = crypto.randomUUID();
    const passwordHash = hashPassword(password);
    const appUser = {
      id,
      name: name || "Super Administrador",
      role: "super_admin" as const,
      email,
      passwordHash,
      isActive: true,
    };

    if (isDatabaseAvailable()) {
      try {
        await ensureCoreAuthSchema();
        await query(
          `INSERT INTO users (id, tenant_id, email, name, password_hash, role, is_active)
           VALUES ($1, NULL, $2, $3, $4, 'super_admin', TRUE)`,
          [id, email, appUser.name, passwordHash]
        );
      } catch (error) {
        return res.status(500).json({ error: "Nao foi possivel criar o super admin no banco." });
      }
    } else if (isSupabaseRestAvailable()) {
      try {
        await supabaseRestInsert("users", {
          id,
          tenant_id: null,
          email,
          name: appUser.name,
          password_hash: passwordHash,
          role: "super_admin",
          is_active: true,
          mfa_enabled: false
        });
      } catch (error) {
        return res.status(500).json({ error: "Nao foi possivel criar o super admin no Supabase REST." });
      }
    }

    data.users.push({ ...appUser, pin: "" });
    data.platformOwners.push({
      id: `po-${crypto.randomUUID().slice(0, 8)}`,
      userId: appUser.id,
      role: "super_admin",
      displayName: appUser.name,
      email,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    });
    await saveData(data);

    const tokens = generateTokens({ id: appUser.id, name: appUser.name, role: appUser.role });

    res.json({
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      user: { id: appUser.id, name: appUser.name, role: appUser.role }
    });
  });
}
