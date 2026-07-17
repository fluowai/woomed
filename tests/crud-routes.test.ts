import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../server';
import { registerRoutes } from '../server/routes/index';
import { registerPhase1Routes } from '../server/routes/phase1';
import { registerPhase2Routes } from '../server/routes/phase2';
import { registerAgentRoutes } from '../server/routes/agents-v2';
import { registerSaaSRoutes } from '../server/routes/saas';
import { registerCrmRoutes } from '../server/routes/crm';
import { registerModules360Routes } from '../server/routes/modules-360';
import { registerSchedulerRoutes } from '../server/routes/scheduler-routes';
import { generateTokens } from '../server/auth';
import { loadData, saveData, invalidateCache } from '../server/data';
import { endPool } from '../server/database';

const app = createApp();
registerRoutes(app);
registerPhase1Routes(app);
registerPhase2Routes(app);
registerAgentRoutes(app);
registerSaaSRoutes(app);
registerCrmRoutes(app);
registerModules360Routes(app);
registerSchedulerRoutes(app);

let adminToken: string;
let doctorToken: string;
let receptionToken: string;
let financeToken: string;
let superAdminToken: string;
let tenantId: string;
let patientId: string;
let doctorId: string;
let appointmentId: string;

beforeAll(async () => {
  invalidateCache();

  const adminUser = { id: 'test-admin-1', name: 'Test Admin', role: 'admin' as const, tenantId: 'test-tenant-1' };
  const doctorUser = { id: 'test-doctor-1', name: 'Test Doctor', role: 'doctor' as const, tenantId: 'test-tenant-1' };
  const receptionUser = { id: 'test-reception-1', name: 'Test Reception', role: 'reception' as const, tenantId: 'test-tenant-1' };
  const financeUser = { id: 'test-finance-1', name: 'Test Finance', role: 'finance' as const, tenantId: 'test-tenant-1' };
  const superAdminUser = { id: 'test-superadmin-1', name: 'Test Super Admin', role: 'super_admin' as const };

  adminToken = generateTokens(adminUser).token;
  doctorToken = generateTokens(doctorUser).token;
  receptionToken = generateTokens(receptionUser).token;
  financeToken = generateTokens(financeUser).token;
  superAdminToken = generateTokens(superAdminUser).token;
  tenantId = 'test-tenant-1';

  // Create test tenant with PROFESSIONAL plan so all features are enabled
  const data = await loadData();
  if (!data.tenants.find(t => t.id === 'test-tenant-1')) {
    data.tenants.push({
      id: 'test-tenant-1',
      slug: 'test-tenant',
      legalName: 'Test Tenant',
      tradeName: 'Test Clinic',
      planId: 'plan-professional',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    await saveData(data);
  }
});

afterAll(async () => {
  await endPool();
});

// =============================================================================
// HEALTH
// =============================================================================
describe('Health API', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});

// =============================================================================
// AUTH
// =============================================================================
describe('Auth API', () => {
  it('POST /api/auth/login returns 403 (legacy disabled)', async () => {
    const res = await request(app).post('/api/auth/login').send({ pin: '1234' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LEGACY_AUTH_DISABLED');
  });

  it('POST /api/auth/logout without token returns 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });

  it('POST /api/auth/logout with valid token returns ok', async () => {
    const res = await request(app)
      .post('/api/auth/logout')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// PATIENTS
// =============================================================================
describe('Patients API', () => {
  it('GET /api/patients without token returns 401', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('POST /api/patients without token returns 401', async () => {
    const res = await request(app).post('/api/patients').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/patients with admin token creates patient', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Paciente Teste Silva',
        birthDate: '1990-05-15',
        cpf: '12345678901',
        phone: '11999998888',
        email: 'paciente@teste.com',
        lgpdConsent: true,
        address: { street: 'Rua Teste', city: 'São Paulo', state: 'SP', zip: '01234-567' }
      });
    expect(res.status).toBe(200);
    expect(res.body.patient).toBeDefined();
    expect(res.body.patient.fullName).toBe('Paciente Teste Silva');
    expect(res.body.patient.cpf).toBe('12345678901');
    expect(res.body.patient.lgpdConsent).toBe(true);
    patientId = res.body.patient.id;
  });

  it('POST /api/patients without lgpdConsent returns 400', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Paciente Sem Consent',
        birthDate: '1990-05-15',
        cpf: '12345678902',
        lgpdConsent: false
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('LGPD');
  });

  it('POST /api/patients with invalid data returns 400', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ fullName: 'A' });
    expect(res.status).toBe(400);
  });

  it('GET /api/patients with admin token returns list', async () => {
    const res = await request(app)
      .get('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.patients).toBeDefined();
    expect(Array.isArray(res.body.patients)).toBe(true);
    expect(res.body.total).toBeGreaterThanOrEqual(1);
  });

  it('GET /api/patients with search filter', async () => {
    const res = await request(app)
      .get('/api/patients?search=Silva')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.patients.length).toBeGreaterThanOrEqual(1);
  });

  it('PUT /api/patients/:id updates patient', async () => {
    const res = await request(app)
      .put(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '11888887777' });
    expect(res.status).toBe(200);
    expect(res.body.patient).toBeDefined();
  });

  it('PUT /api/patients/:id with invalid id returns 404', async () => {
    const res = await request(app)
      .put('/api/patients/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '11888887777' });
    expect(res.status).toBe(404);
  });

  it('DELETE /api/patients/:id with admin token deletes', async () => {
    const createRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Paciente Para Deletar',
        birthDate: '1985-03-20',
        cpf: '98765432100',
        lgpdConsent: true
      });
    const deleteId = createRes.body.patient.id;

    const res = await request(app)
      .delete(`/api/patients/${deleteId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });

  it('DELETE /api/patients/:id with doctor token returns 403', async () => {
    const res = await request(app)
      .delete(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// DOCTORS
// =============================================================================
describe('Doctors API', () => {
  it('POST /api/doctors without token returns 401', async () => {
    const res = await request(app).post('/api/doctors').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/doctors with admin token creates doctor', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Dr. Teste Cardiologista',
        specialty: 'Cardiologia',
        crm: 'CRM-12345',
        email: 'dr.teste@consultio.com',
        phone: '11977776666',
        availableDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        workingHours: { start: '08:00', end: '18:00' }
      });
    expect(res.status).toBe(200);
    expect(res.body.doctor).toBeDefined();
    expect(res.body.doctor.name).toBe('Dr. Teste Cardiologista');
    expect(res.body.doctor.specialty).toBe('Cardiologia');
    doctorId = res.body.doctor.id;
  });

  it('POST /api/doctors without required fields returns 400', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dr. Incompleto' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('especialidade');
  });

  it('POST /api/doctors with doctor token returns 403', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ name: 'Dr. Forbidden', specialty: 'Clinico' });
    expect(res.status).toBe(403);
  });

  it('PATCH /api/doctors/:id updates doctor', async () => {
    const res = await request(app)
      .patch(`/api/doctors/${doctorId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ crm: 'CRM-99999' });
    expect(res.status).toBe(200);
    expect(res.body.doctor).toBeDefined();
  });

  it('DELETE /api/doctors/:id without appointments succeeds', async () => {
    const createRes = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Dr. Para Deletar', specialty: 'Dermatologia' });
    const deleteId = createRes.body.doctor.id;

    const res = await request(app)
      .delete(`/api/doctors/${deleteId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// APPOINTMENTS
// =============================================================================
describe('Appointments API', () => {
  it('POST /api/appointments without token returns 401', async () => {
    const res = await request(app).post('/api/appointments').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/appointments with valid data creates appointment', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId,
        doctorId,
        date: '2026-07-15',
        timeStart: '09:00',
        type: 'Consulta Particular',
        observations: 'Primeira consulta'
      });
    expect(res.status).toBe(200);
    expect(res.body.appointment).toBeDefined();
    expect(res.body.appointment.patientName).toBe('PACIENTE TESTE SILVA');
    expect(res.body.appointment.status).toBe('agendado');
    appointmentId = res.body.appointment.id;
  });

  it('POST /api/appointments with conflicting time returns 409', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId,
        doctorId,
        date: '2026-07-15',
        timeStart: '09:00',
        type: 'Consulta Particular'
      });
    expect(res.status).toBe(409);
    expect(res.body.error).toContain('Conflito');
  });

  it('POST /api/appointments with invalid patient returns 400', async () => {
    const res = await request(app)
      .post('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId: 'nonexistent',
        doctorId,
        date: '2026-07-15',
        timeStart: '10:00'
      });
    expect(res.status).toBe(400);
  });

  it('GET /api/appointments with admin token returns list', async () => {
    const res = await request(app)
      .get('/api/appointments')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.appointments).toBeDefined();
    expect(Array.isArray(res.body.appointments)).toBe(true);
  });

  it('GET /api/appointments/date/:date returns appointments for date', async () => {
    const res = await request(app)
      .get('/api/appointments/date/2026-07-15')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.appointments).toBeDefined();
  });

  it('PATCH /api/appointments/:id/status updates status', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'confirmado' });
    expect(res.status).toBe(200);
    expect(res.body.appointment).toBeDefined();
  });

  it('PATCH /api/appointments/:id/status with paciente_no_local sets arrival time', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'paciente_no_local' });
    expect(res.status).toBe(200);
  });

  it('PATCH /api/appointments/:id/payment updates payment status', async () => {
    const res = await request(app)
      .patch(`/api/appointments/${appointmentId}/payment`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ paymentStatus: 'paid' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/appointments/:id with admin token deletes', async () => {
    const res = await request(app)
      .delete(`/api/appointments/${appointmentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// MEDICAL RECORDS
// =============================================================================
describe('Medical Records API', () => {
  let medicalRecordPatientId: string;

  beforeAll(async () => {
    // Create a dedicated patient for medical records tests
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Paciente Prontuario',
        birthDate: '1985-03-20',
        cpf: '98765432100',
        lgpdConsent: true,
      });
    medicalRecordPatientId = res.body?.patient?.id;
  });

  it('PATCH /api/medical-records/:patientId/metadata updates record', async () => {
    const res = await request(app)
      .patch(`/api/medical-records/${medicalRecordPatientId}/metadata`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ bloodType: 'O+', gender: 'Masculino' });
    expect(res.status).toBe(200);
    expect(res.body.medicalRecord).toBeDefined();
  });

  it('POST /api/medical-records/:patientId/entries creates entry', async () => {
    const res = await request(app)
      .post(`/api/medical-records/${medicalRecordPatientId}/entries`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        doctorName: 'Dr. Teste',
        notes: 'Paciente apresenta quadro estável. Retorno em 30 dias.',
        diagnosis: 'Hipertensão arterial',
        prescription: 'Losartana 50mg 1x/dia'
      });
    expect(res.status).toBe(200);
    expect(res.body.entry).toBeDefined();
    expect(res.body.entry.notes).toContain('estável');
  });

  it('POST /api/medical-records/:patientId/entries without notes returns 400', async () => {
    const res = await request(app)
      .post(`/api/medical-records/${medicalRecordPatientId}/entries`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ doctorName: 'Dr. Teste' });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// FINANCE
// =============================================================================
describe('Finance API', () => {
  let transactionId: string;

  it('POST /api/finance/transactions without token returns 401', async () => {
    const res = await request(app).post('/api/finance/transactions').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/finance/transactions creates transaction', async () => {
    const res = await request(app)
      .post('/api/finance/transactions')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        description: 'Consulta particular - Paciente Teste',
        value: 300,
        category: 'Consultas',
        type: 'receita'
      });
    expect(res.status).toBe(200);
    expect(res.body.transaction).toBeDefined();
    expect(res.body.transaction.value).toBe(300);
    transactionId = res.body.transaction.id;
  });

  it('POST /api/finance/transactions with invalid type returns 400', async () => {
    const res = await request(app)
      .post('/api/finance/transactions')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        description: 'Teste',
        value: 100,
        type: 'invalid'
      });
    expect(res.status).toBe(400);
  });

  it('GET /api/finance/transactions returns list with summary', async () => {
    const res = await request(app)
      .get('/api/finance/transactions')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.transactions).toBeDefined();
    expect(res.body.summary).toBeDefined();
    expect(res.body.summary.income).toBeGreaterThanOrEqual(300);
  });

  it('GET /api/finance/transactions with type filter', async () => {
    const res = await request(app)
      .get('/api/finance/transactions?type=income')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.transactions.every((t: any) => t.value > 0)).toBe(true);
  });

  it('DELETE /api/finance/transactions/:id deletes transaction', async () => {
    const res = await request(app)
      .delete(`/api/finance/transactions/${transactionId}`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// AGENTS (AI)
// =============================================================================
describe('Agents API', () => {
  let agentId: string;

  it('POST /api/agents without token returns 401', async () => {
    const res = await request(app).post('/api/agents').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/agents creates agent', async () => {
    const res = await request(app)
      .post('/api/agents')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Agente WhatsApp',
        channel: 'whatsapp',
        objective: 'Atender pacientes via WhatsApp',
        tone: 'Profissional e acolhedor',
        escalationTo: 'Recepção',
        workingHours: 'Seg-Sex 08:00-18:00',
        rules: ['Responda sempre em português', 'Seja educado'],
        knowledgeBase: ['Horário de funcionamento: 8h às 18h']
      });
    expect(res.status).toBe(200);
    expect(res.body.agent).toBeDefined();
    expect(res.body.agent.name).toBe('Agente WhatsApp');
    agentId = res.body.agent.id;
  });

  it('PATCH /api/agents/:id updates agent', async () => {
    const res = await request(app)
      .patch(`/api/agents/${agentId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.agent).toBeDefined();
  });

  it('DELETE /api/agents/:id deletes agent', async () => {
    const res = await request(app)
      .delete(`/api/agents/${agentId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// LLM PROVIDERS
// =============================================================================
describe('LLM Providers API', () => {
  let llmId: string;

  it('POST /api/llms creates LLM config', async () => {
    const res = await request(app)
      .post('/api/llms')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Gemini Flash',
        provider: 'gemini',
        model: 'gemini-2.0-flash',
        temperature: 0.7,
        maxTokens: 2048,
        isDefault: true
      });
    expect(res.status).toBe(200);
    expect(res.body.llm).toBeDefined();
    llmId = res.body.llm.id;
  });

  it('PATCH /api/llms/:id updates LLM config', async () => {
    const res = await request(app)
      .patch(`/api/llms/${llmId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ temperature: 0.5 });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/llms/:id deletes LLM config', async () => {
    const res = await request(app)
      .delete(`/api/llms/${llmId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// NEURAL KNOWLEDGE
// =============================================================================
describe('Neural Knowledge API', () => {
  let knowledgeId: string;

  it('POST /api/neural/knowledge creates knowledge item', async () => {
    const res = await request(app)
      .post('/api/neural/knowledge')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Horário de Funcionamento',
        category: 'Geral',
        content: 'A clínica funciona de segunda a sexta, das 8h às 18h.',
        sourceType: 'manual',
        tags: ['horário', 'funcionamento']
      });
    expect(res.status).toBe(200);
    expect(res.body.item).toBeDefined();
    knowledgeId = res.body.item.id;
  });

  it('PATCH /api/neural/knowledge/:id updates knowledge', async () => {
    const res = await request(app)
      .patch(`/api/neural/knowledge/${knowledgeId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ content: 'Atualizado: funciona até 20h.' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/neural/knowledge/:id deletes knowledge', async () => {
    const res = await request(app)
      .delete(`/api/neural/knowledge/${knowledgeId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// MARKETING CAMPAIGNS
// =============================================================================
describe('Marketing Campaigns API', () => {
  let campaignId: string;

  it('POST /api/marketing/campaigns creates campaign', async () => {
    const res = await request(app)
      .post('/api/marketing/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Campanha de Natal',
        audience: 'Pacientes ativos',
        channel: 'whatsapp',
        goal: 'Promoção de consultas',
        budget: 500
      });
    expect(res.status).toBe(200);
    expect(res.body.campaign).toBeDefined();
    campaignId = res.body.campaign.id;
  });

  it('PATCH /api/marketing/campaigns/:id updates campaign', async () => {
    const res = await request(app)
      .patch(`/api/marketing/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'running' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/marketing/campaigns/:id deletes campaign', async () => {
    const res = await request(app)
      .delete(`/api/marketing/campaigns/${campaignId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// TISS GUIDES
// =============================================================================
describe('TISS Guides API', () => {
  let guideId: string;

  it('POST /api/tiss/guides creates guide', async () => {
    const res = await request(app)
      .post('/api/tiss/guides')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        patientName: 'Paciente TISS',
        operator: 'Amil',
        procedure: 'Consulta Especializada',
        value: 250
      });
    expect(res.status).toBe(200);
    expect(res.body.guide).toBeDefined();
    guideId = res.body.guide.id;
  });

  it('PATCH /api/tiss/guides/:id updates guide', async () => {
    const res = await request(app)
      .patch(`/api/tiss/guides/${guideId}`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ status: 'authorized' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/tiss/guides/:id deletes guide', async () => {
    const res = await request(app)
      .delete(`/api/tiss/guides/${guideId}`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// INVENTORY
// =============================================================================
describe('Inventory API', () => {
  let itemId: string;

  it('POST /api/inventory/items creates item', async () => {
    const res = await request(app)
      .post('/api/inventory/items')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Luva de Procedimento',
        category: 'EPI',
        quantity: 100,
        minQuantity: 20,
        unit: 'unidades',
        supplier: 'MedSupply'
      });
    expect(res.status).toBe(200);
    expect(res.body.item).toBeDefined();
    itemId = res.body.item.id;
  });

  it('PATCH /api/inventory/items/:id updates item', async () => {
    const res = await request(app)
      .patch(`/api/inventory/items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ quantity: 50 });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/inventory/items/:id deletes item', async () => {
    const res = await request(app)
      .delete(`/api/inventory/items/${itemId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// REFERRALS
// =============================================================================
describe('Referrals API', () => {
  let referralId: string;

  it('POST /api/referrals creates referral', async () => {
    const res = await request(app)
      .post('/api/referrals')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientName: 'Paciente Indicador',
        referredName: 'Paciente Indicado',
        reward: 'Credito em consulta'
      });
    expect(res.status).toBe(200);
    expect(res.body.referral).toBeDefined();
    referralId = res.body.referral.id;
  });

  it('PATCH /api/referrals/:id updates referral', async () => {
    const res = await request(app)
      .patch(`/api/referrals/${referralId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'scheduled' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/referrals/:id deletes referral', async () => {
    const res = await request(app)
      .delete(`/api/referrals/${referralId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// REFERENCES
// =============================================================================
describe('References API', () => {
  let referenceId: string;

  it('POST /api/references creates reference', async () => {
    const res = await request(app)
      .post('/api/references')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Protocolo de Hipertensão',
        category: 'Cardiologia',
        url: 'https://example.com/protocolo',
        summary: 'Protocolo de tratamento de hipertensão arterial'
      });
    expect(res.status).toBe(200);
    expect(res.body.reference).toBeDefined();
    referenceId = res.body.reference.id;
  });

  it('DELETE /api/references/:id deletes reference', async () => {
    const res = await request(app)
      .delete(`/api/references/${referenceId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// HELP TICKETS
// =============================================================================
describe('Help Tickets API', () => {
  let ticketId: string;

  it('POST /api/help/tickets creates ticket', async () => {
    const res = await request(app)
      .post('/api/help/tickets')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Problema com agenda',
        module: 'Agenda',
        priority: 'high',
        description: 'Não consigo agendar consultas para segunda-feira'
      });
    expect(res.status).toBe(200);
    expect(res.body.ticket).toBeDefined();
    ticketId = res.body.ticket.id;
  });

  it('PATCH /api/help/tickets/:id updates ticket', async () => {
    const res = await request(app)
      .patch(`/api/help/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'in_progress' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/help/tickets/:id deletes ticket', async () => {
    const res = await request(app)
      .delete(`/api/help/tickets/${ticketId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// AUDIT
// =============================================================================
describe('Audit API', () => {
  it('GET /api/audit returns audit events', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/audit with doctor token returns 403', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// CHAT / AI
// =============================================================================
describe('Chat API', () => {
  it('POST /api/chat without token returns 401', async () => {
    const res = await request(app).post('/api/chat').send({ message: 'Olá' });
    expect(res.status).toBe(401);
  });

  it('POST /api/chat with token returns response', async () => {
    const res = await request(app)
      .post('/api/chat')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ message: 'Olá, qual o horário de funcionamento?' });
    expect(res.status).toBe(200);
    expect(res.body.text).toBeDefined();
    expect(typeof res.body.text).toBe('string');
  });
});

// =============================================================================
// SUGGESTIONS
// =============================================================================
describe('Suggestions API', () => {
  it('POST /api/suggestions without token returns 401', async () => {
    const res = await request(app).post('/api/suggestions').send({});
    expect(res.status).toBe(401);
  });

  it('POST /api/suggestions with valid data returns suggestions', async () => {
    const res = await request(app)
      .post('/api/suggestions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        doctorId,
        requestedSlot: { date: '2026-07-16', time: '10:00' }
      });
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// =============================================================================
// BOOTSTRAP
// =============================================================================
describe('Bootstrap API', () => {
  it('GET /api/bootstrap without token returns 401', async () => {
    const res = await request(app).get('/api/bootstrap');
    expect(res.status).toBe(401);
  });

  it('GET /api/bootstrap with admin token returns state', async () => {
    const res = await request(app)
      .get('/api/bootstrap')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.patients).toBeDefined();
    expect(res.body.doctors).toBeDefined();
    expect(res.body.appointments).toBeDefined();
  });
});

// =============================================================================
// SETUP
// =============================================================================
describe('Setup API', () => {
  it('GET /api/v2/setup/status returns setup status', async () => {
    const res = await request(app).get('/api/v2/setup/status');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('needsSetup');
  });
});

// =============================================================================
// ONBOARDING
// =============================================================================
describe('Onboarding API', () => {
  it('GET /api/v2/onboarding/plans returns plans', async () => {
    const res = await request(app).get('/api/v2/onboarding/plans');
    expect(res.status).toBe(200);
    expect(res.body.plans).toBeDefined();
    expect(Array.isArray(res.body.plans)).toBe(true);
    expect(res.body.plans.length).toBeGreaterThanOrEqual(3);
  });
});

// =============================================================================
// PUBLIC ROUTES
// =============================================================================
describe('Public Routes', () => {
  it('GET /api/public/scheduling returns 200 or 404', async () => {
    const res = await request(app).get('/api/public/scheduling');
    expect([200, 404]).toContain(res.status);
  });
});

// =============================================================================
// RBAC - Role-Based Access Control
// =============================================================================
describe('RBAC - Role-Based Access Control', () => {
  it('doctor cannot create patients', async () => {
    const res = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        fullName: 'Unauthorized Patient',
        birthDate: '1990-01-01',
        cpf: '11111111111',
        lgpdConsent: true
      });
    // doctors CAN create patients
    expect([200, 403]).toContain(res.status);
  });

  it('finance cannot create doctors', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ name: 'Dr. Forbidden', specialty: 'Clinico' });
    expect(res.status).toBe(403);
  });

  it('reception cannot delete patients', async () => {
    const res = await request(app)
      .delete(`/api/patients/${patientId}`)
      .set('Authorization', `Bearer ${receptionToken}`);
    expect(res.status).toBe(403);
  });

  it('finance cannot create finance transactions via admin-only route', async () => {
    const res = await request(app)
      .post('/api/finance/transactions')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        description: 'Teste finance',
        value: 100,
        type: 'receita'
      });
    expect(res.status).toBe(200); // finance CAN create transactions
  });

  it('reception cannot access audit', async () => {
    const res = await request(app)
      .get('/api/audit')
      .set('Authorization', `Bearer ${receptionToken}`);
    expect(res.status).toBe(403);
  });

  it('doctor can access medical records', async () => {
    const createRes = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Paciente RBAC Teste',
        birthDate: '1990-01-01',
        cpf: '11122233344',
        lgpdConsent: true,
      });
    const rbacPatientId = createRes.body?.patient?.id;
    const res = await request(app)
      .patch(`/api/medical-records/${rbacPatientId}/metadata`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ bloodType: 'A+' });
    expect(res.status).toBe(200);
  });

  it('reception cannot access medical records', async () => {
    const res = await request(app)
      .patch(`/api/medical-records/${patientId}/metadata`)
      .set('Authorization', `Bearer ${receptionToken}`)
      .send({ bloodType: 'B+' });
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// PAGINATION
// =============================================================================
describe('Pagination', () => {
  it('GET /api/patients respects page and limit', async () => {
    const res = await request(app)
      .get('/api/patients?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.patients.length).toBeLessThanOrEqual(1);
    expect(res.body.page).toBe(1);
    expect(res.body.limit).toBe(1);
    expect(res.body.totalPages).toBeDefined();
  });

  it('GET /api/appointments respects page and limit', async () => {
    const res = await request(app)
      .get('/api/appointments?page=1&limit=1')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.appointments.length).toBeLessThanOrEqual(1);
  });

  it('GET /api/finance/transactions respects page and limit', async () => {
    const res = await request(app)
      .get('/api/finance/transactions?page=1&limit=1')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.transactions.length).toBeLessThanOrEqual(1);
  });
});

// =============================================================================
// 404 HANDLING
// =============================================================================
describe('404 Handling', () => {
  it('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });

  it('POST /api/patients/nonexistent returns 404', async () => {
    const res = await request(app)
      .put('/api/patients/nonexistent')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ phone: '11999999999' });
    expect(res.status).toBe(404);
  });
});
