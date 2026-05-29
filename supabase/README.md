# Supabase SaaS Foundation

Este diretório contém a fundação do banco SaaS do Consultio Med.

## O que a primeira migration cria

- Planos comerciais (`plans`)
- Clientes/clinicas (`tenants`)
- Usuários por cliente (`tenant_members`)
- Convites por cliente (`tenant_invitations`)
- Donos da plataforma (`platform_owners`)
- Convites para donos da plataforma (`platform_owner_invites`)
- Assinaturas (`subscriptions`)
- Uso mensal (`usage_counters`)
- Suporte centralizado (`support_tickets`, `support_ticket_messages`)
- Auditoria (`platform_audit_events`)
- Dados operacionais com `tenant_id`: pacientes, médicos, agenda, prontuários, financeiro, agentes e WhatsApp
- RLS em todas as tabelas públicas
- Funções seguras em `private` para validar dono da plataforma e membro de tenant
- Seed dos planos `starter`, `professional` e `enterprise`
- Convite bootstrap para `owner@consultio.local`

## Como aplicar no Supabase

Opção rápida pelo painel:

1. Abra o projeto no Supabase.
2. Vá em `SQL Editor`.
3. Cole o conteúdo de `supabase/migrations/20260526190000_initial_saas_foundation.sql`.
4. Antes de executar em produção, troque `owner@consultio.local` pelo email real do dono.
5. Execute a query.

Opção por CLI:

```bash
supabase link --project-ref SEU_PROJECT_REF
supabase db push
```

## Bootstrap do dono da plataforma

Depois de aplicar a migration:

1. Crie um usuário no Supabase Auth com o mesmo email do convite em `platform_owner_invites`.
2. Logue com esse usuário.
3. Execute a RPC `accept_platform_owner_invite`.

Exemplo no SQL Editor, usando o usuário autenticado pelo client/app:

```sql
select public.accept_platform_owner_invite();
```

A partir daí o usuário entra em `platform_owners` e passa a ter acesso ao painel dono do sistema.

## Próxima etapa de implementação

1. Trocar login local por Supabase Auth.
2. Criar seleção de tenant no bootstrap.
3. Reescrever APIs para consultar tabelas com `tenant_id`.
4. Criar painel `/owner` para donos da plataforma.
5. Migrar dados atuais do JSON para as tabelas Supabase.
6. Ligar WhatsApp real por tenant/conexão.

## Observações de segurança

No Supabase, as tabelas do schema `public` ficam expostas pela API. Por isso todas as tabelas desta migration já têm RLS habilitado. A `service_role` deve ficar apenas no backend/worker e nunca no frontend.
