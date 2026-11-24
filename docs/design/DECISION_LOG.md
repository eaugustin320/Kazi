# Kazi Design Decision Log (Phase D0)

**Edition**: 2.0.0  
**Baseline Phase**: D0

---

## ADR Tracked Decisions for Phase D0

### ADR-D0-01: Standalone Single-Page Application Prototype for D0
- **Status**: ACCEPTED
- **Context**: Phase D0 requires an interactive, local, reviewable UI/UX prototype demonstrating worker, company, and administration journeys under both Gabon and Forest themes across 360px, 768px, and 1440px viewports with synthetic fixtures.
- **Decision**: Build the D0 prototype using React, TypeScript, and modern CSS custom properties generated directly from `config/themes/*.json` and `config/design-system.json`.
- **Consequences**: The prototype runs locally with sub-second feedback, works offline, enables interactive viewport simulation, provides real-time WCAG contrast analysis, and allows instant theme switching without server roundtrips. When D0 is approved, D1 will establish the production Next.js/PostgreSQL architecture per ADR06.

### ADR-D0-02: Strict Semantic Token Resolution
- **Status**: ACCEPTED
- **Context**: In accordance with `THEMING_AND_COUNTRIES.md`, components must consume semantic token names only (e.g. `color.primary`, `surface`, `controlBorder`), with raw hex values restricted to versioned theme JSON files.
- **Decision**: Implement a Token Resolver that reads `gabon-premium-1.0.0.json` and `forest-premium-1.0.0.json`, injecting them as CSS variables (`--color-primary`, `--color-background`, etc.) into `:root`.
- **Consequences**: Switching themes updates CSS variables instantaneously with zero page reload and zero state loss. No hardcoded hex values exist in UI components.

### ADR-D0-03: Separation of Private Data in Candidate Representations
- **Status**: ACCEPTED
- **Context**: PRD KZ07 and WORKFLOWS dictate that companies must never receive private worker data (phone numbers, full national IDs, or internal recruiter notes).
- **Decision**: Define strict TypeScript interfaces separating `WorkerPublicProfile` (shared with companies) from `WorkerPrivateProfile` (accessible only to staff and the worker themselves).
- **Consequences**: The company candidate proposal cards physically cannot render phone numbers or identity card documents, enforcing the privacy invariant at the type level.

### ADR-D0-04: Explicit "SAMPLE" Branding on Financial Invoices
- **Status**: ACCEPTED
- **Context**: Per DECISIONS.md and WORKFLOWS, commercial tariffs and tax policies remain open decisions. Draft fixtures must never be presented as issued legal invoices.
- **Decision**: All company invoice views prominently display a "SPÉCIMEN / SAMPLE DEVIS" watermark and badge, detailing only Kazi service fees and explicitly excluding worker direct wages.
- **Consequences**: Complies with commercial safety boundaries during prototype demonstrations.
