-- Consultio Med 360: CRM, NPS, LGPD, Portal, Automação
-- Nova migração para funcionalidades 360 completas

-- ============================================================
-- NOVOS ENUMS
-- ============================================================
create type public.lead_status as enum ('new', 'contacted', 'qualified', 'proposal', 'negotiation', 'won', 'lost');
create type public.lead_source as enum ('whatsapp', 'instagram', 'facebook', 'site', 'google_ads', 'meta_ads', 'indicacao', 'email', 'telefone', 'presencial', 'outro');
create type public.lead_rating as enum ('frio', 'morno', 'quente');
create type public.opportunity_stage as enum ('lead_qualificado', 'agendamento_pendente', 'agendado', 'compareceu', 'proposta', 'fechado', 'perdido');
create type public.nps_score as smallint;
create type public.consent_type as enum ('tratamento_dados', 'comunicacao_whatsapp', 'comunicacao_email', 'comunicacao_sms', 'pesquisa_satisfacao', 'termo_servico', 'politica_privacidade');
create type public.consent_status as enum ('granted', 'revoked', 'expired');
create type public.dsar_status as enum ('pending', 'processing', 'completed', 'rejected');
create type public.dsar_type as enum ('export', 'rectification', 'anonymization', 'deletion', 'access');
create type public.reminder_channel as enum ('whatsapp', 'sms', 'email');
create type public.reminder_status as enum ('pending', 'sent', 'delivered', 'failed');
create type public.nps_response_status as enum ('pending', 'responded', 'cancelled');

-- ============================================================
-- CRM: LEADS
-- ============================================================
create table public.crm_lead_sources (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  channel public.lead_source not null default 'outro',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create table public.crm_pipelines (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text not null default '',
  stages jsonb not null default '[]'::jsonb,
  is_default boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.crm_leads (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pipeline_id uuid references public.crm_pipelines(id) on delete set null,
  full_name text not null,
  email citext,
  phone text not null,
  normalized_phone text,
  source public.lead_source not null default 'outro',
  source_id uuid references public.crm_lead_sources(id) on delete set null,
  campaign_id uuid references public.marketing_campaigns(id) on delete set null,
  channel_conversation_id uuid references public.whatsapp_conversations(id) on delete set null,
  rating public.lead_rating not null default 'morno',
  tags text[] not null default '{}',
  notes text,
  custom_fields jsonb not null default '{}'::jsonb,
  assigned_to uuid references auth.users(id) on delete set null,
  converted_to_patient_id uuid references public.patients(id) on delete set null,
  converted_at timestamptz,
  status public.lead_status not null default 'new',
  estimated_value numeric(12,2) default 0,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_leads_tenant_status on public.crm_leads(tenant_id, status);
create index idx_crm_leads_tenant_assigned on public.crm_leads(tenant_id, assigned_to);
create index idx_crm_leads_phone on public.crm_leads(tenant_id, normalized_phone);

-- ============================================================
-- CRM: OPPORTUNITIES (dentro do pipeline)
-- ============================================================
create table public.crm_opportunities (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  pipeline_id uuid not null references public.crm_pipelines(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  stage public.opportunity_stage not null default 'lead_qualificado',
  stage_order integer not null default 0,
  title text not null,
  value numeric(12,2) not null default 0,
  probability integer not null default 0 check (probability between 0 and 100),
  expected_close_date date,
  assigned_to uuid references auth.users(id) on delete set null,
  notes text,
  lost_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index idx_crm_opportunities_tenant_stage on public.crm_opportunities(tenant_id, stage);

-- ============================================================
-- CRM: INTERACTIONS
-- ============================================================
create table public.crm_interactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  patient_id uuid references public.patients(id) on delete set null,
  channel public.lead_source not null default 'outro',
  type text not null,
  summary text not null,
  details jsonb not null default '{}'::jsonb,
  performed_by uuid references auth.users(id) on delete set null,
  performed_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

-- ============================================================
-- CRM: TASKS
-- ============================================================
create table public.crm_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lead_id uuid references public.crm_leads(id) on delete cascade,
  opportunity_id uuid references public.crm_opportunities(id) on delete set null,
  title text not null,
  description text,
  due_date date,
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high', 'urgent')),
  status text not null default 'pending' check (status in ('pending', 'in_progress', 'completed', 'cancelled')),
  assigned_to uuid references auth.users(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- NPS / SATISFAÇÃO
-- ============================================================
create table public.nps_surveys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  question text not null default 'De 0 a 10, o quanto voce recomendaria nossa clinica para um amigo ou familiar?',
  send_after_hours integer not null default 24,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.nps_responses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  survey_id uuid not null references public.nps_surveys(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  score integer not null check (score >= 0 and score <= 10),
  category text not null check (category in ('detrator', 'neutro', 'promotor')),
  comment text,
  responded_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index idx_nps_responses_tenant_survey on public.nps_responses(tenant_id, survey_id);
create index idx_nps_responses_patient on public.nps_responses(tenant_id, patient_id);

-- ============================================================
-- AUTOMAÇÃO: LEMBRETES
-- ============================================================
create table public.automation_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  channel public.reminder_channel not null default 'whatsapp',
  trigger_event text not null check (trigger_event in ('appointment_confirmed', 'appointment_reminder', 'post_appointment', 'birthday', 'no_show', 'custom')),
  delay_minutes integer not null default 0,
  message_template text not null,
  variables jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.automation_reminders (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  template_id uuid references public.automation_templates(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  channel public.reminder_channel not null default 'whatsapp',
  destination text not null,
  message text not null,
  status public.reminder_status not null default 'pending',
  sent_at timestamptz,
  delivered_at timestamptz,
  error text,
  scheduled_for timestamptz not null,
  created_at timestamptz not null default now()
);

create index idx_automation_reminders_status on public.automation_reminders(tenant_id, status, scheduled_for);

-- ============================================================
-- PORTAL DO PACIENTE
-- ============================================================
create table public.patient_portal_tokens (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  token text not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.patient_portal_logins (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  email citext unique,
  password_hash text not null,
  is_active boolean not null default true,
  last_login_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.patient_satisfaction_ratings (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  rating integer not null check (rating >= 1 and rating <= 5),
  feedback text,
  created_at timestamptz not null default now()
);

-- ============================================================
-- LGPD COMPLETO
-- ============================================================
create table public.lgpd_consent_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  type public.consent_type not null,
  title text not null,
  description text not null,
  version integer not null default 1,
  is_required boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, type, version)
);

create table public.lgpd_patient_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  consent_template_id uuid not null references public.lgpd_consent_templates(id) on delete cascade,
  status public.consent_status not null default 'granted',
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  unique (patient_id, consent_template_id, status)
);

create index idx_lgpd_consents_patient on public.lgpd_patient_consents(tenant_id, patient_id);

create table public.lgpd_data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  type public.dsar_type not null,
  status public.dsar_status not null default 'pending',
  description text,
  request_data jsonb not null default '{}'::jsonb,
  response_data jsonb,
  processed_by uuid references auth.users(id) on delete set null,
  processed_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.lgpd_sensitive_access_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  actor_id uuid not null references auth.users(id) on delete cascade,
  actor_name text not null,
  access_type text not null check (access_type in ('view', 'edit', 'export')),
  entity_type text not null,
  entity_id text not null,
  reason text not null default '',
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create index idx_lgpd_access_logs_patient on public.lgpd_sensitive_access_logs(tenant_id, patient_id, created_at desc);

-- ============================================================
-- PERFIS AVANÇADOS DE PROFISSIONAIS
-- ============================================================
create table public.professional_units (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  address jsonb not null default '{}'::jsonb,
  phone text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.professional_rooms (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  unit_id uuid not null references public.professional_units(id) on delete cascade,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.doctors add column if not exists document text;
alter table public.doctors add column if not exists crm text;
alter table public.doctors add column if not exists email citext;
alter table public.doctors add column if not exists phone text;
alter table public.doctors add column if not exists unit_id uuid references public.professional_units(id) on delete set null;
alter table public.doctors add column if not exists is_active boolean not null default true;

-- ============================================================
-- NOVAS COLUNAS EM TABELAS EXISTENTES
-- ============================================================
alter table public.patients add column if not exists consent_version integer not null default 1;
alter table public.patients add column if not exists marketing_opt_in boolean not null default false;
alter table public.patients add column if not exists last_appointment_at timestamptz;
alter table public.patients add column if not exists total_appointments integer not null default 0;
alter table public.patients add column if not exists total_revenue numeric(12,2) not null default 0;
alter table public.patients add column if not exists tags text[] not null default '{}';

alter table public.appointments add column if not exists patient_id uuid references public.patients(id) on delete set null;
alter table public.appointments add column if not exists room_id uuid references public.professional_rooms(id) on delete set null;
alter table public.appointments add column if not exists unit_id uuid references public.professional_units(id) on delete set null;
alter table public.appointments add column if not exists confirmed_at timestamptz;
alter table public.appointments add column if not exists nps_survey_sent boolean not null default false;

-- ============================================================
-- CAMPANHAS DE MARKETING AVANÇADAS
-- ============================================================
create table public.marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  channel public.lead_source,
  type text not null default 'geral' check (type in ('geral', 'whatsapp', 'email', 'sms', 'meta_ads', 'google_ads')),
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'running', 'paused', 'finished', 'cancelled')),
  goal text,
  target_audience text,
  budget numeric(12,2) default 0,
  spent numeric(12,2) default 0,
  leads_generated integer not null default 0,
  conversions integer not null default 0,
  roi numeric(12,2) default 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================================
-- TRIGGERS updated_at
-- ============================================================
create trigger crm_lead_sources_set_updated_at before update on public.crm_lead_sources for each row execute function private.set_updated_at();
create trigger crm_pipelines_set_updated_at before update on public.crm_pipelines for each row execute function private.set_updated_at();
create trigger crm_leads_set_updated_at before update on public.crm_leads for each row execute function private.set_updated_at();
create trigger crm_opportunities_set_updated_at before update on public.crm_opportunities for each row execute function private.set_updated_at();
create trigger crm_tasks_set_updated_at before update on public.crm_tasks for each row execute function private.set_updated_at();
create trigger nps_surveys_set_updated_at before update on public.nps_surveys for each row execute function private.set_updated_at();
create trigger automation_templates_set_updated_at before update on public.automation_templates for each row execute function private.set_updated_at();
create trigger patient_portal_logins_set_updated_at before update on public.patient_portal_logins for each row execute function private.set_updated_at();
create trigger lgpd_data_subject_requests_set_updated_at before update on public.lgpd_data_subject_requests for each row execute function private.set_updated_at();
create trigger professional_units_set_updated_at before update on public.professional_units for each row execute function private.set_updated_at();
create trigger professional_rooms_set_updated_at before update on public.professional_rooms for each row execute function private.set_updated_at();
create trigger marketing_campaigns_set_updated_at before update on public.marketing_campaigns for each row execute function private.set_updated_at();

-- ============================================================
-- RLS
-- ============================================================
alter table public.crm_lead_sources enable row level security;
alter table public.crm_pipelines enable row level security;
alter table public.crm_leads enable row level security;
alter table public.crm_opportunities enable row level security;
alter table public.crm_interactions enable row level security;
alter table public.crm_tasks enable row level security;
alter table public.nps_surveys enable row level security;
alter table public.nps_responses enable row level security;
alter table public.automation_templates enable row level security;
alter table public.automation_reminders enable row level security;
alter table public.patient_portal_tokens enable row level security;
alter table public.patient_portal_logins enable row level security;
alter table public.patient_satisfaction_ratings enable row level security;
alter table public.lgpd_consent_templates enable row level security;
alter table public.lgpd_patient_consents enable row level security;
alter table public.lgpd_data_subject_requests enable row level security;
alter table public.lgpd_sensitive_access_logs enable row level security;
alter table public.professional_units enable row level security;
alter table public.professional_rooms enable row level security;
alter table public.marketing_campaigns enable row level security;

-- ============================================================
-- POLICIES RLS (tenant isolation)
-- ============================================================
create policy "tenant data read crm_lead_sources" on public.crm_lead_sources for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write crm_lead_sources" on public.crm_lead_sources for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read crm_pipelines" on public.crm_pipelines for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write crm_pipelines" on public.crm_pipelines for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read crm_leads" on public.crm_leads for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write crm_leads" on public.crm_leads for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read crm_opportunities" on public.crm_opportunities for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write crm_opportunities" on public.crm_opportunities for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read crm_interactions" on public.crm_interactions for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write crm_interactions" on public.crm_interactions for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read crm_tasks" on public.crm_tasks for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write crm_tasks" on public.crm_tasks for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read nps_surveys" on public.nps_surveys for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write nps_surveys" on public.nps_surveys for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read nps_responses" on public.nps_responses for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write nps_responses" on public.nps_responses for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read automation_templates" on public.automation_templates for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write automation_templates" on public.automation_templates for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read automation_reminders" on public.automation_reminders for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write automation_reminders" on public.automation_reminders for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read patient_portal_logins" on public.patient_portal_logins for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write patient_portal_logins" on public.patient_portal_logins for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read lgpd_consent_templates" on public.lgpd_consent_templates for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write lgpd_consent_templates" on public.lgpd_consent_templates for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read lgpd_patient_consents" on public.lgpd_patient_consents for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write lgpd_patient_consents" on public.lgpd_patient_consents for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read lgpd_data_subject_requests" on public.lgpd_data_subject_requests for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write lgpd_data_subject_requests" on public.lgpd_data_subject_requests for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read lgpd_access_logs" on public.lgpd_sensitive_access_logs for select to authenticated using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]));
create policy "tenant data write lgpd_access_logs" on public.lgpd_sensitive_access_logs for insert to authenticated with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read professional_units" on public.professional_units for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write professional_units" on public.professional_units for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read professional_rooms" on public.professional_rooms for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write professional_rooms" on public.professional_rooms for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read marketing_campaigns" on public.marketing_campaigns for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write marketing_campaigns" on public.marketing_campaigns for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
