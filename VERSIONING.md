# Versioning and compatibility policy

The owner intends incremental releases beginning at product 1.0.0. This pack does not assert a release date. Its specification edition 2.0.0 is independent of the unreleased product.

| Artifact | Example | Compatibility contract |
| --- | --- | --- |
| Product | 1.0.0, 1.0.1, 1.1.0 | Fix, compatible capability or breaking behavior explicitly described in CHANGELOG |
| Specification | 2.0.0 | Changes to requirements; not a deployed binary |
| Theme | gabon-premium@1.0.0 | Immutable palette values, preserving semantic schema |
| Theme schema | 1 | Required token names/types; breaking keys require mapping/deprecation |
| Country config | GA@1.0.0 | Locale/service-area/theme pointer/policies; schema version independent |
| Database | ordered migration ID | Expansion/backfill/contraction and restoration evidence |
| Domain API | /api/v1 | Compatible additions; version breaking payload/status changes |
| Translation catalog | catalog revision | Stable keys with fallback; no machine status renamed by translation |

A recolor does not inherently need a product major release. Changing a theme ID or adding a compatible token preset is normally a configuration/design change; classify by actual user/contract impact, not marketing. Removing an API field, altering confirmation order or changing the financial model is a product/domain decision and may be breaking. Do not reuse an existing published immutable version for different content.

For each change record problem, affected roles/countries, requirement IDs, compatibility class, target versions, validation evidence and rollback. Keep snapshots for issued invoices and accepted assignment terms; never rewrite those records after a rebrand, currency change or translation update.

A future new country begins disabled, with explicit service areas, translations, provider coverage, privacy/commercial rules, support and rollout checks. Country-specific code may exist in narrow validated adapters when justified; duplication of screens, domain services or authorization is prohibited. Cross-country staff scope is explicit. Do not enable country support by hiding a dropdown restriction only in the client.

Feature flags are named, owned, defaulted, documented and scheduled for removal. Evaluate server-side for protected capability availability; never trust a flag as permission. Preserve previous URLs and navigation semantics where feasible. Write migrations and release notes before changing persisted workflow codes. Do not upgrade framework majors, change colors and alter the recruitment state machine in one unreviewable batch.

## Next improvements are candidates only

Potential later work: more cities, additional language catalogs, company team invitations, richer scheduling, approved communication channels and additional country presets. Each needs scope, owner decision, compatibility review and tests. Payroll, automated hiring or worker charging would change the business model and require a new explicit product decision; they are not assumed future features.
