import { Pool, QueryResult } from "pg";
import bcrypt from "bcryptjs";
import fs from "fs";
import path from "path";
import { seedUsers } from "./seed";

const DATABASE_URL = process.env.DATABASE_URL || "";

let pool: Pool | null = null;

const CORE_SCHEMA_SQL = `
  CREATE EXTENSION IF NOT EXISTS pgcrypto;

  CREATE TABLE IF NOT EXISTS tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT UNIQUE NOT NULL,
    legal_name TEXT NOT NULL,
    trade_name TEXT NOT NULL,
    document TEXT,
    owner_email TEXT,
    phone TEXT,
    status TEXT DEFAULT 'active',
    plan_id TEXT,
    timezone TEXT DEFAULT 'America/Sao_Paulo',
    locale TEXT DEFAULT 'pt-BR',
    settings JSONB DEFAULT '{}',
    trial_ends_at TIMESTAMPTZ,
    suspended_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES tenants(id),
    email TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'reception',
    specialty TEXT,
    mfa_secret TEXT,
    mfa_enabled BOOLEAN DEFAULT FALSE,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS document TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS owner_email TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS phone TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS plan_id TEXT;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS timezone TEXT DEFAULT 'America/Sao_Paulo';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS locale TEXT DEFAULT 'pt-BR';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS trial_ends_at TIMESTAMPTZ;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS suspended_at TIMESTAMPTZ;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

  ALTER TABLE users ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES tenants(id);
  ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'reception';
  ALTER TABLE users ADD COLUMN IF NOT EXISTS specialty TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_secret TEXT;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS mfa_enabled BOOLEAN DEFAULT FALSE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
  ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
  ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
`;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export function isDatabaseAvailable(): boolean {
  return /^postgres(ql)?:\/\//i.test(DATABASE_URL);
}

export function getSupabaseRestUrl(): string {
  const configured = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "";
  const fromDatabaseUrl = /^https?:\/\//i.test(DATABASE_URL) ? DATABASE_URL : "";
  const url = configured || fromDatabaseUrl;
  return url.replace(/\/rest\/v1\/?$/i, "").replace(/\/$/, "");
}

export function getSupabaseServiceKey(): string {
  return process.env.SUPABASE_SERVICE_ROLE_KEY
    || process.env.SUPABASE_SERVICE_ROLE
    || process.env.SUPABASE_SERVICE_KEY
    || process.env.SUPABASE_KEY
    || "";
}

export function isSupabaseRestAvailable(): boolean {
  return Boolean(getSupabaseRestUrl() && getSupabaseServiceKey());
}

async function supabaseRestRequest<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = getSupabaseRestUrl();
  const key = getSupabaseServiceKey();
  if (!url || !key) throw new Error("Supabase REST URL/service role key not configured.");
  const headers = new Headers(init.headers);
  headers.set("apikey", key);
  headers.set("Authorization", `Bearer ${key}`);
  if (!headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const response = await fetch(`${url}/rest/v1/${path.replace(/^\/+/, "")}`, { ...init, headers });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    const message = data?.message || data?.hint || text || `Supabase REST error ${response.status}`;
    throw new Error(message);
  }
  return data as T;
}

export async function supabaseRestFindOne<T>(table: string, queryString: string): Promise<T | null> {
  const rows = await supabaseRestRequest<T[]>(`${table}?${queryString}&limit=1`);
  return rows[0] || null;
}

export async function supabaseRestInsert<T>(table: string, row: Record<string, unknown>): Promise<T> {
  const rows = await supabaseRestRequest<T[]>(table, {
    method: "POST",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
  return rows[0] as T;
}

export async function supabaseRestUpdate<T>(table: string, filter: string, row: Record<string, unknown>): Promise<T | null> {
  const rows = await supabaseRestRequest<T[]>(`${table}?${filter}`, {
    method: "PATCH",
    headers: { Prefer: "return=representation" },
    body: JSON.stringify(row)
  });
  return rows[0] || null;
}

export async function supabaseRestDelete(table: string, filter: string): Promise<boolean> {
  await supabaseRestRequest(`${table}?${filter}`, {
    method: "DELETE",
    headers: { Prefer: "return=minimal" }
  });
  return true;
}

export async function query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]> {
  if (!isDatabaseAvailable()) {
    throw new Error("Database not configured. Set DATABASE_URL environment variable.");
  }
  const result: QueryResult<T> = await getPool().query(text, params);
  return result.rows;
}

export async function queryOne<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] || null;
}

export async function endPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

export async function ensureCoreAuthSchema(): Promise<void> {
  if (!isDatabaseAvailable()) return;
  await getPool().query(CORE_SCHEMA_SQL);
}

function readMigrationFile(filename: string): string {
  try {
    const filePath = path.join(process.cwd(), "server", "migrations", filename);
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    const fallbackPath = path.join(__dirname, "migrations", filename);
    try {
      return fs.readFileSync(fallbackPath, "utf-8");
    } catch {
      console.warn(`Migration file ${filename} not found, skipping.`);
      return "";
    }
  }
}

export async function runMigrations(): Promise<void> {
  if (!isDatabaseAvailable()) return;

  const client = await getPool().connect();
  try {
    await client.query(CORE_SCHEMA_SQL);

    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationFiles = [
      { name: "001_initial_schema", sql: `
        ${CORE_SCHEMA_SQL}

        CREATE TABLE IF NOT EXISTS patients (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          full_name TEXT NOT NULL,
          birth_date DATE NOT NULL,
          cpf TEXT NOT NULL,
          phone TEXT DEFAULT '',
          email TEXT DEFAULT '',
          avatar_url TEXT,
          address JSONB DEFAULT '{}',
          lgpd_consent BOOLEAN DEFAULT FALSE,
          lgpd_consent_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS doctors (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          name TEXT NOT NULL,
          specialty TEXT NOT NULL,
          crm TEXT,
          email TEXT,
          phone TEXT,
          user_id UUID REFERENCES users(id),
          available_days TEXT[] DEFAULT '{}',
          working_hours JSONB DEFAULT '{"start": "08:00", "end": "18:00"}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        ALTER TABLE doctors ADD COLUMN IF NOT EXISTS crm TEXT;
        ALTER TABLE doctors ADD COLUMN IF NOT EXISTS email TEXT;
        ALTER TABLE doctors ADD COLUMN IF NOT EXISTS phone TEXT;
        ALTER TABLE doctors ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id);

        CREATE TABLE IF NOT EXISTS appointments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          doctor_id UUID REFERENCES doctors(id),
          patient_id UUID REFERENCES patients(id),
          date DATE NOT NULL,
          time_start TIME NOT NULL,
          time_end TIME NOT NULL,
          patient_name TEXT NOT NULL,
          status TEXT DEFAULT 'agendado',
          type TEXT DEFAULT 'Consulta Particular',
          is_private BOOLEAN DEFAULT FALSE,
          observations TEXT DEFAULT '',
          arrival TEXT DEFAULT 'N/A',
          record_status TEXT DEFAULT 'pendente',
          payment_status TEXT DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS medical_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          patient_id UUID REFERENCES patients(id),
          blood_type TEXT DEFAULT 'Desconhecido',
          gender TEXT DEFAULT 'Nao informado',
          allergies TEXT[] DEFAULT '{}',
          medications TEXT[] DEFAULT '{}',
          chronic_diseases TEXT[] DEFAULT '{}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS medical_record_entries (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          medical_record_id UUID REFERENCES medical_records(id),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          date DATE NOT NULL,
          doctor_name TEXT NOT NULL,
          notes TEXT NOT NULL,
          diagnosis TEXT,
          prescription TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS finance_transactions (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID NOT NULL REFERENCES tenants(id),
          appointment_id UUID REFERENCES appointments(id),
          description TEXT NOT NULL,
          value NUMERIC(12,2) NOT NULL,
          category TEXT DEFAULT 'Extra',
          type TEXT NOT NULL,
          status TEXT DEFAULT 'concluido',
          source TEXT DEFAULT 'manual',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS audit_events (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          actor_id TEXT NOT NULL,
          actor_name TEXT NOT NULL,
          action TEXT NOT NULL,
          entity TEXT NOT NULL,
          entity_id TEXT NOT NULL,
          details TEXT,
          ip_address TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `},
      { name: "002_operational_ai_tables", sql: `
        CREATE TABLE IF NOT EXISTS service_agents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          name TEXT NOT NULL,
          channel TEXT NOT NULL DEFAULT 'whatsapp',
          objective TEXT NOT NULL DEFAULT '',
          tone TEXT NOT NULL DEFAULT 'profissional',
          status TEXT NOT NULL DEFAULT 'draft',
          escalation_to TEXT,
          working_hours TEXT,
          rules TEXT[] DEFAULT '{}',
          knowledge_base TEXT[] DEFAULT '{}',
          connection_id TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS llm_provider_configs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          name TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          api_key_masked TEXT,
          endpoint TEXT,
          temperature NUMERIC DEFAULT 0.35,
          max_tokens INTEGER DEFAULT 1200,
          is_default BOOLEAN DEFAULT FALSE,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS neural_knowledge (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          title TEXT NOT NULL,
          category TEXT,
          content TEXT NOT NULL DEFAULT '',
          source_type TEXT,
          source_url TEXT,
          target_agent_ids TEXT[] DEFAULT '{}',
          tags TEXT[] DEFAULT '{}',
          status TEXT DEFAULT 'active',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS marketing_campaigns (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          name TEXT NOT NULL,
          audience TEXT,
          channel TEXT,
          status TEXT DEFAULT 'draft',
          goal TEXT,
          scheduled_date TEXT,
          budget NUMERIC DEFAULT 0,
          leads INTEGER DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS tiss_guides (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          patient_name TEXT NOT NULL,
          operator TEXT,
          procedure TEXT,
          status TEXT DEFAULT 'draft',
          value NUMERIC DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS inventory_items (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          name TEXT NOT NULL,
          category TEXT,
          quantity INTEGER DEFAULT 0,
          min_quantity INTEGER DEFAULT 0,
          unit TEXT,
          expires_at TEXT,
          supplier TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS referral_records (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          patient_name TEXT NOT NULL,
          referred_name TEXT,
          status TEXT DEFAULT 'pending',
          reward TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS reference_materials (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          title TEXT NOT NULL,
          category TEXT,
          url TEXT,
          summary TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS help_tickets (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          tenant_id UUID REFERENCES tenants(id),
          title TEXT NOT NULL,
          module TEXT,
          priority TEXT DEFAULT 'normal',
          status TEXT DEFAULT 'open',
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `},
      { name: "003_complete_360", sql: readMigrationFile("003_complete_360.sql") },
      { name: "004_rls_policies", sql: readMigrationFile("0004_rls_policies.sql") },
      { name: "005_tiss_expansion", sql: readMigrationFile("005_tiss_expansion.sql") }
    ];

    for (const migration of migrationFiles) {
      const exists = await client.query("SELECT id FROM _migrations WHERE name = $1", [migration.name]);
      if (exists.rows.length === 0) {
        if (!migration.sql.trim()) {
          console.warn(`Migration ${migration.name} has no SQL content, skipping.`);
          continue;
        }
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query("INSERT INTO _migrations (name) VALUES ($1)", [migration.name]);
          await client.query("COMMIT");
          console.log(`Migration ${migration.name} executed successfully.`);
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(`Migration ${migration.name} failed and was rolled back.`, err instanceof Error ? err.message : err);
          throw err;
        }
      }
    }

    console.log("Database migrations completed.");
  } catch (error) {
    console.error("Migration error:", error instanceof Error ? error.message : error);
    throw error;
  } finally {
    client.release();
  }
}

export async function runSeed(): Promise<void> {
  if (!isDatabaseAvailable()) return;

  const client = await getPool().connect();
  try {
    const tenantRes = await client.query("SELECT id FROM tenants LIMIT 1");
    let tenantId = tenantRes.rows[0]?.id;
    if (!tenantId) {
      const res = await client.query("INSERT INTO tenants (slug, legal_name, trade_name) VALUES ('default', 'Consultio Med', 'Consultio Med') RETURNING id");
      tenantId = res.rows[0].id;
    }

    for (const user of seedUsers) {
      if (!user.email) continue;
      const exists = await client.query("SELECT id FROM users WHERE email = $1", [user.email]);
      if (exists.rows.length === 0) {
        await client.query(
          "INSERT INTO users (tenant_id, email, name, password_hash, role, specialty, is_active) VALUES ($1, $2, $3, $4, $5, $6, $7)",
          [tenantId, user.email, user.name, user.passwordHash, user.role, user.specialty || null, user.isActive]
        );
      }
    }

    const ownerEmail = process.env.PLATFORM_OWNER_EMAIL?.trim().toLowerCase();
    const ownerPassword = process.env.PLATFORM_OWNER_PASSWORD;
    if (ownerEmail && ownerPassword) {
      const ownerHash = bcrypt.hashSync(ownerPassword, 10);
      const exists = await client.query("SELECT id FROM users WHERE LOWER(email) = LOWER($1)", [ownerEmail]);
      if (exists.rows.length > 0) {
        await client.query(
          `UPDATE users
           SET tenant_id = NULL,
               name = COALESCE(NULLIF(name, ''), 'Super Admin'),
               password_hash = $1,
               role = 'super_admin',
               is_active = TRUE,
               updated_at = NOW()
           WHERE id = $2`,
          [ownerHash, exists.rows[0].id]
        );
      } else {
        await client.query(
          `INSERT INTO users (tenant_id, email, name, password_hash, role, specialty, is_active)
           VALUES (NULL, $1, 'Super Admin', $2, 'super_admin', NULL, TRUE)`,
          [ownerEmail, ownerHash]
        );
      }
      console.log(`Platform owner ensured.`);
    }
    console.log("Database seeded with default users.");
  } catch (error) {
    console.error("Seed error:", error);
  } finally {
    client.release();
  }
}
