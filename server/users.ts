import { randomUUID } from "crypto";
import { loadData, saveData, AppData } from "./data";
import { audit } from "./helpers";
import { hashPassword, validatePassword } from "./auth";
import { AppUser } from "../src/types";
import { ensureCoreAuthSchema, isDatabaseAvailable, isSupabaseRestAvailable, query, queryOne, supabaseRestDelete, supabaseRestFindOne, supabaseRestInsert, supabaseRestUpdate } from "./database";

export interface UserCreateInput {
  name: string;
  email: string;
  password: string;
  role: string;
  specialty?: string;
}

export interface UserUpdateInput {
  name?: string;
  email?: string;
  role?: string;
  specialty?: string;
  isActive?: boolean;
}

export async function createUser(input: UserCreateInput, actor: AppUser): Promise<AppUser> {
  const data = await loadData();
  const existing = data.users.find(u => u.email?.toLowerCase() === input.email.toLowerCase());
  if (existing) {
    throw new Error("Ja existe um usuario com este email.");
  }
  if (isDatabaseAvailable()) {
    await ensureCoreAuthSchema();
    const existingDb = await queryOne<{ id: string }>("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [input.email]);
    if (existingDb) throw new Error("Ja existe um usuario com este email.");
  } else if (isSupabaseRestAvailable()) {
    const existingRest = await supabaseRestFindOne<{ id: string }>("users", `select=id&email=eq.${encodeURIComponent(input.email.trim().toLowerCase())}`);
    if (existingRest) throw new Error("Ja existe um usuario com este email.");
  }
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    throw new Error(passwordError);
  }
  const passwordHash = hashPassword(input.password);
  const tenantId = actor.role === "super_admin" ? undefined : actor.tenantId;
  const newUser = {
    id: randomUUID(),
    name: input.name,
    email: input.email.trim().toLowerCase(),
    role: input.role as AppUser["role"],
    tenantId,
    specialty: input.specialty,
    pin: input.password,
    passwordHash,
    isActive: true
  };

  if (isDatabaseAvailable()) {
    await query(
      `INSERT INTO users (id, tenant_id, email, name, password_hash, role, specialty, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)`,
      [newUser.id, tenantId || null, newUser.email, newUser.name, passwordHash, newUser.role, newUser.specialty || null]
    );
  } else if (isSupabaseRestAvailable()) {
    await supabaseRestInsert("users", {
      id: newUser.id,
      tenant_id: tenantId || null,
      email: newUser.email,
      name: newUser.name,
      password_hash: passwordHash,
      role: newUser.role,
      specialty: newUser.specialty || null,
      is_active: true,
      mfa_enabled: false
    });
  }
  data.users.push(newUser as any);
  audit(data, actor, "create", "user", newUser.id, newUser.name);
  await saveData(data);
  return { id: newUser.id, name: newUser.name, email: newUser.email, role: newUser.role, specialty: newUser.specialty, tenantId };
}

export async function updateUser(id: string, input: UserUpdateInput, actor: AppUser): Promise<AppUser | null> {
  const data = await loadData();
  const idx = data.users.findIndex(u => u.id === id);
  if (idx === -1) return null;
  const user = data.users[idx];
  if (actor.role !== "super_admin" && user.tenantId !== actor.tenantId) return null;
  if (input.name !== undefined) user.name = input.name;
  if (input.email !== undefined) user.email = input.email;
  if (input.role !== undefined) user.role = input.role as any;
  if (input.specialty !== undefined) user.specialty = input.specialty;
  if (input.isActive !== undefined) user.isActive = input.isActive;
  if (isDatabaseAvailable()) {
    await query(
      `UPDATE users SET name = $2, email = $3, role = $4, specialty = $5, is_active = $6, updated_at = NOW() WHERE id = $1`,
      [id, user.name, user.email || null, user.role, user.specialty || null, user.isActive ?? true]
    );
  } else if (isSupabaseRestAvailable()) {
    await supabaseRestUpdate("users", `id=eq.${encodeURIComponent(id)}`, {
      name: user.name,
      email: user.email || null,
      role: user.role,
      specialty: user.specialty || null,
      is_active: user.isActive ?? true
    });
  }
  data.users[idx] = user;
  audit(data, actor, "update", "user", id, user.name);
  await saveData(data);
  return { id: user.id, name: user.name, email: user.email, role: user.role, specialty: user.specialty, tenantId: user.tenantId, isActive: user.isActive };
}

export async function deleteUser(id: string, actor: AppUser): Promise<boolean> {
  const data = await loadData();
  const idx = data.users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  if (actor.role !== "super_admin" && data.users[idx].tenantId !== actor.tenantId) return false;
  const removed = data.users.splice(idx, 1)[0];
  if (isDatabaseAvailable()) {
    await query("DELETE FROM users WHERE id = $1", [id]);
  } else if (isSupabaseRestAvailable()) {
    await supabaseRestDelete("users", `id=eq.${encodeURIComponent(id)}`);
  }
  audit(data, actor, "delete", "user", id, removed.name);
  await saveData(data);
  return true;
}

export async function listUsers(actor?: AppUser): Promise<AppUser[]> {
  if (isDatabaseAvailable()) {
    await ensureCoreAuthSchema();
    const rows = await query<any>(
      actor && actor.role !== "super_admin"
        ? "SELECT id, email, name, role, specialty, tenant_id, is_active FROM users WHERE tenant_id = $1 ORDER BY name"
        : "SELECT id, email, name, role, specialty, tenant_id, is_active FROM users ORDER BY name",
      actor && actor.role !== "super_admin" ? [actor.tenantId] : []
    );
    return rows.map(row => ({ id: row.id, name: row.name, email: row.email, role: row.role, specialty: row.specialty, tenantId: row.tenant_id, isActive: row.is_active }));
  }
  const data = await loadData();
  const users = actor && actor.role !== "super_admin"
    ? data.users.filter(u => u.tenantId === actor.tenantId)
    : data.users;
  return users.map(u => ({ id: u.id, name: u.name, email: u.email, role: u.role, specialty: u.specialty, tenantId: u.tenantId, isActive: u.isActive }));
}

export async function generateInvite(email: string, role: string, actor: AppUser): Promise<string> {
  const token = randomUUID();
  const data = await loadData();
  audit(data, actor, "invite", "user_invite", token, `${email} como ${role}`);
  data.auditEvents.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    actorId: actor.id,
    actorName: actor.name,
    action: "user_invite",
    entity: "user_invite",
    entityId: token,
    details: JSON.stringify({ email, role })
  });
  await saveData(data);
  return token;
}
