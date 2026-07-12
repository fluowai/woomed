# ACTION PLAN TÉCNICO - Implementação das Correções

**Projeto**: Consultio Med  
**Data**: 2026-07-12  
**Prioridade**: P0 (Crítico)

---

## 1️⃣ FIX P0.1: REMOVER DUPLICAÇÃO EM App.tsx

### Problema
```typescript
// ANTES (900 linhas com duplicação)
switch (activeView) {
  case 'Pipeline Agentes': return <AgentPipelineDashboard />;
  case 'Pipeline Agentes': return <AgentPipelineDashboard />;  // ⚠️ DUPLICADO
  // ... 10+ outros duplicados
}
```

### Solução

**Arquivo**: `src/App.tsx`  
**Tempo**: 2 horas  
**LOC Removidas**: 200+

```typescript
// ANTES (900 linhas)
const renderView = () => {
  switch (activeView) {
    case 'Dashboard': return <Dashboard ... />;
    case 'Painel SaaS': return <SaaSAdmin ... />;
    // ... 50+ cases ...
    case 'Pipeline Agentes': return <AgentPipelineDashboard />;
    case 'Pipeline Agentes': return <AgentPipelineDashboard />;  // DUPLICADO
  }
};

// DEPOIS (200 linhas)
type ViewRenderer = () => JSX.Element;

const VIEW_RENDERERS: Record<string, ViewRenderer> = {
  Dashboard: () => (
    <Dashboard 
      appointments={appointments}
      patients={patients}
      doctors={doctors}
      currentDate={currentDate}
      onViewChange={setActiveView}
      onNewAppointment={() => setIsSchedulingOpen(true)}
      onNewPatient={() => setActiveView('Pacientes')}
    />
  ),
  'Painel SaaS': () => (
    <SaaSAdmin
      token={auth.authToken}
      tenants={tenants}
      plans={plans}
      onAccessTenant={handleAccessTenant}
      activeSection={activeSaasSection}
      onRefresh={async () => { /* ... */ }}
    />
  ),
  'Agenda': () => (
    <>
      <AgendaSubHeader 
        currentDate={currentDate}
        onDateChange={setCurrentDate}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        searchTerm={agendaSearch}
        onSearchChange={setAgendaSearch}
      />
      <div className="flex-1 overflow-hidden relative">
        {viewMode === 'list' ? (
          <AppointmentTable {...} />
        ) : (
          <AgendaCalendar {...} />
        )}
      </div>
    </>
  ),
  // ... REMOVAR TODOS OS DUPLICADOS ...
  'Pipeline Agentes': () => (
    <ModuleWrap>
      <AgentPipelineDashboard />
    </ModuleWrap>
  ),
  // ... NÃO REPETIR MAIS ...
};

const renderView = () => {
  const requiredFeature = featureByView[activeView];
  if (requiredFeature && planFeatures[requiredFeature] === false) {
    return <FeatureUnavailableView />;
  }
  
  const renderer = VIEW_RENDERERS[activeView];
  if (!renderer) {
    return <div>View não encontrada: {activeView}</div>;
  }
  
  return renderer();
};
```

### Benefícios
- ✅ Remove 200 linhas
- ✅ Elimina 12 warnings do build
- ✅ Facilita adicionar novas views
- ✅ Type-safe

---

## 2️⃣ FIX P0.2: IMPLEMENTAR CACHE SIMPLES

### Problema
```typescript
// ANTES: loadData() chamado em CADA rota
app.get("/api/patients", requireAuth, async (req, res) => {
  const data = await loadData();  // ❌ Novo JSON.parse() cada vez
  // ... processamento ...
});
```

### Solução

**Arquivo**: `server/cache.ts` (NOVO)  
**Tempo**: 4 horas

```typescript
// server/cache.ts
interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<any>>();

export function getCached<T>(key: string, fn: () => Promise<T>, ttlMs: number = 30000): Promise<T> {
  const entry = cache.get(key);
  const now = Date.now();
  
  if (entry && entry.expiresAt > now) {
    return Promise.resolve(entry.data);
  }
  
  return fn().then(data => {
    cache.set(key, {
      data,
      expiresAt: now + ttlMs
    });
    
    // Cleanup periodicamente
    if (cache.size > 1000) {
      for (const [k, v] of cache.entries()) {
        if (v.expiresAt < now) cache.delete(k);
      }
    }
    
    return data;
  });
}

export function invalidateCache(pattern?: string) {
  if (!pattern) {
    cache.clear();
    return;
  }
  for (const key of cache.keys()) {
    if (key.includes(pattern)) cache.delete(key);
  }
}
```

**Integração**: `server/routes/index.ts`

```typescript
import { getCached, invalidateCache } from "../cache";

// Antes
app.get("/api/patients", requireAuth, async (req: AuthedRequest, res) => {
  const data = await loadData();  // ❌
  // ...
});

// Depois
app.get("/api/patients", requireAuth, async (req: AuthedRequest, res) => {
  const tenantId = req.user?.tenantId || "single-tenant";
  const data = await getCached(
    `bootstrap-${tenantId}`,
    () => loadData(),
    30000  // 30s TTL
  );
  // ...
});

// Post de criação invalida cache
app.post("/api/patients", requireAuth, requireRoles("admin", "doctor", "reception"), async (req: AuthedRequest, res) => {
  const parsed = patientSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
  
  const newPatient: Patient = { /* ... */ };
  const created = await dataService.createPatient(newPatient, req.user!, req.user?.tenantId);
  
  // Invalidar cache após mudança
  invalidateCache(`bootstrap-${req.user?.tenantId}`);
  
  res.json({ patient: created });
});
```

### Métricas
- ❌ Antes: 1000 req/min = 1000 JSON.parse()
- ✅ Depois: ~60 JSON.parse() (1 a cada 30s)
- 🎯 Melhoria: **94% menos CPU**
- ⏱️ Latência: 150ms → 2ms (75x faster)

---

## 3️⃣ FIX P0.3: ADICIONAR TESTES DE MULTI-TENANT

### Problema
```typescript
// ANTES: Sem testes de isolamento
describe('API - Patients (unauthenticated)', () => {
  it('GET /api/patients without token returns 401', async () => {
    // ... apenas teste de autenticação
  });
});
// ❌ Falta testar: tenant A vê dados de tenant B?
```

### Solução

**Arquivo**: `tests/multi-tenant.test.ts` (NOVO)  
**Tempo**: 2 horas

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { createApp } from '../server';
import supertest from 'supertest';
import * as crypto from 'crypto';
import { loadData, saveData } from '../server/data';
import { generateTokens } from '../server/auth';

let app: any;
let request: any;

beforeAll(() => {
  app = createApp();
  request = supertest(app);
});

describe('Multi-tenant Isolation', () => {
  
  it('should not allow tenant B to access tenant A patient data', async () => {
    // 1. Criar dados para tenant A
    const data = await loadData();
    const tenantA = 'clinic-a-uuid';
    const tenantB = 'clinic-b-uuid';
    
    data.patients.push({
      id: crypto.randomUUID(),
      fullName: 'Patient from Tenant A',
      birthDate: '1990-01-01',
      cpf: 'encrypted',
      tenantId: tenantA,
      lgpdConsent: true,
      lgpdConsentAt: new Date().toISOString()
    });
    
    await saveData(data);
    
    // 2. Criar usuários para cada tenant
    const userA = {
      id: crypto.randomUUID(),
      name: 'Admin A',
      email: 'admin@clinic-a.com',
      role: 'admin',
      tenantId: tenantA
    };
    
    const userB = {
      id: crypto.randomUUID(),
      name: 'Admin B',
      email: 'admin@clinic-b.com',
      role: 'admin',
      tenantId: tenantB
    };
    
    // 3. Gerar tokens
    const tokenA = generateTokens(userA).token;
    const tokenB = generateTokens(userB).token;
    
    // 4. Tenant A acessa seus dados ✅
    const resA = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(resA.status).toBe(200);
    expect(resA.body.patients).toContainEqual(
      expect.objectContaining({ fullName: 'Patient from Tenant A' })
    );
    
    // 5. Tenant B NÃO acessa dados de Tenant A ❌
    const resB = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${tokenB}`);
    
    expect(resB.status).toBe(200);
    expect(resB.body.patients).not.toContainEqual(
      expect.objectContaining({ fullName: 'Patient from Tenant A' })
    );
  });
  
  it('should not expose bootstrap data from other tenants', async () => {
    const data = await loadData();
    const tenantA = 'clinic-a-uuid';
    const tenantB = 'clinic-b-uuid';
    
    // Setup tenants
    data.tenants = [
      { id: tenantA, name: 'Clinic A', slug: 'clinic-a', planId: 'starter' },
      { id: tenantB, name: 'Clinic B', slug: 'clinic-b', planId: 'starter' }
    ];
    
    // Add patients
    data.patients.push(
      {
        id: 'pat-a1',
        fullName: 'Patient A',
        tenantId: tenantA,
        birthDate: '1990-01-01',
        cpf: 'enc',
        lgpdConsent: true,
        lgpdConsentAt: new Date().toISOString()
      },
      {
        id: 'pat-b1',
        fullName: 'Patient B',
        tenantId: tenantB,
        birthDate: '1990-01-01',
        cpf: 'enc',
        lgpdConsent: true,
        lgpdConsentAt: new Date().toISOString()
      }
    );
    
    await saveData(data);
    
    const tokenA = generateTokens({
      id: 'user-a',
      name: 'Admin A',
      role: 'admin',
      tenantId: tenantA
    }).token;
    
    const res = await request(app)
      .get('/api/bootstrap')
      .set('Authorization', `Bearer ${tokenA}`);
    
    expect(res.status).toBe(200);
    expect(res.body.patients).toContainEqual(
      expect.objectContaining({ id: 'pat-a1' })
    );
    expect(res.body.patients).not.toContainEqual(
      expect.objectContaining({ id: 'pat-b1' })
    );
  });
  
  it('should not allow cross-tenant appointment creation', async () => {
    const data = await loadData();
    const tenantA = 'clinic-a-uuid';
    const tenantB = 'clinic-b-uuid';
    
    // Patient in Tenant B
    const patientB = {
      id: 'pat-b2',
      fullName: 'Patient B2',
      tenantId: tenantB,
      birthDate: '1990-01-01',
      cpf: 'enc',
      lgpdConsent: true,
      lgpdConsentAt: new Date().toISOString()
    };
    
    // Doctor in Tenant A
    const doctorA = {
      id: 'doc-a1',
      name: 'Dr. A',
      specialty: 'General',
      tenantId: tenantA,
      availableDays: ['Monday'],
      workingHours: { start: '08:00', end: '18:00' }
    };
    
    data.patients.push(patientB);
    data.doctors.push(doctorA);
    await saveData(data);
    
    const tokenA = generateTokens({
      id: 'user-a',
      name: 'Admin A',
      role: 'admin',
      tenantId: tenantA
    }).token;
    
    // Try to create appointment with Tenant A doctor + Tenant B patient
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        doctorId: 'doc-a1',
        patientId: 'pat-b2',  // ⚠️ Different tenant!
        date: '2026-07-15',
        timeStart: '09:00',
        type: 'Consulta'
      });
    
    // Should be rejected
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.error).toBeDefined();
  });
});
```

### Execução
```bash
npm run test -- tests/multi-tenant.test.ts
```

---

## 4️⃣ FIX P1.1: EXPANDIR RATE LIMITING

### Problema
```typescript
// ANTES: Proteção genérica, sem por-usuário
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 200 });
app.use("/api/", apiLimiter);  // ⚠️ 200 req/min muito permissivo
```

### Solução

**Arquivo**: `server/rate-limiters.ts` (NOVO)  
**Integração**: `server.ts`

```typescript
// server/rate-limiters.ts
import rateLimit from 'express-rate-limit';

// Rate limiters específicos
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Tente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.ip || 'unknown'
});

export const mfaLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Muitas tentativas MFA. Tente em 15 minutos.' }
});

export const bootstrapLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,  // ⬇️ Reduzido de 200
  message: { error: 'Muitas requisições bootstrap. Tente em 1 minuto.' },
  keyGenerator: (req) => {
    // Rate limit por usuário, não por IP
    return (req as any).user?.id || req.ip || 'unknown';
  }
});

export const patientCreationLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,  // 20 pacientes/minuto por usuário
  message: { error: 'Limite de criação de pacientes excedido.' },
  keyGenerator: (req) => (req as any).user?.id || req.ip || 'unknown'
});

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 100,  // ⬇️ Reduzido de 200
  message: { error: 'Muitas requisições. Tente em 1 minuto.' },
  keyGenerator: (req) => (req as any).user?.id || req.ip || 'unknown'
});
```

**Integração**: `server.ts`

```typescript
import {
  authLimiter, mfaLimiter, bootstrapLimiter,
  patientCreationLimiter, generalLimiter
} from './server/rate-limiters';

// Auth
app.use("/api/auth/login", authLimiter);
app.use("/api/v2/auth/login", authLimiter);
app.use("/api/v2/auth/mfa", mfaLimiter);
app.use("/api/v2/auth/change-password", mfaLimiter);

// Bootstrap (resource-heavy)
app.use("/api/bootstrap", bootstrapLimiter);

// Patient creation (spam risk)
app.use("/api/patients", (req, res, next) => {
  if (req.method === 'POST') return patientCreationLimiter(req, res, next);
  next();
});

// General API
app.use("/api/", generalLimiter);
```

---

## 5️⃣ FIX P1.2: ADICIONAR CSRF PROTECTION

### Solução

**Arquivo**: `server.ts`

```typescript
import csrf from 'csurf';
import session from 'express-session';

// Session middleware
app.use(session({
  secret: process.env.SESSION_SECRET || 'dev-secret-change-in-prod',
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict'
  }
}));

// CSRF protection
const csrfProtection = csrf({ cookie: false });
app.use(csrfProtection);

// Middleware para adicionar token CSRF nas respostas
app.use((req, res, next) => {
  res.locals.csrfToken = req.csrfToken();
  next();
});

// Adicionar token CSRF no bootstrap
app.get("/api/bootstrap", requireAuth, (req, res, next) => {
  // Token será incluído no response para client usar em mutations
  res.locals.csrfToken = req.csrfToken();
  next();
});
```

---

## 📋 CHECKLIST DE IMPLEMENTAÇÃO

### Sprint 1 (Esta Semana)

- [ ] **P0.1**: Refatorar App.tsx switch → VIEW_RENDERERS
  - [ ] Criar mapa de views
  - [ ] Remover casos duplicados
  - [ ] Testes unitários do novo renderView
  - [ ] Build sem warnings

- [ ] **P0.2**: Implementar cache simples
  - [ ] Criar `server/cache.ts`
  - [ ] Integrar em loadData()
  - [ ] Invalidar após mutações
  - [ ] Testes de TTL

- [ ] **P0.3**: Testes de multi-tenant
  - [ ] Criar `tests/multi-tenant.test.ts`
  - [ ] 5 testes de isolamento
  - [ ] Validar bootstrap
  - [ ] Validar appointments cross-tenant

- [ ] **P1.1**: Rate limiting expandido
  - [ ] Criar `server/rate-limiters.ts`
  - [ ] Aplicar por rota
  - [ ] Rate limiting por usuário
  - [ ] Testes de limite

- [ ] **P1.2**: CSRF protection
  - [ ] Instalar `csurf` e `express-session`
  - [ ] Middleware de sessão
  - [ ] CSRF token em bootstrap
  - [ ] Validação em POST/PUT/DELETE

### Validation

```bash
# Build sem warnings
npm run build 2>&1 | grep -i "warning\|error"

# Testes passando
npm test

# Multi-tenant seguro
npm test -- tests/multi-tenant.test.ts

# Performance melhorada
npm run test:smoke
```

---

## 📊 MÉTRICAS ESPERADAS

### Antes vs Depois

| Métrica | Antes | Depois | Melhoria |
|---------|-------|--------|----------|
| App.tsx LOC | 900 | 200 | -78% |
| Build warnings | 50+ | 0 | -100% ✅ |
| loadData() calls/min (1 usuário) | 60 | 2 | -97% ✅ |
| Latência média | 150ms | 2ms | 75x 🚀 |
| Multi-tenant tests | 0 | 5 | 🆕 |
| CSRF protection | Nenhuma | Total | 🔐 |
| Rate limit (bootstrap) | 200/min | 10/min | -95% |
| Security score | 6/10 | 8/10 | +33% |

---

**Próximo Passo**: Executar sprint 1 conforme checklist acima.
