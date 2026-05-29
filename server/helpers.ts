import { randomUUID } from "crypto";
import { AppUser } from "../src/types";
import { AppData } from "./data";
import { Doctor, Appointment, ServicePrice } from "../src/types";

export function audit(data: AppData, user: AppUser, action: string, entity: string, entityId: string, details?: string) {
  data.auditEvents.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    action,
    entity,
    entityId,
    details
  });
}

export function timeToMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addMinutes(time: string, amount: number) {
  return minutesToTime(timeToMinutes(time) + amount);
}

export function addDays(dateStr: string, days: number) {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + days);
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export function dayName(dateStr: string) {
  const date = new Date(`${dateStr}T00:00:00`);
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
}

export function normalize(text: string) {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

export function nowIso() {
  return new Date().toISOString();
}

export function getServicePrice(type: string, prices: ServicePrice[]) {
  const normalizedType = normalize(type);
  const match = prices.find(price => {
    const normalizedName = normalize(price.name);
    return normalizedType.includes(normalizedName) || normalizedName.includes(normalizedType);
  });
  return match || { id: "svc-custom", name: type, value: 0, category: "Procedimentos Clinicos" };
}

export function isSlotAvailable(
  doctor: Doctor,
  date: string,
  timeStart: string,
  timeEnd: string,
  appointments: Appointment[],
  ignoreAppointmentId?: string
) {
  const start = timeToMinutes(timeStart);
  const end = timeToMinutes(timeEnd);
  const workStart = timeToMinutes(doctor.workingHours.start);
  const workEnd = timeToMinutes(doctor.workingHours.end);

  if (!doctor.availableDays.includes(dayName(date))) {
    return { ok: false, reason: "O profissional nao atende neste dia." };
  }

  if (start < workStart || end > workEnd || start >= end) {
    return { ok: false, reason: "Horario fora da grade do profissional." };
  }

  const conflict = appointments.find(appointment => {
    if (appointment.id === ignoreAppointmentId) return false;
    if (appointment.doctorId !== doctor.id || appointment.date !== date || appointment.status === "desmarcado") return false;
    const aptStart = timeToMinutes(appointment.timeStart);
    const aptEnd = timeToMinutes(appointment.timeEnd || addMinutes(appointment.timeStart, 30));
    return start < aptEnd && end > aptStart;
  });

  if (conflict) {
    return { ok: false, reason: `Conflito com ${conflict.patientName} as ${conflict.timeStart}.` };
  }

  return { ok: true, reason: "Horario disponivel." };
}

export function buildSuggestions(
  doctor: Doctor,
  requestedSlot: { date: string; time: string },
  currentAppointments: Appointment[],
  limit = 3
) {
  const suggestions: { date: string; time: string; reason: string }[] = [];
  const duration = 30;
  const requestedStart = timeToMinutes(requestedSlot.time);

  for (let offset = 0; offset < 21 && suggestions.length < limit; offset++) {
    const date = addDays(requestedSlot.date, offset);
    if (!doctor.availableDays.includes(dayName(date))) continue;

    const workStart = timeToMinutes(doctor.workingHours.start);
    const workEnd = timeToMinutes(doctor.workingHours.end);
    let start = offset === 0 ? Math.max(workStart, requestedStart + duration) : workStart;
    start = Math.ceil(start / duration) * duration;

    for (let minutes = start; minutes + duration <= workEnd && suggestions.length < limit; minutes += duration) {
      const time = minutesToTime(minutes);
      const end = minutesToTime(minutes + duration);
      const available = isSlotAvailable(doctor, date, time, end, currentAppointments);
      if (available.ok) {
        suggestions.push({
          date,
          time,
          reason: `Livre na agenda de ${doctor.name}`
        });
      }
    }
  }

  return suggestions;
}
