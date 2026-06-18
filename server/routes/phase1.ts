import { randomUUID } from "crypto";
import { Express } from "express";
import { loadData, saveData } from "../data";
import { AuthedRequest, sessions, requireAuth, requireRoles } from "../middleware";
import { audit } from "../helpers";
import { hashPassword, verifyPassword, validatePassword, generateTokens, rotateRefreshToken, verifyToken, verifyRefreshToken, generateMFASecret, verifyMFAToken } from "../auth";
import { createUser, updateUser, deleteUser, listUsers, generateInvite } from "../users";
import { registerConsent, getPatientConsents } from "../lgpd";
import { createBackup, listBackups, restoreBackup, scheduleAutoBackup } from "../backup";
import { isDatabaseAvailable, queryOne, query } from "../database";

interface DbUser {
  id: string;
  tenant_id?: string;
  email?: string;
  name: string;
  password_hash?: string;
  role: string;
  specialty?: string;
  mfa_secret?: string;
  mfa_enabled?: boolean;
  is_active?: boolean;
}

async function findUserByEmail(email: string) {
  if (isDatabaseAvailable()) {
    try {
      const row = await queryOne<DbUser>("SELECT * FROM users WHERE LOWER(email) = LOWER($1)", [email]);
      if (row) return row;
    } catch { /* fallthrough */ }
  }
  const data = await loadData();
  return data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
}

async function findUserById(id: string) {
  if (isDatabaseAvailable()) {
    try {
      const row = await queryOne<DbUser>("SELECT * FROM users WHERE id = $1", [id]);
      if (row) return row;
    } catch { /* fallthrough */ }
  }
  const data = await loadData();
  return data.users.find(u => u.id === id);
}

function dbUserToApp(db: DbUser | Record<string, any>) {
  return { id: db.id, name: db.name, role: db.role, specialty: db.specialty, tenantId: db.tenant_id };
}

async function saveUserMfa(userId: string, mfaSecret: string, mfaEnabled: boolean) {
  if (isDatabaseAvailable()) {
    try {
      await query("UPDATE users SET mfa_secret = $1, mfa_enabled = $2 WHERE id = $3", [mfaSecret, mfaEnabled, userId]);
    } catch { /* fallthrough */ }
  }
  const data = await loadData();
  const user = data.users.find(u => u.id === userId);
  if (user) {
    user.mfaSecret = mfaSecret;
    user.mfaEnabled = mfaEnabled;
    await saveData(data);
  }
}

async function saveUserPassword(userId: string, passwordHash: string) {
  if (isDatabaseAvailable()) {
    try {
      await query("UPDATE users SET password_hash = $1 WHERE id = $2", [passwordHash, userId]);
    } catch { /* fallthrough */ }
  }
  const data = await loadData();
  const user = data.users.find(u => u.id === userId);
  if (user) {
    user.passwordHash = passwordHash;
    await saveData(data);
  }
}

export function registerPhase1Routes(app: Express) {
  // === AUTH (JWT) ===
  app.post("/api/v2/auth/login", async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return res.status(400).json({ error: "Email e senha obrigatorios." });

    const data = await loadData();
    const dbRow = await findUserByEmail(email);

    if (!dbRow || !((dbRow as any).password_hash || (dbRow as any).passwordHash)) {
      return res.status(401).json({ error: "Email ou senha invalidos." });
    }

    const passwordHash = (dbRow as any).password_hash || (dbRow as any).passwordHash;
    if (!verifyPassword(password, passwordHash)) {
      return res.status(401).json({ error: "Email ou senha invalidos." });
    }

    const appUser = dbUserToApp(dbRow);
    if (typeof appUser.role === "string" && ["super_admin", "admin", "doctor", "reception", "finance"].includes(appUser.role) === false) {
      appUser.role = "reception" as any;
    }

    if ((dbRow as any).mfa_enabled || (dbRow as any).mfaEnabled) {
      const mfaToken = randomUUID();
      sessions.set(`mfa:${mfaToken}`, appUser);
      return res.json({ mfaRequired: true, mfaToken, userId: (dbRow as any).id });
    }

    const tokens = generateTokens(appUser);
    await audit(data, appUser, "login", "session", tokens.token, "Login JWT");
    res.json({ ...tokens, user: appUser });
  });

  app.post("/api/v2/auth/mfa/verify", async (req, res) => {
    const { mfaToken, userId, code } = req.body || {};
    const data = await loadData();
    const dbRow = await findUserById(userId);
    if (!dbRow || !(dbRow as any).mfa_secret) return res.status(401).json({ error: "MFA nao configurado." });
    if (!verifyMFAToken((dbRow as any).mfa_secret, code)) return res.status(401).json({ error: "Codigo MFA invalido." });
    const appUser = dbUserToApp(dbRow);
    const tokens = generateTokens(appUser);
    await audit(data, appUser, "login_mfa", "session", tokens.token, "Login com MFA");
    sessions.delete(`mfa:${mfaToken}`);
    res.json({ ...tokens, user: appUser });
  });

  app.post("/api/v2/auth/refresh", async (req, res) => {
    const { refreshToken } = req.body || {};
    if (!refreshToken) return res.status(400).json({ error: "Refresh token obrigatorio." });
    const newRefreshToken = rotateRefreshToken(refreshToken);
    if (!newRefreshToken) return res.status(401).json({ error: "Refresh token invalido ou ja utilizado." });
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) return res.status(401).json({ error: "Refresh token invalido." });
    const dbRow = await findUserById(payload.id);
    if (!dbRow) return res.status(401).json({ error: "Usuario nao encontrado." });
    const appUser = dbUserToApp(dbRow);
    const tokens = generateTokens(appUser);
    tokens.refreshToken = newRefreshToken;
    res.json(tokens);
  });

  app.post("/api/v2/auth/mfa/setup", requireAuth, async (req: AuthedRequest, res) => {
    const data = await loadData();
    const dbRow = await findUserById(req.user!.id);
    if (!dbRow) return res.status(404).json({ error: "Usuario nao encontrado." });
    const userEmail = (dbRow as any).email || req.user!.name;
    const { secret, qrCodeUrl } = generateMFASecret(userEmail);
    await saveUserMfa(req.user!.id, secret, false);
    res.json({ secret, qrCodeUrl });
  });

  app.post("/api/v2/auth/mfa/enable", requireAuth, async (req: AuthedRequest, res) => {
    const { code } = req.body || {};
    const data = await loadData();
    const dbRow = await findUserById(req.user!.id);
    if (!dbRow || !(dbRow as any).mfa_secret) return res.status(400).json({ error: "Configure o MFA primeiro." });
    if (!verifyMFAToken((dbRow as any).mfa_secret, code)) return res.status(401).json({ error: "Codigo invalido." });
    await saveUserMfa(req.user!.id, (dbRow as any).mfa_secret, true);
    await audit(data, req.user!, "mfa_enabled", "user", req.user!.id, "MFA ativado");
    res.json({ ok: true });
  });

  app.post("/api/v2/auth/change-password", requireAuth, async (req: AuthedRequest, res) => {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) return res.status(400).json({ error: "Senha atual e nova senha obrigatorias." });
    const passwordError = validatePassword(newPassword);
    if (passwordError) return res.status(400).json({ error: passwordError });
    const data = await loadData();
    const dbRow = await findUserById(req.user!.id);
    if (!dbRow) return res.status(404).json({ error: "Usuario nao encontrado." });
    const passwordHash = (dbRow as any).password_hash;
    if (passwordHash && !verifyPassword(currentPassword, passwordHash)) {
      return res.status(401).json({ error: "Senha atual invalida." });
    }
    await saveUserPassword(req.user!.id, hashPassword(newPassword));
    await audit(data, req.user!, "change_password", "user", req.user!.id, "Senha alterada");
    res.json({ ok: true });
  });

  // === USERS ===
  app.get("/api/v2/users", requireAuth, requireRoles("admin"), async (_req, res) => {
    const users = await listUsers();
    res.json(users);
  });

  app.post("/api/v2/users", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    try {
      const user = await createUser(req.body, req.user!);
      res.json(user);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.put("/api/v2/users/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const user = await updateUser(req.params.id, req.body, req.user!);
    if (!user) return res.status(404).json({ error: "Usuario nao encontrado." });
    res.json(user);
  });

  app.delete("/api/v2/users/:id", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
    const ok = await deleteUser(req.params.id, req.user!);
    if (!ok) return res.status(404).json({ error: "Usuario nao encontrado." });
    res.json({ ok: true });
  });

  app.post("/api/v2/users/invite", requireAuth, requireRoles("admin"), async (req: AuthedRequest, res) => {
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
  app.post("/api/v2/backup", requireAuth, requireRoles("admin"), async (_req, res) => {
    try {
      const backupPath = await createBackup();
      res.json({ path: backupPath, message: "Backup criado com sucesso." });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/v2/backup", requireAuth, requireRoles("admin"), async (_req, res) => {
    const backups = await listBackups();
    res.json(backups);
  });

  app.post("/api/v2/backup/restore", requireAuth, requireRoles("admin"), async (req, res) => {
    const { backupName } = req.body || {};
    if (!backupName) return res.status(400).json({ error: "Nome do backup obrigatorio." });
    const ok = await restoreBackup(backupName);
    if (!ok) return res.status(400).json({ error: "Falha ao restaurar backup." });
    res.json({ ok: true, message: "Backup restaurado. Reinicie o servidor." });
  });

  // === LEGACY ===
  app.get("/api/auth/me", requireAuth, (req: AuthedRequest, res) => {
    res.json(req.user);
  });

  app.get("/api/auth/users", requireAuth, requireRoles("admin"), async (_req, res) => {
    const data = await loadData();
    res.json(data.users.map(u => ({ id: u.id, name: u.name, role: u.role, specialty: u.specialty })));
  });
}
