# Kazi implementation architecture

## Status and default stack

This is the working reference architecture for D1 onward, not a claim that dependencies are installed or a deployment is approved. If a compatible repository already exists, preserve it and document justified adaptations before introducing a second stack.

Use a single TypeScript web application with Next.js App Router for responsive UI and same-origin route handlers; PostgreSQL for transactional records; Prisma for typed data access and migrations; Better Auth for identity/session management with approved phone and two-factor capabilities; Zod for boundary validation; CSS custom properties/modules for styling; Vitest and Testing Library for focused checks; Playwright for critical browser workflows. Use a maintained accessible headless dialog/menu primitive only when needed. Do not add a second API server, microservices, GraphQL, Redis or a large state-management package without evidence of need.

Before setup, resolve current mutually compatible stable releases from official documentation, record exact versions and runtime support in a dependency decision, and commit the lockfile. Do not copy obsolete Prisma/auth examples from this pack: it deliberately defines contracts rather than version-specific generated code. Use a supported Node LTS and supported PostgreSQL major version verified at setup. Any stack change requires a decision entry, not a complete rewrite by default.

## Layers and data flow

Route/view -> validated input -> session and authorization -> domain service -> scoped repository -> database transaction -> outbox/audit -> response. Server Components may read through the same service layer without an internal HTTP round-trip. Mutations go through versioned route handlers, not parallel duplicate business logic in Server Actions. Client code receives explicit DTOs, never full database records. Avoid shared caching of authenticated per-company data; cache only explicitly public or correctly scoped/versioned data.

One deployable app and one small worker entry point share domain code and the database. The worker handles outbox deliveries and scheduled expiry/notification retries; use an authenticated scheduler or process with leases/advisory locking. A simple database queue is sufficient initially. No external provider call runs inside an open assignment transaction. Retry transient failures with bounded backoff; record a dead-letter state after configured attempts for staff review.

## Suggested structure

- src/app: public, worker, company and admin route groups; api/v1 domain handlers; api/auth provider handlers.
- src/components/ui: neutral reusable components; src/components/domain: mission/candidate/attendance components.
- src/config: validated theme and country resolver; src/i18n: French catalog and formatters.
- src/modules/identity, companies, recruitment, missions, support, billing: domain validation, services, repositories, DTOs and tests.
- src/server/auth, db, storage, notifications, audit, jobs: server-only adapters.
- prisma: schema and numbered migrations; scripts: safe seed, verification and jobs.
- tests: integration, e2e, fixtures; docs/kazi: these specifications; public/brand: immutable assets.

## Identity and authorization

Use Better Auth's supported database/session integration; derive its tables from the selected pinned release. Workers sign in with phone OTP; company owners use verified email/password with recovery; staff are provisioned by authorized administration and require MFA before accessing staff routes. Do not link accounts solely by a user-supplied email or allow public role selection to grant staff status. Use secure HttpOnly same-site session cookies, validated origin/CSRF protection and server-checked capability grants. Provider identity does not replace application authorization. Verify phone delivery in GA with the selected provider before production rollout.

## Storage and providers

Define SMS, email and private-storage adapters. Development implementations use synthetic/local fixtures; production refuses mock providers. Use S3-compatible private object storage for verification documents with server-mediated authorization and short-lived access links. Validate upload size, content type and file signature, quarantine until scan policy passes, and never serve user uploads as executable HTML. Keep external provider keys server-side. Do not install a payment gateway or collect worker salaries in v1.

## Environments

Local, test, staging and production must have distinct database/storage/provider accounts or isolated scopes. Required server variables include DATABASE_URL, AUTH_SECRET, AUTH_BASE_URL, APP_ORIGIN, SMS_PROVIDER, EMAIL_PROVIDER, STORAGE_ENDPOINT/BUCKET/REGION and relevant credentials, JOBS_SECRET and LOG_LEVEL. Names are implementation contracts to finalize against chosen adapters; public variables contain no secrets. NEXT_PUBLIC values, if used, are safe nonsecret presentation metadata only. APP_VERSION, spec edition and config registry version are separate values. Production startup checks required providers/policies, HTTPS origins and disabled debug bypasses.

## Reliability and deployment

Use structured redacted logs with request IDs and observable provider failure states. Validate migrations in staging, take a restorable backup, deploy compatible schema changes before dependent code, smoke-test the core journey, and keep a previous application artifact/config pointer. Prefer expansion then backfill then contraction for breaking data changes. Hosting and provider accounts remain open operational decisions; choose only after cost, regional coverage, storage needs and runtime compatibility are checked. No live deployment is authorized by this specification alone.
