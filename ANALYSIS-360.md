# Analise 360 - Consultio Med para SaaS de Gestao de Clinicas

Data da analise: 2026-05-29

Escopo: frontend React/Vite, backend Express, rotas API, persistencia JSON/PostgreSQL parcial, Supabase migration, autenticacao, permissoes, WhatsApp, IA, financeiro, agenda, prontuario, LGPD e evolucao para plataforma 360.

## 1. Resumo executivo

O sistema atual e um MVP operacional com boa cobertura visual e varios fluxos funcionais de clinica: login, dashboard, pacientes, agenda, prontuario basico, financeiro basico, WhatsApp, campanhas, agentes, TISS, estoque, indicacoes, referencias, ajuda, auditoria, backup e alguns recursos de fase 2 como documentos, lista de espera, bloqueios de agenda, templates medicos, DRE, exportacao e simulacao PIX.

O produto, porem, ainda nao esta pronto para SaaS multi-tenant profissional. A maior parte das features roda sobre `data/consultio-data.json`, sem isolamento real por clinica, sem transacoes, sem indices, sem constraints e sem consultas paginadas. Existe uma migration Supabase madura em `supabase/migrations/20260526190000_initial_saas_foundation.sql`, mas ela nao esta integrada ao runtime atual do backend. Tambem ha duas camadas de autenticacao convivendo: login legado por PIN/sessao em memoria e login v2 por email/JWT. O login v2 gera JWT, mas o middleware principal `requireAuth` valida apenas o `sessions` Map legado, o que torna o fluxo v2 incompleto para rotas protegidas como `/api/bootstrap`.

Maturidade estimada: 4/10 como MVP interno de clinica unica; 2/10 como SaaS multi-tenant comercializavel; 1/10 como plataforma 360 completa.

Pontos fortes:

| Area | Evidencia | Impacto |
|---|---|---|
| Frontend | `src/App.tsx`, `src/components/*` | Interface ampla, navegavel e com componentes de agenda, pacientes, prontuario, financeiro e WhatsApp. |
| Backend modularizado | `server/routes/index.ts`, `phase1.ts`, `phase2.ts`, `whatsapp.ts` | Melhor que um arquivo monolitico; facilita evolucao por fases. |
| Validacao parcial | `server/schemas.ts` | Zod usado em pacientes, agenda, financeiro, agentes, campanhas e fase 2. |
| Auditoria basica | `server/helpers.ts` | Acoes principais geram eventos. |
| WhatsApp | `server/routes/whatsapp.ts`, `src/components/WhatsApp.tsx` | Inbox, conexoes, WebSocket, webhook e envio por bridge. |
| Base SaaS planejada | `supabase/migrations/20260526190000_initial_saas_foundation.sql` | RLS, tenants, planos, membros, auditoria e tabelas operacionais modeladas. |
| Deploy | `Dockerfile`, `docker-compose.yml`, `deploy/*` | Ha caminho de empacotamento e Portainer/Caddy. |

Riscos criticos:

| Risco | Gravidade | Evidencia | Impacto |
|---|---|---|---|
| Isolamento multi-tenant inexistente no runtime | Critico | `server/data.ts`, `server/routes/index.ts`, `server/tenant.ts` | Uma clinica pode ver dados de outra se houver mais de uma clinica. |
| Persistencia principal em JSON | Critico | `data/consultio-data.json`, `server/data.ts` | Sem concorrencia segura, constraints, indices, rollback ou escala. |
| Autenticacao duplicada/inconsistente | Critico | `server/middleware.ts`, `server/auth.ts`, `server/routes/phase1.ts` | JWT v2 nao e aceito pelo middleware principal; sessoes somem ao reiniciar. |
| PINs e credenciais seed expostos | Alto | `server/seed.ts`, `data/consultio-data.json`, `src/components/Login.tsx` | Facilita acesso indevido e nao atende padrao de saude/LGPD. |
| Segredos de gateway persistidos em JSON | Alto | `server/routes/phase2.ts`, `PaymentGatewayConfig` | Chaves de API podem ficar sem criptografia e sem segregacao por tenant. |
| Prontuario sem auditoria de visualizacao efetiva | Alto | `server/lgpd.ts`, `MedicalRecords.tsx` | Nao ha trilha confiavel de quem leu dado sensivel. |
| Frontend usa mocks e data fixa | Medio/Alto | `src/types.ts`, `src/App.tsx` | Dashboards e operacao ficam presos a dados artificiais. |
| Listagens sem paginacao | Medio/Alto | `/api/bootstrap` retorna tudo | Risco de lentidao e vazamento em bases grandes. |

## 2. Arquitetura atual

### 2.1 Stack

| Camada | Tecnologia | Observacao |
|---|---|---|
| Frontend | React 19, Vite, Tailwind CSS 4, lucide-react, motion | SPA sem React Router; estado centralizado em `App.tsx`. |
| Backend | Express 4, TypeScript/tsx, ws, multer | Modular por arquivos de rotas, mas sem camada repository/service consistente. |
| Persistencia real | JSON file | `server/data.ts` carrega/salva `data/consultio-data.json`. |
| Persistencia planejada | PostgreSQL/Supabase | `server/database.ts` cria schema minimo; migration Supabase cria schema mais robusto, mas nao e usada pelo runtime. |
| IA | Google Gemini | `/api/chat` usa `@google/genai` se houver chave. |
| WhatsApp | bridge Whatsmeow externo | Configurado por `WHATSMEOW_API_URL`. |
| Deploy | Docker/Vite build/esbuild | `npm run build` passa, com aviso de chunk grande. |

### 2.2 Backend

O backend esta dividido assim:

| Arquivo | Responsabilidade | Status |
|---|---|---|
| `server.ts` | Bootstrap Express, Vite/static, rotas, backup | Funcional. |
| `server/routes/index.ts` | API legada: auth PIN, bootstrap, pacientes, agenda, prontuario, financeiro, agentes, marketing, TISS, estoque, indicacoes, referencias, ajuda, auditoria, chat, sugestoes | Funcional, mas single-tenant e baseado em JSON. |
| `server/routes/phase1.ts` | Login v2/JWT/MFA, usuarios, LGPD, backup | Parcial; JWT nao integrado ao middleware legado. |
| `server/routes/phase2.ts` | Documentos, lista de espera, bloqueios, templates, prescricoes, contas a pagar, DRE, gateway, PIX simulado, exportacao, confirmacao/lembrete WhatsApp | Parcial; muitos recursos nao aparecem no bootstrap/telas principais. |
| `server/routes/whatsapp.ts` | Conexoes, sync, conversas, mensagens, webhook, WebSocket | Funcional para WhatsApp, mas sem tenant e sem vinculo automatico com CRM/paciente. |
| `server/schemas.ts` | Validacoes Zod | Parcial; nem todas as rotas usam schema. |
| `server/database.ts` | Pool pg e migration minima | Presente, mas rotas nao usam `query()`. |
| `server/tenant.ts` | Helpers de tenant | Incompleto; nao aplicado nas rotas. |
| `server/lgpd.ts` | Consentimentos em auditEvents | Fragil; sem tabela propria e com `tenantId: single-tenant`. |

### 2.3 Banco de dados

Ha tres camadas diferentes:

1. JSON operacional: `data/consultio-data.json`.
2. Migration minima no runtime: `server/database.ts`, com tabelas como `tenants`, `users`, `patients`, `appointments`, `medical_records`, `finance_transactions`, `audit_events`.
3. Migration Supabase completa: `supabase/migrations/20260526190000_initial_saas_foundation.sql`, com RLS e tabelas SaaS.

O problema e que a aplicacao usa principalmente a camada 1. A camada 2 e criada se `DATABASE_URL` existir, mas as rotas seguem consultando `loadData()`/`saveData()`. A camada 3 e a melhor base para SaaS, mas esta desconectada do codigo.

### 2.4 Frontend

O frontend tem boa amplitude funcional, mas esta centrado em `src/App.tsx`, com muitos `useState`, props drilling e views por `switch`. Nao ha roteamento real, cache de servidor, query invalidation ou loading/error states padronizados. O bootstrap carrega praticamente todos os dados de uma vez. A UI e moderna, mas usa muitos cards grandes e cantos muito arredondados para um sistema operacional que precisa densidade e leitura rapida.

Verificacao executada:

| Comando | Resultado |
|---|---|
| `npm run lint` | Passou (`tsc --noEmit`). |
| `npm run build` | Passou. Aviso: chunk JS com 517.18 kB, recomendando code splitting. |

## 3. Inventario funcional por modulo

| Modulo | O que existe | Onde | Dados/tabelas | Endpoints | Status | Riscos | Recomendacao |
|---|---|---|---|---|---|---|---|
| Autenticacao | Login PIN, login email/JWT, refresh, MFA setup/verify, change password | `Login.tsx`, `server/routes/index.ts`, `phase1.ts`, `auth.ts`, `middleware.ts` | `users` JSON; tabela `users` planejada | `/api/auth/*`, `/api/v2/auth/*` | Parcial/quebrado no v2 | JWT nao aceito por `requireAuth`; PIN exposto; sessao em memoria | Unificar auth JWT/httpOnly ou Supabase Auth, remover PIN publico, rate limit, MFA por tenant. |
| Usuarios | Lista, cria, atualiza, deleta, convite simbolico | `server/users.ts`, `phase1.ts` | `users` JSON | `/api/v2/users*` | Parcial | Sem tenant, convite nao persiste convite real, sem politicas granulares | Criar membros por tenant, convites com expiracao, RBAC granular. |
| Clinicas/Tenants | Tipos e migration Supabase; helper `tenant.ts` | `tenant.ts`, migration Supabase | `tenants`, `tenant_members` planejadas | Nenhum CRUD runtime real | Inexistente no app | Vazamento total em multi-clinica | P0: migrar runtime para PostgreSQL com tenant obrigatorio. |
| Unidades | Nao ha unidade/sala estruturada | - | - | - | Inexistente | Agenda nao suporta multiunidade | Criar `locations`, `rooms`, relacionamento com profissionais/agenda. |
| Profissionais | Doctors com especialidade, dias, horario | `types.ts`, `Dashboard`, `Agenda`, schema DB | `doctors` JSON/SQL | sem CRUD dedicado; usados em bootstrap | Basico | Sem unidade, sala, agenda por servico, documentos, repasse | Criar CRUD, disponibilidade recorrente, ferias, sala/unidade. |
| Pacientes | Cadastro, edicao, busca, prontuario inicial, documentos v2 | `Patients.tsx`, `routes/index.ts`, `phase2.ts` | `patients`, `medicalRecords`, `patientDocuments` | `/api/patients`, `/api/v2/patients/:id/documents` | Funcional basico | Sem tenant, consentimento nao obrigatorio, CPF livre, documentos sem storage seguro | Completar perfil 360, consentimentos, documentos, responsaveis, convenio. |
| Agenda | Criar agendamento, conflito, status, calendario mensal, sugestoes, lista de espera/bloqueios v2 | `Agenda.tsx`, `App.tsx`, `routes/index.ts`, `phase2.ts` | `appointments`, `waitingList`, `scheduleBlocks` | `/api/appointments*`, `/api/suggestions`, `/api/v2/waiting-list*`, `/api/v2/schedule-blocks*` | Funcional basico | Bloqueios/lista nao integrados ao fluxo principal; sem recorrencia/salas/unidades | Integrar bloqueios no `isSlotAvailable`, semana/dia, confirmacoes automaticas e no-show. |
| Consultas | Status de atendimento e inicio de consulta | `Agenda.tsx`, `MedicalRecords.tsx` | `appointments`, `medicalRecords` | status + entries | Parcial | Vinculo por `patientName` em varios pontos, nao por `patientId` | Usar FK paciente/consulta, evento clinico e faturamento. |
| Prontuario | Metadados, evolucoes, prescricoes v2, templates v2 | `MedicalRecords.tsx`, `phase2.ts` | `medicalRecords`, `medicalTemplates` | `/api/medical-records*`, `/api/v2/prescriptions/generate` | Parcial | Sem auditoria de visualizacao, assinatura, versionamento, anexos integrados na UI | Criar prontuario clinico auditavel, templates por especialidade, anexos, exportacao. |
| Financeiro | Receitas de agenda, despesas manuais, confirmar pagamento, contas a pagar, DRE, gateway config, PIX simulado | `Financeiro.tsx`, `phase2.ts` | `financeTransactions`, `accountsPayable`, `paymentGatewayConfig` | `/api/finance/transactions`, `/api/v2/accounts-payable`, `/api/v2/dre`, `/api/v2/payment-gateway`, `/api/v2/payments/pix` | Parcial | Gateway simulado, config sensivel em JSON, sem conciliacao, parcelas, comissao | Criar ledger financeiro real, contas, recebiveis, parcelas, gateway, repasses. |
| Convenios/TISS | Guias TISS simples | `ExpansionModules.tsx`, `routes/index.ts` | `tissGuides` | `/api/tiss/guides*` | Basico | Sem cadastro de convenio, glosa real, tabela, XML/TISS | Modelar operadoras, contratos, autorizacoes, glosas, faturamento. |
| Marketing/Aquisicao | Campanhas simples, indicacoes | `ExpansionModules.tsx`, `routes/index.ts` | `marketingCampaigns`, `referrals` | `/api/marketing/campaigns*`, `/api/referrals*` | Minimo | Sem leads, origem, UTMs, ROI, ads | Construir modulo de aquisicao e jornada lead->receita. |
| CRM | Nao ha lead/pipeline/kanban/tarefas | - | - | - | Inexistente | Perde rastreabilidade comercial | Criar `leads`, `pipelines`, `stages`, `opportunities`, `tasks`, `interactions`. |
| Atendimento | WhatsApp inbox, conexoes, mensagens, WebSocket | `WhatsApp.tsx`, `routes/whatsapp.ts` | `whatsappConnections`, `whatsappConversations`, `whatsappMessages` | `/api/whatsapp/*` | Funcional WhatsApp | Sem tenant, sem paciente/lead automatico, sem SLA, sem Instagram/email | Unificar `conversations/messages` por canal e conectar a CRM/agenda. |
| RH | Usuarios internos apenas | `users.ts` | `users` | `/api/v2/users` | Inexistente como RH | Sem escala, ponto, cargos, metas | Criar `employees`, departamentos, jornadas, metas, performance e comissoes. |
| Compliance/LGPD | Consentimento v2 em audit events, referencias LGPD | `lgpd.ts`, `phase1.ts` | `auditEvents` | `/api/v2/lgpd/consent*` | Fragil | Consentimento nao e tabela, nao bloqueia operacao, sem DSAR/anonimizacao | Tabelas LGPD, logs sensiveis, exportacao, retencao, anonimizar. |
| Relatorios | Cards basicos e DRE v2 | `Dashboard.tsx`, `ExpansionModules.tsx`, `phase2.ts` | varios JSON | `/api/v2/dre`, `/api/v2/export/:entity` | Basico | Sem historico confiavel e sem funil | Criar camada analytics/eventos e dashboards por perfil. |
| Configuracoes | Algumas envs, gateway v2 | `.env.example`, `phase2.ts` | `paymentGatewayConfig` | `/api/v2/payment-gateway` | Minimo | Sem configuracao da clinica, unidade, horarios, permissoes | Criar Settings por tenant e telas administrativas. |
| Integracoes | WhatsApp, Gemini, export CSV/XLSX | `whatsapp-utils.ts`, `routes/index.ts`, `phase2.ts` | WhatsApp JSON | `/api/chat`, `/api/whatsapp/*`, export | Parcial | Sem Meta/Google Ads, GMB, email, gateway real | Criar integracoes com OAuth/webhooks/event bus. |
| IA | Chat assistente, sugestao de horarios, agentes configuraveis | `ChatAssistant.tsx`, `AgentsHub`, `/api/chat`, `/api/suggestions` | `serviceAgents` | `/api/chat`, `/api/suggestions`, `/api/agents*` | Parcial | Sem logs de custo, tenant, base de conhecimento real, HITL | Criar AI gateway, policies, logs, agentes especializados. |
| Logs/Seguranca | Audit events para muitas acoes | `helpers.ts` | `auditEvents` | `/api/audit` | Basico | Detalhes podem conter PII; sem IP/User-Agent padrao; sem logs de leitura | Estruturar auditoria imutavel com classificacao de sensibilidade. |

## 4. Fluxos ponta a ponta

| Fluxo | Estado atual | Lacuna principal |
|---|---|---|
| Aquisicao: campanha/canal -> lead -> atendimento -> agenda -> paciente -> consulta -> receita | Nao funciona de ponta a ponta. Ha campanhas e WhatsApp, mas nao ha lead, origem, UTM, oportunidade ou ROI. | Criar CRM e vincular mensagens/campanhas/agendamentos/receita. |
| Atendimento: mensagem -> conversa -> paciente/lead -> resposta -> tarefa -> agenda -> CRM | Parcial. WhatsApp recebe/envia e permite editar `leadName`, mas nao cria lead/paciente/agendamento/tarefa automaticamente. | Omnichannel + CRM + automacoes. |
| Agenda: disponibilidade -> agendamento -> confirmacao -> lembrete -> comparecimento -> prontuario -> financeiro | Parcial. Agendamento, status, prontuario e financeiro basico existem. Confirmacao/lembrete v2 existem por endpoint, nao automatizados. | Integrar lista de espera, bloqueios, confirmacao, no-show e faturamento real. |
| Financeiro: consulta -> cobranca -> pagamento -> comissao -> repasse -> relatorio | Parcial. Consulta gera receita estimada e pagamento manual/PIX simulado. | Gateway real, parcelas, comissoes, repasses, DRE contabil. |
| Compliance: cadastro -> consentimento -> prontuario -> acesso controlado -> auditoria -> exportacao/anonimizacao | Fragil. Consentimento v2 existe, mas nao bloqueia cadastro e prontuario nao loga leitura. | Consentimentos obrigatorios, logs de acesso, exportacao e anonimizar. |
| RH: colaborador -> funcao -> permissoes -> escala -> produtividade -> comissao -> relatorio | Nao existe. Usuarios/perfis existem apenas para acesso. | Modulo RH e metricas por colaborador. |

## 5. Matriz de funcionalidades

| Modulo | Funcao | Existe? | Funciona? | Incompleto? | Prioridade | Risco | Recomendacao |
|---|---|---|---|---|---|---|---|
| Multi-tenancy | Isolamento por clinica no runtime | Parcial planejado | Nao | Sim | P0 | Critico | Aplicar tenant obrigatorio em DB, auth e todas as queries. |
| Auth | Login PIN legado | Sim | Sim | Sim | P0 | Alto | Remover para producao ou esconder atras de ambiente dev. |
| Auth | Email/senha JWT | Sim | Parcial | Sim | P0 | Critico | Fazer `requireAuth` validar JWT e refresh; usar cookie httpOnly. |
| Auth | MFA | Sim | Parcial | Sim | P1 | Medio | Integrar UI sem `prompt`, recovery codes, politicas por tenant. |
| Usuarios | CRUD usuarios | Sim | Parcial | Sim | P0 | Alto | Vincular tenant, roles granulares e convite real. |
| Pacientes | CRUD basico | Sim | Sim | Sim | P0 | Alto | Migrar para PostgreSQL, consentimentos, validacoes e anexos. |
| Agenda | CRUD e status | Sim | Sim | Sim | P0 | Medio | Integrar bloqueios/lista, recorrencia, unidade/sala/procedimento. |
| Agenda | Confirmacao WhatsApp | Sim | Parcial | Sim | P1 | Medio | Job automatico, template, opt-in e logs. |
| Prontuario | Evolucao clinica | Sim | Sim | Sim | P0 | Alto | Auditoria de leitura, versionamento, anexos e assinatura. |
| Financeiro | Contas a receber da agenda | Sim | Parcial | Sim | P0 | Alto | Criar cobranca real, ledger, recebimentos e conciliacao. |
| Financeiro | Contas a pagar/DRE | Sim | Parcial | Sim | P1 | Medio | Expor no frontend principal e persistir em DB. |
| Financeiro | Gateway/PIX | Sim | Simulado | Sim | P1 | Alto | Integrar provedor real e guardar segredos criptografados. |
| CRM | Leads/pipeline/kanban | Nao | Nao | N/A | P0 | Critico | Criar nucleo comercial. |
| Aquisicao | Origem/UTM/campanha/ROI | Nao | Nao | N/A | P1 | Alto | Criar tracking da jornada. |
| Atendimento | WhatsApp | Sim | Parcial | Sim | P1 | Alto | Tenant, vinculo com lead/paciente, SLA e automacoes. |
| Omnichannel | Instagram/email/site chat | Nao | Nao | N/A | P2 | Medio | Criar modelo unificado por canal. |
| Convênios | TISS guia simples | Sim | Parcial | Sim | P2 | Medio | Operadoras, contratos, glosa, lote e XML. |
| Estoque | CRUD basico | Sim | Parcial | Sim | P2 | Medio | Movimentacoes, compras, fornecedores, centros de custo. |
| RH | Colaboradores/escalas/ponto | Nao | Nao | N/A | P2 | Medio | Modulo RH conectado a agenda/financeiro. |
| LGPD | Consentimentos | Sim | Fragil | Sim | P0 | Critico | Tabela propria, obrigatoriedade, DSAR, retencao. |
| Auditoria | Log de acoes | Sim | Parcial | Sim | P0 | Alto | Incluir IP, user-agent, visualizacao de prontuario, imutabilidade. |
| IA | Chat assistente | Sim | Sim | Sim | P2 | Medio | Gateway por tenant, logs, limites, base de conhecimento. |
| Dashboards | Operacional basico | Sim | Sim | Sim | P1 | Medio | Dashboards executivo/comercial/financeiro/RH com dados reais. |

## 6. Diagnostico tecnico

### 6.1 Backend

O que esta bom:

- Rotas foram separadas por dominio/fase.
- Validacao Zod aparece em endpoints importantes.
- Ha auditoria basica em mutacoes.
- Ha backup automatico e endpoints de backup.
- Existe preparo para PostgreSQL e Supabase.

O que esta fragil:

- `server/database.ts` nao e usado pelas rotas principais.
- `server/middleware.ts` ignora JWT, apesar de `server/auth.ts` gerar tokens.
- `server/tenant.ts` nao e aplicado.
- `buildState()` retorna todos os arrays sem tenant, filtro, paginacao ou mascara de dados.
- Mutacoes usam IDs baseados em `Date.now()`, vulneraveis a colisao.
- Alguns endpoints v2 existem sem tela conectada no app principal.
- Falta middleware global de erro, rate limit, request id, logger estruturado e sanitizacao de logs.

Endpoints inseguros ou problemáticos:

| Endpoint | Problema | Correcao |
|---|---|---|
| `GET /api/auth/users` | Publica usuarios de login; facilita enumeracao. | Remover em producao ou retornar apenas fluxo dev. |
| `POST /api/auth/login` | Login por userId/PIN em texto simples. | Substituir por email/senha+MFA. |
| `GET /api/bootstrap` | Retorna tudo sem paginacao nem tenant. | Scope por tenant, permissao e paginacao. |
| `GET /api/v2/export/:entity` | Exporta entidades inteiras sem filtros/roles especificos. | Restringir por role, tenant, filtros e auditoria. |
| `POST /api/whatsapp/webhook` | Se segredo nao configurado, aceita payload publico. | Exigir segredo em producao. |
| `POST /api/v2/payment-gateway` | Persiste API keys em JSON. | Criptografar e usar secret manager. |

### 6.2 Frontend

O que esta bom:

- Navegacao ampla e coerente para MVP.
- Componentes ricos para agenda, WhatsApp, pacientes, prontuario e financeiro.
- Toasts foram introduzidos.
- Layout responsivo basico com sidebar mobile.

O que precisa melhorar:

- Trocar `switch` manual em `App.tsx` por React Router.
- Adotar React Query/TanStack Query para fetch/cache/loading/error/retry.
- Separar estado por dominio.
- Remover fallback de mocks em runtime de producao.
- Corrigir data fixa `2025-04-03`.
- Adicionar permission gates na UI por role/tenant.
- Usar tabelas densas, filtros, colunas configuraveis e estados vazios consistentes.
- Reduzir chunk inicial com code splitting por view.

### 6.3 Banco

Problemas atuais:

- Sem constraints reais no runtime JSON.
- Sem FK entre appointment e patient no tipo frontend; a consulta usa `patientName`.
- Sem tabelas de leads, oportunidades, tarefas, interacoes, consentimentos, anexos clinicos versionados, comissoes, repasses, unidades, salas e RH.
- Sem indices/paginacao.
- Sem criptografia de campos sensiveis.

Acertos planejados na migration Supabase:

- `tenant_id` em tabelas operacionais.
- RLS habilitado.
- `tenant_members`, `platform_owners`, `plans`, `subscriptions`, `usage_counters`.
- `whatsapp_*` com tenant.
- Auditoria com IP/User-Agent.

Gap: a migration Supabase nao inclui o CRM 360, omnichannel geral, RH, LGPD completo, pagamentos reais, comissoes e multiunidade.

## 7. Modelo ideal de banco de dados

Nucleo SaaS:

- `tenants`, `tenant_members`, `roles`, `permissions`, `role_permissions`, `user_sessions`, `mfa_factors`.
- `units`, `rooms`, `departments`, `settings`, `audit_events`, `notifications`.

Clinica:

- `patients`, `patient_contacts`, `patient_responsibles`, `patient_insurances`, `patient_documents`.
- `professionals`, `professional_units`, `professional_availability`, `schedule_blocks`, `rooms`.
- `appointments`, `appointment_status_events`, `waiting_list`, `checkins`, `no_show_events`.
- `medical_records`, `medical_record_entries`, `medical_record_versions`, `clinical_templates`, `prescriptions`, `certificates`, `exams`, `attachments`.

Comercial/aquisicao:

- `lead_sources`, `campaigns`, `ad_accounts`, `utm_events`, `conversion_events`.
- `leads`, `pipelines`, `pipeline_stages`, `opportunities`, `lead_interactions`, `lead_tasks`, `lost_reasons`, `lead_tags`.

Omnichannel:

- `channels`, `channel_connections`, `conversations`, `conversation_participants`, `messages`, `message_events`, `quick_replies`, `chatbot_flows`, `conversation_assignments`.

Financeiro:

- `service_catalog`, `price_tables`, `quotes`, `treatment_plans`.
- `receivables`, `payables`, `payments`, `payment_transactions`, `installments`, `invoices`, `cash_accounts`, `cost_centers`, `bank_reconciliation`.
- `professional_commissions`, `professional_payouts`, `dre_snapshots`.

Convenios:

- `insurance_providers`, `insurance_contracts`, `covered_procedures`, `authorizations`, `tiss_guides`, `claim_batches`, `claim_denials`, `claim_payments`.

RH:

- `employees`, `job_titles`, `employee_documents`, `work_shifts`, `time_records`, `vacations`, `training`, `performance_goals`, `performance_reviews`.

Compliance/LGPD:

- `consent_templates`, `patient_consents`, `data_subject_requests`, `privacy_events`, `retention_policies`, `access_reviews`, `sensitive_access_logs`.

IA:

- `ai_agents`, `ai_agent_versions`, `knowledge_sources`, `knowledge_chunks`, `ai_conversations`, `ai_actions`, `ai_usage`, `ai_safety_events`, `human_approvals`.

## 8. Arquitetura alvo

Backend recomendado:

- Manter Node se a equipe domina, mas organizar por dominios: `auth`, `tenants`, `patients`, `appointments`, `medical-records`, `finance`, `crm`, `omnichannel`, `compliance`, `ai`, `reports`.
- Criar camadas `routes -> controllers -> services -> repositories`.
- Todas as repositories recebem `tenantId` obrigatorio e nunca aceitam query sem tenant, exceto platform admin.
- Usar PostgreSQL como fonte de verdade; Supabase Auth/RLS pode ser usado se a arquitetura preferir BaaS.
- Criar outbox/event bus: eventos como `lead.created`, `message.received`, `appointment.confirmed`, `payment.paid`.
- Criar workers para lembretes, campanhas, follow-ups, backup, importacoes e webhooks.
- Criar observabilidade: logs estruturados, request id, metricas, tracing, alertas.

Frontend recomendado:

- React Router por modulo.
- TanStack Query para dados remotos.
- Design system com componentes de tabela, filtro, drawer, modal, kanban, calendario, timeline e formularios.
- Permissoes e feature flags no cliente apenas como UX; validacao sempre no backend.
- Dashboards por perfil: dono, gestor, recepcao, medico, financeiro, comercial.

Seguranca:

- JWT/cookie httpOnly ou Supabase Auth; refresh token rotativo.
- MFA TOTP com recovery codes.
- Rate limit, lockout, device/session management.
- Criptografia de segredos e dados sensiveis selecionados.
- Auditoria imutavel de prontuario e dados financeiros.
- Backups testados com restore automatizado.
- CSP habilitada gradualmente; CORS estrito.

## 9. Roadmap por fases

### Fase 1 - Base critica

Objetivo: tornar o produto minimamente seguro e vendavel como SaaS.

- Migrar persistencia do runtime para PostgreSQL.
- Escolher uma auth unica e corrigir `requireAuth` para JWT/Supabase.
- Aplicar tenant obrigatorio em todas as tabelas e queries.
- Implementar RBAC granular.
- Remover ou restringir PIN em producao.
- Criar auditoria sensivel de leitura/alteracao de prontuario.
- Criar rate limit, error handler, logger estruturado e request id.
- Criar backup/restore real do banco.

### Fase 2 - Nucleo operacional

- CRUD completo de pacientes, profissionais, unidades, salas, servicos.
- Agenda por profissional/unidade/sala/procedimento.
- Bloqueios, lista de espera, recorrencia e no-show.
- Prontuario com anexos, templates, assinatura e exportacao.
- Financeiro basico com contas a receber/pagar, caixa e DRE inicial.

### Fase 3 - Comercial e aquisicao

- Leads, pipeline, etapas, kanban, tarefas e follow-up.
- Fontes, campanhas, UTMs, conversoes e ROI.
- Integracao WhatsApp -> lead -> paciente -> agenda.
- Dashboard comercial com tempo de resposta, conversao, canal e atendente.

### Fase 4 - Administrativo e RH

- Colaboradores, cargos, departamentos, documentos.
- Escalas, folgas, ponto e produtividade.
- Comissoes e metas conectadas a agenda/financeiro/comercial.
- Estoque com movimentacoes, compras e fornecedores.

### Fase 5 - Compliance avancado

- Consentimentos versionados por tipo.
- DSAR: exportar, corrigir, anonimizar, excluir quando permitido.
- Retencao de dados e politicas por tenant.
- Console de auditoria com filtros e alertas.
- Revisao de acessos e logs sensiveis.

### Fase 6 - Inteligencia artificial

- AI gateway multi-tenant.
- Agentes comercial, atendimento, administrativo, financeiro, compliance e performance.
- Base de conhecimento por clinica.
- Limites/custos por tenant.
- Human-in-the-loop para acoes sensiveis.

### Fase 7 - Dashboards estrategicos

- Executivo: receita, CAC, ROI, ocupacao, inadimplencia, lucro, retencao.
- Comercial: funil, conversao, SLA, canais, atendentes.
- Operacional: agenda, atrasos, salas, fila, pendencias.
- Financeiro: fluxo, DRE, repasses, previsao.
- RH: produtividade, metas, carga, comissoes.

## 10. Backlog tecnico

### P0

| Tarefa | Descricao | Arquivos provaveis | Tabelas afetadas | Risco | Aceite | Dependencias |
|---|---|---|---|---|---|---|
| Unificar autenticacao | Fazer `requireAuth` validar JWT v2 ou migrar para Supabase Auth; retirar dependencia exclusiva do `sessions` Map | `server/middleware.ts`, `server/auth.ts`, `phase1.ts`, `src/api.ts`, `Login.tsx` | `users`, `sessions` | Critico | Login email funciona e acessa `/api/bootstrap`; refresh e logout funcionam | Definir estrategia auth |
| Migrar JSON para PostgreSQL | Repositories por modulo usando `query()` e transacoes | `server/data.ts`, `database.ts`, `routes/*` | todas | Critico | App roda sem `data/consultio-data.json` como fonte principal | Schema final |
| Tenant obrigatorio | Incluir tenant context em auth e em todas as queries | `tenant.ts`, `middleware.ts`, `routes/*` | todas com `tenant_id` | Critico | Teste prova que tenant A nao le/edita tenant B | Auth unificada |
| RBAC backend | Permissoes por acao, nao apenas 4 roles fixas | `middleware.ts`, novo modulo `rbac` | `roles`, `permissions` | Alto | Usuario sem permissao recebe 403 em APIs e exportacoes | Tenant |
| Auditoria sensivel | Logar view/edit/export de prontuario e financeiro | `lgpd.ts`, `MedicalRecords.tsx`, rotas prontuario | `audit_events`, `sensitive_access_logs` | Alto | Toda abertura de prontuario gera evento com IP/user-agent | Auth/tenant |
| Remover credenciais dev de producao | Desabilitar `GET /api/auth/users` e PINs fora de dev | `routes/index.ts`, `seed.ts`, `Login.tsx` | `users` | Alto | Ambiente prod nao mostra PIN nem lista usuarios | Config env |
| LGPD base | Consentimento obrigatorio e persistente em tabela | `lgpd.ts`, `Patients.tsx`, `routes/*` | `patient_consents` | Critico | Paciente novo exige consentimento de tratamento | PostgreSQL |

### P1

| Tarefa | Descricao | Arquivos provaveis | Tabelas afetadas | Risco | Aceite | Dependencias |
|---|---|---|---|---|---|---|
| Repositories/services | Separar rotas, regras e acesso a dados | `server/modules/*` | todas | Alto | Rotas finas, services testaveis | DB |
| Paginacao/filtros | Remover bootstrap gigante e listar por pagina | `routes/*`, `src/api.ts` | todas | Medio | Listas com page/limit/search e indice | DB |
| Agenda inteligente | Integrar bloqueios, lista de espera e confirmacoes | `Agenda.tsx`, `phase2.ts`, modulo agenda | `appointments`, `schedule_blocks`, `waiting_list` | Alto | Cancelamento oferece slot a lista; bloqueio impede agendamento | DB |
| CRM minimo | Leads, pipeline, tarefas e vinculo WhatsApp/agendamento | novo `crm` | `leads`, `pipeline_stages`, `lead_tasks` | Alto | Lead vira paciente/agendamento com rastreio | Tenant |
| Financeiro real | Ledger, contas a receber, pagamentos e DRE | `Financeiro.tsx`, modulo finance | `receivables`, `payments`, `payables` | Alto | Pagamento registrado gera evento e altera DRE | DB |
| Storage seguro | Mover uploads para storage com permissao | `phase2.ts`, storage service | `patient_documents` | Alto | Documento privado nao abre sem auth | Auth |
| Rate limit e logs | Proteger login, webhook e APIs sensiveis | `server.ts`, middleware | - | Alto | Brute force bloqueado, logs com request id | Auth |

### P2

| Tarefa | Descricao | Arquivos provaveis | Tabelas afetadas | Risco | Aceite | Dependencias |
|---|---|---|---|---|---|---|
| React Router + Query | Roteamento, cache, loading e retry | `src/App.tsx`, `src/router.tsx`, `src/api/*` | - | Medio | Views lazy loaded e dados por modulo | APIs paginadas |
| Dashboards reais | Executivo, comercial, operacional e financeiro | `Dashboard.tsx`, Reports | analytics views | Medio | KPIs calculados no backend | Eventos |
| Omnichannel | Modelo canal/conversa/mensagem generico | `WhatsApp.tsx`, novo `omnichannel` | `conversations`, `messages` | Medio | WhatsApp vira canal dentro de inbox unificada | CRM |
| RH basico | Colaboradores, cargos, escalas | novo modulo RH | `employees`, `work_shifts` | Medio | Escala influencia agenda/performance | Usuarios |
| Convenios | Operadoras, autorizacoes, glosas | TISS | `insurance_*`, `claim_*` | Medio | Guia TISS vinculada a consulta/convenio | Financeiro |
| Testes | Unit/integration/e2e | `tests/*` | - | Medio | Cobertura nos fluxos P0/P1 | Refactor |

### P3

| Tarefa | Descricao | Arquivos provaveis | Tabelas afetadas | Risco | Aceite | Dependencias |
|---|---|---|---|---|---|---|
| Portal do paciente | Agendamento, documentos e consentimentos externos | novo app/portal | pacientes/consents | Medio | Paciente acessa dados proprios | Auth externo |
| Telemedicina | Video e sala virtual | modulo telemedicina | appointments | Medio | Link por consulta | Agenda |
| White label | Logo, cores, dominio por tenant | settings/UI | `tenant_settings` | Baixo | Tenant customiza marca | Tenant |
| Onboarding | Setup guiado da clinica | frontend/admin | settings | Baixo | Clinica configura em fluxo inicial | Settings |

## 11. Backlog funcional 360

### Aquisicao

- Canais de aquisicao, campanhas, UTMs, landing pages, Meta Ads, Google Ads, Google Meu Negocio.
- Eventos de conversao: lead criado, primeira resposta, agendamento, comparecimento, pagamento, indicacao.
- ROI, CAC, CPL, CPA, receita por canal, taxa de conversao por canal.

### CRM

- Kanban com etapas configuraveis.
- Temperatura, status, responsavel, tags, interesse, valor estimado, motivo de perda.
- Tarefas e follow-up automatico.
- SLA de primeira resposta e produtividade por atendente.

### Atendimento omnichannel

- Inbox unificada: WhatsApp, Instagram, Messenger, site chat, email e GMB.
- Respostas rapidas, transferencia, etiquetas, chatbot e IA.
- Criacao automatica de lead/paciente/agendamento.

### Agenda inteligente

- Visao dia/semana/mes, unidade, profissional, sala e procedimento.
- Lista de espera, bloqueios, recorrencia, ferias, feriados, encaixes.
- Confirmacao e lembrete automatico, pre-consulta, check-in, pos-consulta e satisfacao.

### Pacientes/prontuario

- Perfil 360: dados pessoais, convenio, responsaveis, historico comercial, mensagens, financeiro e documentos.
- Anamnese, fichas personalizaveis, prescricoes, atestados, exames, imagens, anexos.
- Assinatura digital, logs de acesso, exportacao.

### Administrativo

- Unidades, salas, servicos, procedimentos, especialidades, fornecedores, contratos, documentos, estoque, compras, patrimonio, tarefas.

### Financeiro

- Receber/pagar, caixa, fluxo, parcelas, recorrencia, propostas, planos de tratamento, comissoes, repasses, glosas, notas, DRE, inadimplencia, cobranca, PIX, boleto, cartao.

### RH

- Colaboradores, cargos, departamentos, escalas, jornada, ponto, ferias, folgas, contratos, treinamentos, metas, produtividade e comissoes.

### Compliance

- Consentimentos, politicas, termos, auditoria, exportacao, anonimizar, backups, MFA, sessoes, alertas suspeitos e acessos sensiveis.

### IA

- Agente comercial, atendimento, administrativo, financeiro, compliance e performance.
- Base de conhecimento por tenant, logs, custos, limites e aprovacao humana.

## 12. UX/UI recomendada

- Menu lateral: agrupar em Operacao, Comercial, Atendimento, Financeiro, Gestao, Compliance e Configuracoes; mostrar tenant/unidade ativa e badges de pendencias.
- Dashboard: trocar banner grande por painel operacional denso; cards menores, graficos, filtros de periodo/unidade/profissional/canal.
- Tabelas: filtros salvos, ordenacao, paginacao, colunas configuraveis, acoes por linha e exportacao controlada.
- Kanban CRM: drag-and-drop, contagem e valor por etapa, SLA visual, motivo de perda e proxima tarefa.
- Agenda: visao semanal/dia com slots fixos, cores por profissional/status, bloqueios visiveis, fila e lista de espera lateral.
- Perfil do paciente: timeline unificada com consultas, mensagens, financeiro, documentos e consentimentos.
- Financeiro: separar recebiveis, pagaveis, caixa, DRE, cobrancas e repasses; usar filtros por competencia e centro de custo.
- Central de atendimento: inbox densa com fila, responsavel, canal, SLA, tags e contexto de lead/paciente.
- Alertas: central unica de pendencias, no-show, consentimento faltante, cobranca vencida e documento pendente.
- Tema/identidade: reduzir dependencia de azul como cor unica, usar tokens CSS por tenant, dark mode opcional.
- Acessibilidade: foco visivel, contraste, labels, mascaras de CPF/telefone/CEP, feedback de erro inline.

## 13. Plano de acao imediato

1. Decidir fonte de verdade: PostgreSQL/Supabase e nao JSON.
2. Unificar auth e corrigir JWT vs `sessions`.
3. Implementar tenant end-to-end antes de criar novas features comerciais.
4. Criar camada repository/service e testes para pacientes, agenda, prontuario e financeiro.
5. Criar CRM minimo conectado ao WhatsApp e agenda.
6. Formalizar LGPD: consentimentos, logs sensiveis e exportacao.
7. Evoluir dashboards depois que eventos e dados transacionais estiverem confiaveis.

## 14. Conclusao

O Consultio Med ja tem um bom esqueleto de produto e uma UI que comunica valor. A base atual serve para demonstracao e operacao de clinica unica com dados controlados. Para virar uma plataforma 360 vendavel, a prioridade nao deve ser adicionar mais telas, mas consolidar os fundamentos: banco transacional, tenant, autenticacao, permissoes, auditoria e eventos de negocio. Depois disso, CRM, omnichannel, financeiro real e dashboards passam a gerar o diferencial economico da plataforma: medir e melhorar a jornada completa Lead -> Atendimento -> Agendamento -> Comparecimento -> Procedimento -> Pagamento -> Retencao -> Indicacao.
