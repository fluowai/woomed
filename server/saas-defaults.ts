import { SaaSPlan } from "../src/types";

export const DEFAULT_SAAS_PLANS: SaaSPlan[] = [
  {
    id: "plan-starter",
    code: "STARTER",
    name: "Starter / Básico",
    description: "Ideal para pequenas clínicas e consultórios iniciarem com limites essenciais.",
    priceCents: 9900,
    currency: "BRL",
    billingInterval: "month",
    limits: {
      users: 2,
      doctors: 2,
      agents: 1,
      whatsapp_connections: 1,
      patients: 300,
      ai_messages_month: 300
    },
    features: {
      agenda: true,
      pacientes: true,
      prontuarios: true,
      profissionais: true,
      acessos: true,
      whatsapp: true,
      ai: true,
      crm: false,
      financeiro: false,
      marketing: false,
      tiss: false,
      estoque: false,
      automacao: false,
      nps_lgpd: false,
      relatorios: false,
      ajuda: true,
      indique_ganhe: false,
      referencias: true,
      consulta_interativa: false,
      llms: false,
      neural: false
    },
    isActive: true,
    sortOrder: 10,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z"
  },
  {
    id: "plan-professional",
    code: "PROFESSIONAL",
    name: "Profissional",
    description: "Operação completa para clínicas em crescimento com IA, WhatsApp, CRM e Financeiro.",
    priceCents: 24900,
    currency: "BRL",
    billingInterval: "month",
    limits: {
      users: 10,
      doctors: 5,
      agents: 5,
      whatsapp_connections: 3,
      patients: 3000,
      ai_messages_month: 3000
    },
    features: {
      agenda: true,
      pacientes: true,
      prontuarios: true,
      profissionais: true,
      acessos: true,
      whatsapp: true,
      ai: true,
      crm: true,
      financeiro: true,
      marketing: true,
      tiss: true,
      estoque: true,
      automacao: true,
      nps_lgpd: true,
      relatorios: true,
      ajuda: true,
      indique_ganhe: true,
      referencias: true,
      consulta_interativa: true,
      llms: true,
      neural: true
    },
    isActive: true,
    sortOrder: 20,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z"
  },
  {
    id: "plan-enterprise",
    code: "ENTERPRISE",
    name: "Enterprise / Ilimitado",
    description: "Plano corporativo sem restrições para grandes redes e franquias.",
    priceCents: 49900,
    currency: "BRL",
    billingInterval: "month",
    limits: {
      users: 999,
      doctors: 999,
      agents: 999,
      whatsapp_connections: 20,
      patients: 100000,
      ai_messages_month: 50000
    },
    features: {
      agenda: true,
      pacientes: true,
      prontuarios: true,
      profissionais: true,
      acessos: true,
      whatsapp: true,
      ai: true,
      crm: true,
      financeiro: true,
      marketing: true,
      tiss: true,
      estoque: true,
      automacao: true,
      nps_lgpd: true,
      relatorios: true,
      ajuda: true,
      indique_ganhe: true,
      referencias: true,
      consulta_interativa: true,
      llms: true,
      neural: true,
      custom_sla: true
    },
    isActive: true,
    sortOrder: 30,
    createdAt: "2026-06-23T00:00:00.000Z",
    updatedAt: "2026-06-23T00:00:00.000Z"
  }
];

export function mergeDefaultPlans(plans?: SaaSPlan[]): SaaSPlan[] {
  const safePlans = Array.isArray(plans) ? plans : [];
  const byCode = new Map(safePlans.map(plan => [plan.code ? plan.code.toUpperCase() : "", plan]));
  byCode.delete("");
  for (const plan of DEFAULT_SAAS_PLANS) {
    const existing = byCode.get(plan.code);
    if (existing) {
      byCode.set(plan.code, {
        ...plan,
        ...existing,
        limits: { ...plan.limits, ...existing.limits },
        features: { ...plan.features, ...existing.features }
      });
    } else {
      byCode.set(plan.code, plan);
    }
  }
  return Array.from(byCode.values()).sort((a, b) => a.sortOrder - b.sortOrder);
}
