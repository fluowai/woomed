import { loadData, saveData } from "../data";
import { HAS_GEMINI_KEY, GEMINI_API_KEY, WHATSMEOW_API_URL } from "../config";
import type { Appointment, AutomationReminder } from "../../src/types";
import { nowIso, addMinutes } from "../helpers";
import { checkFollowUps, findAbandonedSessions, registerForFollowUp, unregisterFromFollowUp } from "./followup";

const CHECK_INTERVAL_MS = 5 * 60 * 1000;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

interface SchedulerTask {
  id: string;
  type: "reminder" | "followup_check" | "abandonment_check" | "confirmation" | "feedback";
  scheduledAt: string;
  status: "pending" | "executing" | "completed" | "failed";
  params: Record<string, unknown>;
  createdAt: string;
  completedAt?: string;
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

function getSchedulerData(data: any): { tasks: SchedulerTask[] } {
  if (!data.__scheduler) data.__scheduler = { tasks: [] };
  return data.__scheduler;
}

async function sendWhatsAppMessage(connectionId: string, to: string, text: string): Promise<void> {
  if (!WHATSMEOW_API_URL) return;
  try {
    await fetch(`${WHATSMEOW_API_URL}/messages/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ connectionId, to, text }),
    });
  } catch (err) {
    console.error(`[Scheduler] WhatsApp send failed:`, err);
  }
}

async function processReminders(): Promise<void> {
  const data = await loadData();
  const reminders: AutomationReminder[] = (data as any).automationReminders || [];
  const now = new Date();

  for (const reminder of reminders) {
    if (reminder.status !== "pending") continue;
    if (new Date(reminder.scheduledFor) > now) continue;

    const conn = data.whatsappConnections?.[0];
    if (!conn || conn.status !== "connected") continue;

    const patient = data.patients.find(p => p.id === reminder.patientId);
    const appointment = data.appointments.find(a => a.id === reminder.appointmentId);
    const doctor = appointment ? data.doctors.find(d => d.id === appointment.doctorId) : undefined;

    let message = reminder.message;
    if (message.includes("{{patientName}}") && patient) message = message.replace(/\{\{patientName\}\}/g, patient.fullName);
    if (message.includes("{{doctorName}}") && doctor) message = message.replace(/\{\{doctorName\}\}/g, doctor.name);
    if (message.includes("{{date}}") && appointment) message = message.replace(/\{\{date\}\}/g, appointment.date);
    if (message.includes("{{time}}") && appointment) message = message.replace(/\{\{time\}\}/g, appointment.timeStart);

    const toJid = patient?.phone || reminder.destination;
    if (toJid && conn.id) {
      await sendWhatsAppMessage(conn.id, toJid, message);
    }

    reminder.status = "sent";
    reminder.sentAt = nowIso();
  }

  (data as any).automationReminders = reminders;
  await saveData(data);
}

async function processScheduledConfirmations(): Promise<void> {
  const data = await loadData();
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split("T")[0];

  const pendingConfirmations = data.appointments.filter(
    a => a.date === tomorrowStr && a.status === "agendado"
  );

  for (const apt of pendingConfirmations) {
    const patient = data.patients.find(
      p => p.fullName.toUpperCase() === apt.patientName.toUpperCase()
    );
    if (!patient) continue;

    const conn = data.whatsappConnections?.[0];
    if (!conn || conn.status !== "connected") continue;

    const doctor = data.doctors.find(d => d.id === apt.doctorId);
    const message = `Olá ${apt.patientName}! 😊 Lembramos da sua consulta${doctor ? ` com ${doctor.name}` : ""} amanhã (${apt.date}) às ${apt.timeStart}. Por favor, confirme sua presença respondendo "confirmar" ou "remarcar" se precisar alterar.`;

    const phoneJid = patient.phone;
    if (phoneJid) {
      await sendWhatsAppMessage(conn.id, phoneJid, message);

      const rt = (data as any).__agentRuntime || {};
      if (!rt.executionLogs) rt.executionLogs = [];
      rt.executionLogs.push({
        id: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        sessionId: `auto-${apt.id}`,
        agentId: "scheduler",
        action: "enviar_lembrete",
        prompt: `Lembrete automático de consulta: ${apt.patientName}`,
        response: message,
        modelUsed: "scheduler-system",
        tokensUsed: 0,
        latencyMs: 0,
        success: true,
        createdAt: nowIso(),
      });
      (data as any).__agentRuntime = rt;
    }
  }

  await saveData(data);
}

async function processPostAppointmentFeedback(): Promise<void> {
  const data = await loadData();
  const now = new Date();
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  const completedAppointments = data.appointments.filter(
    a => a.date === yesterdayStr && (a.status === "atendido" || a.status === "em_atendimento")
  );

  for (const apt of completedAppointments) {
    const patient = data.patients.find(
      p => p.fullName.toUpperCase() === apt.patientName.toUpperCase()
    );
    if (!patient) continue;

    const alreadySent = (data as any).npsResponses?.some(
      (r: any) => r.appointmentId === apt.id
    );
    if (alreadySent) continue;

    const conn = data.whatsappConnections?.[0];
    if (!conn || conn.status !== "connected") continue;

    const message = `Olá ${apt.patientName}! 😊 Seu atendimento foi ontem. Gostaríamos de saber como foi sua experiência! De 0 a 10, qual nota você dá para o atendimento? (0 = muito ruim, 10 = excelente)`;

    const phoneJid = patient.phone;
    if (phoneJid) {
      await sendWhatsAppMessage(conn.id, phoneJid, message);
    }
  }

  await saveData(data);
}

async function tick(): Promise<void> {
  try {
    await processReminders();
    await processScheduledConfirmations();
    await processPostAppointmentFeedback();
    await findAbandonedSessions();
    await checkFollowUps();
  } catch (err) {
    console.error("[Scheduler] Tick error:", err);
  }
}

export function startScheduler(): void {
  if (intervalHandle) return;
  console.log("[Scheduler] Iniciando agendador de tarefas...");
  tick();
  intervalHandle = setInterval(tick, CHECK_INTERVAL_MS);
}

export function stopScheduler(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[Scheduler] Agendador parado.");
  }
}

export async function getSchedulerStatus(): Promise<{
  running: boolean;
  taskCount: number;
  lastTick: string;
}> {
  const data = await loadData();
  const sched = getSchedulerData(data as any);
  return {
    running: intervalHandle !== null,
    taskCount: sched.tasks.length,
    lastTick: new Date().toISOString(),
  };
}

export async function scheduleReminder(params: {
  patientId: string;
  appointmentId?: string;
  channel: string;
  destination: string;
  message: string;
  scheduledFor: string;
  templateId?: string;
}): Promise<AutomationReminder> {
  const data = await loadData();
  const { randomUUID } = await import("crypto");
  const reminder: AutomationReminder = {
    id: randomUUID(),
    templateId: params.templateId,
    appointmentId: params.appointmentId,
    patientId: params.patientId,
    channel: params.channel as any,
    destination: params.destination,
    message: params.message,
    status: "pending",
    scheduledFor: params.scheduledFor,
    createdAt: nowIso(),
  };

  if (!(data as any).automationReminders) (data as any).automationReminders = [];
  (data as any).automationReminders.push(reminder);
  await saveData(data);
  return reminder;
}

export async function generateAndScheduleReminders(): Promise<void> {
  const data = await loadData();
  const templates: any[] = (data as any).automationTemplates || [];
  const now = new Date();

  for (const template of templates) {
    if (!template.isActive) continue;

    let targetAppointments: Appointment[] = [];

    switch (template.triggerEvent) {
      case "appointment_reminder": {
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        const tomorrowStr = tomorrow.toISOString().split("T")[0];
        targetAppointments = data.appointments.filter(
          a => a.date === tomorrowStr && a.status === "agendado"
        );

        for (const apt of targetAppointments) {
          const alreadyScheduled = (data as any).automationReminders?.some(
            (r: any) => r.appointmentId === apt.id && r.templateId === template.id
          );
          if (alreadyScheduled) continue;

          const patient = data.patients.find(
            p => p.fullName.toUpperCase() === apt.patientName.toUpperCase()
          );
          if (!patient) continue;

          const scheduledTime = new Date(`${apt.date}T${apt.timeStart}`);
          scheduledTime.setHours(scheduledTime.getHours() - 1);

          await scheduleReminder({
            patientId: patient.id,
            appointmentId: apt.id,
            channel: template.channel,
            destination: patient.phone,
            message: template.messageTemplate,
            scheduledFor: scheduledTime.toISOString(),
            templateId: template.id,
          });
        }
        break;
      }

      case "post_appointment": {
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split("T")[0];
        targetAppointments = data.appointments.filter(
          a => a.date === yesterdayStr && (a.status === "atendido" || a.status === "em_atendimento")
        );

        for (const apt of targetAppointments) {
          const alreadyScheduled = (data as any).automationReminders?.some(
            (r: any) => r.appointmentId === apt.id && r.templateId === template.id
          );
          if (alreadyScheduled) continue;

          const patient = data.patients.find(
            p => p.fullName.toUpperCase() === apt.patientName.toUpperCase()
          );
          if (!patient) continue;

          await scheduleReminder({
            patientId: patient.id,
            appointmentId: apt.id,
            channel: template.channel,
            destination: patient.phone,
            message: template.messageTemplate,
            scheduledFor: nowIso(),
            templateId: template.id,
          });
        }
        break;
      }
    }
  }

  await saveData(data);
}
