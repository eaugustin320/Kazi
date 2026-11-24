# Start the Kazi project here

Specification edition: 2.0.0. Target first product release: 1.0.0. Prepared 23 November 2026.

This is the execution brief for the agent. It supersedes the earlier generic prompt playbook for new Kazi work. It contains product decisions and engineering defaults, not evidence that a product has already been built or approved for launch. An owner instruction always takes precedence. Record material departures in DECISIONS.md and update affected specifications together.

## Give this instruction to your agent

Read AGENTS.md, PRD.md, DESIGN.md, THEMING_AND_COUNTRIES.md, WORKFLOWS.md and IMPLEMENTATION_PLAN.md before changing files. Inspect any existing repository and preserve working code. Begin at phase D0, premium UI/UX, for Kazi's Gabon launch. Create the screen inventory, reusable token-based components and a local interactive prototype covering worker, company and administration journeys, using synthetic data. Compare the supplied Gabon and alternative themes. Do not implement live authentication, a production database, payroll, real notifications or deployment at this stage. Verify responsive layouts, accessibility, states and theme switching. Produce a design handoff with review links or file paths, what was checked and unresolved decisions. Keep the same domain rules under both themes. Continue within D0 until its reviewable deliverables are complete; owner acceptance of the design is the boundary before D1 implementation. Do not ask about routine styling or reversible implementation choices that the documents already answer.

## Reading and file placement

If adding this pack to an existing repository, merge AGENTS.md instructions with any existing file; do not overwrite repository-specific rules silently. Keep AGENTS.md at repository root and copy the remaining documents and config under docs/kazi, updating relative references if moved. Until then, all paths in this pack are relative to this directory. Do not paste the master document and the individual copies together into an agent context; choose either format.

| File | Purpose |
| --- | --- |
| PRD.md | Product scope, roles, requirements and acceptance criteria |
| DESIGN.md | Premium UI/UX specification and screen guidance |
| THEMING_AND_COUNTRIES.md | Theme, locale, country and future change contracts |
| WORKFLOWS.md | State transitions and business invariants |
| ARCHITECTURE.md | Working technical baseline for the implementation stage |
| DATABASE.md | Logical tables, constraints, access and migration rules |
| API.md | API contracts, actions, failure handling and permissions |
| AGENTS.md | Rules applied to every agent task |
| IMPLEMENTATION_PLAN.md | Ordered, verifiable work and design acceptance gate |
| QA_AND_RELEASE.md | Test matrix, release checks and rollback |
| VERSIONING.md | Independent product, theme, config and schema versions |
| OPERATIONS_AND_SECURITY.md | Access controls, services and operational procedures |
| DECISIONS.md | Explicit defaults, deferred decisions and launch dependencies |
| AGENT_WORKFLOWS.md | The original 20 delivery stages made project-specific |
| VALIDATION.md | Checks actually run on this pack and their limits |
| SOURCES.md | Official technical references to recheck before setup |
| config | Versioned theme presets and Gabon country manifest |
| scripts/validate_pack.py | Dependency-free checks for the supplied pack |
| MASTER_PLAYBOOK.md | The same specifications in a single reading file |

## Definition of a successful handoff

The agent can begin D0 without inventing the business model, deciding who selects candidates, hardcoding country colors, choosing a live provider, or re-creating the project specification. Run `python3 scripts/validate_pack.py` from the pack root to check configuration integrity. This validates the documents and configuration only; it does not test an application that does not yet exist.
