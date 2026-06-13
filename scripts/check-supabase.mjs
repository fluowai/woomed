import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});
try {
  const r = await pool.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE' ORDER BY table_name");
  console.log('Tables found (' + r.rows.length + '):', r.rows.map(t => t.table_name).join(', '));
  try {
    const m = await pool.query("SELECT name FROM _migrations ORDER BY id");
    console.log('Migrations applied:', m.rows.map(t => t.name).join(', '));
  } catch(e) {
    console.log('No _migrations table found (migrations not applied yet)');
  }
} catch(e) {
  console.error('Error:', e.message);
}
await pool.end();
