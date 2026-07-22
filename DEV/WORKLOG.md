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
