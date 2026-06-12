-- Complete operational modules for Consultio Med on Supabase.
-- Run after 20260526190000_initial_saas_foundation.sql.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  create type public.llm_provider as enum ('openai', 'gemini', 'anthropic', 'groq', 'local');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.neural_knowledge_status as enum ('draft', 'indexed', 'archived');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.agent_template_segment as enum ('saude', 'beleza', 'saude_e_beleza');
exception when duplicate_object then null;
end $$;

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.llm_provider_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  name text not null,
  provider public.llm_provider not null,
  model text not null,
  api_key_encrypted text,
  api_key_masked text,
  endpoint text,
  temperature numeric(4,2) not null default 0.35,
  max_tokens integer not null default 1200 check (max_tokens > 0),
  is_default boolean not null default false,
  is_active boolean not null default true,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.service_agents
  add column if not exists llm_provider_config_id uuid references public.llm_provider_configs(id) on delete set null,
  add column if not exists autonomous_actions jsonb not null default '[]'::jsonb,
  add column if not exists metadata jsonb not null default '{}'::jsonb;

create table if not exists public.agent_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment public.agent_template_segment not null,
  channel text not null default 'whatsapp',
  objective text not null,
  tone text not null,
  escalation_to text not null default 'Equipe humana',
  working_hours text not null default '24/7 com escalonamento humano',
  rules jsonb not null default '[]'::jsonb,
  knowledge_base jsonb not null default '[]'::jsonb,
  autonomous_actions jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.neural_knowledge (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  title text not null,
  category text not null default 'Geral',
  content text not null,
  source_type text not null default 'manual' check (source_type in ('manual', 'url', 'file')),
  source_url text,
  tags jsonb not null default '[]'::jsonb,
  status public.neural_knowledge_status not null default 'indexed',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.neural_knowledge_agents (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  knowledge_id uuid not null references public.neural_knowledge(id) on delete cascade,
  agent_id uuid not null references public.service_agents(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (knowledge_id, agent_id)
);

create table if not exists public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  audience text not null,
  channel text not null default 'whatsapp',
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'finished')),
  goal text not null default '',
  scheduled_date date,
  budget numeric(12,2) not null default 0,
  leads integer not null default 0 check (leads >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tiss_guides (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  patient_name text not null,
  operator text not null,
  procedure text not null,
  status text not null default 'draft' check (status in ('draft', 'authorized', 'submitted', 'glosa', 'paid')),
  value numeric(12,2) not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.inventory_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  category text not null default 'Insumos',
  quantity integer not null default 0 check (quantity >= 0),
  min_quantity integer not null default 0 check (min_quantity >= 0),
  unit text not null default 'unidades',
  expires_at date,
  supplier text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.referral_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null,
  referred_name text not null,
  status text not null default 'invited' check (status in ('invited', 'scheduled', 'converted', 'rewarded')),
  reward text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reference_materials (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  title text not null,
  category text not null default 'Geral',
  url text not null default '',
  summary text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.help_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  opened_by_user_id uuid references auth.users(id) on delete set null,
  title text not null,
  module text not null default 'Geral',
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'open' check (status in ('open', 'in_progress', 'resolved')),
  description text not null default '',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.patient_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  name text not null,
  type text not null default 'outro' check (type in ('exame', 'imagem', 'receita', 'atestado', 'contrato', 'outro')),
  url text not null,
  uploaded_by_user_id uuid references auth.users(id) on delete set null,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  uploaded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create table if not exists public.waiting_list (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  patient_name text not null,
  doctor_id uuid references public.doctors(id) on delete set null,
  preferred_date date,
  preferred_time time,
  procedure text not null default '',
  status text not null default 'waiting' check (status in ('waiting', 'notified', 'scheduled', 'cancelled')),
  notified_at timestamptz,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  doctor_id uuid not null references public.doctors(id) on delete cascade,
  date date not null,
  start_time time not null,
  end_time time not null,
  type text not null check (type in ('ferias', 'feriado', 'folga', 'outro')),
  reason text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  specialty text not null,
  template_type text not null check (template_type in ('evolucao', 'prescricao', 'atestado', 'exame')),
  content text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.accounts_payable (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  description text not null,
  value numeric(12,2) not null check (value > 0),
  category text not null default 'Operacional',
  due_date date not null,
  status text not null default 'pending' check (status in ('pending', 'paid', 'overdue')),
  paid_at timestamptz,
  recurring boolean not null default false,
  recurrence_interval text check (recurrence_interval is null or recurrence_interval in ('monthly', 'yearly')),
  supplier text,
  notes text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.payment_gateway_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  provider text not null check (provider in ('mercadopago', 'stripe', 'pix')),
  enabled boolean not null default false,
  api_key_encrypted text,
  webhook_secret_encrypted text,
  pix_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

alter table public.whatsapp_messages
  add column if not exists media_mime_type text,
  add column if not exists media_file_name text,
  add column if not exists media_size bigint,
  add column if not exists media_duration_seconds integer,
  add column if not exists thumbnail_url text;

create index if not exists idx_llm_provider_configs_tenant on public.llm_provider_configs(tenant_id, is_active);
create index if not exists idx_agent_templates_segment on public.agent_templates(segment, is_active, sort_order);
create index if not exists idx_neural_knowledge_tenant_status on public.neural_knowledge(tenant_id, status, updated_at desc);
create index if not exists idx_marketing_campaigns_tenant_status on public.marketing_campaigns(tenant_id, status);
create index if not exists idx_inventory_items_tenant_low_stock on public.inventory_items(tenant_id, quantity, min_quantity);
create index if not exists idx_patient_documents_patient on public.patient_documents(patient_id, uploaded_at desc);
create index if not exists idx_waiting_list_tenant_status on public.waiting_list(tenant_id, status, created_at desc);
create index if not exists idx_schedule_blocks_doctor_date on public.schedule_blocks(doctor_id, date);
create index if not exists idx_accounts_payable_due on public.accounts_payable(tenant_id, status, due_date);
create index if not exists idx_whatsapp_messages_media_type on public.whatsapp_messages(tenant_id, type) where type <> 'text';

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'llm_provider_configs','agent_templates','neural_knowledge','marketing_campaigns','tiss_guides',
    'inventory_items','referral_records','reference_materials','help_tickets','waiting_list',
    'schedule_blocks','medical_templates','accounts_payable','payment_gateway_configs'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.llm_provider_configs enable row level security;
alter table public.agent_templates enable row level security;
alter table public.neural_knowledge enable row level security;
alter table public.neural_knowledge_agents enable row level security;
alter table public.marketing_campaigns enable row level security;
alter table public.tiss_guides enable row level security;
alter table public.inventory_items enable row level security;
alter table public.referral_records enable row level security;
alter table public.reference_materials enable row level security;
alter table public.help_tickets enable row level security;
alter table public.patient_documents enable row level security;
alter table public.waiting_list enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.medical_templates enable row level security;
alter table public.accounts_payable enable row level security;
alter table public.payment_gateway_configs enable row level security;

create policy "tenant data read llms" on public.llm_provider_configs for select to authenticated using (private.is_platform_owner() or tenant_id is null or private.is_tenant_member(tenant_id));
create policy "tenant data write llms" on public.llm_provider_configs for all to authenticated using (private.is_platform_owner() or (tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]))) with check (private.is_platform_owner() or (tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[])));
create policy "authenticated read agent templates" on public.agent_templates for select to authenticated using (is_active or private.is_platform_owner());
create policy "platform owners manage agent templates" on public.agent_templates for all to authenticated using (private.is_platform_owner()) with check (private.is_platform_owner());

create policy "tenant data read neural" on public.neural_knowledge for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write neural" on public.neural_knowledge for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read neural agents" on public.neural_knowledge_agents for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write neural agents" on public.neural_knowledge_agents for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "tenant data read marketing" on public.marketing_campaigns for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write marketing" on public.marketing_campaigns for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read tiss" on public.tiss_guides for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write tiss" on public.tiss_guides for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read inventory" on public.inventory_items for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write inventory" on public.inventory_items for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read referrals" on public.referral_records for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write referrals" on public.referral_records for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read references" on public.reference_materials for select to authenticated using (private.is_platform_owner() or tenant_id is null or private.is_tenant_member(tenant_id));
create policy "tenant data write references" on public.reference_materials for all to authenticated using (private.is_platform_owner() or tenant_id is null or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or tenant_id is null or private.is_tenant_member(tenant_id));
create policy "tenant data read help" on public.help_tickets for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write help" on public.help_tickets for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read documents" on public.patient_documents for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write documents" on public.patient_documents for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read waiting list" on public.waiting_list for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write waiting list" on public.waiting_list for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read schedule blocks" on public.schedule_blocks for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write schedule blocks" on public.schedule_blocks for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read medical templates" on public.medical_templates for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write medical templates" on public.medical_templates for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read accounts payable" on public.accounts_payable for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write accounts payable" on public.accounts_payable for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read gateways" on public.payment_gateway_configs for select to authenticated using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin','finance']::public.tenant_member_role[]));
create policy "tenant data write gateways" on public.payment_gateway_configs for all to authenticated using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin','finance']::public.tenant_member_role[])) with check (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin','finance']::public.tenant_member_role[]));

insert into public.llm_provider_configs (name, provider, model, api_key_masked, temperature, max_tokens, is_default, is_active)
values ('Gemini Operacional', 'gemini', 'gemini-2.0-flash', 'Configurar GEMINI_API_KEY', 0.35, 1200, true, true)
on conflict do nothing;

insert into public.agent_templates (name, segment, channel, objective, tone, escalation_to, working_hours, rules, knowledge_base, autonomous_actions, sort_order)
values
('Triagem WhatsApp 24h','saude_e_beleza','whatsapp','Receber novos contatos, entender necessidade e qualificar prioridade.','Acolhedor, claro, seguro e profissional','Equipe humana','24/7 com escalonamento humano','["Nao diagnosticar","Escalonar urgencias","Validar identidade"]'::jsonb,'["Agenda","Servicos","Precos"]'::jsonb,'["validar telefone","classificar urgencia","abrir lead"]'::jsonb,10),
('Confirmacao de Agenda','saude_e_beleza','whatsapp','Confirmar consultas, remarcar horarios e reduzir faltas.','Acolhedor, claro, seguro e profissional','Recepcao','24/7 com escalonamento humano','["Validar identidade","Registrar alteracoes"]'::jsonb,'["Agenda","Politicas de remarcacao"]'::jsonb,'["confirmar consulta","remarcar","avisar recepcao"]'::jsonb,20),
('Pos-consulta Humanizado','saude','whatsapp','Enviar orientacoes gerais, coletar satisfacao e identificar duvidas.','Acolhedor, claro, seguro e profissional','Equipe clinica','24/7 com escalonamento humano','["Nao prescrever","Escalonar duvidas clinicas"]'::jsonb,'["Orientacoes gerais","Pesquisa NPS"]'::jsonb,'["enviar cuidado geral","coletar NPS","escalonar duvida"]'::jsonb,30),
('Orcamento Estetico','beleza','whatsapp','Qualificar interesse em procedimentos esteticos e acionar consultora.','Consultivo, breve e elegante','Consultora','Horario comercial','["Nao prometer resultado","Solicitar avaliacao"]'::jsonb,'["Procedimentos","Pacotes","Precos"]'::jsonb,'["coletar objetivo","sugerir avaliacao","abrir oportunidade"]'::jsonb,40),
('Neural Gestor Autonomo','saude_e_beleza','site','Monitorar agenda, mensagens, financeiro e oportunidades de automacao.','Objetivo, analitico e seguro','Gestor','24/7','["Nao executar acoes irreversiveis sem aprovacao"]'::jsonb,'["Agenda","Financeiro","Marketing","WhatsApp"]'::jsonb,'["analisar indicadores","criar tarefas","sugerir campanhas"]'::jsonb,50)
on conflict do nothing;
