-- Migracao: Adiciona suporte completo ao padrao TISS para Faturamento de Convenios
-- Substituicao do Sistema Konsist

ALTER TABLE tiss_guides 
  ADD COLUMN IF NOT EXISTS health_plan_number TEXT,
  ADD COLUMN IF NOT EXISTS operator_register_ans TEXT,
  ADD COLUMN IF NOT EXISTS tuss_code TEXT,
  ADD COLUMN IF NOT EXISTS cid10 TEXT,
  ADD COLUMN IF NOT EXISTS doctor_crm TEXT,
  ADD COLUMN IF NOT EXISTS doctor_cbo TEXT,
  ADD COLUMN IF NOT EXISTS guide_type TEXT DEFAULT 'consulta',
  ADD COLUMN IF NOT EXISTS authorization_code TEXT,
  ADD COLUMN IF NOT EXISTS issue_date DATE,
  ADD COLUMN IF NOT EXISTS glosa_value NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS glosa_reason TEXT,
  ADD COLUMN IF NOT EXISTS batch_id TEXT;

-- Cria um indice para buscas rapidas por Lote TISS
CREATE INDEX IF NOT EXISTS idx_tiss_guides_batch ON tiss_guides(batch_id);

-- Cria um indice para buscas por Carteirinha
CREATE INDEX IF NOT EXISTS idx_tiss_guides_health_plan ON tiss_guides(health_plan_number);
