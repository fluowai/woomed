import { randomUUID } from "crypto";
import { loadData, saveData, AppData } from "./data";
import { audit } from "./helpers";
import { AppUser } from "../src/types";

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

// Store LGPD consents in audit events with special prefix
const LGPD_PREFIX = "lgpd:";

export async function registerConsent(
  patientId: string,
  consentType: LgpdConsent["consentType"],
  granted: boolean,
  user: AppUser,
  ipAddress = "",
  userAgent = ""
): Promise<void> {
  const data = await loadData();
  const consent: LgpdConsent = {
    id: randomUUID(),
    tenantId: "single-tenant",
    patientId,
    consentType,
    granted,
    grantedAt: granted ? new Date().toISOString() : null,
    revokedAt: granted ? null : new Date().toISOString(),
    ipAddress,
    userAgent,
    createdAt: new Date().toISOString()
  };
  audit(data, user, granted ? "lgpd_consent_granted" : "lgpd_consent_revoked", "lgpd_consent", patientId, `${consentType}:${granted}`);
  data.auditEvents.push({
    id: randomUUID(),
    createdAt: new Date().toISOString(),
    actorId: user.id,
    actorName: user.name,
    action: `${LGPD_PREFIX}${consentType}`,
    entity: "lgpd_consent",
    entityId: patientId,
    details: JSON.stringify({ granted, ipAddress, userAgent })
  });
  await saveData(data);
}

export function getPatientConsents(data: AppData, patientId: string): LgpdConsentRecord {
  const consents = data.auditEvents.filter(e => e.entity === "lgpd_consent" && e.entityId === patientId);
  const treatment = consents.find(e => e.action === `${LGPD_PREFIX}treatment`);
  const marketing = consents.find(e => e.action === `${LGPD_PREFIX}marketing`);
  const image = consents.find(e => e.action === `${LGPD_PREFIX}image`);
  const dataSharing = consents.find(e => e.action === `${LGPD_PREFIX}data_sharing`);

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
      .filter(e => e.entity === "lgpd_consent" && e.action.startsWith(LGPD_PREFIX))
      .map(e => e.entityId)
  );
  return data.patients
    .filter(p => !consentedIds.has(p.id))
    .map(p => p.id);
}

export function logMedicalRecordAccess(
  patientId: string,
  user: AppUser,
  action: "view" | "edit" | "export",
  ipAddress = ""
): void {
  audit(
    { auditEvents: [] } as AppData,
    user,
    `medical_record_${action}`,
    "medical_record_access",
    patientId,
    `Acesso ao prontuário do paciente ${patientId}`
  );

  // Actually load and save for persistence
  loadData().then(data => {
    audit(data, user, `medical_record_${action}`, "medical_record_access", patientId, `Acesso ao prontuário`);
    saveData(data);
  });
}
