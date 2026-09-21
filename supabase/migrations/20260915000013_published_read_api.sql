-- Migration: 20260915000013_published_read_api
-- Task EN-04 — Supabase read API for the mobile client.
--
-- Recreates the three public_content views with STABLE, client-safe keys so a
-- published-only read repository can address rows without surrogate ids:
--   published_entities(key, slug, type, identification_status)
--   published_attestations(entity_key, scope_key, reference_local_key, kind,
--                          explicitness, review_state)
--   published_verses(edition_key, refsys_key, book_osis, chapter,
--                    verse_number, local_key, text, text_sha256)
--
-- Still fail-closed and private by default:
--   * every view stays published-only (published package / review_state /
--     edition status) and runs with security_invoker, so underlying RLS
--     decides visibility; draft rows are never exposed.
--   * the joins read structural canon tables (works, reference systems,
--     reference units, scopes) which carry no draft content, so anon gets
--     read grants + permissive policies for those tables only.
-- Grants and security_invoker are re-applied because DROP VIEW removes them.

-- ---------------------------------------------------------------------------
-- 1. structural canon read grants (no drafts; book codes and references)
-- ---------------------------------------------------------------------------
grant usage on schema private_staging to anon, authenticated;
grant select on private_staging.scripture_works to anon, authenticated;
grant select on private_staging.reference_systems to anon, authenticated;
grant select on private_staging.reference_units to anon, authenticated;
grant select on private_staging.scripture_scopes to anon, authenticated;

create policy allow_anon_structure_scripture_works on private_staging.scripture_works for select to anon using (true);
create policy allow_authenticated_structure_scripture_works on private_staging.scripture_works for select to authenticated using (true);
create policy allow_anon_structure_reference_systems on private_staging.reference_systems for select to anon using (true);
create policy allow_authenticated_structure_reference_systems on private_staging.reference_systems for select to authenticated using (true);
create policy allow_anon_structure_reference_units on private_staging.reference_units for select to anon using (true);
create policy allow_authenticated_structure_reference_units on private_staging.reference_units for select to authenticated using (true);
create policy allow_anon_structure_scripture_scopes on private_staging.scripture_scopes for select to anon using (true);
create policy allow_authenticated_structure_scripture_scopes on private_staging.scripture_scopes for select to authenticated using (true);

-- ---------------------------------------------------------------------------
-- 2. published views (stable keys, published only)
-- ---------------------------------------------------------------------------
drop view if exists public_content.published_attestations;
drop view if exists public_content.published_verses;
drop view if exists public_content.published_entities;

create view public_content.published_entities as
select e.key, e.slug, e.type, e.identification_status
from private_staging.entities e
join private_staging.package_members pm on pm.entity_id = e.id
join private_staging.package_manifests pkg on pkg.id = pm.package_id
where pkg.published_at is not null
  and pkg.published_at <= now()
  and pkg.locale in ('en','te','ta');

create view public_content.published_attestations as
select e.key as entity_key,
       sc.key as scope_key,
       ru.local_key as reference_local_key,
       a.kind,
       a.explicitness,
       a.review_state
from private_staging.reference_entity_attestations a
join private_staging.entities e on e.id = a.entity_id
join private_staging.scripture_scopes sc on sc.id = a.scope_id
join private_staging.reference_units ru on ru.id = a.reference_unit_id
join private_staging.package_members pm on pm.claim_id = a.claim_id
join private_staging.package_manifests pkg on pkg.id = pm.package_id
where pkg.published_at is not null
  and pkg.published_at <= now()
  and a.review_state = 'published';

create view public_content.published_verses as
select ed.key as edition_key,
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
where ed.status = 'published';

alter view public_content.published_entities set (security_invoker = true);
alter view public_content.published_attestations set (security_invoker = true);
alter view public_content.published_verses set (security_invoker = true);

grant select on public_content.published_entities to anon, authenticated;
grant select on public_content.published_attestations to anon, authenticated;
grant select on public_content.published_verses to anon, authenticated;
