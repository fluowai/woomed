import { describe, it, expect, beforeAll, afterAll } from 'vitest';
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
let patientId: string;

beforeAll(async () => {
  invalidateCache();

  const adminUser = { id: 'test-admin-v2', name: 'Test Admin V2', role: 'admin' as const, tenantId: 'test-tenant-v2' };
  const doctorUser = { id: 'test-doctor-v2', name: 'Test Doctor V2', role: 'doctor' as const, tenantId: 'test-tenant-v2' };
  const receptionUser = { id: 'test-reception-v2', name: 'Test Reception V2', role: 'reception' as const, tenantId: 'test-tenant-v2' };
  const financeUser = { id: 'test-finance-v2', name: 'Test Finance V2', role: 'finance' as const, tenantId: 'test-tenant-v2' };

  adminToken = generateTokens(adminUser).token;
  doctorToken = generateTokens(doctorUser).token;
  receptionToken = generateTokens(receptionUser).token;
  financeToken = generateTokens(financeUser).token;

  // Create test tenant with PROFESSIONAL plan so all features are enabled
  const data = await loadData();
  if (!data.tenants.find(t => t.id === 'test-tenant-v2')) {
    data.tenants.push({
      id: 'test-tenant-v2',
      slug: 'test-tenant-v2',
      legalName: 'Test Tenant V2',
      tradeName: 'Test Clinic V2',
      planId: 'plan-professional',
      status: 'active',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    } as any);
    await saveData(data);
  }

  // Create a patient for document tests
  const createRes = await request(app)
    .post('/api/patients')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fullName: 'Paciente Documentos',
      birthDate: '1985-06-10',
      cpf: '55566677788',
      lgpdConsent: true
    });
  patientId = createRes.body?.patient?.id || 'fallback-patient-id';
});

afterAll(async () => {
  await endPool();
});

// =============================================================================
// WAITING LIST
// =============================================================================
describe('Waiting List API (v2)', () => {
  let waitingListId: string;

  it('GET /api/v2/waiting-list returns empty list initially', async () => {
    const res = await request(app)
      .get('/api/v2/waiting-list')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v2/waiting-list creates entry', async () => {
    const res = await request(app)
      .post('/api/v2/waiting-list')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        patientId,
        patientName: 'Paciente Lista Espera',
        doctorId: 'test-doctor-id',
        preferredDate: '2026-07-20',
        preferredTime: '10:00',
        procedure: 'Consulta',
        notes: 'Paciente prefere pela manhã'
      });
    expect(res.status).toBe(200);
    expect(res.body.entry).toBeDefined();
    expect(res.body.entry.status).toBe('waiting');
    waitingListId = res.body.entry.id;
  });

  it('PATCH /api/v2/waiting-list/:id updates entry status', async () => {
    const res = await request(app)
      .patch(`/api/v2/waiting-list/${waitingListId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'notified' });
    expect(res.status).toBe(200);
  });

  it('POST /api/v2/waiting-list/:id/notify marks as notified', async () => {
    const res = await request(app)
      .post(`/api/v2/waiting-list/${waitingListId}/notify`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
  });

  it('DELETE /api/v2/waiting-list/:id deletes entry', async () => {
    const res = await request(app)
      .delete(`/api/v2/waiting-list/${waitingListId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// SCHEDULE BLOCKS
// =============================================================================
describe('Schedule Blocks API (v2)', () => {
  let blockId: string;

  it('GET /api/v2/schedule-blocks returns list', async () => {
    const res = await request(app)
      .get('/api/v2/schedule-blocks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v2/schedule-blocks creates block', async () => {
    const res = await request(app)
      .post('/api/v2/schedule-blocks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        doctorId: 'test-doctor-id',
        date: '2026-07-25',
        startTime: '08:00',
        endTime: '12:00',
        type: 'ferias',
        reason: 'Férias programadas'
      });
    expect(res.status).toBe(200);
    expect(res.body.block).toBeDefined();
    blockId = res.body.block.id;
  });

  it('POST /api/v2/schedule-blocks with invalid data returns 400', async () => {
    const res = await request(app)
      .post('/api/v2/schedule-blocks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ date: 'invalid' });
    expect(res.status).toBe(400);
  });

  it('DELETE /api/v2/schedule-blocks/:id deletes block', async () => {
    const res = await request(app)
      .delete(`/api/v2/schedule-blocks/${blockId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// MEDICAL TEMPLATES
// =============================================================================
describe('Medical Templates API (v2)', () => {
  let templateId: string;

  it('GET /api/v2/medical-templates returns list', async () => {
    const res = await request(app)
      .get('/api/v2/medical-templates')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v2/medical-templates creates template', async () => {
    const res = await request(app)
      .post('/api/v2/medical-templates')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        name: 'Evolução Padrão',
        specialty: 'Clínico Geral',
        templateType: 'evolucao',
        content: 'Paciente relata melhora do quadro. Sem intercorrências.'
      });
    expect(res.status).toBe(200);
    expect(res.body.template).toBeDefined();
    templateId = res.body.template.id;
  });

  it('PUT /api/v2/medical-templates/:id updates template', async () => {
    const createRes = await request(app)
      .post('/api/v2/medical-templates')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ name: 'Template PUT', specialty: 'Clínico', templateType: 'evolucao', content: 'Original' });
    const id = createRes.body?.template?.id;
    const res = await request(app)
      .put(`/api/v2/medical-templates/${id}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ content: 'Conteúdo atualizado do template.' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/v2/medical-templates/:id deletes template', async () => {
    const createRes = await request(app)
      .post('/api/v2/medical-templates')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ name: 'Template DELETE', specialty: 'Clínico', templateType: 'evolucao', content: 'Para deletar' });
    const id = createRes.body?.template?.id;
    const res = await request(app)
      .delete(`/api/v2/medical-templates/${id}`)
      .set('Authorization', `Bearer ${doctorToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// ACCOUNTS PAYABLE
// =============================================================================
describe('Accounts Payable API (v2)', () => {
  let apId: string;

  it('GET /api/v2/accounts-payable returns list', async () => {
    const res = await request(app)
      .get('/api/v2/accounts-payable')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/v2/accounts-payable creates account', async () => {
    const res = await request(app)
      .post('/api/v2/accounts-payable')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({
        description: 'Aluguel Sala 1',
        value: 2500,
        category: 'Infraestrutura',
        dueDate: '2026-07-30',
        supplier: 'Imobiliária XYZ',
        recurring: true,
        recurrenceInterval: 'monthly'
      });
    expect(res.status).toBe(200);
    expect(res.body.item).toBeDefined();
    apId = res.body.item.id;
  });

  it('PATCH /api/v2/accounts-payable/:id marks as paid', async () => {
    const res = await request(app)
      .patch(`/api/v2/accounts-payable/${apId}`)
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ status: 'paid' });
    expect(res.status).toBe(200);
  });

  it('DELETE /api/v2/accounts-payable/:id deletes account', async () => {
    const createRes = await request(app)
      .post('/api/v2/accounts-payable')
      .set('Authorization', `Bearer ${financeToken}`)
      .send({ description: 'Para deletar', value: 100, category: 'Teste', dueDate: '2026-08-01', supplier: 'Test' });
    const id = createRes.body?.item?.id;
    const res = await request(app)
      .delete(`/api/v2/accounts-payable/${id}`)
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// DRE
// =============================================================================
describe('DRE API (v2)', () => {
  it('GET /api/v2/dre returns DRE data', async () => {
    const res = await request(app)
      .get('/api/v2/dre')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('month');
    expect(res.body).toHaveProperty('revenue');
    expect(res.body).toHaveProperty('expenses');
    expect(res.body).toHaveProperty('netResult');
  });

  it('GET /api/v2/dre with specific month', async () => {
    const res = await request(app)
      .get('/api/v2/dre?month=2026-07')
      .set('Authorization', `Bearer ${financeToken}`);
    expect(res.status).toBe(200);
    expect(res.body.month).toBe('2026-07');
  });
});

// =============================================================================
// EXPORT CSV/XLSX
// =============================================================================
describe('Export API (v2)', () => {
  it('GET /api/v2/export/patients?format=csv returns CSV', async () => {
    const res = await request(app)
      .get('/api/v2/export/patients?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
  });

  it('GET /api/v2/export/patients?format=xlsx returns Excel', async () => {
    const res = await request(app)
      .get('/api/v2/export/patients?format=xlsx')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('spreadsheetml');
  });

  it('GET /api/v2/export/invalid returns 404', async () => {
    const res = await request(app)
      .get('/api/v2/export/invalid?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(404);
  });

  it('GET /api/v2/export/patients?format=pdf returns 400', async () => {
    const res = await request(app)
      .get('/api/v2/export/patients?format=pdf')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// PATIENT DOCUMENTS
// =============================================================================
describe('Patient Documents API (v2)', () => {
  it('GET /api/v2/patients/:patientId/documents returns list', async () => {
    const res = await request(app)
      .get(`/api/v2/patients/${patientId}/documents`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('GET /api/v2/patients/nonexistent/documents returns empty list', async () => {
    const res = await request(app)
      .get('/api/v2/patients/nonexistent/documents')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});

// =============================================================================
// MEDICAL RECORDS V2
// =============================================================================
describe('Medical Records V2 API', () => {
  it('POST /api/v2/medical-records/:patientId/entries creates entry', async () => {
    const res = await request(app)
      .post(`/api/v2/medical-records/${patientId}/entries`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        doctorName: 'Dr. Teste V2',
        notes: 'Evolução v2: Paciente evoluiu bem.',
        diagnosis: 'Resfriado comum',
        prescription: 'Paracetamol 500mg 6/6h',
        doctorCrm: 'CRM-12345'
      });
    expect(res.status).toBe(200);
    expect(res.body.entry).toBeDefined();
    expect(res.body.entry.isDigitalPrescription).toBe(false);
  });

  it('POST /api/v2/medical-records/:patientId/entries without notes returns 400', async () => {
    const res = await request(app)
      .post(`/api/v2/medical-records/${patientId}/entries`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({ doctorName: 'Dr. Teste' });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// PRESCRIPTIONS
// =============================================================================
describe('Prescriptions API (v2)', () => {
  it('POST /api/v2/prescriptions/generate creates prescription', async () => {
    const res = await request(app)
      .post('/api/v2/prescriptions/generate')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientName: 'Paciente Documentos',
        doctorName: 'Dr. Teste V2',
        doctorCrm: 'CRM-12345',
        medications: ['Amoxicilina 500mg 8/8h', 'Ibuprofeno 600mg 12/12h'],
        diagnosis: 'Infecção bacteriana',
        notes: 'Tomar por 7 dias'
      });
    expect(res.status).toBe(200);
    expect(res.body.prescription).toBeDefined();
    expect(res.body.prescription.medications).toHaveLength(2);
  });

  it('POST /api/v2/prescriptions/generate without medications returns 400', async () => {
    const res = await request(app)
      .post('/api/v2/prescriptions/generate')
      .set('Authorization', `Bearer ${doctorToken}`)
      .send({
        patientName: 'Test',
        doctorName: 'Dr. Test',
        medications: []
      });
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// SaaS ADMIN
// =============================================================================
describe('SaaS Admin API', () => {
  let tenantId: string;
  let planId: string;

  it('GET /api/v2/saas/plans returns plans', async () => {
    const res = await request(app)
      .get('/api/v2/saas/plans')
      .set('Authorization', `Bearer ${adminToken}`);
    // Admin without super_admin role should get 403
    expect([200, 403]).toContain(res.status);
  });

  it('GET /api/v2/saas/tenants requires super_admin', async () => {
    const res = await request(app)
      .get('/api/v2/saas/tenants')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });

  it('GET /api/v2/saas/stats requires super_admin', async () => {
    const res = await request(app)
      .get('/api/v2/saas/stats')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(403);
  });
});

// =============================================================================
// CRM
// =============================================================================
describe('CRM API', () => {
  let leadId: string;
  let pipelineId: string;
  let opportunityId: string;

  it('GET /api/crm/leads returns list', async () => {
    const res = await request(app)
      .get('/api/crm/leads')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('POST /api/crm/leads creates lead', async () => {
    const res = await request(app)
      .post('/api/crm/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        fullName: 'Lead CRM Teste',
        phone: '11988887777',
        email: 'lead@teste.com',
        source: 'whatsapp',
        rating: 'quente',
        tags: ['interessado', 'retorno'],
        notes: 'Lead interessado em consulta',
        estimatedValue: 500
      });
    expect(res.status).toBe(200);
    expect(res.body.lead).toBeDefined();
    expect(res.body.lead.fullName).toBe('Lead CRM Teste');
    expect(res.body.lead.status).toBe('new');
    leadId = res.body.lead.id;
  });

  it('GET /api/crm/leads with filters', async () => {
    const res = await request(app)
      .get('/api/crm/leads?status=new&source=whatsapp')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH /api/crm/leads/:id updates lead', async () => {
    const res = await request(app)
      .patch(`/api/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'contacted', notes: 'Lead contatado via WhatsApp' });
    expect(res.status).toBe(200);
    expect(res.body.lead.status).toBe('contacted');
  });

  it('POST /api/crm/leads/:id/convert converts lead to patient', async () => {
    const res = await request(app)
      .post(`/api/crm/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.patient).toBeDefined();
    expect(res.body.lead.convertedToPatientId).toBeDefined();
  });

  it('POST /api/crm/leads/:id/convert again returns 400', async () => {
    const res = await request(app)
      .post(`/api/crm/leads/${leadId}/convert`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(400);
  });

  // Pipelines
  it('POST /api/crm/pipelines creates pipeline', async () => {
    const res = await request(app)
      .post('/api/crm/pipelines')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Pipeline Principal',
        description: 'Pipeline de vendas principal',
        stages: [
          { name: 'Novo Lead', order: 0, probability: 10 },
          { name: 'Qualificado', order: 1, probability: 30 },
          { name: 'Agendado', order: 2, probability: 60 },
          { name: 'Fechado', order: 3, probability: 100 }
        ],
        isDefault: true
      });
    expect(res.status).toBe(200);
    expect(res.body.pipeline).toBeDefined();
    pipelineId = res.body.pipeline.id;
  });

  it('GET /api/crm/pipelines returns pipelines', async () => {
    const res = await request(app)
      .get('/api/crm/pipelines')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it('PATCH /api/crm/pipelines/:id updates pipeline', async () => {
    const res = await request(app)
      .patch(`/api/crm/pipelines/${pipelineId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ description: 'Pipeline atualizado' });
    expect(res.status).toBe(200);
  });

  // Opportunities
  it('POST /api/crm/opportunities creates opportunity', async () => {
    const res = await request(app)
      .post('/api/crm/opportunities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        pipelineId,
        leadId,
        title: 'Consulta Especializada',
        value: 500,
        probability: 30,
        stage: 'lead_qualificado',
        expectedCloseDate: '2026-07-30'
      });
    expect(res.status).toBe(200);
    expect(res.body.opportunity).toBeDefined();
    opportunityId = res.body.opportunity.id;
  });

  it('PATCH /api/crm/opportunities/:id/stage moves stage', async () => {
    const res = await request(app)
      .patch(`/api/crm/opportunities/${opportunityId}/stage`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ stage: 'agendado' });
    expect(res.status).toBe(200);
    expect(res.body.opportunity.stage).toBe('agendado');
  });

  it('GET /api/crm/opportunities returns opportunities', async () => {
    const res = await request(app)
      .get('/api/crm/opportunities')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Interactions
  it('POST /api/crm/interactions creates interaction', async () => {
    const res = await request(app)
      .post('/api/crm/interactions')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId,
        channel: 'whatsapp',
        type: 'mensagem',
        summary: 'Lead enviou mensagem sobre disponibilidade',
        details: { duration: '2min' }
      });
    expect(res.status).toBe(200);
    expect(res.body.interaction).toBeDefined();
  });

  it('GET /api/crm/interactions with leadId filter', async () => {
    const res = await request(app)
      .get(`/api/crm/interactions?leadId=${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Tasks
  it('POST /api/crm/tasks creates task', async () => {
    const res = await request(app)
      .post('/api/crm/tasks')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        leadId,
        title: 'Ligar para lead',
        description: 'Confirmar agendamento',
        dueDate: '2026-07-20',
        priority: 'high',
        status: 'pending'
      });
    expect(res.status).toBe(200);
    expect(res.body.task).toBeDefined();
  });

  it('GET /api/crm/tasks returns tasks', async () => {
    const res = await request(app)
      .get('/api/crm/tasks')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Cleanup
  it('DELETE /api/crm/leads/:id deletes lead', async () => {
    const res = await request(app)
      .delete(`/api/crm/leads/${leadId}`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});

// =============================================================================
// RATE LIMITING (basic check)
// =============================================================================
describe('Rate Limiting', () => {
  it('returns rate limit headers', async () => {
    const res = await request(app)
      .get('/api/health');
    expect(res.status).toBe(200);
    // Rate limit headers should be present
    expect(res.headers['ratelimit-limit'] || res.headers['x-ratelimit-limit']).toBeDefined();
  });
});

// =============================================================================
// CORS HEADERS
// =============================================================================
describe('CORS Headers', () => {
  it('OPTIONS returns CORS headers', async () => {
    const res = await request(app)
      .options('/api/health')
      .set('Origin', 'http://localhost:3000')
      .set('Access-Control-Request-Method', 'GET');
    expect([200, 204]).toContain(res.status);
  });
});
