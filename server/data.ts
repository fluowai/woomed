import path from "path";
import fs from "fs/promises";
import { AppUser, Patient, Doctor, Appointment, MedicalRecord, FinanceTransaction, ServicePrice, AuditEvent, ServiceAgent, MarketingCampaign, TissGuide, InventoryItem, ReferralRecord, ReferenceMaterial, HelpTicket, WhatsAppConnection, WhatsAppConversation, WhatsAppMessage, PatientDocument, WaitingListEntry, ScheduleBlock, MedicalTemplate, AccountsPayable, PaymentGatewayConfig, DEFAULT_SERVICE_PRICES, MOCK_PATIENTS, MOCK_DOCTORS, MOCK_APPOINTMENTS, MOCK_MEDICAL_RECORDS, MOCK_FINANCE_TRANSACTIONS, MOCK_SERVICE_AGENTS, MOCK_MARKETING_CAMPAIGNS, MOCK_TISS_GUIDES, MOCK_INVENTORY_ITEMS, MOCK_REFERRALS, MOCK_REFERENCES, MOCK_HELP_TICKETS, MOCK_WHATSAPP_CONNECTIONS, MOCK_WHATSAPP_CONVERSATIONS, MOCK_WHATSAPP_MESSAGES } from "../src/types";

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
    patients: MOCK_PATIENTS,
    doctors: MOCK_DOCTORS,
    appointments: MOCK_APPOINTMENTS,
    medicalRecords: MOCK_MEDICAL_RECORDS,
    financeTransactions: MOCK_FINANCE_TRANSACTIONS,
    servicePrices: DEFAULT_SERVICE_PRICES,
    auditEvents: [],
    serviceAgents: MOCK_SERVICE_AGENTS,
    marketingCampaigns: MOCK_MARKETING_CAMPAIGNS,
    tissGuides: MOCK_TISS_GUIDES,
    inventoryItems: MOCK_INVENTORY_ITEMS,
    referrals: MOCK_REFERRALS,
    references: MOCK_REFERENCES,
    helpTickets: MOCK_HELP_TICKETS,
    whatsappConnections: MOCK_WHATSAPP_CONNECTIONS,
    whatsappConversations: MOCK_WHATSAPP_CONVERSATIONS,
    whatsappMessages: MOCK_WHATSAPP_MESSAGES,
    patientDocuments: [],
    waitingList: [],
    scheduleBlocks: [],
    medicalTemplates: [],
    accountsPayable: [],
    paymentGatewayConfig: []
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
      paymentGatewayConfig: parsed.paymentGatewayConfig || []
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
