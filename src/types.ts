/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type AppointmentStatus = 'atendido' | 'em_atendimento' | 'paciente_no_local' | 'confirmado' | 'agendado' | 'desmarcado';

export interface Appointment {
  id: string;
  doctorId: string; // Linked to a doctor
  date: string;    // YYYY-MM-DD
  timeStart: string;
  timeEnd: string;
  patientName: string;
  status: AppointmentStatus;
  type: string;
  isPrivate: boolean;
  observations: string;
  arrival?: string;
  recordStatus: 'incluso' | 'pendente' | 'desmarcado';
  paymentStatus: 'paid' | 'pending' | 'free';
}

export type UserRole = 'super_admin' | 'admin' | 'doctor' | 'reception' | 'finance';

export interface AppUser {
  id: string;
  name: string;
  email?: string;
  role: UserRole;
  specialty?: string;
  tenantId?: string;
  isActive?: boolean;
}

export type PlatformOwnerRole = 'super_admin' | 'ops' | 'support' | 'billing';
export type TenantStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type TenantMemberRole = 'owner' | 'admin' | 'doctor' | 'reception' | 'finance' | 'support';
export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'paused' | 'cancelled';
export type SupportTicketStatus = 'open' | 'in_progress' | 'waiting_customer' | 'resolved' | 'closed';
export type SupportTicketPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface SaaSPlan {
  id: string;
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  billingInterval: 'month' | 'year';
  limits: Record<string, number>;
  features: Record<string, boolean | string | number>;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Tenant {
  id: string;
  slug: string;
  legalName: string;
  tradeName: string;
  document?: string;
  ownerName?: string;
  ownerEmail?: string;
  phone?: string;
  status: TenantStatus;
  planId?: string;
  timezone: string;
  locale: string;
  settings: Record<string, unknown>;
  trialEndsAt?: string;
  suspendedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformOwner {
  id: string;
  userId: string;
  role: PlatformOwnerRole;
  displayName: string;
  email: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TenantMember {
  id: string;
  tenantId: string;
  userId: string;
  role: TenantMemberRole;
  displayName: string;
  email: string;
  phone?: string;
  isActive: boolean;
  invitedAt?: string;
  joinedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Subscription {
  id: string;
  tenantId: string;
  planId?: string;
  status: SubscriptionStatus;
  billingProvider?: string;
  providerCustomerId?: string;
  providerSubscriptionId?: string;
  currentPeriodStart?: string;
  currentPeriodEnd?: string;
  trialEndsAt?: string;
  cancelAt?: string;
  cancelledAt?: string;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UsageCounter {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  activeUsers: number;
  whatsappConnections: number;
  whatsappMessagesSent: number;
  aiMessages: number;
  appointmentsCount: number;
  storageBytes: number;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface SaaSSupportTicket {
  id: string;
  tenantId?: string;
  openedByUserId?: string;
  assignedOwnerId?: string;
  subject: string;
  description: string;
  category: string;
  status: SupportTicketStatus;
  priority: SupportTicketPriority;
  closedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AuditEvent {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
}

export interface ServicePrice {
  id: string;
  name: string;
  value: number;
  category: string;
}

export interface ProcedureCatalogItem {
  id: string;
  name: string;
  aliases: string[];
  category: string;
  specialty: string;
  doctorId?: string;
  doctorName?: string;
  description: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'document';
  mediaCaption?: string;
  price?: number;
  requiresEvaluation: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface FinanceTransaction {
  id: string;
  date: string;
  description: string;
  value: number;
  category: string;
  type: 'receita' | 'despesa';
  status: 'concluido' | 'pendente';
  source?: 'appointment' | 'manual';
  appointmentId?: string;
}

export type ChannelType = 'whatsapp' | 'instagram' | 'site' | 'email' | 'phone';

export interface ServiceAgent {
  id: string;
  name: string;
  channel: ChannelType;
  objective: string;
  tone: string;
  status: 'active' | 'draft' | 'paused';
  escalationTo: string;
  workingHours: string;
  rules: string[];
  knowledgeBase: string[];
  connectionId?: string;
  createdAt: string;
}

export type AiServiceStatus = 'active' | 'paused';

export interface AgentConversationControl {
  id: string;
  contactId: string;
  contactPhone: string;
  channel: ChannelType;
  connectionId?: string;
  aiService: AiServiceStatus;
  pausedReason?: string;
  pausedBy?: string;
  pausedAt?: string;
  resumeAt?: string;
  lastHumanMessageAt?: string;
  lastAiMessageAt?: string;
  updatedAt: string;
  createdAt: string;
}

export type LlmProvider = 'openai' | 'gemini' | 'anthropic' | 'groq' | 'local';

export interface LlmProviderConfig {
  id: string;
  name: string;
  provider: LlmProvider;
  model: string;
  apiKeyMasked?: string;
  endpoint?: string;
  temperature: number;
  maxTokens: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AgentTemplate {
  id: string;
  name: string;
  segment: 'saude' | 'beleza' | 'saude_e_beleza';
  channel: ChannelType;
  objective: string;
  tone: string;
  escalationTo: string;
  workingHours: string;
  rules: string[];
  knowledgeBase: string[];
  autonomousActions: string[];
}

export type NeuralKnowledgeStatus = 'draft' | 'indexed' | 'archived';

export interface NeuralKnowledgeItem {
  id: string;
  title: string;
  category: string;
  content: string;
  sourceType: 'manual' | 'url' | 'file';
  sourceUrl?: string;
  targetAgentIds: string[];
  tags: string[];
  status: NeuralKnowledgeStatus;
  createdAt: string;
  updatedAt: string;
}

export interface MarketingCampaign {
  id: string;
  referredName: string;
  status: 'invited' | 'scheduled' | 'converted' | 'rewarded';
  reward: string;
  createdAt: string;
}

export interface ReferenceMaterial {
  id: string;
  title: string;
  category: string;
  url: string;
  summary: string;
  updatedAt: string;
}

export interface HelpTicket {
  id: string;
  title: string;
  module: string;
  priority: 'low' | 'medium' | 'high';
  status: 'open' | 'in_progress' | 'resolved';
  description: string;
  createdAt: string;
}

export type WhatsAppConnectionStatus = 'disconnected' | 'connecting' | 'qr' | 'connected' | 'error';

export interface WhatsAppConnection {
  id: string;
  name: string;
  phoneNumber: string;
  normalizedPhone: string;
  provider: 'whatsmeow';
  status: WhatsAppConnectionStatus;
  deviceJid?: string;
  qrCode?: string;
  profileImageUrl?: string;
  lastSyncAt?: string;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export type WhatsAppConversationKind = 'direct' | 'group';

export interface WhatsAppParticipant {
  id: string;
  jid: string;
  phone?: string;
  name: string;
  pushName?: string;
  profileImageUrl?: string;
}

export interface WhatsAppConversation {
  id: string;
  connectionId: string;
  jid: string;
  kind: WhatsAppConversationKind;
  title: string;
  leadName: string;
  pushName?: string;
  phone?: string;
  normalizedPhone?: string;
  profileImageUrl?: string;
  groupName?: string;
  participantCount?: number;
  participants: WhatsAppParticipant[];
  lastMessagePreview: string;
  unreadCount: number;
  updatedAt: string;
}

export type WhatsAppMessageType = 'text' | 'image' | 'audio' | 'video' | 'document' | 'unknown';

export interface WhatsAppMessage {
  id: string;
  connectionId: string;
  conversationId: string;
  messageId: string;
  fromMe: boolean;
  senderJid: string;
  senderPhone?: string;
  senderPushName?: string;
  senderDisplayName: string;
  body: string;
  type: WhatsAppMessageType;
  mediaUrl?: string;
  mediaMimeType?: string;
  mediaFileName?: string;
  mediaSize?: number;
  mediaDurationSeconds?: number;
  thumbnailUrl?: string;
  timestamp: string;
  status?: 'sent' | 'delivered' | 'read' | 'received';
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  crm?: string;
  email?: string;
  phone?: string;
  userId?: string;
  availableDays: string[]; // ['Monday', 'Wednesday', ...]
  workingHours: {
    start: string; // '08:00'
    end: string;   // '18:00'
  };
}

export interface Patient {
  id: string;
  fullName: string;
  birthDate: string;
  cpf: string;
  phone: string;
  email: string;
  avatarUrl?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  // Phase 2 additions
  healthPlan?: string;
  healthPlanNumber?: string;
  emergencyContact?: string;
  emergencyPhone?: string;
  responsibleName?: string;
  responsibleCpf?: string;
  notes?: string;
  lgpdConsent?: boolean;
  lgpdConsentAt?: string;
  lgpdConsentVersion?: number;
}

export interface PatientDocument {
  id: string;
  patientId: string;
  name: string;
  type: 'exame' | 'imagem' | 'receita' | 'atestado' | 'contrato' | 'outro';
  url: string;
  uploadedAt: string;
  uploadedBy: string;
  notes?: string;
}

export interface MedicalRecordEntry {
  id: string;
  date: string;
  doctorName: string;
  notes: string;
  diagnosis?: string;
  prescription?: string;
  // Phase 2 additions
  attachments?: string[];
  isDigitalPrescription?: boolean;
  doctorCrm?: string;
}

export interface MedicalRecord {
  patientId: string;
  bloodType: string;
  gender: string;
  allergies: string[];
  medications: string[];
  chronicDiseases: string[];
  entries: MedicalRecordEntry[];
}

export interface MedicalTemplate {
  id: string;
  name: string;
  specialty: string;
  templateType: 'evolucao' | 'prescricao' | 'atestado' | 'exame';
  content: string;
  createdAt: string;
}

export interface WaitingListEntry {
  id: string;
  patientId: string;
  patientName: string;
  doctorId: string;
  preferredDate: string;
  preferredTime: string;
  procedure: string;
  status: 'waiting' | 'notified' | 'scheduled' | 'cancelled';
  created_at: string;
  notifiedAt?: string;
  notes?: string;
}

export interface ScheduleBlock {
  id: string;
  doctorId: string;
  date: string;
  startTime: string;
  endTime: string;
  type: 'ferias' | 'feriado' | 'folga' | 'outro';
  reason?: string;
  createdAt: string;
}

export interface AccountsPayable {
  id: string;
  description: string;
  value: number;
  category: string;
  dueDate: string;
  status: 'pending' | 'paid' | 'overdue';
  paidAt?: string;
  recurring: boolean;
  recurrenceInterval?: 'monthly' | 'yearly';
  supplier?: string;
  notes?: string;
  createdAt: string;
}

export interface DreEntry {
  month: string;
  revenue: number;
  expenses: number;
  netResult: number;
  revenueBySource: Record<string, number>;
  expensesByCategory: Record<string, number>;
}

export interface PaymentGatewayConfig {
  provider: 'mercadopago' | 'stripe' | 'pix';
  enabled: boolean;
  apiKey: string;
  secretKey?: string;  // Para providers como Stripe que usam secret key
  webhookSecret: string;
  pixKey?: string;
}

// ============================================================
// CRM - Lead Sources
// ============================================================
export type LeadSourceChannel = 'whatsapp' | 'instagram' | 'facebook' | 'site' | 'google_ads' | 'meta_ads' | 'indicacao' | 'email' | 'telefone' | 'presencial' | 'outro';
export type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'won' | 'lost';
export type LeadRating = 'frio' | 'morno' | 'quente';
export type OpportunityStage = 'lead_qualificado' | 'agendamento_pendente' | 'agendado' | 'compareceu' | 'proposta' | 'fechado' | 'perdido';

export interface LeadSource {
  id: string;
  tenantId?: string;
  name: string;
  channel: LeadSourceChannel;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmPipeline {
  id: string;
  tenantId?: string;
  name: string;
  description: string;
  stages: { name: string; order: number; probability: number }[];
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CrmLead {
  id: string;
  tenantId?: string;
  pipelineId?: string;
  fullName: string;
  email?: string;
  phone: string;
  normalizedPhone?: string;
  source: LeadSourceChannel;
  sourceId?: string;
  campaignId?: string;
  channelConversationId?: string;
  rating: LeadRating;
  tags: string[];
  notes?: string;
  customFields: Record<string, unknown>;
  assignedTo?: string;
  convertedToPatientId?: string;
  convertedAt?: string;
  status: LeadStatus;
  estimatedValue: number;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmOpportunity {
  id: string;
  tenantId?: string;
  pipelineId: string;
  leadId?: string;
  patientId?: string;
  stage: OpportunityStage;
  stageOrder: number;
  title: string;
  value: number;
  probability: number;
  expectedCloseDate?: string;
  assignedTo?: string;
  notes?: string;
  lostReason?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CrmInteraction {
  id: string;
  tenantId?: string;
  leadId?: string;
  opportunityId?: string;
  patientId?: string;
  channel: LeadSourceChannel;
  type: string;
  summary: string;
  details: Record<string, unknown>;
  performedBy?: string;
  performedAt: string;
  createdAt: string;
}

export interface CrmTask {
  id: string;
  tenantId?: string;
  leadId?: string;
  opportunityId?: string;
  title: string;
  description?: string;
  dueDate?: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// NPS / Satisfação
// ============================================================
export interface NpsSurvey {
  id: string;
  tenantId?: string;
  name: string;
  question: string;
  sendAfterHours: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NpsResponse {
  id: string;
  tenantId?: string;
  surveyId: string;
  patientId: string;
  appointmentId?: string;
  score: number;
  category: 'detrator' | 'neutro' | 'promotor';
  comment?: string;
  respondedAt: string;
  createdAt: string;
}

export interface NpsMetrics {
  totalResponses: number;
  npsScore: number;
  promoters: number;
  promotersPercent: number;
  neutrals: number;
  neutralsPercent: number;
  detractors: number;
  detractorsPercent: number;
  responsesByScore: Record<number, number>;
  period: { start: string; end: string };
}

// ============================================================
// Automação / Lembretes
// ============================================================
export type ReminderChannel = 'whatsapp' | 'sms' | 'email';
export type ReminderStatus = 'pending' | 'sent' | 'delivered' | 'failed';

export interface AutomationTemplate {
  id: string;
  tenantId?: string;
  name: string;
  channel: ReminderChannel;
  triggerEvent: 'appointment_confirmed' | 'appointment_reminder' | 'post_appointment' | 'birthday' | 'no_show' | 'custom';
  delayMinutes: number;
  messageTemplate: string;
  variables: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AutomationReminder {
  id: string;
  tenantId?: string;
  templateId?: string;
  appointmentId?: string;
  patientId: string;
  channel: ReminderChannel;
  destination: string;
  message: string;
  status: ReminderStatus;
  sentAt?: string;
  deliveredAt?: string;
  error?: string;
  scheduledFor: string;
  createdAt: string;
}

// ============================================================
// Portal do Paciente
// ============================================================
export interface PatientPortalLogin {
  id: string;
  tenantId?: string;
  patientId: string;
  email: string;
  passwordHash?: string;
  isActive: boolean;
  lastLoginAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientPortalToken {
  id: string;
  tenantId?: string;
  patientId: string;
  token: string;
  expiresAt: string;
  usedAt?: string;
  createdAt: string;
}

export interface PatientSatisfactionRating {
  id: string;
  tenantId?: string;
  patientId: string;
  appointmentId?: string;
  rating: number;
  feedback?: string;
  createdAt: string;
}

// ============================================================
// LGPD
// ============================================================
export type ConsentType = 'tratamento_dados' | 'comunicacao_whatsapp' | 'comunicacao_email' | 'comunicacao_sms' | 'pesquisa_satisfacao' | 'termo_servico' | 'politica_privacidade';
export type ConsentStatus = 'granted' | 'revoked' | 'expired';
export type DsarType = 'export' | 'rectification' | 'anonymization' | 'deletion' | 'access';
export type DsarStatus = 'pending' | 'processing' | 'completed' | 'rejected';

export interface LgpdConsentTemplate {
  id: string;
  tenantId?: string;
  type: ConsentType;
  title: string;
  description: string;
  version: number;
  isRequired: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LgpdPatientConsent {
  id: string;
  tenantId?: string;
  patientId: string;
  consentTemplateId: string;
  status: ConsentStatus;
  grantedAt: string;
  revokedAt?: string;
  createdAt: string;
}

export interface LgpdDataSubjectRequest {
  id: string;
  tenantId?: string;
  patientId: string;
  type: DsarType;
  status: DsarStatus;
  description?: string;
  requestData: Record<string, unknown>;
  responseData?: Record<string, unknown>;
  processedBy?: string;
  processedAt?: string;
  expiresAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface LgpdSensitiveAccessLog {
  id: string;
  tenantId?: string;
  patientId: string;
  actorId: string;
  actorName: string;
  accessType: 'view' | 'edit' | 'export';
  entityType: string;
  entityId: string;
  reason: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
}

// ============================================================
// Profissionais / Unidades / Salas
// ============================================================
export interface ProfessionalUnit {
  id: string;
  tenantId?: string;
  name: string;
  address: { street?: string; city?: string; state?: string; zip?: string };
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProfessionalRoom {
  id: string;
  tenantId?: string;
  unitId: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ============================================================
// Marketing Campaigns (new version)
// ============================================================
export interface MarketingCampaignV2 {
  id: string;
  tenantId?: string;
  name: string;
  description?: string;
  channel?: LeadSourceChannel;
  type: 'geral' | 'whatsapp' | 'email' | 'sms' | 'meta_ads' | 'google_ads';
  status: 'draft' | 'scheduled' | 'running' | 'paused' | 'finished' | 'cancelled';
  goal?: string;
  targetAudience?: string;
  budget: number;
  spent: number;
  leadsGenerated: number;
  conversions: number;
  roi: number;
  scheduledAt?: string;
  startedAt?: string;
  finishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_SERVICE_PRICES: ServicePrice[] = [
  { id: 'svc-particular', name: 'Consulta Particular', value: 300, category: 'Procedimentos Clinicos' },
  { id: 'svc-convenio', name: 'Consulta Convenio', value: 150, category: 'Procedimentos Clinicos' },
  { id: 'svc-primeira', name: 'Primeira Consulta', value: 250, category: 'Procedimentos Clinicos' },
  { id: 'svc-retorno', name: 'Retorno de Exames', value: 0, category: 'Retornos' },
  { id: 'svc-retorno-simples', name: 'Retorno', value: 0, category: 'Retornos' }
];
