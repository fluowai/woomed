-- Consultio Med SaaS foundation for Supabase.
-- Apply with Supabase SQL editor or CLI after creating the project.

create extension if not exists pgcrypto;
create extension if not exists citext;

create schema if not exists private;

create type public.platform_owner_role as enum ('super_admin', 'ops', 'support', 'billing');
create type public.tenant_status as enum ('trialing', 'active', 'past_due', 'suspended', 'cancelled');
create type public.tenant_member_role as enum ('owner', 'admin', 'doctor', 'reception', 'finance', 'support');
create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'cancelled');
create type public.ticket_status as enum ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed');
create type public.ticket_priority as enum ('low', 'medium', 'high', 'urgent');
create type public.whatsapp_connection_status as enum ('disconnected', 'connecting', 'qr', 'connected', 'error');
create type public.whatsapp_conversation_kind as enum ('direct', 'group');
create type public.whatsapp_message_type as enum ('text', 'image', 'audio', 'video', 'document', 'unknown');

create or replace function private.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table public.plans (
  id uuid primary key default gen_random_uuid(),
  code citext not null unique,
  name text not null,
  description text not null default '',
  price_cents integer not null default 0 check (price_cents >= 0),
  currency text not null default 'BRL',
  billing_interval text not null default 'month' check (billing_interval in ('month', 'year')),
  limits jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  slug citext not null unique,
  legal_name text not null,
  trade_name text not null,
  document text,
  owner_name text,
  owner_email citext,
  phone text,
  status public.tenant_status not null default 'trialing',
  plan_id uuid references public.plans(id) on delete set null,
  timezone text not null default 'America/Sao_Paulo',
  locale text not null default 'pt-BR',
  settings jsonb not null default '{}'::jsonb,
  trial_ends_at timestamptz,
  suspended_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.platform_owner_invites (
  id uuid primary key default gen_random_uuid(),
  email citext not null unique,
  role public.platform_owner_role not null default 'super_admin',
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.platform_owners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  role public.platform_owner_role not null default 'super_admin',
  display_name text not null,
  email citext not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email citext not null,
  role public.tenant_member_role not null default 'admin',
  invite_token uuid not null default gen_random_uuid(),
  invited_by uuid references auth.users(id) on delete set null,
  expires_at timestamptz,
  accepted_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, email)
);

create table public.tenant_members (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_member_role not null default 'admin',
  display_name text not null,
  email citext not null,
  phone text,
  is_active boolean not null default true,
  invited_at timestamptz,
  joined_at timestamptz default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null unique references public.tenants(id) on delete cascade,
  plan_id uuid references public.plans(id) on delete set null,
  status public.subscription_status not null default 'trialing',
  billing_provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_start timestamptz,
  current_period_end timestamptz,
  trial_ends_at timestamptz,
  cancel_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usage_counters (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  active_users integer not null default 0 check (active_users >= 0),
  whatsapp_connections integer not null default 0 check (whatsapp_connections >= 0),
  whatsapp_messages_sent integer not null default 0 check (whatsapp_messages_sent >= 0),
  ai_messages integer not null default 0 check (ai_messages >= 0),
  appointments_count integer not null default 0 check (appointments_count >= 0),
  storage_bytes bigint not null default 0 check (storage_bytes >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, period_start, period_end)
);

create table public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  opened_by_user_id uuid references auth.users(id) on delete set null,
  assigned_owner_id uuid references public.platform_owners(id) on delete set null,
  subject text not null,
  description text not null default '',
  category text not null default 'geral',
  status public.ticket_status not null default 'open',
  priority public.ticket_priority not null default 'medium',
  closed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.support_ticket_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_user_id uuid references auth.users(id) on delete set null,
  author_kind text not null check (author_kind in ('tenant_user', 'platform_owner', 'system')),
  body text not null,
  internal_note boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.platform_audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_user_id uuid references auth.users(id) on delete set null,
  actor_kind text not null default 'tenant_user' check (actor_kind in ('tenant_user', 'platform_owner', 'system')),
  action text not null,
  entity text not null,
  entity_id text not null,
  details jsonb not null default '{}'::jsonb,
  ip_address inet,
  user_agent text,
  created_at timestamptz not null default now()
);

create table public.patients (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  full_name text not null,
  birth_date date,
  cpf text,
  phone text,
  email citext,
  avatar_url text,
  address jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.doctors (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  specialty text not null default '',
  available_days text[] not null default '{}',
  working_hours jsonb not null default '{"start":"08:00","end":"18:00"}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid references public.patients(id) on delete set null,
  doctor_id uuid references public.doctors(id) on delete set null,
  patient_name text not null,
  date date not null,
  time_start time not null,
  time_end time not null,
  status text not null default 'agendado',
  type text not null default 'Consulta Particular',
  is_private boolean not null default true,
  observations text not null default '',
  arrival time,
  record_status text not null default 'pendente',
  payment_status text not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.medical_records (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  patient_id uuid not null references public.patients(id) on delete cascade,
  blood_type text not null default 'Desconhecido',
  gender text not null default 'Nao informado',
  allergies text[] not null default '{}',
  medications text[] not null default '{}',
  chronic_diseases text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, patient_id)
);

create table public.medical_record_entries (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  medical_record_id uuid not null references public.medical_records(id) on delete cascade,
  doctor_id uuid references public.doctors(id) on delete set null,
  doctor_name text not null,
  entry_date date not null default current_date,
  notes text not null,
  diagnosis text,
  prescription text,
  created_at timestamptz not null default now()
);

create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  appointment_id uuid references public.appointments(id) on delete set null,
  date date not null default current_date,
  description text not null,
  value numeric(12,2) not null,
  category text not null default 'Extra',
  type text not null check (type in ('receita', 'despesa')),
  status text not null default 'concluido',
  source text not null default 'manual',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_prices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  value numeric(12,2) not null default 0,
  category text not null default 'Procedimentos Clinicos',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.service_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  channel text not null default 'whatsapp',
  objective text not null,
  tone text not null default 'Profissional e acolhedor',
  status text not null default 'draft',
  escalation_to text not null default 'Recepcao',
  working_hours text not null default 'Seg-Sex 08:00-18:00',
  rules text[] not null default '{}',
  knowledge_base text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  phone_number text not null,
  normalized_phone text not null,
  provider text not null default 'whatsmeow',
  status public.whatsapp_connection_status not null default 'disconnected',
  device_jid text,
  profile_image_url text,
  qr_code text,
  last_sync_at timestamptz,
  error text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, normalized_phone)
);

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  jid text not null,
  kind public.whatsapp_conversation_kind not null,
  title text not null,
  lead_name text not null,
  push_name text,
  phone text,
  normalized_phone text,
  profile_image_url text,
  group_name text,
  participant_count integer,
  last_message_preview text not null default '',
  unread_count integer not null default 0,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, connection_id, jid)
);

create table public.whatsapp_participants (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  jid text not null,
  phone text,
  name text not null,
  push_name text,
  profile_image_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, conversation_id, jid)
);

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  connection_id uuid not null references public.whatsapp_connections(id) on delete cascade,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete cascade,
  message_id text not null,
  from_me boolean not null default false,
  sender_jid text not null,
  sender_phone text,
  sender_push_name text,
  sender_display_name text not null,
  body text not null default '',
  type public.whatsapp_message_type not null default 'text',
  media_url text,
  status text,
  message_timestamp timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  unique (tenant_id, connection_id, conversation_id, message_id)
);

create index idx_tenant_members_user on public.tenant_members(user_id) where is_active;
create index idx_tenants_status on public.tenants(status);
create index idx_support_tickets_tenant_status on public.support_tickets(tenant_id, status);
create index idx_patients_tenant_name on public.patients(tenant_id, full_name);
create index idx_appointments_tenant_date on public.appointments(tenant_id, date);
create index idx_whatsapp_conversations_tenant_updated on public.whatsapp_conversations(tenant_id, updated_at desc);
create index idx_whatsapp_messages_conversation_time on public.whatsapp_messages(conversation_id, message_timestamp);

create trigger plans_set_updated_at before update on public.plans for each row execute function private.set_updated_at();
create trigger tenants_set_updated_at before update on public.tenants for each row execute function private.set_updated_at();
create trigger platform_owners_set_updated_at before update on public.platform_owners for each row execute function private.set_updated_at();
create trigger tenant_members_set_updated_at before update on public.tenant_members for each row execute function private.set_updated_at();
create trigger subscriptions_set_updated_at before update on public.subscriptions for each row execute function private.set_updated_at();
create trigger usage_counters_set_updated_at before update on public.usage_counters for each row execute function private.set_updated_at();
create trigger support_tickets_set_updated_at before update on public.support_tickets for each row execute function private.set_updated_at();
create trigger patients_set_updated_at before update on public.patients for each row execute function private.set_updated_at();
create trigger doctors_set_updated_at before update on public.doctors for each row execute function private.set_updated_at();
create trigger appointments_set_updated_at before update on public.appointments for each row execute function private.set_updated_at();
create trigger medical_records_set_updated_at before update on public.medical_records for each row execute function private.set_updated_at();
create trigger finance_transactions_set_updated_at before update on public.finance_transactions for each row execute function private.set_updated_at();
create trigger service_prices_set_updated_at before update on public.service_prices for each row execute function private.set_updated_at();
create trigger service_agents_set_updated_at before update on public.service_agents for each row execute function private.set_updated_at();
create trigger whatsapp_connections_set_updated_at before update on public.whatsapp_connections for each row execute function private.set_updated_at();
create trigger whatsapp_conversations_set_updated_at before update on public.whatsapp_conversations for each row execute function private.set_updated_at();
create trigger whatsapp_participants_set_updated_at before update on public.whatsapp_participants for each row execute function private.set_updated_at();

create or replace function private.is_platform_owner()
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.platform_owners po
    where po.user_id = (select auth.uid())
      and po.is_active
  );
$$;

create or replace function private.is_tenant_member(check_tenant_id uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = check_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.is_active
  );
$$;

create or replace function private.has_tenant_role(check_tenant_id uuid, allowed_roles public.tenant_member_role[])
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.tenant_members tm
    where tm.tenant_id = check_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.is_active
      and tm.role = any(allowed_roles)
  );
$$;

create or replace function public.accept_platform_owner_invite()
returns public.platform_owners
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.platform_owner_invites;
  owner_row public.platform_owners;
  current_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado';
  end if;

  current_email := nullif((select auth.jwt() ->> 'email'), '');
  if current_email is null then
    raise exception 'Email do usuario nao encontrado no JWT';
  end if;

  select *
    into invite_row
  from public.platform_owner_invites
  where lower(email::text) = lower(current_email)
    and accepted_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if invite_row.id is null then
    raise exception 'Convite de dono nao encontrado ou expirado';
  end if;

  insert into public.platform_owners (user_id, role, display_name, email)
  values (
    (select auth.uid()),
    invite_row.role,
    coalesce(nullif((select auth.jwt() ->> 'name'), ''), current_email),
    current_email
  )
  on conflict (user_id) do update
    set role = excluded.role,
        display_name = excluded.display_name,
        email = excluded.email,
        is_active = true,
        updated_at = now()
  returning * into owner_row;

  update public.platform_owner_invites
  set accepted_at = now()
  where id = invite_row.id;

  return owner_row;
end;
$$;

create or replace function public.accept_tenant_invite(invite uuid)
returns public.tenant_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite_row public.tenant_invitations;
  member_row public.tenant_members;
  current_email text;
begin
  if (select auth.uid()) is null then
    raise exception 'Usuario nao autenticado';
  end if;

  current_email := nullif((select auth.jwt() ->> 'email'), '');
  if current_email is null then
    raise exception 'Email do usuario nao encontrado no JWT';
  end if;

  select *
    into invite_row
  from public.tenant_invitations
  where invite_token = invite
    and lower(email::text) = lower(current_email)
    and accepted_at is null
    and (expires_at is null or expires_at > now())
  limit 1;

  if invite_row.id is null then
    raise exception 'Convite de tenant nao encontrado ou expirado';
  end if;

  insert into public.tenant_members (tenant_id, user_id, role, display_name, email, invited_at, joined_at)
  values (
    invite_row.tenant_id,
    (select auth.uid()),
    invite_row.role,
    coalesce(nullif((select auth.jwt() ->> 'name'), ''), current_email),
    current_email,
    invite_row.created_at,
    now()
  )
  on conflict (tenant_id, user_id) do update
    set role = excluded.role,
        display_name = excluded.display_name,
        email = excluded.email,
        is_active = true,
        joined_at = now(),
        updated_at = now()
  returning * into member_row;

  update public.tenant_invitations
  set accepted_at = now()
  where id = invite_row.id;

  return member_row;
end;
$$;

grant usage on schema public to authenticated, service_role;
grant usage on schema private to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant all privileges on all tables in schema public to service_role;
grant execute on function private.is_platform_owner() to authenticated, service_role;
grant execute on function private.is_tenant_member(uuid) to authenticated, service_role;
grant execute on function private.has_tenant_role(uuid, public.tenant_member_role[]) to authenticated, service_role;
grant execute on function public.accept_platform_owner_invite() to authenticated, service_role;
grant execute on function public.accept_tenant_invite(uuid) to authenticated, service_role;

alter table public.plans enable row level security;
alter table public.tenants enable row level security;
alter table public.platform_owner_invites enable row level security;
alter table public.platform_owners enable row level security;
alter table public.tenant_invitations enable row level security;
alter table public.tenant_members enable row level security;
alter table public.subscriptions enable row level security;
alter table public.usage_counters enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_ticket_messages enable row level security;
alter table public.platform_audit_events enable row level security;
alter table public.patients enable row level security;
alter table public.doctors enable row level security;
alter table public.appointments enable row level security;
alter table public.medical_records enable row level security;
alter table public.medical_record_entries enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.service_prices enable row level security;
alter table public.service_agents enable row level security;
alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_participants enable row level security;
alter table public.whatsapp_messages enable row level security;

create policy "authenticated can read active plans"
on public.plans for select
to authenticated
using (is_active or private.is_platform_owner());

create policy "platform owners manage plans"
on public.plans for all
to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

create policy "tenant members read own tenant"
on public.tenants for select
to authenticated
using (private.is_platform_owner() or private.is_tenant_member(id));

create policy "platform owners manage tenants"
on public.tenants for all
to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

create policy "users read own platform owner record"
on public.platform_owners for select
to authenticated
using (private.is_platform_owner());

create policy "platform owners manage platform owners"
on public.platform_owners for all
to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

create policy "platform owners manage owner invites"
on public.platform_owner_invites for all
to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

create policy "invited owner can read own invite"
on public.platform_owner_invites for select
to authenticated
using (lower(email::text) = lower(nullif((select auth.jwt() ->> 'email'), '')));

create policy "tenant members read members"
on public.tenant_members for select
to authenticated
using (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "tenant admins manage members"
on public.tenant_members for all
to authenticated
using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]))
with check (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]));

create policy "tenant members read invitations"
on public.tenant_invitations for select
to authenticated
using (
  private.is_platform_owner()
  or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[])
  or lower(email::text) = lower(nullif((select auth.jwt() ->> 'email'), ''))
);

create policy "tenant admins manage invitations"
on public.tenant_invitations for all
to authenticated
using (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]))
with check (private.is_platform_owner() or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[]));

create policy "tenant members read subscriptions"
on public.subscriptions for select
to authenticated
using (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "platform owners manage subscriptions"
on public.subscriptions for all
to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

create policy "tenant members read usage"
on public.usage_counters for select
to authenticated
using (private.is_platform_owner() or private.is_tenant_member(tenant_id));

create policy "platform owners manage usage"
on public.usage_counters for all
to authenticated
using (private.is_platform_owner())
with check (private.is_platform_owner());

create policy "tenant support visibility"
on public.support_tickets for select
to authenticated
using (private.is_platform_owner() or (tenant_id is not null and private.is_tenant_member(tenant_id)));

create policy "tenant members create tickets"
on public.support_tickets for insert
to authenticated
with check (private.is_platform_owner() or (tenant_id is not null and private.is_tenant_member(tenant_id)));

create policy "support staff update tickets"
on public.support_tickets for update
to authenticated
using (private.is_platform_owner() or (tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[])))
with check (private.is_platform_owner() or (tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[])));

create policy "support messages visible"
on public.support_ticket_messages for select
to authenticated
using (
  private.is_platform_owner()
  or exists (
    select 1
    from public.support_tickets st
    where st.id = ticket_id
      and st.tenant_id is not null
      and private.is_tenant_member(st.tenant_id)
      and internal_note = false
  )
);

create policy "support messages insert"
on public.support_ticket_messages for insert
to authenticated
with check (
  private.is_platform_owner()
  or exists (
    select 1
    from public.support_tickets st
    where st.id = ticket_id
      and st.tenant_id is not null
      and private.is_tenant_member(st.tenant_id)
      and internal_note = false
  )
);

create policy "audit events visible"
on public.platform_audit_events for select
to authenticated
using (private.is_platform_owner() or (tenant_id is not null and private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_member_role[])));

create policy "audit events insert system"
on public.platform_audit_events for insert
to authenticated
with check (private.is_platform_owner() or (tenant_id is not null and private.is_tenant_member(tenant_id)));

create policy "tenant data read patients" on public.patients for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write patients" on public.patients for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read doctors" on public.doctors for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write doctors" on public.doctors for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read appointments" on public.appointments for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write appointments" on public.appointments for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read medical records" on public.medical_records for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write medical records" on public.medical_records for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read medical entries" on public.medical_record_entries for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write medical entries" on public.medical_record_entries for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read finance" on public.finance_transactions for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write finance" on public.finance_transactions for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read prices" on public.service_prices for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write prices" on public.service_prices for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read agents" on public.service_agents for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write agents" on public.service_agents for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read whatsapp connections" on public.whatsapp_connections for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write whatsapp connections" on public.whatsapp_connections for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read whatsapp conversations" on public.whatsapp_conversations for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write whatsapp conversations" on public.whatsapp_conversations for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read whatsapp participants" on public.whatsapp_participants for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write whatsapp participants" on public.whatsapp_participants for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data read whatsapp messages" on public.whatsapp_messages for select to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id));
create policy "tenant data write whatsapp messages" on public.whatsapp_messages for all to authenticated using (private.is_platform_owner() or private.is_tenant_member(tenant_id)) with check (private.is_platform_owner() or private.is_tenant_member(tenant_id));

insert into public.plans (code, name, description, price_cents, limits, features, sort_order)
values
  ('starter', 'Starter', 'Base para clinicas pequenas validarem operacao digital.', 9900, '{"users":3,"whatsapp_connections":1,"whatsapp_messages_month":1000,"ai_messages_month":300,"storage_gb":5}'::jsonb, '{"agenda":true,"patients":true,"whatsapp":true,"ai_assistant":true,"owner_support":"standard"}'::jsonb, 10),
  ('professional', 'Professional', 'Operacao completa para clinicas em crescimento.', 24900, '{"users":10,"whatsapp_connections":3,"whatsapp_messages_month":8000,"ai_messages_month":2000,"storage_gb":30}'::jsonb, '{"agenda":true,"patients":true,"whatsapp":true,"ai_assistant":true,"marketing":true,"finance":true,"owner_support":"priority"}'::jsonb, 20),
  ('enterprise', 'Enterprise', 'Plano sob medida para redes, franquias e operacoes multiunidade.', 0, '{"users":999,"whatsapp_connections":20,"whatsapp_messages_month":100000,"ai_messages_month":20000,"storage_gb":500}'::jsonb, '{"agenda":true,"patients":true,"whatsapp":true,"ai_assistant":true,"marketing":true,"finance":true,"custom_sla":true,"owner_support":"dedicated"}'::jsonb, 30)
on conflict (code) do update
set name = excluded.name,
    description = excluded.description,
    price_cents = excluded.price_cents,
    limits = excluded.limits,
    features = excluded.features,
    sort_order = excluded.sort_order,
    updated_at = now();

insert into public.platform_owner_invites (email, role)
values ('owner@consultio.local', 'super_admin')
on conflict (email) do nothing;
