-- Migration: 20260916000023_membership_backfill
-- Blocker 1 for existing databases.
--
-- Migration 22 switched the public API to read package_row_memberships but did
-- not backfill it (and an applied migration must not be edited), so a database
-- that already had owned rows would see published content disappear. This
-- additive migration backfills memberships from origin_package_id for every
-- supported row kind. It is idempotent (on conflict do nothing) and safe to
-- re-run.
--
-- Rows with NULL origin are legacy/other-package and are not claimed, which is
-- consistent with "NULL is not publishable". The importer bump to revision 7
-- additionally repopulates memberships from the exact curated keys.

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'entity_name', id from private_staging.entity_names
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'entity_description', id from private_staging.entity_descriptions
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'reference_entity_attestation', id from private_staging.reference_entity_attestations
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'edition_mention', id from private_staging.edition_mentions
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'scope_entity_relevance', id from private_staging.scope_entity_relevance
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'entity_relationship_assertion', id from private_staging.entity_relationship_assertions
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'event', entity_id from private_staging.events
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'event_participant', id from private_staging.event_participants
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'event_place', id from private_staging.event_places
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'event_scripture_account', id from private_staging.event_scripture_accounts
  where origin_package_id is not null on conflict do nothing;

insert into private_staging.package_row_memberships (package_id, row_kind, row_id)
select origin_package_id, 'place_geometry', entity_id from private_staging.place_geometries
  where origin_package_id is not null on conflict do nothing;
