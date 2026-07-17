-- Enable RLS on core tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE medical_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

-- Policy for users
CREATE POLICY tenant_isolation_users ON users 
  FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid OR tenant_id IS NULL);

-- Policy for patients
CREATE POLICY tenant_isolation_patients ON patients 
  FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy for doctors
CREATE POLICY tenant_isolation_doctors ON doctors 
  FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy for appointments
CREATE POLICY tenant_isolation_appointments ON appointments 
  FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy for medical_records
CREATE POLICY tenant_isolation_medical_records ON medical_records 
  FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Policy for finance_transactions
CREATE POLICY tenant_isolation_finance ON finance_transactions 
  FOR ALL 
  USING (tenant_id = current_setting('app.current_tenant_id', true)::uuid);

-- Note: No backend do Node.js, antes de executar queries para um usuário, 
-- o sistema deverá rodar: SET app.current_tenant_id = 'uuid-do-tenant';
