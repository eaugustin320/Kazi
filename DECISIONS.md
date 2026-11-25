# Kazi decision register

## Working defaults supplied by this pack

These defaults permit design and planning now. They are not assertions of an earlier owner approval, legal opinion, live deployment or commercial tariff. Change them explicitly with an impact note instead of repeatedly asking about routine choices.

| ID | Working decision | When to revisit |
| --- | --- | --- |
| ADR01 | Gabon first, Libreville initial area, French UI, XAF, Africa/Libreville | Owner changes market or service coverage |
| ADR02 | Worker free access; direct company-to-worker remuneration; Kazi service invoiced separately | Only by explicit business-model decision |
| ADR03 | Human Kazi selection, company approval, worker confirmation, staff finalization | Any altered staffing responsibility |
| ADR04 | Responsive web product; worker mobile first, enterprise/admin desktop with mobile support | Native-device requirement demonstrated |
| ADR05 | Semantic immutable themes; GA candidate plus legacy alternative for review | D0 visual acceptance; keep contract across palette changes |
| ADR06 | Single TypeScript Next/PostgreSQL app with Prisma and Better Auth as implementation baseline | Existing repository or verified compatibility requires a documented adaptation |
| ADR07 | In-app notifications/support; SMS/email adapters; no payroll gateway | Operational channel selected and authorized |
| ADR08 | D0 design-only before live backend/deployment | Owner accepts design and instructs D1 |
| ADR09 | 24-hour post-company-approval confirmation window capped at mission start | Pilot operations justify another versioned default |
| ADR-D0-01 | React/TypeScript standalone interactive prototype for Phase D0 | D0 accepted; D1 establishes production Next.js architecture |
| ADR-D0-02 | Semantic CSS token injection (:root) from versioned theme JSONs | Portability verified; no raw hex in UI components |
| ADR-D0-03 | Type-level separation between WorkerPublicProfile and WorkerPrivateProfile | Ensures zero leakage of candidate phone/CNI to companies |
| ADR-D0-04 | Prominent SAMPLE watermark on all prototype invoice/quote fixtures | Production invoice policy finalized by owner |
| ADR-D1-01 | Pinned stack dependencies: Next.js 15, Prisma 6.4.1, Zod 3, Vitest 5 on Node LTS | Revisit upon major framework upgrades or breaking driver changes |
| ADR-D1-02 | Node.js native node:sqlite engine for local development/sandbox persistence; 34 physical tables matching DATABASE.md; WAL mode, foreign keys, and ACID transactions | Revisit when production PostgreSQL database server and live credentials are provisioned |
| ADR-D2-01 | PBKDF2-SHA512 password hashing, timing-safe equality, in-memory OTP/session store with strict API limits (3 sends/15m, 60s cooldown, max 5 attempts) | Replace in-memory store with Redis/PostgreSQL for clustered production |
| ADR-D3-01 | Material profile changes reset company verification to PENDING; atomic publication requires both request APPROVED and company VERIFIED | Revisit if lightweight profile updates (e.g. phone/address only) are partitioned into sub-profiles |
| ADR-D4-01 | Candidate DTO scoping strictly redacts worker phone, CNI documents, and staff notes from company views; public missions redact meeting coordinates for unassigned callers | Nonnegotiable privacy boundary per PRD and OPERATIONS_AND_SECURITY |
| ADR-D5-01 | 24-hour worker availability window begins immediately on company proposal acceptance; atomic assignment finalization strictly enforces both capacity and schedule anti-overlap | Operational default per ADR09; revisit only if pilot requires different timer |
| ADR-D6-01 | Pointage revisions reset worker confirmation to PENDING; mission closure requires all attendance days to be VALIDATED or RESOLVED_BY_STAFF | Essential invariant preventing premature commercial invoicing or wage payout discrepancies |
| ADR-D7-01 | STAFF_ONLY support messages are strictly filtered from company and worker client responses; outbox events enforce exponential backoff and 5-attempt dead-letter threshold | Nonnegotiable support privacy and at-least-once delivery guarantees |
| ADR-D8-01 | Preliminary invoices carry mandatory SAMPLE status and watermark flag; payment receipt reversals are executed as compensating negative records without deletion | Ensures accounting immutability and compliance with commercial boundary rules |
| ADR-D9-01 | Theme activation accepts registered IDs only, not raw palettes; staff grant revocation immediately terminates active user sessions | Prevents visual/brand hijacking and enforces immediate security boundary enforcement |
| ADR-D10-01 | Release audit verifies 100% passage across all 10 test suites (105 tests), strict TypeScript compilation, and WCAG contrast validation before production readiness | Final signoff baseline for Kazi recruitment platform |
| ADR-I-01 | Standalone Node.js HTTP server (`src/server/server.ts`) on port 3001 mounting Next-compatible route handlers; Vite development and preview proxy `/api` requests to backend | Revisit when production reverse proxy (e.g. NGINX, Cloudflare) is configured |
| ADR-I-02 | Operational session layer replacing prototype harness: real HttpOnly `kazi_session` cookies and Bearer tokens for Worker, Company, and Staff; dev-only OTP harness for local verification without live SMS credentials | Replace with production SMS gateway credentials when contracted |
| ADR-I-03 | Connected vertical recruitment journey (Company request -> Recruiter review & publish -> Worker application -> Recruiter shortlist & proposal -> Company acceptance -> Worker 24h confirmation -> Recruiter atomic finalization with capacity & anti-overlap locks) proven on real SQLite WAL storage with restart persistence | Production PostgreSQL migration upon authorized infrastructure provisioning |

### ADR-M-01 — Migrate runtime to the ADR06 baseline & close v1 security/UI gaps

- **Date:** 2026-11-25 · **Status:** accepted · **Owner:** product owner
- **Problem:**
  1. Earlier verification relied on HTTP/service tests without browser E2E verification of v1 screens (attendance, disputes, replacements, support, notifications, profiles, and billing).
  2. Several UI screens and API contracts had gaps: no Notifications UI bell/drawer, no Replacements UI, `POST /api/v1/replacements` lacked role/tenant authorization, `CompanyView.tsx` hardcoded `'mission-demo-01'` for attendance and `/api/v1/attendance` hardcoded `'Paul Mba'`, `authApi.getMe()` unwrapped `res.user` from an already-unwrapped user DTO (breaking page refresh session recovery), `NODE_ENV=development` inside `.env` caused `vite build` to compile in dev mode (`import.meta.env.DEV === true`), and production auth guards failed open when `NODE_ENV` was unset or `'staging'`.
  3. Docker Desktop cannot start on this Windows host (`Error response from daemon: Docker Desktop is unable to start`), blocking a local Docker PostgreSQL daemon.
- **Chosen option:**
  1. **Fail-closed environment guard (`src/server/config/env.ts`)**: `isDevOrTestEnvironment()` returns `true` ONLY when `NODE_ENV === 'development' || NODE_ENV === 'test' || Boolean(process.env.VITEST) || process.argv.includes('--dev')`. Removed `NODE_ENV=development` from `.env` so `vite build` produces a true production bundle (426 kB, stripped of all dev footers, D0 state simulators, and pre-filled credentials).
  2. **Real RFC 6238 TOTP MFA (`src/server/auth/totp.ts`, `src/server/auth/mfa.ts`) + Better Auth (`src/server/auth/better-auth.ts`)**: Staff accounts use standard RFC 6238 HMAC-SHA1 TOTP secrets (`otpauth://totp/Kazi...`) verified with ±1 30s step window in production, while rejecting fixed `'123456'`.
  3. **Dependency & Database verification**: Pinned `prisma@6.4.1` and `@prisma/client@6.4.1` (`npm audit` reports **0 vulnerabilities**, avoiding the `effect` ReDoS advisory in `@prisma/config@7.10.1`), added `docker-compose.yml` (`postgres:17.12-alpine`) for external PostgreSQL, and verified all 27 Kazi tables and constraints on real embedded PostgreSQL 19 (`@electric-sql/pglite`) in `tests/postgres_pglite_schema.test.ts`.
  4. **Same-Origin Next.js App Router + Wired V1 Screens + Playwright E2E (`e2e/kazi_v1_screens.spec.ts`)**: Wired `/api/health`, `/api/v1/me/profile`, `/api/v1/replacements` (with strict company ownership & recruiter RBAC), `/api/v1/staff/replacements/[id]/confirm`, required `expectedVersion`/`declarationRevision` optimistic concurrency, Notifications bell/drawer in `AppShell.tsx`, worker pointage confirmation & bottom nav `Pointage` tab, company replacement requests & quote acceptance, and staff replacement confirmation & bank receipt recording.
- **Tests:** 14 Vitest suites (144 tests, 100% passing) + 4 Playwright real browser E2E suites (`e2e/kazi_v1_screens.spec.ts`, 100% passing).

## Owner decisions that remain open

Exact recruitment fee and invoicing/tax details; legal employer/intermediary responsibilities; wage method/payment timing; cancellation/absence/replacement rules; eligibility and identity checks; private-document retention; staffing and support coverage; hosting region/budget; SMS/email/storage vendors; launch date; final logo and visual palette acceptance. These are not grounds to invent values or to stop reversible prototype work. Mark fixture terms SAMPLE. Block only dependent production functionality until required inputs exist.

## Decision entry template

ID; date; status proposed/accepted/superseded; decision owner; problem; chosen option; alternatives; affected requirements/artifacts; compatibility/migration impact; tests; rollback; replacement decision if any. An agent recommendation is proposed until the relevant authority accepts it. Keep history rather than rewriting prior accepted entries.
