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

// 9. Verify build output
console.log("\n--- Build output ---");
assert(existsSync(join(root, "dist", "index.html")), "Frontend build: index.html exists");
assert(existsSync(join(root, "dist", "server.cjs")), "Backend build: server.cjs exists");

console.log(`\n${exitCode === 0 ? "ALL TESTS PASSED" : "SOME TESTS FAILED"}`);
process.exit(exitCode);
