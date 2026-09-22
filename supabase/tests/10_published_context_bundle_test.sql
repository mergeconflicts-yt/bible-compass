-- Test: complete published context bundle for a Scripture scope.
-- Task EN-06. Seeds synthetic published + draft fixtures, then proves anon can
-- fetch the full bundle (contexts, localized entities, claims + citations,
-- mentions + spans, relevance, relationships, events with participants/places)
-- in deterministic order, and that draft rows never appear.
-- Single transaction, rolls back.

begin;

DO $$
#variable_conflict use_column
DECLARE
  canon_id uuid;
  work_id uuid;
  refsys_id uuid;
  unit_id uuid;
  scope_id uuid;
  twork_id uuid;
  edition_id uuid;
  verse_id uuid;
  approval_id uuid;
  pkg_id uuid;
  pub_entity uuid;
  pub_entity2 uuid;
  pub_place uuid;
  draft_entity uuid;
  pub_claim uuid;
  draft_claim uuid;
  artifact_id uuid;
  revision_id uuid;
  event_entity uuid;
BEGIN
  INSERT INTO private_staging.canons (key, name) VALUES ('canon:prot-66', 'Protestant 66')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO canon_id;
  INSERT INTO private_staging.scripture_works (key, osis_code, name, testament)
    VALUES ('work:Neh:prot-66', 'Neh', 'Nehemiah', 'OT')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO work_id;
  INSERT INTO private_staging.reference_systems (key, canon_id, version, status)
    VALUES ('refsys:eng-v22', canon_id, 22, 'active')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO refsys_id;
  INSERT INTO private_staging.reference_units
    (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal)
    VALUES (refsys_id, 'Neh.2.4', work_id, '2', '4', 'verse', 4004)
    ON CONFLICT (reference_system_id, local_key) DO UPDATE SET local_key = EXCLUDED.local_key
    RETURNING id INTO unit_id;
  INSERT INTO private_staging.scripture_scopes
    (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty)
    VALUES ('scope:probe-ctx:refsys:eng-v22:Neh.2.4', refsys_id, 'chapter', unit_id, unit_id, 'probe', 'established')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO scope_id;

  -- Published entities (one draft to be denied) + a published place.
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-pub', 'probe-pub', 'person', 'established', 'probe')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO pub_entity;
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-pub-2', 'probe-pub-2', 'person', 'established', 'probe')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO pub_entity2;
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-place', 'probe-place', 'place', 'established', 'probe')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO pub_place;
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-draft', 'probe-draft', 'person', 'established', 'probe')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO draft_entity;

  INSERT INTO private_staging.entity_names (entity_id, language_tag, form, normalized_form, kind)
    VALUES (pub_entity, 'en', 'Probe Person', 'probe person', 'preferred')
    ON CONFLICT DO NOTHING;
  INSERT INTO private_staging.entity_descriptions (entity_id, locale, revision, short_desc, extended_desc, source_locale, review_state)
    VALUES (pub_entity, 'en', 1, 'Published probe description.', 'Extended probe.', 'en', 'published');
  INSERT INTO private_staging.entity_descriptions (entity_id, locale, revision, short_desc, extended_desc, source_locale, review_state)
    VALUES (pub_entity, 'en', 2, 'Draft probe description.', NULL, 'en', 'draft');

  -- Published package + membership.
  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
    VALUES ('en.bsb.neh-2@7:sha-11223344', 'sha256:' || repeat('b', 64), 7, 'probe', 'editorial_reviewer', 'approved')
    RETURNING id INTO approval_id;
  INSERT INTO private_staging.package_manifests
    (key, locale, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.neh-2@7:sha-11223344', 'en', '1.0.0', 7, 'sha256:' || repeat('b', 64), '1.0.0', approval_id, now() - interval '1 day', 'cleared')
    RETURNING id INTO pkg_id;
  INSERT INTO private_staging.publication_releases (locale, package_id, is_active) VALUES ('en', pkg_id, true);
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg_id, pub_entity);
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg_id, pub_entity2);
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg_id, pub_place);

  -- Published claim + citation; a draft claim stays hidden.
  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
    VALUES ('claim:probe-pub', 'entity', pub_entity, 'probe', 'text', '"x"', 'established', 'explicit', 'published')
    RETURNING id INTO pub_claim;
  INSERT INTO private_staging.claim_citations
    (claim_id, source_release_id, source_edition_id, locator, support_kind, digest)
    VALUES (pub_claim, gen_random_uuid(), NULL, 'Neh.2.4', 'supports', 'sha256:' || repeat('c', 64));
  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
    VALUES ('claim:probe-draft', 'entity', pub_entity, 'probe', 'text', '"x"', 'established', 'explicit', 'draft')
    RETURNING id INTO draft_claim;
  INSERT INTO private_staging.package_members (package_id, claim_id) VALUES (pkg_id, pub_claim);
  INSERT INTO private_staging.package_members (package_id, claim_id) VALUES (pkg_id, draft_claim);

  -- Published context section for the scope.
  INSERT INTO private_staging.context_artifacts (scope_id) VALUES (scope_id) RETURNING id INTO artifact_id;
  INSERT INTO private_staging.context_revisions (artifact_id, revision) VALUES (artifact_id, 1) RETURNING id INTO revision_id;
  INSERT INTO private_staging.context_sections (revision_id, kind, text, claim_ids)
    VALUES (revision_id, 'who', 'Published probe context.', ARRAY[pub_claim]);
  INSERT INTO private_staging.package_members (package_id, context_revision_id) VALUES (pkg_id, revision_id);

  -- Published edition + verse + mention + render span.
  INSERT INTO private_staging.translation_works (key, language_tag, name, publisher)
    VALUES ('trans:bsb', 'en', 'BSB', 'probe')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO twork_id;
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
    VALUES (twork_id, 'edition:bsb@20260912:sha-cccccccc', 'en', refsys_id, '2026-09-12',
      'sha256:' || repeat('d', 64), 'probe', 'published')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO edition_id;
  INSERT INTO private_staging.translation_edition_verses
    (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256)
    VALUES (edition_id, unit_id, work_id, 2, 4, 'O LORD, let Your ear be attentive.', 'sha256:' || repeat('e', 64))
    ON CONFLICT (edition_id, reference_unit_id) DO UPDATE SET text = EXCLUDED.text
    RETURNING id INTO verse_id;
  INSERT INTO private_staging.edition_mentions
    (edition_id, verse_id, entity_id, form, quote, occurrence_ordinal, pipeline_text_sha256, review_state)
    VALUES (edition_id, verse_id, pub_entity, 'explicit_name', 'LORD', 1, 'sha256:' || repeat('e', 64), 'published')
    RETURNING id INTO event_entity;  -- reuse variable for mention id
  INSERT INTO private_staging.edition_render_spans (mention_id, start_grapheme, end_grapheme, start_utf16, end_utf16)
    VALUES (event_entity, 2, 6, 2, 6);

  -- Relevance (published entity), relationship (two published entities).
  INSERT INTO private_staging.scope_entity_relevance (scope_id, entity_id, role_in_passage, importance, is_attested)
    VALUES (scope_id, pub_entity, 'Published role.', 'central', true)
    ON CONFLICT DO NOTHING;
  INSERT INTO private_staging.scope_entity_relevance (scope_id, entity_id, role_in_passage, importance, is_attested)
    VALUES (scope_id, pub_entity2, 'Second role.', 'supporting', true)
    ON CONFLICT DO NOTHING;
  INSERT INTO private_staging.relationship_predicates (key, inverse, is_symmetric)
    VALUES ('probe_rel', NULL, false) ON CONFLICT (key) DO NOTHING;
  INSERT INTO private_staging.entity_relationship_assertions
    (subject_entity_id, predicate, object_entity_id, scope_id, certainty)
    VALUES (pub_entity, 'probe_rel', pub_entity2, scope_id, 'established');

  -- Published event with participant + place + scope account.
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-event', 'probe-event', 'event', 'established', 'probe')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO event_entity;
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg_id, event_entity);
  INSERT INTO private_staging.events (entity_id, event_kind) VALUES (event_entity, 'probe-kind');
  INSERT INTO private_staging.event_participants (event_id, entity_id, role)
    VALUES (event_entity, pub_entity, 'participant');
  INSERT INTO private_staging.event_places (event_id, place_id, role)
    VALUES (event_entity, pub_place, 'location');
  INSERT INTO private_staging.event_scripture_accounts (event_id, scope_id, relation)
    VALUES (event_entity, scope_id, 'reports');

  -- Membership: the API exposes only rows that are MEMBERS of a published
  -- package, so every seeded attached row is registered with this package
  -- (many-to-many; an unchanged row can belong to several revisions).
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'entity_name', n.id FROM private_staging.entity_names n
    WHERE n.entity_id IN (SELECT id FROM private_staging.entities
      WHERE key IN ('entity:probe-pub', 'entity:probe-pub-2', 'entity:probe-place'));
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'entity_description', d.id FROM private_staging.entity_descriptions d
    WHERE d.entity_id IN (SELECT id FROM private_staging.entities
      WHERE key IN ('entity:probe-pub', 'entity:probe-pub-2', 'entity:probe-place'));
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'edition_mention', em.id FROM private_staging.edition_mentions em
    WHERE em.verse_id IN (SELECT v.id FROM private_staging.translation_edition_verses v
      JOIN private_staging.translation_editions e ON e.id = v.edition_id
      WHERE e.key = 'edition:bsb@20260912:sha-cccccccc' AND v.chapter = 2 AND v.verse_number = 4);
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'scope_entity_relevance', r.id FROM private_staging.scope_entity_relevance r
    WHERE r.scope_id IN (SELECT id FROM private_staging.scripture_scopes
      WHERE key = 'scope:probe-ctx:refsys:eng-v22:Neh.2.4');
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'entity_relationship_assertion', ra.id FROM private_staging.entity_relationship_assertions ra
    WHERE ra.scope_id IN (SELECT id FROM private_staging.scripture_scopes
      WHERE key = 'scope:probe-ctx:refsys:eng-v22:Neh.2.4');
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'event', e.entity_id FROM private_staging.events e
    WHERE e.entity_id IN (SELECT id FROM private_staging.entities WHERE key = 'entity:probe-event');
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'event_participant', ep.id FROM private_staging.event_participants ep
    WHERE ep.event_id IN (SELECT id FROM private_staging.entities WHERE key = 'entity:probe-event');
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'event_place', epl.id FROM private_staging.event_places epl
    WHERE epl.event_id IN (SELECT id FROM private_staging.entities WHERE key = 'entity:probe-event');
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
    SELECT pkg_id, 'event_scripture_account', esa.id FROM private_staging.event_scripture_accounts esa
    WHERE esa.event_id IN (SELECT id FROM private_staging.entities WHERE key = 'entity:probe-event');
END $$;

-- Anon fetches the complete bundle.
SET ROLE anon;
DO $$
DECLARE
  b jsonb;
  entity_keys text[];
  first_key text;
  last_key text;
BEGIN
  b := public_content.published_context_bundle('scope:probe-ctx:refsys:eng-v22:Neh.2.4');

  IF b->>'scope_key' <> 'scope:probe-ctx:refsys:eng-v22:Neh.2.4' THEN
    RAISE EXCEPTION 'FAIL: bundle scope_key mismatch: %', b->>'scope_key';
  END IF;

  -- contexts
  IF jsonb_array_length(b->'contexts') <> 1 THEN
    RAISE EXCEPTION 'FAIL: contexts = %', jsonb_array_length(b->'contexts');
  END IF;
  IF b->'contexts'->0->>'kind' <> 'who' OR b->'contexts'->0->>'text' <> 'Published probe context.' THEN
    RAISE EXCEPTION 'FAIL: context content wrong';
  END IF;

  -- entities: published only, draft absent, descriptions published only
  SELECT array_agg(e->>'entity_key') INTO entity_keys FROM jsonb_array_elements(b->'entities') e;
  IF 'entity:probe-draft' = ANY(entity_keys) THEN
    RAISE EXCEPTION 'FAIL: draft entity leaked into bundle';
  END IF;
  IF NOT ('entity:probe-pub' = ANY(entity_keys) AND 'entity:probe-pub-2' = ANY(entity_keys)) THEN
    RAISE EXCEPTION 'FAIL: published entities missing: %', entity_keys;
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(b->'entities') e
        WHERE e->>'entity_key' = 'entity:probe-pub' AND e->'names'->0->>'form' = 'Probe Person') <> 1 THEN
    RAISE EXCEPTION 'FAIL: localized name missing';
  END IF;
  IF (SELECT count(*) FROM jsonb_array_elements(b->'entities') e
        WHERE e->>'entity_key' = 'entity:probe-pub' AND jsonb_array_length(e->'descriptions') = 1
          AND e->'descriptions'->0->>'short_desc' = 'Published probe description.') <> 1 THEN
    RAISE EXCEPTION 'FAIL: published description missing or draft leaked';
  END IF;
  -- deterministic order: entity keys ascending
  SELECT e->>'entity_key' INTO first_key FROM jsonb_array_elements(b->'entities') e LIMIT 1;
  SELECT e->>'entity_key' INTO last_key FROM jsonb_array_elements(b->'entities') e
    ORDER BY e->>'entity_key' DESC LIMIT 1;
  IF first_key <> 'entity:probe-pub' OR last_key <> 'entity:probe-pub-2' THEN
    RAISE EXCEPTION 'FAIL: entity order not deterministic (% .. %)', first_key, last_key;
  END IF;

  -- claims: published only with citation
  IF jsonb_array_length(b->'claims') <> 1 THEN
    RAISE EXCEPTION 'FAIL: claims = % (draft claim leaked?)', jsonb_array_length(b->'claims');
  END IF;
  IF b->'claims'->0->>'claim_key' <> 'claim:probe-pub'
     OR b->'claims'->0->'citations'->0->>'locator' <> 'Neh.2.4' THEN
    RAISE EXCEPTION 'FAIL: claim or citation wrong';
  END IF;

  -- mentions with render span
  IF jsonb_array_length(b->'mentions') <> 1
     OR (b->'mentions'->0->>'entity_key') <> 'entity:probe-pub'
     OR (b->'mentions'->0->>'start_utf16')::int <> 2
     OR (b->'mentions'->0->>'end_utf16')::int <> 6 THEN
    RAISE EXCEPTION 'FAIL: mention/span wrong: %', b->'mentions';
  END IF;

  -- relevance, relationships, events
  IF jsonb_array_length(b->'relevance') <> 2 THEN
    RAISE EXCEPTION 'FAIL: relevance = %', jsonb_array_length(b->'relevance');
  END IF;
  IF jsonb_array_length(b->'relationships') <> 1
     OR b->'relationships'->0->>'predicate' <> 'probe_rel' THEN
    RAISE EXCEPTION 'FAIL: relationships wrong';
  END IF;
  IF jsonb_array_length(b->'events') <> 1
     OR b->'events'->0->>'event_kind' <> 'probe-kind'
     OR jsonb_array_length(b->'events'->0->'participants') <> 1
     OR jsonb_array_length(b->'events'->0->'places') <> 1 THEN
    RAISE EXCEPTION 'FAIL: events wrong: %', b->'events';
  END IF;
END $$;
RESET ROLE;

rollback;
