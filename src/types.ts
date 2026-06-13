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
  role: UserRole;
  specialty?: string;
  tenantId?: string;
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
  name: string;
  audience: string;
  channel: ChannelType | 'sms';
  status: 'draft' | 'scheduled' | 'running' | 'finished';
  goal: string;
  scheduledDate: string;
  budget: number;
  leads: number;
}

export interface TissGuide {
  id: string;
  patientName: string;
  operator: string;
  procedure: string;
  status: 'draft' | 'authorized' | 'submitted' | 'glosa' | 'paid';
  value: number;
  createdAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantity: number;
  minQuantity: number;
  unit: string;
  expiresAt: string;
  supplier: string;
}

export interface ReferralRecord {
  id: string;
  patientName: string;
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

export const MOCK_PATIENTS: Patient[] = [
  {
    id: 'p1',
    fullName: 'Bruna Gabriel',
    birthDate: '1992-05-15',
    cpf: '123.456.789-00',
    phone: '(11) 98765-4321',
    email: 'bruna.gabriel@email.com',
    avatarUrl: undefined,
    address: {
      street: 'Av. Paulista, 1000',
      city: 'São Paulo',
      state: 'SP',
      zip: '01310-100'
    }
  },
  {
    id: 'p2',
    fullName: 'Camila Duarte',
    birthDate: '1988-11-22',
    cpf: '234.567.890-11',
    phone: '(11) 97654-3210',
    email: 'camila.duarte@email.com',
    avatarUrl: undefined,
    address: {
      street: 'Rua Augusta, 500',
      city: 'São Paulo',
      state: 'SP',
      zip: '01412-000'
    }
  },
  {
    id: 'p3',
    fullName: 'Marcos Oliveira',
    birthDate: '1975-03-30',
    cpf: '345.678.901-22',
    phone: '(11) 96543-2109',
    email: 'marcos.oliveira@email.com',
    avatarUrl: undefined,
    address: {
      street: 'Alameda Santos, 200',
      city: 'São Paulo',
      state: 'SP',
      zip: '01419-001'
    }
  }
];

export const MOCK_MEDICAL_RECORDS: Record<string, MedicalRecord> = {
  'p1': {
    patientId: 'p1',
    bloodType: 'A+',
    gender: 'Feminino',
    allergies: ['Amendoim', 'Penicilina'],
    medications: ['Loratadina'],
    chronicDiseases: ['Asma'],
    entries: [
      {
        id: 'e1',
        date: '2025-01-10',
        doctorName: 'Dr. Matheus',
        notes: 'Paciente relatou dores de cabeça frequentes.',
        diagnosis: 'Enxaqueca tensional',
        prescription: 'Dipirona 500mg'
      }
    ]
  }
};

export const MOCK_DOCTORS: Doctor[] = [
  {
    id: 'd1',
    name: 'Dr. Matheus',
    specialty: 'Cardiologista',
    availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
    workingHours: { start: '08:00', end: '18:00' }
  },
  {
    id: 'd2',
    name: 'Dra. Ana Paula',
    specialty: 'Dermatologista',
    availableDays: ['Tuesday', 'Thursday'],
    workingHours: { start: '09:00', end: '17:00' }
  }
];

export const DEFAULT_SERVICE_PRICES: ServicePrice[] = [
  { id: 'svc-particular', name: 'Consulta Particular', value: 300, category: 'Procedimentos Clinicos' },
  { id: 'svc-convenio', name: 'Consulta Convenio', value: 150, category: 'Procedimentos Clinicos' },
  { id: 'svc-primeira', name: 'Primeira Consulta', value: 250, category: 'Procedimentos Clinicos' },
  { id: 'svc-retorno', name: 'Retorno de Exames', value: 0, category: 'Retornos' },
  { id: 'svc-retorno-simples', name: 'Retorno', value: 0, category: 'Retornos' }
];

export const MOCK_FINANCE_TRANSACTIONS: FinanceTransaction[] = [
  {
    id: 't1',
    date: '2025-04-03',
    description: 'Aluguel do Consultorio',
    value: 1500,
    category: 'Despesa Operacional',
    type: 'despesa',
    status: 'concluido',
    source: 'manual'
  },
  {
    id: 't2',
    date: '2025-04-02',
    description: 'Material Clinico descartavel',
    value: 350,
    category: 'Insumos',
    type: 'despesa',
    status: 'concluido',
    source: 'manual'
  },
  {
    id: 't3',
    date: '2025-04-01',
    description: 'Consultoria de Marketing Digital',
    value: 600,
    category: 'Marketing',
    type: 'despesa',
    status: 'concluido',
    source: 'manual'
  }
];

export const MOCK_SERVICE_AGENTS: ServiceAgent[] = [
  {
    id: 'agent-whatsapp-recepcao',
    name: 'Recepcao WhatsApp',
    channel: 'whatsapp',
    objective: 'Triar novos contatos, confirmar dados cadastrais e sugerir horarios livres.',
    tone: 'Acolhedor, objetivo e profissional',
    status: 'active',
    escalationTo: 'Recepcao',
    workingHours: 'Seg-Sex 08:00-18:00',
    rules: ['Nunca confirmar diagnostico', 'Encaminhar urgencias para atendimento humano', 'Validar CPF antes de expor dados'],
    knowledgeBase: ['Agenda', 'Servicos', 'Precos', 'Preparo de exames'],
    createdAt: '2025-04-01'
  },
  {
    id: 'agent-site-captacao',
    name: 'Captacao do Site',
    channel: 'site',
    objective: 'Converter visitantes do site em pacientes cadastrados ou leads qualificados.',
    tone: 'Consultivo e breve',
    status: 'draft',
    escalationTo: 'Marketing',
    workingHours: '24/7',
    rules: ['Coletar consentimento antes de contato ativo', 'Oferecer agendamento apenas com disponibilidade validada'],
    knowledgeBase: ['Especialidades', 'Convenios', 'Localizacao'],
    createdAt: '2025-04-02'
  }
];

export const MOCK_MARKETING_CAMPAIGNS: MarketingCampaign[] = [
  {
    id: 'camp-retorno-cardio',
    name: 'Retorno cardiologia 6 meses',
    audience: 'Pacientes sem retorno desde a ultima consulta',
    channel: 'whatsapp',
    status: 'scheduled',
    goal: 'Reativar pacientes e preencher agenda ociosa',
    scheduledDate: '2025-04-10',
    budget: 450,
    leads: 23
  }
];

export const MOCK_TISS_GUIDES: TissGuide[] = [
  {
    id: 'tiss-001',
    patientName: 'CAMILA DUARTE',
    operator: 'SulAmerica',
    procedure: 'Consulta Convenio',
    status: 'authorized',
    value: 150,
    createdAt: '2025-04-03'
  }
];

export const MOCK_INVENTORY_ITEMS: InventoryItem[] = [
  {
    id: 'stock-luvas',
    name: 'Luvas de procedimento M',
    category: 'Descartaveis',
    quantity: 42,
    minQuantity: 30,
    unit: 'caixas',
    expiresAt: '2026-02-15',
    supplier: 'MedSupply'
  },
  {
    id: 'stock-eletrodos',
    name: 'Eletrodos ECG',
    category: 'Cardiologia',
    quantity: 18,
    minQuantity: 25,
    unit: 'pacotes',
    expiresAt: '2025-11-30',
    supplier: 'CardioTech'
  }
];

export const MOCK_REFERRALS: ReferralRecord[] = [
  {
    id: 'ref-001',
    patientName: 'Bruna Gabriel',
    referredName: 'Fernanda Gabriel',
    status: 'scheduled',
    reward: 'R$ 50 de credito em consulta particular',
    createdAt: '2025-04-03'
  }
];

export const MOCK_REFERENCES: ReferenceMaterial[] = [
  {
    id: 'ref-lgpd',
    title: 'Politica interna LGPD',
    category: 'Compliance',
    url: 'https://www.gov.br/anpd/',
    summary: 'Referencia para consentimento, tratamento de dados sensiveis e atendimento a titulares.',
    updatedAt: '2025-04-01'
  },
  {
    id: 'ref-tiss',
    title: 'Padrao TISS',
    category: 'Convenios',
    url: 'https://www.gov.br/ans/',
    summary: 'Base operacional para guias, faturamento e troca de informacoes com operadoras.',
    updatedAt: '2025-04-01'
  }
];

export const MOCK_HELP_TICKETS: HelpTicket[] = [
  {
    id: 'help-001',
    title: 'Configurar agenda da Dra. Ana Paula',
    module: 'Agenda',
    priority: 'medium',
    status: 'open',
    description: 'Ajustar dias de atendimento e regras de encaixe.',
    createdAt: '2025-04-03'
  }
];

export const MOCK_WHATSAPP_CONNECTIONS: WhatsAppConnection[] = [
  {
    id: 'wa-main',
    name: 'Recepcao WhatsApp',
    phoneNumber: '+5548988003260',
    normalizedPhone: '5548988003260',
    provider: 'whatsmeow',
    status: 'connected',
    deviceJid: '5548988003260@s.whatsapp.net',
    profileImageUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Recepcao%20WhatsApp',
    lastSyncAt: '2026-05-26T12:00:00.000Z',
    createdAt: '2026-05-26T12:00:00.000Z',
    updatedAt: '2026-05-26T12:00:00.000Z'
  }
];

export const MOCK_WHATSAPP_CONVERSATIONS: WhatsAppConversation[] = [
  {
    id: 'wa-conv-ana',
    connectionId: 'wa-main',
    jid: '5548999990001@s.whatsapp.net',
    kind: 'direct',
    title: 'Ana Ribeiro',
    leadName: 'Ana Ribeiro',
    pushName: 'Ana Ribeiro',
    phone: '+5548999990001',
    normalizedPhone: '5548999990001',
    profileImageUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Ana%20Ribeiro',
    participants: [],
    lastMessagePreview: 'Consigo confirmar a consulta para quinta.',
    unreadCount: 2,
    updatedAt: '2026-05-26T12:18:00.000Z'
  },
  {
    id: 'wa-conv-grupo-souza',
    connectionId: 'wa-main',
    jid: '120363300000001234@g.us',
    kind: 'group',
    title: 'Familia Souza',
    leadName: 'Familia Souza',
    groupName: 'Familia Souza',
    profileImageUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Familia%20Souza',
    participantCount: 3,
    participants: [
      {
        id: 'wa-part-maria',
        jid: '5548999990002@s.whatsapp.net',
        phone: '+5548999990002',
        name: 'Maria Souza',
        pushName: 'Maria Souza',
        profileImageUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Maria%20Souza'
      },
      {
        id: 'wa-part-joao',
        jid: '5548999990003@s.whatsapp.net',
        phone: '+5548999990003',
        name: 'Joao Souza',
        pushName: 'Joao Souza',
        profileImageUrl: 'https://api.dicebear.com/9.x/initials/svg?seed=Joao%20Souza'
      }
    ],
    lastMessagePreview: 'Joao Souza: Vou levar os exames no dia.',
    unreadCount: 1,
    updatedAt: '2026-05-26T12:12:00.000Z'
  }
];

export const MOCK_WHATSAPP_MESSAGES: WhatsAppMessage[] = [
  {
    id: 'wa-msg-ana-1',
    connectionId: 'wa-main',
    conversationId: 'wa-conv-ana',
    messageId: 'ana-1',
    fromMe: false,
    senderJid: '5548999990001@s.whatsapp.net',
    senderPhone: '+5548999990001',
    senderPushName: 'Ana Ribeiro',
    senderDisplayName: 'Ana Ribeiro',
    body: 'Ola, quero confirmar minha consulta.',
    type: 'text',
    timestamp: '2026-05-26T12:15:00.000Z',
    status: 'received'
  },
  {
    id: 'wa-msg-ana-2',
    connectionId: 'wa-main',
    conversationId: 'wa-conv-ana',
    messageId: 'ana-2',
    fromMe: true,
    senderJid: '5548988003260@s.whatsapp.net',
    senderPhone: '+5548988003260',
    senderDisplayName: 'Recepcao WhatsApp',
    body: 'Claro, Ana. Sua consulta esta pre-confirmada.',
    type: 'text',
    timestamp: '2026-05-26T12:16:00.000Z',
    status: 'sent'
  },
  {
    id: 'wa-msg-ana-3',
    connectionId: 'wa-main',
    conversationId: 'wa-conv-ana',
    messageId: 'ana-3',
    fromMe: false,
    senderJid: '5548999990001@s.whatsapp.net',
    senderPhone: '+5548999990001',
    senderPushName: 'Ana Ribeiro',
    senderDisplayName: 'Ana Ribeiro',
    body: 'Consigo confirmar a consulta para quinta.',
    type: 'text',
    timestamp: '2026-05-26T12:18:00.000Z',
    status: 'received'
  },
  {
    id: 'wa-msg-grupo-1',
    connectionId: 'wa-main',
    conversationId: 'wa-conv-grupo-souza',
    messageId: 'grupo-1',
    fromMe: false,
    senderJid: '5548999990002@s.whatsapp.net',
    senderPhone: '+5548999990002',
    senderPushName: 'Maria Souza',
    senderDisplayName: 'Maria Souza',
    body: 'Boa tarde, a consulta do Pedro continua marcada?',
    type: 'text',
    timestamp: '2026-05-26T12:10:00.000Z',
    status: 'received'
  },
  {
    id: 'wa-msg-grupo-2',
    connectionId: 'wa-main',
    conversationId: 'wa-conv-grupo-souza',
    messageId: 'grupo-2',
    fromMe: false,
    senderJid: '5548999990003@s.whatsapp.net',
    senderPhone: '+5548999990003',
    senderPushName: 'Joao Souza',
    senderDisplayName: 'Joao Souza',
    body: 'Vou levar os exames no dia.',
    type: 'text',
    timestamp: '2026-05-26T12:12:00.000Z',
    status: 'received'
  }
];

export const MOCK_APPOINTMENTS: Appointment[] = [
  {
    id: '1',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '09:00',
    timeEnd: '09:45',
    patientName: 'BRUNA GABRIEL',
    status: 'atendido',
    type: 'Consulta particular',
    isPrivate: true,
    observations: 'Dor de cabeça',
    arrival: '08:57',
    recordStatus: 'incluso',
    paymentStatus: 'paid',
  },
  {
    id: '2',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '10:00',
    timeEnd: '10:30',
    patientName: 'CAMILA DUARTE',
    status: 'em_atendimento',
    type: 'Consulta Convênio',
    isPrivate: false,
    observations: '',
    arrival: '09:55',
    recordStatus: 'incluso',
    paymentStatus: 'pending',
  },
  {
    id: '3',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '10:30',
    timeEnd: '11:00',
    patientName: 'MARCOS OLIVEIRA',
    status: 'paciente_no_local',
    type: 'Retorno',
    isPrivate: false,
    observations: 'Mostrar exames',
    arrival: '10:32',
    recordStatus: 'pendente',
    paymentStatus: 'pending',
  },
  {
    id: '4',
    doctorId: 'd1',
    date: '2025-04-03',
    timeStart: '11:00',
    timeEnd: '11:30',
    patientName: 'BERNARDO MENDES',
    status: 'confirmado',
    type: 'Primeira consulta',
    isPrivate: true,
    observations: 'Vai chegar 15 minutos atrasado',
    arrival: 'N/A',
    recordStatus: 'pendente',
    paymentStatus: 'free',
  },
  {
    id: '5',
    doctorId: 'd2',
    date: '2025-04-03',
    timeStart: '13:00',
    timeEnd: '13:30',
    patientName: 'LUCAS COSTA',
    status: 'agendado',
    type: 'Consulta particular',
    isPrivate: true,
    observations: '',
    arrival: 'N/A',
    recordStatus: 'pendente',
    paymentStatus: 'paid',
  },
  {
    id: '6',
    doctorId: 'd2',
    date: '2025-04-03',
    timeStart: '13:30',
    timeEnd: '14:00',
    patientName: 'EDUARDA FAGUNDES',
    status: 'desmarcado',
    type: 'Retorno',
    isPrivate: false,
    observations: '',
    arrival: 'N/A',
    recordStatus: 'desmarcado',
    paymentStatus: 'paid',
  },
];
