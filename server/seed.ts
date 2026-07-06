import { ServerUser } from "./data";

// Hashes pre-computados via bcrypt.hashSync(senha, 10) para garantir consistência entre restart
// Hashes pre-computados via bcrypt.hashSync(senha, 10) para garantir consistência entre restart
// Seed users sao criados apenas como fallback se o onboarding nao foi concluido.
// Nao inclui super_admin — o primeiro super admin e criado pelo SetupWizard.
export const seedUsers: ServerUser[] = [
  { id: "u-admin", name: "Administrador", role: "admin", email: "admin@consultio.com", passwordHash: "$2b$10$D4u2spQtENxi.N3ogDyk0uREx3mBPz77XEXwCBX4z0zQU2rWR8kYu", isActive: true },
  { id: "u-matheus", name: "Dr. Matheus", role: "doctor", specialty: "Cardiologista", email: "matheus@consultio.com", passwordHash: "$2b$10$/iIrNZUoAHh6XMpGOzBlS.WzC1KkWfSYSQIdT97jHz.hh.nQBapU.", isActive: true },
  { id: "u-recepcao", name: "Recepcao", role: "reception", email: "recepcao@consultio.com", passwordHash: "$2b$10$WA.tB8rEKfQDewH6gKGmkum5Y6HeCn7Soy4N4GxIjC8BGsUiVkBPW", isActive: true },
  { id: "u-financeiro", name: "Financeiro", role: "finance", email: "financeiro@consultio.com", passwordHash: "$2b$10$6CQEXOP2DbDxFTilSjHYUeSibTHONqW0rISMoCzNUitYbMwU7rWOy", isActive: true }
];
