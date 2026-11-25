# Kazi Changelog

All notable changes to the Kazi codebase and design prototypes are documented in this file.

---

## [1.0.0] - 2026-11-25

### Kazi 1.0.0 Complete V1 Screens, Fail-Closed Security, TOTP MFA & Playwright E2E Verification

#### Added & Fixed
- **Fail-Closed Environment & Production Build Guard (`src/server/config/env.ts`, `src/components/auth/AuthScreen.tsx`, `src/components/layout/AppShell.tsx`)**:
  - Added `isDevOrTestEnvironment()` which enables debug/test helpers only when explicitly in `development` or `test` (`NODE_ENV === 'development' || NODE_ENV === 'test' || Boolean(process.env.VITEST) || process.argv.includes('--dev')`), failing closed when `NODE_ENV` is unset, `'staging'`, or `'production'`.
  - Removed `NODE_ENV=development` from `.env` so `vite build` produces a true production bundle (426.78 kB) with all dev shortcuts, D0 state simulator dropdowns, and pre-filled credentials stripped.
- **RFC 6238 TOTP Staff MFA (`src/server/auth/totp.ts`, `src/server/auth/mfa.ts`) & Better Auth (`src/server/auth/better-auth.ts`)**:
  - Implemented standard RFC 6238 HMAC-SHA1 TOTP with Base32 secrets and `otpauth://` URIs so staff can authenticate with any standard TOTP app in production while fixed `'123456'` is rejected (HTTP 401).
  - Fixed `authApi.getMe()` in `src/services/api.ts` so active sessions survive browser refresh without logging the user out.
- **Connected V1 Screens & Strict Optimistic Concurrency**:
  - **Attendance & Disputes**: Restored required `expectedVersion` and `declarationRevision` checks on attendance declaration, worker confirmation/dispute, and staff arbitration; removed hardcoded `'mission-demo-01'` filter in `CompanyView.tsx` and `'Paul Mba'` fallback in `/api/v1/attendance`; added worker `Pointage` bottom nav tab and `Confirmer ce pointage` button.
  - **Replacements (KZ11)**: Enforced company ownership (`404` on cross-tenant) and role checks (`403` for workers) on `GET/POST /api/v1/replacements`, added `POST /api/v1/staff/replacements/[id]/confirm`, and wired replacement request/confirmation UI in `CompanyView.tsx` and `AdminView.tsx`.
  - **Notifications, Support, Profiles & Service Billing**: Added header Notifications Center bell & mark-as-read drawer in `AppShell.tsx`, `GET/PATCH /api/v1/me/profile` with database-computed attendance rate and completed missions count, and full Service Quote -> Company Acceptance -> SAMPLE Invoice -> Offline Bank Receipt UI in `AdminView.tsx` and `CompanyView.tsx`.
- **PostgreSQL Schema & Playwright E2E Browser Suite**:
  - Added `tests/postgres_pglite_schema.test.ts` verifying all 27 tables and constraints on real embedded PostgreSQL 19 (`@electric-sql/pglite`), plus `docker-compose.yml` (`postgres:17.12-alpine`).
  - Added `playwright.config.ts` and `e2e/kazi_v1_screens.spec.ts` (4 real browser E2E suites passing in 14.4s).

---

## [1.0.0-I6] - 2026-11-24

### Functioning Kazi 1.0.0 Operational Application & System Integration (I0–I6 COMPLETED)

#### Added
- **Mounted Operational Node.js HTTP Backend (`src/server/server.ts`)**:
  - Standalone HTTP server running on port 3001 with active readiness endpoint `GET /api/health` returning `{ status: 'ok', version: '1.0.0', database: 'connected' }`.
  - Full dispatch of `/api/auth/...` and `/api/v1/...` Next-compatible route handlers via native Web `Request`/`Response` pipeline.
  - Proxied via Vite (`vite.config.ts`) on preview port 4173 (`http://127.0.0.1:4173/`).
- **Real Session Entry & Identity Layer (`src/components/auth/AuthScreen.tsx`, `src/services/api.ts`)**:
  - Worker phone OTP authentication with rate limiting and secure session issuance.
  - Company registration and email/password login with scoped membership verification.
  - Staff two-step MFA authentication with capability-based RBAC (`RECRUITER`, `FINANCE`, `SUPER_ADMIN`).
  - Strict isolation: replaced prototype role-switcher tabs with genuine server-authenticated sessions.
- **Connected Recruitment Vertical Slice (I3)**:
  - Proven 8-step connected workflow: Company request submission -> Recruiter review & publish -> Worker application (KZ06) -> Recruiter shortlisting & proposal batch (KZ07) -> Company acceptance with zero privacy leakage -> Worker 24h confirmation (KZ08) -> Recruiter atomic finalization with capacity and schedule anti-overlap locks (KZ09).
  - All mutations committed to durable SQLite WAL storage (`data/kazi_dev.sqlite`) and verified across server restarts.
- **Operational UI Shell & Navigation (I5)**:
  - Removed "Prototype Premium UI/UX", "Phase D0", and "Components D0b" prototype chrome.
  - Operational header displays active role, user identity, test session switcher, theme toggler, and logout button.
  - Specimen showcase preserved under isolated `/dev/design` navigation.
- **Automated Integration & Contention Test Suite (`tests/connected_journey.test.ts`)**:
  - 13 comprehensive end-to-end HTTP tests verifying the 8-step flow, tenant isolation, concurrent last-slot contention, schedule collision rejection, and persistence across server restart.
  - Entire test suite: 12 test files, 134 tests, 100% passing.
  - Production build: `tsc` and `vite build` completed in 6.84s with 0 errors.

---

## [1.1.0-D10] - 2026-11-24

### Phase D10: Staging, Security/QA, Performance, Recovery & Release Audit (COMPLETED)

#### Added
- **Full Test Suite Verification (`npm test`)**:
  - All 11 test suites passing 100% with 121 individual automated tests.
  - Test worker isolation verified across parallel execution pools (`process.env.VITEST_POOL_ID`).
- **Production Build & Strict Typecheck (`npm run build`)**:
  - `tsc` completed with 0 errors.
  - `vite build` completed in 6.40s with 0 errors, generating optimized bundles with gzip compression.
- **Pack & Theme Accessibility Audit (`python scripts/validate_pack.py`)**:
  - 17/17 declared WCAG 2.2 AA contrast pairs checked and passing for `gabon-premium@1.0.0`.
  - 17/17 declared WCAG 2.2 AA contrast pairs checked and passing for `forest-premium@1.0.0`.
  - Country config (`GA`), French locale, XAF currency, and fixture separation validated.

---

## [1.1.0-D9] - 2026-11-24

### Phase D9: Theme & Country Administration, Staff Team & Redacted Audit Log (COMPLETED)

#### Added
- **Database-Backed Configuration Activations (`src/modules/admin/service.ts`)**:
  - Connected `configuration_activations` SQLite table to track revision-versioned active theme and country config.
  - Enforced privileged preview and activation: only registered theme IDs permitted (`gabon-premium@1.0.0`, `forest-premium@1.0.0`), rejecting raw user-supplied palettes.
  - Automatic recovery of active theme and country pointer from SQLite on system startup.
- **Controlled Staff Team Provisioning & Grant Management**:
  - Connected `staff_grants` table to recruiter, finance, and super-admin capability grants.
  - Nonnegotiable product boundary: public signup grants 0 staff capabilities; all staff accounts are explicitly provisioned by Super Admin.
  - Instant session revocation: revoking a staff grant immediately invalidates all active sessions for that user across memory and SQLite.
- **Immutable Redacted Audit Log**:
  - Connected `audit_events` SQLite table with automatic redacting of sensitive secrets, passwords, OTPs, CNI numbers, and API tokens.
  - Verified audit trail retrieval across memory purges.
- **Integration Test Suite Verification (`tests/admin_config_and_audit.test.ts`)**:
  - 10 comprehensive tests verifying activation, provisioning, grant revocation session termination, secret redaction, and database recovery.

---

## [1.1.0-D8] - 2026-11-24

### Phase D8: Service Quotes, SAMPLE Invoices, Receipts & Compensating Reversals (COMPLETED)

#### Added
- **Database-Backed Service Quotes (`src/modules/billing/service.ts`)**:
  - Connected `quotes` SQLite table with automatic 18% Gabon TVA calculations, line totals, expiration checks, and versioned acceptance.
- **Database-Backed Invoices with Mandatory SAMPLE Watermark (ADR-D0-04)**:
  - Connected `invoices` and `invoice_lines` SQLite tables.
  - Enforced invariant: only accepted quotes can be invoiced.
  - Generated sequential invoice numbering (`KZ-SAMPLE-GA-${year}-${seq}`) with mandatory `SAMPLE` status and watermark flag.
- **Settlement Receipts & Non-Destructive Compensating Reversals**:
  - Connected `service_receipts` SQLite table with unique external reference enforcement per invoice (`UNIQUE(invoice_id, external_reference)`).
  - Enforced accounting immutability: receipts are never deleted; reversals insert a compensating negative entry (`amount: -originalReceipt.amount`) linked via `reverses_receipt_id`.
  - Dynamic invoice balance adjustment (`paidAmount` computed from receipts sum, updating status between `SAMPLE`, `PARTIALLY_PAID`, and `PAID`).
- **Integration Test Suite Verification (`tests/billing_and_invoices.test.ts`)**:
  - 10 comprehensive tests verifying draft quote calculation, versioning, SAMPLE invoice creation, unique bank references, compensating reversals, and database recovery.

---

## [1.1.0-D7] - 2026-11-24

### Phase D7: Support Cases, Scoped Threads, STAFF_ONLY Privacy Filter & Notification Outbox (COMPLETED)

#### Added
- **Database-Backed Support Cases & Thread Scoping (`src/modules/support/service.ts`)**:
  - Connected `support_cases` and `case_messages` SQLite tables.
  - Enforced role-based case listing: workers see only own cases; companies see company cases; staff sees all country cases.
- **STAFF_ONLY Internal Note Privacy Filter**:
  - Enforced nonnegotiable security rule: only staff can post `STAFF_ONLY` messages.
  - Thread retrieval strictly filters out `STAFF_ONLY` messages for worker and company clients (0 exposure of internal staff notes).
- **Transactional Outbox Delivery & In-App Notifications**:
  - Connected `outbox_events` and `notifications` SQLite tables.
  - Outbox processor implements exponential backoff and 5-attempt dead-letter threshold (`DEAD_LETTER`).
  - In-app notification read timestamp tracking with optimistic locking.
- **Integration Test Suite Verification (`tests/support_and_notifications.test.ts`)**:
  - 10 comprehensive tests verifying case validation, staff-only privacy filtering across memory cache purges, outbox retries, and database recovery.

---

## [1.1.0-D6] - 2026-11-24

### Phase D6: Daily Pointage, Worker Disputes, Replacement Requests & Mission Bilan Close (COMPLETED)

#### Added
- **Database-Backed Daily Pointage & Attendance (`src/modules/attendance/service.ts`)**:
  - Connected `attendance` and `attendance_events` SQLite tables.
  - Enforced KZ10 daily pointage declaration: company declares status (`PRESENT`, `ABSENT`, `PARTIAL` with minutes).
  - Revision incrementing: pointage declaration updates revision and resets worker confirmation to `PENDING`.
- **Worker Confirmation & Dispute Arbitration**:
  - Worker confirms attendance matching revision; stale confirmations rejected (`REVISION_MISMATCH`).
  - Worker disputes require explicit justification; staff recruiter arbitrates and resolves (`RESOLVED_BY_STAFF`).
  - Complete traceable event history persisted to `attendance_events`.
- **Absence & Replacement Requests (KZ11)**:
  - Connected `replacement_requests` SQLite table.
  - Links replacement assignment upon staff confirmation without double-booking or fabricating unconfirmed assignments.
- **Mission Bilan & Closure**:
  - Enforced invariant: missions cannot be closed while unresolved attendance days remain (`UNRESOLVED_ATTENDANCE_DAYS`).
  - Bilan closure updates mission status to `COMPLETED` in SQLite.
- **Integration Test Suite Verification (`tests/attendance_and_bilan.test.ts`)**:
  - 14 comprehensive tests validating pointage revisions, dispute resolution, replacement requests, mission close, and database persistence/recovery.

---

## [1.1.0-D5] - 2026-11-24

### Phase D5: Dual Confirmations (24h Window), Capacity & Schedule Anti-Overlap Finalization Gates (COMPLETED)

#### Added
- **Dual Confirmation Gate (KZ08)**:
  - Company proposal acceptance starts immediate 24-hour availability window.
  - Worker confirmation within 24h advances proposal to `READY_FOR_ASSIGNMENT`; expired confirmation rejected (`PROPOSAL_EXPIRED`).
  - Terms revision check: worker confirms exact revision accepted by company.
- **Atomic Assignment Finalization Gate (KZ09)**:
  - Implemented `staffFinalizeAssignment` in `src/modules/applications/service.ts` executing in an ACID transaction.
  - Enforces dual confirmation: rejects proposals not in `READY_FOR_ASSIGNMENT` status.
  - Decrements remaining mission slot capacity; rejects if filled (`CAPACITY_FULL`).
  - Validates worker schedule anti-overlap (`WORKER_OVERLAP`): queries `assignment_days` for overlapping date intervals.
  - Atomically creates `assignments` and `assignment_days` rows, updates proposal to `FINALIZED`, application to `ASSIGNED`, and mission version.
  - Idempotency support: identical retry returns cached assignment without re-decrementing capacity.
- **Integration Test Suite Verification (`tests/recruitment_lifecycle.test.ts`)**:
  - 19 comprehensive tests validating dual gates, concurrency, capacity limits, anti-overlap checks, and database persistence.

---

## [1.1.0-D4] - 2026-11-24

### Phase D4: Public Missions, Worker Applications & Candidate Proposals (COMPLETED)

#### Added
- **Database-Backed Worker Applications (`src/modules/applications/service.ts`)**:
  - Connected `applications` table to application submission, withdrawal, and recruiter shortlisting.
  - Enforced invariant **KZ06**: duplicate active application prevention strictly verified against both in-memory cache and SQLite database queries.
  - Preassignment withdrawal workflow with optimistic version conflict prevention.
- **Database-Backed Candidate Proposals & Batches**:
  - Connected `proposals` table to recruiter proposal batch creation in an ACID transaction.
  - Enforced max proposal batch limit (20 candidates per batch).
- **Candidate Privacy Boundary & Anonymized DTO Scoping (KZ07)**:
  - Scoped candidate presentation (`CandidateCompanyDTO`) for company client review:
    - Zero phone numbers exposed
    - Zero CNI identity verification documents exposed
    - Zero internal staff notes exposed
    - Anonymized worker names (e.g. "Jean-Marc B.")
    - Area, trade codes, experience years, and verification badges.
- **Public Mission Discovery & Protection (KZ05)**:
  - Public mission list and mission detail endpoints redact sensitive meeting coordinates for unassigned callers.
- **Integration Test Suite Verification (`tests/recruitment_lifecycle.test.ts`)**:
  - Verified physical insertion of application and proposal records in SQLite.
  - 100% test passage across all 11 test suites (113 tests).

---

## [1.1.0-D3] - 2026-11-23

### Phase D3: Company Profiles, Verification Documents & Recruitment Requests (COMPLETED)

#### Added
- **Database-Backed Company Profiles (`src/modules/companies/service.ts`)**:
  - Connected `companies` table to profile retrieval, updates, and moderation.
  - Implemented optimistic concurrency locking on version increments.
  - Enforced KZ02 invariant: material updates (legal name, RCCM, tax NIF) automatically reset verification status from `VERIFIED` to `PENDING`.
- **Database-Backed Verification Documents Pipeline (`src/server/storage/documents.ts`)**:
  - Connected `verification_documents` table to upload intent generation, scan results, and private access links.
  - Enforces 5 MiB size limits and allowed MIME types (PDF, JPG, PNG).
  - Quarantining: files default to `PENDING` scan status and reject access until scanned as `CLEAN`.
  - Enforced tenant scope isolation: Company B cannot access Company A's private documents.
- **Database-Backed Staffing Requests & Atomic Publication (`src/modules/requests/service.ts`)**:
  - Connected `recruitment_requests` to drafting, submission, and staff moderation.
  - Enforces minimum daily wage constraint (5 000 FCFA) and required fields.
  - Implemented atomic mission publication (`publishRequestToMission`) executing in an ACID transaction:
    - Invariant KZ04: Request must be `APPROVED` AND company must be `VERIFIED`.
    - Atomically inserts into `missions`, `mission_terms` (revision 1), and `mission_days`.
    - Updates request status to `APPROVED` and links `published_mission_id`.
- **Integration Test Suite Expansion (`tests/documents_and_requests.test.ts`)**:
  - Added physical database verification checks for document records, published missions, terms, and daily schedules.
  - Full test suite now at 11 test files and 113 tests (100% passing).

---

## [1.1.0-D2] - 2026-11-23

### Phase D2: Authentication, Security & Session Persistence (COMPLETED)

#### Added
- **Database-Backed Session Persistence (`src/server/auth/session.ts`)**:
  - Connected session lifecycle (`createSession`, `getSession`, `revokeSession`, `revokeAllUserSessions`) directly to `auth_sessions` and `auth_users` tables in SQLite.
  - Implemented dual-layer architecture: high-speed in-memory session cache backed by synchronous SQLite disk persistence.
  - Verified cross-session recovery: sessions survive complete memory cache purges and server reboots, reading directly from disk.
  - Enforced strict session revocation: `revokeSession` and `revokeAllUserSessions` physically remove records from the database table.
- **Database-Backed Phone OTP Challenge Engine (`src/server/auth/otp.ts`)**:
  - Integrated `auth_otp_codes` table to persist phone challenges with 5-minute expiry, 60s cooldown, and 5-attempt brute-force lockout.
  - Timing-safe code comparison preventing timing side-channel attacks.
- **Atomic Registration & Provisioning Handlers**:
  - `POST /api/auth/company/register`: Transactional creation of `auth_users`, `companies`, and `company_memberships` (`OWNER`), returning active session.
  - `POST /api/auth/worker/verify-otp`: Transactional provisioning of worker `auth_users` and default `worker_profiles`.
- **Integration Test Suite Expansion (`tests/auth.test.ts`)**:
  - 19 comprehensive tests validating PBKDF2-SHA512 password security, OTP challenges, session disk persistence across cache purges, database revocation checks, and tenant scope isolation.
  - Total test suite now at 11 test files and 112 tests (100% passing).

---

## [1.1.0-D1] - 2026-11-23

### Phase D1: Real Database Persistence Engine & Relational Schema (COMPLETED)

#### Added
- **Physical Relational DDL (`src/server/db/schema.sql`)**:
  - Implements all 34 physical tables across Identity, Profiles, Permissions, Recruitment, Mission Delivery, Attendance, Invoicing, Support, Outbox, and Configuration matching `DATABASE.md` and `prisma/schema.prisma`.
  - Enforces foreign key constraints (`ON DELETE CASCADE`, `ON DELETE SET NULL`), check constraints (`headcount > 0`, `worked_minutes >= 0`, `amounts >= 0`), unique constraints (duplicate worker applications KZ06, unique receipt references, composite keys), and secondary query indexes.
- **Node.js Native SQLite Database Persistence Engine (`src/server/db/database.ts`)**:
  - Utilizes Node.js v26 native `node:sqlite` (`DatabaseSync`) with zero external C++ binary compilation requirements.
  - Configures WAL mode (`PRAGMA journal_mode = WAL;`) and active foreign key validation (`PRAGMA foreign_keys = ON;`).
  - Supports automatic idempotent schema migrations (`initDatabase`).
  - Implements ACID transaction runner (`transaction<T>`) with automatic `COMMIT` on completion and `ROLLBACK` on error.
  - Supports configurable disk paths (defaults to `data/kazi_dev.sqlite`) and clean teardown/reset for testing.
- **Database Persistence Integration Tests (`tests/database_persistence.test.ts`)**:
  - 5 comprehensive tests validating full 34-table schema creation, cross-session disk persistence, foreign key enforcement, unique application constraint enforcement (KZ06), and transaction rollbacks.
  - Full test suite expanded to 11 test files and 110 tests (100% passing).

---

## [1.0.0-D10] - 2026-11-23

### Phase D10: Staging, Security/QA, Performance, Recovery & Release Audit

#### Verified & Audited
- **Full Test Suite Execution (`tests/`)**:
  - 10 test files, 105 tests, 100% passing across authentication, security, tenant isolation, requests, recruitment, attendance, support, billing, configuration, and audit.
- **Strict TypeScript & Build Compilation**:
  - `tsc && vite build` clean build with 0 errors and 0 type suppressions.
- **Pack & Theme Accessibility Verification**:
  - `python scripts/validate_pack.py`: 17/17 declared WCAG 2.2 contrast pairs verified for both `gabon-premium@1.0.0` and `forest-premium@1.0.0`.
- **Security Boundaries & Invariants Audited**:
  - Zero recruitment fees for workers; direct company worker pay; Kazi invoices only its own recruitment service.
  - Zero leakage of worker phone numbers, CNI documents, or staff internal notes to company clients.
  - Double confirmation gate (KZ08) and atomic capacity/anti-overlap finalization (KZ09).
  - Mandatory `SAMPLE` watermark on preliminary invoices; unique receipt reference check; non-destructive compensating reversals.
  - Outbox pattern with exponential backoff and dead-letter queue.
  - Automatic session revocation upon staff capability revocation.
  - Redaction of secrets, hashes, and OTPs in system audit logs.

---

## [1.0.0-D9] - 2026-11-23

### Phase D9: Theme & Country Configuration Administration, Staff Provisioning & Audit Log

#### Added
- **Configuration Administration (`src/modules/admin/service.ts`)**:
  - `previewConfiguration`: Previews registered country and theme versions without persistent mutation. Strictly rejects unregistered themes or raw user-supplied palettes (API.md lines 94-95).
  - `activateConfiguration`: Privileged activation by `SUPER_ADMIN` with optimistic version locking and audited pointer change.
- **Controlled Staff Team Provisioning**:
  - `provisionStaffMember`: Controlled provisioning of staff accounts by `SUPER_ADMIN`. Enforces nonnegotiable boundary: no public staff signup.
  - `updateStaffMemberGrant`: Updates staff capability status (`ACTIVE` vs `REVOKED`) and automatically terminates all active sessions for revoked staff users.
- **Immutable Redacted Audit Trail**:
  - `recordAuditEvent` & `listAuditEvents`: Country-scoped audit log with automatic sanitization of passwords, secrets, tokens, OTPs, and private identity documents.
- **API Route Handlers**:
  - `POST /api/v1/staff/config/preview`: Configuration preview.
  - `POST /api/v1/staff/config/activate`: Privileged configuration activation.
  - `GET / POST /api/v1/staff/team`: Staff team retrieval and controlled provisioning.
  - `PATCH /api/v1/staff/grants/[id]`: Staff grant status update with session revocation.
  - `GET /api/v1/staff/audit`: Redacted audit log retrieval.
- **Integration Test Suite (`tests/admin_config_and_audit.test.ts`)**:
  - 8 tests covering preview, raw palette rejection, audited pointer update, version conflicts, controlled staff provisioning, session revocation upon grant revocation, and automatic secret redaction.

---

## [1.0.0-D8] - 2026-11-23

### Phase D8: Service Quotes, Invoices with SAMPLE Watermark & Payment Receipts

#### Added
- **Service Billing & Quotes Service (`src/modules/billing/service.ts`)**:
  - `createDraftQuote`: Recruitment service quote calculation with VAT/TVA lines (18% GA standard) and validity countdown.
  - `sendQuote`: Finance capability check (`FINANCE`), snapshot generation, and status transition (`DRAFT -> SENT`).
  - `decideQuote`: Client company acceptance/rejection with expiration enforcement.
  - Commercial invariant strictly preserved: workers pay 0 FCFA; only company recruitment service fees are invoiced.

- **Preliminary Invoicing Engine with SAMPLE Watermark (ADR-D0-04)**:
  - `createInvoiceFromQuote`: Conditioned on quote acceptance; applies immutable party tax snapshot (RCCM, NIF, legal name, address) and mandatory `SAMPLE` watermark.
  - Scoped immutable invoice views for company clients and finance staff.

- **External Banking Receipts & Non-Destructive Reversals**:
  - `recordInvoiceReceipt`: Records verified external banking receipts with unique reference enforcement per invoice (`@@unique([invoiceId, externalReference])`). Updates invoice balance (`PARTIALLY_PAID` or `PAID`).
  - `reverseInvoiceReceipt`: Compensating reversal with negative amount entry (`reversesReceiptId`), retaining complete financial audit trail without deletion. Rejects double reversals.

- **API Route Handlers**:
  - `POST /api/v1/staff/quotes`: Finance quote drafting.
  - `POST /api/v1/staff/quotes/[id]/send`: Quote dispatch.
  - `GET /api/v1/companies/[id]/quotes`: Company quote list.
  - `POST /api/v1/quotes/[id]/decision`: Company quote acceptance/rejection.
  - `POST /api/v1/staff/invoices`: Invoice generation from accepted quote.
  - `GET /api/v1/companies/[id]/invoices`: Company invoices list.
  - `GET /api/v1/invoices/[id]`: Scoped immutable invoice details.
  - `POST /api/v1/staff/invoices/[id]/receipts`: Payment receipt recording.
  - `POST /api/v1/staff/receipts/[id]/reverse`: Payment receipt compensating reversal.

- **Integration Test Suite (`tests/billing_and_invoices.test.ts`)**:
  - 8 tests covering quote drafting, expiry, SAMPLE watermark enforcement, unaccepted quote rejection, duplicate banking reference prevention, and non-destructive receipt reversals.
  - All 97 project tests passing (`vitest run`).

---

## [1.0.0-D7] - 2026-11-23

### Phase D7: Support Cases, Scoped Threads, STAFF_ONLY Privacy Filter & Notification Outbox

#### Added
- **Support Case & Message Service (`src/modules/support/service.ts`)**:
  - `createSupportCase`: Scoped case creation across `CHANTIER`, `PAIEMENT`, `POINTAGE`, `ACCES`. Validates subject and body (<= 4000 chars, no executable HTML).
  - `getCaseThread`: Strictly enforces privacy boundary where `STAFF_ONLY` internal notes are completely filtered out for workers and companies. Only staff view internal notes.
  - `postCaseMessage`: Allows parties to reply to case thread; non-staff forbidden from posting `STAFF_ONLY` visibility.
  - `transitionCaseStatus`: Optimistic locking on status transitions (`OPEN` -> `IN_PROGRESS` -> `WAITING_ON_PARTY` -> `RESOLVED`).

- **In-App Notifications & Outbox Pattern**:
  - `sendInAppNotification`: Dispatches notification record to user.
  - `markNotificationAsRead`: Idempotently stamps `readAt`.
  - `enqueueOutboxEvent`: Produces transactional outbox event.
  - `processPendingOutboxEvents`: Processes queue with exponential backoff and dead-letter queue after 5 failed attempts.

- **API Route Handlers**:
  - `GET / POST /api/v1/support-cases`: Scoped case list and creation.
  - `GET /api/v1/support-cases/[id]`: Thread retrieval with staff-only filter.
  - `POST /api/v1/support-cases/[id]/messages`: Message posting with role-based visibility.
  - `POST /api/v1/staff/support-cases/[id]/transition`: Staff case status update.
  - `GET /api/v1/me/notifications`: User notifications list.
  - `POST /api/v1/me/notifications/[id]/read`: Idempotent read timestamp.

- **Integration Test Suite (`tests/support_and_notifications.test.ts`)**:
  - 8 tests covering length limits, tenant scoping, staff-only privacy filter, forbidden visibility, optimistic locking, and outbox retry/dead-letter.
  - All 89 project tests passing (`vitest run`).

---

## [1.0.0-D6] - 2026-11-23

### Phase D6: Attendance Pointage, Worker Disputes, Replacement Requests & Mission Bilan Close

#### Added
- **Daily Attendance Pointage & Event History (`src/modules/attendance/service.ts`)**:
  - `recordCompanyAttendance`: Daily declaration (`PRESENT`, `ABSENT`, `PARTIAL`). Requires worked minutes for partial days. Automatically increments declaration revision and resets worker confirmation to `PENDING`.
  - Immutable audit trail of pointage events (`AttendanceEventRecord`) tracking all state transitions.
  - Tenant scope isolation: Companies can only point attendance for their own missions.

- **Worker Decision & Dispute Workflow (`KZ10`)**:
  - `workerDecideAttendance`: Workers confirm (`VALIDATED`) or dispute (`DISPUTED`) matching declaration revision. Stale revision confirmation rejected (`409 REVISION_MISMATCH`). Disputes require mandatory justification.

- **Staff Recruiter Dispute Arbitration**:
  - `staffResolveAttendance`: Recruiter capability required (`RECRUITER`). Arbitrates disputed days with mandatory reason, updating status to `RESOLVED_BY_STAFF`.

- **Absence & Replacement Management (`KZ11`)**:
  - `createReplacementRequest`: Allows workers or companies to report absence and request a replacement without fabricating an assignment.
  - `staffConfirmReplacement`: Recruiter confirms replacement candidate, linking assignment and adjusting coverage on affected days to eliminate double-booking.

- **Mission Bilan & Reconciliation Close**:
  - `staffCloseMission`: Closes completed mission. Invariant: rejects closure with `409 UNRESOLVED_ATTENDANCE_DAYS` if any days remain in dispute or unvalidated.

- **API Route Handlers**:
  - `PUT /api/v1/assignment-days/[id]/attendance`: Daily company pointage.
  - `POST /api/v1/attendance/[id]/worker-decision`: Worker confirmation/dispute.
  - `POST /api/v1/staff/attendance/[id]/resolve`: Staff dispute resolution.
  - `POST /api/v1/staff/missions/[id]/close`: Recruiter mission closure.

- **Integration Test Suite (`tests/attendance_and_bilan.test.ts`)**:
  - 12 comprehensive tests covering pointage, partial minutes, revision mismatch, dispute reason validation, staff arbitration, replacement confirmation, and closure blocking.
  - All 81 project tests passing (`vitest run`).

---

## [1.0.0-D5] - 2026-11-23

### Phase D5: Dual Confirmation Decisions, 24h Expiry Window & Atomic Assignment Finalization

#### Added
- **Dual Confirmation & 24h Expiration Engine (`src/modules/applications/service.ts`)**:
  - `companyDecideProposal`: Company acceptance triggers immediate 24h worker availability countdown (`expiresAt = Date.now() + 24h`).
  - `workerDecideProposal`: Enforces company acceptance prerequisite (`KZ08`); validates within 24h window; rejects expired proposals (`410 CONFIRMATION_EXPIRED`) and terms revision mismatch (`409 TERMS_CHANGED`).
  - Pre-assignment withdrawal allowed only prior to assignment confirmation.

- **Atomic Assignment Finalization & Concurrency Protection (`KZ09`)**:
  - `staffFinalizeAssignment`: Verifies dual confirmation on matching terms revision.
  - Enforces capacity limit: `headcountAssigned < headcountNeeded`. Concurrency conflicts reject with `409 CAPACITY_FULL`.
  - Enforces schedule anti-overlap: Verifies worker is not concurrently booked on overlapping active assignment dates (`409 WORKER_OVERLAP`).
  - Atomically provisions confirmed `Assignment` and daily records, increments mission headcount, and updates proposal/application status.
  - Idempotent request handling via `Idempotency-Key` header with identical replay.

- **API Route Handlers**:
  - `POST /api/v1/proposals/[id]/company-decision`: Company acceptance/rejection of candidate.
  - `POST /api/v1/proposals/[id]/worker-decision`: Worker confirmation of availability.
  - `POST /api/v1/staff/proposals/[id]/finalize`: Staff recruiter atomic finalization.

---

## [1.0.0-D4] - 2026-11-23

### Phase D4: Public Missions, Worker Applications/Withdrawal & Staff Shortlist/Proposal

#### Added
- **Public Missions Discovery (`KZ05`, `src/modules/applications/service.ts`)**:
  - `listPublicMissions`: Filters OPEN missions with safe summaries.
  - Privacy scoping: Sensitive meeting instructions and exact site coordinates strictly redacted unless user is an assigned worker.

- **Worker Applications & Invariant KZ06**:
  - `applyToMission`: Enforces single active application per mission. Duplicates rejected with `409 APPLICATION_EXISTS` returning own `existingApplicationId`.
  - `withdrawApplication`: Preassignment withdrawal transitions application from `SUBMITTED` to `WITHDRAWN`, permitting subsequent re-application.
  - `listWorkerApplications`: Returns worker's own application list.

- **Staff Recruiter Shortlist & Candidate Proposals (`KZ07`)**:
  - `recruiterShortlistApplication`: Recruiter transitions applicant from `SUBMITTED` to `SHORTLISTED`.
  - `recruiterCreateProposalBatch`: Atomic proposal batch dispatch capped at 20 candidates.
  - `getCompanyProposals`: Strictly enforces candidate DTO scoping. Anonymizes worker name (e.g. "Jean-Marc B."), exposes verification badge and trade experience, with ZERO exposure of worker phone numbers, CNI documents, or staff internal notes.

- **API Route Handlers**:
  - `GET /api/v1/missions/[id]`: Safe mission detail.
  - `POST /api/v1/missions/[id]/applications`: Worker application submission.
  - `GET /api/v1/me/applications`: Worker application list.
  - `POST /api/v1/applications/[id]/withdraw`: Worker application withdrawal.
  - `GET /api/v1/staff/missions/[id]/applications`: Recruiter applicants list.
  - `POST /api/v1/staff/applications/[id]/shortlist`: Recruiter applicant shortlist.
  - `POST /api/v1/staff/missions/[id]/proposals`: Recruiter candidate proposals dispatch.
  - `GET /api/v1/companies/[id]/proposals`: Scoped anonymized company proposals.

- **Integration Test Suite (`tests/recruitment_lifecycle.test.ts`)**:
  - 19 test cases covering public missions redaction, duplicate application rejection, preassignment withdrawal, shortlist, candidate DTO privacy scoping, dual confirmation, 24h expiration timer, capacity full gate, schedule anti-overlap gate, and idempotency replay.
  - All 69 project tests passing (`vitest run`).

---

## [1.0.0-D3] - 2026-11-23

### Phase D3: Profiles, Company Verification, Request Draft/Submit/Moderation/Publication

#### Added
- **Private Document Storage Adapter (`src/server/storage/documents.ts`)**:
  - Implements quarantine-based upload intent generation with MIME validation (`PDF`, `JPG`, `PNG`) and 5 MiB size cap.
  - Automated antivirus scan status lifecycle (`PENDING` -> `CLEAN`).
  - Short-lived signed access URLs with 5-minute expiry (`API.md`).
  - Strict tenant and recruiter scope access checks with non-disclosure (404 on out-of-scope access).

- **Company Profile & Review Service (`src/modules/companies/service.ts`)**:
  - Material changes to company legal identity (legal name, RCCM, NIF) automatically reset verification status from `VERIFIED` to `PENDING`.
  - Optimistic locking using `expectedVersion` to prevent concurrent write collisions.
  - Staff recruiter review workflow (`APPROVE` -> `VERIFIED` or `REQUEST_CORRECTIONS` -> `CHANGES_REQUESTED`).

- **Staffing Request Lifecycle & Atomic Publication (`src/modules/requests/service.ts`)**:
  - Draft request creation and submission with validation: daily wage must meet or exceed 5 000 FCFA.
  - Recruiter moderation (`APPROVE` or `REQUEST_CORRECTIONS`).
  - Atomic publication (`KZ04`): Only approved requests from verified companies can be published into an `OPEN` mission with revision 1 terms and schedule days.

- **API Route Handlers (`src/app/api/v1/`)**:
  - `POST /api/v1/documents/upload-intents`: Creates quarantine target for verification files.
  - `POST /api/v1/documents/[id]/complete`: Marks upload complete and queues security scan.
  - `GET /api/v1/documents/[id]/access`: Issues short-lived private access URL for verified documents.
  - `GET /api/v1/requests`: Scoped request list (company sees only own; staff recruiter sees country scope).
  - `POST /api/v1/requests`: Draft request creation for company.
  - `POST /api/v1/requests/[id]/submit`: Company submits request for staff review.
  - `POST /api/v1/staff/requests/[id]/review`: Staff recruiter review transition.
  - `POST /api/v1/staff/requests/[id]/publish`: Atomic mission publication.
  - `POST /api/v1/staff/companies/[id]/review`: Staff recruiter review of company legal profile.

- **Integration Test Suite (`tests/documents_and_requests.test.ts`)**:
  - 12 comprehensive integration tests covering upload limits, quarantine isolation, material change reset, request lifecycle, version conflicts, and atomic publication.
  - All 50 project tests passing.

---

## [1.0.0-D2] - 2026-11-23

### Phase D2: Identity, Auth/Session Adapters, Worker Access, Owner Membership & Staff MFA

#### Added
- **Password Security & Crypto Utilities (`src/server/auth/passwords.ts`)**:
  - Secure PBKDF2 password hashing (100,000 iterations, SHA-512, 16-byte random salt).
  - Timing-safe verification (`crypto.timingSafeEqual`) preventing side-channel attacks.

- **Phone OTP Challenge & Rate Limiting Engine (`src/server/auth/otp.ts`)**:
  - Implements strict limits from `API.md` (line 98): max 3 requests per 15 minutes, 60-second cooldown between resends, 5-minute expiry, and lockout after 5 failed attempts.
  - Generates 6-digit cryptographic verification codes for Gabon telephone numbers (`+241...`).

- **Session Management & Token Storage (`src/server/auth/session.ts`)**:
  - 32-byte cryptographic random session tokens.
  - HttpOnly, SameSite=Lax, Secure cookie configuration.
  - Session validation, automatic expiration handling (7 days default, 24h for staff), and individual or user-wide revocation (logout).

- **Role-Based Access Control & Scope Isolation (`src/server/auth/rbac.ts`)**:
  - `requireCompanyScope`: Enforces tenant isolation. Rejects cross-tenant access with 404 (avoiding existence probing of another company's resources).
  - `requireWorkerScope`: Enforces that workers can only inspect and mutate their own profile and applications (403 for other workers).
  - `requireStaffCapability`: Enforces that staff mutations require staff role, matching country scope (`GA`), granted capability (`RECRUITER`, `FINANCE`, `SUPER_ADMIN`), and mandatory MFA completion (`mfaVerified: true`).
  - Prohibits public signup from ever granting staff privileges.

- **Authentication Route Handlers (`src/app/api/auth/`)**:
  - `POST /api/auth/worker/send-otp`: Initiates SMS challenge with rate limit enforcement.
  - `POST /api/auth/worker/verify-otp`: Validates code, provisions/finds worker profile, and issues session cookie.
  - `POST /api/auth/company/register`: Validates company details, hashes password, and creates owner membership atomically.
  - `POST /api/auth/staff/login`: Authenticates staff credentials and issues MFA challenge ticket.
  - `POST /api/auth/staff/mfa-verify`: Validates MFA code and activates session with verified capabilities.
  - `GET /api/auth/me`: Returns caller identity, active role, company/worker scope, and capabilities.
  - `POST /api/auth/logout`: Revokes active session and clears cookie.

- **Integration Test Suite (`tests/auth.test.ts`)**:
  - 17 test cases covering password hashing, OTP challenge rate limits, session expiration, tenant scope isolation, staff MFA gates, and end-to-end route handlers.
  - Test suite passing at 38/38 tests across the whole project (`vitest run`).

---

## [1.0.0-D1] - 2026-11-23

### Phase D1: Approved Stack Foundations, Typed Config, Prisma Schema & Route Shells
- Prisma logical schema with 24 models matching `DATABASE.md`.
- Typed country & theme configuration resolver with Gabon fallback.
- Zod runtime boundary validation schemas.
- Domain recruitment service enforcing core invariants (KZ06, KZ08, KZ09).
- Next.js App Router route shells and API handlers (`/api/v1/...`).

---

## [1.0.0-D0] - 2026-11-23

### Phase D0: Premium UI/UX Prototype & Design Specifications (Gabon Launch)
- Complete design specifications in `docs/design/`.
- Dynamic token resolver with 17/17 WCAG 2.2 AA contrast pairs verified.
- 24 shared reusable components with specimens gallery.
- Interactive click-through prototype for Workers, Companies, and Administration.
- Responsive simulation (360px mobile, 768px tablet, 1440px desktop) and live theme switching between `gabon-premium@1.0.0` and `forest-premium@1.0.0`.
