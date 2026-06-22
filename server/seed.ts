import { ServerUser } from "./data";

// Hashes pre-computados via bcrypt.hashSync(senha, 10) para garantir consistência entre restart
// Hashes pre-computados via bcrypt.hashSync(senha, 10) para garantir consistência entre restart
export const seedUsers: ServerUser[] = [
  { id: "u-superadmin", name: "Super Administrador", role: "super_admin", pin: "", email: "super@woomed.com.br", passwordHash: "$2b$10$0wHUuOdNP/CLviCE4pHd2uyB4NulNzx1EXjYs3oi6wd5oJU4CjCGK", isActive: true },
  { id: "u-admin", name: "Administrador", role: "admin", pin: "", email: "admin@consultio.com", passwordHash: "$2b$10$D4u2spQtENxi.N3ogDyk0uREx3mBPz77XEXwCBX4z0zQU2rWR8kYu", isActive: true },
  { id: "u-matheus", name: "Dr. Matheus", role: "doctor", specialty: "Cardiologista", pin: "", email: "matheus@consultio.com", passwordHash: "$2b$10$/iIrNZUoAHh6XMpGOzBlS.WzC1KkWfSYSQIdT97jHz.hh.nQBapU.", isActive: true },
  { id: "u-recepcao", name: "Recepcao", role: "reception", pin: "", email: "recepcao@consultio.com", passwordHash: "$2b$10$WA.tB8rEKfQDewH6gKGmkum5Y6HeCn7Soy4N4GxIjC8BGsUiVkBPW", isActive: true },
  { id: "u-financeiro", name: "Financeiro", role: "finance", pin: "", email: "financeiro@consultio.com", passwordHash: "$2b$10$6CQEXOP2DbDxFTilSjHYUeSibTHONqW0rISMoCzNUitYbMwU7rWOy", isActive: true }
];
