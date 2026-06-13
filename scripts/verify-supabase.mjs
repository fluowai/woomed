import pg from 'pg';
import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

try {
  // Check RLS
  const rls = await pool.query(`
    SELECT relname, relrowsecurity 
    FROM pg_class 
    WHERE relrowsecurity = true 
      AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND relkind = 'r'
    ORDER BY relname
  `);
  console.log('Tables with RLS:', rls.rows.length);
  
  // Check enums
  const enums = await pool.query(`
    SELECT t.typname, e.enumlabel
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN pg_catalog.pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
    ORDER BY t.typname, e.enumsortorder
  `);
  const enumGroups = {};
  for (const row of enums.rows) {
    if (!enumGroups[row.typname]) enumGroups[row.typname] = [];
    enumGroups[row.typname].push(row.enumlabel);
  }
  console.log('\nEnums:');
  for (const [name, labels] of Object.entries(enumGroups)) {
    console.log(`  ${name}: ${labels.join(', ')}`);
  }

  // Check triggers count
  const triggers = await pool.query(`
    SELECT count(*) FROM information_schema.triggers 
    WHERE trigger_schema = 'public'
  `);
  console.log('\nTriggers:', triggers.rows[0].count);

  // Check policies count
  const policies = await pool.query(`
    SELECT count(*) FROM pg_policies 
    WHERE schemaname = 'public'
  `);
  console.log('Policies:', policies.rows[0].count);

  // Check seed data
  const plans = await pool.query("SELECT code, name, price_cents FROM plans ORDER BY sort_order");
  console.log('\nPlans seeded:', plans.rows.length);
  for (const p of plans.rows) {
    console.log(`  ${p.code}: ${p.name} - R$ ${(p.price_cents / 100).toFixed(2)}`);
  }

  const invites = await pool.query("SELECT email, role FROM platform_owner_invites");
  console.log('\nPlatform owner invites:', invites.rows.length);
  for (const i of invites.rows) {
    console.log(`  ${i.email} as ${i.role}`);
  }

  const templates = await pool.query("SELECT count(*) FROM agent_templates");
  console.log('\nAgent templates:', templates.rows[0].count);

  const llmConfigs = await pool.query("SELECT count(*) FROM llm_provider_configs");
  console.log('LLM configs:', llmConfigs.rows[0].count);

  // Verify key functions exist
  const functions = await pool.query(`
    SELECT proname FROM pg_proc 
    WHERE pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'private')
      OR (pronamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public') 
          AND proname IN ('accept_platform_owner_invite', 'accept_tenant_invite'))
    ORDER BY proname
  `);
  console.log('\nFunctions:', functions.rows.map(f => f.proname).join(', '));

  console.log('\n✓ Supabase verification complete!');
} catch (err) {
  console.error('Error:', err.message);
}
await pool.end();
