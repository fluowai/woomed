import path from "path";
import fs from "fs/promises";
import { isDatabaseAvailable } from "./database";
import { ensureDecrypted } from "./crypto";
import { AppUser, Patient, Doctor, Appointment, MedicalRecord, FinanceTransaction, ServicePrice, AuditEvent, ServiceAgent, MarketingCampaign, TissGuide, InventoryItem, ReferralRecord, ReferenceMaterial, HelpTicket, WhatsAppConnection, WhatsAppConversation, WhatsAppMessage, PatientDocument, WaitingListEntry, ScheduleBlock, MedicalTemplate, AccountsPayable, PaymentGatewayConfig, LlmProviderConfig, AgentTemplate, NeuralKnowledgeItem, Tenant, SaaSPlan, PlatformOwner, LeadSource, CrmPipeline, CrmLead, CrmOpportunity, CrmInteraction, CrmTask, NpsSurvey, NpsResponse, AutomationTemplate, AutomationReminder, LgpdConsentTemplate, LgpdPatientConsent, LgpdDataSubjectRequest, LgpdSensitiveAccessLog, ProfessionalUnit, ProfessionalRoom, PatientPortalLogin, PatientPortalToken, PatientSatisfactionRating, ProcedureCatalogItem, AgentConversationControl, DEFAULT_SERVICE_PRICES } from "../src/types";
import { DEFAULT_AGENT_TEMPLATES, DEFAULT_LLM_PROVIDER_CONFIGS, DEFAULT_NEURAL_KNOWLEDGE } from "../src/aiCatalog";
import { DEFAULT_SAAS_PLANS, mergeDefaultPlans } from "./saas-defaults";

export interface ServerUser extends AppUser {
  pin: string;
  email?: string;
  passwordHash?: string;
  mfaSecret?: string;
  mfaEnabled?: boolean;
  isActive?: boolean;
  tenantId?: string;
}

export interface AppData {
  users: ServerUser[];
  patients: Patient[];
  doctors: Doctor[];
  appointments: Appointment[];
  medicalRecords: Record<string, MedicalRecord>;
  financeTransactions: FinanceTransaction[];
  servicePrices: ServicePrice[];
  procedureCatalog: ProcedureCatalogItem[];
  agentConversationControls: AgentConversationControl[];
  auditEvents: AuditEvent[];
  serviceAgents: ServiceAgent[];
  marketingCampaigns: MarketingCampaign[];
  tissGuides: TissGuide[];
  inventoryItems: InventoryItem[];
  referrals: ReferralRecord[];
  references: ReferenceMaterial[];
  helpTickets: HelpTicket[];
  whatsappConnections: WhatsAppConnection[];
  whatsappConversations: WhatsAppConversation[];
  whatsappMessages: WhatsAppMessage[];
  patientDocuments: PatientDocument[];
  waitingList: WaitingListEntry[];
  scheduleBlocks: ScheduleBlock[];
  medicalTemplates: MedicalTemplate[];
  accountsPayable: AccountsPayable[];
  paymentGatewayConfig: PaymentGatewayConfig[];
  llmProviderConfigs: LlmProviderConfig[];
  agentTemplates: AgentTemplate[];
  neuralKnowledge: NeuralKnowledgeItem[];
  tenants: Tenant[];
  plans: SaaSPlan[];
  platformOwners: PlatformOwner[];
  leadSources: LeadSource[];
  crmPipelines: CrmPipeline[];
  crmLeads: CrmLead[];
  crmOpportunities: CrmOpportunity[];
  crmInteractions: CrmInteraction[];
  crmTasks: CrmTask[];
  npsSurveys: NpsSurvey[];
  npsResponses: NpsResponse[];
  automationTemplates: AutomationTemplate[];
  automationReminders: AutomationReminder[];
  lgpdConsentTemplates: LgpdConsentTemplate[];
  lgpdPatientConsents: LgpdPatientConsent[];
  lgpdDataSubjectRequests: LgpdDataSubjectRequest[];
  lgpdSensitiveAccessLogs: LgpdSensitiveAccessLog[];
  professionalUnits: ProfessionalUnit[];
  professionalRooms: ProfessionalRoom[];
  patientPortalLogins: PatientPortalLogin[];
  patientPortalTokens: PatientPortalToken[];
  patientSatisfactionRatings: PatientSatisfactionRating[];
}

export const dataDir = path.join(process.cwd(), "data");
export const dataFile = path.join(dataDir, "consultio-data.json");

let cachedData: AppData | null = null;

import { seedUsers } from "./seed";

function hydrateSeedUserFields(users: ServerUser[]): ServerUser[] {
  return users.map(user => {
    const seeded = seedUsers.find(seed => seed.id === user.id);
    return seeded ? { ...seeded, ...user, passwordHash: user.passwordHash || seeded.passwordHash, email: user.email || seeded.email, isActive: user.isActive ?? seeded.isActive } : user;
  });
}

function mergeProcedureCatalog(parsed: ProcedureCatalogItem[] | undefined, defaults: ProcedureCatalogItem[]): ProcedureCatalogItem[] {
  const existing = Array.isArray(parsed) ? parsed : [];
  const ids = new Set(existing.map(item => item.id));
  return [...existing, ...defaults.filter(item => !ids.has(item.id))];
}

export function defaultData(): AppData {
  return {
    users: seedUsers,
    patients: [],
    doctors: [],
    appointments: [],
    medicalRecords: {},
    financeTransactions: [],
    servicePrices: DEFAULT_SERVICE_PRICES,
    procedureCatalog: [
      {
        id: "proc-toxina-botulinica",
        name: "Toxina Botulinica",
        aliases: ["botox", "rugas", "linhas de expressao", "pes de galinha", "testa"],
        category: "Estetica",
        specialty: "Dermatologia",
        description: "Aplicacao estetica para suavizar rugas de expressao. A avaliacao define indicacao, pontos e quantidade.",
        mediaCaption: "A toxina botulinica ajuda a suavizar linhas de expressao com resultado natural quando bem indicada.",
        mediaType: "image",
        requiresEvaluation: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "proc-limpeza-pele",
        name: "Limpeza de Pele",
        aliases: ["cravos", "espinhas", "pele oleosa", "poros", "limpeza facial"],
        category: "Estetica",
        specialty: "Estetica",
        description: "Procedimento para remover impurezas, controlar oleosidade e melhorar a textura da pele.",
        mediaCaption: "A limpeza de pele e indicada para renovar o aspecto da pele e reduzir impurezas.",
        mediaType: "image",
        requiresEvaluation: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "proc-clareamento-dental",
        name: "Clareamento Dental",
        aliases: ["dentes amarelos", "clarear dentes", "sorriso branco", "dentes manchados"],
        category: "Odontologia",
        specialty: "Odontologia",
        description: "Procedimento odontologico para clarear os dentes com acompanhamento profissional.",
        mediaCaption: "O clareamento dental pode deixar o sorriso mais claro com seguranca e acompanhamento.",
        mediaType: "image",
        requiresEvaluation: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      {
        id: "proc-implante-dentario",
        name: "Implante Dentario",
        aliases: ["implante", "dente perdido", "proteses", "protese fixa", "falta de dente", "repor dente"],
        category: "Odontologia",
        specialty: "Odontologia",
        description: "Procedimento para repor dentes perdidos com planejamento odontologico individual.",
        mediaCaption: "O implante dentario pode ajudar a recuperar funcao, estetica e seguranca ao sorrir.",
        mediaType: "image",
        requiresEvaluation: true,
        isActive: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
    ],
    agentConversationControls: [],
    auditEvents: [],
    serviceAgents: [],
    marketingCampaigns: [],
    tissGuides: [],
    inventoryItems: [],
    referrals: [],
    references: [],
    helpTickets: [],
    whatsappConnections: [],
    whatsappConversations: [],
    whatsappMessages: [],
    patientDocuments: [],
    waitingList: [],
    scheduleBlocks: [],
    medicalTemplates: [],
    accountsPayable: [],
    paymentGatewayConfig: [],
    llmProviderConfigs: DEFAULT_LLM_PROVIDER_CONFIGS,
    agentTemplates: DEFAULT_AGENT_TEMPLATES,
    neuralKnowledge: DEFAULT_NEURAL_KNOWLEDGE,
    tenants: [],
    plans: DEFAULT_SAAS_PLANS,
    platformOwners: [],
    leadSources: [],
    crmPipelines: [],
    crmLeads: [],
    crmOpportunities: [],
    crmInteractions: [],
    crmTasks: [],
    npsSurveys: [],
    npsResponses: [],
    automationTemplates: [],
    automationReminders: [],
    lgpdConsentTemplates: [],
    lgpdPatientConsents: [],
    lgpdDataSubjectRequests: [],
    lgpdSensitiveAccessLogs: [],
    professionalUnits: [],
    professionalRooms: [],
    patientPortalLogins: [],
    patientPortalTokens: [],
    patientSatisfactionRatings: []
  };
}

export async function loadData(): Promise<AppData> {
  if (cachedData) return cachedData;

  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const def = defaultData();
    cachedData = {
      ...def,
      users: parsed.users?.length ? hydrateSeedUserFields(parsed.users as ServerUser[]) : def.users,
      patients: parsed.patients?.length ? (parsed.patients as Patient[]).map(p => ({ ...p, cpf: ensureDecrypted(p.cpf), responsibleCpf: p.responsibleCpf ? ensureDecrypted(p.responsibleCpf) : p.responsibleCpf })) : def.patients,
      doctors: parsed.doctors?.length ? parsed.doctors as Doctor[] : def.doctors,
      appointments: parsed.appointments?.length ? parsed.appointments as Appointment[] : def.appointments,
      medicalRecords: parsed.medicalRecords || def.medicalRecords,
      financeTransactions: parsed.financeTransactions || def.financeTransactions,
      servicePrices: parsed.servicePrices || def.servicePrices,
      procedureCatalog: mergeProcedureCatalog(parsed.procedureCatalog as ProcedureCatalogItem[] | undefined, def.procedureCatalog),
      agentConversationControls: parsed.agentConversationControls || def.agentConversationControls,
      auditEvents: parsed.auditEvents || def.auditEvents,
      serviceAgents: parsed.serviceAgents || def.serviceAgents,
      marketingCampaigns: parsed.marketingCampaigns || def.marketingCampaigns,
      tissGuides: parsed.tissGuides || def.tissGuides,
      inventoryItems: parsed.inventoryItems || def.inventoryItems,
      referrals: parsed.referrals || def.referrals,
      references: parsed.references || def.references,
      helpTickets: parsed.helpTickets || def.helpTickets,
      whatsappConnections: parsed.whatsappConnections || def.whatsappConnections,
      whatsappConversations: parsed.whatsappConversations || def.whatsappConversations,
      whatsappMessages: parsed.whatsappMessages || def.whatsappMessages,
      patientDocuments: parsed.patientDocuments || def.patientDocuments,
      waitingList: parsed.waitingList || def.waitingList,
      scheduleBlocks: parsed.scheduleBlocks || def.scheduleBlocks,
      medicalTemplates: parsed.medicalTemplates || def.medicalTemplates,
      accountsPayable: parsed.accountsPayable || def.accountsPayable,
      paymentGatewayConfig: parsed.paymentGatewayConfig || def.paymentGatewayConfig,
      llmProviderConfigs: parsed.llmProviderConfigs || def.llmProviderConfigs,
      agentTemplates: parsed.agentTemplates || def.agentTemplates,
      neuralKnowledge: parsed.neuralKnowledge || def.neuralKnowledge,
      tenants: parsed.tenants || def.tenants,
      plans: mergeDefaultPlans(parsed.plans || def.plans),
      platformOwners: parsed.platformOwners || def.platformOwners,
      leadSources: parsed.leadSources || def.leadSources,
      crmPipelines: parsed.crmPipelines || def.crmPipelines,
      crmLeads: parsed.crmLeads || def.crmLeads,
      crmOpportunities: parsed.crmOpportunities || def.crmOpportunities,
      crmInteractions: parsed.crmInteractions || def.crmInteractions,
      crmTasks: parsed.crmTasks || def.crmTasks,
      npsSurveys: parsed.npsSurveys || def.npsSurveys,
      npsResponses: parsed.npsResponses || def.npsResponses,
      automationTemplates: parsed.automationTemplates || def.automationTemplates,
      automationReminders: parsed.automationReminders || def.automationReminders,
      lgpdConsentTemplates: parsed.lgpdConsentTemplates || def.lgpdConsentTemplates,
      lgpdPatientConsents: parsed.lgpdPatientConsents || def.lgpdPatientConsents,
      lgpdDataSubjectRequests: parsed.lgpdDataSubjectRequests || def.lgpdDataSubjectRequests,
      lgpdSensitiveAccessLogs: parsed.lgpdSensitiveAccessLogs || def.lgpdSensitiveAccessLogs,
      professionalUnits: parsed.professionalUnits || def.professionalUnits,
      professionalRooms: parsed.professionalRooms || def.professionalRooms,
      patientPortalLogins: parsed.patientPortalLogins || def.patientPortalLogins,
      patientPortalTokens: parsed.patientPortalTokens || def.patientPortalTokens,
      patientSatisfactionRatings: parsed.patientSatisfactionRatings || def.patientSatisfactionRatings
    };
    return cachedData;
  } catch {
    cachedData = defaultData();
    await saveData(cachedData);
    return cachedData;
  }
}

export async function saveData(data: AppData) {
  await fs.mkdir(dataDir, { recursive: true });
  await fs.writeFile(dataFile, JSON.stringify(data, null, 2), "utf-8");
}

export function invalidateCache() {
  cachedData = null;
}
