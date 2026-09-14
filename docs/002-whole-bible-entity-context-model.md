# 002-whole-bible-entity-context-model

ADR-O02: Whole-Bible Entity, Relationship and Context Model

Status
Superseded by ADR-003. Kept for history: this was
the first whole-Bible redesign pass, and a specialist review (CoNTEXT_MODEL_REVIEW.md) found
concrete defects in it — see ADR-O03's Context section. Do not implement this ADR's schema.
Proposed. Extends the MVP data model in DATA_MODEL. md and the identifier scheme in
CANONICAL_IDENTIFIERS. md . Does not change PD-O10 through PD-O12 (still OPEN ); this ADR is
schema shape only, not new licensed content.

Context
The MVP data model was built for one passage (Neh.2.1-Neh.2.8). The product goal is broader:
every person, place, event, object, role, group and term in the whole Bible should be a reusable,
cross-referenced entity — with a visible answer to "where else does this appear" and "what is its
history" — and every book, chapter and passage should be able to carry its own context, not just
the hand-picked passage units. The existing model has three gaps:
1. timeline_events is a table parallel to entities, not a kind of entity. Events cannot be
localized, aliased, related to people/places, or looked up the way l person or place can.
2. There is no translation-independent index of "every verse or passage this entity appears in."
verse_anchors (one exact text span, one translation) and passage_entities (role within one
curated passage) are both narrow, curated, and optional — neither is required to exist for a
mention to be real, and neither answers a whole-Bible "everywhere Nehemiah appears" query
cheaply.
3. passages only models custom ranges. There is no addressable "context for this chapter" or
"context for this book," and no parent/child link from a small passage unit up to its
containing chapter and book.

Decision

Events become entities
entities.type gains event alongside the existing types.
timeline_events becomes a 1:1 extension table keyed by entity_id (entities where
type = 'event'): it holds only what is specific to an event — start/end date bounds,
date_precision, and a default display_mode for timeline rendering. Name, description,
aliases, confidence and review status move to entities / entity_localizations /
entity_aliases, same as every other entity type.

Consequence: an event gets a slug, a multilingual name and description, and can participate in
already routes any entity type, so this needs no new route.

genealogical_listing), source (anchor, passage_entity, curated), confidence and
review_status.
This is the backbone for "every verse/passage this entity is mentioned in." It is populated
three ways: automatically from published verse_anchors,automatically from published
passage_entities (covering that passage's verse range), and directly by curators for mentions
that have neither an anchor nor a curated passage unit yet (for example a name inside a
genealogy list). Anchors and passage-entity roles stay as richer, narrower layers on top — this
table does not replace them, it guarantees every entity has some addressable footprint even
before either richer layer is authored.

A core structural relationship graph
New entity_relationships table: subject_entity_id,a closed relationship_type enum,
object_entity_id,an optional free-text temporal_qualifier,confidence,review_status,
content_version.
Scope for this pass is deliberately narrow — family (parent_of，pouse_of，sibling_of),
authority(ruler_of,governor_of，served_under), oppositionopposed), group membership
(member_of), and place containment (located_in,part_of), plus succession
(predecessor_of,successor_of ). This is enough to power "his history" (who he served,
who opposed him, what he was part of) and place/map hierarchy (a city located in a province
located in an empire) without building a general-purpose ontology.
relationship_type is a closed, language-independent enum, not free text, and not itself
localized. Each enum value maps to a per-language sentence template (for example
en: "{subject} was governor of {object}") held as a static Ul resource, not a database row —
this keeps adding a relationship cheap and avoids a second translation-review queue. If a
the entity's own extended_description,not in a bespoke relationship sentence.

Chapters and books are addressable context units
passages gains context_kind (moment | chapter_overview | book_overview, default
moment), parent_passage_id (nullable, self-referencing), book_id, and nullable chapter.
Every canonical chapter gets exactly one chapter_overview passage row (canonical_key equal
to the chapter, e.g. Neh.2); every canonical book gets exactly one book_overview passage row
(canonical_key equal to the book, e.g. Neh). A moment passage's parent is its containing
row; a book_overview has no parent. chapter's chapter_overview row; a chapter_overview 's parent is its book's book_overview
bible_books gains chapter_count integer not null so the content pipeline can generate every
chapters per book. canonical chapter_overview row and validate verse coordinate bounds without hand-listing
passage_contexts.immediate_summary and stakes_text become nullable -they are moment
concepts. The content pipeline (not a DB constraint) requires them for context kind = 'moment'
and leaves them empty for chapter/book overviews, which use who / where_text / when text /
what_text / before_text as a broader orientation summary instead.
Consequence: a passage unit can always say "here is broader chapter context"/ "here is book
authoring from day one, whether or not anyone has written context" by walking parent_passage_id, and every chapter/book is a valid target for content

Schema is whole-canon-ready now; content stays incremental

All of the above ships as schema and generated skeleton rows (book:r, chapters, empty
book_overview /chapter_overview passages) for the full 66-book canon as soon as bible_books
is seeded, independent of which books have authored, reviewed content. This avoids a breaking
migration every time a new book's content is added — only new rows are inserted, never new tables
or columns. It does not change the content or rights timeline: docs/PRoDucT_DECIsIoNS.md and
docs/coNTENT_RIGHTS. md still gate what can be published, and Nehemiah 2 remains the only
reviewed slice until the owner approves more.

Consequences
DATA_MoDEL. md is updated with the concrete table shapes (see that file for authoritative
column lists — this ADR records the decision and reasoning, not the final DDL).
The content pipeline gains one bootstrap step: generate book_overview and chapter_overview
passage skeletons from bible_books + chapter_count, before any translation import.
Publishing an anchor or a passage-entity role must also upsert the corresponding
entity_appearances row(s); this is a content-pipeline validation rule, not optional cleanup.
Timeline authoring tools now create an entities row (type event) plus a timeline_events
extension row, instead of a single flat timeline_events insert — update
NEHEMIAH_2_CONTENT_INVENTORY. md 's timeline inventory'format the next time it is touched.
Relationship sentence templates are a new small localization surface (Ul copy, not content-DB
rows) and need at least English, Telugu and Tamil templates per relationship_type before
relationships can render outside English.

Open questions
Should entity_appearances rows generated automatically from verse_anchors /
passage_entities be deleted/regenerated on every republish, or diffed? oPEN — decide when
the publication pipeline is built.
Whether mention_type: genealogical_listing needs per-mention role detail (e.g. "son of X") or
is sufficiently covered by entity_relationships. OPEN — revisit once a genealogy-heavy book
is in scope.
