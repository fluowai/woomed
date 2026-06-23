import crypto from "crypto";
import fs from "fs";
import { Express } from "express";
import { loadData, saveData, dataFile, invalidateCache } from "../data";
import { hashPassword, generateTokens } from "../auth";
import { ensureCoreAuthSchema, isDatabaseAvailable, isSupabaseRestAvailable, query, queryOne, supabaseRestFindOne, supabaseRestInsert } from "../database";

async function hasConfiguredSuperAdmin() {
  if (isDatabaseAvailable()) {
    try {
      await ensureCoreAuthSchema();
      const row = await queryOne<{ exists: boolean }>(
        "SELECT EXISTS(SELECT 1 FROM users WHERE role = 'super_admin' AND COALESCE(is_active, TRUE) = TRUE) AS exists"
      );
      if (row?.exists) return true;
    } catch { /* fallthrough */ }
  }
  if (isSupabaseRestAvailable()) {
    const row = await supabaseRestFindOne<{ id: string }>("users", "select=id&role=eq.super_admin&is_active=eq.true");
    if (row) return true;
  }
  const data = await loadData();
  return data.users.some(u => u.role === "super_admin" && u.isActive !== false);
}

export function registerSetupRoutes(app: Express) {
  app.get("/api/v2/setup/status", async (_req, res) => {
    res.json({ needsSetup: !(await hasConfiguredSuperAdmin()) });
  });

  app.post("/api/v2/setup/reset", async (_req, res) => {
    try {
      if (fs.existsSync(dataFile)) {
        fs.unlinkSync(dataFile);
      }
      invalidateCache();
      res.json({ ok: true, message: "Dados resetados. Recarregue a pagina para o onboarding." });
    } catch (e) {
      res.status(500).json({ error: "Erro ao resetar dados: " + (e instanceof Error ? e.message : e) });
    }
  });

  app.post("/api/v2/setup/complete", async (req, res) => {
    const data = await loadData();
    if (await hasConfiguredSuperAdmin()) {
      return res.status(400).json({ error: "Super admin ja configurado. Faca login." });
    }

    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatorios." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
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
        const detail = error instanceof Error ? error.message : "Erro desconhecido";
        return res.status(500).json({ error: `Nao foi possivel criar o super admin no banco: ${detail}` });
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
        const detail = error instanceof Error ? error.message : "Erro desconhecido";
        return res.status(500).json({ error: `Nao foi possivel criar o super admin no Supabase REST: ${detail}` });
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
