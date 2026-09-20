# Security hardening changelog - 2026-09

| Task | Files changed | Breaking change | New environment variables |
| --- | --- | --- | --- |
| P0-1 Environment validation | `apps/api/src/config/env-validation.ts`, `apps/api/src/main.ts`, `apps/api/.env.example` | Production startup now fails for missing or weak setcrets | Existing required production secrets |
| P0-2 API-key pepper rollover | `apps/api/src/security/auth.service.ts`, Redis/status services, secret docs | No; previous pepper is supported during rollover | `API_KEY_PEPPER_PREVIOUS`, `API_KEY_PEPPER_ROLLOVER_DAYS` |
| P0-3 Show-scoped gate sync | Prisma schema/migrations, gate sync and platform services, SDK types | Show keys can no longer access another show's ticket data | None |
| P1-4 Show-key rotation | Developer/admin services and scanner-key UI | Old show keys remain valid only during the configured grace period | None |
| P1-5 CSRF single-flight | CSRF middleware/controller and web API helper | None; API/webhook prefixes remain exempt | None |
| P1-6 Security audit events | Developer controller/service and API-key dashboard | None | None |
| P2-7 Quota-burst settings | System settings, maintenance, admin settings API/UI | None; environment values remain fallback | `API_QUOTA_BURST_WINDOW_MINUTES`, `API_QUOTA_BURST_PERCENT` |
| P2-8 Payment demo guard | Webhooks controller, env validation, `.env.example` | Demo payment callbacks are rejected unless explicitly enabled in non-production | `PAYMENT_DEMO_MODE` |

## Can lam khi deploy

1. Set production values for `DATABASE_URL`, `REDIS_URL`, `JWT_SECRET`, `QR_JWT_SECRET`, `API_KEY_PEPPER`, `API_SECRET_ENCRYPTION_KEY`, `PAYMENT_LINK_SECRET`, `PAYOS_WEBHOOK_SECRET`, and `WEB_ORIGIN`.
2. Set `PAYMENT_DEMO_MODE=false` or leave it unset. Production startup rejects `PAYMENT_DEMO_MODE=true`.
3. Run the Prisma migration command from the repository root:
   `npm run db:migrate`
4. Start the API and wait for its health endpoint, then start the web application.

## Can theo doi sau deploy

- `legacy_key_hash_hits_today` and the rate of legacy API-key fallback.
- QR-secret fallback counts during the configured migration window.
- The rate of `403 csrf_invalid` responses.
- Rejected demo payment callbacks (`demo_payment_disabled`) and payment-link replay attempts.
