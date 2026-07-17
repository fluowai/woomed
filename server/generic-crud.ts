import { Express } from 'express';
import { AuthedRequest, requireAuth, requireRoles } from './middleware';
import { dataService, TABLES } from './data-service';
import type { PgTableConfig } from './supabase';
import type { UserRole } from '../src/types';

interface CrudOptions {
  tableConfig: PgTableConfig;
  entityName: string;
  roles?: string[];
  featureGuard?: string;
  limitGuard?: string;
  createSchema?: any;
  updateSchema?: any;
  searchFields?: string[];
  onCreated?: (req: AuthedRequest, created: any) => void;
  onUpdated?: (req: AuthedRequest, updated: any) => void;
  onDeleted?: (req: AuthedRequest, deleted: any) => void;
}

export function registerCrudRoutes(app: Express, prefix: string, opts: CrudOptions) {
  const {
    tableConfig, entityName, roles = ['admin'],
    searchFields = [],
    createSchema, updateSchema,
    onCreated, onUpdated, onDeleted
  } = opts;

  const authMiddleware = requireAuth;
  const guardRoles = requireRoles(...roles as UserRole[]);
  const idParam = ':id';

  app.get(`${prefix}`, authMiddleware, guardRoles, async (req: AuthedRequest, res) => {
    try {
      const items = await dataService.findAll(tableConfig, req.user?.tenantId, entityName);
      res.json({ [entityName]: items });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get(`${prefix}/:id`, authMiddleware, guardRoles, async (req: AuthedRequest, res) => {
    try {
      const { findById } = await import('./supabase');
      const item = await findById(tableConfig, req.params.id);
      if (!item) return res.status(404).json({ error: `${entityName} nao encontrado.` });
      res.json({ [entityName]: item });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post(`${prefix}`, authMiddleware, guardRoles, async (req: AuthedRequest, res) => {
    try {
      if (createSchema) {
        const parsed = createSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ') });
        req.body = parsed.data;
      }
      const created = await dataService.createOne(tableConfig, req.body, req.user!, entityName, req.user?.tenantId);
      onCreated?.(req, created);
      res.status(201).json({ [entityName]: created });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.patch(`${prefix}/${idParam}`, authMiddleware, guardRoles, async (req: AuthedRequest, res) => {
    try {
      if (updateSchema) {
        const parsed = updateSchema.safeParse(req.body);
        if (!parsed.success) return res.status(400).json({ error: parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join('; ') });
        req.body = parsed.data;
      }
      const updated = await dataService.updateOne(tableConfig, req.params.id, req.body, req.user!, entityName);
      if (!updated) return res.status(404).json({ error: `${entityName} nao encontrado.` });
      onUpdated?.(req, updated);
      res.json({ [entityName]: updated });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete(`${prefix}/${idParam}`, authMiddleware, guardRoles, async (req: AuthedRequest, res) => {
    try {
      const ok = await dataService.deleteOne(tableConfig, req.params.id, req.user!, entityName);
      if (!ok) return res.status(404).json({ error: `${entityName} nao encontrado.` });
      onDeleted?.(req, req.params);
      res.json({ ok: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });
}
