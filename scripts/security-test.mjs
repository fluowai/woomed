/**
 * 🧪 Security Penetration Test — Consultio Med
 * 
 * Uso: node scripts/security-test.mjs [baseUrl]
 * Exemplo: node scripts/security-test.mjs http://localhost:5173
 * 
 * Testa endpoints críticos contra vulnerabilidades comuns:
 *   - Rotas sem autenticação
 *   - Injeção SQL / NoSQL
 *   - Path traversal
 *   - Mass assignment
 *   - Rate limiting
 *   - Headers de segurança
 */

const BASE_URL = process.argv[2] || "http://localhost:5173";

let passed = 0;
let failed = 0;

async function test(name, fn) {
  try {
    await fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ❌ ${name}: ${err.message}`);
    failed++;
  }
}

async function fetchJson(path, options = {}) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, headers: res.headers };
}

console.log("\n" + "=".format(60));
console.log("  🧪 SECURITY PENETRATION TEST");
console.log(`  Target: ${BASE_URL}`);
console.log("=".format(60));

// ── 1. AUTH BYPASS ────────────────────────────────────────────────────
console.log("\n🔓 1. AUTH BYPASS TESTS");

await test("GET /api/auth/users deve retornar 401 sem token", async () => {
  const { status } = await fetchJson("/api/auth/users");
  if (status !== 401) throw new Error(`Esperado 401, recebido ${status}`);
});

await test("GET /api/v2/export/patients deve retornar 401 sem token", async () => {
  const { status } = await fetchJson("/api/v2/export/patients");
  if (status !== 401) throw new Error(`Esperado 401, recebido ${status}`);
});

await test("POST /api/v2/auth/login sem credenciais retorna 400", async () => {
  const { status } = await fetchJson("/api/v2/auth/login", { method: "POST", body: JSON.stringify({}) });
  if (status !== 400) throw new Error(`Esperado 400, recebido ${status}`);
});

await test("POST /api/auth/login (legacy) retorna 403 (desativado)", async () => {
  const { status } = await fetchJson("/api/auth/login", { method: "POST", body: JSON.stringify({ userId: "u-admin", pin: "1234" }) });
  if (status !== 403) throw new Error(`Esperado 403, recebido ${status}`);
});

// ── 2. INJECTION ATTACKS ──────────────────────────────────────────────
console.log("\n💉 2. INJECTION TESTS");

await test("SQL injection no login retorna 400/401 (não 500)", async () => {
  const { status } = await fetchJson("/api/v2/auth/login", {
    method: "POST",
    body: JSON.stringify({ email: "' OR 1=1--", password: "' OR '1'='1" }),
  });
  if (status === 500) throw new Error(`Possível SQL injection! Status: ${status}`);
});

await test("XSS via patient name", async () => {
  const { status } = await fetchJson("/api/patients", {
    method: "POST",
    body: JSON.stringify({
      fullName: "<script>alert(1)</script>",
      birthDate: "2000-01-01",
      cpf: "00000000000",
      lgpdConsent: true,
    }),
  });
  // Não deve crashar
  if (status === 500) throw new Error(`Possível XSS crash! Status: ${status}`);
});

// ── 3. PATH TRAVERSAL ─────────────────────────────────────────────────
console.log("\n📁 3. PATH TRAVERSAL TESTS");

await test("Path traversal em /uploads retorna 404/403", async () => {
  const res = await fetch(`${BASE_URL}/uploads/../../../etc/passwd`);
  if (res.status === 200) throw new Error(`Path traversal possivel! Status: ${res.status}`);
});

// ── 4. RATE LIMITING ──────────────────────────────────────────────────
console.log("\n⏱️  4. RATE LIMITING TESTS");

await test("Múltiplas tentativas de login inválidas são limitadas", async () => {
  let limited = false;
  for (let i = 0; i < 25; i++) {
    const { status, body } = await fetchJson("/api/v2/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: `test${i}@test.com`, password: "wrong" }),
    });
    if (status === 429) { limited = true; break; }
  }
  if (!limited) throw new Error("Rate limiting não detectado (pode ser necessário mais tentativas)");
});

// ── 5. SECURITY HEADERS ───────────────────────────────────────────────
console.log("\n🛡️  5. SECURITY HEADERS");

await test("Content-Security-Policy header presente", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  const csp = res.headers.get("content-security-policy");
  if (!csp) throw new Error("CSP header ausente");
});

await test("X-Content-Type-Options header presente", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  const header = res.headers.get("x-content-type-options");
  if (!header) throw new Error("X-Content-Type-Options header ausente");
});

await test("X-Frame-Options header presente", async () => {
  const res = await fetch(`${BASE_URL}/api/health`);
  const header = res.headers.get("x-frame-options");
  if (!header) throw new Error("X-Frame-Options header ausente");
});

// ── 6. CORS ───────────────────────────────────────────────────────────
console.log("\n🌐 6. CORS TESTS");

await test("CORS não permite origens arbitrárias (produção)", async () => {
  const res = await fetch(`${BASE_URL}/api/health`, {
    headers: { Origin: "https://evil.com" },
  });
  const cors = res.headers.get("access-control-allow-origin");
  if (cors === "*") throw new Error("CORS permite todas origens");
});

// ── Summary ───────────────────────────────────────────────────────────
console.log("\n" + "=".format(60));
console.log(`  RESULTADO: ${passed} ✅ / ${failed} ❌`);
if (failed === 0) console.log("  🎉 Todos os testes de segurança passaram!");
else console.log(`  ⚠️  ${failed} teste(s) falharam`);
console.log("=".format(60) + "\n");

process.exit(failed > 0 ? 1 : 0);
