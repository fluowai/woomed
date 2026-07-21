import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createApp, registerAllRoutes } from '../server';
import express from 'express';
import http from 'http';

let app: express.Express;
let server: http.Server;
const BASE_URL = 'http://localhost:0';

beforeAll(async () => {
  app = createApp();
  await registerAllRoutes(app);
  server = app.listen(0);
  const addr = server.address();
  if (typeof addr === 'object' && addr) {
    (globalThis as any).__TEST_PORT = addr.port;
  }
});

afterAll(() => {
  server?.close();
});

function baseUrl(): string {
  return `http://localhost:${(globalThis as any).__TEST_PORT}`;
}

describe('Health', () => {
  it('GET /api/health returns ok', async () => {
    const res = await fetch(`${baseUrl()}/api/health`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.uptime).toBeDefined();
  });
});

describe('Setup Status', () => {
  it('GET /api/v2/setup/status returns needsSetup', async () => {
    const res = await fetch(`${baseUrl()}/api/v2/setup/status`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.needsSetup).toBe('boolean');
  });
});

describe('Auth Security', () => {
  it('POST /api/v2/setup/reset requires auth', async () => {
    const res = await fetch(`${baseUrl()}/api/v2/setup/reset`, { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('POST /api/v2/setup/complete has rate limiting', async () => {
    const requests = Array.from({ length: 6 }, () =>
      fetch(`${baseUrl()}/api/v2/setup/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'test@test.com', password: 'Test123!' }),
      })
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    expect(statuses).toContain(429);
  });

  it('POST /api/auth/login is disabled', async () => {
    const res = await fetch(`${baseUrl()}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: '1234' }),
    });
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.code).toBe('LEGACY_AUTH_DISABLED');
  });
});

describe('Rate Limiting', () => {
  it('Public endpoints are rate limited', async () => {
    const requests = Array.from({ length: 32 }, () =>
      fetch(`${baseUrl()}/api/v2/public/doctors`)
    );
    const responses = await Promise.all(requests);
    const statuses = responses.map(r => r.status);
    expect(statuses).toContain(429);
  });
});

describe('CORS', () => {
  it('Rejects requests from unknown origins in production', async () => {
    const res = await fetch(`${baseUrl()}/api/health`, {
      headers: { Origin: 'https://evil.com' },
    });
    const accessControl = res.headers.get('access-control-allow-origin');
    expect(accessControl).not.toBe('https://evil.com');
  });
});

describe('Security Headers', () => {
  it('Has helmet security headers', async () => {
    const res = await fetch(`${baseUrl()}/api/health`);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
    expect(res.headers.get('strict-transport-security')).toBeDefined();
  });

  it('CSP does not allow unsafe-eval', async () => {
    const res = await fetch(`${baseUrl()}/api/health`);
    const csp = res.headers.get('content-security-policy') || '';
    expect(csp).not.toContain("'unsafe-eval'");
  });
});

describe('Patient Portal', () => {
  it('GET /api/v2/portal/profile requires token', async () => {
    const res = await fetch(`${baseUrl()}/api/v2/portal/profile`);
    expect(res.status).toBe(401);
  });
});
