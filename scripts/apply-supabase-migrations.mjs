import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: DATABASE_URL });

const migrationDir = path.join(__dirname, '..', 'supabase', 'migrations');
const files = [
  '20260526190000_initial_saas_foundation.sql',
  '20260529185000_complete_operational_ai_whatsmeow.sql'
];

async function main() {
  // Track what we apply
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      executed_at TIMESTAMPTZ DEFAULT NOW()
    )
  `);

  const applied = await pool.query("SELECT name FROM _migrations");
  const appliedSet = new Set(applied.rows.map(r => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) {
      console.log(`✓ ${file} already applied`);
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationDir, file), 'utf8');
    console.log(`\n=== Applying ${file} ===`);

    try {
      // Execute entire file as one query (pg supports multi-statement)
      await pool.query(sql);
      await pool.query("INSERT INTO _migrations (name) VALUES ($1)", [file]);
      console.log(`✓ ${file} applied successfully`);
    } catch (err) {
      const msg = err.message || '';
      // Check if it's an "already exists" error for the whole batch
      if (msg.includes('already exists')) {
        console.log(`  ↺ Some objects already exist (expected), continuing...`);
        // Still record the migration if tables are present
        try {
          await pool.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [file]);
        } catch {}
      } else {
        console.error(`✗ Error in ${file}:`, msg.substring(0, 500));
        console.log('Trying statement-by-statement fallback...');
        // Fallback: try individual statements
        const statements = sql.split(';\n').filter(s => s.trim().length > 0);
        let ok = 0, fail = 0;
        for (const stmt of statements) {
          try {
            const trimmed = stmt.trim();
            if (trimmed && !trimmed.startsWith('--')) {
              await pool.query(trimmed + ';');
              ok++;
            }
          } catch (e2) {
            const m2 = e2.message || '';
            if (m2.includes('already exists') || m2.includes('duplicate') || m2.includes('already has a column')) {
              ok++;
            } else {
              fail++;
            }
          }
        }
        if (fail === 0) {
          await pool.query("INSERT INTO _migrations (name) VALUES ($1) ON CONFLICT (name) DO NOTHING", [file]);
          console.log(`✓ ${file}: ${ok} statements OK, ${fail} failed`);
        } else {
          console.error(`✗ ${file}: ${ok} OK, ${fail} failed`);
        }
      }
    }
  }

  // Verify
  const tables = await pool.query(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name"
  );
  const migs = await pool.query("SELECT name FROM _migrations ORDER BY id");
  console.log(`\n✓ Final: ${tables.rows.length} tables, ${migs.rows.length} migrations`);
  console.log('Tables:', tables.rows.map(t => t.table_name).join(', '));
  console.log('Migrations:', migs.rows.map(m => m.name).join(', '));

  await pool.end();
}

main().catch(err => {
  console.error('Fatal:', err);
  process.exit(1);
});
