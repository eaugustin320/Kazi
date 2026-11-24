# Operations and security baseline

## Identity and access

All protected requests enforce user identity, account status, capability, company ownership, country scope and resource-specific access. Staff require MFA. Membership and staff changes are privileged and audited. Sessions expire and can be revoked. Phone/email recovery must verify the appropriate channel; do not merge identities based on a guessed name or a replacement phone entered in a profile form. Provide a support escalation procedure for lost access without publishing a fabricated contact.

Keep personal data minimal. Do not expose private documents or staff notes to companies. Candidate DTOs are explicit allowlists. Public mission pages show no worker identity or internal company contact. Signed private links are short-lived and scoped; storage bucket is not public. Production logs redact credentials, codes, tokens, full phone numbers and message/document contents. Define policy-approved retention before real document collection. Technical controls do not themselves establish legal compliance.

## Outbox and providers

Use event IDs, leases and deduplication. Repeated business commands must not send repeated irreversible messages or record duplicate receipts. Use a configurable maximum of 5 transient-delivery attempts with backoff and a visible failure queue; OTP attempts follow the stricter auth challenge policy and are never retried past expiry. Provider signatures/replay windows follow that provider's current official specification. Sending is not delivery; delivery is not reading. Retain useful redacted status for support.

## Commercial operations

Recruiters manage selection, finance records Kazi invoices/receipts and administrators manage permissions/config. No recruiter changes finance totals without the finance capability. Verification of an external service-fee receipt is a deliberate staff action with reference and reason; no front-end checkbox alone proves payment. Wage disputes are support cases, not permission to record a Kazi payroll transaction. Approve company-facing terms, document policy, invoice details and escalation responsibilities before real launch.

## Monitoring and recovery

Track application errors, API failures, assignment conflicts, outbox age/failures, OTP delivery outcomes and rejected callbacks. Use request IDs and aggregate metrics, not message content. Alert only to an approved operational destination; none is configured by this pack. Define owner and response steps. Proposed pilot targets: investigate sustained failures or stuck confirmations promptly; operational SLO, RPO and RTO values require hosting and staffing agreement, not invented guarantees.

Back up database and private objects under approved retention/access controls. Perform a staging restore with sample records and inspect referential integrity, private-object access and invoice snapshots. Keep a recovery runbook and last tested date. Use deployment health checks, configuration validation and a critical synthetic workflow. No claim of readiness without real results.

## Production prerequisites

Approved market/service area and support staff; selected and tested GA phone delivery; verified email/domain; reviewed identity-document/retention process; approved remuneration and recruitment terms; finance/tax configuration; enabled private storage and scan policy; real secrets isolated by environment; tested backups and rollback; required QA and security evidence. These are production dependencies; they must not block D0 synthetic design work.
