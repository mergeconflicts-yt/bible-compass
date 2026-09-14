# CONTEXT_PLATFORM_SPEC

Context Platform Specification

Status and scope
DRAFT FOR OWNER AND SPECIALIST REVIEW
This document is the entry point for the future-ready data and curation design behind the
context-aware Bible experience. It does not approve a canon, translation, locale, license,
source, reviewer, or production content package. It does not expand the first MVP beyond the
reviewed Nehemiah 2 slice.
The specification is divided into three contracts:
1. CONTEXT DATA ARCHITECTURE.md defines the authoritative
relational knowledge graph, publication packages, and mobile projections.
2. WHOLE BIBLE CURATION SPEC.md defines what must be collected
and reviewed for Scripture scopes, entities, events, places, terms, maps, and localizations.
3. AI CURATION CONTRACT.md defines the fixed input and output formats
for Al-assisted drafting and the validation, review, and publication gates.
OPEN BIBLE DATA_SOURCES.md is the supporting source-intake catalog.
It records researched external dataset candidates, licensing and quality risks, model fit, and the
admission gates required before a source key may be supplied to curators or Al agents. Catalog
inclusion or Markdown status is not source approval; runtime authorization comes only from the
authenticated operational source registry described by the curation contract.
These drafts are designed to inform a replacement data-model ADR. They do not supersede an
accepted ADR or authorize migrations. The existing DATA_MoDEL. md remains the MVP reference
until the owner approves a replacement decision.

Governing principle
Store canonical identity and semantic relationships once. Store reader-facing prose per locale.
Store exact Scripture and textual occurrences per immutable translation edition. Precompute
counts, histories, search records, and reader spans during publication. The mobile application
performs deterministic indexed lookups and never performs biblical inference.

Required decisions before adoption
Supported canon and reference-system policy
Initial immutable translation edition and complete rights grants
Launch locales and explicit missing-localization fallback
Editorial lens and treatment of responsible disagreements
Reviewer qualifications and approval thresholds by content type
Approved source hierarchy
Whether licensed inputs may be sent to each Al provider
Package granularity and retention of raw Al submissions
Unicode selector and generated-span policy
ADR-003 records that this architecture is adopted as the authoritative logical model, superseding
the earlier DATA_MODEL V2. md /proposed ADR-002 draft. That resolves which design is
authoritative; it does not resolve the decisions listed above, and no migration exists yet  see
ADR-003 's Next steps.
