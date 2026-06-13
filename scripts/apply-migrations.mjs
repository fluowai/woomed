import fs from "fs";
import pg from "pg";

const { Pool } = pg;

function splitSQL(sql) {
  const stmts = [];
  let current = "";
  let inDollar = false;
  let dollarTag = "";
  let inString = false;
  let stringChar = "";
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (inDollar) {
      current += ch;
      if (ch === "$") {
        const end = sql.indexOf("$", i + 1);
        const tag = sql.substring(i + 1, end);
        if (tag === dollarTag) {
          current += "$";
          i = end;
          inDollar = false;
        }
      }
    } else if (inString) {
      current += ch;
      if (ch === stringChar && sql[i - 1] !== "\\") inString = false;
    } else if ((ch === "'" || ch === '"') && !inString) {
      inString = true;
      stringChar = ch;
      current += ch;
    } else if (ch === "$" && sql[i + 1] === "$") {
      inDollar = true;
      dollarTag = "";
      current += "$$";
      i++;
    } else if (ch === ";") {
      const trimmed = current.trim();
      if (trimmed) stmts.push(trimmed);
      current = "";
    } else {
      current += ch;
    }
  }
  const trimmed = current.trim();
  if (trimmed) stmts.push(trimmed);
  return stmts;
}

async function run() {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 1,
  });

  const files = [
    "supabase/migrations/20260526190000_initial_saas_foundation.sql",
    "supabase/migrations/20260529185000_complete_operational_ai_whatsmeow.sql",
  ];

  let totalOk = 0;
  let totalFail = 0;

  for (const file of files) {
    console.log(`\n=== Applying ${file} ===`);
    const sql = fs.readFileSync(file, "utf8");
    const stmts = splitSQL(sql);
    console.log(`  ${stmts.length} statements`);

    let ok = 0;
    let fail = 0;
    for (const stmt of stmts) {
      if (stmt.length < 5) continue;
      try {
        await pool.query(stmt);
        ok++;
      } catch (e) {
        const msg = e.message;
        if (msg.includes("already exists") || msg.includes("duplicate_key") || msg.includes("duplicate_object") || msg.includes("already has a policy")) {
          ok++;
          continue;
        }
        fail++;
        console.log(`  FAIL: ${msg.substring(0, 120)}`);
      }
    }
    console.log(`  ${ok} OK, ${fail} failed`);
    totalOk += ok;
    totalFail += fail;
  }

  await pool.end();
  console.log(`\nTotal: ${totalOk} OK, ${totalFail} failed`);
  process.exit(totalFail > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
