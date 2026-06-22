import crypto from "crypto";
import { Express } from "express";
import { loadData, saveData } from "../data";
import { hashPassword, generateTokens } from "../auth";

export function registerSetupRoutes(app: Express) {
  app.get("/api/v2/setup/status", async (_req, res) => {
    const data = await loadData();
    const hasSuperAdmin = data.users.some(u => u.role === "super_admin" && u.isActive !== false);
    res.json({ needsSetup: !hasSuperAdmin });
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
    await saveData(data);

    const tokens = generateTokens({ id: appUser.id, name: appUser.name, role: appUser.role, tenantId: "" });

    res.json({
      token: tokens.token,
      refreshToken: tokens.refreshToken,
      expiresAt: tokens.expiresAt,
      user: { id: appUser.id, name: appUser.name, role: appUser.role }
    });
  });
}
