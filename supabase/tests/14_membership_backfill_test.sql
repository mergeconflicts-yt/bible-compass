-- Test: membership backfill for upgraded databases (blocker 1).
-- Simulates a database whose rows predate migration 22: a published package
-- with owned rows (origin_package_id set) but an EMPTY package_row_memberships
-- table. The public API (which now reads memberships) shows nothing until the
-- migration-22 backfill runs; after the backfill the published content is
-- visible again. Single transaction, rolls back.
--
-- The second half of blocker 1 (IMPORT_REVISION 6 -> 7 so an existing
-- installation re-runs the upgraded importer) is exercised by
-- tools/verify-english-canon.sh, which runs the importer before this test.

begin;

-- Pre-migration state: published package + owned rows, no memberships.
DO $$
DECLARE
  canon_id uuid; work_id uuid; refsys_id uuid; unit_id uuid; scope_id uuid;
  twork_id uuid; ed_id uuid; appr uuid; pkg uuid; ent_id uuid; att_id uuid;
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
    VALUES (refsys_id, 'Neh.2.4', work_id, '2', '4', 'verse', 9504)
    ON CONFLICT (reference_system_id, local_key) DO UPDATE SET local_key=EXCLUDED.local_key
    RETURNING id INTO unit_id;
  INSERT INTO private_staging.scripture_scopes
    (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty)
    VALUES ('scope:probe-backfill:refsys:eng-v22:Neh.2.4', refsys_id, 'chapter', unit_id, unit_id, 'probe', 'established')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO scope_id;
  INSERT INTO private_staging.translation_works (key, language_tag, name, publisher)
    VALUES ('trans:bsb','en','BSB','probe') ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO twork_id;
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
    VALUES (twork_id, 'edition:bsb@20260912:sha-ffffffff', 'en', refsys_id, '2026-09-12',
      'sha256:' || repeat('f', 64), 'probe', 'published')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO ed_id;

  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-backfill','probe-backfill','person','established','probe')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO ent_id;
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state, origin_package_id)
    VALUES (ent_id, scope_id, unit_id, 'participant', 'explicit', NULL, 'published', NULL)
    RETURNING id INTO att_id;

  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
    VALUES ('en.bsb.all@6:sha-0c0c0c0c', 'sha256:' || repeat('6', 64), 6, 'probe', 'editorial_reviewer', 'approved')
    RETURNING id INTO appr;
  INSERT INTO private_staging.package_manifests
    (key, locale, translation_edition_id, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.all@6:sha-0c0c0c0c', 'en', ed_id, '2.0.0', 6, 'sha256:' || repeat('6', 64), '0.0.0', appr, now() - interval '1 day', 'cleared')
    RETURNING id INTO pkg;
  INSERT INTO private_staging.publication_releases (locale, package_id, is_active) VALUES ('en', pkg, true);
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg, ent_id);

  -- The row predates membership: it is owned (origin) but has no membership.
  UPDATE private_staging.reference_entity_attestations SET origin_package_id = pkg WHERE id = att_id;
  DELETE FROM private_staging.package_row_memberships
    WHERE row_kind = 'reference_entity_attestation' AND row_id = att_id;
END $$;

-- Before the backfill: the published attestation is invisible (membership empty).
SET ROLE anon;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_attestations
    WHERE entity_key = 'entity:probe-backfill';
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: attestation visible before membership backfill (% rows)', n;
  END IF;
END $$;
RESET ROLE;

-- Apply the migration-22 backfill for the attestation, then visibility returns.
DO $$
BEGIN
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id)
  SELECT origin_package_id, 'reference_entity_attestation', id
  FROM private_staging.reference_entity_attestations
  WHERE origin_package_id IS NOT NULL AND entity_id = (SELECT id FROM private_staging.entities WHERE key='entity:probe-backfill')
  ON CONFLICT DO NOTHING;
END $$;

SET ROLE anon;
DO $$
DECLARE n integer;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_attestations
    WHERE entity_key = 'entity:probe-backfill';
  IF n <> 1 THEN
    RAISE EXCEPTION 'FAIL: attestation still invisible after backfill (% rows)', n;
  END IF;
END $$;
RESET ROLE;

rollback;
