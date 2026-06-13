import { Pool, QueryResult } from "pg";

const DATABASE_URL = process.env.DATABASE_URL || "";

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: DATABASE_URL });
  }
  return pool;
}

export function isDatabaseAvailable(): boolean {
  return Boolean(DATABASE_URL);
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

export async function runMigrations(): Promise<void> {
  if (!isDatabaseAvailable()) return;

  const client = await getPool().connect();
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS _migrations (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        executed_at TIMESTAMPTZ DEFAULT NOW()
      );
    `);

    const migrationFiles = [
      { name: "001_initial_schema", sql: `
        CREATE TABLE IF NOT EXISTS tenants (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          slug TEXT UNIQUE NOT NULL,
          legal_name TEXT NOT NULL,
          trade_name TEXT NOT NULL,
          document TEXT,
          owner_email TEXT,
          phone TEXT,
          status TEXT DEFAULT 'active',
          timezone TEXT DEFAULT 'America/Sao_Paulo',
          locale TEXT DEFAULT 'pt-BR',
          settings JSONB DEFAULT '{}',
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
          available_days TEXT[] DEFAULT '{}',
          working_hours JSONB DEFAULT '{"start": "08:00", "end": "18:00"}',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

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
      `}
    ];

    for (const migration of migrationFiles) {
      const exists = await client.query("SELECT id FROM _migrations WHERE name = $1", [migration.name]);
      if (exists.rows.length === 0) {
        await client.query(migration.sql);
        await client.query("INSERT INTO _migrations (name) VALUES ($1)", [migration.name]);
        console.log(`Migration ${migration.name} executed successfully.`);
      }
    }

    console.log("Database migrations completed.");
  } catch (error) {
    console.error("Migration error:", error);
    throw error;
  } finally {
    client.release();
  }
}
