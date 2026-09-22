-- Test: membership backfill executes the real migration and covers every row
-- type (blockers 1 and 4).
--
-- Seeds a published package whose rows carry origin_package_id but have NO
-- package_row_memberships (the pre-migration-22 state), asserts the public API
-- shows nothing, then loads and runs supabase/migrations/
-- 20260916000023_membership_backfill.sql inside this transaction and asserts a
-- membership exists for each of the 11 supported row kinds and that published
-- content is visible again. Single transaction, rolls back.
--
-- (The importer revision bump 6 -> 7, which repopulates memberships from the
-- exact curated keys, is exercised by tools/verify-english-canon.sh running the
-- importer before these tests.)

begin;

DO $$
DECLARE
  canon_id uuid; work_id uuid; refsys_id uuid; unit_id uuid; scope_id uuid;
  twork_id uuid; ed_id uuid; verse_id uuid; appr uuid; pkg uuid;
  e_id uuid; ev_id uuid; pl_id uuid;
BEGIN
  INSERT INTO private_staging.canons (key, name) VALUES ('canon:prot-66','Protestant 66')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO canon_id;
  INSERT INTO private_staging.scripture_works (key, osis_code, name, testament)
    VALUES ('work:Neh:prot-66','Neh','Nehemiah','OT')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO work_id;
  INSERT INTO private_staging.reference_systems (key, canon_id, version, status)
    VALUES ('refsys:eng-v22', canon_id, 22, 'active')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO refsys_id;
  INSERT INTO private_staging.reference_units
    (reference_system_id, local_key, work_id, chapter_label, verse_label, kind, ordinal)
    VALUES (refsys_id, 'Neh.2.4', work_id, '2', '4', 'verse', 9704)
    ON CONFLICT (reference_system_id, local_key) DO UPDATE SET local_key=EXCLUDED.local_key
    RETURNING id INTO unit_id;
  INSERT INTO private_staging.scripture_scopes
    (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty)
    VALUES ('scope:probe-bf:refsys:eng-v22:Neh.2.4', refsys_id, 'chapter', unit_id, unit_id, 'probe', 'established')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO scope_id;
  INSERT INTO private_staging.translation_works (key, language_tag, name, publisher)
    VALUES ('trans:bsb','en','BSB','probe') ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO twork_id;
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
    VALUES (twork_id, 'edition:bsb@20260912:sha-ffffffff', 'en', refsys_id, '2026-09-12',
      'sha256:' || repeat('f', 64), 'probe', 'published')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO ed_id;
  INSERT INTO private_staging.translation_edition_verses
    (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256)
    VALUES (ed_id, unit_id, work_id, 2, 4, 'O LORD, let Your ear be attentive.', 'sha256:' || repeat('e', 64))
    ON CONFLICT (edition_id, reference_unit_id) DO UPDATE SET text=EXCLUDED.text RETURNING id INTO verse_id;

  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-bf','probe-bf','person','established','probe')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO e_id;
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-bf-event','probe-bf-event','event','established','probe')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO ev_id;
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-bf-place','probe-bf-place','place','established','probe')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO pl_id;

  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
    VALUES ('en.bsb.all@6:sha-0d0d0d0d', 'sha256:' || repeat('6', 64), 6, 'probe', 'editorial_reviewer', 'approved')
    RETURNING id INTO appr;
  INSERT INTO private_staging.package_manifests
    (key, locale, translation_edition_id, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.all@6:sha-0d0d0d0d', 'en', ed_id, '2.0.0', 6, 'sha256:' || repeat('6', 64), '0.0.0', appr, now() - interval '1 day', 'cleared')
    RETURNING id INTO pkg;
  INSERT INTO private_staging.publication_releases (locale, package_id, is_active) VALUES ('en', pkg, true);
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg, e_id), (pkg, ev_id), (pkg, pl_id);

  -- Rows with origin but (deliberately) no membership, one per supported kind.
  INSERT INTO private_staging.entity_names (entity_id, language_tag, form, normalized_form, kind, origin_package_id)
    VALUES (e_id, 'en', 'Probe Bf', 'probe bf', 'preferred', pkg);
  INSERT INTO private_staging.entity_descriptions (entity_id, locale, revision, short_desc, extended_desc, source_locale, review_state, origin_package_id)
    VALUES (e_id, 'en', 1, 'Probe.', NULL, 'en', 'draft', pkg);
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id)
    VALUES (e_id, scope_id, unit_id, 'participant', 'explicit', NULL, 'published', pkg);
  INSERT INTO private_staging.edition_mentions
    (edition_id, verse_id, entity_id, form, quote, occurrence_ordinal, pipeline_text_sha256, review_state, origin_package_id)
    VALUES (ed_id, verse_id, e_id, 'explicit_name', 'LORD', 1, 'sha256:' || repeat('e', 64), 'published', pkg);
  INSERT INTO private_staging.scope_entity_relevance
    (scope_id, entity_id, role_in_passage, importance, is_attested, origin_package_id)
    VALUES (scope_id, e_id, 'probe', 'central', true, pkg);
  INSERT INTO private_staging.relationship_predicates (key, inverse, is_symmetric)
    VALUES ('probe_rel', NULL, false) ON CONFLICT (key) DO NOTHING;
  INSERT INTO private_staging.entity_relationship_assertions
    (subject_entity_id, predicate, object_entity_id, scope_id, certainty, origin_package_id)
    VALUES (e_id, 'probe_rel', pl_id, scope_id, 'established', pkg);
  INSERT INTO private_staging.events (entity_id, event_kind, origin_package_id)
    VALUES (ev_id, 'probe-kind', pkg);
  INSERT INTO private_staging.event_participants (event_id, entity_id, role, origin_package_id)
    VALUES (ev_id, e_id, 'participant', pkg);
  INSERT INTO private_staging.event_places (event_id, place_id, origin_package_id)
    VALUES (ev_id, pl_id, pkg);
  INSERT INTO private_staging.event_scripture_accounts (event_id, scope_id, relation, origin_package_id)
    VALUES (ev_id, scope_id, 'reports', pkg);
  INSERT INTO private_staging.place_geometries (entity_id, crs, precision, component_license, origin_package_id)
    VALUES (pl_id, 'unknown', 'unknown', 'unknown', pkg);
END $$;

-- Pre-backfill: the published attestation is invisible (memberships empty).
SET ROLE anon;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_attestations WHERE entity_key = 'entity:probe-bf';
  IF n <> 0 THEN RAISE EXCEPTION 'FAIL: attestation visible before backfill (% rows)', n; END IF;
END $$;
RESET ROLE;

-- Run the actual backfill migration inside this transaction.
\i supabase/migrations/20260916000023_membership_backfill.sql

-- Post-backfill: a membership exists for every supported row kind.
DO $$
DECLARE
  pkg uuid;
  bad text[] := ARRAY[]::text[];
  n integer;
BEGIN
  SELECT id INTO pkg FROM private_staging.package_manifests WHERE key = 'en.bsb.all@6:sha-0d0d0d0d';

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.entity_names x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'entity_name'
      AND x.entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf');
  IF n < 1 THEN bad := bad || 'entity_name'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.entity_descriptions x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'entity_description'
      AND x.entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf');
  IF n < 1 THEN bad := bad || 'entity_description'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.reference_entity_attestations x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'reference_entity_attestation'
      AND x.entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf');
  IF n < 1 THEN bad := bad || 'reference_entity_attestation'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.edition_mentions x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'edition_mention'
      AND x.entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf');
  IF n < 1 THEN bad := bad || 'edition_mention'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.scope_entity_relevance x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'scope_entity_relevance'
      AND x.entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf');
  IF n < 1 THEN bad := bad || 'scope_entity_relevance'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.entity_relationship_assertions x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'entity_relationship_assertion'
      AND x.subject_entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf');
  IF n < 1 THEN bad := bad || 'entity_relationship_assertion'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.events x ON x.entity_id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'event'
      AND x.entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf-event');
  IF n < 1 THEN bad := bad || 'event'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.event_participants x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'event_participant'
      AND x.event_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf-event');
  IF n < 1 THEN bad := bad || 'event_participant'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.event_places x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'event_place'
      AND x.event_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf-event');
  IF n < 1 THEN bad := bad || 'event_place'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.event_scripture_accounts x ON x.id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'event_scripture_account'
      AND x.event_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf-event');
  IF n < 1 THEN bad := bad || 'event_scripture_account'; END IF;

  SELECT count(*) INTO n FROM private_staging.package_row_memberships m
    JOIN private_staging.place_geometries x ON x.entity_id = m.row_id
    WHERE m.package_id = pkg AND m.row_kind = 'place_geometry'
      AND x.entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-bf-place');
  IF n < 1 THEN bad := bad || 'place_geometry'; END IF;

  IF array_length(bad, 1) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: backfill missing memberships for: %', array_to_string(bad, ', ');
  END IF;
END $$;

-- Published attestation is visible again.
SET ROLE anon;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_attestations WHERE entity_key = 'entity:probe-bf';
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: attestation still invisible after backfill (% rows)', n; END IF;
END $$;
RESET ROLE;

rollback;
