import { loadData, saveData } from "../data";
import type { AgentSession, AgentActionType, AgentAction } from "../../src/agent-types";
import type { ServiceAgent } from "../../src/types";
import { matchAgent, findOrCreateSession, updateSession, createAction, updateAction, logExecution, createLead, updateLead } from "./agent-runtime";
import { executeAction } from "./agent-actions";

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

function extractIntent(text: string): { action: AgentActionType; params: Record<string, unknown> } | null {
  const lower = text.toLowerCase().trim();

  if (/cancelar|desmarcar|cancela/i.test(lower)) {
    return { action: "cancelar_consulta", params: { motivo: text } };
  }
  if (/remarcar|reagendar|mudar.horario|alterar/i.test(lower)) {
    return { action: "remarcar_consulta", params: { motivo: text } };
  }
  if (/confirmar|confirmo|pode.confirmar|confirmado/i.test(lower)) {
    return { action: "confirmar_consulta", params: {} };
  }
  if (/agendar|marcar|quero.consulta|quero.agendar|horario/i.test(lower)) {
    return { action: "sugerir_horarios", params: { conversation: text } };
  }
  if (/urgente|emergencia|dor|sangrando|grave/i.test(lower)) {
    return { action: "classificar_urgencia", params: { message: text } };
  }
  if (/feedback|avaliacao|nota|satisfacao|como.foi/i.test(lower)) {
    return { action: "coletar_feedback", params: {} };
  }
  if (/falar.com.humano|atendente|transferir|humano|suporte|reclamacao|falar.pessoa/i.test(lower)) {
    return { action: "escalar_humano", params: { motivo: text } };
  }
  return null;
}

function decideNextAction(session: AgentSession, text: string): { action: AgentActionType; params: Record<string, unknown> } {
  const intentMatch = extractIntent(text);
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

async function buildAgentContext(agent: ServiceAgent): Promise<string> {
  return [
    `Nome: ${agent.name}`,
    `Objetivo: ${agent.objective}`,
    `Tom: ${agent.tone}`,
    `Regras: ${agent.rules.join("; ")}`,
    `Conhecimento: ${agent.knowledgeBase.join("; ")}`,
    `Horario: ${agent.workingHours}`,
  ].join("\n");
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

  const startTime = Date.now();
  const { action: actionType, params } = decideNextAction(session, msg.text);

  const action = await createAction(session.id, agent.id, actionType, { ...params, rawMessage: msg.text });
  await updateAction(action.id, { status: "executing" });

  try {
    const agentContext = await buildAgentContext(agent);
    const enrichedParams = {
      ...params,
      conversation: msg.text,
      knowledgeBase: agent.knowledgeBase,
      agentContext,
    };

    const result = await executeAction(session, actionType, enrichedParams);
    const latency = Date.now() - startTime;

    await updateAction(action.id, {
      status: result.success ? "completed" : "failed",
      output: result.output,
      completedAt: new Date().toISOString(),
    });

    await logExecution(
      session.id, agent.id, actionType,
      msg.text, result.message, result.success, latency,
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

    if (actionType === "escalar_humano" || result.output?.escalationTo) {
      return {
        reply: result.message,
        session,
        action,
        escalated: true,
      };
    }

    if (actionType === "cancelar_consulta" && result.success) {
      return {
        reply: result.message + " Se precisar de mais algo, estou aqui.",
        session,
        action,
        escalated: false,
      };
    }

    const reply = result.output?.answer
      ? String(result.output.answer)
      : result.message;

    return { reply, session, action, escalated: false };
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
