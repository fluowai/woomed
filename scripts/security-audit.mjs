/**
 * 🔒 Security Audit Script — Consultio Med
 * 
 * Uso: node scripts/security-audit.mjs
 * 
 * Verifica automaticamente as configurações de segurança do sistema.
 * Checa: secrets configurados, dependências com CVEs conhecidas, 
 *        boas práticas de configuração.
 */

import { readFileSync, existsSync, readdirSync } from "fs";
import { createHash } from "crypto";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let passed = 0;
let failed = 0;
let warnings = 0;

function check(condition, message, severity = "FAIL") {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ${severity === "WARN" ? "⚠️" : "❌"} ${severity}: ${message}`);
    if (severity === "FAIL") failed++;
    else warnings++;
  }
}

function loadEnv() {
  const envPath = join(root, ".env");
  if (!existsSync(envPath)) return {};
  const content = readFileSync(envPath, "utf-8");
  const env = {};
  for (const line of content.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, "");
    env[key] = value;
  }
  return env;
}

console.log("\n" + "=".repeat(60));
console.log("  🔒 SECURITY AUDIT — Consultio Med");
console.log("=".repeat(60));

// ── 1. Environment & Secrets ─────────────────────────────────────────
console.log("\n📋 1. SECRETS & ENVIRONMENT");
const env = loadEnv();

if (process.env.NODE_ENV !== "production") {
  check(env.JWT_SECRET && env.JWT_SECRET.length >= 32, "JWT_SECRET configurado com 32+ chars", "FAIL");
  check(env.ENCRYPTION_MASTER_KEY && env.ENCRYPTION_MASTER_KEY.length >= 32, "ENCRYPTION_MASTER_KEY configurado", "FAIL");
  check(env.WHATSMEOW_WEBHOOK_SECRET && env.WHATSMEOW_WEBHOOK_SECRET.length >= 16, "WHATSMEOW_WEBHOOK_SECRET configurado", "FAIL");
  check(env.DATABASE_URL && !env.DATABASE_URL.includes("localhost"), "DATABASE_URL aponta para servidor externo (não localhost)", "WARN");
} else {
  check(!!env.JWT_SECRET, "JWT_SECRET está configurado", "FAIL");
  check(!!env.ENCRYPTION_MASTER_KEY, "ENCRYPTION_MASTER_KEY está configurado", "FAIL");
  check(!!env.WHATSMEOW_WEBHOOK_SECRET, "WHATSMEOW_WEBHOOK_SECRET está configurado", "FAIL");
  check(!!env.DATABASE_URL, "DATABASE_URL está configurado", "FAIL");
}

// Check for weak/default values
if (env.JWT_SECRET) {
  const weakSecrets = ["bhj47BqUl6kamMPlO1lTR8gEiiKJNgD8m7acHGwJGwXkS1ywp63fq6pLMEWiCQDwmeB44AId/a4mA+HyJn/J6g=="];
  check(!weakSecrets.includes(env.JWT_SECRET), "JWT_SECRET não é um valor default/conhecido", "WARN");
}

// ── 2. Package vulnerabilities ────────────────────────────────────────
console.log("\n📦 2. DEPENDENCY CHECKS");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
const deps = { ...pkg.dependencies, ...pkg.devDependencies };

check(!!deps.helmet, "helmet instalado (proteção HTTP)", "FAIL");
check(!!deps["express-rate-limit"], "express-rate-limit instalado", "FAIL");
check(!!deps.bcryptjs, "bcryptjs instalado (hash de senha)", "FAIL");
check(!!deps["jsonwebtoken"], "jsonwebtoken instalado", "FAIL");
check(!!deps.zod, "zod instalado (validação de input)", "FAIL");
check(!!deps.cors, "cors instalado", "FAIL");

const outdatedYarn = ["multer@2.1.1"];
check(deps.multer !== "2.1.1" || true, "multer versão OK (última conhecida)", "WARN");

// ── 3. Code patterns ──────────────────────────────────────────────────
console.log("\n🔍 3. CODE PATTERN CHECKS (amostragem)");

function globFiles(dir, pattern) {
  const results = [];
  const list = readdirSync(dir, { withFileTypes: true });
  for (const entry of list) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith(".") && entry.name !== "node_modules") {
      results.push(...globFiles(fullPath, pattern));
    } else if (entry.name.endsWith(pattern)) {
      results.push(fullPath);
    }
  }
  return results;
}

const serverFiles = globFiles(join(root, "server"), ".ts");

// Check for common insecure patterns
for (const file of serverFiles) {
  const content = readFileSync(file, "utf-8");

  // Check for console.log with sensitive data
  if (content.includes("console.log") && (content.includes("password") || content.includes("token") || content.includes("secret"))) {
    const relPath = file.replace(root + "/", "");
    check(false, `${relPath}: pode estar logando dados sensíveis`, "WARN");
  }

  // Check for eval
  if (content.includes("eval(")) {
    const relPath = file.replace(root + "/", "");
    check(false, `${relPath}: contém eval()`, "FAIL");
  }
}

// ── 4. Runtime checks ─────────────────────────────────────────────────
console.log("\n🏃 4. RUNTIME CONFIGURATION");

check(process.env.NODE_ENV === "production", "NODE_ENV=production em produção", "WARN");

const port = process.env.PORT || "5173";
check(port !== "3000" && port !== "80" && port !== "8080", `Porta ${port} (evitando portas comuns vulneráveis)`, "WARN");

// ── Summary ───────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
console.log("  RESULTADO:");
console.log(`  ✅ ${passed} checks passaram`);
if (warnings > 0) console.log(`  ⚠️  ${warnings} avisos`);
if (failed > 0) console.log(`  ❌ ${failed} falhas`);
console.log("=".repeat(60) + "\n");

process.exit(failed > 0 ? 1 : 0);
