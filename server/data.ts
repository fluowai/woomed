import path from "path";
import fs from "fs/promises";
import { isDatabaseAvailable } from "./database";
import { AppUser, Patient, Doctor, Appointment, MedicalRecord, FinanceTransaction, ServicePrice, AuditEvent, ServiceAgent, MarketingCampaign, TissGuide, InventoryItem, ReferralRecord, ReferenceMaterial, HelpTicket, WhatsAppConnection, WhatsAppConversation, WhatsAppMessage, PatientDocument, WaitingListEntry, ScheduleBlock, MedicalTemplate, AccountsPayable, PaymentGatewayConfig, LlmProviderConfig, AgentTemplate, NeuralKnowledgeItem, Tenant, SaaSPlan, PlatformOwner, DEFAULT_SERVICE_PRICES } from "../src/types";
import { DEFAULT_AGENT_TEMPLATES, DEFAULT_LLM_PROVIDER_CONFIGS, DEFAULT_NEURAL_KNOWLEDGE } from "../src/aiCatalog";

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

export function defaultData(): AppData {
  return {
    users: seedUsers,
    patients: [],
    doctors: [],
    appointments: [],
    medicalRecords: {},
    financeTransactions: [],
    servicePrices: DEFAULT_SERVICE_PRICES,
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
    plans: [],
    platformOwners: []
  };
}

export async function loadData(): Promise<AppData> {
  if (cachedData) return cachedData;

  try {
    const raw = await fs.readFile(dataFile, "utf-8");
    const parsed = JSON.parse(raw) as Partial<AppData>;
    const def = defaultData();
    cachedData = {
      users: parsed.users?.length ? hydrateSeedUserFields(parsed.users as ServerUser[]) : def.users,
      patients: parsed.patients?.length ? parsed.patients as Patient[] : def.patients,
      doctors: parsed.doctors?.length ? parsed.doctors as Doctor[] : def.doctors,
      appointments: parsed.appointments?.length ? parsed.appointments as Appointment[] : def.appointments,
      medicalRecords: parsed.medicalRecords || def.medicalRecords,
      financeTransactions: parsed.financeTransactions || def.financeTransactions,
      servicePrices: parsed.servicePrices || def.servicePrices,
      auditEvents: parsed.auditEvents || [],
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
      patientDocuments: parsed.patientDocuments || [],
      waitingList: parsed.waitingList || [],
      scheduleBlocks: parsed.scheduleBlocks || [],
      medicalTemplates: parsed.medicalTemplates || [],
      accountsPayable: parsed.accountsPayable || [],
      paymentGatewayConfig: parsed.paymentGatewayConfig || [],
      llmProviderConfigs: parsed.llmProviderConfigs || def.llmProviderConfigs,
      agentTemplates: parsed.agentTemplates || def.agentTemplates,
      neuralKnowledge: parsed.neuralKnowledge || def.neuralKnowledge,
      tenants: parsed.tenants || def.tenants,
      plans: parsed.plans || def.plans,
      platformOwners: parsed.platformOwners || def.platformOwners
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
