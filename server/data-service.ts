import { isDatabaseAvailable } from "./database";
import { loadData, saveData, AppData, invalidateCache } from "./data";
import * as pg from "./supabase";
import type { Patient, Doctor, Appointment, FinanceTransaction, ServiceAgent, MarketingCampaign, TissGuide, InventoryItem, ReferralRecord, ReferenceMaterial, HelpTicket, ServicePrice, AuditEvent, MedicalRecord, MedicalRecordEntry, LlmProviderConfig, NeuralKnowledgeItem, PatientDocument, WaitingListEntry, ScheduleBlock, MedicalTemplate, AccountsPayable, PaymentGatewayConfig, WhatsAppConnection, WhatsAppConversation, WhatsAppMessage } from "../src/types";
import { AppUser } from "../src/types";
import { randomUUID } from "crypto";
import { nowIso } from "./helpers";

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

const DEFAULT_TENANT = "single-tenant";

function auditEvent(data: AppData, user: AppUser, action: string, entity: string, entityId: string, details?: string) {
  data.auditEvents.push({ id: randomUUID(), createdAt: nowIso(), actorId: user.id, actorName: user.name, action, entity, entityId, details });
}

function iOrE(user: AppUser, data: AppData, action: string, entity: string, entityId: string, details?: string) {
  if (isDatabaseAvailable()) return;
  auditEvent(data, user, action, entity, entityId, details);
}

function scoped<T>(data: T, tenantId?: string): T {
  if (!tenantId) return data;
  return { ...(data as any), tenantId };
}

// ---------------------------------------------------------------------------
// Table configurations
// ---------------------------------------------------------------------------

function cfg(table: string, tenantField: string | null, extra: pg.ColumnMapping[]): pg.PgTableConfig {
  const base: pg.ColumnMapping[] = [
    { field: "id", column: "id" },
    { field: "createdAt", column: "created_at" },
    { field: "updatedAt", column: "updated_at" },
  ];
  if (tenantField) base.push({ field: "tenantId", column: tenantField });
  return { table, mappings: [...base, ...extra], tenantField: tenantField || undefined, idField: "id" };
}

const TABLES = {
  patients: cfg("patients", "tenant_id", [
    { field: "fullName", column: "full_name" },
    { field: "birthDate", column: "birth_date" },
    { field: "cpf", column: "cpf" },
    { field: "phone", column: "phone" },
    { field: "email", column: "email" },
    { field: "avatarUrl", column: "avatar_url" },
    { field: "address", column: "address", isJson: true },
    { field: "healthPlan", column: "health_plan" },
    { field: "healthPlanNumber", column: "health_plan_number" },
    { field: "emergencyContact", column: "emergency_contact" },
    { field: "emergencyPhone", column: "emergency_phone" },
    { field: "responsibleName", column: "responsible_name" },
    { field: "responsibleCpf", column: "responsible_cpf" },
    { field: "notes", column: "notes" },
    { field: "lgpdConsent", column: "lgpd_consent" },
    { field: "lgpdConsentAt", column: "lgpd_consent_at" },
  ]),
  doctors: cfg("doctors", "tenant_id", [
    { field: "name", column: "name" },
    { field: "specialty", column: "specialty" },
    { field: "crm", column: "crm" },
    { field: "email", column: "email" },
    { field: "phone", column: "phone" },
    { field: "userId", column: "user_id" },
    { field: "availableDays", column: "available_days", isArray: true },
    { field: "workingHours", column: "working_hours", isJson: true },
  ]),
  appointments: cfg("appointments", "tenant_id", [
    { field: "doctorId", column: "doctor_id" },
    { field: "patientId", column: "patient_id" },
    { field: "date", column: "date" },
    { field: "timeStart", column: "time_start" },
    { field: "timeEnd", column: "time_end" },
    { field: "patientName", column: "patient_name" },
    { field: "status", column: "status" },
    { field: "type", column: "type" },
    { field: "isPrivate", column: "is_private" },
    { field: "observations", column: "observations" },
    { field: "arrival", column: "arrival" },
    { field: "recordStatus", column: "record_status" },
    { field: "paymentStatus", column: "payment_status" },
  ]),
  financeTransactions: cfg("finance_transactions", "tenant_id", [
    { field: "date", column: "date" },
    { field: "description", column: "description" },
    { field: "value", column: "value" },
    { field: "category", column: "category" },
    { field: "type", column: "type" },
    { field: "status", column: "status" },
    { field: "source", column: "source" },
    { field: "appointmentId", column: "appointment_id" },
  ]),
  serviceAgents: cfg("service_agents", "tenant_id", [
    { field: "name", column: "name" },
    { field: "channel", column: "channel" },
    { field: "objective", column: "objective" },
    { field: "tone", column: "tone" },
    { field: "status", column: "status" },
    { field: "escalationTo", column: "escalation_to" },
    { field: "workingHours", column: "working_hours" },
    { field: "rules", column: "rules", isArray: true },
    { field: "knowledgeBase", column: "knowledge_base", isArray: true },
    { field: "connectionId", column: "connection_id" },
  ]),
  marketingCampaigns: cfg("marketing_campaigns", "tenant_id", [
    { field: "name", column: "name" },
    { field: "audience", column: "audience" },
    { field: "channel", column: "channel" },
    { field: "status", column: "status" },
    { field: "goal", column: "goal" },
    { field: "scheduledDate", column: "scheduled_date" },
    { field: "budget", column: "budget" },
    { field: "leads", column: "leads" },
  ]),
  tissGuides: cfg("tiss_guides", "tenant_id", [
    { field: "patientName", column: "patient_name" },
    { field: "operator", column: "operator" },
    { field: "procedure", column: "procedure" },
    { field: "status", column: "status" },
    { field: "value", column: "value" },
  ]),
  inventoryItems: cfg("inventory_items", "tenant_id", [
    { field: "name", column: "name" },
    { field: "category", column: "category" },
    { field: "quantity", column: "quantity" },
    { field: "minQuantity", column: "min_quantity" },
    { field: "unit", column: "unit" },
    { field: "expiresAt", column: "expires_at" },
    { field: "supplier", column: "supplier" },
  ]),
  referrals: cfg("referral_records", "tenant_id", [
    { field: "patientName", column: "patient_name" },
    { field: "referredName", column: "referred_name" },
    { field: "status", column: "status" },
    { field: "reward", column: "reward" },
  ]),
  helpTickets: cfg("help_tickets", "tenant_id", [
    { field: "title", column: "title" },
    { field: "module", column: "module" },
    { field: "priority", column: "priority" },
    { field: "status", column: "status" },
    { field: "description", column: "description" },
  ]),
  servicePrices: cfg("service_prices", "tenant_id", [
    { field: "name", column: "name" },
    { field: "value", column: "value" },
    { field: "category", column: "category" },
  ]),
  patientDocuments: cfg("patient_documents", "tenant_id", [
    { field: "patientId", column: "patient_id" },
    { field: "name", column: "name" },
    { field: "type", column: "type" },
    { field: "url", column: "url" },
    { field: "uploadedBy", column: "uploaded_by_user_id" },
    { field: "notes", column: "notes" },
    { field: "uploadedAt", column: "uploaded_at" },
  ]),
  waitingList: cfg("waiting_list", "tenant_id", [
    { field: "patientId", column: "patient_id" },
    { field: "patientName", column: "patient_name" },
    { field: "doctorId", column: "doctor_id" },
    { field: "preferredDate", column: "preferred_date" },
    { field: "preferredTime", column: "preferred_time" },
    { field: "procedure", column: "procedure" },
    { field: "status", column: "status" },
    { field: "notifiedAt", column: "notified_at" },
    { field: "notes", column: "notes" },
  ]),
  scheduleBlocks: cfg("schedule_blocks", "tenant_id", [
    { field: "doctorId", column: "doctor_id" },
    { field: "date", column: "date" },
    { field: "startTime", column: "start_time" },
    { field: "endTime", column: "end_time" },
    { field: "type", column: "type" },
    { field: "reason", column: "reason" },
  ]),
  medicalTemplates: cfg("medical_templates", "tenant_id", [
    { field: "name", column: "name" },
    { field: "specialty", column: "specialty" },
    { field: "templateType", column: "template_type" },
    { field: "content", column: "content" },
  ]),
  accountsPayable: cfg("accounts_payable", "tenant_id", [
    { field: "description", column: "description" },
    { field: "value", column: "value" },
    { field: "category", column: "category" },
    { field: "dueDate", column: "due_date" },
    { field: "status", column: "status" },
    { field: "paidAt", column: "paid_at" },
    { field: "recurring", column: "recurring" },
    { field: "recurrenceInterval", column: "recurrence_interval" },
    { field: "supplier", column: "supplier" },
    { field: "notes", column: "notes" },
  ]),
  paymentGatewayConfig: cfg("payment_gateway_configs", "tenant_id", [
    { field: "provider", column: "provider" },
    { field: "enabled", column: "enabled" },
    { field: "apiKey", column: "api_key_encrypted" },
    { field: "webhookSecret", column: "webhook_secret_encrypted" },
    { field: "pixKey", column: "pix_key" },
  ]),
  llmProviderConfigs: cfg("llm_provider_configs", "tenant_id", [
    { field: "name", column: "name" },
    { field: "provider", column: "provider" },
    { field: "model", column: "model" },
    { field: "apiKeyMasked", column: "api_key_masked" },
    { field: "endpoint", column: "endpoint" },
    { field: "temperature", column: "temperature" },
    { field: "maxTokens", column: "max_tokens" },
    { field: "isDefault", column: "is_default" },
    { field: "isActive", column: "is_active" },
  ]),
  referenceMaterials: cfg("reference_materials", "tenant_id", [
    { field: "title", column: "title" },
    { field: "category", column: "category" },
    { field: "url", column: "url" },
    { field: "summary", column: "summary" },
  ]),
  neuralKnowledge: cfg("neural_knowledge", "tenant_id", [
    { field: "title", column: "title" },
    { field: "category", column: "category" },
    { field: "content", column: "content" },
    { field: "sourceType", column: "source_type" },
    { field: "sourceUrl", column: "source_url" },
    { field: "targetAgentIds", column: "target_agent_ids", isArray: true },
    { field: "tags", column: "tags", isArray: true },
    { field: "status", column: "status" },
  ]),
} as const;

// ---------------------------------------------------------------------------
// DataService – wraps JSON file (fallback) / Supabase (primary)
// ---------------------------------------------------------------------------

function shouldSkipJsonPersist(): boolean {
  return isDatabaseAvailable() && process.env.NODE_ENV === "production";
}

export class DataService {
  private get json(): Promise<AppData> {
    invalidateCache();
    return loadData();
  }

  // -- Patients -----------------------------------------------------------

  async getPatients(tenantId?: string): Promise<Patient[]> {
    return pg.findAll<Patient>(TABLES.patients, tenantId);
  }

  async createPatient(data: Patient, user: AppUser, tenantId?: string): Promise<Patient> {
    const created = await pg.create<Patient>(TABLES.patients, data, tenantId);
    if (shouldSkipJsonPersist()) return created;
    const json = await this.json;
    json.patients.push(scoped(data, tenantId));
    iOrE(user, json, "create", "patient", created.id, created.fullName);
    await saveData(json);
    return created;
  }

  async updatePatient(id: string, data: Partial<Patient>, user: AppUser): Promise<Patient | null> {
    const updated = await pg.update<Patient>(TABLES.patients, id, data);
    if (shouldSkipJsonPersist()) return updated;
    const json = await this.json;
    const idx = json.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      json.patients[idx] = { ...json.patients[idx], ...data } as Patient;
      iOrE(user, json, "update", "patient", id, json.patients[idx].fullName);
      await saveData(json);
    }
    return updated;
  }

  async deletePatient(id: string, user: AppUser): Promise<boolean> {
    const ok = await pg.remove(TABLES.patients, id);
    if (shouldSkipJsonPersist()) return ok;
    const json = await this.json;
    const idx = json.patients.findIndex(p => p.id === id);
    if (idx !== -1) {
      const removed = json.patients.splice(idx, 1)[0];
      delete json.medicalRecords[removed.id];
      iOrE(user, json, "delete", "patient", removed.id, removed.fullName);
      await saveData(json);
    }
    return ok;
  }

  // -- Doctors ------------------------------------------------------------

  async getDoctors(tenantId?: string): Promise<Doctor[]> {
    return pg.findAll<Doctor>(TABLES.doctors, tenantId);
  }

  async createDoctor(data: Doctor, tenantId?: string): Promise<Doctor> {
    const created = await pg.create<Doctor>(TABLES.doctors, data, tenantId);
    if (shouldSkipJsonPersist()) return created;
    const json = await this.json;
    json.doctors.push(scoped(data, tenantId));
    await saveData(json);
    return created;
  }

  async updateDoctor(id: string, data: Partial<Doctor>): Promise<Doctor | null> {
    const updated = await pg.update<Doctor>(TABLES.doctors, id, data);
    if (shouldSkipJsonPersist()) return updated;
    const json = await this.json;
    const idx = json.doctors.findIndex(d => d.id === id);
    if (idx !== -1) {
      json.doctors[idx] = { ...json.doctors[idx], ...data } as Doctor;
      await saveData(json);
    }
    return updated;
  }

  async deleteDoctor(id: string): Promise<boolean> {
    const ok = await pg.remove(TABLES.doctors, id);
    if (shouldSkipJsonPersist()) return ok;
    const json = await this.json;
    const idx = json.doctors.findIndex(d => d.id === id);
    if (idx !== -1) {
      json.doctors.splice(idx, 1);
      await saveData(json);
    }
    return ok;
  }

  // -- Appointments -------------------------------------------------------

  async getAppointments(tenantId?: string): Promise<Appointment[]> {
    return pg.findAll<Appointment>(TABLES.appointments, tenantId);
  }

  async createAppointment(data: Appointment, user: AppUser, tenantId?: string): Promise<Appointment> {
    const created = await pg.create<Appointment>(TABLES.appointments, data, tenantId);
    if (shouldSkipJsonPersist()) return created;
    const json = await this.json;
    json.appointments.push(scoped(data, tenantId));
    iOrE(user, json, "create", "appointment", created.id, `${created.patientName} ${created.date} ${created.timeStart}`);
    await saveData(json);
    return created;
  }

  async updateAppointment(id: string, data: Partial<Appointment>, user: AppUser): Promise<Appointment | null> {
    const updated = await pg.update<Appointment>(TABLES.appointments, id, data);
    if (shouldSkipJsonPersist()) return updated;
    const json = await this.json;
    const idx = json.appointments.findIndex(a => a.id === id);
    if (idx !== -1) {
      json.appointments[idx] = { ...json.appointments[idx], ...data } as Appointment;
      await saveData(json);
    }
    return updated;
  }

  async deleteAppointment(id: string, user: AppUser): Promise<boolean> {
    const ok = await pg.remove(TABLES.appointments, id);
    if (shouldSkipJsonPersist()) return ok;
    const json = await this.json;
    const idx = json.appointments.findIndex(a => a.id === id);
    if (idx !== -1) {
      const removed = json.appointments.splice(idx, 1)[0];
      iOrE(user, json, "delete", "appointment", removed.id, `${removed.patientName}`);
      await saveData(json);
    }
    return ok;
  }

  // -- Finance ------------------------------------------------------------

  async getFinanceTransactions(tenantId?: string): Promise<FinanceTransaction[]> {
    return pg.findAll<FinanceTransaction>(TABLES.financeTransactions, tenantId);
  }

  async createFinanceTransaction(data: FinanceTransaction, user: AppUser, tenantId?: string): Promise<FinanceTransaction> {
    const created = await pg.create<FinanceTransaction>(TABLES.financeTransactions, data, tenantId);
    if (shouldSkipJsonPersist()) return created;
    const json = await this.json;
    json.financeTransactions.unshift(scoped(data, tenantId));
    iOrE(user, json, "create", "finance_transaction", created.id, created.description);
    await saveData(json);
    return created;
  }

  async deleteFinanceTransaction(id: string, user: AppUser): Promise<boolean> {
    const ok = await pg.remove(TABLES.financeTransactions, id);
    if (shouldSkipJsonPersist()) return ok;
    const json = await this.json;
    const idx = json.financeTransactions.findIndex(t => t.id === id);
    if (idx !== -1) {
      const removed = json.financeTransactions.splice(idx, 1)[0];
      iOrE(user, json, "delete", "finance_transaction", removed.id, removed.description);
      await saveData(json);
    }
    return ok;
  }

  // -- Medical Records (special – Record type) ----------------------------

  async getMedicalRecords(tenantId?: string): Promise<Record<string, MedicalRecord>> {
    if (isDatabaseAvailable()) {
      const rows = await pg.findAll<MedicalRecord & { patientId: string }>(
        { table: "medical_records", mappings: [
          { field: "patientId", column: "patient_id" },
          { field: "bloodType", column: "blood_type" },
          { field: "gender", column: "gender" },
          { field: "allergies", column: "allergies", isArray: true },
          { field: "medications", column: "medications", isArray: true },
          { field: "chronicDiseases", column: "chronic_diseases", isArray: true },
        ], tenantField: "tenant_id" },
        tenantId
      );
      const recordMap: Record<string, MedicalRecord> = {};
      for (const r of rows) {
        const pid = (r as any).patientId;
        recordMap[pid] = { ...r as any, entries: [] };
      }
      if (Object.keys(recordMap).length > 0) {
        const entries = await pg.findAll<MedicalRecordEntry>(
          { table: "medical_record_entries", mappings: [
            { field: "id", column: "id" },
            { field: "date", column: "entry_date" },
            { field: "doctorName", column: "doctor_name" },
            { field: "notes", column: "notes" },
            { field: "diagnosis", column: "diagnosis" },
            { field: "prescription", column: "prescription" },
            { field: "doctorCrm", column: "doctor_crm" },
          ], tenantField: "tenant_id" },
          tenantId
        );
        for (const entry of entries) {
          for (const pid of Object.keys(recordMap)) {
            recordMap[pid].entries.push(entry);
          }
        }
      }
      return recordMap;
    }
    return (await this.json).medicalRecords;
  }

  // -- Generic CRUD for secondary entities --------------------------------

  async findAll<T>(tableConfig: pg.PgTableConfig, tenantId?: string): Promise<T[]> {
    return pg.findAll<T>(tableConfig, tenantId);
  }

  async createOne<T>(tableConfig: pg.PgTableConfig, data: T, user: AppUser, entityName: string, tenantId?: string): Promise<T> {
    const created = await pg.create<T>(tableConfig, data, tenantId);
    if (shouldSkipJsonPersist()) return created;
    const json = await this.json;
    const collection = (json as any)[entityName as keyof AppData];
    if (Array.isArray(collection)) collection.unshift(scoped(data, tenantId));
    iOrE(user, json, "create", entityName, (created as any).id, (created as any).name || (created as any).title || (created as any).description);
    await saveData(json);
    return created;
  }

  async updateOne<T>(tableConfig: pg.PgTableConfig, id: string, data: Partial<T>, user: AppUser, entityName: string): Promise<T | null> {
    const updated = await pg.update<T>(tableConfig, id, data);
    if (shouldSkipJsonPersist()) return updated;
    const json = await this.json;
    const collection = (json as any)[entityName as keyof AppData];
    if (Array.isArray(collection)) {
      const idx = collection.findIndex((i: any) => i.id === id);
      if (idx !== -1) {
        collection[idx] = { ...collection[idx], ...data };
        await saveData(json);
      }
    }
    return updated;
  }

  async deleteOne(tableConfig: pg.PgTableConfig, id: string, user: AppUser, entityName: string): Promise<boolean> {
    const ok = await pg.remove(tableConfig, id);
    if (shouldSkipJsonPersist()) return ok;
    const json = await this.json;
    const collection = (json as any)[entityName as keyof AppData];
    if (Array.isArray(collection)) {
      const idx = collection.findIndex((i: any) => i.id === id);
      if (idx !== -1) {
        const removed = collection.splice(idx, 1)[0];
        await saveData(json);
      }
    }
    return ok;
  }
}

export const dataService = new DataService();
export { TABLES };
