# Kazi 1.0.0 implementation and integration correction

Effective 24 November 2026. Specification edition 2.1.0. Product target remains Kazi 1.0.0.

## Owner authorization and priority

The owner now explicitly requests a functioning version 1.0.0: worker mobile-first experience, enterprise experience and administration/staff experience. Keep the existing UI as the implementation baseline and complete the real product integration. Design-only restrictions and any instruction to wait for another D0 design acceptance are superseded for this work. This authorizes implementation and local verification, not unrelated rewrites, public deployment, real external messages, real invoice issuance or destructive production operations.

Read this correction before the older specifications. Merge it into existing repository instructions. Do not erase useful project-specific rules or validated implementation. Follow PRD and WORKFLOWS for business behavior; use this correction for execution mode and runtime-integration priority. Resolve implementation differences with explicit decision notes, not silent assumptions.

## Evidence and diagnosis

The supplied agent report states that the server at http://127.0.0.1:4173 still displays the D0 design baseline and that the next step is connecting UI views to backend API routes. The screenshot shows a Prototype Premium UI/UX header, role tabs, Components D0b and Phase D0 labels. The report claims SQLite persistence, service modules and passing tests; those claims have not been independently verified in this workspace. The actual project source C:\Angy\Kazi was not attached here.

Known gap from the report: frontend integration is unfinished. Additional runtime risk to investigate: the reported build is tsc plus vite build while backend files are named route.ts. A file name or a passing unit test does not prove the running HTTP server mounts those handlers. Vite can proxy to a backend, but the agent must implement and verify the actual runtime path rather than assume Next-style routing exists. Do not change frameworks simply to match an earlier default.

## Required outcome

The main application URL must open a real account/session flow or the authorized user's operational dashboard, not a design playground. All three role experiences read persisted scoped data and send mutations through working server endpoints. Reloading and restarting the backend preserves committed records. Another authorized user sees the same committed request/application/assignment without manual fixture changes. Unauthorized users are denied at the server. SMS/email can remain explicitly unavailable or development-only until credentials exist; this does not prevent completing the local recruitment application.

Do not rebuild the prototype, produce another plan instead of implementation, add fake interactions, or merely remove the word Prototype. Keep approved visual design, responsive behavior, semantic themes and the Gabon configuration. Future versions evolve the existing product and data through versioned design/feature changes, not a fresh disconnected application per release.

## Integration work in execution order

### I0 Inspect the running entry points

Inspect package.json, Vite configuration, index.html, the frontend entry/router, server bootstrap, API registration, auth/session middleware, SQLite initialization/migrations, services and tests. Read PROGRESS/CHANGELOG/DECISIONS but verify their claims. Find fixture arrays, simulated delays, localStorage-only domain records, mock service workers, fake-success handlers, actor headers, default-role selection and UI service imports. Mark every view as persisted, partially wired, simulated, missing or not tested.

Record the frontend/backend start commands, listening addresses, mounted routes and database file path without secrets. Verify which process serves port 4173 and whether it is an obsolete prototype task. Do not kill unrelated processes. Replace only the identified obsolete Kazi task after the working application starts. Reopen the correct URL and verify the page belongs to the current build rather than relying on a cached tab.

### I1 Mount a working backend and browser path

Reuse existing server/runtime if valid. Otherwise add the smallest Node HTTP routing/bootstrap layer compatible with the existing services and Node SQLite runtime. Register HTTP routes, parse and validate requests, enforce session and scoped authorization, and return documented DTO/error formats. Ensure route.ts modules are actually called by the server. Do not import node:sqlite or private services into the browser bundle. Do not migrate the app to Next.js or PostgreSQL merely to connect the current UI.

Use a same-origin /api path. In Vite development, configure an explicit proxy to the real backend or use the existing supported integration; verify cookie behavior, origin checks and all needed route prefixes. A development proxy does not establish the production serving path: document and test the later application server/reverse proxy arrangement separately. Never configure permissive wildcard CORS as an authentication workaround.

Provide a safe readiness endpoint if absent. Check that /api requests return the expected JSON/content type, not an SPA index.html with status 200. Show an honest API unavailable state if the backend is stopped; never fall back to demo success. Supply root start scripts for frontend plus backend, or a single documented orchestration command, only after verifying the actual commands work. Do not claim a new npm script exists before creating it.

### I2 Sessions and real role entry

Wire signup/login/logout/recovery to the actual server-side identity/session layer. Worker enters their own mobile-first workspace; company member enters their own company; staff sees only granted country/capability scopes. Protected routes load session state and handle loading/expiry/denial. Frontend role tabs or x-role/x-user headers cannot grant authorization. A workspace switcher is allowed only for roles actually granted to the authenticated identity and must still be server-checked.

Keep synthetic fixtures as database seed inputs for isolated local/test accounts, not role-switcher state. If real OTP dispatch is unavailable, implement an explicitly development-only verification harness that exercises real sessions and persisted test identities, is inaccessible outside development/test and makes production startup fail if enabled. Do not invent provider delivery or print real codes in logs. Document exactly what is mocked; protected domain actions must still use real server sessions.

### I3 First connected vertical slice

Complete this through the rendered UI before wiring every secondary screen:

1. Company signs in, submits a staffing request and sees its saved identifier/status after reload.
2. Recruiter in a separate authenticated context sees the request, reviews it and publishes the mission.
3. Worker in a separate context sees the mission and applies; a persisted application is created for the signed-in worker.
4. Recruiter sees that actual application, shortlists it and proposes the worker to the company.
5. Company sees only its proposed candidate and accepts; worker sees a pending availability confirmation.
6. Worker confirms the current terms; the system displays waiting for Kazi finalization, not a premature assignment.
7. Recruiter finalizes with capacity/overlap/idempotency checks. Company roster and worker assignment show the same persisted assignment.
8. Refresh all views and restart the backend; the same records and confirmations remain.

Use API-returned IDs and authoritative statuses. Remove fixture writes and silent mock fallbacks from these routes. Each successful mutation invalidates/refetches relevant scoped queries. Keep form input on validation failure. Show stale-version conflicts, expired confirmation and duplicate submission responses correctly. Optimistic local state cannot be the only record of a business mutation.

### I4 Connect the remaining version 1 screens

Wire profile/company settings and document states, request edits/cancellation/terms revision, attendance declaration and worker dispute, absence/replacement, Kazi support cases and private-note filtering, in-app notifications, service quotes/acceptance, SAMPLE invoice views, verified service-fee receipt/reversal, staff grants/config/audit where already included. Never connect UI directly to the SQLite file. If an advertised secondary function is incomplete, finish it or explicitly mark it unavailable; do not show fake success.

Do not enforce a hardcoded 18 percent tax rate merely because the previous report claimed it. An actual approved country/invoice policy is required. Until then keep billing explicitly SAMPLE and avoid describing a tax assumption as verified Gabon law. Retain the separation between worker remuneration and Kazi service fees. Reconcile the reported negative reversal-entry implementation with DATABASE.md's positive-amount reversal contract: choose one documented consistent model, preserve historical integrity and verify balances, duplicates and reversals. Do not transform existing financial rows blindly.

### I5 Replace playground chrome and verify persistence

Default entry is the operational app. Move optional design specimens/theme comparison to development-only /dev/design or another explicitly restricted route. Remove Prototype, Phase D0, Components D0b and device-preview controls from normal user navigation. Retain version metadata without implying an approved public release. Move the WCAG 17/17 claim to an accurately named developer contrast-pair check; the theme validator is not a full accessibility audit.

Configure durable database paths and migrations. Never reseed, recreate, delete or reset ordinary application data on each request or restart. Seed only through an explicit development/test command. Keep test databases separate, and never wipe the user's development database as a test cleanup step. Preserve existing data with a backup before necessary migrations. Local SQLite operation and future PostgreSQL production suitability are separate decisions, not an untested automatic migration claim.

### I6 Prove the actual connected application

Write browser end-to-end tests with the real running frontend, HTTP backend and test database, not intercepted fake API responses. Use separate authenticated browser contexts for company A, company B, worker and recruiter. Verify all eight steps in I3 with server/database assertions and reload/restart persistence. Validate company B cannot access A's data, worker cannot act as staff and expired/replayed sessions are rejected.

Add a concurrent last-slot test against the SAME database and same mission; isolate unrelated tests as needed but do not call separate-database parallel runs proof of contention safety. Include overlapping assignment and duplicate-finalization tests. Verify network failure creates an honest error, not a fabricated record. Demonstrate worker layout at 360px and enterprise/staff layouts at 768/1440px. Repeat a representative connected flow under both themes; color changes must not affect permissions or saved records.

Keep existing service/unit tests, typecheck and build. They are useful but insufficient to prove UI/server integration, actual API hosting, full accessibility or production readiness. Record pass/fail evidence and distinguish tests executed, mocked, skipped and manual checks. Do not claim every phase complete based solely on a passing service suite.

## Completion report and acceptance gate

Return the actual working application URL, verified startup commands, backend status, persistence location, synthetic test account setup, UI-to-endpoint mapping, changed files, browser-to-database test evidence, remaining mocks and exact limitations. Include evidence IDs for one request, application and assignment created through the UI, with personal data redacted. Report these statuses separately:

- LOCAL_APPLICATION_FUNCTIONAL: connected workflows, real sessions and persistence verified locally.
- PRODUCTION_READY: separate operational/security/provider/commercial checks complete.
- PUBLICLY_DEPLOYED: separate authorized deployment actually observed.

Do not mark LOCAL_APPLICATION_FUNCTIONAL until all three workspaces operate through real APIs and the core flow survives refresh/restart. Missing external credentials may block a provider or launch, but not justify another prototype-only result. Continue implementation of all unblocked parts. Report a real blocker immediately, finish independent tasks, and do not invent successful credentials, tests, migration or deployment.

## Future release continuity

Freeze a tested 1.0.0 baseline, then evolve themes and UI components in later versions with semantic tokens, migrations only when needed, retained records and regression tests. A redesign should connect to the existing domain/API contracts or a deliberate compatible extension. Never use the next visual version as a reason to abandon a partially integrated current release. Separate design revision, product release and theme/config version numbers.

## References checked for the runtime diagnosis

Vite build bundles the frontend by default: https://vite.dev/guide/build.html
Vite development proxy configuration: https://vite.dev/config/server-options#server-proxy
These references explain why the runtime must be inspected; they do not establish what the unattached repository actually does.
