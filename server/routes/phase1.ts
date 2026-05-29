import { Express } from "express";
import { loadData, saveData } from "../data";
import { AuthedRequest, sessions, requireAuth, requireRoles } from "../middleware";
import { audit } from "../helpers";
import { hashPassword, verifyPassword, generateTokens, verifyToken, verifyRefreshToken, generateMFASecret, verifyMFAToken } from "../auth";
import { createUser, updateUser, deleteUser, listUsers, generateInvite } from "../users";
import { registerConsent, getPatientConsents } from "../lgpd";
import { createBackup, listBackups, restoreBackup, scheduleAutoBackup } from "../backup";

export function registerPhase1Routes(app: Express) {
  // === AUTH (JWT) ===
  app.post("/api/v2/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email e senha sao obrigatorios." });

    const data = await loadData();
    const user = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!user || !user.passwordHash) {
      // Fallback to PIN-based login for backward compatibility
      if (process.env.ENABLE_LEGACY_PIN_LOGIN !== "true" && process.env.NODE_ENV === "production") {
        return res.status(401).json({ error: "Email ou senha invalidos." });
      }
      const pinUser = data.users.find(u => u.pin === password && (u.email?.toLowerCase() === email.toLowerCase() || u.name.toLowerCase() === email.toLowerCase()));
      if (!pinUser) return res.status(401).json({ error: "Email ou senha invalidos." });
      const appUser = { id: pinUser.id, name: pinUser.name, role: pinUser.role, specialty: pinUser.specialty };
      const token = require("crypto").randomUUID();
      sessions.set(token, appUser);
      audit(data, appUser, "login", "session", token, "Login PIN (legacy)");
      await saveData(data);
      return res.json({ token, user: appUser, legacy: true });
    }

    if (!verifyPassword(password, user.passwordHash)) {
      return res.status(401).json({ error: "Email ou senha invalidos." });
    }

    const appUser = { id: user.id, name: user.name, role: user.role as any, specialty: user.specialty, tenantId: user.tenantId };

    // MFA check
    if (user.mfaEnabled) {
      const mfaToken = require("crypto").randomUUID();
      sessions.set(`mfa:${mfaToken}`, appUser);
      return res.json({ mfaRequired: true, mfaToken, userId: user.id });
    }

    const tokens = generateTokens(appUser);
    audit(data, appUser, "login", "session", tokens.token, "Login JWT");
    await saveData(data);
    res.json({ ...tokens, user: appUser });
  });

  app.post("/api/v2/auth/mfa/verify", async (req, res) => {
    const { mfaToken, userId, code } = req.body || {};
    const data = await loadData();
    const user = data.users.find(u => u.id === userId);
    if (!user || !user.mfaSecret) return res.status(401).json({ error: "MFA nao configurado." });
    if (!verifyMFAToken(user.mfaSecret, code)) return res.status(401).json({ error: "Codigo MFA invalido." });
    const appUser = { id: user.id, name: user.name, role: user.role as any, specialty: user.specialty, tenantId: user.tenantId };
    const tokens = generateTokens(appUser);
    audit(data, appUser, "login_mfa", "session", tokens.token, "Login com MFA");
    sessions.delete(`mfa:${mfaToken}`);
    await saveData(data);
    res.json({ ...tokens, user: appUser });
  });

  app.post("/api/v2/auth/refresh", async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: "Refresh token obrigatorio." });
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) return res.status(401).json({ error: "Refresh token invalido." });
    const data = await loadData();
    const user = data.users.find(u => u.id === payload.id);
    if (!user) return res.status(401).json({ error: "Usuario nao encontrado." });
    const appUser = { id: user.id, name: user.name, role: user.role as any, specialty: user.specialty, tenantId: user.tenantId };
    const tokens = generateTokens(appUser);
    res.json(tokens);
  });

  app.post("/api/v2/auth/mfa/setup", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const user = data.users.find(u => u.id === req.user!.id);
    if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
    const { secret, qrCodeUrl } = generateMFASecret(user.email || user.name);
    user.mfaSecret = secret;
    user.mfaEnabled = false;
    await saveData(data);
    res.json({ secret, qrCodeUrl });
  });

  app.post("/api/v2/auth/mfa/enable", requireAuth, async (req: AuthedRequest, res) => {
    const { code } = req.body || {};
    const data = await loadData();
    const user = data.users.find(u => u.id === req.user!.id);
    if (!user || !user.mfaSecret) return res.status(400).json({ error: "Configure o MFA primeiro." });
    if (!verifyMFAToken(user.mfaSecret, code)) return res.status(401).json({ error: "Codigo invalido." });
    user.mfaEnabled = true;
    audit(data, req.user!, "mfa_enabled", "user", user.id, "MFA ativado");
    await saveData(data);
    res.json({ ok: true });
  });

  app.post("/api/v2/auth/change-password", requireAuth, async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Senha atual e nova senha obrigatorias." });
    if (newPassword.length < 6) return res.status(400).json({ error: "Nova senha deve ter pelo menos 6 caracteres." });
    const data = await loadData();
    const user = data.users.find(u => u.id === req.user!.id);
    if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
    if (user.passwordHash && !verifyPassword(currentPassword, user.passwordHash)) {
      return res.status(401).json({ error: "Senha atual invalida." });
    }
    user.passwordHash = hashPassword(newPassword);
    audit(data, req.user!, "change_password", "user", user.id, "Senha alterada");
    await saveData(data);
    res.json({ ok: true });
  });

  // === USERS ===
  app.get("/api/v2/users", requireAuth, requireRoles(["admin"]), async (_req, res) => {
    const users = await listUsers();
    res.json(users);
  });

  app.post("/api/v2/users", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    try {
      const user = await createUser(req.body, req.user!);
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/v2/users/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const user = await updateUser(req.params.id, req.body, req.user!);
    if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
    res.json(user);
  });

  app.delete("/api/v2/users/:id", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const ok = await deleteUser(req.params.id, req.user!);
    if (!ok) return res.status(404).json({ error: "Usuario nao encontrado." });
    res.json({ ok: true });
  });

  app.post("/api/v2/users/invite", requireAuth, requireRoles(["admin"]), async (req: AuthedRequest, res) => {
    const { email, role } = req.body || {};
    if (!email || !role) return res.status(400).json({ error: "Email e role obrigatorios." });
    const token = await generateInvite(email, role, req.user!);
    res.json({ token, inviteUrl: `/accept-invite?token=${token}` });
  });

  // === LGPD ===
  app.post("/api/v2/lgpd/consent", requireAuth, async (req: AuthedRequest, res) => {
    const { patientId, consentType, granted } = req.body || {};
    if (!patientId || !consentType) return res.status(400).json({ error: "Paciente e tipo de consentimento obrigatorios." });
    const ip = req.ip || "";
    const ua = req.headers["user-agent"] || "";
    await registerConsent(patientId, consentType, Boolean(granted), req.user!, ip, ua);
    res.json({ ok: true });
  });

  app.get("/api/v2/lgpd/consent/:patientId", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const consents = getPatientConsents(data, req.params.patientId);
    res.json(consents);
  });

  // === BACKUP ===
  app.post("/api/v2/backup", requireAuth, requireRoles(["admin"]), async (_req, res) => {
    try {
      const backupPath = await createBackup();
      res.json({ path: backupPath, message: "Backup criado com sucesso." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v2/backup", requireAuth, requireRoles(["admin"]), async (_req, res) => {
    const backups = await listBackups();
    res.json(backups);
  });

  app.post("/api/v2/backup/restore", requireAuth, requireRoles(["admin"]), async (req, res) => {
    const { backupName } = req.body || {};
    if (!backupName) return res.status(400).json({ error: "Nome do backup obrigatorio." });
    const ok = await restoreBackup(backupName);
    if (!ok) return res.status(400).json({ error: "Falha ao restaurar backup. Verifique se o arquivo existe." });
    res.json({ ok: true, message: "Backup restaurado. Reinicie o servidor para aplicar." });
  });

  // === LEGACY AUTH ENHANCEMENTS ===
  app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
    res.json(req.user);
  });
}
