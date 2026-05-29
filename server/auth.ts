import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import speakeasy from "speakeasy";
import { AppUser } from "../src/types";

const JWT_SECRET = process.env.JWT_SECRET || "consultio-dev-secret-change-in-production";
const JWT_EXPIRES_IN = "24h";
const REFRESH_EXPIRES_IN = "7d";

export interface AuthTokens {
  token: string;
  refreshToken: string;
  expiresAt: number;
}

export interface UserWithHash {
  id: string;
  tenantId?: string;
  email: string;
  name: string;
  role: string;
  specialty?: string;
  passwordHash: string;
  mfaSecret?: string;
  mfaEnabled: boolean;
  isActive: boolean;
}

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

export function generateTokens(user: AppUser & { tenantId?: string }): AuthTokens {
  const payload = { id: user.id, tenantId: user.tenantId, name: user.name, role: user.role, specialty: user.specialty };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
  const refreshToken = jwt.sign({ id: user.id, type: "refresh" }, JWT_SECRET, { expiresIn: REFRESH_EXPIRES_IN });
  const expiresAt = Date.now() + 24 * 60 * 60 * 1000;
  return { token, refreshToken, expiresAt };
}

export function verifyToken(token: string): (AppUser & { tenantId?: string }) | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AppUser & { tenantId?: string };
  } catch {
    return null;
  }
}

export function verifyRefreshToken(token: string): { id: string } | null {
  try {
    const payload = jwt.verify(token, JWT_SECRET) as { id: string; type: string };
    return payload.type === "refresh" ? payload : null;
  } catch {
    return null;
  }
}

// MFA / TOTP
export function generateMFASecret(email: string): { secret: string; qrCodeUrl: string } {
  const secret = speakeasy.generateSecret({ name: `Consultio Med:${email}` });
  return {
    secret: secret.base32,
    qrCodeUrl: secret.otpauth_url || ""
  };
}

export function verifyMFAToken(secret: string, token: string): boolean {
  return speakeasy.totp.verify({
    secret,
    encoding: "base32",
    token,
    window: 1
  });
}

export function generateMFAQRCode(secret: string, email: string): string {
  return speakeasy.otpauthURL({ secret, label: `Consultio Med:${email}`, encoding: "base32" });
}
