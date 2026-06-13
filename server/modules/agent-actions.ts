import { loadData, saveData } from "../data";
import { GEMINI_API_KEY, HAS_GEMINI_KEY } from "../config";
import type { AgentActionType, AgentSession, AgentLead, UrgencyLevel, LeadStage } from "../../src/agent-types";
import type { Patient, Doctor, Appointment, ServiceAgent } from "../../src/types";
import { isSlotAvailable, addDays, addMinutes, dayName, timeToMinutes, minutesToTime, nowIso, normalize } from "../helpers";

interface ActionResult {
  success: boolean;
  output: Record<string, unknown>;
  message: string;
}

type ActionHandler = (session: AgentSession, input: Record<string, unknown>) => Promise<ActionResult>;

async function callLLM(systemPrompt: string, userMessage: string): Promise<string> {
  if (!HAS_GEMINI_KEY) return "";
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY, httpOptions: { headers: { "User-Agent": "consultio-med" } } });
  const response = await ai.models.generateContent({
    model: "gemini-2.0-flash",
    contents: userMessage,
    config: { systemInstruction: systemPrompt }
  });
  return response.text || "";
}

const qualificarLead: ActionHandler = async (session, input) => {
  const data = await loadData();
  const conversationHistory = String(input.conversation || "");
  const name = String(input.name || session.contactName || "");
  const need = String(input.need || "");

  if (!HAS_GEMINI_KEY) {
    const hasNeed = need.length > 5 || conversationHistory.length > 20;
    return {
      success: true,
      output: { qualified: hasNeed, score: hasNeed ? 60 : 20, reason: "Classificacao offline (sem LLM)" },
      message: hasNeed ? "Lead qualificado automaticamente" : "Lead com poucas informacoes"
    };
  }

  const systemPrompt = `Voce e um qualificador de leads para uma clinica medica.
Analise a conversa e determine:
- qualified: boolean (true se parece um paciente real buscando agendamento)
- score: number (0-100)
- reason: string (motivo da qualificacao)
- suggestedNeed: string (necessidade identificada)
- urgency: "baixa" | "media" | "alta" | "urgencia"
Responda APENAS JSON válido, sem marcadores ou texto extra.`;

  const prompt = `Nome: ${name || "desconhecido"}
Necessidade informada: ${need || "nao informada"}
Conversa: ${conversationHistory.slice(0, 3000)}`;

  const raw = await callLLM(systemPrompt, prompt);
  try {
    const parsed = JSON.parse(raw);
    return {
      success: true,
      output: {
        qualified: Boolean(parsed.qualified),
        score: Number(parsed.score) || 0,
        reason: String(parsed.reason || ""),
        suggestedNeed: String(parsed.suggestedNeed || need),
        urgency: String(parsed.urgency || "baixa") as UrgencyLevel
      },
      message: parsed.qualified ? "Lead qualificado com sucesso" : "Lead nao qualificado"
    };
  } catch {
    return {
      success: true,
      output: { qualified: false, score: 0, reason: "Erro ao processar resposta da IA" },
      message: "Nao foi possivel qualificar o lead"
    };
  }
};

const criarLead: ActionHandler = async (session, input) => {
  const data = await loadData();
  const name = String(input.name || session.contactName || "");
  const phone = String(input.phone || session.contactPhone || "");
  const need = String(input.need || input.motivo || "");
  const urgency = String(input.urgency || "baixa") as UrgencyLevel;
  const source = String(input.source || session.channel || "whatsapp");

  const rt = (data as any).__agentRuntime || { leads: [], sessions: [] };
  if (!rt.leads) rt.leads = [];

  const existingLead = rt.leads.find((l: AgentLead) => l.phone === phone && l.stage !== "convertido" && l.stage !== "perdido");
  if (existingLead) {
    return { success: true, output: { lead: existingLead, isNew: false }, message: "Lead ja existente, atualizado" };
  }

  const lead: AgentLead = {
    id: `lead-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    name, phone, need, urgency,
    stage: "novo", source, notes: "",
    assignedAgentId: session.agentId,
    firstContactAt: nowIso(),
    lastContactAt: nowIso(),
    createdAt: nowIso(),
  };
  rt.leads.push(lead);
  (data as any).__agentRuntime = rt;
  session.leadStage = "novo";
  await saveData(data);

  return { success: true, output: { lead, isNew: true }, message: `Lead ${name} criado com sucesso` };
};

const sugerirHorarios: ActionHandler = async (session, input) => {
  const data = await loadData();
  const doctorId = String(input.doctorId || session.context.doctorId || "");
  const dateStr = String(input.date || "");
  const timeStr = String(input.time || "08:00");

  if (!doctorId) {
    const doctors = data.doctors;
    return { success: true, output: { doctors: doctors.map(d => ({ id: d.id, name: d.name, specialty: d.specialty })) }, message: "Selecione um profissional" };
  }

  const doctor = data.doctors.find(d => d.id === doctorId);
  if (!doctor) return { success: false, output: {}, message: "Profissional nao encontrado" };

  const appointments = data.appointments.filter(a => a.doctorId === doctorId && a.status !== "desmarcado");
  const dateBase = dateStr || nowIso().slice(0, 10);
  const suggestions: { date: string; time: string }[] = [];
  const duration = 30;
  const requestedMinutes = timeToMinutes(timeStr);
  const maxSuggestions = Number(input.limit) || 5;

  for (let offset = 0; offset < 14 && suggestions.length < maxSuggestions; offset++) {
    const date = addDays(dateBase, offset);
    if (!doctor.availableDays.includes(dayName(date))) continue;
    const workStart = timeToMinutes(doctor.workingHours.start);
    const workEnd = timeToMinutes(doctor.workingHours.end);
    let start = offset === 0 ? Math.max(workStart, requestedMinutes + duration) : workStart;
    start = Math.ceil(start / duration) * duration;

    for (let m = start; m + duration <= workEnd && suggestions.length < maxSuggestions; m += duration) {
      const time = minutesToTime(m);
      const end = minutesToTime(m + duration);
      const available = isSlotAvailable(doctor, date, time, end, appointments);
      if (available.ok) suggestions.push({ date, time });
    }
  }

  return {
    success: true,
    output: { doctor: { id: doctor.id, name: doctor.name }, suggestions },
    message: suggestions.length > 0
      ? `${suggestions.length} horarios disponiveis encontrados`
      : "Nenhum horario disponivel encontrado"
  };
};

const agendarConsulta: ActionHandler = async (session, input) => {
  const data = await loadData();
  const doctorId = String(input.doctorId || session.context.doctorId || "");
  const date = String(input.date || "");
  const timeStart = String(input.timeStart || input.time || "");
  const patientName = String(input.patientName || session.contactName || "");
  const patientPhone = String(input.phone || session.contactPhone || "");
  const type = String(input.type || "consulta");
  const doctor = data.doctors.find(d => d.id === doctorId);

  if (!doctor) return { success: false, output: {}, message: "Profissional nao encontrado" };
  if (!date || !timeStart) return { success: false, output: {}, message: "Data e horario obrigatorios" };

  const timeEnd = addMinutes(timeStart, 30);
  const existingAppointments = data.appointments.filter(a => a.doctorId === doctorId && a.status !== "desmarcado");
  const slotCheck = isSlotAvailable(doctor, date, timeStart, timeEnd, existingAppointments);
  if (!slotCheck.ok) return { success: false, output: {}, message: slotCheck.reason };

  let patient = data.patients.find(p => p.phone === patientPhone);
  if (!patient) {
    patient = {
      id: `pat-${Date.now()}`,
      fullName: patientName,
      phone: patientPhone,
      birthDate: "",
      cpf: "",
      email: "",
      address: { street: "", city: "", state: "", zip: "" },
    };
    data.patients.push(patient);
  }

  const appointment: Appointment = {
    id: `apt-${Date.now()}`,
    doctorId, date, timeStart, timeEnd,
    patientName, status: "agendado", type,
    isPrivate: false, observations: "",
    recordStatus: "pendente", paymentStatus: "pending",
  };
  data.appointments.push(appointment);
  session.patientId = patient.id;
  session.appointmentId = appointment.id;
  session.leadStage = "agendado";

  const rt = (data as any).__agentRuntime;
  if (rt?.leads) {
    const lead = rt.leads.find((l: AgentLead) => l.sessionId === session.id);
    if (lead) {
      lead.stage = "agendado";
      lead.patientId = patient.id;
      lead.appointmentId = appointment.id;
    }
  }

  await saveData(data);

  return {
    success: true,
    output: {
      appointment: { id: appointment.id, doctorId, date, timeStart, timeEnd, patientName, patientId: patient.id },
      patient: { id: patient.id, name: patient.fullName }
    },
    message: `Consulta agendada: ${date} as ${timeStart} com ${doctor.name}`
  };
};

const confirmarConsulta: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");

  if (!appointmentId) return { success: false, output: {}, message: "ID da consulta nao informado" };

  const appointment = data.appointments.find(a => a.id === appointmentId);
  if (!appointment) return { success: false, output: {}, message: "Consulta nao encontrada" };

  appointment.status = "confirmado";
  await saveData(data);

  return {
    success: true,
    output: { appointment: { id: appointment.id, date: appointment.date, timeStart: appointment.timeStart, status: appointment.status } },
    message: `Consulta de ${appointment.patientName} em ${appointment.date} as ${appointment.timeStart} confirmada`
  };
};

const remarcarConsulta: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");
  const newDate = String(input.date || "");
  const newTime = String(input.timeStart || input.time || "");

  if (!appointmentId) return { success: false, output: {}, message: "ID da consulta nao informado" };

  const appointment = data.appointments.find(a => a.id === appointmentId);
  if (!appointment) return { success: false, output: {}, message: "Consulta nao encontrada" };

  const doctor = data.doctors.find(d => d.id === appointment.doctorId);
  if (!doctor) return { success: false, output: {}, message: "Profissional nao encontrado" };

  if (newDate && newTime) {
    const newTimeEnd = addMinutes(newTime, 30);
    const existingAppointments = data.appointments.filter(a => a.doctorId === appointment.doctorId && a.status !== "desmarcado");
    const slotCheck = isSlotAvailable(doctor, newDate, newTime, newTimeEnd, existingAppointments, appointmentId);
    if (!slotCheck.ok) return { success: false, output: {}, message: slotCheck.reason };

    const oldDate = appointment.date;
    const oldTime = appointment.timeStart;
    appointment.date = newDate;
    appointment.timeStart = newTime;
    appointment.timeEnd = newTimeEnd;
    appointment.status = "agendado";
    await saveData(data);

    return {
      success: true,
      output: { appointment: { id: appointment.id, oldDate, oldTime, newDate, newTime } },
      message: `Consulta remarcada de ${oldDate} ${oldTime} para ${newDate} as ${newTime}`
    };
  }

  const appointments = data.appointments.filter(a => a.doctorId === appointment.doctorId && a.status !== "desmarcado");
  const dateBase = appointment.date;
  const suggestions: { date: string; time: string }[] = [];
  for (let offset = 1; offset < 14 && suggestions.length < 3; offset++) {
    const date = addDays(dateBase, offset);
    if (!doctor.availableDays.includes(dayName(date))) continue;
    const workStart = timeToMinutes(doctor.workingHours.start);
    const workEnd = timeToMinutes(doctor.workingHours.end);
    for (let m = workStart; m + 30 <= workEnd && suggestions.length < 3; m += 30) {
      const time = minutesToTime(m);
      const end = minutesToTime(m + 30);
      if (isSlotAvailable(doctor, date, time, end, appointments, appointmentId).ok) {
        suggestions.push({ date, time });
      }
    }
  }

  return {
    success: true,
    output: { currentAppointment: { id: appointment.id, date: appointment.date, timeStart: appointment.timeStart }, suggestions },
    message: suggestions.length > 0 ? "Sugestoes de remarcacao disponiveis" : "Nenhum horario alternativo encontrado"
  };
};

const cancelarConsulta: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");
  const reason = String(input.reason || input.motivo || "");

  if (!appointmentId) return { success: false, output: {}, message: "ID da consulta nao informado" };

  const appointment = data.appointments.find(a => a.id === appointmentId);
  if (!appointment) return { success: false, output: {}, message: "Consulta nao encontrada" };

  appointment.status = "desmarcado";
  appointment.observations = reason ? `Cancelado: ${reason}` : "Cancelado pelo paciente";

  const rt = (data as any).__agentRuntime;
  if (rt?.leads) {
    const lead = rt.leads.find((l: AgentLead) => l.appointmentId === appointmentId);
    if (lead) { lead.stage = "perdido"; lead.notes += ` | Cancelado: ${reason}`; }
  }

  session.leadStage = "perdido";
  await saveData(data);

  return {
    success: true,
    output: { appointment: { id: appointment.id, status: appointment.status } },
    message: `Consulta de ${appointment.patientName} em ${appointment.date} foi cancelada`
  };
};

const enviarLembrete: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");

  if (!appointmentId) return { success: false, output: {}, message: "ID da consulta nao informado" };

  const appointment = data.appointments.find(a => a.id === appointmentId);
  if (!appointment) return { success: false, output: {}, message: "Consulta nao encontrada" };

  const doctor = data.doctors.find(d => d.id === appointment.doctorId);
  const message = `Olá ${appointment.patientName}! Lembramos da sua consulta${doctor ? ` com ${doctor.name}` : ""} no dia ${appointment.date} às ${appointment.timeStart}. Confirmado?`;

  return {
    success: true,
    output: { appointment: { id: appointment.id, date: appointment.date, timeStart: appointment.timeStart }, reminderMessage: message },
    message: "Lembrete gerado com sucesso"
  };
};

const enviarConfirmacao: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");

  if (!appointmentId) return { success: false, output: {}, message: "ID da consulta nao informado" };

  const appointment = data.appointments.find(a => a.id === appointmentId);
  if (!appointment) return { success: false, output: {}, message: "Consulta nao encontrada" };

  const doctor = data.doctors.find(d => d.id === appointment.doctorId);
  const message = `✅ Consulta confirmada!\nPaciente: ${appointment.patientName}\nProfissional: ${doctor?.name || "N/I"}\nData: ${appointment.date}\nHorário: ${appointment.timeStart}\nTipo: ${appointment.type}\n\nSe precisar remarcar ou cancelar, estamos à disposição.`;

  return {
    success: true,
    output: { appointment: { id: appointment.id, status: "confirmado" }, confirmationMessage: message },
    message: "Confirmacao gerada com sucesso"
  };
};

const coletarFeedback: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");

  const message = `Olá ${session.contactName || "Paciente"}! Gostaríamos de saber como foi sua experiência. De 0 a 10, qual nota você dá para o atendimento?`;

  return {
    success: true,
    output: { appointmentId, feedbackMessage: message, rating: null, comment: null },
    message: "Solicitacao de feedback enviada"
  };
};

const escalarHumano: ActionHandler = async (session, input) => {
  const data = await loadData();
  const reason = String(input.reason || input.motivo || "");
  const summary = String(input.summary || "");

  const agents = data.serviceAgents;
  const targetAgent = agents.find(a => a.id === session.agentId);
  const escalationTarget = targetAgent?.escalationTo || "admin";

  session.status = "waiting_human";

  const rt = (data as any).__agentRuntime;
  if (rt?.leads) {
    const lead = rt.leads.find((l: AgentLead) => l.sessionId === session.id);
    if (lead) lead.stage = "qualificado";
  }

  await saveData(data);

  return {
    success: true,
    output: {
      escalationTo: escalationTarget,
      reason,
      summary,
      sessionId: session.id,
      contactName: session.contactName,
      contactPhone: session.contactPhone,
      channel: session.channel
    },
    message: `Atendimento escalado para ${escalationTarget}: ${reason || "solicitacao do paciente"}`
  };
};

const validarTelefone: ActionHandler = async (_session, input) => {
  const phone = String(input.phone || "").replace(/\D/g, "");
  const isValid = phone.length >= 10 && phone.length <= 13;
  const isMobile = phone.length >= 11;

  return {
    success: true,
    output: { phone, isValid, isMobile, formatted: `+${phone}` },
    message: isValid ? "Telefone valido" : "Telefone invalido"
  };
};

const classificarUrgencia: ActionHandler = async (session, input) => {
  const message = String(input.message || input.conversation || "");
  const need = String(input.need || "");

  if (!HAS_GEMINI_KEY) {
    const urgentWords = ["urgente", "emergencia", "dor", "sangramento", "grave", "imediato"];
    const hasUrgent = urgentWords.some(w => message.toLowerCase().includes(w) || need.toLowerCase().includes(w));
    const urgency: UrgencyLevel = hasUrgent ? "alta" : "baixa";
    return {
      success: true,
      output: { urgency, method: "keyword" },
      message: `Urgencia classificada como ${urgency}`
    };
  }

  const systemPrompt = `Classifique a urgencia do paciente em: "baixa", "media", "alta" ou "urgencia".
Responda APENAS JSON: {"urgency": "baixa|media|alta|urgencia", "reason": "..."}`;

  const prompt = `Necessidade: ${need || "nao informada"}\nMensagem: ${message.slice(0, 2000)}`;
  const raw = await callLLM(systemPrompt, prompt);

  try {
    const parsed = JSON.parse(raw);
    const urgency = String(parsed.urgency || "baixa") as UrgencyLevel;
    return { success: true, output: { urgency, reason: String(parsed.reason || ""), method: "llm" }, message: `Urgencia classificada como ${urgency}` };
  } catch {
    return { success: true, output: { urgency: "baixa" as UrgencyLevel, method: "fallback" }, message: "Urgencia classificada como baixa (fallback)" };
  }
};

const buscarPaciente: ActionHandler = async (_session, input) => {
  const data = await loadData();
  const query = String(input.query || input.name || input.phone || "").toLowerCase().trim();

  if (!query) {
    return { success: true, output: { patients: [] }, message: "Nenhum termo de busca informado" };
  }

  const results = data.patients.filter(p =>
    normalize(p.fullName).includes(normalize(query)) ||
    p.phone.includes(query) ||
    p.cpf.replace(/\D/g, "").includes(query.replace(/\D/g, "")) ||
    p.email.toLowerCase().includes(query)
  );

  return {
    success: true,
    output: { patients: results.map(p => ({ id: p.id, name: p.fullName, phone: p.phone, email: p.email })) },
    message: results.length > 0 ? `${results.length} paciente(s) encontrado(s)` : "Nenhum paciente encontrado"
  };
};

const criarTarefa: ActionHandler = async (session, input) => {
  const data = await loadData();
  const task = {
    id: `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    sessionId: session.id,
    title: String(input.title || input.titulo || ""),
    description: String(input.description || input.descricao || ""),
    assignedTo: String(input.assignedTo || input.responsavel || session.agentName),
    priority: String(input.priority || "medium") as "low" | "medium" | "high",
    status: "pending" as const,
    createdAt: nowIso(),
  };

  const rt = (data as any).__agentRuntime || {};
  if (!rt.tasks) rt.tasks = [];
  rt.tasks.push(task);
  (data as any).__agentRuntime = rt;
  await saveData(data);

  return {
    success: true,
    output: { task },
    message: `Tarefa "${task.title}" criada para ${task.assignedTo}`
  };
};

const avaliarDisponibilidade: ActionHandler = async (_session, input) => {
  const data = await loadData();
  const doctorId = String(input.doctorId || "");
  const date = String(input.date || nowIso().slice(0, 10));

  if (!doctorId) {
    return { success: true, output: { doctors: data.doctors.map(d => ({ id: d.id, name: d.name, specialty: d.specialty })) }, message: "Selecione um profissional" };
  }

  const doctor = data.doctors.find(d => d.id === doctorId);
  if (!doctor) return { success: false, output: {}, message: "Profissional nao encontrado" };

  if (!doctor.availableDays.includes(dayName(date))) {
    return { success: true, output: { doctor: { id: doctor.id, name: doctor.name }, date, available: false, reason: "Nao atende neste dia" }, message: "Profissional nao atende neste dia" };
  }

  const appointments = data.appointments.filter(a => a.doctorId === doctorId && a.date === date && a.status !== "desmarcado");
  const workStart = timeToMinutes(doctor.workingHours.start);
  const workEnd = timeToMinutes(doctor.workingHours.end);
  const duration = 30;
  const slots: { time: string; available: boolean }[] = [];

  for (let m = workStart; m + duration <= workEnd; m += duration) {
    const time = minutesToTime(m);
    const end = minutesToTime(m + duration);
    const check = isSlotAvailable(doctor, date, time, end, appointments);
    slots.push({ time, available: check.ok });
  }

  return {
    success: true,
    output: { doctor: { id: doctor.id, name: doctor.name }, date, slots, availableSlots: slots.filter(s => s.available).length },
    message: `Disponibilidade para ${doctor.name} em ${date}: ${slots.filter(s => s.available).length} horarios livres`
  };
};

const responderPergunta: ActionHandler = async (session, input) => {
  const question = String(input.question || input.pergunta || input.message || "");

  if (!HAS_GEMINI_KEY) {
    const kb = String(session.context.knowledgeBase || "");
    return {
      success: true,
      output: { answer: "Desculpe, o assistente IA nao esta configurado. Configure GEMINI_API_KEY.", usedKb: false },
      message: "Pergunta respondida offline"
    };
  }

  const data = await loadData();
  const agent = data.serviceAgents.find(a => a.id === session.agentId);
  const knowledgeBase = agent?.knowledgeBase || [];
  const rules = agent?.rules || [];

  const systemPrompt = `Voce e um assistente virtual de uma clinica medica chamado ${agent?.name || "Assistente"}.
Tom: ${agent?.tone || "profissional"}
Regras: ${rules.join("\n")}
Conhecimento: ${knowledgeBase.join("\n")}

Responda em portugues de forma clara e objetiva. Nao invente informacoes medicas. Se nao souber, diga que vai transferir para um atendente humano.`;

  const prompt = `Pergunta do paciente (${session.contactName}): ${question}`;
  const answer = await callLLM(systemPrompt, prompt);

  return {
    success: true,
    output: { answer, question, usedKb: true },
    message: answer
  };
};

const actionHandlers: Record<AgentActionType, ActionHandler> = {
  qualificar_lead: qualificarLead,
  criar_lead: criarLead,
  sugerir_horarios: sugerirHorarios,
  agendar_consulta: agendarConsulta,
  confirmar_consulta: confirmarConsulta,
  remarcar_consulta: remarcarConsulta,
  cancelar_consulta: cancelarConsulta,
  enviar_lembrete: enviarLembrete,
  enviar_confirmacao: enviarConfirmacao,
  coletar_feedback: coletarFeedback,
  escalar_humano: escalarHumano,
  validar_telefone: validarTelefone,
  classificar_urgencia: classificarUrgencia,
  buscar_paciente: buscarPaciente,
  criar_tarefa: criarTarefa,
  avaliar_disponibilidade: avaliarDisponibilidade,
  responder_pergunta: responderPergunta,
};

export async function executeAction(
  session: AgentSession,
  type: AgentActionType,
  input: Record<string, unknown>
): Promise<ActionResult> {
  const handler = actionHandlers[type];
  if (!handler) {
    return { success: false, output: {}, message: `Acao desconhecida: ${type}` };
  }
  return handler(session, input);
}

export function getActionHandlers(): AgentActionType[] {
  return Object.keys(actionHandlers) as AgentActionType[];
}

export function getActionLabel(type: AgentActionType): string {
  const labels: Record<AgentActionType, string> = {
    qualificar_lead: "Qualificar Lead",
    criar_lead: "Criar Lead",
    sugerir_horarios: "Sugerir Horarios",
    agendar_consulta: "Agendar Consulta",
    confirmar_consulta: "Confirmar Consulta",
    remarcar_consulta: "Remarcar Consulta",
    cancelar_consulta: "Cancelar Consulta",
    enviar_lembrete: "Enviar Lembrete",
    enviar_confirmacao: "Enviar Confirmacao",
    coletar_feedback: "Coletar Feedback",
    escalar_humano: "Escalar Humano",
    validar_telefone: "Validar Telefone",
    classificar_urgencia: "Classificar Urgencia",
    buscar_paciente: "Buscar Paciente",
    criar_tarefa: "Criar Tarefa",
    avaliar_disponibilidade: "Avaliar Disponibilidade",
    responder_pergunta: "Responder Pergunta",
  };
  return labels[type] || type;
}
