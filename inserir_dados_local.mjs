import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const dataFile = path.join(process.cwd(), 'data', 'consultio-data.json');

function carregarDados() {
  try {
    if (fs.existsSync(dataFile)) {
      const raw = fs.readFileSync(dataFile, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn("Arquivo de dados não encontrado, gerando um novo...");
  }
  return {
    users: [], patients: [], doctors: [], appointments: [], medicalRecords: {}, tenants: []
  };
}

function salvarDados(data) {
  fs.mkdirSync(path.dirname(dataFile), { recursive: true });
  fs.writeFileSync(dataFile, JSON.stringify(data, null, 2));
}

function run() {
  console.log("Iniciando inserção no banco de dados local (JSON)...");
  const data = carregarDados();

  // 1. Criar um Tenant (Clínica)
  let tenantId = '00000000-0000-0000-0000-000000000001';
  if (!data.tenants) data.tenants = [];
  if (!data.tenants.find(t => t.id === tenantId)) {
    data.tenants.push({
      id: tenantId, slug: 'clinica-teste', legalName: 'Clínica Teste', tradeName: 'Clínica Teste'
    });
  }

  const passHash = bcrypt.hashSync('senha123', 10);

  // 2. Criar Gestor do Sistema (admin)
  const adminEmail = 'gestor@clinica.com';
  if (!data.users.find(u => u.email === adminEmail)) {
    data.users.push({
      id: crypto.randomUUID(), tenantId, email: adminEmail, name: 'Gestor da Clinica', passwordHash: passHash, role: 'admin', isActive: true
    });
    console.log(`Gestor criado: ${adminEmail} / senha123`);
  }

  // 3. Criar Enfermeiro (reception)
  const nurseEmail = 'enfermeiro@clinica.com';
  if (!data.users.find(u => u.email === nurseEmail)) {
    data.users.push({
      id: crypto.randomUUID(), tenantId, email: nurseEmail, name: 'Enfermeiro Teste', passwordHash: passHash, role: 'reception', isActive: true
    });
    console.log(`Enfermeiro criado: ${nurseEmail} / senha123`);
  }

  // 4. Criar Médico (doctor)
  const docEmail = 'medico@clinica.com';
  let userId;
  const docUser = data.users.find(u => u.email === docEmail);
  if (!docUser) {
    userId = crypto.randomUUID();
    data.users.push({
      id: userId, tenantId, email: docEmail, name: 'Dr. Médico Teste', passwordHash: passHash, role: 'doctor', specialty: 'Cardiologista', isActive: true
    });
    console.log(`Médico criado: ${docEmail} / senha123`);
  } else {
    userId = docUser.id;
  }

  let doctorId;
  const docProfile = data.doctors.find(d => d.userId === userId);
  if (!docProfile) {
    doctorId = crypto.randomUUID();
    data.doctors.push({
      id: doctorId, tenantId, name: 'Dr. Médico Teste', specialty: 'Cardiologista', email: docEmail, userId
    });
  } else {
    doctorId = docProfile.id;
  }

  // 5. Criar Paciente (paciente)
  const cpf = '12345678900';
  let patientId;
  const patProfile = data.patients.find(p => p.cpf === cpf);
  if (!patProfile) {
    patientId = crypto.randomUUID();
    data.patients.push({
      id: patientId, tenantId, fullName: 'Paciente Teste', birthDate: '1990-01-01', cpf, phone: '11999999999', email: 'paciente@teste.com', lgpdConsent: true
    });
    if (!data.medicalRecords) data.medicalRecords = {};
    data.medicalRecords[patientId] = { patientId, entries: [] };
    console.log(`Paciente criado: Paciente Teste / CPF: ${cpf}`);
  } else {
    patientId = patProfile.id;
  }

  // 6. Criar Agendamento
  const date = new Date().toISOString().split('T')[0];
  if (!data.appointments.find(a => a.patientId === patientId && a.date === date)) {
    data.appointments.push({
      id: crypto.randomUUID(), tenantId, doctorId, patientId, date, timeStart: '09:00', timeEnd: '09:30', patientName: 'Paciente Teste', status: 'agendado'
    });
    console.log("Agendamento criado para hoje às 09:00!");
  }

  salvarDados(data);
  console.log("TUDO PRONTO! O servidor agora vai usar os dados em JSON (banco local).");
}

run();
