const { Pool } = require('pg');
const path = require('path');
// Use project's pg module
const pool = new Pool({ connectionString: 'postgresql://postgres.fmhmmayrlsgdmxabosou:XJfbFSNB2rXf73TO@aws-1-sa-east-1.pooler.supabase.com:6543/postgres' });

(async () => {
    try {
        const tables = await pool.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_schema IN ('public', 'auth') AND table_name LIKE '%user%' ORDER BY table_schema, table_name");
        console.log('User-related tables:', JSON.stringify(tables.rows, null, 2));

        const authUsers = await pool.query('SELECT id, email, raw_user_meta_data, created_at, confirmed_at, last_sign_in_at FROM auth.users ORDER BY created_at');
        console.log('Auth users:', JSON.stringify(authUsers.rows, null, 2));

        const pubUsers = await pool.query('SELECT * FROM public.users');
        console.log('Public users:', JSON.stringify(pubUsers.rows, null, 2));
    } catch(e) { console.log('Error:', e.message); }
    pool.end();
})();
