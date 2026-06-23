import { SaaSPlan } from "../src/types";

export const DEFAULT_SAAS_PLANS: SaaSPlan[] = [
  {
    id: "plan-starter",
    code: "STARTER",
    name: "Starter",
    description: "Base para clinicas pequenas validarem agenda, pacientes e atendimento digital.",
    priceCents: 9900,
    currency: "BRL",
    billingInterval: "month",
    limits: { users: 3, patients: 300, whatsapp_connections: 1, ai_messages_month: 300 },
    features: { whatsapp: true, ai: true, agenda: true, financeiro: false, marketing: false },
    isActive: true,
    sortOrder: 10,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z"
  },
  {
    id: "plan-professional",
    code: "PROFESSIONAL",
    name: "Profissional",
    description: "Operacao completa para clinicas em crescimento com IA, WhatsApp e financeiro.",
    priceCents: 24900,
    currency: "BRL",
    billingInterval: "month",
    limits: { users: 10, patients: 2000, whatsapp_connections: 3, ai_messages_month: 2000 },
    features: { whatsapp: true, ai: true, agenda: true, financeiro: true, marketing: true },
    isActive: true,
    sortOrder: 20,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z"
  },
  {
    id: "plan-enterprise",
    code: "ENTERPRISE",
    name: "Enterprise",
    description: "Plano sob medida para redes, franquias e operacoes multiunidade.",
    priceCents: 0,
    currency: "BRL",
    billingInterval: "month",
    limits: { users: 999, patients: 100000, whatsapp_connections: 20, ai_messages_month: 20000 },
    features: { whatsapp: true, ai: true, agenda: true, financeiro: true, marketing: true, custom_sla: true },
    isActive: true,
    sortOrder: 30,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z"
  }
];

export function mergeDefaultPlans(plans: SaaSPlan[]): SaaSPlan[] {
  const byCode = new Map(plans.map(plan => [plan.code.toUpperCase(), plan]));
  for (const plan of DEFAULT_SAAS_PLANS) {
    if (!byCode.has(plan.code)) {
      byCode.set(plan.code, plan);
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}
