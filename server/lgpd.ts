import { randomUUID } from "crypto";
import { loadData, saveData, AppData } from "./data";
import { audit } from "./helpers";
import { AppUser } from "../src/types";
import { isDatabaseAvailable } from "./database";

export interface LgpdConsent {
  id: string;
  tenantId: string;
  patientId: string;
  consentType: "treatment" | "marketing" | "image" | "data_sharing";
  granted: boolean;
  grantedAt: string | null;
  revokedAt: string | null;
  ipAddress: string;
  userAgent: string;
  createdAt: string;
}

export interface LgpdConsentRecord {
  patientId: string;
  treatment: boolean;
  marketing: boolean;
  image: boolean;
  dataSharing: boolean;
  consentDate: string;
}

export async function registerConsent(
  patientId: string,
  consentType: LgpdConsent["consentType"],
  granted: boolean,
  user: AppUser,
  ipAddress = "",
  userAgent = ""
): Promise<void> {
  if (isDatabaseAvailable()) {
    try {
      const { query } = await import("./database");
      const now = new Date().toISOString();
      if (granted) {
        await query(
          `INSERT INTO lgpd_patient_consents (id, tenant_id, patient_id, consent_type, granted, granted_at, ip_address, user_agent, created_at, updated_at)
           VALUES ($1, $2, $3, $4, TRUE, $5, $6::inet, $7, $5, $5)
           ON CONFLICT (tenant_id, patient_id, consent_type)
           DO UPDATE SET granted = TRUE, granted_at = $5, revoked_at = NULL, ip_address = $6::inet, user_agent = $7, updated_at = $5`,
          [randomUUID(), user.tenantId || "single-tenant", patientId, consentType, now, ipAddress || null, userAgent || null]
        );
      } else {
        await query(
          `INSERT INTO lgpd_patient_consents (id, tenant_id, patient_id, consent_type, granted, revoked_at, created_at, updated_at)
           VALUES ($1, $2, $3, $4, FALSE, $5, $5, $5)
           ON CONFLICT (tenant_id, patient_id, consent_type)
           DO UPDATE SET granted = FALSE, revoked_at = $5, updated_at = $5`,
          [randomUUID(), user.tenantId || "single-tenant", patientId, consentType, new Date().toISOString()]
        );
      }
    } catch (err) {
      console.warn("[LGPD] PG write failed:", (err as Error).message);
    }
  }

  const data = await loadData();
  audit(data, user, granted ? "lgpd_consent_granted" : "lgpd_consent_revoked", "lgpd_consent", patientId, `${consentType}:${granted}`);
  data.auditEvents.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    action: `lgpd:${consentType}`,
    entity: "lgpd_consent",
    entityId: patientId,
    details: JSON.stringify({ granted, ipAddress, userAgent })
  });
  await saveData(data);
}

export function getPatientConsents(data: AppData, patientId: string): LgpdConsentRecord {
  const consents = data.auditEvents.filter(e => e.entity === "lgpd_consent" && e.entityId === patientId);
  const treatment = consents.find(e => e.action === "lgpd:treatment");
  const marketing = consents.find(e => e.action === "lgpd:marketing");
  const image = consents.find(e => e.action === "lgpd:image");
  const dataSharing = consents.find(e => e.action === "lgpd:data_sharing");

  return {
    patientId,
    treatment: treatment ? JSON.parse(treatment.details || "{}").granted === true : false,
    marketing: marketing ? JSON.parse(marketing.details || "{}").granted === true : false,
    image: image ? JSON.parse(image.details || "{}").granted === true : false,
    dataSharing: dataSharing ? JSON.parse(dataSharing.details || "{}").granted === true : false,
    consentDate: treatment?.createdAt || ""
  };
}

export function getPatientsWithoutConsent(data: AppData): string[] {
  const consentedIds = new Set(
    data.auditEvents
      .filter(e => e.entity === "lgpd_consent" && e.action.startsWith("lgpd:"))
      .map(e => e.entityId)
  );
  return data.patients
    .filter(p => !consentedIds.has(p.id))
    .map(p => p.id);
}

export async function logMedicalRecordAccess(
  patientId: string,
  user: AppUser,
  action: "view" | "edit" | "export",
  ipAddress = ""
): Promise<void> {
  if (isDatabaseAvailable()) {
    try {
      const { query } = await import("./database");
      await query(
        `INSERT INTO lgpd_sensitive_access_logs (id, tenant_id, patient_id, accessed_by_user_id, access_type, ip_address, created_at)
         VALUES ($1, $2, $3, $4, $5, $6::inet, NOW())`,
        [randomUUID(), user.tenantId || "single-tenant", patientId, user.id, action, ipAddress || null]
      );
    } catch (err) {
      console.warn("[LGPD] Sensitive access log PG write failed:", (err as Error).message);
    }
  }

  const data = await loadData();
  audit(data, user, `medical_record_${action}`, "medical_record_access", patientId, `Acesso ao prontuário`);
  await saveData(data);
}

export async function getConsentedPatientIds(tenantId?: string): Promise<string[]> {
  const data = await loadData();
  const consentedIds = new Set<string>();
  for (const event of data.auditEvents) {
    if (event.entity === "lgpd_consent" && event.action.startsWith("lgpd:")) {
      const details = JSON.parse(event.details || "{}");
      if (details.granted === true) {
        consentedIds.add(event.entityId);
      }
    }
  }
  return Array.from(consentedIds);
}
