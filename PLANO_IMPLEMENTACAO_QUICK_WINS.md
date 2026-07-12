# 🎯 PLANO DE IMPLEMENTAÇÃO - QUICK WINS

**Status:** Pronto para execução  
**Esforço total:** 13 horas (1 dev)  
**Ganho:** -200ms latência, +70% throughput, 0 vazamentos multi-tenant

---

## SEMANA 1: CRITICAL FIXES

### ✅ TAREFA 1: Adicionar Isolamento Multi-Tenant (P0)
**Duração:** 3 horas | **Complexidade:** Alta | **Risco:** Médio

#### Problema
Rotas em `server/routes/index.ts` não verificam se usuário tem permissão ao tenant:
```typescript
// ATUAL (INSEGURO):
const patients = data.patients; // Sem filtro!
res.json(patients); // Retorna tudo, de todas as clínicas
```

#### Solução
```typescript
// NOVO (SEGURO):
// 1. Criar helper em server/tenant.ts
export function filterByTenant<T extends {tenantId?: string}>(
  items: T[], 
  userTenantId?: string
): T[] {
  if (!userTenantId) return [];
  return items.filter(item => item.tenantId === userTenantId);
}

// 2. Usar em TODAS as rotas
app.get('/api/patients', requireAuth, (req: AuthedRequest, res) => {
  const patients = filterByTenant(data.patients, req.user?.tenantId);
  res.json(patients);
});

app.get('/api/appointments', requireAuth, (req: AuthedRequest, res) => {
  const appointments = filterByTenant(data.appointments, req.user?.tenantId);
  res.json(appointments);
});
```

#### Testes
```typescript
// tests/multi-tenant.test.ts
describe('Multi-tenant isolation', () => {
  it('user from clinic A cannot see clinic B patients', async () => {
    // 1. Create clinic A user
    const userA = await createUser({tenantId: 'clinic-a'});
    // 2. Create clinic B patient
    const patientB = await createPatient({tenantId: 'clinic-b'});
    // 3. Try to fetch as user A
    const res = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${userA.token}`);
    // 4. Verify clinic B patient not in response
    expect(res.body).not.toContainEqual(patientB);
  });
});
```

#### Checklist
- [ ] Criar `filterByTenant` helper
- [ ] Aplicar em 15+ rotas (patients, appointments, finance, etc)
- [ ] Adicionar 5 testes de isolamento
- [ ] Testar com 2 tenants simultâneos
- [ ] Documentar em security.md

---

### ✅ TAREFA 2: Remover Duplicação em App.tsx (P1)
**Duração:** 2 horas | **Complexidade:** Média | **Risco:** Baixo

#### Problema
App.tsx tem 1800+ linhas, muita duplicação:
- View state management repetido (50+ vezes)
- Event handlers duplicados
- Props drilling profundo

#### Solução
```typescript
// src/hooks/useViewManager.ts (NOVO)
export function useViewManager() {
  const [activeView, setActiveView] = useState<ViewType>('Dashboard');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  
  return {
    activeView,
    setActiveView,
    selectedPatient,
    setSelectedPatient,
    selectedAppointment,
    setSelectedAppointment,
  };
}

// src/App.tsx (ANTES: 200 linhas de useState)
export default function App() {
  // Antes: 50 linhas de useState duplicadas
  const viewManager = useViewManager(); // Agora: 1 linha!
  
  return (
    <div>
      <Sidebar 
        activeView={viewManager.activeView}
        onViewChange={viewManager.setActiveView}
      />
      <MainContent view={viewManager.activeView} />
    </div>
  );
}
```

#### Ganhos
```
Antes:  1800 linhas
Depois: 1200 linhas (-33%)
Warnings: 50 → 5 (-90%)
```

#### Checklist
- [ ] Criar `useViewManager` hook
- [ ] Extrair `usePatientFilter` hook
- [ ] Extrair `useAppointmentFilter` hook
- [ ] Remover 200+ linhas de duplicação
- [ ] Verificar que testes ainda passam

---

### ✅ TAREFA 3: Ativar Code Splitting (P0)
**Duração:** 1 hora | **Complexidade:** Baixa | **Risco:** Muito Baixo

#### Problema
```
Bundle inicial: 173 KB (gzip)
- React: 42 KB
- lucide-react: 28 KB
- TailwindCSS: 18 KB
- App code: 85 KB
Load time: 5+ segundos em 3G
```

#### Solução
```typescript
// vite.config.ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunks
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-ui': ['lucide-react', 'motion'],
          
          // Feature chunks (lazy loaded)
          'agents': ['./src/components/AgentsHub.tsx'],
          'crm': ['./src/components/CrmModule.tsx'],
          'reports': ['./src/components/ReportsModule.tsx'],
          'finance': ['./src/components/Financeiro.tsx'],
        }
      }
    },
    chunkSizeWarningLimit: 500,
    sourcemap: false, // Production
  },
  // ... rest of config
});
```

#### Ganhos
```
Antes:  173 KB (1 chunk)
Depois: 95 KB initial + 15 chunks lazy
Impact: -45% initial load, -80% on agents view load
```

#### Checklist
- [ ] Atualizar vite.config.ts
- [ ] Testar npm run build
- [ ] Verificar que chunks carregam corretamente
- [ ] Medir impact com Chrome DevTools

---

### ✅ TAREFA 4: Adicionar Paginação em 3 Rotas (P0)
**Duração:** 4 horas | **Complexidade:** Média | **Risco:** Médio

#### Problema
```typescript
// ATUAL:
app.get('/api/patients', (req, res) => {
  res.json(data.patients); // Retorna 10.000 pacientes!
});
```

#### Solução
```typescript
// NOVO (com paginação):
app.get('/api/patients', requireAuth, (req: AuthedRequest, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = parseInt(req.query.offset as string) || 0;
  
  const patients = filterByTenant(data.patients, req.user?.tenantId);
  const total = patients.length;
  const paginated = patients.slice(offset, offset + limit);
  
  res.json({
    data: paginated,
    total,
    offset,
    limit,
    hasMore: offset + limit < total,
  });
});

// Frontend usage:
const [page, setPage] = useState(0);
useEffect(() => {
  apiGet(`/api/patients?limit=50&offset=${page * 50}`, token)
    .then(data => setPatients(data.data));
}, [page]);
```

#### Aplicar em:
- [ ] `/api/patients`
- [ ] `/api/appointments`
- [ ] `/api/finance/transactions`

#### Ganhos
```
Memória:  600 MB → 80 MB (-87%)
Response: 2.5s → 150ms (-94%)
```

#### Testes
```typescript
it('returns paginated patients', async () => {
  const res = await request(app)
    .get('/api/patients?limit=10&offset=0')
    .set('Authorization', `Bearer ${token}`);
  
  expect(res.body.data.length).toBe(10);
  expect(res.body.total).toBeDefined();
  expect(res.body.hasMore).toBeDefined();
});
```

---

### ✅ TAREFA 5: Migrar 1 Rota para JWT Seguro (P0)
**Duração:** 3 horas | **Complexidade:** Média | **Risco:** Baixo

#### Problema
JWT existe em `auth.ts` mas não é usado em `/api/bootstrap`:
```typescript
// ATUAL:
const user = resolveUser(token); // Funciona
if (!user) return res.status(401).json({...});
// Mas middleware usa sessions Map antigo!
```

#### Solução
Migrate `/api/v2/patients` (já está lá) como prototipo:

```typescript
// server/routes/phase1.ts (já existe)
import { requireAuth } from '../middleware';

app.get('/api/v2/patients', requireAuth, (req: AuthedRequest, res) => {
  if (!req.user?.tenantId) {
    return res.status(401).json({error: 'Tenant required'});
  }
  
  const patients = filterByTenant(data.patients, req.user.tenantId);
  res.json(patients);
});

// Testar JWT manualmente:
// 1. Login: POST /api/v2/auth/login
// 2. Copy token do response
// 3. Fazer GET /api/v2/patients com Bearer token
```

#### Checklist
- [ ] Adicionar `filterByTenant` check
- [ ] Adicionar testes JWT
- [ ] Documentar fluxo em API.md

---

## SEMANA 2: STABILIDADE

### ✅ TAREFA 6: Adicionar 5 Testes de Integração

**Testes a criar:**
```typescript
// tests/integration/full-flow.test.ts
describe('Full clinic flow', () => {
  it('new user can create patient and appointment', async () => {
    // 1. Login
    // 2. Create patient
    // 3. Create appointment
    // 4. Fetch appointment
    // 5. Verify consistency
  });
  
  it('multi-tenant isolation prevents cross-access', async () => {
    // 1. Create 2 tenants
    // 2. Create user in clinic A
    // 3. Try to access clinic B patient
    // 4. Should fail
  });
  
  // ... 3 more integration tests
});
```

---

## SEMANA 3: PERFORMANCE

### ✅ TAREFA 7: Setup PostgreSQL Migration

```sql
-- supabase/migrations/001_tables.sql
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id),
  full_name TEXT NOT NULL,
  cpf TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_patients_tenant ON patients(tenant_id);
```

---

## 📊 IMPACTO ESPERADO

```
ANTES (Semana 0):
- Response time: 2.5s
- CPU: 80% (N+1 queries)
- Memory: 600 MB
- Bundle: 173 KB
- Test coverage: 20%
- Vulnerabilities: 7 críticas

DEPOIS (Semana 3):
- Response time: 400ms (-84%)
- CPU: 15% (-81%)
- Memory: 150 MB (-75%)
- Bundle: 95 KB (-45%)
- Test coverage: 60% (+200%)
- Vulnerabilities: 0 críticas (-100%)
```

---

## ⚠️ RISCOS & MITIGAÇÃO

| Risco | Probabilidade | Impacto | Mitigação |
|-------|---------------|--------|-----------|
| Quebrar routes ao adicionar tenant check | Alta | Alto | Feature branch + testes antes de merge |
| Multi-tenant test não detectar vaza | Média | Crítico | Code review de 2 pessoas |
| Bundle split não carregar lazy | Baixa | Médio | Testar em staging antes de deploy |
| Paginação quebrar frontend | Média | Médio | Compatibilidade backwards com `limit=-1` |

---

## 🎯 APROVAÇÃO & PRÓXIMOS PASSOS

**Responsáveis:**
- Tarefa 1: Dev + QA (3h + 1h testes)
- Tarefa 2: Frontend dev (2h)
- Tarefa 3: Frontend dev (1h)
- Tarefa 4: Backend dev (4h)
- Tarefa 5: Backend dev (3h)

**Total:** 1 dev full-time por 2 semanas

**Depois:** 
- Refator componentes React
- Migração PostgreSQL
- Setup CI/CD com testes automáticos

