import {
  AccountsPayable,
  AgentTemplate,
  AppUser,
  Appointment,
  AuditEvent,
  Doctor,
  FinanceTransaction,
  HelpTicket,
  InventoryItem,
  LlmProviderConfig,
  MarketingCampaign,
  MedicalRecord,
  MedicalTemplate,
  NeuralKnowledgeItem,
  Patient,
  PatientDocument,
  PaymentGatewayConfig,
  ReferenceMaterial,
  ReferralRecord,
  SaaSPlan,
  ScheduleBlock,
  ServiceAgent,
  ServicePrice,
  Tenant,
  TissGuide,
  WaitingListEntry,
  CrmLead, CrmPipeline, CrmOpportunity, CrmTask, CrmInteraction, LeadSource,
  NpsSurvey, NpsResponse,
  AutomationTemplate, AutomationReminder,
  LgpdConsentTemplate, LgpdPatientConsent, LgpdDataSubjectRequest, LgpdSensitiveAccessLog,
  ProfessionalUnit, ProfessionalRoom,
  PatientPortalLogin, PatientSatisfactionRating
} from './types';

export interface BootstrapState {
  user: AppUser;
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
  llmProviderConfigs: LlmProviderConfig[];
  agentTemplates: AgentTemplate[];
  neuralKnowledge: NeuralKnowledgeItem[];
  patientDocuments: PatientDocument[];
  waitingList: WaitingListEntry[];
  scheduleBlocks: ScheduleBlock[];
  medicalTemplates: MedicalTemplate[];
  accountsPayable: AccountsPayable[];
  paymentGatewayConfig: PaymentGatewayConfig[];
  tenants?: Tenant[];
  plans?: SaaSPlan[];
  crmLeads?: CrmLead[];
  crmPipelines?: CrmPipeline[];
  crmOpportunities?: CrmOpportunity[];
  crmTasks?: CrmTask[];
  crmInteractions?: CrmInteraction[];
  leadSources?: LeadSource[];
  npsSurveys?: NpsSurvey[];
  npsResponses?: NpsResponse[];
  automationTemplates?: AutomationTemplate[];
  automationReminders?: AutomationReminder[];
  lgpdConsentTemplates?: LgpdConsentTemplate[];
  lgpdPatientConsents?: LgpdPatientConsent[];
  lgpdDataSubjectRequests?: LgpdDataSubjectRequest[];
  lgpdSensitiveAccessLogs?: LgpdSensitiveAccessLog[];
  professionalUnits?: ProfessionalUnit[];
  professionalRooms?: ProfessionalRoom[];
  patientPortalLogins?: PatientPortalLogin[];
  patientSatisfactionRatings?: PatientSatisfactionRating[];
  planFeatures?: Record<string, boolean | string | number>;
  planLimits?: Record<string, number>;
  currentPlan?: { id: string; code: string; name: string };
}

async function request<T>(path: string, token: string | null, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Content-Type', 'application/json');
  if (token) headers.set('Authorization', `Bearer ${token}`);

  const response = await fetch(path, {
    ...init,
    headers
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = [data.code, data.error, data.detail].filter(Boolean).join(' - ');
    throw new Error(detail || 'Erro ao comunicar com o servidor.');
  }
  return data as T;
}

export function apiGet<T>(path: string, token: string | null) {
  return request<T>(path, token);
}

export function apiPost<T>(path: string, token: string | null, body?: unknown) {
  return request<T>(path, token, {
    method: 'POST',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function apiPut<T>(path: string, token: string | null, body?: unknown) {
  return request<T>(path, token, {
    method: 'PUT',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function apiPatch<T>(path: string, token: string | null, body?: unknown) {
  return request<T>(path, token, {
    method: 'PATCH',
    body: body === undefined ? undefined : JSON.stringify(body)
  });
}

export function apiDelete<T>(path: string, token: string | null) {
  return request<T>(path, token, {
    method: 'DELETE'
  });
}

export async function fetchLoginUsers() {
  return request<AppUser[]>('/api/auth/users', null);
}

export async function login(userId: string, pin: string) {
  return request<{ token: string; user: AppUser; state: BootstrapState }>('/api/auth/login', null, {
    method: 'POST',
    body: JSON.stringify({ userId, pin })
  });
}
