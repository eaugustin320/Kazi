# Kazi product requirements

## Purpose and launch context

Kazi connects companies needing temporary daily labor with workers seeking short assignments. It provides human-assisted recruitment and mission follow-up, not payroll or guaranteed employment. Launch country is Gabon (GA); initial area is Libreville and owner-approved nearby areas. Initial UI is French, currency XAF and operational timezone Africa/Libreville. Availability outside enabled areas is not promised. English is used in engineering documents.

Product target is 1.0.0. This pack supplies a concrete working baseline so the agent can proceed with design. Commercial, legal and live-provider decisions remain owner responsibilities, as listed in DECISIONS.md.

## Users and permissions

| Role | Can do | Cannot do |
| --- | --- | --- |
| Visitor | Browse public summaries of published missions | Access identities, applications or private company data |
| Worker | Manage own profile, apply, withdraw, decide availability, view own assignments, report issues | Select candidates, approve for a company, edit confirmed attendance or read other workers' data |
| Company owner | Maintain own company, submit requests, review its proposed profiles, approve/decline, declare attendance, view its invoices | Search the full worker directory, read private IDs/internal notes or another company's data |
| Recruiter | Review companies/requests, verify relevant data, select, propose, assign, coordinate replacements and follow up | Grant staff roles, alter financial history or access other country scopes without a grant |
| Finance | Manage Kazi quotes/invoices and record verified external receipts | Change selection, see identity documents without a separate grant or charge workers |
| Administrator | Manage authorized team roles, country/theme activation, audit and exceptional operations | Bypass audit, change business invariants through branding settings or erase history silently |

Staff permissions are capabilities, not a client-supplied role string. One account may be a worker and company member; changing workspace never changes authorization. V1 exposes one company owner membership per company; additional team invitations are deferred, but schema accommodates memberships. Staff can hold recruiter and finance capabilities if explicitly assigned.

## Commercial model

Workers pay no recruitment fee. The company pays worker remuneration directly under agreed terms, displayed before application and copied to the assignment. Kazi's service fee is agreed with the company using a quote, then invoiced separately. There is no fixed percentage or flat fee in the product baseline. Illustrative amounts are fixtures, not public tariffs. A remuneration estimate is never a receipt. Tax identity, required invoice fields and tax treatment must be approved before real invoice issuance.

## Core requirements and acceptance

| ID | Requirement | Acceptance criterion |
| --- | --- | --- |
| KZ01 | Worker access and profile | Verified identity channel; own name, skills, zone and availability editable; no fee collected |
| KZ02 | Company registration/review | Owner supplies company fields and required approved documents; staff can approve or request corrections |
| KZ03 | Staffing requests | Company supplies trade, headcount, site, dates, schedule, pay and equipment; submitted need is reviewed |
| KZ04 | Publication | Only authorized recruiter publishes a reviewed request with a verified company and complete terms |
| KZ05 | Discovery | Visitor/worker sees published missions in enabled country; filters trade, area and start date |
| KZ06 | Applications | Worker applies once per mission; duplicate, closed mission and suspended account rejected |
| KZ07 | Human selection | Staff can shortlist and propose only eligible applicants; company sees only explicitly shared fields |
| KZ08 | Separate confirmations | Company decides on proposal and worker confirms against the same terms version; stale confirmation rejected |
| KZ09 | Final assignment | Recruiter finalizes only after both accept, capacity and date checks pass; operation is atomic |
| KZ10 | Attendance | Company declares daily presence; worker confirms/disputes own entry; recruiter resolves disagreement with history |
| KZ11 | Replacement | Either party reports absence; staff proposes a new worker through normal confirmation rules; no guarantee implied |
| KZ12 | Support | Worker/company opens scoped case; support thread supports communication with Kazi; internal notes stay private |
| KZ13 | Mission close | Staff checks attendance/bilan and resolves or explicitly links outstanding disputes before closing |
| KZ14 | Kazi service billing | Company accepts quote; finance issues invoice only when launch details complete; no salary included |
| KZ15 | Notifications | In-app notifications reflect committed events; delivery failure never reverses the business action |
| KZ16 | Configuration | Authorized admin can activate validated country/theme presets; no per-country page duplication |
| KZ17 | Accountability | Staff verification, status, theme and finance changes produce redacted audit events |

## Required screen inventory

Worker: welcome/login, phone verification, onboarding/edit profile, mission list/filter/detail, application submission/result, application list/detail, availability decision, withdrawal confirmation, assignment details, absence report, mission history/detail, support inbox/thread, issue form, notifications, settings/privacy and logout. Include invalid/expired code, incomplete profile, duplicate application, no missions, service failure, restricted account and session expiry.

Company: signup/login/recovery/reset, company profile/document status, overview, request create/draft/submit/detail/edit/cancel, validation waiting/correction, candidate proposals/detail/decision, mission roster, attendance/bilan, replacement request, support inbox/thread, quotes/acceptance, invoice detail/download and notifications/settings. Direct publication and full-directory worker browsing are excluded.

Administration: staff login/MFA/recovery, prioritized work queue, company/document review, request moderation/publication, worker search/profile/checks, application/shortlist/proposal views, confirmations/finalization, mission roster/attendance reconciliation, replacements, support case and internal notes, quote/invoice/receipt records, notification failures, authorized staff/settings, theme preview/activation and audit history.

Screens can be dialogs or reused layouts where appropriate. Do not create a new full page for each minor state. Static screenshots do not constitute a tested workflow.

## V1 boundaries

Include the requirements above with basic Kazi-mediated support, in-app notifications, manual service-fee receipt recording and a responsive web product. Exclude payroll, worker wallets, escrow, commission deduction from wages, automatic AI selection, subscriptions, instant hiring, native apps, real-time GPS, public worker ratings and company-to-worker unrestricted chat. No future country is publicly enabled merely because a theme exists.

## Quality and success

Aim for simple mobile use on constrained connections: text-first job cards, optimized optional images, progressive loading and safe retries. Target WCAG 2.2 AA. Store timestamps in UTC and render in operational locale/timezone. No state is conveyed by color alone. Require keyboard navigation and clear focus. Test worker discovery/apply/confirm, company request/approve/presence and staff review/select/finalize end to end.

Track real request-to-first-proposal time, fill rate, confirmation completion, attendance rate, repeat company usage and net service revenue separately from worker wages. Establish numeric commercial targets after a pilot; do not invent traction. Production launch requires an enabled service area, staff operations, verified communication delivery, approved policies and a completed release audit.
