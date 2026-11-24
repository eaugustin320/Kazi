# The twenty Kazi delivery workflows

These replace the generic stage prompts as reusable tasks linked to concrete specifications. They are not an instruction to execute all stages. Start with the design phase in START_HERE; return to individual workflows when appropriate. Always read AGENTS first.

| Stage | Agent task | Required input and completion evidence |
| --- | --- | --- |
| 1 Requirements | Reconcile PRD with an owner change; preserve KZ IDs and business model | Change description; updated acceptance criteria and scope diff |
| 2 UI and UX | Execute D0 premium design and prototype across three roles and both themes | DESIGN/config; screens, states, responsive/accessibility checks and reviewable prototype |
| 3 Architecture | Verify the working baseline against repository and current official docs | ARCHITECTURE; compatibility decision and exact lockfile versions once setup is authorized |
| 4 Database | Turn logical data model into reviewed schema/migrations during implementation | DATABASE/WORKFLOWS; constraints, migration and transaction tests |
| 5 API | Implement one domain contract and its service authorization | API/PRD; validated DTOs, documented errors and scoped integration checks |
| 6 Agent rules | Maintain repository instructions when scope evolves | AGENTS; focused rule change, no accidental loss of existing instructions |
| 7 Planning | Refine the next small vertical slice with dependencies | IMPLEMENTATION_PLAN; requirement ID, affected files and completion cases |
| 8 Setup | Initialize approved framework/config and tooling after D0 acceptance | D1 authorization; runnable skeleton, build/lint/typecheck evidence |
| 9 Feature | Implement the specifically assigned feature only | Task ID/role/acceptance; complete slice with all states and meaningful tests |
| 10 Backend | Implement data access and atomic domain services | DATABASE/API; real test DB, rollback/idempotency/concurrency evidence |
| 11 Identity | Implement chosen identity flow and server-side capability isolation | ARCHITECTURE/SECURITY; recovery, MFA, session and cross-company tests |
| 12 MCP | Connect only a specific approved development capability if needed | Named server/purpose; least-privilege config and harmless verification, no default mandatory connection |
| 13 Integration | Add one approved provider adapter | Official provider contract; mock and actual sandbox checks, callback validation and failure tests |
| 14 QA | Execute critical role/state/theme/country checks | QA_AND_RELEASE; passed/failed/skipped/manual evidence with fixes |
| 15 Debug | Reproduce the actual reported issue and fix root cause | Error/repro/redacted logs; regression case, minimal fix and verification |
| 16 Security | Review access, private files, abuse and credentials | OPERATIONS_AND_SECURITY; findings by severity and tested minimal remedies |
| 17 Review | Refactor only justified maintainability/correctness issues | Current code and specs; behavior-preserving tests and remaining debt |
| 18 Deployment | Prepare staging/live rollout only within authorized scope | Validated release/migrations/providers; real status/URL if deployed, otherwise preparation status |
| 19 Operations | Set up actionable observation and recovery | Approved alert destination/hosting; measured signals, restore result and runbook |
| 20 Launch audit | Deliver evidence-based readiness verdict | Complete implemented scope; READY/WARNINGS/NOT READY, blockers and manual checks |

## General execution message

Read the named source documents and existing code. Implement only the assigned stage/task in its authorized environment. Do not invent missing approvals, accounts, fees, provider delivery or test results. Keep Gabon configuration and semantic theming external to domain behavior. Report concrete outputs, verification and the next dependent task. Ask only about information that blocks the assigned work; continue independent work while a required decision is pending.
