# Kazi implementation plan

Complete small tasks and keep a progress note. A phase is finished only when its acceptance checks pass. Do not advance from design to application implementation without owner acceptance. No time or cost estimates are commitments in this pack.

| Phase | Deliverable and likely modules | Prerequisites and verification |
| --- | --- | --- |
| D0a | Repository/asset inventory, screen matrix linked to KZ IDs, flow diagrams and conflict list; docs/design | Read pack; distinguish existing screenshots from runnable UI; identify missing states |
| D0b | Token resolver prototype, GA configuration, shared component specimens; config, components/ui | Validate both themes; no raw page colors; keyboard and contrast checks |
| D0c | Local worker mission discovery/detail/apply/confirm click-through; prototype worker views | Synthetic data; success, expiry, duplicate, withdrawal, unavailable and error states |
| D0d | Company request/proposals/decision/attendance and staff review/selection/finalize click-through | Distinct confirmation states; no production APIs or real contacts |
| D0e | Responsive/state review, theme-switch proof, handoff and usability findings | Inspect 360/768/1440 layouts, accessibility; owner reviews completed design |
| D1 | Approved stack foundations, route shells, typed config, lint/type/test scripts; src/app, config | D0 accepted; verify current compatibility, lock dependencies, build runs |
| D2 | Auth/session adapters, worker access, owner membership and staff MFA/capabilities | D1; auth schemas/migrations; test account linking, session expiry and cross-scope access |
| D3 | Profiles, company documents/review, request draft/submit/moderation/publication | D2; document storage and relevant tables/API; scan/access/verification tests |
| D4 | Public missions, application/withdrawal and staff shortlist/proposal | D3; unique application and DTO scoping; published-only and duplicate tests |
| D5 | Company/worker decisions, proposal expiry, assignment capacity and overlap checks | D4; transactions, schedule constraints, idempotency; concurrent last-slot tests |
| D6 | Attendance, worker disputes, absence/replacement and bilan | D5; affected-day coverage and event history; no double-booking under replacements |
| D7 | Support cases/threads, in-app notifications, outbox, approved SMS/email adapters | D2-D6; safe failure/retry, private-note and callback verification tests |
| D8 | Service quote/acceptance/invoice/receipt views and finance capability | D5 plus commercial inputs; immutable snapshot and duplicate receipt tests; use SAMPLE until issuance policy complete |
| D9 | Theme/config administration and audit integration | Shared config foundation plus D2; privileged activation, invalid-config fallback and visual regression |
| D10 | Staging, security/QA, performance, recovery and release audit | Implemented scope; no critical failed tests; required commercial/legal/provider decisions complete |

## First task to assign now

Run D0a and D0b. Create a screen inventory with role, route, KZ requirement, primary action and required states. Create or update a local design prototype using semantic tokens from config, then show the same representative worker, company and staff views under both theme presets. Do not create production schemas, integrations or a live deployment. Continue through D0c-D0e to deliver a reviewable premium UI/UX package.

## Later feature task template

Task ID and target version; requirement ID; user role; current behavior; required behavior; affected modules; state transitions; data/API changes; acceptance cases; explicitly excluded work. Inspect existing code and implement one vertical slice. Report actual tests, files and remaining issues. Feature flags default off until accepted, but cannot disable authorization or business constraints.

## Future release procedure

Classify as presentation-only, compatible feature, country rollout or breaking contract change. Review VERSIONING.md and the country/theme contract. Update specifications and migration plan before dependent code. Keep existing GA behavior working under automated regression checks. Finish the current stable phase rather than mixing a new country, authentication rewrite and palette update in the same change.
