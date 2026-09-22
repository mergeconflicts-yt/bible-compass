-- Migration: 20260916000019_uniqueness_and_indexes
-- Findings 35 (natural uniqueness + whole-Bible indexes) and part of 37.
--
-- Concurrent importers and whole-canon queries need natural keys, not only
-- surrogate ids. Additive partial unique indexes (nullable natural-key
-- columns) plus lookup indexes. If a pre-existing deployment already holds
-- duplicates the index creation fails loudly; that is the point — duplicates
-- must be reconciled, never silently tolerated.

-- ---------------------------------------------------------------------------
-- Natural uniqueness
-- ---------------------------------------------------------------------------
-- One mention per (edition, verse, entity, quote, ordinal). entity_id is
-- nullable (context-card mentions), so scope the index to entity mentions.
create unique index if not exists uq_edition_mentions_natural
  on private_staging.edition_mentions
  (edition_id, verse_id, entity_id, quote, occurrence_ordinal)
  where entity_id is not null;

-- One membership row per (package, member).
create unique index if not exists uq_package_members_entity
  on private_staging.package_members (package_id, entity_id)
  where entity_id is not null;
create unique index if not exists uq_package_members_claim
  on private_staging.package_members (package_id, claim_id)
  where claim_id is not null;
create unique index if not exists uq_package_members_context_revision
  on private_staging.package_members (package_id, context_revision_id)
  where context_revision_id is not null;

-- One citation per (claim, release, locator).
create unique index if not exists uq_claim_citations_natural
  on private_staging.claim_citations (claim_id, source_release_id, locator);

-- (translation_edition_verses already has unique (edition_id, reference_unit_id)
-- from the base schema, so no duplicate index is added here.)

-- One external-id mapping per (entity, source, external id) is the PK; add a
-- reverse lookup for resolving a source row to an entity.
create index if not exists idx_external_ids_reverse
  on private_staging.entity_external_ids (source, external_id);

-- ---------------------------------------------------------------------------
-- Whole-Bible query indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_attestations_reference_unit
  on private_staging.reference_entity_attestations (reference_unit_id);
create index if not exists idx_attestations_entity
  on private_staging.reference_entity_attestations (entity_id);
create index if not exists idx_mentions_entity
  on private_staging.edition_mentions (entity_id);
create index if not exists idx_mentions_verse
  on private_staging.edition_mentions (verse_id);
create index if not exists idx_relevance_entity
  on private_staging.scope_entity_relevance (entity_id);
create index if not exists idx_relationship_subject
  on private_staging.entity_relationship_assertions (subject_entity_id);
create index if not exists idx_relationship_object
  on private_staging.entity_relationship_assertions (object_entity_id);
create index if not exists idx_verses_reference_unit
  on private_staging.translation_edition_verses (reference_unit_id);
create index if not exists idx_entity_names_entity
  on private_staging.entity_names (entity_id);
create index if not exists idx_event_participants_entity
  on private_staging.event_participants (entity_id);
create index if not exists idx_event_places_place
  on private_staging.event_places (place_id);
