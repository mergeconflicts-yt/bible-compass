-- Migration: 20260916000020_active_release_and_external_id_uniqueness
-- Safe fixes: exactly one active release per locale; published_verses gated on
-- an active published package; a source external id maps to at most one entity.
--
-- Additive. Applied in order after 20260916000019.

-- ---------------------------------------------------------------------------
-- 1. Exactly one active publication release per locale.
-- The old index was non-unique, so several releases could be active at once and
-- package_is_published() would accept any of them.
-- ---------------------------------------------------------------------------
drop index if exists private_staging.idx_publication_releases_active;
create unique index if not exists uq_publication_releases_active_locale
  on private_staging.publication_releases (locale)
  where is_active;

-- ---------------------------------------------------------------------------
-- 2. published_verses must be backed by an ACTIVE published package, not only
--    translation_editions.status = 'published'. This applies the same
--    approval / rights / active-release gates as the rest of the public API.
--    (DROP VIEW removes grants + security_invoker, so both are re-applied.)
-- ---------------------------------------------------------------------------
drop view if exists public_content.published_verses;

create view public_content.published_verses as
select distinct ed.key as edition_key,
       rs.key as refsys_key,
       w.osis_code as book_osis,
       v.chapter,
       v.verse_number,
       ru.local_key,
       v.text,
       v.text_sha256
from private_staging.translation_edition_verses v
join private_staging.translation_editions ed on ed.id = v.edition_id
join private_staging.reference_systems rs on rs.id = ed.reference_system_id
join private_staging.scripture_works w on w.id = v.book_id
join private_staging.reference_units ru on ru.id = v.reference_unit_id
where ed.status = 'published'
  and exists (
    select 1 from private_staging.package_manifests pkg
    where pkg.translation_edition_id = ed.id
      and private_staging.package_is_published(pkg.id)
  );

alter view public_content.published_verses set (security_invoker = true);
grant select on public_content.published_verses to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. A source external id maps to at most one entity. YHVH_1 was mapped to both
--    entity:god and entity:jesus-christ; the registry now assigns it only to
--    entity:god (jesus-christ carries no unambiguous source row), and this index
--    makes any future duplicate fail loudly.
-- ---------------------------------------------------------------------------
create unique index if not exists uq_entity_external_ids_source
  on private_staging.entity_external_ids (source, external_id);
