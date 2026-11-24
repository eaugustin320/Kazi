# Themes and country configuration

## Independent concerns

A product release, a visual theme, a country configuration, a translation catalog and a database migration are different artifacts. Gabon is the launch country, not a conditional branch inside every page. A theme update must not rename statuses, change payroll behavior or rebuild a database. A country launch needs operational approval even if its theme is already tested.

Default country GA uses fr-GA, XAF, Africa/Libreville and calling prefix +241. Launch country configuration enables Libreville as the initial area only; expansion is an explicit configuration change. Resolve country from the authorized workspace or explicit public market selection. Never use a flag, IP address or browser locale as proof of legal eligibility, membership or authorization.

The default design candidate is gabon-premium@1.0.0: deep green actions, warm surfaces, restrained gold accents and blue information styling. This is a Kazi brand proposal inspired by the launch context, not an assertion of official national flag color codes. The previous forest/orange direction is retained as forest-premium@1.0.0 for comparison and regression checks. Owner visual acceptance is still part of D0. No later palette or next product release is promised.

## Token contract

Components consume semantic names only: color.background, surface, text, textMuted, border, controlBorder, primary, onPrimary, primaryHover, accent, onAccent, infoSurface, infoText, successSurface, successText, warningSurface, warningText, dangerSurface, dangerText, focusRing, focusRingOnDark, sidebar and onSidebar. Primitive hex values exist only in versioned theme files, generated CSS artifacts and theme tests; colors inside country flags or photography are not application semantic colors.

Typography, spacing, radius, motion and breakpoints belong to the same design contract but are independent of country. Start with the design values in DESIGN.md. Generate CSS custom properties such as --color-primary from validated config. Component CSS references those properties. Charts, email templates, PDFs, dialogs, placeholders and third-party components need the same semantic mapping. Server-rendered and client-hydrated theme IDs must agree. Cache assets by immutable theme ID/version, not by a mutable country name.

Use dedicated status tokens and a visible label or icon. Do not change all status colors when the brand changes. Decorative borders can be subtle; essential input boundaries use controlBorder. Outline/focus visibility must be tested on the actual surrounding background. Never place white small text on the legacy orange primary; that preset explicitly pairs it with dark text.

## Resolution and authorization

For an authenticated workspace: read its countryCode from authorized data -> resolve the active country configuration version -> resolve its explicit defaultThemeId -> load that exact registered immutable theme -> map semantic keys. A prototype-only theme preview overrides presentation for that preview, not persisted membership/country or server policy. Public pages default to GA when no enabled market is selected. Do not implement arbitrary remote CSS, user-supplied tokens or database-driven executable expressions.

Production supports only registered validated themes. Preview can be local or available to authorized staff; preview must be clearly marked. Activation is a privileged administrator action, audited with old/new theme/config versions and reason. Deploy theme assets first, validate, then update the configuration pointer. If a theme is missing or invalid, use last-known-good config; if none exists, fall back to packaged GA baseline for visual rendering and raise an operational alert. Do not silently route an unsupported country to a GA business workflow.

## Safe palette change procedure

1. Duplicate a theme file with a new immutable version or ID; never edit a published historic theme in place.
2. Preserve schemaVersion and all semantic keys for a compatible change. Check required text pairs, controls, focus, hover, disabled, modal and navigation states.
3. Run scripts/validate_pack.py and the application theme/component/visual tests. Test all three roles at 360, 768 and 1440 px and keyboard/reduced-motion modes.
4. Confirm no business service, permissions, API payload or schema changed. A theme-only release requires no migration.
5. Obtain visual acceptance, activate a versioned country pointer in staging, inspect, then use normal release authorization.
6. Roll back by restoring the previous theme/config pointer; keep compatible old assets available. Business data is unchanged.

## Safe country expansion procedure

Add a new disabled country manifest with explicit supported locales, currency exponent, timezone, phone validation region, service areas and theme reference. Add translations and formatting tests; recheck legal, privacy, staffing, wage and invoice arrangements with the owner before enabling. Add provider coverage and failure tests. Do not invent conversion between currencies or reuse GA invoice terms. Existing companies, missions, invoices and assignments retain their stored country/currency/timezone/terms snapshots. Multi-country access requires explicit staff scope. A person can see only the workspace/country data they are authorized to access.

## Compatibility proof required

Switch the prototype between the two supplied themes using identical fixtures. Confirm job IDs, amounts, selection states, permissions, confirmation order and attendance do not change. Add a test for a future theme with the same schema and an invalid/missing token set. An unknown theme version must not crash user flows. A breaking semantic-key rename requires a migration map and deprecation window, or a design-system major version. Visual regression differences are expected only in theme-controlled properties.

Country policy is not a feature-flag engine. Set operational business rules in explicit reviewed configuration or services and snapshot terms. Do not encode arbitrary fee formulas in JSON. Future localization and theme support do not require implementing every country, dark mode or a theme marketplace in 1.0.0.
