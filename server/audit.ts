import { isDatabaseAvailable, query } from "./database";
import { loadData, saveData, AppData } from "./data";
import { AppUser } from "../src/types";
import { randomUUID } from "crypto";
import { nowIso } from "./helpers";

export interface AuditEntry {
  id: string;
  createdAt: string;
  actorId: string;
  actorName: string;
  action: string;
  entity: string;
  entityId: string;
  details?: string;
}

export async function audit(data: AppData, user: AppUser, action: string, entity: string, entityId: string, details?: string) {
  const entry: AuditEntry = {
    id: randomUUID(),
    createdAt: nowIso(),
    actorId: user.id,
    actorName: user.name,
    action,
    entity,
    entityId,
    details
  };

  // Always write to JSON (fallback)
  data.auditEvents.push(entry);

  // Also write to Supabase when available
  if (isDatabaseAvailable()) {
    try {
      await query(
        `INSERT INTO audit_events (id, tenant_id, actor_id, actor_name, action, entity, entity_id, details, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())`,
        [entry.id, user.tenantId || null, user.id, user.name, action, entity, entityId, details || null]
      );
    } catch (err) {
      console.warn("[Audit] Supabase write failed:", (err as Error).message);
    }
  }

  // Persist JSON
  await saveData(data);

  return entry;
}

export async function getAuditEvents(tenantId?: string, limit = 500): Promise<AuditEntry[]> {
  if (isDatabaseAvailable()) {
    try {
      if (tenantId) {
        return await query<AuditEntry>(
          "SELECT id, created_at as \"createdAt\", actor_id as \"actorId\", actor_name as \"actorName\", action, entity, entity_id as \"entityId\", details FROM audit_events WHERE tenant_id = $1 ORDER BY created_at DESC LIMIT $2",
          [tenantId, limit]
        );
      }
      return await query<AuditEntry>(
        "SELECT id, created_at as \"createdAt\", actor_id as \"actorId\", actor_name as \"actorName\", action, entity, entity_id as \"entityId\", details FROM audit_events ORDER BY created_at DESC LIMIT $1",
        [limit]
      );
    } catch {
      // fall through to JSON
    }
  }

  const data = await loadData();
  return data.auditEvents.slice(-limit).reverse();
}
