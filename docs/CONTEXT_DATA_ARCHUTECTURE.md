# CONTEXT_DATA_ARCHUTECTURE

Future-Ready Context Data Architecture

Status
DRAFT FOR REVIEW - LOGICAL MODEL, NOT MIGRATION DDL

incremental whole-Bible curation. The first MVP still publishes only approved Nehemiah 2 content.

Architecture decision proposed
Use Supabase Postgres as a normalized editorial and publication authority. Represent the Bible
knowledge graph with relational node and edge tables. Generate immutable, denormalized content
packages for SQLite. Do not add a graph database unless measured production queries later justify
a new service and an approved ADR.

authoritative Scripture + reviewed sources + AI drafts

validation and review

normalized Postgres knowledge model

immutable publication release

locale/edition-specific &QLite projection

indexed offline app lookups

Non-negotiable separations

Layer Meaning Versioning dimension

Canonical identity One person, place, event, role, object, Canonical revision
term, or theme

Scripture reference Address in a named canon/reference Reference-system version
system

Translation edition One exact immutable text release Edition

Semantic attestation A Scripture scope refers to an entity Canonical content revision

Surface mention Exact phrase in one edition text Translation edition

Contextual relevance Why something matters in a scope Context revision and locale

Localized presentation Reader-facing name or prose Locale revision

Claim Reviewable proposition and evidence Claim revision/perspective
boundary

Derived projection Counts, histories, spans, search Build/release version
documents

A passage-level relevance link must never be expanded into a claim that an entity is mentioned in
every verse of that passage.

Logical domains

canons, works, reference systems, translations, editions, locales
catalog reference units, edition text, mappings, registered scopes
scripture entities, names, typed attributes, relationships, events
knowledge context artifacts, revisions, sections, scope relevance, scope relations
context claims, positions, sources, citations
evidence licenses, subjects, grants, attribution rules
rights submissions, findings, reviews, approvals, audit
editorial manifests, members, dependencies, releases, assets, projections
publishing published read-only views or functions
app_public profiles, preferences, progress, bookmarks, devices
user_data
operations import jobs and delivery state

Draft, source, reviewer, and operational data must not be exposed to mobile clients.

Canon, works, and reference systems

canons
· UUID primary key and immutable key
Tradition/family and lifecycle status
Localized names in a localization table
Source claims defining membership

scripture_works
• UUID primary key and immutable work key
OSIS-style interoperability code where applicable
Work family/type
· No required English display name on the identity row

canon_work_memberships
Canon, work, order, and grouping
Unique canon/work and canon/order constraints
Supports works that are combined, divided, ordered, or named differently across canons

reference_systems
Immutable key, canon, version, evidence, and status
Identifies a versification and numbering convention

reference_units
Reference system, work, chapter label, verse label, optional segment label
Unit kind, parent unit, and total order ordinal
Use labels rather than assuming every verse is a positive integer
Unique address within a reference system and unique ordinal within that system

reference_mappings

From/to reference system and source/target units or ranges
Mapping kind: equivalent, split, merge, overlap, renumbered, omitted, added, uncertain

• Evidence claim and review state

There is no unqualified universally canonical Neh.2.4 database identity. Public OSIS-like keys
remain readable route identifiers. Every persisted Scripture reference is resolved by the
composite (reference_system_key, local_reference_key); APls, claims, citations, packages, and
cross-package links must never resolve Neh.2.4 globally by its local key alone.

Registered Scripture scopes

scripture_scopes
Addressable semantic units for context:

• Verse
Chapter overview
Book overview
Section or subsection
Curated passage/pericope
Non-contiguous literary unit when justified

Fields include immutable key, referencê system, kind, optional default navigation parent, boundary
certainty, lifecycle, and ordered start/end units. scope_members and segmentation-scheme-qualified
containment edges supply explicit membership when a range is
non-contiguous or crosses complex mappings.
Create a lightweight book and chapter skeleton. Do not create rows for every mathematically
possible range; curators register meaningful passages.
Canon presentation units are distinct from conceptual works. Ordered composition mappings express
that one canon unit combines several works/parts or that one work is divided into several units;
membership and order alone are not sufficient.

Translations and immutable editions

translation_works
Stable translation identity/code
Primary language
Publisher/rightsholder identity
Translation family and status

translation_editions
Translation work
Immutable edition/revision key
BCP 47 language tag
Reference system
Source artifact checksum
Edition/revision date
Superseded edition, attribution version, and status

Translation edition and reference unit
Sequence and structural kind
Exact licensed text and pipeline-generated SHA-256
· Ordered mappings to one or more reference units, with mapping kind and coverage sequence
Optional separately licensed paragraph, poetry, heading, footnote, speaker, or styling records

Any amendment to exact text creates a new immutable translation-edition/text-revision identity.
A publication release may package that identity but cannot substitute for it. Scripture is never
machine-translated at runtime.

Canonical entity graph

entity_types
Versioned controlled vocabulary initially covering:

person, place, event, collective, polity, tribe, role, office, object, structure,
practice, institution, law, covenant, document, lexical_term, concept, theme,
measurement, currency, plant, animal

entities I

UUID primary key
Immutable machine key and stable public slug
Entity type and lifecycle
Identity/identification status
Creation provenance
No localized biography or required English name

entity_names
Entity, language/script tag, localized form, normalized search form
Name kind: preferred, alias, title, epithet, ancient, modern, transliteration
Optional translation-edition, geographic, temporal, and source-claim scope
Immutable localization revision and review state

entity_descriptions
Entity, locale, immutable revision, short and extended description
Source language, translation method, reviewer state, and controlling claims

Typed extension tables
Use extensions only for structured fields that need validation or queries, such as person
attributes, place geometry, event chronology, object characteristics, and lexical senses. Avoid a
giant nullable entity table and avoid hiding core facts in JSONB.

entity_identity_assertions
Represent same_as,possibly_same_as,distinct_from,traditional identification, and disputed
identification as sourced claims. Never destructively merge uncertain identities.

Attestations, edition mentions, and relevance

reference_entity_attestations
Translation-independent reviewed assertion that a reference unit or precise Scripture scope
refers to an entity:
Entity and reference unit/scope
Semantic attestation kind: primary subject, participant, location, topic, genealogical member,
implied referent, disputed referent
Explicitness/textual basis and identification status
Supporting claim and review revision
This is the source of truth for canonical reference lists.

edition_mentions
Exact surface occurrence in one translation edition:
Edition text unit and target entity/context card
Mention form
Exact quote and occurrence ordinal
Pipeline-generated text hash and validated offsets
Review state
Al supplies an exact selector copied lrom the supplied immutable text, not offsets. Edition-level
mention form records whether wording is an explicit name, alias, title, pronoun, indirect
description, collective reference, or unnamed reference. The pipeline generates
edition_render_spans, checks that all spans concatenate to the original text, and verifies
Unicode grapheme boundaries. The
published React Native projection may use explicit UTF-16 half-open offsets, but the unit and
Unicode/segmenter version must never be implicit.

scope_entity_relevance
Context revision and entity
Semantic role code, temporal state, importance, and display priority
Whether explicitly attested within the scope
Controlling claims
scope_entity_relevance_localizations holds independently versioned locale-specific "In this
passage" explanations. Semantic relevance is not duplicated by language.
Relevance answers why an entity matters; it is not a mention counter.

Relationships, events, and passages

relationship_predicates
Controlled predicate with inverse, symmetry/transitivity metadata, allowed subject/object types,
and requirements for scope/time/place qualifiers.
entity_relationship_assertions
Subject, predicate, object
Applicable Scripture scope
Structured temporal and geographic qualifiers
Dersnective certainty dimone

Events
An event is an entity with event_attributes, plus:
event_participants with participant role and claim
event_places with place role and claim
event_scripture_accounts with reports/recalls/anticipates/interprets/alludes relation
event_relations for sequence, cause, result, parent/subevent, and disputed equivalence
Timeline cards are derived presentations of event data, not authoritative event records.

scope_relations
Relate registered Scripture scopes using controlled, directional values such as parallel account,
same event, quotation, explicit citation, allusion, echo, fulfillment, background, explanation,
contrast, cause/result, before/after, genealogy, geography, and shared theme. Each edge requires an
explanation, evidence, certainty, review state, and perspective where interpretive.

Context artifacts and localization

context_artifacts
Stable identity, target Scripture sJope, context kind, source language, and lifecycle

context_revisions
Artifact, immutable revision number, schema version, based-on revision, change reason
Trusted creator or Al submission lineage and review state

context_sections
Typed sections may include who, where, when, what, before, stakes, immediate summary, what-next,
literary structure, historical setting, cultural note, language note, and interpretive issue.
Required sections depend on scope kind. Do not manufacture prose where a field is inapplicable.
context_section_localizations
Context section/revision, locale, localized text, source revision, translation method, and
independent review state

never silently present English as another language.

claims
The claim is the provenance boundary:
Stable key and predicate/type
Subject entity/scope/event
Exactly one typed object: entity, Scripture scope, text, number, date range, place/geometry,
lexical value, or controlled value
Applicability scope, temporal and geographic qualifiers
Evidence status, textual basis, precision dimensions, and perspective
Immutable revision and review state

Certainty dimensions
Do not overload one confidence column. Keep distinct dimensions where applicable:
Evidence status: established, probable, possible, disputed, unknown
Textual basis: explicit, strongly implied, inferred, disputed
Identification status: established, traditional, proposed, disputed, unknown
Date precision: exact day/year, range, decade, century, relative only, unknown
Location precision: exact site, apyroximate point, bounded area, candidates, unknown
Ancient date values also identify calendar/chronology system, BCE/CE or astronomical year-number
convention, inclusive/exclusive bounds, source-supplied versus converted value, conversion method,
and display policy. Sorting uses normalized astronomical bounds while the reader never sees a year
zero unless an approved display policy requires it.

interpretive_questions and positions
Store responsible competing positions without overwriting each other. Each position carries a
named perspective/tradition, claims, evidence, reviewers, reader-facing qualification, and display
policy. Typology, fulfillment, authorship, chronology, and disputed identities may require this.
Sources and citations
Separate bibliographic work identity from exact source_editions. A claim_citation links one
claim to one exact source edition and locator, with support kind (supports, qualifies,
disputes， background) and reviewer note. Important claims require precise locators. Al output
is never a source.
Use a common revision-object registry or typed junctions to associate claims with prose and graph
edges while retaining foreign-key integrity; do not use unchecked (content_type, content_id)
polymorphism.

Rights
Model rights_holders,exact licenses,distributable rights_subjects, rights_grants,and
localized attribution_templates.
Each grant includes:
Subject and operation
Allowed, denied, or unknown state
Language, territory, and effective-date constraints
Quotation/count limits
Attribution requirement and placement

Operations are Independent: mobile display, full chapter, on

by hiding a Ul button.

Editorial and publication model

Private editorial tables record:
Ingest submission and raw artifact digest
Trusted generation receipt and input-bundle digest
Validation runs and structured findings
Reviewer assignments and qualifications
Append-only review decisions against exact digests
Human approvals
Audit transitions and change reasons
An approval_policies registry versions required reviewer disciplines, reviewer counts,
author/approver separation, native-language review, disputed-claim escalation, rights approval,
and publication authority for each content/package kind. Owner-selected values remain a Phase 0
decision, but publication must enforce the selected policy version.
Al actors are prohibited from approving or publishing.

Immutable package publication
package_manifests,package_members,package_dependencies,and publication_releases define
compatible atomic delivery sets. A manifest includes schema/content version, canon/reference
system, locale, optional translation edition, coverage scopes, minimum app version, checksum,
size, approval, publication time, and superseded package.
Useful package boundaries are:
Canon/reference catalog
Translation-edition Scripture
Canonical knowledge graph
Locale context and profiles
Edition-specific mentions/render spans
Maps/assets
Search projection
Daily content

instead of deleting history.

auta

Generate, do not curate:

Canonical verse/reference counts
Explicit and indirect surface-mention counts per edition
Book/chapter/passage counts
First/last and chronological appearances
Reverse and inverse relationship projections
Related-entity rankings from approved edges
Reader-ready Scripture spans
Timeline/map cards
Search documents and licensed FTS indexes
• Package checksums and compatibility indexes
Every derived artifact records its source release, algorithm/validator version, and build checksum.
Never display an unlabeled generic "mentions" count; define whether it means canonical attestations,
edition surface mentions, indirect references, or relevant passages.

Required indexes and invariants
Indexes must cover references and ordinals, edition text lookup, entity keys/names, attestations in
both directions, edition mentions by entity and verse, graph edges in both directions, event
participants, scope relevance/relations, claims/citations, publication state, and rights-effective
queries. FTS exists only where the license permits it.
Database/build invariants include:
• Ordered scope boundaries and acyclic parents
• Exactly one typed claim object
• Predicate-compatible subject/object types
No self-edge unless allowed
Event extensions reference event entities
Edition mention and text editions match
Mention target XOR and non-overlapping generated spans
Published/approved digests are immutable
Allow-listed lifecycle transitions
Al actors cannot approve or publish
Unknown rights fail closed
Substantive claims require citations
Public rows belong to an effective publication release

SQLite publication projection
SQLite is not a copy of editorial Postgres. Ship only reader-facing data:
Installed package manifest, dependencies, active release, and install journal
Books, chapters, edition text, render spans, and registered scopes
Localized entity profiles/names and scope-entity cards
Entity occurrences and precomputed groups/counts
Related entities, event summaries/participants, and scope relations
Context sections, timelines, map assets/hotspots, and reader-visible source summaries
Licensed Scripture/content FTS and reviewed aliases
Local preferences, progress, bookmarks/tombstones, recents, downloads, outbox, and cursors
Do not ship raw Al responses, drafts review

Security and synchronization
Content is immutable one-way delivery. User state is separate local-first two-way synchronization.
RLS protects every client-accessible table; public clients cannot write editorial data or see
drafts. Anonymous reading history stays local unless the user explicitly enables account sync.
User writes use stable client UUIDs, local transaction plus outbox mutation, idempotent server
application, tombstones, cursored pull, and documented conflict rules. Never synchronize raw search
queries, selected Scripture text, share recipients, or anonymous history without explicit consent.

Required implementation sequence
1. Resolve canon, edition, rights, locale, reviewer, and fallback decisions.
2. Adopt a replacement ADR for this logical model.
3. Implement versioned content schemas and golden fixtures.
4. Validate the Nehemiah 2 subset, including a future versification fixture.
5. Create Postgres migrations, publication views, import tools, and RLS tests.
6. Generate a compact SQLite release and test transactional install/rollback.
7. Expand reviewed content incrementally; never treat schema readiness as content approval.
