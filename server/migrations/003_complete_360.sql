-- Migration 003: Complete 360 Platform Schema
-- Adds CRM, Omnichannel, RH, Compliance, and missing tables

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- CRM MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_pipelines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  stages JSONB DEFAULT '[{"name":"Novo Lead","order":0,"probability":10},{"name":"Qualificado","order":1,"probability":30},{"name":"Proposta","order":2,"probability":60},{"name":"Fechado","order":3,"probability":100}]',
  is_default BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pipeline_id UUID REFERENCES crm_pipelines(id),
  full_name TEXT NOT NULL,
  email TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  normalized_phone TEXT DEFAULT '',
  source TEXT DEFAULT 'whatsapp',
  source_id TEXT,
  campaign_id TEXT,
  channel_conversation_id TEXT,
  rating TEXT DEFAULT 'morno',
  tags TEXT[] DEFAULT '{}',
  notes TEXT DEFAULT '',
  custom_fields JSONB DEFAULT '{}',
  assigned_to TEXT,
  converted_to_patient_id UUID REFERENCES patients(id),
  converted_at TIMESTAMPTZ,
  status TEXT DEFAULT 'new',
  estimated_value NUMERIC(12,2) DEFAULT 0,
  lost_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  pipeline_id UUID NOT NULL REFERENCES crm_pipelines(id),
  lead_id UUID REFERENCES crm_leads(id),
  patient_id UUID REFERENCES patients(id),
  stage TEXT DEFAULT 'lead_qualificado',
  stage_order INTEGER DEFAULT 0,
  title TEXT NOT NULL,
  value NUMERIC(12,2) DEFAULT 0,
  probability INTEGER DEFAULT 0,
  expected_close_date DATE,
  assigned_to TEXT,
  notes TEXT DEFAULT '',
  lost_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_interactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES crm_leads(id),
  opportunity_id UUID REFERENCES crm_opportunities(id),
  patient_id UUID REFERENCES patients(id),
  channel TEXT DEFAULT 'whatsapp',
  type TEXT NOT NULL DEFAULT 'message',
  summary TEXT NOT NULL,
  details JSONB DEFAULT '{}',
  performed_by TEXT,
  performed_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS crm_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  lead_id UUID REFERENCES crm_leads(id),
  opportunity_id UUID REFERENCES crm_opportunities(id),
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  due_date DATE,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- OMNICHANNEL MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  type TEXT NOT NULL CHECK (type IN ('whatsapp','instagram','messenger','site_chat','email','gmb')),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  config JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS omnichannel_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  channel_id UUID REFERENCES channels(id),
  contact_id TEXT NOT NULL,
  contact_name TEXT DEFAULT '',
  contact_phone TEXT DEFAULT '',
  normalized_phone TEXT DEFAULT '',
  lead_id UUID REFERENCES crm_leads(id),
  patient_id UUID REFERENCES patients(id),
  assigned_to TEXT,
  status TEXT DEFAULT 'active',
  unread_count INTEGER DEFAULT 0,
  last_message_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS omnichannel_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  conversation_id UUID NOT NULL REFERENCES omnichannel_conversations(id),
  from_me BOOLEAN NOT NULL DEFAULT FALSE,
  sender_id TEXT,
  sender_name TEXT DEFAULT '',
  body TEXT NOT NULL,
  type TEXT DEFAULT 'text',
  media_url TEXT,
  metadata JSONB DEFAULT '{}',
  status TEXT DEFAULT 'sent',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- FINANCEIRO COMPLETO
-- ============================================================

CREATE TABLE IF NOT EXISTS receivables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  appointment_id UUID REFERENCES appointments(id),
  patient_id UUID REFERENCES patients(id),
  description TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  due_date DATE NOT NULL,
  paid_at TIMESTAMPTZ,
  status TEXT DEFAULT 'pending',
  payment_method TEXT,
  installment_number INTEGER DEFAULT 1,
  total_installments INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payables (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  description TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  category TEXT DEFAULT 'Operacional',
  due_date DATE NOT NULL,
  status TEXT DEFAULT 'pending',
  paid_at TIMESTAMPTZ,
  recurring BOOLEAN DEFAULT FALSE,
  recurrence_interval TEXT,
  supplier TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  type TEXT DEFAULT 'checking',
  balance NUMERIC(12,2) DEFAULT 0,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- RH MODULE
-- ============================================================

CREATE TABLE IF NOT EXISTS employees (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  user_id UUID REFERENCES users(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT DEFAULT '',
  document TEXT,
  job_title TEXT,
  department TEXT,
  hire_date DATE,
  salary NUMERIC(12,2),
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS work_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID REFERENCES employees(id),
  day_of_week INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS time_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  employee_id UUID NOT NULL REFERENCES employees(id),
  clock_in TIMESTAMPTZ NOT NULL,
  clock_out TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- CONVENIOS / TISS
-- ============================================================

CREATE TABLE IF NOT EXISTS insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  code TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS insurance_contracts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  provider_id UUID NOT NULL REFERENCES insurance_providers(id),
  procedure_code TEXT NOT NULL,
  procedure_name TEXT NOT NULL,
  value NUMERIC(12,2) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PROFISSIONAIS / UNIDADES / SALAS
-- ============================================================

CREATE TABLE IF NOT EXISTS professional_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  address JSONB DEFAULT '{}',
  phone TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS professional_rooms (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  unit_id UUID NOT NULL REFERENCES professional_units(id),
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- PORTAL DO PACIENTE
-- ============================================================

CREATE TABLE IF NOT EXISTS patient_portal_logins (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  email TEXT NOT NULL,
  password_hash TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(tenant_id, email)
);

CREATE TABLE IF NOT EXISTS patient_portal_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  token TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- SATISFACAO / NPS
-- ============================================================

CREATE TABLE IF NOT EXISTS nps_surveys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  question TEXT NOT NULL DEFAULT 'Qual a chance de nos recomendar?',
  send_after_hours INTEGER DEFAULT 24,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS nps_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  survey_id UUID REFERENCES nps_surveys(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  appointment_id UUID REFERENCES appointments(id),
  score INTEGER NOT NULL CHECK (score BETWEEN 0 AND 10),
  comment TEXT,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUTOMACAO
-- ============================================================

CREATE TABLE IF NOT EXISTS automation_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  trigger_event TEXT NOT NULL,
  delay_minutes INTEGER DEFAULT 0,
  message_template TEXT NOT NULL,
  variables TEXT[] DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id),
  template_id UUID REFERENCES automation_templates(id),
  appointment_id UUID REFERENCES appointments(id),
  patient_id UUID NOT NULL REFERENCES patients(id),
  channel TEXT NOT NULL,
  destination TEXT NOT NULL,
  message TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  error TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- AUDITORIA MELHORADA
-- ============================================================

ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS ip_address TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS user_agent TEXT;
ALTER TABLE audit_events ADD COLUMN IF NOT EXISTS sensitivity TEXT DEFAULT 'normal';

-- ============================================================
-- INDICES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_crm_leads_tenant ON crm_leads(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_crm_leads_phone ON crm_leads(normalized_phone);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_tenant ON crm_opportunities(tenant_id, stage);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON crm_tasks(assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_omnichannel_conversations_tenant ON omnichannel_conversations(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_omnichannel_messages_conversation ON omnichannel_messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS idx_receivables_tenant ON receivables(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_payables_tenant ON payables(tenant_id, status, due_date);
CREATE INDEX IF NOT EXISTS idx_employees_tenant ON employees(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_nps_responses_patient ON nps_responses(patient_id);
CREATE INDEX IF NOT EXISTS idx_automation_reminders_status ON automation_reminders(status, scheduled_for);
