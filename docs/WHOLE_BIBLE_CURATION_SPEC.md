# WHOLE_BIBLE_CURATION_SPEC

Whole-Bible Curation Specification

Status and coverage policy

DRAFT FOR SPECIALIST REVIEW

reviewed packages for any supported work. Nehemiah 2 remains the only first-MVP production slice.

Not every verse needs an essay and not every possible range becomes a passage. Every verse needs
structure and linkability; rich context is curated for meaningful literary or narrative scopes.

Curation dimensions

Store once canonically Store per locale Store per translation Generate at build time
edition

Entity/event identity Names and aliases Exact Scripture Counts and groupings

Semantic relationships Profiles and context Surface mentions First/last appearances

Scripture attestations Role explanations FIender spans Search documents

Registered scopes Map/timeline copy Publisher formatting Reverse edges

Event participation Accessibility copy Edition reference mapping Mobile projections

Claims and evidence Disagreement wording Attribution where edition- Checksums
specific

Canon and reference inventory

For every supported canon collect:
Immutable canon key, tradition/family, localized name, evidence, status
Included works, order, grouping, and any combined/divided work relationships
Named reference/versification system
Every addressable work/chapter/verse/segment unit and total order
Mappings to other supported systems: exact, split, merge, reordered, omitted, added, uncertain
Review state and provenance of the structural import
Structural data should come from authoritative sources or deterministic imports, not generated
prose.

Translation-edition inventory
For every exact edition collect:
Translation work, edition/revision key, language/locale, canon, reference system
Publisher/rightsholder, source artifact, checksum, dates, supersession
Required attribution by surface and locale

image, native share, download, web excerpt, preview, and audio
Territory, language, effective/expiry, quota, and placement constraints

Edition-to-reference mappings where structure is not one-to-one

Every work/book
Create a lightweight work scope and curate, where supportable:
• Localized names, abbreviations, transliterations, and search aliases
Genre and literary structure
• Book overview and concise purpose
• Historical, cultural, political, and geographic setting
• Authorship, audience, and date as claims/positions, not unconditional columns
• Ordered sections and chapter scopes
Major persons, collectives, places, events, roles, objects, practices, terms, and themes
Canonical relationships to other works
• Sources, claims, certainty dimensions, perspectives, and reviews

Every chapter
Create an addressable chapter scope even before rich content exists. Curate when useful:
Localized title and position within the book outline I
• Concise summary and narrative/argument movement
Who, where, when, what, before, and what follows
Major registered passage units
Major entities, events, terms, and themes
Geographic and chronological movement
Sources, claims, and review status
Do not force artificial content into an inapplicable orientation field.

Every curated passage
Register meaningful units such as scenes, speeches, poems, prayers, genealogies, laws, prophecies,
visions, parables, miracle accounts, journey stages, letter arguments, and cross-chapter units.
Collect:
Stable key, kind, boundaries/members, segmentation scheme, parent/containment relationships
Alternate boundaries and boundary certainty where disputed
Localized title and literary function
Who, where, when, what, before, stakes, immediate summary, and what-next as appropriate
Participating entities and passage-specific roles/states
Events reported, recalled, anticipated, interpreted, or alluded to
Places, movements, objects, institutions, practices, and key terms
Historical/cultural/linguistic context
Passage relations: parallel, same event, quotation, allusion, echo, fulfillment, explanation,
contrast, cause/result, before/after, genealogy, geography, shared theme
Maps, timeline projections, claims, citations, perspectives, and reviews

veryveise
Required lightweight data and coverage state:
Reference unit and memberships in chapter/section/registered passages
Edition-text mappings
A coverage result for each applicable annotation class
Zero or more canonical entity attestations
Zero or more edition-specific surface mentions
Zero or more event and place links
Zero or more reviewed quotation/parallel/allusion links
Zero or more important term/concept links
Ambiguous or unresolved referents
Claims and review status for annotations
Optional when useful and supportable:
Speaker and addressee
• Discourse/literary function
Local setting or time expression
Immediate event
Short term, language, cultural, or textual note I
Coverage results distinguish complete_zero，complete_with_records,incomplete,blocked,
and not_applicable ; absence of rows alone never means a verse was reviewed. Verse commentary is
sparse and purposeful. Scripture remains visually and structurally distinct.

Every person

Identity and names
Stable identity key and type
Localized preferred names, aliases, titles, epithets, transliterations, original-language forms
Translation-edition renderings where exceptional
Same-as, possible-same-as, and distinct-from assertions
Identification status and evidence

Profile
Concise identification and reviewed biography
Origin, community, tribe/polity, family, active period
Roles/offices over time
Associated places and major events
Sources and claim-level provenance

Relationships and appearances
Kinship, ancestry, marriage, affiliation, authority/service, allies/opponents, succession
Residence, travel, exile, rule, burial, and event participation
Canonical Scripture attestations and edition-specific mentions
Passage-specific role, current state, goal/action, priority, and explanation

Stable identity and place type

Geographic containment and political control over time
Point, area, route, or candidate-site geometry with CRS
Location/identification precision and competing candidates
Physical description where relevant
Associated people, groups, events, and routes
• Scripture attestations and edition mentions
• Map features, asset rights, claims, citations, and reviews
Never encode a disputed location as one falsely exact coordinate.

Every event
Stable identity, event type, localized title/description
Participants and their event roles
Places and their event roles
• Objects, groups, and practices involved
Structured date bounds, calendar/chronology system, precision, competing positions
Parent/subevents, sequence, causes/contributors, and result
Scripture accounts classified as reports, recalls, anticipates, interprets, or alludes
Historical significance, passage relevance, claims, sources, perspectives, and reviews

Other entity inventories

Collectives, nations, tribes, institutions, and polities
Subtype, names by language/period, membership, leaders, territory, active period
Predecessors/successors, relationships, events, and Scripture attestations
Do not conflate ethnic, political, religious, kinship, and narrative collectives

Roles and offices
Definition, culture/period, responsibilities, authority, appointment/inheritance pattern
Holders with time/scope qualifiers and passage-specific significance

Objects, artifacts, and structures
Instance versus class, physical characteristics, materials, function, ownership/use/location
Events, practices, attestations, and separately modeled symbolic interpretations

Practices, customs, laws, and covenants

Documents and compositions
Work/document identity, type, author/sender/addressee claims, embedded/quoted scopes
Relationships to events, people, and other documents

Lexical terms
• Original language/script, lemma, transliteration, licensed morphology where in scope
Distinct senses, verse applicability, translation-edition renderings, semantic relations
Lexicon edition and locator; do not conflate lexeme, sense, gloss, and theological concept

Concepts and themes
Stable definition, scope/exclusions, supporting passages, development across works
Related entities/events/practices/terms, interpretive perspective, sources, reviews
Themes are editorial assertions, not keyword matches

Measurements, currency, plants, and animals I
Canonical identity, localized names, historical range/value or taxonomy with uncertainty
Edition renderings, relevant practices/events, attestations, sources, and rights

Maps, routes, and timelines
For each asset or feature curate:
• Immutable asset/rendition key, dimensions, MIME type, checksum, storage path
Period, scope, projection/CRS, legend, uncertainty, accessible description
Hotspots/geometries with evidence-limited precision
Ancient/modern labels and localized reader copy
Source/evidence and operation-level rights/attribution
Routes are approximate unless evidence supports precision. Timeline rows are generated views of
events and competing chronology positions.

Claims, sources, and disagreement
Every substantive historical, geographic, linguistic, chronological, cultural, identity, and
interpretive assertion is a claim with:
Subject, predicate, one typed object/value
Scripture/time/place applicability

Perspective/tradition when interpretive
Exact source-edition citations and locators
Reviewer decisions and immutable revision

ungualified value Al output is never a source

Localization inventory
Independently revise and review:
Names, aliases, transliterations, profiles
Book/chapter/passage context and entity-role explanations
Event, relationship, theme, practice, object, and term copy
Timeline and map labels, legends, uncertainty, accessibility descriptions
Search aliases and daily context
Store locale, source language/revision, translation method, reviewer, and status. Fallback is an
explicit product policy: hide, block, or visibly label a fallback language.

Coverage and workflow records
Track coverage instead of assuming completeness:
Scope and annotation/content type
Required, not started, drafting, blocked, review, approved, published
Counts expected/curated/validated/reviewed
Known gaps and blocking questions
Curation batch, input snapshot, assignee, reviewer requirements, findings
An entity catalog can be complete for explicit named persons while still incomplete for pronoun
resolution, indirect references, localizations, or historical profiles.

Generated outputs
Do not ask curators or Al to author:
• Offsets/hashes/checksums
Mention/book/chapter/passage counts
First/last appearances and chronological ordering
Reverse/inverse edges
Search tokens and relevance ranking
Reader render spans
Package compatibility records
Generate these from approved atomic attestations, mentions, claims, and relationships. Derived
records retain source-release, algorithm, validator, and build-checksum lineage.

Expansion order
1. Canon/reference skeleton, edition text, and rights
2. Work/chapter/passage structure
3. Major people, places, collectives, events, and roles
4. Canonical attestations
5. Edition-specific mentions
6. Passage relevance and orientation
7. Relationships, chronology, and cross-references
8. Objects, practices, terms, concepts, and themes
9. Maps, timelines, localizations, and alternate positions
10. Generated search/reference/history projections
