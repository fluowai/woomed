import { randomUUID } from "crypto";
import { loadData, saveData, AppData } from "./data";
import { audit } from "./helpers";
import { hashPassword, validatePassword } from "./auth";
import { AppUser } from "../src/types";

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
  const passwordError = validatePassword(input.password);
  if (passwordError) {
    throw new Error(passwordError);
  }
  const newUser = {
    id: `u-${Date.now()}`,
    name: input.name,
    email: input.email,
    role: input.role as AppUser["role"],
    tenantId: actor.role === "super_admin" ? undefined : actor.tenantId,
    specialty: input.specialty,
    pin: input.password,
    passwordHash: hashPassword(input.password)
  };
  data.users.push(newUser as any);
  audit(data, actor, "create", "user", newUser.id, newUser.name);
  await saveData(data);
  return { id: newUser.id, name: newUser.name, role: newUser.role, specialty: newUser.specialty };
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
  data.users[idx] = user;
  audit(data, actor, "update", "user", id, user.name);
  await saveData(data);
  return { id: user.id, name: user.name, role: user.role, specialty: user.specialty };
}

export async function deleteUser(id: string, actor: AppUser): Promise<boolean> {
  const data = await loadData();
  const idx = data.users.findIndex(u => u.id === id);
  if (idx === -1) return false;
  if (actor.role !== "super_admin" && data.users[idx].tenantId !== actor.tenantId) return false;
  const removed = data.users.splice(idx, 1)[0];
  audit(data, actor, "delete", "user", id, removed.name);
  await saveData(data);
  return true;
}

export async function listUsers(actor?: AppUser): Promise<AppUser[]> {
  const data = await loadData();
  const users = actor && actor.role !== "super_admin"
    ? data.users.filter(u => u.tenantId === actor.tenantId)
    : data.users;
  return users.map(u => ({ id: u.id, name: u.name, role: u.role, specialty: u.specialty, tenantId: u.tenantId }));
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
