import { hashPassword } from "./auth";
import { ServerUser } from "./data";

export const seedUsers: ServerUser[] = [
  { id: "u-superadmin", name: "Super Administrador", role: "super_admin", pin: "", email: "super@woomed.com.br", passwordHash: hashPassword("Super@2026!woomed"), isActive: true },
  { id: "u-admin", name: "Administrador", role: "admin", pin: "", email: "admin@consultio.com", passwordHash: hashPassword("Admin@2026!cons"), isActive: true },
  { id: "u-matheus", name: "Dr. Matheus", role: "doctor", specialty: "Cardiologista", pin: "", email: "matheus@consultio.com", passwordHash: hashPassword("Matheus@2026!doc"), isActive: true },
  { id: "u-recepcao", name: "Recepcao", role: "reception", pin: "", email: "recepcao@consultio.com", passwordHash: hashPassword("Recep@2026!clinic"), isActive: true },
  { id: "u-financeiro", name: "Financeiro", role: "finance", pin: "", email: "financeiro@consultio.com", passwordHash: hashPassword("Fin@2026!med"), isActive: true }
];
