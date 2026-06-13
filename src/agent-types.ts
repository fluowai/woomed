export type AgentActionType =
  | "qualificar_lead"
  | "criar_lead"
  | "sugerir_horarios"
  | "agendar_consulta"
  | "confirmar_consulta"
  | "remarcar_consulta"
  | "cancelar_consulta"
  | "enviar_lembrete"
  | "enviar_confirmacao"
  | "coletar_feedback"
  | "escalar_humano"
  | "validar_telefone"
  | "classificar_urgencia"
  | "buscar_paciente"
  | "criar_tarefa"
  | "avaliar_disponibilidade"
  | "responder_pergunta";

export type AgentSessionStatus = "active" | "waiting_human" | "resolved" | "expired";

export type LeadStage =
  | "novo"
  | "contatado"
  | "qualificado"
  | "agendando"
  | "agendado"
  | "convertido"
  | "perdido";

export type UrgencyLevel = "baixa" | "media" | "alta" | "urgencia";

export interface AgentAction {
  id: string;
  sessionId: string;
  agentId: string;
  type: AgentActionType;
  status: "pending" | "executing" | "completed" | "failed" | "escalated";
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  completedAt?: string;
}

export interface AgentSession {
  id: string;
  agentId: string;
  agentName: string;
  contactId: string;
  contactName: string;
  contactPhone: string;
  channel: string;
  status: AgentSessionStatus;
  leadStage: LeadStage;
  urgency: UrgencyLevel;
  patientId?: string;
  appointmentId?: string;
  context: Record<string, unknown>;
  messageCount: number;
  lastMessageAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentExecutionLog {
  id: string;
  sessionId: string;
  agentId: string;
  action: AgentActionType;
  prompt: string;
  response: string;
  modelUsed: string;
  tokensUsed: number;
  latencyMs: number;
  success: boolean;
  error?: string;
  createdAt: string;
}

export interface AgentLead {
  id: string;
  sessionId: string;
  name: string;
  phone: string;
  email?: string;
  need: string;
  urgency: UrgencyLevel;
  stage: LeadStage;
  source: string;
  notes: string;
  patientId?: string;
  appointmentId?: string;
  assignedAgentId: string;
  firstContactAt: string;
  lastContactAt: string;
  convertedAt?: string;
  createdAt: string;
}

export interface AgentMetrics {
  agentId: string;
  agentName: string;
  totalSessions: number;
  activeSessions: number;
  resolvedSessions: number;
  escalatedSessions: number;
  avgResponseTime: number;
  messagesProcessed: number;
  actionsExecuted: number;
  successRate: number;
  leadsCreated: number;
  appointmentsBooked: number;
  periodStart: string;
  periodEnd: string;
}
