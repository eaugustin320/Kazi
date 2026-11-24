# Kazi QA and release criteria

## Evidence matrix

| Area | Required checks |
| --- | --- |
| Worker | Login/recovery, profile errors, discovery, application duplicate, withdrawal, confirmation expiry, own-data access |
| Company | Verification, request correction, publication boundary, own proposals only, decision, presence and own invoices |
| Staff | MFA/country grants, request review, shortlist, both confirmations, assignment, replacements, support and finance separation |
| Concurrency | Last slot, overlapping worker interval, repeated confirmation/finalization, replacement competing coverage, duplicate receipt |
| State changes | Stale expectedVersion, material terms revision, proposal expiry, company suspension, withdrawn worker, closed mission |
| Accessibility | Keyboard/focus/dialog behavior, labels/live errors, zoom/reflow, readable contrast, reduced motion, touch controls |
| Responsive | Actual 360/768/1440 layouts for all roles; no clipped primary action or unreadable table |
| Theme | Both presets, focus/hover/disabled/status states, missing/unknown theme fallback, SSR hydration match |
| Country | GA locale/currency/timezone, disabled country rejection, explicit staff scope, invoices retaining historic snapshots |
| Providers | SMS/email failure, callback spoof/replay, timeout, duplicate delivery, outbox retry/dead letter, mock rejected in production |
| Documents | MIME/size/signature/scan, unauthorized download, expired link, private note/ID not in candidate DTO |
| Finance | SAMPLE draft, quote acceptance, issue prerequisites, no salary lines, immutable invoice, receipt reversal and no over-allocation |

Use unit tests for formatters/validation/transitions, real PostgreSQL integration tests for constraints/transactions, component tests for critical forms and Playwright for complete role journeys. Test with two companies, multiple workers and different staff permissions. Synthetic data only. Token-script results are configuration evidence, not a substitute for UI review or real provider testing.

## Design acceptance gate

D0 delivers screen/state inventory, coherent reusable components, worker/company/staff click-throughs, both theme examples, responsive checks and unresolved findings. Demonstrate that changing colors does not change data or steps. Capture owner acceptance and design revision in DECISIONS.md before D1. A prototype may simulate actions but must not imply live identity verification, wage payment or real placement.

## Application release gate

Run build, lint, type checks, affected unit/integration and critical e2e tests. Verify backups by restore, not merely by existence. Review capability isolation, private storage, provider coverage, legal/commercial owner decisions and real staff support procedure. Validate startup configuration, HTTPS, monitoring, synthetic staging smoke tests and rollback artifact. No critical security or data-integrity failure can be labeled a cosmetic warning.

Release report lists READY, READY WITH WARNINGS or NOT READY, exact product/config/theme/schema versions, evidence, failed/skipped/manual checks, unresolved risks and the person responsible. A report is not an automatic live-deployment instruction. Publishing, external messages and production migrations require the corresponding authorization.

## Regression and rollback

Keep last-known-good application/config/assets and recovery point. Theme-only rollback changes the country-theme pointer and requires no business data migration. Application rollback is permitted only if schema/API compatibility is demonstrated; otherwise use forward repair. Test failure after partial outbox delivery, stale cached config and concurrent rollout. Preserve audit and financial history during recovery.
