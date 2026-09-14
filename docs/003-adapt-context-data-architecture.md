# 003-adapt-context-data-architecture

Status
Accepted as the authoritative logical data model. Not a migration — no Postgres schema
changes ship from this ADR alone. DATA_MODEL. md still describes the only tables actually
implemented (the Nehemiah 2 MVP slice); this ADR records that its long-term replacement is now
decided, not still an open option among several drafts.

Context
Three data-model drafts existed for this problem in sequence:
1. The original DATA_MoDEL. md — a mobile developer's working reference for the Nehemiah 2 slice.
2. DATA_MODEL_V2. md / the proposed ADR-002 — a first redesign attempt (events as entities,
entity_appearances，entity_relationships,chapter/book context units).
3. CONTEXT_DATA_ARCHITECTURE.md，WHOLE_BIBLE_CURATION_SPEC.md and AI_CURATION_CONTRACT.md —
I specific, concrete defects in (2) that would have caused real product bugs: false mention a specialist review (CoNTEXT_MODEL_REVIEW.md) built on top of both prior drafts and found
counts from expanding passage relevance into verse occurrences, no immutable translation
edition (a corrected text could silently invalidate published anchors), one collapsed
confidence scale hiding real differences between evidence strength/precision/tradition/dispute,
a single-parent passage tree that can't express alternate or overlapping segmentation, and a
rights model reduced to four booleans when the product needs operation-level grants.
coNTEXT_MODEL_REVIEW. md 's consensus findings (14 items) and its list of what must not be
contradicts the review; it is the review's output. implemented from the (2) draft are both incorporated wholesale into (3). No part of (3)

Decision
with its two companion documents: Adopt coNTEXT_DATA_ARCHITECTURE.md as the authoritative logical model going forward, together

type, and what is machine-generated instead of authored. WHOLE_BIBLE_CURATION_SPEC.md defines what must be curated, per Scripture unit and per entity
AI_cuRATION_coNTRACT.md defines the job/draft/publication package formats AI drafting must
conform to, and the validation pipeline a draft passes through before a human can approve it.
DATA_MoDEL_V2.md and the proposed ADR-002 are superseded by this decision. They are kept
past it - not deleted, not silently repurposed. in the repository as historical record of the first redesign pass and the reasoning that moved
The core structural decisions carried forward from CoNTEXT_DATA_ARCHITECTURE.md :
Reference systems are first-class and versioned; Neh. 2.4 is a readable route identifier, never
a global database key — every Scripture reference resolves through
between systems. (reference_system_key, local_reference_key),with explicit split/merge/reorder mappings
A translation work and a translation edition are different things. An edition is immutable;
edition and never leak across a correction. correcting text creates a new edition, never a silent update — anchors and mentions bind to one
Canonical Scripture attestation (entity present in this reference, semantically), edition
surface mention (exact phrase in one edition), and passage-scoped relevance (why it matters
blind expansion. here) are three separate tables with three separate meanings. None is derived from another by

Events, relationships, and passage-to-passage relations are all first-class with participants,
scoped applicability, and claim-level evidence — not flat rows with a free-text description.
Rights are operation-level grants (display, offline, search, image, share, download, web
excerpt, audio, external Al processing, embedding generation, ...), each independently
allowed/denied/unknown, fail-closed on unknown — not four booleans.
Claims are the evidence boundary. A substantive assertion is a claim with a typed object, an
evidence/precision profile, and a citation to an exact source locator — prose and graph edges
reference claims, they don't carry ad hoc citation text of their own.
Publication is immutable, atomic package releases with explicit dependencies (a Telugu context
package depends on the canonical graph plus the Telugu edition's mention-span package, not a
full duplicate). Rollback moves an active-release pointer; it never deletes history.

Consequences
DATA_MODEL. md keeps describing the current implemented schema (Nehemiah 2 MVP) until a
follow-up task rewrites it as concrete DDL-ready tables under this architecture. That rewrite is
substantial(coNTEXT_DATA_ARCHITECTURE.md names on the order of 40 tables across nine logical
domains) and is scoped as separate, explicitly sequenced work — see Next steps.
No production migration may be written against CONTEXT_DATA_ARCHITECTURE.md until the adoption
gate in coNTEXT_MODEL_REVIEW.md passes: one entity shared across locales/editions, a relevant-
but-not-mentioned passage entity, a split/merged reference mapping, a corrected edition
preserving the old edition's spans, competing positions without destructive overwrite, a
cross-chapter/alternate-segmentation passage, an event with multiple accounts, grapheme-safe
Telugu/Tamil mentions, a claim traced to a checksum-bound approval, honest partial-coverage
reporting, rights-unknown failing closed, and atomic install/rollback. These become the
acceptance tests for the first implementation slice, not aspirational prose.
AGENTS. md 's architecture-change rule (new ADR + owner approval for a data-boundary change)
is satisfied for the logical model by this ADR; the eventual DDL migration still needs its own
review pass focused on concrete constraints, indexes, and RLS policies.
The Phase 0 decisions this depended on remain open and still block real content:
PRoDUCT_DECISI0NS.md PD-O10 through PD-O12 (launch languages, translations, licenses),
coNTENT_RIGHTS.md 's pending sign-off, and the specialist decisions
coNTEXT_PLATFoRM_SPEC.md lists (canon policy, reviewer qualifications, source hierarchy,
Al-provider rights, locale fallback policy). Adopting the logical model does not resolve any of
these; it defines the shape they'll be recorded in once resolved.

Next steps
1. Owner resolves the Phase 0 decisions this architecture assumes will eventually be answered
(canon, initial edition + rights grants, launch locales + fallback policy, editorial lens,
reviewer qualifications, source hierarchy, Al-provider processing rights).
2. Rewrite DATA_MODEL.md as concrete DDL-ready tables implementing CONTEXT_DATA_ARCHITECTURE.md
column types, constraints, indexes, RLS policies — scoped to what the Nehemiah 2 slice
actually needs first, with the rest of the logical model present but unpopulated.
2a. Update CANoNICAL_IDENTIFIERS.md for the reference-system-qualified key scheme.
3. Build the golden fixtures AI_cURATION_CoNTRACT.md requires before any Al-assisted curation:
English/Telugu/Tamil, repeated names, pronouns, genealogies, split/merged versification,
NDJSON failure, release rollback. disputed identity/chronology, corrected editions, invalid rights, ambiguous mentions, atomic
4. Validate the full adoption gate against the Nehemiah 2 subset before any whole-canon curation
begins.

independently once scoped - it feeds curation candidates
