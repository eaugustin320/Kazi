# Kazi API contract

## Conventions and access

Domain base path /api/v1. JSON UTF-8, UUID identifiers except opaque auth IDs; ISO 8601 UTC instants, YYYY-MM-DD dates and integer minor-unit amounts. Same-origin session authentication. Auth provider owns /api/auth/*; use its pinned supported endpoints behind documented client/service adapters rather than inventing incompatible auth routes. Staff MFA and capability checks precede staff mutations. No browser-to-database access.

Success: {"data": ..., "meta": {"requestId": "..."}}. Lists add {"nextCursor": "opaque-or-null", "limit": 20}. Default limit 20, maximum 100, stable order created_at/id; return no unbounded full directory. Error: {"error": {"code": "MISSION_CLOSED", "messageKey": "errors.missionClosed", "fields": {}, "requestId": "..."}}. Translate messages in UI; never expose SQL, stack traces or existence of another tenant's private resource.

Use 400 malformed, 401 unauthenticated, 403 capability denied where existence is safe, 404 missing/out-of-scope private resources, 409 conflict/stale state, 422 field validation, 429 throttled with Retry-After and 503 transient unavailable. Redact logs. Server never trusts role, status, fee, country or ownership changes from a generic PATCH payload.

Mutations require Idempotency-Key for applications, request submit/publish, proposal creation/decisions, assignment finalization, replacement confirmation, attendance resolution, quote acceptance, invoice issue and receipt recording. Store actor/route/key/request hash; replay identical completed requests, reject mismatched reuse, preserve in-flight conflicts. Retain operational keys at least 48h; durable unique business constraints still protect beyond expiry. On workflow aggregates include expectedVersion; stale values return 409 with a safe refresh instruction. All writes use CSRF/origin protection for cookie sessions.

## Endpoint inventory

| Method and path | Actor | Request and result |
| --- | --- | --- |
| GET /public-config?country=GA | Public | Enabled country, locale and active theme metadata; no secrets or operational policies |
| GET /missions | Public | Filters country, area, trade, startFrom, cursor; published safe summaries only |
| GET /missions/{id} | Public/worker | Safe mission details/current terms; precise meeting data only for eligible assignment |
| GET/PATCH /me/preferences | Signed-in owner | Own notification and supported-locale preferences, allowlisted keys |
| GET/PATCH /me/worker-profile | Worker | Own allowlisted fields; server country and verified-channel checks |
| POST /companies | Signed-in owner | Registration fields; creates company and own membership atomically |
| GET/PATCH /companies/{id} | Member | Own allowed profile fields; verification affected by material changes |
| POST /documents/upload-intents | Owner/worker | purpose, declared type/size and scoped owner; returns quarantine upload target |
| POST /documents/{id}/complete | Uploader | Verifies upload metadata, queues scan; never self-approves a document |
| GET /documents/{id}/access | Authorized owner/reviewer | Short-lived private access after scope and scan checks |
| POST /requests | Company | Draft validated need; returns id/version |
| GET /requests | Company/staff | Tenant- or capability-scoped list, not all-country implicit access |
| GET/PATCH /requests/{id} | Company/staff | Detail or allowed draft changes with expectedVersion |
| POST /requests/{id}/submit | Company | Complete fields; DRAFT -> SUBMITTED |
| POST /requests/{id}/cancel | Company/staff | reason and expectedVersion; published cancellation needs staff workflow |
| POST /staff/companies/{id}/review | Recruiter | APPROVE or REQUEST_CORRECTION, reason, version |
| POST /staff/requests/{id}/review | Recruiter | APPROVE or REQUEST_CORRECTION, reason, version |
| POST /staff/requests/{id}/publish | Recruiter | Approved request/company; creates terms/days/mission atomically |
| POST /staff/missions/{id}/close-applications | Recruiter | expectedVersion; stops new applications without cancelling existing assignments |
| POST /staff/missions/{id}/start | Recruiter | expectedVersion; confirmed roster and explicit partial-fill acceptance if needed |
| POST /staff/missions/{id}/cancel | Recruiter | reason/version; affects assignments and notifies parties with retained history |
| POST /staff/missions/{id}/terms-revisions | Recruiter | Validated replacement terms/reason; applies change-pending workflow |
| POST /missions/{id}/applications | Worker | termsId; ignores client worker identity, returns application |
| GET /me/applications | Worker | Own application list and safe progress |
| POST /applications/{id}/withdraw | Worker | reason, expectedVersion; preassignment withdrawal only |
| GET /staff/missions/{id}/applications | Recruiter | Country-scoped applicants and shortlist states, paginated |
| GET /staff/workers | Recruiter | Scoped search/filter; identity documents excluded from list |
| GET /staff/workers/{id} | Recruiter | Profile and scoped verification fields |
| POST /staff/applications/{id}/shortlist | Recruiter | reason, expectedVersion; eligible candidate only |
| POST /staff/missions/{id}/proposals | Recruiter | applicationIds, termsId; limited batch, validates all before commit |
| GET /companies/{id}/proposals | Company member | Only own proposed candidate DTOs |
| POST /proposals/{id}/company-decision | Company member | ACCEPT or DECLINE, expectedVersion; pending worker is explicit |
| POST /proposals/{id}/worker-decision | Proposed worker | CONFIRM or DECLINE, termsId, expectedVersion; company acceptance required |
| POST /staff/proposals/{id}/finalize | Recruiter | expectedVersion; atomic capacity/schedule/terms checks |
| GET /assignments/{id} | Assigned worker/company/recruiter | Scoped assignment terms and relevant daily records; no internal notes |
| GET /me/assignments | Worker | Own confirmed, current and past assignments |
| GET /missions/{id}/roster | Company/recruiter | Company-scoped roster with minimal needed worker fields |
| POST /assignments/{id}/unavailability | Assigned worker | dates/reason, expectedVersion; creates traceable staff task |
| PUT /assignment-days/{id}/attendance | Company | declaredStatus, minutes, note, expectedVersion |
| POST /attendance/{id}/worker-decision | Worker | CONFIRM or DISPUTE plus declarationRevision |
| POST /staff/attendance/{id}/resolve | Recruiter | resolution, reason, expectedVersion |
| POST /replacement-requests | Assigned worker/company | assignmentId, affectedDayIds, reason; no assignment fabricated |
| GET /replacement-requests/{id} | Case parties/staff | Safe status and proposed outcome |
| POST /staff/replacement-requests/{id}/confirm | Recruiter | replacementProposalId; finalize and adjust coverage atomically |
| POST /staff/missions/{id}/close | Recruiter | bilan/reconciliation decision and expectedVersion |
| POST/GET /support-cases | Worker/company/staff | Scoped create/list with category/mission/reporter context |
| GET /support-cases/{id} | Case parties/staff | Authorized thread; filters staff-only content |
| POST /support-cases/{id}/messages | Case parties/staff | body, visibility; only staff can set STAFF_ONLY |
| POST /staff/support-cases/{id}/transition | Staff | status/reason/version with valid transition |
| POST /staff/quotes | Finance | Company/mission, service lines, currency, expiry; draft |
| POST /staff/quotes/{id}/send | Finance | Valid quote snapshot; records sent state and notification |
| GET /companies/{id}/quotes | Member | Own quotes and revisions |
| POST /quotes/{id}/decision | Company | ACCEPT or DECLINE, expectedVersion |
| POST /staff/invoices | Finance | acceptedQuoteId; draft with snapshot data |
| POST /staff/invoices/{id}/issue | Finance | required legal/tax configuration and version; assigns unique number |
| GET /companies/{id}/invoices | Member/finance | Own service-fee invoices |
| GET /invoices/{id} and /invoices/{id}/download | Owner member/finance | Scoped immutable invoice or secure PDF |
| POST /staff/invoices/{id}/receipts | Finance | amount/currency/reference/receivedAt/evidence note; verified external receipt |
| POST /staff/receipts/{id}/reverse | Finance | reason; compensating entry, never deletion |
| GET /me/notifications | Signed-in | Own notifications, cursor |
| POST /me/notifications/{id}/read | Owner | Idempotent read timestamp |
| POST /staff/config/preview | Administrator | registered countryConfigVersion/themeId; no persistent activation |
| POST /staff/config/activate | Administrator | registered versions, reason, expectedActivationVersion; audited pointer change |
| GET /staff/team | Administrator | Authorized country staff and granted capabilities |
| POST /staff/team/provision | Administrator | Account identity and country capabilities; controlled provisioning, no public staff signup |
| PATCH /staff/grants/{id} | Administrator | Allowlisted capability/status change with reason/version, audit and session revocation as needed |
| GET /staff/audit | Authorized admin | Country-scoped redacted audit list |
| POST /webhooks/{provider} | Verified provider | Signature + replay window/event ID checks before ingest |

For multi-action batches return one deterministic atomic outcome or explicitly document per-item responses; never show 'all accepted' after partial failures. Default proposal batch maximum 20. File upload limit defaults 5 MiB per document, JPG/PNG/PDF only, with actual content and malware policy checks. Case message body plain text <=4000 characters, no executable HTML.

## Examples

Application request: POST /missions/{id}/applications with {"termsId":"uuid"}; identity comes from the session. Duplicate returns 409 APPLICATION_EXISTS with own existingApplicationId, never another user's identifier.

Finalization response: {"data":{"assignmentId":"uuid","status":"CONFIRMED","termsId":"uuid"},"meta":{"requestId":"..."}}. Conflicts include CAPACITY_FULL, WORKER_OVERLAP, CONFIRMATION_EXPIRED, TERMS_CHANGED and VERSION_CONFLICT. Do not retry an expired confirmation automatically.

Country/theme activation accepts registered IDs only, not a user-supplied raw palette. Expected-version conflict protects concurrent administrator changes. Preview values never change country membership or fees.

## Abuse, privacy and integrations

Initial configurable limits: OTP send 3 per phone/15 minutes and 20 per IP/hour; verification max 5 attempts per challenge, 5-minute expiry, resend cooldown 60 seconds; signed-in domain mutations 60/minute per user; application submit 10/hour per worker; private download links expire after 5 minutes. Verify the selected auth provider supports these requirements and implement shared persistent throttling where needed. Do not use per-process memory as the only production limiter. Tune from measured abuse/support data with an audited change.

Provider webhooks must be implemented against the selected provider's official signing specification; no generic invented signature algorithm. Unauthorized callbacks have no side effects. A callback's 'delivered' status is not proof a human read it. Use bounded retries only for transient safe operations; use idempotency for external effects. Payment gateway and payroll integrations are outside v1. Provider credentials and admin jobs secrets are server-only, distinct by environment and never appear in public config.
