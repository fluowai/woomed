import { loadData, saveData } from "../data";
import type { AgentSession, AgentActionType, AgentAction, AgentExecutionLog } from "../../src/agent-types";
import type { ServiceAgent, Patient, Doctor, Appointment } from "../../src/types";
import { matchAgent, findOrCreateSession, updateSession, createAction, updateAction, logExecution, createLead, updateLead, getSession } from "./agent-runtime";
import { executeAction } from "./agent-actions";
import { HAS_GEMINI_KEY, GEMINI_API_KEY } from "../config";
import { nowIso } from "../helpers";

interface IncomingMessage {
  text: string;
  from: string;
  senderName: string;
  channel: string;
  connectionId?: string;
}

interface RouterResult {
  reply: string;
  session: AgentSession;
  action?: AgentAction;
  escalated: boolean;
}

const MAX_HISTORY = 12;

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

function getConversationHistory(session: AgentSession): any[] {
  return (session.context.conversationHistory as any[]) || [];
}

function addToConversationHistory(session: AgentSession, role: "user" | "assistant", content: string): void {
  const history = getConversationHistory(session);
  history.push({ role, content, timestamp: nowIso() });
  if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
  session.context.conversationHistory = history;
}

function formatConversationHistory(history: any[]): string {
  return history.map(h => `${h.role === "user" ? "Paciente" : "Assistente"}: ${h.content}`).join("\n");
}

async function buildAgendaContext(data: any, session: AgentSession): Promise<string> {
  const parts: string[] = [];

  if (session.patientId) {
    const patient = data.patients.find((p: Patient) => p.id === session.patientId);
    if (patient) {
      const patientAppointments = data.appointments
        .filter((a: Appointment) => {
          const match = data.patients.find((p: Patient) => p.fullName.toUpperCase() === a.patientName.toUpperCase());
          return match?.id === patient.id;
        })
        .sort((a: Appointment, b: Appointment) => b.date.localeCompare(a.date))
        .slice(0, 5);
      if (patientAppointments.length > 0) {
        parts.push("--- Consultas do Paciente ---");
        patientAppointments.forEach((a: Appointment) => {
          const doctor = data.doctors.find((d: Doctor) => d.id === a.doctorId);
          parts.push(`${a.date} as ${a.timeStart} com ${doctor?.name || "N/A"} (${a.status})`);
        });
      }
    }
  }

  const doctors = data.doctors || [];
  if (doctors.length > 0) {
    parts.push("--- Profissionais Disponiveis ---");
    doctors.forEach((d: Doctor) => {
      parts.push(`${d.name} - ${d.specialty} (${d.availableDays?.join(", ") || "Seg-Sex"} ${d.workingHours?.start || "08:00"}-${d.workingHours?.end || "18:00"})`);
    });
  }

  return parts.join("\n");
}

async function extractIntentWithLLM(text: string, leadStage: string, agent: ServiceAgent, conversationSummary?: string): Promise<{ action: AgentActionType; params: Record<string, unknown> } | null> {
  if (!HAS_GEMINI_KEY) return null;

  const systemPrompt = `Você é um roteador de intenções para uma clínica médica.
Analise a mensagem do paciente e o estágio atual do lead e responda APENAS JSON com a ação mais adequada.

Ações disponíveis:
- "cancelar_consulta": Paciente quer cancelar consulta
- "remarcar_consulta": Paciente quer reagendar
- "confirmar_consulta": Paciente quer confirmar
- "sugerir_horarios": Paciente quer agendar nova consulta
- "classificar_urgencia": Situação de emergência/dor/urgência
- "coletar_feedback": Paciente quer dar feedback/avaliação
- "escalar_humano": Paciente pediu atendente humano, reclamação
- "buscar_paciente": Perguntando sobre dados de paciente
- "responder_pergunta": Pergunta geral sobre clínica, serviços, convênios
- "agendar_consulta": Paciente escolheu um horário específico
- "criar_tarefa": Solicitação de tarefa para equipe

Regras importantes:
- Se o lead já está agendado (leadStage=agendado), use "responder_pergunta" para continuar conversando naturalmente
- Se o lead já está qualificado (leadStage=qualificado), não precisa qualificar de novo
- Se o paciente está escolhendo um horário entre opções já oferecidas, use "agendar_consulta"

Estágio atual do lead: ${leadStage}
Nome do agente: ${agent?.name || "Assistente"}
Objetivo: ${agent?.objective || "Atender pacientes"}
Regras: ${(agent?.rules || []).join("; ")}

Responda APENAS JSON: {"action": "nome_da_acao", "reason": "explicacao_curta", "params": {}}`;

  const prompt = `Mensagem: "${text}"\n${conversationSummary ? `Resumo da conversa: ${conversationSummary}` : ""}
${leadStage === "agendando" ? "O paciente está no estágio de escolha de horário. Verifique se ele mencionou um horário/dia específico." : ""}
${leadStage === "agendado" ? "O paciente já tem consulta agendada. Responda normalmente sem tentar reagendar a menos que ele peça." : ""}`;

  try {
    const raw = await callLLM(systemPrompt, prompt);
    const parsed = JSON.parse(raw);
    if (parsed.action) {
      return { action: parsed.action as AgentActionType, params: { ...(parsed.params || {}), llmReason: parsed.reason || "" } };
    }
  } catch {}
  return null;
}

function extractIntentKeywords(text: string): { action: AgentActionType; params: Record<string, unknown> } | null {
  const lower = text.toLowerCase().trim();

  if (/cancelar|desmarcar|cancela|desmarcado/i.test(lower)) {
    return { action: "cancelar_consulta", params: { motivo: text } };
  }
  if (/remarcar|reagendar|mudar.horario|alterar|outro.horario|outra.data/i.test(lower)) {
    return { action: "remarcar_consulta", params: { motivo: text } };
  }
  if (/confirmar|confirmo|pode.confirmar|confirmado|confirmada/i.test(lower)) {
    return { action: "confirmar_consulta", params: {} };
  }
  if (/agendar|marcar|quero.consulta|quero.agendar|horario.dispon|marcar.consulta|quero.marcar/i.test(lower)) {
    return { action: "sugerir_horarios", params: { conversation: text } };
  }
  if (/urgente|emergencia|dor|sangrando|grave|imediatamente|preciso.de.ajuda.agora/i.test(lower)) {
    return { action: "classificar_urgencia", params: { message: text } };
  }
  if (/feedback|avaliacao|nota|satisfacao|como.foi|avaliar/i.test(lower)) {
    return { action: "coletar_feedback", params: {} };
  }
  if (/falar.com.humano|atendente|transferir|humano|suporte|reclamacao|falar.pessoa|quero.falar|atendente.humano/i.test(lower)) {
    return { action: "escalar_humano", params: { motivo: text } };
  }
  return null;
}

async function decideNextAction(session: AgentSession, text: string, agent: ServiceAgent): Promise<{ action: AgentActionType; params: Record<string, unknown> }> {
  if (session.leadStage === "agendado" || session.leadStage === "convertido") {
    const lower = text.toLowerCase();
    if (/cancelar|remarcar|reagendar|desmarcar/.test(lower)) {
      const intent = extractIntentKeywords(text);
      if (intent) return intent;
    }
    return { action: "responder_pergunta", params: { message: text } };
  }

  if (session.leadStage === "perdido") {
    const lower = text.toLowerCase();
    if (/agendar|marcar|quero|consulta|horario/.test(lower)) {
      return { action: "sugerir_horarios", params: { conversation: text } };
    }
    return { action: "responder_pergunta", params: { message: text } };
  }

  const llmIntent = await extractIntentWithLLM(text, session.leadStage || "novo", agent);
  if (llmIntent) return llmIntent;

  const intentMatch = extractIntentKeywords(text);
  if (intentMatch) return intentMatch;

  if (session.leadStage === "novo" || session.leadStage === "contatado") {
    return { action: "qualificar_lead", params: { conversation: text, name: session.contactName } };
  }
  if (session.leadStage === "qualificado") {
    return { action: "sugerir_horarios", params: { conversation: text } };
  }
  if (session.leadStage === "agendando") {
    return { action: "agendar_consulta", params: { conversation: text } };
  }

  return { action: "responder_pergunta", params: { message: text } };
}

async function buildRichContext(agent: ServiceAgent, session: AgentSession): Promise<string> {
  const data = await loadData();
  const parts: string[] = [];

  parts.push(`Nome do agente: ${agent.name}`);
  parts.push(`Objetivo: ${agent.objective}`);
  parts.push(`Tom: ${agent.tone}`);
  parts.push(`Regras: ${agent.rules.join("; ")}`);
  parts.push(`Conhecimento: ${agent.knowledgeBase.join("; ")}`);
  parts.push(`Horario: ${agent.workingHours}`);

  const agenda = await buildAgendaContext(data, session);
  if (agenda) parts.push(agenda);

  return parts.join("\n");
}

export async function processIncomingMessage(msg: IncomingMessage, overrideAgentId?: string): Promise<RouterResult> {
  const data = await loadData();
  const agents = data.serviceAgents;

  const agent = overrideAgentId
    ? agents.find(a => a.id === overrideAgentId && a.status === "active") || null
    : matchAgent(msg.text, msg.channel, agents);
  if (!agent) {
    return {
      reply: "Olá! No momento não tenho um atendente disponível para sua solicitação. Em breve alguém entrará em contato.",
      session: null as unknown as AgentSession,
      escalated: true,
    };
  }

  const session = await findOrCreateSession(
    msg.from, msg.senderName, msg.from,
    msg.channel, agent.id, agent.name
  );

  addToConversationHistory(session, "user", msg.text);
  await updateSession(session.id, { context: session.context });

  const startTime = Date.now();
  const { action: actionType, params } = await decideNextAction(session, msg.text, agent);

  const action = await createAction(session.id, agent.id, actionType, { ...params, rawMessage: msg.text });
  await updateAction(action.id, { status: "executing" });

  try {
    const agentContext = await buildRichContext(agent, session);
    const history = getConversationHistory(session);
    const conversationSummary = formatConversationHistory(history);

    const enrichedParams = {
      ...params,
      conversation: msg.text,
      conversationHistory: history,
      conversationSummary,
      knowledgeBase: agent.knowledgeBase,
      agentContext,
      session,
    };

    if (session.appointmentId) {
      const apt = data.appointments.find((a: Appointment) => a.id === session.appointmentId);
      if (apt) (enrichedParams as any).currentAppointment = apt;
    }

    const result = await executeAction(session, actionType, enrichedParams);
    const latency = Date.now() - startTime;

    await updateAction(action.id, {
      status: result.success ? "completed" : "failed",
      output: result.output,
      completedAt: new Date().toISOString(),
    });

    const replyText = result.output?.answer ? String(result.output.answer) : result.message;
    addToConversationHistory(session, "assistant", replyText);

    await logExecution(
      session.id, agent.id, actionType,
      msg.text, replyText, result.success, latency,
      result.success ? undefined : result.message
    );

    if (result.success && result.output) {
      if ((result.output as any).urgency) {
        await updateSession(session.id, { urgency: (result.output as any).urgency as any });
      }
      if ((result.output as any).qualified === true) {
        const o = result.output as any;
        await createLead(
          session.id, session.contactName, session.contactPhone,
          o.suggestedNeed || "", o.urgency || "baixa",
          session.channel, agent.id
        );
        await updateSession(session.id, { leadStage: "qualificado" });
      }
      if ((result.output as any).appointment) {
        const apt = (result.output as any).appointment as any;
        if (apt.id) {
          await updateSession(session.id, {
            leadStage: "agendado",
            appointmentId: apt.id,
            patientId: apt.patientId,
          });
        }
      }
      if ((result.output as any).suggestions) {
        await updateSession(session.id, { leadStage: "agendando" });
      }
      if ((result.output as any).escalationTo) {
        await updateSession(session.id, { status: "waiting_human" });
      }
    }

    await updateSession(session.id, { context: session.context });

    if (actionType === "escalar_humano" || result.output?.escalationTo) {
      return { reply: replyText, session, action, escalated: true };
    }

    return { reply: replyText, session, action, escalated: false };
  } catch (error) {
    const latency = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : "Erro desconhecido";

    await updateAction(action.id, { status: "failed", error: errorMsg });
    await logExecution(session.id, agent.id, actionType, msg.text, "", false, latency, errorMsg);

    return {
      reply: "Desculpe, ocorreu um erro ao processar sua mensagem. Um atendente será notificado.",
      session,
      action,
      escalated: true,
    };
  }
}

export function autoReplyFor(actionType: AgentActionType, result: { success: boolean; message: string; output: Record<string, unknown> }): string {
  if (!result.success) return result.message;

  switch (actionType) {
    case "qualificar_lead":
      return "Obrigado! Deixe-me verificar os melhores horários disponíveis para você.";
    case "sugerir_horarios": {
      const suggestions = result.output.suggestions as Array<{ date: string; time: string }> | undefined;
      if (!suggestions || suggestions.length === 0) return "Não encontrei horários disponíveis. Deseja falar com um atendente?";
      return `Temos estes horários disponíveis:\n${suggestions.slice(0, 3).map((s, i) => `${i + 1}. ${s.date} às ${s.time}`).join("\n")}\n\nQual prefere?`;
    }
    case "agendar_consulta":
      return result.message + " Enviamos a confirmação. Posso ajudar em mais algo?";
    case "confirmar_consulta":
      return "Sua consulta foi confirmada! Estaremos esperando por você.";
    case "cancelar_consulta":
      return result.message + " Se precisar remarcar, é só avisar.";
    case "enviar_lembrete":
      return "Lembrete enviado com sucesso!";
    case "coletar_feedback":
      return "Sua opinião é muito importante! De 0 a 10, como foi seu atendimento?";
    case "escalar_humano":
      return "Estou transferindo para um atendente humano. Em breve alguém falará com você.";
    default:
      return result.message;
  }
}
