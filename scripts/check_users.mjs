import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgresql://postgres.fmhmmayrlsgdmxabosou:XJfbFSNB2rXf73TO@aws-1-sa-east-1.pooler.supabase.com:6543/postgres' });

try {
    const authUsers = await pool.query("SELECT id, email, raw_user_meta_data, created_at, confirmed_at, last_sign_in_at FROM auth.users ORDER BY created_at");
    console.log('### AUTH.USERS ###');
    console.log(JSON.stringify(authUsers.rows, null, 2));

    const pubUsers = await pool.query('SELECT id, email, name, role, is_active FROM public.users');
    console.log('### PUBLIC.USERS ###');
    console.log(JSON.stringify(pubUsers.rows, null, 2));

    // Check for any other user-like tables
    const tables = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'auth') AND table_name LIKE '%user%' ORDER BY table_schema, table_name");
    console.log('### USER TABLES ###');
    console.log(JSON.stringify(tables.rows, null, 2));
} catch(e) { console.log('Error:', e.message); }
await pool.end();
