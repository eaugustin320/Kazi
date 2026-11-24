# Kazi agent instructions

## Immediate mode

Default mode is DESIGN_ONLY, phase D0. Complete UI/UX deliverables first. This pack authorizes design artifacts and local prototype work, not a live launch. Later phases require the owner's instruction to proceed. Deliver concrete reviewable work before seeking an acceptance decision. Do not treat every routine choice as a permission gate.

## Source of truth

Read START_HERE.md and the relevant specifications. Owner instructions prevail. Preserve PRD business invariants and WORKFLOWS state rules over illustrative mockups. Machine-readable country/theme values in config are authoritative over duplicated palette examples; validate them against DESIGN and THEMING_AND_COUNTRIES. ARCHITECTURE applies to implementation after design acceptance. Record a conflict and resolve only the dependent work; continue independent work. Do not manufacture approval or missing credentials.

## Nonnegotiable product boundaries

Workers never pay recruitment fees. Companies pay workers directly. Kazi invoices only its own recruitment service. Kazi staff perform selection; company approval is separate from worker confirmation. An accepted proposal is not an assignment. Never allow a visual theme, country selector or feature flag to bypass these rules or server authorization. No public signup grants staff privileges.

## Engineering conduct

Inspect existing files, dependencies and tests before editing. Reuse components, services and conventions. Keep TypeScript strict; no unexplained any or suppressed errors. Separate presentation, validation, domain services and persistence. Client components cannot import private database or provider modules. Use shared runtime validation at boundaries. Use semantic tokens, translation keys and formatters; no raw brand colors or Gabon-specific branches in page components. Icons have labels where needed.

Add dependencies only for a clear need; prefer established libraries, pin actual resolved versions and commit a lockfile. Do not assume an installed framework matches a future documentation example. Keep one product with modular services, not country-specific forks or premature microservices. Preserve minimal vertical slices and focused diffs. Never rewrite unrelated code or silently alter a schema or contract.

## Security and changes

Every protected service checks identity, role, country and company or worker scope. Never trust a requested companyId without membership authorization. Private verification documents and staff notes are not company candidate data. Do not log OTPs, credentials, document contents or full phone numbers. Use synthetic data in design, tests and demos. No production secret, deployment, real SMS, invoice dispatch, deletion or destructive migration without the relevant operational authorization.

Use migrations for database changes and transactions for business transitions. Make externally retried actions idempotent. Preserve audit records and financial history. Do not run the original 20 stage instructions as a single automatic batch. Optional MCP integrations are development tooling, not a prerequisite for Kazi.

## Verification and reporting

For each task report goal, changed files, checks actually run, failures, limitations and next task. Run meaningful affected checks. Test role and tenant boundaries, state transitions and concurrency before treating the recruitment loop as complete. Include loading, empty, error, success, permission-denied and offline/retry states. For UI, inspect 360, 768 and 1440 px layouts and both provided themes. A passing token check does not imply WCAG conformance or application readiness. Do not claim code is implemented, deployed, approved or tested without evidence.

## Workflow continuity

Maintain a progress note with current phase, completed requirement IDs, unresolved issues, next task and verification evidence. Update it before a handoff or interruption. Retain a CHANGELOG and ADR-style entries in DECISIONS.md. Theme-only work must not introduce auth, database or recruitment-flow changes.
