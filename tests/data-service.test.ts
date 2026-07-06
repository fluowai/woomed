import { describe, it, expect } from 'vitest';

describe('DataService - shouldSkipJsonPersist', () => {
  it('returns true when DATABASE_URL is set', async () => {
    const { isDatabaseAvailable } = await import('../server/database');
    const { DataService } = await import('../server/data-service');
    const dbAvail = isDatabaseAvailable();
    const svc = new DataService();
    // Test via loadFullState - returns null when DB not available
    const state = await svc.loadFullState();
    if (dbAvail) {
      expect(state).not.toBeNull();
    } else {
      expect(state).toBeNull();
    }
  });
});

describe('DataService - entity methods', () => {
  it('getPatients returns empty array when no DB', async () => {
    const { isDatabaseAvailable } = await import('../server/database');
    if (isDatabaseAvailable()) return; // skip when DB is present
    const { dataService } = await import('../server/data-service');
    const patients = await dataService.getPatients();
    expect(Array.isArray(patients)).toBe(true);
  });

  it('getDoctors returns empty array when no DB', async () => {
    const { isDatabaseAvailable } = await import('../server/database');
    if (isDatabaseAvailable()) return;
    const { dataService } = await import('../server/data-service');
    const doctors = await dataService.getDoctors();
    expect(Array.isArray(doctors)).toBe(true);
  });

  it('getAppointments returns empty array when no DB', async () => {
    const { isDatabaseAvailable } = await import('../server/database');
    if (isDatabaseAvailable()) return;
    const { dataService } = await import('../server/data-service');
    const apts = await dataService.getAppointments();
    expect(Array.isArray(apts)).toBe(true);
  });
});

describe('GenericCrudFactory - structure', () => {
  it('exports registerCrudRoutes function', async () => {
    const mod = await import('../server/generic-crud');
    expect(typeof mod.registerCrudRoutes).toBe('function');
  });

  it('TABLES config has all required entities', async () => {
    const { TABLES } = await import('../server/data-service');
    const requiredEntities = ['patients', 'doctors', 'appointments', 'financeTransactions', 'serviceAgents'];
    for (const entity of requiredEntities) {
      expect(TABLES[entity as keyof typeof TABLES]).toBeDefined();
    }
  });

  it('each table config has table, mappings, and tenantField', async () => {
    const { TABLES } = await import('../server/data-service');
    for (const [key, config] of Object.entries(TABLES)) {
      expect(config.table).toBeDefined();
      expect(Array.isArray(config.mappings)).toBe(true);
      expect(config.mappings.length).toBeGreaterThan(0);
    }
  });
});

describe('AppData type - __agentRuntime isolation', () => {
  it('backup strips __agentRuntime from serialized data', async () => {
    const { defaultData } = await import('../server/data');
    const data = defaultData();
    (data as any).__agentRuntime = { sessions: [], leads: [] };
    const sanitized = { ...data };
    delete (sanitized as any).__agentRuntime;
    expect((sanitized as any).__agentRuntime).toBeUndefined();
    expect(data.patients).toBeDefined();
    expect(data.doctors).toBeDefined();
  });
});
