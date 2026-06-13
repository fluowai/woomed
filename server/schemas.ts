import { z } from "zod";

export const patientSchema = z.object({
  fullName: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  birthDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  cpf: z.string().min(11, "CPF deve ter pelo menos 11 dígitos"),
  phone: z.string().default(""),
  email: z.string().default(""),
  avatarUrl: z.string().optional(),
  lgpdConsent: z.boolean().optional().default(false),
  address: z.object({
    street: z.string().default(""),
    city: z.string().default(""),
    state: z.string().default(""),
    zip: z.string().default("")
  }).default({ street: "", city: "", state: "", zip: "" })
});

export const appointmentSchema = z.object({
  patientId: z.string().min(1, "Paciente é obrigatório"),
  doctorId: z.string().min(1, "Profissional é obrigatório"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  timeStart: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:MM"),
  type: z.string().optional().default("Consulta Particular"),
  observations: z.string().optional().default("")
});

export const financeTransactionSchema = z.object({
  description: z.string().min(2, "Descrição deve ter pelo menos 2 caracteres"),
  value: z.number().positive("Valor deve ser positivo"),
  category: z.string().optional().default("Extra"),
  type: z.enum(["receita", "despesa"], { message: "Tipo deve ser receita ou despesa" })
});

export const agentSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  channel: z.enum(["whatsapp", "instagram", "site", "email", "phone"]),
  objective: z.string().min(5, "Objetivo deve ter pelo menos 5 caracteres"),
  tone: z.string().optional(),
  escalationTo: z.string().optional(),
  workingHours: z.string().optional(),
  rules: z.array(z.string()).optional(),
  knowledgeBase: z.array(z.string()).optional(),
  connectionId: z.string().optional()
});

export const campaignSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  audience: z.string().min(2, "Público-alvo deve ter pelo menos 2 caracteres"),
  channel: z.enum(["whatsapp", "instagram", "site", "email", "phone", "sms"]),
  goal: z.string().optional(),
  scheduledDate: z.string().optional(),
  budget: z.number().min(0).optional().default(0)
});

// Phase 2 schemas
export const waitingListSchema = z.object({
  patientId: z.string().min(1, "Paciente é obrigatório"),
  patientName: z.string().min(1, "Nome do paciente é obrigatório"),
  doctorId: z.string().min(1, "Profissional é obrigatório"),
  preferredDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD").optional().default(""),
  preferredTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário deve estar no formato HH:MM").optional().default(""),
  procedure: z.string().optional().default(""),
  notes: z.string().optional().default("")
});

export const scheduleBlockSchema = z.object({
  doctorId: z.string().min(1, "Profissional é obrigatório"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data deve estar no formato YYYY-MM-DD"),
  startTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário início deve estar no formato HH:MM"),
  endTime: z.string().regex(/^\d{2}:\d{2}$/, "Horário fim deve estar no formato HH:MM"),
  type: z.enum(["ferias", "feriado", "folga", "outro"]),
  reason: z.string().optional().default("")
});

export const medicalTemplateSchema = z.object({
  name: z.string().min(2, "Nome deve ter pelo menos 2 caracteres"),
  specialty: z.string().min(2, "Especialidade é obrigatória"),
  templateType: z.enum(["evolucao", "prescricao", "atestado", "exame"]),
  content: z.string().min(1, "Conteúdo do template é obrigatório")
});

export const accountsPayableSchema = z.object({
  description: z.string().min(2, "Descrição deve ter pelo menos 2 caracteres"),
  value: z.number().positive("Valor deve ser positivo"),
  category: z.string().optional().default("Operacional"),
  dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data de vencimento deve estar no formato YYYY-MM-DD"),
  recurring: z.boolean().optional().default(false),
  recurrenceInterval: z.enum(["monthly", "yearly"]).optional(),
  supplier: z.string().optional().default(""),
  notes: z.string().optional().default("")
});

export const paymentGatewaySchema = z.object({
  provider: z.enum(["mercadopago", "stripe", "pix"]),
  apiKey: z.string().min(1, "Chave da API é obrigatória"),
  secretKey: z.string().optional(),  // Para Stripe e outros que precisam
  webhookSecret: z.string().optional().default(""),
  pixKey: z.string().optional().default("")
});
