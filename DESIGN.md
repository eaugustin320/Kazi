# Kazi premium UI and UX specification

## Direction

Premium means legibility, calm hierarchy, coherent behavior and dependable feedback. Use task-focused views, restrained brand accents, compact content and familiar controls. Avoid promotional banners inside operational screens, invented charts, excessive shadows, glossy icons and decorative gradients. No personal rating or opaque suitability score. Preserve dignity and accessibility for workers using basic phones or limited data.

## Design foundations

Themes and exact color values live in config/themes. Use the default Gabon candidate for first review and the alternate preset for proof of portability. All components reference semantic tokens. Font: self-hosted Manrope if licensed assets are available, with system sans-serif fallback. Do not block content loading on a font. Body/input 16px on mobile; desktop body 14-16px, supporting labels at least 12px. Heading scale 20/24/32px; use 400/500/600 weights and avoid every heading becoming a hero.

Spacing: 4, 8, 12, 16, 24, 32, 48px. Mobile page padding 16px, tablet 24px, desktop 32px. Standard control height at least 44px on touch surfaces; tables can be compact on desktop but retain usable row actions. Radii 8px inputs, 12px cards, 16px dialogs; badges may be pill-shaped. Shadows only for actual elevation. No decorative shadows on every card. Mobile content max width about 640px; desktop workspace max width 1440px with 224px sidebar, collapsible on smaller screens.

Breakpoints are layout thresholds, not device models: small below 640px, medium 640-1023px, large 1024px and above. Test 360px without horizontal page scrolling, 768px and 1440px. Complex data tables become labeled cards or a deliberately scrollable region with a visible affordance; never shrink text to force fit.

## Shared components

AppShell, WorkerBottomNav, WorkspaceSidebar, PageHeader, Button, IconButton, Field, Select, DateRange, MoneyField, OTPInput, Dialog, Alert, StatusBadge, MissionCard, CandidateRow, Timeline, AttendanceRow, DataTable, Tabs, Toast, Skeleton, EmptyState, ErrorState and FileUpload. Define default/hover/focus/pressed/disabled/loading states and keyboard behavior once. Primary button uses primary/onPrimary tokens; secondary uses neutral surface/text/controlBorder. Destructive action uses danger text, plain wording and confirmation when materially irreversible. Never hide essential actions behind hover. Disabled actions explain what is missing.

## Navigation and journeys

Worker bottom navigation: Missions, Candidatures, Messages, Profil. Notification access sits in the header. Settings and Aide remain reachable from profile and contextual screens. Mission card foregrounds trade, location, pay per day, duration and start. Detail provides tasks, schedule, equipment, wage-payment party and method/timing when approved before the Postuler action. The same job data and terms revision appear on the confirmation screen. Distinguish shortlisted/proposed/approved/confirmed; use a short timeline. A worker's successful availability confirmation still awaits Kazi final assignment; do not announce final placement early.

Company sidebar: Vue d’ensemble, Demandes, Candidats proposés, Missions, Factures and contextual Assistance. Main overview emphasizes actionable requests and profiles awaiting a decision, not fabricated performance charts. Request form can be steps: need, conditions, review; preserve unsent draft input. Label submission Envoyer à Kazi, not Publier. Candidate fields are limited to shared relevant experience, skills, zone and availability. Personal phone/identity documents and internal notes are excluded. Approval action explains worker confirmation is still required.

Administration: À traiter, Demandes, Ouvriers, Entreprises, Missions, Facturation; staff/settings only for permitted users. Use role/country-scoped queues. Candidate table supports selection with a persistent selected count and Proposer à l’entreprise. Separate identity verification from self-declared experience. Finalization shows company and worker confirmations independently, terms version and remaining capacity. Billing shows Kazi service amounts only. Theme settings show preview and separate audited activation.

## Forms and state coverage

Labels stay visible; placeholders are examples, not labels. Show required fields, inline guidance and a summary linked to invalid fields. Validate both on client and server; errors preserve input. France/Gabon phone formatting is not guessed from number length: use region-aware validation and E.164 storage. Currency inputs show XAF/FCFA and unit explicitly. Do not request CV, GPS or identity documents without the defined business need.

Every core view defines initial loading, empty, populated, permission denied, not found, recoverable error and expired session. Every mutation defines submitting, success, validation failure, stale-version conflict and network retry. Disable duplicate submits, but also rely on server idempotency. Never display success before a confirmed response. An offline confirmation remains unsent; it is not queued for silent later execution. Show Réessayer and the current known state. Do not erase typed drafts because an optional image fails.

## Accessibility and motion

Target WCAG 2.2 AA. Normal text needs 4.5:1 contrast; large text 3:1, with eligible definitions from W3C. Essential controls and focus indicators must be distinguishable; test their actual combinations. Prefer 44px touch targets as Kazi's product standard; this is not a claim that every WCAG minimum is 44px. No color-only states. All controls have names, visible focus and keyboard operation. Dialogs manage focus, close predictably and return focus. Errors use appropriate live announcements without reading every render. Respect zoom, reflow, reduced motion and text scaling. Use subtle 120-180ms transitions for feedback, with reduced-motion alternatives; no looping decorative animation.

## Design delivery acceptance

Deliver a screen inventory linked to KZ IDs; worker apply-to-confirm flow; company request-to-approval flow; administration review-to-assignment flow; basic attendance/replacement/support/billing states; reusable component samples; both theme previews; responsive variants; and an accessibility/state checklist. Include empty, error and permission examples rather than only perfect screenshots. A local click-through can use synthetic fixtures; it must be labeled as a prototype. Usability review should include users representative of workers, company coordinators and recruiters before production implementation proceeds.
