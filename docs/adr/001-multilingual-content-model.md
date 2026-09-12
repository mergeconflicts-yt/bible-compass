# ADR-001: Multilingual Scripture and Content Model

## Status

Proposed. Owner approval recorded via the multilingual request; Phase 0 exit still requires
PD-010 through PD-012 resolution with evidence.

## Context

The first MVP launches with English, Telugu and Tamil Scripture. The original data model stored
human-readable content (entity descriptions, passage context) inline on canonical rows, which
would fork canonical identity per language. Translation rights must also be proven independently
per language.

## Decision

- Canonical identity stays language-independent: OSIS book codes, `Neh.2.4` coordinates, entity
  slugs and passage keys are shared across all locales.
- Scripture text is stored per `translations` row (one row per language translation); verse text
  is never machine-translated at read time.
- `entities` holds identity only; `entity_localizations` holds `display_name`, `short_description`
  and `extended_description` per `language_tag`, each with its own `review_status`.
- `passage_contexts` holds the English source row; `passage_context_localizations` holds the
  Telugu and Tamil overrides per passage version, each with its own `review_status`.
- Each language translation gets its own `translation_licenses` row. An English license never
  implies Telugu or Tamil rights. The product fails closed per language.
- Launch locale tags: `en`, `te`, `ta`. Region subtags are `OPEN`.

## Consequences

- Content pipeline, RLS publication views and the offline installer must all become
  locale-aware (one immutable package version per locale).
- Review workload multiplies per language; Telugu and Tamil localizations each need qualified
  review before staging.
- `CONTENT_RIGHTS.md` must gain one permission matrix per language translation.
- `NEHEMIAH_2_CONTENT_INVENTORY.md` must track localization rows for Telugu and Tamil.

## Open questions

- Fallback behavior when an approved localization is missing (show English source with a label,
  or hide the layer?). `OPEN OWNER DECISION`.
- Whether Telugu and Tamil ship at beta launch or follow English. `OPEN OWNER DECISION`.
