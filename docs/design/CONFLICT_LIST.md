# Kazi Conflict & Boundary Analysis (Phase D0a)

**Specification Edition**: 2.0.0  
**Phase**: D0 (Design Baseline & Interactive Prototype)

---

## 1. Boundary & Invariant Distinctions

This document formally distinguishes illustrative mockups and styling preferences from nonnegotiable business invariants established in the specification pack (`PRD.md`, `WORKFLOWS.md`, `AGENTS.md`).

| Area | Illustrative Mockup / Presentation Level | Nonnegotiable Product Invariant (Authoritative) | Conflict Prevention Rule |
|---|---|---|---|
| **Worker Fees** | Visual badges or banners showing "0 FCFA" or promotional tags. | **Workers NEVER pay recruitment fees.** Direct remuneration paid by company. | No UI or flow may ever prompt a worker for payment, fee deduction, subscription, or wallet deposit. |
| **Selection & Proposal** | Company browsing a public directory of worker avatars. | **Kazi staff performs selection.** Companies only see candidates specifically proposed for their open requests. | Public worker directory or unrestricted searching by companies is strictly prohibited. |
| **Candidate Privacy** | Displaying candidate phone numbers, full names, or CNI cards on candidate cards. | **Strict privacy boundaries.** Companies only see shared relevant experience, skills, and zone. Phone, CNI, and internal staff notes are confidential. | Candidate card components must never bind to private telephone, national identity numbers, or internal notes. |
| **Double Confirmation** | Company clicking "Engager" to instantly place a worker. | **Dual confirmation required (KZ08).** Company acceptance triggers an invitation to the worker (24h expiry). Final assignment requires staff execution (KZ09). | Company action must be labeled "Accepter le profil" (or "Valider la proposition"), explicitly displaying that worker confirmation and Kazi finalization are still pending. |
| **Attendance & Pay** | Company marking attendance and generating payroll receipts. | **Daily attendance tracking (KZ10); Kazi does NOT handle payroll.** | Daily presence records allow worker confirmation/dispute. Kazi billing (KZ14) invoices only Kazi recruitment service fees, marked SAMPLE in prototype. |
| **Theme Switching** | Green/gold palette (`gabon-premium`) vs Orange/forest palette (`forest-premium`). | **Themes affect ONLY presentation.** Zero mutation to domain data, permissions, workflows, or validation rules. | Switching themes dynamically swaps CSS custom properties only. State machine and API models remain 100% identical. |

---

## 2. Identified Missing States & Edge Cases Covered in D0

1. **Duplicate Application**: A worker attempting to submit an application for a mission they have already applied to must see a dedicated `DuplicateApplicationState` explaining their existing application status.
2. **Expired Proposal**: When a 24-hour availability window expires before the worker confirms, the worker must see an `ExpiredProposalState` with guidance to contact support or browse new missions.
3. **Capacity Reached / Race Condition**: When the last open slot on a mission is filled concurrently, any other pending proposal must display a `CapacityReachedState` rather than failing cryptographically or silently.
4. **Withdrawal Irreversibility**: Worker withdrawal of an application or assignment must display an explicit confirmation dialog explaining that withdrawn candidatures cannot be silently reactivated.
5. **Attendance Dispute**: A worker who disputes a company's presence declaration must see a clear submission flow for their dispute with reason selection, alerting Kazi staff for mediation.
6. **Network Failure & Retry**: Simulated network interruption state with a non-destructive "Réessayer" action that preserves form inputs and drafts.

---

## 3. Country & Locale Integrity

- Default country: **GA (Gabon)**
- Supported locale: **fr-GA**
- Official currency: **XAF (FCFA)**, integer units (no decimal minor units)
- Calling code prefix: **+241**
- Operational timezone: **Africa/Libreville** (UTC+1)
- Initial enabled service area: **Libreville** (Akanda, Owendo, Glass, etc.)
- All other countries and service areas remain disabled in configuration.
