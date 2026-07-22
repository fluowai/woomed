# WORKLOG

## 2026-07-21 - Onboarding & Setup API Fixes (502 / 504 Errors)

### Summary
Fixed the "Erro ao comunicar com o servidor" error during clinic onboarding caused by 502 Bad Gateway and 504 Gateway Timeout on `/api/v2/onboarding/plans`, `/api/v2/setup/status`, and `/api/v2/onboarding/clinic`.

### Key Changes
1. **Route Syntax Fixes**:
   - Fixed `ReferenceError: req is not defined` in `server/routes/onboarding.ts`, `server/routes/saas.ts`, `server/routes/scheduler-routes.ts`, and `server/routes/whatsapp.ts` where route parameters were declared as `_req` but accessed as `req`.
2. **Database Connection Hardening**:
   - Updated `getPool()` in `server/database.ts` to include `ssl: { rejectUnauthorized: false }` for Supabase / production hosts and added `connectionTimeoutMillis: 5000` + `statement_timeout: 10000` to prevent TCP handshakes from hanging.
3. **Route Error Handling**:
   - Wrapped `/api/v2/onboarding/plans`, `/api/v2/onboarding/clinic`, and `/api/v2/setup/status` in `try/catch` blocks to ensure JSON HTTP 500 responses on errors.

### Verification
- `npm run build`: Success
- `npm run test:smoke`: Passed 100%

## 2026-07-22 - Fix 502/504 Errors & Master Owner Account Creation

### Summary
Resolved 502 Bad Gateway and 504 Gateway Timeout errors occurring during login and `/api/bootstrap`. Created and seeded the system master owner account (`wootechsc@outlook.com`).

### Key Changes
1. **ReferenceError & Null-Safety Fixes**:
   - Fixed `ReferenceError: req is not defined` inside `findUserByEmail`, `hasConfiguredSuperAdmin`, and `findUserById` in `server/routes/phase1.ts`.
   - Added `try/catch` error handling in `/api/bootstrap` in `server/routes/index.ts`.
   - Hardened `scopedItems`, `buildState`, `mergeDefaultPlans` (`server/saas-defaults.ts`), and `resolveTenantPlan` (`server/plan-guard.ts`) to be 100% null-safe against missing arrays (`auditEvents`, `plans`, `tenants`).
   - Fixed `audit()` in `server/helpers.ts` and `server/audit.ts` to ensure `data.auditEvents` is initialized before calling `.push()`.
   - Fixed whatsmeow auto-reconnect logic in `server.ts` to safely validate `data.whatsappConnections`.

2. **Master Owner User Creation**:
   - Created super_admin user `wootechsc@outlook.com` with password `Argo@15077399brsc`.
   - Updated `server/database.ts`, `server/seed.ts`, and local JSON storage (`data/consultio-data.json`) to guarantee fallback seeding as `super_admin`.

### Verification
- `npm run build`: Clean compilation with 0 errors.
- `npm run test:smoke`: 100% Passed.
- Live API Verification (`/api/v2/auth/login` and `/api/bootstrap`): HTTP 200 SUCCESS (`role: super_admin`).

## 2026-07-22 - Supabase Exclusive Migration

### Summary
Migrated application configuration and Docker deploy files to use **Supabase exclusively** as the database engine, removing the self-hosted PostgreSQL local container.

### Key Changes
1. **Docker Compose (`docker-compose.yml`)**:
   - Removed local `postgres:16-alpine` service and `data_postgres` volume.
   - Updated `api` service to connect directly to Supabase via `DATABASE_URL` and `SUPABASE_*` environment variables.
2. **Backend SSL Hardening (`server/database.ts`)**:
   - Updated `getPool()` to automatically enforce SSL for all Supabase hosts (`pooler.supabase.com`, `supabase.co`, `supabase.com`, etc.).
3. **Environment Templates (`.env.example`)**:
   - Updated `.env.example` to set Supabase Transaction Pooler / Direct Connection as the standard database configuration.

### Verification
- `npm run build`: Passed.
- `npm run test:smoke`: Passed 100%.

## 2026-07-22 - Production Supabase Stack Alignment

### Summary
Updated `docker-compose.yml` to match the exact production Docker Swarm stack with Supabase IPv4 Pooler (`pgbouncer=true`), unified JWT secret, Traefik routes (`woomed.wootech.com.br`), and `WHATSMEOW_EXTERNAL_URL`.

### Key Changes
1. **Docker Compose (`docker-compose.yml`)**:
   - Set version to `"3.8"` with Swarm deploy configurations (`restart_policy`, Traefik v2 labels).
   - Injected production Supabase Connection Pooler (`aws-1-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true`).
   - Configured `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `JWT_SECRET`, and `ENCRYPTION_MASTER_KEY`.
2. **Server Config (`server/config.ts`)**:
   - Added support for `WHATSMEOW_EXTERNAL_URL` environment variable.

### Verification
- `npm run build`: Clean build.
- `npm run test:smoke`: 100% Passed.

## 2026-07-22 - Non-blocking HTTP Port Binding & Supabase Extension Notice Fix

### Summary
Fixed the 502 Bad Gateway error on Traefik/Production caused by synchronous database migration loops blocking `httpServer.listen(PORT)` during container startup.

### Key Changes
1. **Immediate Non-blocking HTTP Server Binding (`server.ts`)**:
   - Reordered `server.ts` so `httpServer.listen(PORT, "0.0.0.0")` binds the HTTP port immediately upon startup.
   - Database migrations (`runMigrations` and `runSeed`) now run asynchronously in the background without blocking Traefik HTTP connection healthchecks.
2. **Supabase PgBouncer Extension Handling (`server/database.ts`)**:
   - Wrapped `CREATE EXTENSION IF NOT EXISTS pgcrypto` in a try/catch block inside `ensureCoreAuthSchema` and `runMigrations` so DDL notices on Supabase PgBouncer pooler do not throw unhandled exceptions.

### Verification
- `npm run build`: Passed.
- `npm run test:smoke`: Passed 100%.
