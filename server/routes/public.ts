import { randomUUID } from "crypto";
import { Express } from "express";
import { loadData, saveData } from "../data";
import { addMinutes, isSlotAvailable, nowIso } from "../helpers";
import { dataService } from "../data-service";
import { isDatabaseAvailable } from "../database";
import type { Appointment } from "../../src/types";

function ensureId() {
  return randomUUID();
}

export function registerPublicRoutes(app: Express) {
  // ============================================================
  // PUBLIC SCHEDULING — no authentication required
  // ============================================================

  // List available doctors for public booking
  app.get("/api/v2/public/doctors", async (_req, res) => {
    try {
      const doctors = await dataService.getDoctors();
      const available = doctors.filter(d => d.availableDays && d.availableDays.length > 0);
      res.json(available.map(d => ({
        id: d.id,
        name: d.name,
        specialty: d.specialty,
        availableDays: d.availableDays,
        workingHours: d.workingHours,
      })));
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Get available time slots for a doctor on a date
  app.get("/api/v2/public/slots", async (req, res) => {
    try {
      const { doctorId, date } = req.query;
      if (!doctorId || !date) return res.status(400).json({ error: "doctorId e date sao obrigatorios." });

      const doctors = await dataService.getDoctors();
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) return res.status(404).json({ error: "Profissional nao encontrado." });

      const data = await loadData();
      const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const dateObj = new Date(String(date) + 'T00:00:00');
      const dayName = dayNames[dateObj.getDay()];
      if (!doctor.availableDays.includes(dayName)) {
        return res.json({ slots: [], date, doctorId, available: false, reason: "Profissional nao atende neste dia." });
      }

      const workStart = doctor.workingHours?.start || "08:00";
      const workEnd = doctor.workingHours?.end || "18:00";
      const [startH, startM] = workStart.split(':').map(Number);
      const [endH, endM] = workEnd.split(':').map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      const appointments = data.appointments.filter(a => a.doctorId === doctorId && a.date === String(date));
      const slots: { time: string; available: boolean }[] = [];

      for (let mins = startMinutes; mins + 30 <= endMinutes; mins += 30) {
        const time = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
        const timeEnd = addMinutes(time, 30);
        const avail = isSlotAvailable(doctor, String(date), time, timeEnd, appointments);
        slots.push({ time, available: avail.ok });
      }

      res.json({ slots, date, doctorId, available: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Book an appointment (public, no auth)
  app.post("/api/v2/public/appointments", async (req, res) => {
    try {
      const { doctorId, date, timeStart, patientName, patientPhone, patientEmail, procedure } = req.body || {};
      if (!doctorId || !date || !timeStart || !patientName) {
        return res.status(400).json({ error: "doctorId, date, timeStart e patientName sao obrigatorios." });
      }

      const data = await loadData();
      const doctors = await dataService.getDoctors();
      const doctor = doctors.find(d => d.id === doctorId);
      if (!doctor) return res.status(404).json({ error: "Profissional nao encontrado." });

      const timeEnd = addMinutes(timeStart, 30);
      const avail = isSlotAvailable(doctor, date, timeStart, timeEnd, data.appointments);
      if (!avail.ok) return res.status(409).json({ error: avail.reason });

      const confirmationToken = randomUUID().replace(/-/g, '').slice(0, 12).toUpperCase();
      const apt: Appointment = {
        id: ensureId(),
        doctorId,
        date,
        timeStart,
        timeEnd,
        patientName: String(patientName).toUpperCase(),
        status: "agendado",
        type: procedure || "Consulta Particular",
        isPrivate: false,
        observations: `Agendamento online. Tel: ${patientPhone || 'N/I'}${patientEmail ? ` Email: ${patientEmail}` : ''}`,
        arrival: "N/A",
        recordStatus: "pendente",
        paymentStatus: "pending",
      };

      const created = await dataService.createAppointment(apt, {
        id: "public", name: "Portal do Paciente", role: "reception"
      } as any);

      // Store confirmation token
      if (!(data as any).publicAppointmentTokens) (data as any).publicAppointmentTokens = [];
      (data as any).publicAppointmentTokens.push({
        appointmentId: created.id,
        token: confirmationToken,
        patientName: String(patientName).toUpperCase(),
        patientPhone,
        patientEmail,
        createdAt: nowIso(),
      });
      await saveData(data);

      res.status(201).json({
        appointment: {
          id: created.id,
          doctorName: doctor.name,
          date,
          timeStart,
          timeEnd,
          patientName: String(patientName).toUpperCase(),
          status: "agendado",
          type: apt.type,
        },
        confirmationToken,
        message: `Agendamento confirmado para ${date} as ${timeStart}.`,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Check appointment by confirmation token
  app.get("/api/v2/public/appointments/:token", async (req, res) => {
    try {
      const data = await loadData();
      const tokens = (data as any).publicAppointmentTokens || [];
      const found = tokens.find((t: any) => t.token === String(req.params.token).toUpperCase());
      if (!found) return res.status(404).json({ error: "Agendamento nao encontrado." });
      const apt = data.appointments.find(a => a.id === found.appointmentId);
      if (!apt) return res.status(404).json({ error: "Agendamento nao encontrado." });
      res.json({
        appointment: apt,
        patientPhone: found.patientPhone,
        patientEmail: found.patientEmail,
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Cancel appointment by confirmation token
  app.post("/api/v2/public/appointments/:token/cancel", async (req, res) => {
    try {
      const data = await loadData();
      const tokens = (data as any).publicAppointmentTokens || [];
      const found = tokens.find((t: any) => t.token === String(req.params.token).toUpperCase());
      if (!found) return res.status(404).json({ error: "Agendamento nao encontrado." });
      const ok = await dataService.deleteAppointment(found.appointmentId, {
        id: "public", name: "Portal do Paciente", role: "reception"
      } as any);
      if (!ok) return res.status(404).json({ error: "Agendamento nao encontrado." });
      found.cancelledAt = nowIso();
      await saveData(data);
      res.json({ ok: true, message: "Agendamento cancelado com sucesso." });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================
  // PATIENT PORTAL — token-based auth
  // ============================================================

  // Patient profile via portal token
  app.get("/api/v2/portal/profile", async (req, res) => {
    const token = req.headers["x-portal-token"] as string;
    if (!token) return res.status(401).json({ error: "Token obrigatorio." });
    const data = await loadData();
    const portalTokens = data.patientPortalTokens || [];
    const found = portalTokens.find((t: any) => t.token === token && new Date(t.expiresAt) > new Date());
    if (!found) return res.status(401).json({ error: "Token invalido ou expirado." });
    const patient = data.patients.find(p => p.id === found.patientId);
    if (!patient) return res.status(404).json({ error: "Paciente nao encontrado." });
    res.json({
      id: patient.id,
      fullName: patient.fullName,
      birthDate: patient.birthDate,
      phone: patient.phone,
      email: patient.email,
      address: patient.address,
    });
  });

  // Upcoming appointments for portal patient
  app.get("/api/v2/portal/upcoming", async (req, res) => {
    const token = req.headers["x-portal-token"] as string;
    if (!token) return res.status(401).json({ error: "Token obrigatorio." });
    const data = await loadData();
    const portalTokens = data.patientPortalTokens || [];
    const found = portalTokens.find((t: any) => t.token === token && new Date(t.expiresAt) > new Date());
    if (!found) return res.status(401).json({ error: "Token invalido ou expirado." });
    const patient = data.patients.find(p => p.id === found.patientId);
    if (!patient) return res.status(404).json({ error: "Paciente nao encontrado." });
    const today = new Date().toISOString().split('T')[0];
    const upcoming = data.appointments
      .filter(a => a.patientName === patient.fullName.toUpperCase() && a.date >= today && a.status !== 'desmarcado')
      .sort((a, b) => a.date.localeCompare(b.date) || a.timeStart.localeCompare(b.timeStart));
    res.json(upcoming);
  });

  // Past appointments for portal patient
  app.get("/api/v2/portal/history", async (req, res) => {
    const token = req.headers["x-portal-token"] as string;
    if (!token) return res.status(401).json({ error: "Token obrigatorio." });
    const data = await loadData();
    const portalTokens = data.patientPortalTokens || [];
    const found = portalTokens.find((t: any) => t.token === token && new Date(t.expiresAt) > new Date());
    if (!found) return res.status(401).json({ error: "Token invalido ou expirado." });
    const patient = data.patients.find(p => p.id === found.patientId);
    if (!patient) return res.status(404).json({ error: "Paciente nao encontrado." });
    const today = new Date().toISOString().split('T')[0];
    const past = data.appointments
      .filter(a => a.patientName === patient.fullName.toUpperCase() && a.date < today)
      .sort((a, b) => b.date.localeCompare(a.date));
    res.json(past);
  });
}
