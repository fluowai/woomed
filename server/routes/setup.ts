import crypto from "crypto";
import fs from "fs";
import { Express } from "express";
import { loadData, saveData, dataFile, invalidateCache } from "../data";
import { hashPassword, generateTokens } from "../auth";

export function registerSetupRoutes(app: Express) {
  app.get("/api/v2/setup/status", async (_req, res) => {
    const data = await loadData();
    const hasSuperAdmin = data.users.some(u => u.role === "super_admin" && u.isActive !== false);
    res.json({ needsSetup: !hasSuperAdmin });
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
    const hasSuperAdmin = data.users.some(u => u.role === "super_admin" && u.isActive !== false);
    if (hasSuperAdmin) {
      return res.status(400).json({ error: "Super admin ja configurado. Faca login." });
    }

    const { email, password, name } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email e senha obrigatorios." });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Senha deve ter pelo menos 6 caracteres." });
    }

    const id = "u-" + crypto.randomUUID().slice(0, 8);
    const appUser = {
      id,
      name: name || "Super Administrador",
      role: "super_admin" as const,
      email,
      passwordHash: hashPassword(password),
      isActive: true,
    };

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
