-- Migration: 20260916000021_publication_ownership_hardening
-- Blockers 3, 4, 5, 6.
--
-- Migration 17 (and 20) are treated as already applied: this migration
-- recreates the affected published views and function rather than editing
-- them.
--
--   * published_attestations is now gated by the ATTESTATION's own ownership
--     (direct attestation ownership), not by a claim membership the vast
--     majority of attestations do not have (blocker 5).
--   * every attached row (names, mentions, relevance, relationships, events)
--     must be owned by a PUBLISHED package: a NULL origin is no longer treated
--     as publishable (blocker 4).
--   * scope discovery (which entities belong to a scope) only considers
--     published, owned attestations/relevance/events.
--   * duplicate external identifiers are reconciled to a single canonical
--     owner before the unique index is ensured (blocker 6).

-- ---------------------------------------------------------------------------
-- 1. Reconcile duplicate external identifiers, then ensure uniqueness.
-- Source IDs (e.g. YHVH_1) may currently map to more than one entity.
-- ---------------------------------------------------------------------------
delete from private_staging.entity_external_ids x
using (
  select eei.source, eei.external_id, min(e.key) as keep_key
  from private_staging.entity_external_ids eei
  join private_staging.entities e on e.id = eei.entity_id
  group by eei.source, eei.external_id
  having count(*) > 1
) d
where x.source = d.source
  and x.external_id = d.external_id
  and (select e2.key from private_staging.entities e2 where e2.id = x.entity_id) <> d.keep_key;

create unique index if not exists uq_entity_external_ids_source
  on private_staging.entity_external_ids (source, external_id);

-- ---------------------------------------------------------------------------
-- 2. Public views: direct ownership gating, no NULL escape.
-- ---------------------------------------------------------------------------
drop view if exists public_content.published_attestations;
drop view if exists public_content.published_verses;
drop view if exists public_content.published_entities;

create view public_content.published_entities as
select distinct e.key, e.slug, e.type, e.identification_status
from private_staging.entities e
join private_staging.package_members pm on pm.entity_id = e.id
join private_staging.package_manifests pkg on pkg.id = pm.package_id
where private_staging.package_is_published(pkg.id);

-- Direct attestation ownership: an attestation is published when it is itself
-- marked published and owned by a published package. No claim required.
create view public_content.published_attestations as
select distinct e.key as entity_key,
       sc.key as scope_key,
       ru.local_key as reference_local_key,
       a.kind,
       a.explicitness,
       a.review_state
from private_staging.reference_entity_attestations a
join private_staging.entities e on e.id = a.entity_id
join private_staging.scripture_scopes sc on sc.id = a.scope_id
join private_staging.reference_units ru on ru.id = a.reference_unit_id
where a.review_state = 'published'
  and private_staging.package_is_published(a.origin_package_id);

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

alter view public_content.published_entities set (security_invoker = true);
alter view public_content.published_attestations set (security_invoker = true);
alter view public_content.published_verses set (security_invoker = true);

grant select on public_content.published_entities to anon, authenticated;
grant select on public_content.published_attestations to anon, authenticated;
grant select on public_content.published_verses to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Bundle: every attached row requires published ownership.
-- ---------------------------------------------------------------------------
drop function if exists public_content.published_context_bundle(text, text, text);

create or replace function public_content.published_context_bundle(
  p_scope_key text,
  p_locale text default 'en',
  p_edition_key text default null
)
returns jsonb
language sql
stable
security definer
set search_path = private_staging, pg_temp
as $$
with
scope as (
  select id, key, reference_system_id, start_unit_id, end_unit_id
  from scripture_scopes
  where key = p_scope_key
),
pub_entities as (
  select distinct e.id, e.key, e.slug, e.type, e.identification_status
  from entities e
  join package_members pm on pm.entity_id = e.id
  join package_manifests pkg on pkg.id = pm.package_id
  where private_staging.package_is_published(pkg.id)
    and pkg.locale = p_locale
),
pub_claims as (
  select distinct c.id, c.key, c.subject_type, c.subject_id, c.predicate, c.object_type, c.object, c.evidence_status, c.textual_basis
  from claims c
  join package_members pm on pm.claim_id = c.id
  join package_manifests pkg on pkg.id = pm.package_id
  where private_staging.package_is_published(pkg.id)
    and pkg.locale = p_locale
    and c.review_state = 'published'
),
pub_context_revisions as (
  select distinct cr.id, a.scope_id
  from context_revisions cr
  join context_artifacts a on a.id = cr.artifact_id
  join package_members pm on pm.context_revision_id = cr.id
  join package_manifests pkg on pkg.id = pm.package_id
  where private_staging.package_is_published(pkg.id)
    and pkg.locale = p_locale
),
scope_entity_ids as (
  select r.entity_id from scope_entity_relevance r join scope s on s.id = r.scope_id
   where private_staging.package_is_published(r.origin_package_id)
  union
  select a.entity_id from reference_entity_attestations a join scope s on s.id = a.scope_id
   where a.review_state = 'published'
     and private_staging.package_is_published(a.origin_package_id)
  union
  select ep.entity_id
  from event_participants ep
  join event_scripture_accounts esa on esa.event_id = ep.event_id
  join scope s on s.id = esa.scope_id
  where private_staging.package_is_published(ep.origin_package_id)
),
scope_entities as (
  select distinct pe.* from pub_entities pe join scope_entity_ids sei on sei.entity_id = pe.id
),
scope_units as (
  select ru.id as unit_id, ru.local_key, ru.chapter_label, ru.verse_label, w.osis_code
  from scope s
  join reference_units start_unit on start_unit.id = s.start_unit_id
  join reference_units end_unit on end_unit.id = s.end_unit_id
  join reference_units ru
    on ru.reference_system_id = s.reference_system_id
   and ru.kind = 'verse'
   and ru.ordinal between start_unit.ordinal and end_unit.ordinal
  join scripture_works w on w.id = ru.work_id
),
context_rows as (
  select cs.kind,
         coalesce(
           (select csl.text from context_section_localizations csl
             where csl.revision_id = pcr.id and csl.kind = cs.kind
               and csl.locale = p_locale and csl.review_state = 'published'),
           case when p_locale = 'en' then cs.text else null end
         ) as text,
         cs.claim_ids
  from pub_context_revisions pcr
  join context_sections cs on cs.revision_id = pcr.id
  where pcr.scope_id = (select id from scope)
)
select jsonb_build_object(
  'scope_key', p_scope_key,
  'locale', p_locale,
  'contexts', coalesce((
    select jsonb_agg(jsonb_build_object(
      'kind', cr.kind,
      'text', cr.text,
      'claim_keys', coalesce((
        select jsonb_agg(cl.key order by cl.key)
        from claims cl
        where cl.id = any(cr.claim_ids)
      ), '[]'::jsonb)
    ) order by cr.kind)
    from context_rows cr
    where cr.text is not null
  ), '[]'::jsonb),
  'entities', coalesce((
    select jsonb_agg(jsonb_build_object(
      'entity_key', se.key,
      'slug', se.slug,
      'type', se.type,
      'identification_status', se.identification_status,
      'names', coalesce((
        select jsonb_agg(jsonb_build_object(
          'language_tag', n.language_tag,
          'form', n.form,
          'normalized_form', n.normalized_form,
          'kind', n.kind
        ) order by n.language_tag, n.normalized_form, n.kind)
        from entity_names n
        where n.entity_id = se.id and n.language_tag = p_locale
          and private_staging.package_is_published(n.origin_package_id)
      ), '[]'::jsonb),
      'descriptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'locale', d.locale,
          'revision', d.revision,
          'short_desc', d.short_desc,
          'extended_desc', d.extended_desc
        ) order by d.locale, d.revision)
        from entity_descriptions d
        where d.entity_id = se.id and d.locale = p_locale and d.review_state = 'published'
          and private_staging.package_is_published(d.origin_package_id)
      ), '[]'::jsonb)
    ) order by se.key)
    from scope_entities se
  ), '[]'::jsonb),
  'claims', coalesce((
    select jsonb_agg(jsonb_build_object(
      'claim_key', pc.key,
      'subject', jsonb_build_object(
        'type', pc.subject_type,
        'key', coalesce(
          (select e.key from entities e where e.id = pc.subject_id),
          (select sc2.key from scripture_scopes sc2 where sc2.id = pc.subject_id)
        )
      ),
      'predicate', pc.predicate,
      'object', pc.object,
      'evidence_status', pc.evidence_status,
      'textual_basis', pc.textual_basis,
      'citations', coalesce((
        select jsonb_agg(jsonb_build_object(
          'locator', cc.locator,
          'support_kind', cc.support_kind,
          'digest', cc.digest,
          'edition_key', (select ed.key from translation_editions ed where ed.id = cc.source_edition_id)
        ) order by cc.locator, cc.support_kind)
        from claim_citations cc where cc.claim_id = pc.id
      ), '[]'::jsonb)
    ) order by pc.key)
    from pub_claims pc
    where pc.id in (
      select unnest(cs.claim_ids)
      from pub_context_revisions pcr
      join context_sections cs on cs.revision_id = pcr.id
      where pcr.scope_id = (select id from scope)
      union
      select id from claims c2
      where c2.subject_type = 'scope' and c2.subject_id = (select id from scope)
    )
  ), '[]'::jsonb),
  'mentions', coalesce((
    select jsonb_agg(jsonb_build_object(
      'book_osis', su.osis_code,
      'chapter', v.chapter,
      'verse', v.verse_number,
      'local_key', su.local_key,
      'entity_key', se.key,
      'form', em.form,
      'quote', em.quote,
      'occurrence_ordinal', em.occurrence_ordinal,
      'start_utf16', rs.start_utf16,
      'end_utf16', rs.end_utf16,
      'edition_key', ed.key
    ) order by su.osis_code, v.chapter, v.verse_number, se.key, em.occurrence_ordinal)
    from edition_mentions em
    join translation_editions ed on ed.id = em.edition_id
    join translation_edition_verses v on v.id = em.verse_id
    join scope_units su on su.unit_id = v.reference_unit_id
    join pub_entities se on se.id = em.entity_id
    join edition_render_spans rs on rs.mention_id = em.id
    where ed.status = 'published'
      and ed.language_tag = p_locale
      and (p_edition_key is null or ed.key = p_edition_key)
      and em.review_state = 'published'
      and private_staging.package_is_published(em.origin_package_id)
  ), '[]'::jsonb),
  'relevance', coalesce((
    select jsonb_agg(jsonb_build_object(
      'scope_key', p_scope_key,
      'entity_key', se.key,
      'role_in_passage', r.role_in_passage,
      'importance', r.importance,
      'is_attested', r.is_attested
    ) order by se.key)
    from scope_entity_relevance r
    join scope s on s.id = r.scope_id
    join pub_entities se on se.id = r.entity_id
    where private_staging.package_is_published(r.origin_package_id)
  ), '[]'::jsonb),
  'relationships', coalesce((
    select jsonb_agg(jsonb_build_object(
      'subject_entity_key', su1.key,
      'predicate', ra.predicate,
      'object_entity_key', su2.key,
      'scope_key', coalesce((select sc2.key from scripture_scopes sc2 where sc2.id = ra.scope_id), p_scope_key),
      'certainty', ra.certainty
    ) order by su1.key, ra.predicate, su2.key)
    from entity_relationship_assertions ra
    join pub_entities su1 on su1.id = ra.subject_entity_id
    join pub_entities su2 on su2.id = ra.object_entity_id
    where (su1.id in (select id from scope_entities)
       or su2.id in (select id from scope_entities))
      and private_staging.package_is_published(ra.origin_package_id)
  ), '[]'::jsonb),
  'events', coalesce((
    select jsonb_agg(jsonb_build_object(
      'event_entity_key', ev.key,
      'event_kind', e.event_kind,
      'participants', coalesce((
        select jsonb_agg(jsonb_build_object('entity_key', pe.key, 'role', ep.role) order by pe.key, ep.role)
        from event_participants ep
        join pub_entities pe on pe.id = ep.entity_id
        where ep.event_id = e.entity_id
          and private_staging.package_is_published(ep.origin_package_id)
      ), '[]'::jsonb),
      'places', coalesce((
        select jsonb_agg(jsonb_build_object('entity_key', pl.key, 'role', epl.role) order by pl.key, epl.role)
        from event_places epl
        join pub_entities pl on pl.id = epl.place_id
        where epl.event_id = e.entity_id
          and private_staging.package_is_published(epl.origin_package_id)
      ), '[]'::jsonb)
    ) order by ev.key)
    from events e
    join pub_entities ev on ev.id = e.entity_id
    where private_staging.package_is_published(e.origin_package_id)
      and exists (
        select 1 from event_scripture_accounts esa join scope s on s.id = esa.scope_id
        where esa.event_id = e.entity_id
      )
  ), '[]'::jsonb)
);
$$;

grant execute on function public_content.published_context_bundle(text, text, text) to anon, authenticated;
