# Kazi business workflows

The server owns transitions; UI labels are translated views of stable machine codes. Never derive a status from a chip color or count. Every transition checks authorization, current status, terms revision and idempotency where applicable.

## Request and mission

Request: DRAFT -> SUBMITTED -> UNDER_REVIEW -> APPROVED or CHANGES_REQUESTED; CHANGES_REQUESTED -> DRAFT -> SUBMITTED. Company may cancel a draft or submitted request; cancellation of a published mission is coordinated by staff, with notification and affected-assignment records. A verified company is required to publish. Request approval precedes publication. Publication creates the mission, immutable terms and days and records the publication event in one transaction; it cannot publish an unapproved request.

Mission: OPEN -> CLOSED_TO_APPLICATIONS -> IN_PROGRESS -> COMPLETED; OPEN or CLOSED_TO_APPLICATIONS can become CANCELLED through a staff action with a reason. Start requires at least one confirmed assignment. A mission can start partially filled only if the company explicitly accepts the actual roster. Completion requires an attendance reconciliation and recorded outstanding-issue decision; do not mark a dispute resolved just to close a mission.

Store versioned mission terms. Material changes include dates, hours, site, trade, remuneration, equipment and headcount reduction affecting people. Do not mutate published terms in place. Pause new confirmations, create a new terms version, invalidate outstanding proposals and seek fresh confirmations from affected participants. Confirmed affected assignments become CHANGE_PENDING and cannot count as ready for the new terms. Staff creates replacement assignment records referencing the new accepted terms after resolution; preserve old records. Increasing unfilled capacity without changing individual terms may be nonmaterial but must be recorded.

## Application and proposal

Application: SUBMITTED -> SHORTLISTED -> PROPOSED -> ASSIGNED; SUBMITTED or SHORTLISTED -> WITHDRAWN or NOT_SELECTED. A not-selected or withdrawn application does not silently reactivate; v1 allows only one application record per worker/mission. Staff can reopen with an audit reason before a new proposal, retaining history. Only OPEN missions accept applications. A proposed applicant declining availability remains in history and is not auto-reproposed.

One active proposal per worker/mission/terms version. Proposal includes companyDecision=PENDING|ACCEPTED|DECLINED and workerDecision=PENDING|CONFIRMED|DECLINED with timestamps and expiresAt. Company may review while availability is pending. Worker confirmation invitation is sent only after company acceptance. Pending proposals expire after the earlier of 24 hours from company acceptance or mission start; shorten to the mission-start time if needed. This is a configurable operational default, not a guaranteed response time. On expiry a new proposal is needed; prior consent is not reused automatically.

Company acceptance + worker confirmation + approved terms do not automatically create an assignment. They make the proposal READY_FOR_ASSIGNMENT. Recruiter finalization checks active account, country eligibility, company approval, remaining capacity, no overlapping active assignment and unexpired current confirmations. Atomically lock the worker schedule and mission capacity, create assignment, mark proposal finalized, update application and emit audit/outbox events. Concurrent finalizations for the last place permit exactly one success. A replay of the same operation returns its original result.

## Assignment and attendance

Assignment: CONFIRMED -> IN_PROGRESS -> COMPLETED; CONFIRMED can become WITHDRAWN_BY_WORKER, CANCELLED_BY_COMPANY or CHANGE_PENDING through authorized workflows. Staffing policy determines whether a cancellation needs escalation; do not auto-charge workers. An absence is a dated attendance event, not automatically a cancellation of all remaining days.

Daily attendance starts NOT_RECORDED. Company declares PRESENT|ABSENT|PARTIAL with minutes worked and note. Worker confirms or disputes the declared revision; edits invalidate prior worker confirmation. Recruiter resolves conflicting reports with reason/evidence metadata. Records are never silently overwritten. Closing a mission requires reviewed daily records and an explicit record of any unresolved support case; mission completion does not certify wage payment.

## Replacement

Replacement: REQUESTED -> UNDER_REVIEW -> PROPOSING -> CONFIRMED or UNFILLED/CANCELLED. Link original assignment, dates affected and newly confirmed assignment. Do not exclude the absent worker from unaffected future days without a recorded decision. Candidate must satisfy normal application/proposal and confirmation rules. For urgent recruitment staff may invite a registered eligible worker to apply; no application is fabricated as if submitted by the worker. Release old capacity for the affected interval only after a documented assignment adjustment. Lock original and replacement schedules to avoid double coverage or overbooking. The company sees progress, not a promise of success.

## Support and finance

Support: OPEN -> IN_PROGRESS -> WAITING_ON_PARTY -> RESOLVED; reporter can reopen with a new message while retention permits. Store PUBLIC_TO_CASE messages separately from STAFF_ONLY notes. Kazi-mediated communication is included; unrestricted direct messaging is not.

Quote: DRAFT -> SENT -> ACCEPTED or DECLINED/EXPIRED. Once sent, edit by replacement revision. Finance invoice: DRAFT -> ISSUED -> PARTIALLY_PAID -> PAID, with OVERDUE derived from due date and outstanding balance; VOID requires reason and retained history. Payment entries are verified external receipts for Kazi service fees only. Currency must match; duplicate receipt reference cannot double count. No negative or excess allocation beyond balance; corrections use reversal entries. Issued invoice lines, party details, tax inputs and currency are immutable snapshots. Draft fixtures must say SAMPLE and cannot be presented as issued invoices.

## Notifications and audit

Commit business data and an outbox record in the same transaction. Delivery runs afterwards. Each external callback is verified and deduplicated. Keep the in-app notification even if SMS/email fails. Notification failure is a retryable delivery state, not a failed application or lost confirmation. Audit state changes with actor, scope, previous/new code, reason, request ID and event time; omit sensitive contents.
