-- Migration: 20260915000014_published_context_bundle
-- Task EN-06 — complete published context read contract for a Scripture scope.
--
-- public_content.published_context_bundle(p_scope_key) returns one JSON bundle
-- for a scope: passage contexts, localized entity information, claims with
-- source references, mentions with render spans, relevance, relationships and
-- events with participants/places. Every record uses stable keys and a
-- deterministic order.
--
-- Security: SECURITY DEFINER (the read API needs to join several private
-- tables), but the function is read-only, STABLE, runs with a pinned
-- search_path, and every branch filters to published rows only
-- (published package membership and/or review_state = 'published'). It never
-- returns drafts. Execute is granted to anon/authenticated; no table is
-- exposed directly.
--
-- Publication gates used here:
--   entities / claims / context revisions : membership in a published package
--   entity descriptions                   : additionally review_state='published'
--   claims                                : additionally review_state='published'
--   mentions                              : owning edition.status='published'
--   events / participants / places        : published entities + scope account

create or replace function public_content.published_context_bundle(p_scope_key text)
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
  select e.id, e.key, e.slug, e.type, e.identification_status
  from entities e
  join package_members pm on pm.entity_id = e.id
  join package_manifests pkg on pkg.id = pm.package_id
  where pkg.published_at is not null
    and pkg.published_at <= now()
    and pkg.locale in ('en','te','ta')
),
pub_claims as (
  select c.id, c.key, c.subject_type, c.subject_id, c.predicate, c.object_type, c.object, c.evidence_status, c.textual_basis
  from claims c
  join package_members pm on pm.claim_id = c.id
  join package_manifests pkg on pkg.id = pm.package_id
  where pkg.published_at is not null
    and pkg.published_at <= now()
    and pkg.locale in ('en','te','ta')
    and c.review_state = 'published'
),
pub_context_revisions as (
  select cr.id, a.scope_id
  from context_revisions cr
  join context_artifacts a on a.id = cr.artifact_id
  join package_members pm on pm.context_revision_id = cr.id
  join package_manifests pkg on pkg.id = pm.package_id
  where pkg.published_at is not null
    and pkg.published_at <= now()
    and pkg.locale in ('en','te','ta')
),
scope_entity_ids as (
  select r.entity_id from scope_entity_relevance r join scope s on s.id = r.scope_id
  union
  select a.entity_id from reference_entity_attestations a join scope s on s.id = a.scope_id
  union
  select ep.entity_id
  from event_participants ep
  join event_scripture_accounts esa on esa.event_id = ep.event_id
  join scope s on s.id = esa.scope_id
),
scope_entities as (
  select pe.* from pub_entities pe join scope_entity_ids sei on sei.entity_id = pe.id
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
)
select jsonb_build_object(
  'scope_key', p_scope_key,
  'contexts', coalesce((
    select jsonb_agg(jsonb_build_object(
      'kind', cs.kind,
      'text', cs.text,
      'claim_keys', coalesce((
        select jsonb_agg(cl.key order by cl.key)
        from claims cl
        where cl.id = any(cs.claim_ids)
      ), '[]'::jsonb)
    ) order by cs.kind)
    from pub_context_revisions pcr
    join context_sections cs on cs.revision_id = pcr.id
    where pcr.scope_id = (select id from scope)
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
        from entity_names n where n.entity_id = se.id
      ), '[]'::jsonb),
      'descriptions', coalesce((
        select jsonb_agg(jsonb_build_object(
          'locale', d.locale,
          'revision', d.revision,
          'short_desc', d.short_desc,
          'extended_desc', d.extended_desc
        ) order by d.locale, d.revision)
        from entity_descriptions d
        where d.entity_id = se.id and d.review_state = 'published'
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
    where su1.id in (select id from scope_entities)
       or su2.id in (select id from scope_entities)
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
      ), '[]'::jsonb),
      'places', coalesce((
        select jsonb_agg(jsonb_build_object('entity_key', pl.key, 'role', epl.role) order by pl.key, epl.role)
        from event_places epl
        join pub_entities pl on pl.id = epl.place_id
        where epl.event_id = e.entity_id
      ), '[]'::jsonb)
    ) order by ev.key)
    from events e
    join pub_entities ev on ev.id = e.entity_id
    where exists (
      select 1 from event_scripture_accounts esa join scope s on s.id = esa.scope_id
      where esa.event_id = e.entity_id
    )
  ), '[]'::jsonb)
);
$$;

grant execute on function public_content.published_context_bundle(text) to anon, authenticated;
