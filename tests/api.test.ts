import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../server';
import { registerRoutes } from '../server/routes/index';

const app = createApp();
registerRoutes(app);

describe('API - Health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('timestamp');
  });
});

describe('API - Auth (legacy disabled)', () => {
  it('POST /api/auth/login returns 403', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ pin: '1234' });
    expect(res.status).toBe(403);
    expect(res.body.code).toBe('LEGACY_AUTH_DISABLED');
  });

  it('POST /api/auth/logout without token returns 401', async () => {
    const res = await request(app).post('/api/auth/logout');
    expect(res.status).toBe(401);
  });
});

describe('API - Bootstrap (unauthenticated)', () => {
  it('GET /api/bootstrap without token returns 401', async () => {
    const res = await request(app).get('/api/bootstrap');
    expect(res.status).toBe(401);
  });
});

describe('API - Patients (unauthenticated)', () => {
  it('GET /api/patients without token returns 401', async () => {
    const res = await request(app).get('/api/patients');
    expect(res.status).toBe(401);
  });

  it('POST /api/patients without token returns 401', async () => {
    const res = await request(app)
      .post('/api/patients')
      .send({ fullName: 'Test' });
    expect(res.status).toBe(401);
  });
});

describe('API - Doctors (unauthenticated)', () => {
  it('POST /api/doctors without token returns 401', async () => {
    const res = await request(app)
      .post('/api/doctors')
      .send({ name: 'Dr. Test', specialty: 'General' });
    expect(res.status).toBe(401);
  });
});

describe('API - Finance (unauthenticated)', () => {
  it('POST /api/finance/transactions without token returns 401', async () => {
    const res = await request(app)
      .post('/api/finance/transactions')
      .send({});
    expect(res.status).toBe(401);
  });
});

describe('API - Agents (unauthenticated)', () => {
  it('POST /api/agents without token returns 401', async () => {
    const res = await request(app)
      .post('/api/agents')
      .send({ name: 'Test Agent', channel: 'whatsapp' });
    expect(res.status).toBe(401);
  });
});

describe('API - 404 handling', () => {
  it('GET /api/nonexistent returns 404', async () => {
    const res = await request(app).get('/api/nonexistent');
    expect(res.status).toBe(404);
  });
});
