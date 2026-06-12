import { hashPassword } from "./auth";
import { ServerUser } from "./data";

export const seedUsers: ServerUser[] = [
  { id: "u-superadmin", name: "Super Administrador", role: "super_admin", pin: "0000", email: "super@woomed.com.br", passwordHash: hashPassword("super123"), isActive: true },
  { id: "u-admin", name: "Administrador", role: "admin", pin: "1234", email: "admin@consultio.com", passwordHash: hashPassword("admin123"), isActive: true },
  { id: "u-matheus", name: "Dr. Matheus", role: "doctor", specialty: "Cardiologista", pin: "1111", email: "matheus@consultio.com", passwordHash: hashPassword("doctor123"), isActive: true },
  { id: "u-recepcao", name: "Recepcao", role: "reception", pin: "2222", email: "recepcao@consultio.com", passwordHash: hashPassword("recep123"), isActive: true },
  { id: "u-financeiro", name: "Financeiro", role: "finance", pin: "3333", email: "financeiro@consultio.com", passwordHash: hashPassword("fin123"), isActive: true }
];
