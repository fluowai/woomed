-- LGPD/Compliance module for Consultio Med on Supabase.
-- Run after 20260529185000_complete_operational_ai_whatsmeow.sql.

create extension if not exists pgcrypto;
create extension if not exists citext;

do $$
begin
  create type public.consent_type as enum ('treatment', 'marketing', 'image', 'data_sharing');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.dsr_status as enum ('pending', 'processing', 'completed', 'rejected');
exception when duplicate_object then null;
end $$;

do $$
begin
  create type public.dsr_type as enum ('access', 'rectification', 'deletion', 'portability', 'anonymization');
exception when duplicate_object then null;
end $$;

create table if not exists public.lgpd_consent_templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  consent_type public.consent_type not null,
  title text not null,
  description text not null,
  is_mandatory boolean not null default false,
  is_active boolean not null default true,
  version integer not null default 1,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lgpd_patient_consents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  consent_type public.consent_type not null,
  granted boolean not null default false,
  granted_at timestamptz,
  revoked_at timestamptz,
  consent_version integer not null default 1,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, patient_id, consent_type)
);

create table if not exists public.lgpd_data_subject_requests (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  request_type public.dsr_type not null,
  status public.dsr_status not null default 'pending',
  requested_by_user_id uuid references auth.users(id) on delete set null,
  description text,
  processed_at timestamptz,
  expires_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.lgpd_sensitive_access_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  accessed_by_user_id uuid not null references auth.users(id) on delete cascade,
  access_type text not null check (access_type in ('view', 'edit', 'export')),
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table if not exists public.lgpd_retention_policies (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  data_category text not null,
  retention_days integer not null check (retention_days > 0),
  auto_anonymize boolean not null default true,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, data_category)
);

create index if not exists idx_lgpd_consents_patient on public.lgpd_patient_consents(patient_id, consent_type);
create index if not exists idx_lgpd_dsr_patient on public.lgpd_data_subject_requests(patient_id, status);
create index if not exists idx_lgpd_access_logs_patient on public.lgpd_sensitive_access_logs(patient_id, created_at desc);

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'lgpd_consent_templates','lgpd_patient_consents','lgpd_data_subject_requests',
    'lgpd_sensitive_access_logs','lgpd_retention_policies'
  ]
  loop
    execute format('drop trigger if exists %I_set_updated_at on public.%I', table_name, table_name);
    execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()', table_name, table_name);
  end loop;
end $$;

alter table public.lgpd_consent_templates enable row level security;
alter table public.lgpd_patient_consents enable row level security;
alter table public.lgpd_data_subject_requests enable row level security;
alter table public.lgpd_sensitive_access_logs enable row level security;
alter table public.lgpd_retention_policies enable row level security;

create policy "tenant data read consent templates" on public.lgpd_consent_templates for select
  to authenticated using (private.is_platform_owner() or tenant_id is null or private.is_tenant_member(tenant_id));

create policy "tenant data write consent templates" on public.lgpd_consent_templates for all
  to authenticated using (private.is_platform_owner() or (tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[])))
  with check (private.is_platform_owner() or (tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[])));

create policy "tenant data read consents" on public.lgpd_patient_consents for select
  to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "tenant data write consents" on public.lgpd_patient_consents for all
  to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id))
  with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "tenant data read dsr" on public.lgpd_data_subject_requests for select
  to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "tenant data write dsr" on public.lgpd_data_subject_requests for all
  to authenticated using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]))
  with check (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]));

create policy "tenant data read access logs" on public.lgpd_sensitive_access_logs for select
  to authenticated using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]));

create policy "tenant data write access logs" on public.lgpd_sensitive_access_logs for insert
  to authenticated with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "tenant data read retention" on public.lgpd_retention_policies for select
  to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "tenant data write retention" on public.lgpd_retention_policies for all
  to authenticated using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]))
  with check (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]));
