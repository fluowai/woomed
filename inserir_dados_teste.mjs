import pg from 'pg';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const { Pool } = pg;

// Use as configurações do .env do sistema
const DATABASE_URL = 'postgresql://postgres.fmhmmayrlsgdmxabosou:XJfbFSNB2rXf73TO@aws-1-sa-east-1.pooler.supabase.com:6543/postgres';
const pool = new Pool({ connectionString: DATABASE_URL });

async function run() {
  try {
    console.log("Conectando ao banco de dados...");
    const client = await pool.connect();

    // 1. Criar um Tenant (Clínica)
    console.log("Criando tenant...");
    let tenantId = '00000000-0000-0000-0000-000000000001';
    const tenantExists = await client.query('SELECT id FROM tenants WHERE slug = $1', ['clinica-teste']);
    if (tenantExists.rows.length > 0) {
      tenantId = tenantExists.rows[0].id;
    } else {
      const res = await client.query(
        "INSERT INTO tenants (slug, legal_name, trade_name) VALUES ('clinica-teste', 'Clinica Teste LTDA', 'Clinica Teste') RETURNING id"
      );
      tenantId = res.rows[0].id;
    }

    // 2. Criar Gestor do Sistema (admin)
    console.log("Criando Gestor...");
    const adminEmail = 'gestor@clinica.com';
    const adminExists = await client.query('SELECT id FROM users WHERE email = $1', [adminEmail]);
    if (adminExists.rows.length === 0) {
      const passHash = bcrypt.hashSync('senha123', 10);
      await client.query(
        "INSERT INTO users (tenant_id, email, name, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 'admin', true)",
        [tenantId, adminEmail, 'Gestor da Clinica', passHash]
      );
      console.log(`Gestor criado: ${adminEmail} / senha123`);
    }

    // 3. Criar Enfermeiro (reception)
    console.log("Criando Enfermeiro...");
    const nurseEmail = 'enfermeiro@clinica.com';
    const nurseExists = await client.query('SELECT id FROM users WHERE email = $1', [nurseEmail]);
    if (nurseExists.rows.length === 0) {
      const passHash = bcrypt.hashSync('senha123', 10);
      await client.query(
        "INSERT INTO users (tenant_id, email, name, password_hash, role, is_active) VALUES ($1, $2, $3, $4, 'reception', true)",
        [tenantId, nurseEmail, 'Enfermeiro Teste', passHash]
      );
      console.log(`Enfermeiro criado: ${nurseEmail} / senha123`);
    }

    // 4. Criar Médico (doctor)
    console.log("Criando Médico...");
    const docEmail = 'medico@clinica.com';
    const docExists = await client.query('SELECT id FROM users WHERE email = $1', [docEmail]);
    let userId;
    if (docExists.rows.length === 0) {
      const passHash = bcrypt.hashSync('senha123', 10);
      const res = await client.query(
        "INSERT INTO users (tenant_id, email, name, password_hash, role, specialty, is_active) VALUES ($1, $2, $3, $4, 'doctor', 'Cardiologista', true) RETURNING id",
        [tenantId, docEmail, 'Dr. Médico Teste', passHash]
      );
      userId = res.rows[0].id;
      console.log(`Médico criado: ${docEmail} / senha123`);
    } else {
      userId = docExists.rows[0].id;
    }

    // Associar Médico na tabela doctors
    const docEntity = await client.query('SELECT id FROM doctors WHERE user_id = $1', [userId]);
    let doctorId;
    if (docEntity.rows.length === 0) {
      const res = await client.query(
        "INSERT INTO doctors (tenant_id, name, specialty, email, user_id) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [tenantId, 'Dr. Médico Teste', 'Cardiologista', docEmail, userId]
      );
      doctorId = res.rows[0].id;
    } else {
      doctorId = docEntity.rows[0].id;
    }

    // 5. Criar Paciente (paciente)
    console.log("Criando Paciente...");
    const cpf = '12345678900';
    const patExists = await client.query('SELECT id FROM patients WHERE cpf = $1', [cpf]);
    let patientId;
    if (patExists.rows.length === 0) {
      const res = await client.query(
        "INSERT INTO patients (tenant_id, full_name, birth_date, cpf, phone, email, lgpd_consent) VALUES ($1, $2, $3, $4, $5, $6, true) RETURNING id",
        [tenantId, 'Paciente Teste', '1990-01-01', cpf, '11999999999', 'paciente@teste.com']
      );
      patientId = res.rows[0].id;
      // Inserir Medical Record
      await client.query("INSERT INTO medical_records (tenant_id, patient_id) VALUES ($1, $2)", [tenantId, patientId]);
      console.log(`Paciente criado: Paciente Teste / CPF: ${cpf}`);
    } else {
      patientId = patExists.rows[0].id;
    }

    // 6. Testar Agendamento (appointment)
    console.log("Criando Agendamento...");
    const date = new Date().toISOString().split('T')[0];
    const aptExists = await client.query('SELECT id FROM appointments WHERE patient_id = $1 AND date = $2', [patientId, date]);
    if (aptExists.rows.length === 0) {
      await client.query(
        "INSERT INTO appointments (tenant_id, doctor_id, patient_id, date, time_start, time_end, patient_name, status) VALUES ($1, $2, $3, $4, '09:00', '09:30', $5, 'agendado')",
        [tenantId, doctorId, patientId, date, 'Paciente Teste']
      );
      console.log("Agendamento criado para hoje as 09:00!");
    }

    console.log("TUDO PRONTO! Pode testar fazendo login com as contas acima.");
    client.release();
  } catch (error) {
    console.error("Erro ao inserir dados:", error);
  } finally {
    await pool.end();
  }
}

run();
