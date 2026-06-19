import { createServer } from "http";
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

let exitCode = 0;

function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL: ${message}`);
    exitCode = 1;
  } else {
    console.log(`PASS: ${message}`);
  }
}

// 1. Check critical files exist
console.log("\n--- File structure ---");
const requiredFiles = [
  "server.ts",
  "package.json",
  "tsconfig.json",
  "vite.config.ts",
  "Dockerfile",
  "docker-compose.yml",
  ".gitignore",
  "src/App.tsx",
  "src/main.tsx",
  "server/config.ts",
  "server/auth.ts",
  "server/data.ts",
  "server/database.ts",
  "server/middleware.ts",
  "server/schemas.ts",
  "server/helpers.ts",
  "server/routes/index.ts",
  "server/data-service.ts",
  "server/supabase.ts",
  "server/ai-service.ts",
  "server/backup.ts",
  "server/crypto.ts",
  "server/audit.ts",
  "server/modules/scheduler.ts",
  "server/modules/followup.ts",
  "server/modules/agent-actions.ts",
  "server/modules/agent-router.ts",
  "server/modules/agent-runtime.ts",
  "server/routes/scheduler-routes.ts",
  "src/components/AutomationModule.tsx",
];
for (const file of requiredFiles) {
  assert(existsSync(join(root, file)), `Required file exists: ${file}`);
}

// 2. Check package.json
console.log("\n--- package.json ---");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));
assert(pkg.name === "consultio-med", `Package name is "${pkg.name}" (expected "consultio-med")`);
assert(pkg.scripts.lint === "tsc --noEmit", "lint script exists");
assert(pkg.scripts.build, "build script exists");
assert(pkg.scripts.test, "test script exists");

// 3. Check tsconfig
console.log("\n--- tsconfig ---");
const tsconfig = JSON.parse(readFileSync(join(root, "tsconfig.json"), "utf-8"));
assert(tsconfig.compilerOptions.noEmit === true, "noEmit is true");
assert(tsconfig.compilerOptions.strict === undefined || tsconfig.compilerOptions.strict === true, "strict mode");

// 4. Check .gitignore blocks secrets
console.log("\n--- .gitignore ---");
const gitignore = readFileSync(join(root, ".gitignore"), "utf-8");
assert(gitignore.includes(".env"), ".gitignore has .env entry");
assert(gitignore.includes("node_modules"), ".gitignore has node_modules");
assert(gitignore.includes("dist"), ".gitignore has dist");

// 5. Check server.ts has proper security middleware
console.log("\n--- Security ---");
const serverTs = readFileSync(join(root, "server.ts"), "utf-8");
assert(serverTs.includes("helmet("), "helmet middleware used");
assert(serverTs.includes("rateLimit("), "rate limiting used");
assert(serverTs.includes("cors("), "cors middleware used");
assert(serverTs.includes("errorHandler"), "error handler present");

// 6. Check config.ts checks for production env vars
console.log("\n--- Config validation ---");
const configTs = readFileSync(join(root, "server", "config.ts"), "utf-8");
assert(configTs.includes('NODE_ENV === "production"'), "production env checks present");
assert(configTs.includes("WHATSMEOW_WEBHOOK_SECRET"), "WHATSMEOW_WEBHOOK_SECRET checked");
assert(configTs.includes("ENCRYPTION_MASTER_KEY"), "ENCRYPTION_MASTER_KEY checked");

// 7. Check auth.ts has JWT_SECRET production check
console.log("\n--- Auth ---");
const authTs = readFileSync(join(root, "server", "auth.ts"), "utf-8");
assert(authTs.includes('NODE_ENV === "production"'), "auth.js production env checks present");
assert(authTs.includes("bcrypt"), "bcrypt used for password hashing");
assert(authTs.includes("jwt.sign"), "JWT signing present");

// 8. Check for critical security issues
console.log("\n--- Security audit ---");
const allSource = [
  "server.ts",
  "server/config.ts",
  "server/auth.ts",
  "server/middleware.ts",
  "server/crypto.ts",
  "server/data-service.ts",
].map(f => readFileSync(join(root, f), "utf-8")).join("\n");

const dangerousPatterns = [
  { pattern: /process\.env\.JWT_SECRET\s*\|\|\s*['"]/, name: "JWT_SECRET fallback to default string" },
  { pattern: /private\s*key/i, name: "Possible hardcoded private key" },
];
for (const { pattern, name } of dangerousPatterns) {
  const found = allSource.match(pattern);
  if (found) {
    console.warn(`WARN: Possible issue: ${name}`);
  }
}

// 9. Check new agent action types
console.log("\n--- Agent Actions ---");
const agentActions = readFileSync(join(root, "src", "agent-types.ts"), "utf-8");
assert(agentActions.includes("consultar_prontuario"), "Agent action: consultar_prontuario");
assert(agentActions.includes("consultar_financeiro"), "Agent action: consultar_financeiro");
assert(agentActions.includes("enviar_orcamento"), "Agent action: enviar_orcamento");
assert(agentActions.includes("consultar_paciente_completo"), "Agent action: consultar_paciente_completo");

// 10. Check scheduler exports
console.log("\n--- Scheduler ---");
const schedulerTs = readFileSync(join(root, "server", "modules", "scheduler.ts"), "utf-8");
assert(schedulerTs.includes("export function startScheduler"), "startScheduler exported");
assert(schedulerTs.includes("export function stopScheduler"), "stopScheduler exported");
assert(schedulerTs.includes("export async function getSchedulerStatus"), "getSchedulerStatus exported");
assert(schedulerTs.includes("export async function scheduleReminder"), "scheduleReminder exported");
assert(schedulerTs.includes("CHECK_INTERVAL_MS"), "CHECK_INTERVAL_MS defined");

// 11. Check follow-up exports
console.log("\n--- Follow-up ---");
const followupTs = readFileSync(join(root, "server", "modules", "followup.ts"), "utf-8");
assert(followupTs.includes("export async function registerForFollowUp"), "registerForFollowUp exported");
assert(followupTs.includes("export async function unregisterFromFollowUp"), "unregisterFromFollowUp exported");
assert(followupTs.includes("export async function checkFollowUps"), "checkFollowUps exported");
assert(followupTs.includes("export async function findAbandonedSessions"), "findAbandonedSessions exported");

// 12. Check agent-router has LLM routing
console.log("\n--- Agent Router ---");
const agentRouter = readFileSync(join(root, "server", "modules", "agent-router.ts"), "utf-8");
assert(agentRouter.includes("extractIntentWithLLM"), "LLM intent extraction");
assert(agentRouter.includes("extractIntentKeywords"), "Keyword-based intent fallback");
assert(agentRouter.includes("decideNextAction"), "decideNextAction function");

// 13. Check agent-runtime follow-up integration
console.log("\n--- Agent Runtime ---");
const agentRuntime = readFileSync(join(root, "server", "modules", "agent-runtime.ts"), "utf-8");
assert(agentRuntime.includes("registerForFollowUp"), "Follow-up registered on session create");
assert(agentRuntime.includes("unregisterFromFollowUp"), "Follow-up unregistered on session resolve");

// 14. Check Automation frontend component
console.log("\n--- Automation UI ---");
const automationModule = readFileSync(join(root, "src", "components", "AutomationModule.tsx"), "utf-8");
assert(automationModule.includes("SchedulerPanel"), "SchedulerPanel component");
assert(automationModule.includes("FollowUpPanel"), "FollowUpPanel component");
assert(automationModule.includes("TemplatesPanel"), "TemplatesPanel component");
assert(automationModule.includes("/api/v2/scheduler/status"), "Scheduler status API call");
assert(automationModule.includes("/api/v2/followup/queue"), "Follow-up queue API call");
assert(automationModule.includes("/api/v2/automation/templates"), "Templates API call");

// 15. Verify build output
console.log("\n--- Build output ---");
assert(existsSync(join(root, "dist", "index.html")), "Frontend build: index.html exists");
assert(existsSync(join(root, "dist", "server.cjs")), "Backend build: server.cjs exists");

console.log(`\n${exitCode === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
process.exit(exitCode);
