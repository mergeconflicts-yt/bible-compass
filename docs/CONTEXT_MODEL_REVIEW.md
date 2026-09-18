# CONTEXT_MODEL_REVIEW

Context Model Independent Review

Status
Review performed against the future-ready specification, the concurrent DATA_MODEL_V2.md and
proposed ADR-002, and the governing product/content/security documents. No production schema or
content was approved by this review.

Review disciplines
Principal relational/backend architecture
Biblical ontology and editorial curation
Al-ingestion security and deterministic publication

Consensus findings incorporated

1. Keep PostgreSQL as a relational knowledge graph and SQLite as a reader projection.
2. Qualify Scripture addresses by reference/versification system and support split/merge/omitted/
   reordered mappings.
3. Separate a translation work from an immutable translation edition.
4. Separate canonical Scripture attestations, edition surface mentions, and contextual relevance.
5. Never expand passage relevance across its verses or use it as a textual reference count.
6. Make claims the evidence boundary; citations to broad prose records are insufficient.
7. Version localized prose independently and avoid structural preference for English.
8. Separate evidence strength, textual basis, identity status, date precision, location precision,
   and interpretive perspective.
9. Represent events with participants, places, Scripture accounts, and event relationships.
10. Use structured, scoped relationship assertions and localized rendering.
11. Replace coarse rights flags with operation-level, time/territory/language-aware grants.
12. Bind human approval to exact immutable digests and publish compatible atomic releases.
13. Treat Al output as quarantined draft data and derive offsets, counts, spans, hashes, and IDs.
14. Track curation coverage and unresolved questions so partial work is never presented as complete.

Findings in the concurrent draft that must not be implemented

from passage roles. This creates false occurrences and counts.
A globally canonical Neh.2.4, integer-only verses, and global book chapter_count do not cover
future reference systems and versification differences.
translations does not identify immutable editions, so corrected text can invalidate anchors.
One certainty enum combines unrelated evidence, precision, tradition, and dispute dimensions.
passage_versions. locale plus separate passage localizations gives locale two owners.
A single passage parent cannot represent overlapping, alternate, non-contiguous, or cross-chapter
segmentation.
Free-text relationship time qualifiers and static English-shaped sentence templates are not
queryable or reliably localizable.
Record-level citation junctions cannot prove individual claims inside prose or relationships.

Adoption gate
Before migrations, the executable contracts must demonstrate:

1. One person shared across multiple locales and immutable translation editions.
2. A relevant passage entity that is not counted as textually mentioned.
3. A split or merged reference mapping.
4. A corrected edition that preserves the old edition and its spans.
5. Competing chronology/identity positions without destructive overwrite.
6. A cross-chapter or alternate-segmentation passage.
7. An event with participants, places, and multiple Scripture accounts.
8. Telugu/Tamil mention selectors that remain grapheme-safe.
9. A claim traced to an exact source locator and checksum-bound human approval.
10. Honest partial-coverage reporting.
11. Rights-unknown failure for display/offline/search/image/web operations.
12. Atomic package install and rollback to the last healthy release.

Procedural disposition
The new context-platform documents are consolidated review drafts. They do not silently adopt or
supersede the uncommitted DATA_M0DEL_V2.md, the proposed ADR-002, the existing MVP data model, or
ADR-O01. The owner must choose one authoritative adoption path after resolving Phase 0 decisions.
