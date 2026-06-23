import { loadData, saveData } from "../data";
import { GEMINI_API_KEY, HAS_GEMINI_KEY, WHATSMEOW_API_URL } from "../config";
import type { AgentActionType, AgentSession, AgentLead, UrgencyLevel, LeadStage } from "../../src/agent-types";
import type { Patient, Doctor, Appointment, ServiceAgent } from "../../src/types";
import { isSlotAvailable, addDays, addMinutes, dayName, timeToMinutes, minutesToTime, nowIso, normalize } from "../helpers";
import { callWhatsmeowBridge } from "../whatsapp-utils";
import { pauseAi } from "./agent-control";

interface ActionResult {
  success: boolean;
  output: Record<string, unknown>;
  message: string;
}

type ActionHandler = (session: AgentSession, input: Record<string, unknown>) => Promise<ActionResult>;

function buildProcedureIndex(data: any) {
  return ((data.procedureCatalog || []) as any[]).filter(item => item.isActive !== false);
}

function findProcedure(data: any, rawQuery: string) {
  const normalizedQuery = normalize(rawQuery || "");
  if (!normalizedQuery) return null;
  return buildProcedureIndex(data).find(item => {
    const haystack = [
      item.name,
      item.category,
      item.specialty,
      item.description,
      ...(item.aliases || []),
    ].map(normalize).join(" ");
    return haystack.includes(normalizedQuery) ||
      normalizedQuery.includes(normalize(item.name)) ||
      (item.aliases || []).some((alias: string) => normalizedQuery.includes(normalize(alias)));
  }) || null;
}

function findDoctorForProcedure(data: any, procedure: any): Doctor | undefined {
  if (!procedure) return undefined;
  return procedure.doctorId
    ? data.doctors.find((d: Doctor) => d.id === procedure.doctorId)
    : data.doctors.find((d: Doctor) => normalize(d.specialty).includes(normalize(procedure.specialty)));
}

function extractEmail(text: string): string {
  return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] || "";
}

function looksLikeGreeting(text: string): boolean {
  return /^(oi|ola|olá|bom dia|boa tarde|boa noite|tudo bem|hey|oie)\b/i.test(text.trim());
}

function isPriceQuestion(text: string): boolean {
  return /pre[cç]o|valor|quanto custa|or[cç]amento|custa quanto|quanto fica/i.test(text);
}

function isDetailedProcedureQuestion(text: string): boolean {
  return /d[oó]i|dor|tempo|dura|dura[cç][aã]o|recupera[cç][aã]o|risco|serve|resultado|efeito|contraindica|p[oó]s|antes|depois/i.test(text);
}

function inferDoctorFromContext(data: any, session: AgentSession, text = ""): Doctor | undefined {
  const directId = String(session.context.doctorId || "");
  if (directId) {
    const found = data.doctors.find((d: Doctor) => d.id === directId);
    if (found) return found;
  }
  const context = [
    text,
    String(session.context.procedureInterest || ""),
    String(session.context.specialty || ""),
    String(session.context.consolidatedContext || ""),
  ].join(" ");
  const procedure = findProcedure(data, context);
  if (procedure) {
    const doctor = findDoctorForProcedure(data, procedure);
    if (doctor) return doctor;
  }
  const normalizedContext = normalize(context);
  return data.doctors.find((doctor: Doctor) =>
    normalizedContext.includes(normalize(doctor.name)) ||
    normalizedContext.includes(normalize(doctor.specialty))
  );
}

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
  const inferredDoctor = inferDoctorFromContext(data, session, String(input.conversation || input.message || ""));
  const doctorId = String(input.doctorId || session.context.doctorId || inferredDoctor?.id || "");
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

  if (suggestions.length > 0) {
    session.context.lastSuggestions = suggestions;
    session.context.lastDoctorId = doctor.id;
    session.context.doctorId = doctor.id;
  }

  return {
    success: true,
    output: { doctor: { id: doctor.id, name: doctor.name }, suggestions },
    message: suggestions.length > 0
      ? `${suggestions.length} horarios disponiveis encontrados`
      : "Nenhum horario disponivel encontrado"
  };
};

async function extractDateTimeFromConversation(conversation: string, suggestions?: { date: string; time: string }[]): Promise<{ date: string; time: string } | null> {
  if (!HAS_GEMINI_KEY || !conversation) return null;

  const systemPrompt = `Extraia data e horario que o paciente escolheu. Responda APENAS JSON: {"date": "YYYY-MM-DD", "time": "HH:MM"}. Se nao encontrar, responda {"date": "", "time": ""}.`;
  const suggestionsStr = suggestions?.length ? `\nSugestoes disponiveis:\n${suggestions.map((s, i) => `${i + 1}. ${s.date} as ${s.time}`).join("\n")}` : "";
  const prompt = `Fala do paciente: "${conversation}"${suggestionsStr}`;

  try {
    const raw = await callLLM(systemPrompt, prompt);
    const parsed = JSON.parse(raw);
    if (parsed.date && parsed.time) return { date: parsed.date, time: parsed.time };
  } catch {}
  return null;
}

const agendarConsulta: ActionHandler = async (session, input) => {
  const data = await loadData();
  const conversation = String(input.conversation || "");
  const inferredDoctor = inferDoctorFromContext(data, session, conversation);
  const doctorId = String(input.doctorId || session.context.doctorId || inferredDoctor?.id || "");
  let date = String(input.date || "");
  let timeStart = String(input.timeStart || input.time || "");
  const patientName = String(input.patientName || session.contactName || "");
  const patientPhone = String(input.phone || session.contactPhone || "");
  const patientEmail = String(input.email || session.context.email || extractEmail(conversation) || "");
  const type = String(input.type || "consulta");

  const doctor = data.doctors.find(d => d.id === doctorId);
  if (!doctor) return { success: false, output: {}, message: "Profissional nao encontrado" };

  if ((!date || !timeStart) && conversation) {
    const suggestions = (input as any).suggestions || (session.context as any).lastSuggestions;
    const extracted = await extractDateTimeFromConversation(conversation, suggestions);
    if (extracted) {
      date = extracted.date;
      timeStart = extracted.time;
    }
  }

  if (!date || !timeStart) return { success: false, output: {}, message: "Informe qual horario voce prefere entre as opcoes que mostrei" };
  if (!patientName || patientName === "Contato" || patientName === patientPhone || !patientEmail) {
    return {
      success: false,
      output: { needs: ["patientName", "email"], doctor: { id: doctor.id, name: doctor.name }, date, timeStart },
      message: "Perfeito, esse horario pode funcionar. Para confirmar a consulta, preciso do seu nome completo e melhor email."
    };
  }

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
      email: patientEmail,
      address: { street: "", city: "", state: "", zip: "" },
    };
    data.patients.push(patient);
  } else if (patientEmail && !patient.email) {
    patient.email = patientEmail;
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

  const conn = data.whatsappConnections?.find(c => c.status === "connected");
  if (conn?.id && WHATSMEOW_API_URL) {
    const patient = data.patients.find(p =>
      p.fullName.toUpperCase() === appointment.patientName.toUpperCase()
    );
    const conversation = data.whatsappConversations?.find(c =>
      c.connectionId === conn.id && c.normalizedPhone === patient?.phone?.replace(/\D/g, "")
    );
    if (conversation) {
      try {
        await callWhatsmeowBridge("/messages/send", {
          method: "POST",
          body: JSON.stringify({ connectionId: conn.id, to: conversation.jid, text: message }),
        });
      } catch (e) {
        console.warn("[enviarLembrete] WhatsApp send failed:", e);
      }
    }
  }

  return {
    success: true,
    output: { appointment: { id: appointment.id, date: appointment.date, timeStart: appointment.timeStart }, reminderMessage: message },
    message: "Lembrete enviado com sucesso"
  };
};

const enviarConfirmacao: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");

  if (!appointmentId) return { success: false, output: {}, message: "ID da consulta nao informado" };

  const appointment = data.appointments.find(a => a.id === appointmentId);
  if (!appointment) return { success: false, output: {}, message: "Consulta nao encontrada" };

  appointment.status = "confirmado";

  const doctor = data.doctors.find(d => d.id === appointment.doctorId);
  const message = `✅ Consulta confirmada!\nPaciente: ${appointment.patientName}\nProfissional: ${doctor?.name || "N/I"}\nData: ${appointment.date}\nHorário: ${appointment.timeStart}\nTipo: ${appointment.type}\n\nSe precisar remarcar ou cancelar, estamos à disposição.`;

  const conn = data.whatsappConnections?.find(c => c.status === "connected");
  if (conn?.id && WHATSMEOW_API_URL) {
    const patient = data.patients.find(p =>
      p.fullName.toUpperCase() === appointment.patientName.toUpperCase()
    );
    const conversation = data.whatsappConversations?.find(c =>
      c.connectionId === conn.id && c.normalizedPhone === patient?.phone?.replace(/\D/g, "")
    );
    if (conversation) {
      try {
        await callWhatsmeowBridge("/messages/send", {
          method: "POST",
          body: JSON.stringify({ connectionId: conn.id, to: conversation.jid, text: message }),
        });
      } catch (e) {
        console.warn("[enviarConfirmacao] WhatsApp send failed:", e);
      }
    }
  }

  await saveData(data);

  return {
    success: true,
    output: { appointment: { id: appointment.id, status: "confirmado" }, confirmationMessage: message },
    message: message
  };
};

const coletarFeedback: ActionHandler = async (session, input) => {
  const data = await loadData();
  const appointmentId = String(input.appointmentId || session.appointmentId || "");

  const message = `Olá ${session.contactName || "Paciente"}! Gostaríamos de saber como foi sua experiência. De 0 a 10, qual nota você dá para o atendimento?`;

  const conn = data.whatsappConnections?.find(c => c.status === "connected");
  if (conn?.id && WHATSMEOW_API_URL) {
    const patient = data.patients.find(p =>
      session.contactPhone && p.phone?.replace(/\D/g, "") === session.contactPhone.replace(/\D/g, "")
    );
    const conversation = data.whatsappConversations?.find(c =>
      c.connectionId === conn.id && c.normalizedPhone === patient?.phone?.replace(/\D/g, "")
    );
    if (conversation) {
      try {
        await callWhatsmeowBridge("/messages/send", {
          method: "POST",
          body: JSON.stringify({ connectionId: conn.id, to: conversation.jid, text: message }),
        });
      } catch (e) {
        console.warn("[coletarFeedback] WhatsApp send failed:", e);
      }
    }
  }

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
  const connectionId = String(input.connectionId || session.context.connectionId || "");

  const agents = data.serviceAgents;
  const targetAgent = agents.find(a => a.id === session.agentId);
  const escalationTarget = targetAgent?.escalationTo || "admin";

  session.status = "waiting_human";
  session.context.aiService = "paused";
  session.context.handoffReason = reason || "solicitacao do paciente";

  const rt = (data as any).__agentRuntime;
  if (rt?.leads) {
    const lead = rt.leads.find((l: AgentLead) => l.sessionId === session.id);
    if (lead) lead.stage = "qualificado";
  }

  await saveData(data);
  await pauseAi({
    contactId: session.contactId,
    contactPhone: session.contactPhone,
    channel: session.channel as any,
    connectionId: connectionId || undefined,
    reason: reason || "handoff_humano",
    pausedBy: session.agentName || "agent",
  });

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

const buscarProcedimento: ActionHandler = async (session, input) => {
  const data = await loadData();
  const query = String(input.procedure || input.procedimento || input.query || input.message || input.conversation || "").trim();
  if (!query) {
    return { success: false, output: { procedures: data.procedureCatalog || [] }, message: "Informe qual procedimento deseja conhecer." };
  }

  const items = buildProcedureIndex(data);
  const match = findProcedure(data, query);

  if (!match) {
    return {
      success: true,
      output: { found: false, query, procedures: items.map(item => ({ id: item.id, name: item.name, specialty: item.specialty })) },
      message: "Ainda nao encontrei esse procedimento no catalogo. Vou encaminhar para a equipe confirmar os detalhes."
    };
  }

  const doctor = findDoctorForProcedure(data, match);
  session.context.procedureInterest = match.name;
  if (doctor) session.context.doctorId = doctor.id;

  const evaluationText = match.requiresEvaluation
    ? "A avaliacao e o melhor proximo passo para confirmar indicacao, plano e valores com seguranca."
    : "Posso te ajudar a verificar horarios para esse atendimento.";
  const priceText = typeof match.price === "number" && match.price > 0 ? ` Valor de referencia: R$ ${match.price.toFixed(2)}.` : "";
  const doctorText = doctor ? ` O profissional indicado e ${doctor.name} (${doctor.specialty}).` : "";
  const mediaText = match.mediaUrl ? `\n\nMidia de referencia: ${match.mediaUrl}` : "";
  const message = `${match.name}: ${match.description}${doctorText}${priceText}\n\n${match.mediaCaption || evaluationText}${mediaText}\n\n${evaluationText}`;

  return {
    success: true,
    output: {
      found: true,
      procedure: {
        id: match.id,
        name: match.name,
        specialty: match.specialty,
        category: match.category,
        doctorId: doctor?.id || match.doctorId,
        doctorName: doctor?.name || match.doctorName,
        mediaUrl: match.mediaUrl,
        mediaType: match.mediaType,
        mediaCaption: match.mediaCaption,
        requiresEvaluation: match.requiresEvaluation,
      },
      suggestedNextAction: "sugerir_horarios",
    },
    message,
  };
};

const responderFaq: ActionHandler = async (session, input) => {
  const question = String(input.question || input.message || input.conversation || "").trim();
  const data = await loadData();
  const agent = data.serviceAgents.find(a => a.id === session.agentId);
  const kb = [
    ...(agent?.knowledgeBase || []),
    "Horario de funcionamento: segunda a sexta, das 08:00 as 18:00.",
    "Agendamento, remarcacao e cancelamento podem ser feitos por este canal.",
    "Valores de procedimentos dependem de avaliacao profissional e plano individual.",
    "Em caso de urgencia, procure atendimento de emergencia ou fale com a equipe humana.",
  ];

  const lower = question.toLowerCase();
  const directAnswers: Array<[RegExp, string]> = [
    [/hor[aá]rio|funcionamento|abre|fecha/, "Nosso atendimento funciona em horario comercial. Para horarios especificos da unidade, posso transferir para a equipe confirmar."],
    [/endere[cç]o|localiza|onde fica|chegar/, "Ainda nao tenho o endereco completo configurado nesta base. Vou pedir para a equipe confirmar a localizacao certinha."],
    [/conv[eê]nio|plano|seguro/, "A cobertura depende do convenio e do procedimento. O ideal e confirmar com a equipe antes da consulta."],
    [/telefone|contato|email|e-mail/, "Voce pode continuar por aqui no WhatsApp. Se precisar de outro canal, posso encaminhar para a recepcao."],
    [/estacionamento|acessibilidade/, "Preciso confirmar essa informacao com a equipe da unidade para te responder com seguranca."],
  ];

  const found = directAnswers.find(([pattern]) => pattern.test(lower));
  if (found) {
    const needsHuman = /endere[cç]o|localiza|estacionamento|acessibilidade/.test(lower);
    return {
      success: true,
      output: needsHuman ? { escalationTo: agent?.escalationTo || "Recepcao", reason: "faq_sem_info" } : { answer: found[1], usedKb: true },
      message: found[1],
    };
  }

  if (HAS_GEMINI_KEY) {
    const systemPrompt = `Voce e um subagente FAQ de clinica. Responda apenas com base na base abaixo. Se nao houver informacao suficiente, diga que vai transferir para a equipe. Nao invente dados.\n\nBase:\n${kb.join("\n")}`;
    const raw = await callLLM(systemPrompt, question);
    if (raw && !/nao sei|não sei/i.test(raw)) {
      return { success: true, output: { answer: raw, usedKb: true }, message: raw };
    }
  }

  return {
    success: true,
    output: { escalationTo: agent?.escalationTo || "Recepcao", reason: "faq_sem_info" },
    message: "Essa e uma otima pergunta e eu prefiro confirmar com a equipe para te passar a informacao correta.",
  };
};

const atenderQualificar: ActionHandler = async (session, input) => {
  const text = String(input.message || input.conversation || input.query || "").trim();
  const data = await loadData();
  const procedure = findProcedure(data, `${text}\n${session.context.consolidatedContext || ""}`);
  const email = extractEmail(text);
  if (email) session.context.email = email;

  if (looksLikeGreeting(text) && session.messageCount <= 2 && !session.contactName) {
    return {
      success: true,
      output: { leadStage: "contatado" },
      message: "Ola! Sou a assistente da clinica. Como posso te chamar?",
    };
  }

  if (isPriceQuestion(text)) {
    return {
      success: true,
      output: { leadStage: "qualificado" },
      message: "O valor depende do que o profissional identificar na avaliacao. A consulta serve justamente para te dar clareza e um plano seguro, sem eu te passar um valor impreciso por aqui.",
    };
  }

  if (!procedure) {
    const fallback = HAS_GEMINI_KEY
      ? await callLLM(
          `Voce e Sofia, assistente de clinica. Acolha em portugues, nao diga que e IA, nao diagnostique, faca uma pergunta simples para entender a necessidade e conduza para avaliacao quando fizer sentido. Contexto: ${session.context.consolidatedContext || "sem contexto"}`,
          text
        ).catch(() => "")
      : "";
    return {
      success: true,
      output: { leadStage: "contatado" },
      message: fallback || "Entendi. Me conta um pouco melhor o que voce gostaria de resolver ou qual procedimento tem interesse?",
    };
  }

  const doctor = findDoctorForProcedure(data, procedure);
  session.context.procedureInterest = procedure.name;
  session.context.specialty = procedure.specialty;
  if (doctor) session.context.doctorId = doctor.id;

  const doctorText = doctor
    ? `O profissional indicado para esse caso e ${doctor.name}, da area de ${doctor.specialty}.`
    : `Esse procedimento fica ligado a area de ${procedure.specialty}.`;
  const mediaText = procedure.mediaUrl
    ? `\n\nTenho uma midia de referencia para te mostrar: ${procedure.mediaUrl}${procedure.mediaCaption ? `\n${procedure.mediaCaption}` : ""}`
    : procedure.mediaCaption ? `\n\n${procedure.mediaCaption}` : "";

  return {
    success: true,
    output: {
      qualified: true,
      suggestedNeed: procedure.name,
      urgency: "baixa",
      procedure: {
        id: procedure.id,
        name: procedure.name,
        specialty: procedure.specialty,
        doctorId: doctor?.id || procedure.doctorId,
        doctorName: doctor?.name || procedure.doctorName,
        mediaUrl: procedure.mediaUrl,
        mediaType: procedure.mediaType,
        mediaCaption: procedure.mediaCaption,
      },
      leadStage: "qualificado",
    },
    message: `${procedure.name}: ${procedure.description}\n\n${doctorText}${mediaText}\n\nO primeiro passo e uma avaliacao para confirmar indicacao e montar um plano seguro. Quer que eu veja horarios disponiveis?`,
  };
};

const especialistaProcedimento: ActionHandler = async (session, input) => {
  const text = String(input.message || input.conversation || input.query || "").trim();
  const data = await loadData();
  const agent = data.serviceAgents.find(a => a.id === session.agentId);
  const procedure = findProcedure(data, `${text}\n${session.context.procedureInterest || ""}\n${session.context.consolidatedContext || ""}`);

  if (!procedure) {
    return {
      success: true,
      output: { escalationTo: agent?.escalationTo || "Equipe clinica", reason: "procedimento_nao_identificado" },
      message: "Essa pergunta e importante e eu prefiro encaminhar para a equipe te orientar com precisao.",
    };
  }

  const lower = text.toLowerCase();
  const controlledAnswers: Record<string, Array<[RegExp, string]>> = {
    "Clareamento Dental": [
      [/d[oó]i|dor|sensibilidade/, "O clareamento geralmente e bem tolerado. Algumas pessoas podem sentir sensibilidade temporaria, por isso a avaliacao profissional e importante."],
      [/tempo|dura|sess[aã]o/, "A duracao varia conforme a tecnica indicada. A avaliacao define o melhor protocolo para o seu caso."],
      [/resultado|branco|clareia/, "O objetivo e deixar o sorriso mais claro de forma natural e segura. O resultado varia de pessoa para pessoa."],
    ],
    "Toxina Botulinica": [
      [/como funciona|serve|para que/, "A toxina botulinica relaxa pontos especificos da musculatura para suavizar rugas de expressao e prevenir marcacoes mais profundas."],
      [/d[oó]i|dor|agulha/, "A aplicacao costuma ser rapida, com desconforto leve. A avaliacao ajuda a explicar pontos, cuidados e expectativa de resultado."],
      [/tempo|resultado|efeito|dura/, "O resultado nao e imediato e costuma aparecer progressivamente. A duracao varia por pessoa, por isso o profissional orienta no atendimento."],
    ],
    "Limpeza de Pele": [
      [/serve|para que|beneficio/, "A limpeza de pele ajuda a remover impurezas, cravos e celulas mortas, melhorando textura e aspecto da pele."],
      [/recupera|vermelh|p[oó]s|depois/, "Pode haver vermelhidao temporaria. Os cuidados pos-procedimento devem ser orientados pelo profissional."],
      [/d[oó]i|dor/, "Pode haver algum desconforto em pontos especificos, mas o procedimento e conduzido para ser o mais confortavel possivel."],
    ],
  };

  const answers = controlledAnswers[procedure.name] || [];
  const found = answers.find(([pattern]) => pattern.test(lower));
  if (found) {
    return {
      success: true,
      output: { answer: found[1], procedure: { id: procedure.id, name: procedure.name } },
      message: `${found[1]}\n\nPara te orientar com seguranca, o ideal e confirmar isso em uma avaliacao.`,
    };
  }

  if (HAS_GEMINI_KEY) {
    const systemPrompt = `Voce e um especialista de procedimentos de clinica. Responda somente com base nos dados do procedimento abaixo e regras de seguranca. Nao invente duracao, preco, riscos especificos ou diagnostico. Se faltar informacao, encaminhe para humano.\nProcedimento: ${procedure.name}\nDescricao: ${procedure.description}\nLegenda: ${procedure.mediaCaption || ""}`;
    const raw = await callLLM(systemPrompt, text);
    if (raw && !/nao tenho|não tenho|encaminhar/i.test(raw)) {
      return { success: true, output: { answer: raw, procedure: { id: procedure.id, name: procedure.name } }, message: raw };
    }
  }

  return {
    success: true,
    output: { escalationTo: agent?.escalationTo || "Equipe clinica", reason: "pergunta_tecnica_sem_base" },
    message: "Essa e uma pergunta bem especifica. Para te passar uma resposta segura, vou encaminhar para nossa equipe.",
  };
};

const responderPergunta: ActionHandler = async (session, input) => {
  const question = String(input.question || input.pergunta || input.message || input.conversation || "");

  if (!HAS_GEMINI_KEY) {
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

  const history = (input.conversationHistory as any[]) || [];
  const historyStr = history.length > 0
    ? history.map((h: any) => `${h.role === "user" ? "Paciente" : "Assistente"}: ${h.content}`).join("\n")
    : "Nenhum historico ainda.";

  const agentCtx = String(input.agentContext || "");
  const consolidatedContext = String(input.consolidatedContext || session.context.consolidatedContext || "");

  let appointmentStr = "";
  if (session.appointmentId) {
    const apt = data.appointments.find((a: Appointment) => a.id === session.appointmentId);
    if (apt) {
      const doctor = data.doctors.find((d: Doctor) => d.id === apt.doctorId);
      appointmentStr = `\nConsulta atual: ${apt.date} as ${apt.timeStart} com ${doctor?.name || "N/A"} (${apt.status})`;
    }
  }

  const systemPrompt = `Você é um assistente virtual de uma clinica medica chamado ${agent?.name || "Assistente"}.

${agentCtx}

Memoria consolidada do paciente:
${consolidatedContext || "Sem memoria consolidada ainda."}

Regras importantes:
1. NÃO repita informações que já foram ditas na conversa
2. NÃO peça informações que o paciente já forneceu
3. NÃO invente informações medicas
4. Se o paciente já tem consulta agendada, NÃO ofereça agendar outra a menos que ele peça
5. Responda em portugues de forma clara, objetiva e natural
6. Se nao souber algo, diga que vai transferir para um atendente humano
7. Mantenha o contexto da conversa - lembre do que foi discutido antes
8. Se o paciente ja perguntou algo e voce ja respondeu, nao repita a resposta

Conhecimento: ${knowledgeBase.join(", ")}
Estagio do lead: ${session.leadStage || "novo"}${appointmentStr}`;

  const prompt = `--- HISTORICO DA CONVERSA (ordenado do mais antigo ao mais recente) ---
${historyStr}

--- ULTIMA MENSAGEM DO PACIENTE ---
Paciente (${session.contactName}): ${question}

--- INSTRUCAO ---
Responda considerando TODO o historico acima. Nao repita o que ja foi dito. Seja natural e coerente.`;

  const answer = await callLLM(systemPrompt, prompt);

  return {
    success: true,
    output: { answer, question, usedKb: true, conversationHistory: history },
    message: answer
  };
};

const consultarProntuario: ActionHandler = async (session, input) => {
  const data = await loadData();
  const patientQuery = String(input.patientId || input.patientName || session.patientId || session.contactName || "").toLowerCase();
  if (!patientQuery) return { success: false, output: {}, message: "Paciente nao informado para consulta do prontuario" };

  let patient = data.patients.find(p => p.id === patientQuery);
  if (!patient) {
    patient = data.patients.find(p => normalize(p.fullName).includes(normalize(patientQuery)));
  }
  if (!patient) return { success: false, output: {}, message: "Paciente nao encontrado" };

  const record = data.medicalRecords[patient.id];
  if (!record) return { success: false, output: { patient: { id: patient.id, name: patient.fullName }, record: null }, message: "Prontuario vazio para este paciente" };

  return {
    success: true,
    output: {
      patient: { id: patient.id, name: patient.fullName, phone: patient.phone },
      record: {
        bloodType: record.bloodType,
        allergies: record.allergies,
        medications: record.medications,
        chronicDiseases: record.chronicDiseases,
        lastEntry: record.entries?.[0] || null,
        entryCount: record.entries?.length || 0,
      }
    },
    message: `Prontuario de ${patient.fullName}: ${record.entries?.length || 0} registro(s)`
  };
};

const consultarFinanceiro: ActionHandler = async (session, input) => {
  const data = await loadData();
  const patientQuery = String(input.patientId || input.patientName || session.patientId || session.contactName || "").toLowerCase();

  let patient = data.patients.find(p => p.id === patientQuery);
  if (!patient) {
    patient = data.patients.find(p => normalize(p.fullName).includes(normalize(patientQuery)));
  }

  const totalReceitas = data.financeTransactions.filter(t => t.type === "receita").reduce((s, t) => s + t.value, 0);
  const totalDespesas = data.financeTransactions.filter(t => t.type === "despesa").reduce((s, t) => s + t.value, 0);
  const totalPendente = data.appointments.filter(a => a.paymentStatus === "pending").length;
  const totalPago = data.appointments.filter(a => a.paymentStatus === "paid").length;

  let patientDebt = 0;
  let patientAppointments: any[] = [];
  if (patient) {
    patientAppointments = data.appointments.filter(a => {
      const aPatient = data.patients.find(p => p.fullName.toUpperCase() === a.patientName.toUpperCase());
      return aPatient?.id === patient.id;
    });
    patientDebt = patientAppointments.filter(a => a.paymentStatus === "pending").length;
  }

  return {
    success: true,
    output: {
      summary: { totalReceitas, totalDespesas, saldo: totalReceitas - totalDespesas, pendentes: totalPendente, pagos: totalPago },
      patient: patient ? { id: patient.id, name: patient.fullName, debt: patientDebt, appointments: patientAppointments.length } : null,
    },
    message: `Financeiro: R$ ${(totalReceitas - totalDespesas).toFixed(2)} de saldo | ${totalPendente} consultas pendentes`
  };
};

const enviarOrcamento: ActionHandler = async (session, input) => {
  const data = await loadData();
  const procedure = String(input.procedure || input.servico || input.procedimento || "");
  const doctorId = String(input.doctorId || session.context.doctorId || "");

  if (!procedure) return { success: false, output: {}, message: "Informe o procedimento para orcamento" };

  const price = data.servicePrices.find(p => normalize(p.name).includes(normalize(procedure)) || normalize(procedure).includes(normalize(p.name)));
  const doctor = doctorId ? data.doctors.find(d => d.id === doctorId) : null;

  const priceValue = price?.value || 0;
  const message = `Orçamento:\nProcedimento: ${price?.name || procedure}\nValor: R$ ${priceValue.toFixed(2)}\n${doctor ? `Profissional: ${doctor.name}\n` : ""}Formas de pagamento: Dinheiro, Cartão, Pix\n\nDeseja agendar?`;

  return {
    success: true,
    output: {
      procedure: price?.name || procedure,
      value: priceValue,
      doctor: doctor ? { id: doctor.id, name: doctor.name } : null,
      message,
    },
    message: `Orçamento para ${price?.name || procedure}: R$ ${priceValue.toFixed(2)}`
  };
};

const consultarPacienteCompleto: ActionHandler = async (session, input) => {
  const data = await loadData();
  const query = String(input.query || input.name || input.phone || session.patientId || session.contactName || "").toLowerCase().trim();
  if (!query) return { success: false, output: {}, message: "Informe nome ou telefone do paciente" };

  let patient = data.patients.find(p => p.id === query);
  if (!patient) {
    patient = data.patients.find(p =>
      normalize(p.fullName).includes(normalize(query)) ||
      p.phone.replace(/\D/g, "").includes(query.replace(/\D/g, ""))
    );
  }
  if (!patient) return { success: false, output: {}, message: "Paciente nao encontrado" };

  const record = data.medicalRecords[patient.id];
  const appointments = data.appointments.filter(a => {
    const aPatient = data.patients.find(p => p.fullName.toUpperCase() === a.patientName.toUpperCase());
    return aPatient?.id === patient.id;
  });
  const lastAppointment = appointments.sort((a, b) => b.date.localeCompare(a.date))[0] || null;

  return {
    success: true,
    output: {
      patient: {
        id: patient.id, name: patient.fullName, phone: patient.phone, email: patient.email,
        birthDate: patient.birthDate, healthPlan: patient.healthPlan,
      },
      record: record ? {
        bloodType: record.bloodType, allergies: record.allergies,
        medications: record.medications, chronicDiseases: record.chronicDiseases,
        entries: record.entries?.length || 0,
      } : null,
      appointments: {
        total: appointments.length,
        lastDate: lastAppointment?.date || null,
        lastDoctor: lastAppointment ? data.doctors.find(d => d.id === lastAppointment.doctorId)?.name : null,
        nextAppointment: appointments.find(a => a.status === "agendado" || a.status === "confirmado") || null,
      },
      historySummary: appointments.map(a => ({
        date: a.date, doctor: data.doctors.find(d => d.id === a.doctorId)?.name, status: a.status
      })),
    },
    message: `Paciente ${patient.fullName}: ${appointments.length} consultas | ${record?.entries?.length || 0} registros`
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
  atender_qualificar: atenderQualificar,
  responder_faq: responderFaq,
  buscar_procedimento: buscarProcedimento,
  especialista_procedimento: especialistaProcedimento,
  responder_pergunta: responderPergunta,
  consultar_prontuario: consultarProntuario,
  consultar_financeiro: consultarFinanceiro,
  enviar_orcamento: enviarOrcamento,
  consultar_paciente_completo: consultarPacienteCompleto,
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
    atender_qualificar: "Atender e Qualificar",
    responder_faq: "Responder FAQ",
    buscar_procedimento: "Buscar Procedimento",
    especialista_procedimento: "Especialista em Procedimento",
    responder_pergunta: "Responder Pergunta",
    consultar_prontuario: "Consultar Prontuario",
    consultar_financeiro: "Consultar Financeiro",
    enviar_orcamento: "Enviar Orcamento",
    consultar_paciente_completo: "Consultar Paciente Completo",
  };
  return labels[type] || type;
}
