-- Test: published read API exposes stable client keys, published rows only.
-- Task EN-04. Runs after test 04 (which seeds published/draft packages) but is
-- self-contained: it seeds its own published and draft rows with conflict-safe
-- keys. Single transaction, rolls back.

begin;

-- 1. Seed a published package with one entity + one claim + one published and
-- one draft attestation, and a published edition with one verse.
DO $$
DECLARE
  canon_id uuid;
  work_id uuid;
  refsys_id uuid;
  unit_id uuid;
  twork_id uuid;
  pub_ed uuid;
  ent_id uuid;
  scope_id uuid;
  pub_claim uuid;
  draft_claim uuid;
  appr uuid;
  pkg_id uuid;
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
    VALUES (refsys_id, 'Neh.2.4', work_id, '2', '4', 'verse', 3004)
    ON CONFLICT (reference_system_id, local_key) DO UPDATE SET local_key = EXCLUDED.local_key
    RETURNING id INTO unit_id;
  INSERT INTO private_staging.translation_works (key, language_tag, name, publisher)
    VALUES ('trans:bsb', 'en', 'BSB', 'test')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO twork_id;
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
    VALUES (twork_id, 'edition:bsb@20260912:sha-aaaaaaaa', 'en', refsys_id, '2026-09-12',
      'sha256:' || repeat('a', 64), 'test', 'published')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO pub_ed;
  INSERT INTO private_staging.translation_edition_verses
    (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256)
    VALUES (pub_ed, unit_id, work_id, 2, 4, 'O LORD, let Your ear be attentive.', 'sha256:' || repeat('f', 64));

  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-read-api', 'probe-read-api', 'person', 'established', 'probe')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO ent_id;

  INSERT INTO private_staging.scripture_scopes
    (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty)
    VALUES ('scope:probe-read-api:refsys:eng-v22:Neh.2.4', refsys_id, 'chapter', unit_id, unit_id, 'probe', 'established')
    ON CONFLICT (key) DO UPDATE SET key = EXCLUDED.key RETURNING id INTO scope_id;

  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
    VALUES ('claim:probe-read-api-pub', 'entity', ent_id, 'probe', 'text', '"x"', 'established', 'explicit', 'published')
    RETURNING id INTO pub_claim;
  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
    VALUES ('claim:probe-read-api-draft', 'entity', ent_id, 'probe', 'text', '"x"', 'established', 'explicit', 'draft')
    RETURNING id INTO draft_claim;

  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state)
    VALUES (ent_id, scope_id, unit_id, 'participant', 'explicit', pub_claim, 'published');
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state)
    VALUES (ent_id, scope_id, unit_id, 'topic', 'explicit', draft_claim, 'draft');

  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
    VALUES ('en.bsb.neh-2@9:sha-99887766', 'sha256:' || repeat('f', 64), 9, 'probe', 'editorial_reviewer', 'approved')
    RETURNING id INTO appr;
  INSERT INTO private_staging.package_manifests
    (key, locale, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.neh-2@9:sha-99887766', 'en', '1.0.0', 9, 'sha256:' || repeat('f', 64), '1.0.0', appr, now() - interval '1 day', 'cleared')
    RETURNING id INTO pkg_id;
  INSERT INTO private_staging.publication_releases (locale, package_id, is_active) VALUES ('en', pkg_id, true);
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg_id, ent_id);
  INSERT INTO private_staging.package_members (package_id, claim_id) VALUES (pkg_id, pub_claim);
END $$;

-- 2. Anonymous reads published verses with stable client keys.
SET ROLE anon;
DO $$
DECLARE
  r record;
BEGIN
  SELECT edition_key, refsys_key, book_osis, chapter, verse_number, local_key, text
    INTO r
  FROM public_content.published_verses
  WHERE book_osis = 'Neh' AND chapter = 2 AND verse_number = 4;
  IF r.edition_key IS NULL OR r.refsys_key <> 'refsys:eng-v22' OR r.local_key IS NULL THEN
    RAISE EXCEPTION 'FAIL: published_verses did not expose stable keys: %', r;
  END IF;
  IF r.text <> 'O LORD, let Your ear be attentive.' THEN
    RAISE EXCEPTION 'FAIL: published_verses text mismatch';
  END IF;
END $$;

-- 3. Anonymous sees only the published attestation, with stable keys.
DO $$
DECLARE
  n integer;
  skey text;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_attestations;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: anon saw % attestations, expected 1', n; END IF;
  SELECT pa.scope_key INTO skey FROM public_content.published_attestations pa;
  IF skey <> 'scope:probe-read-api:refsys:eng-v22:Neh.2.4' THEN
    RAISE EXCEPTION 'FAIL: attestation scope key not exposed: %', skey;
  END IF;
END $$;
RESET ROLE;

-- 4. Draft content stays invisible and the views remain RLS-filtered.
DO $$
BEGIN
  -- Authenticated sees the same published-only rows.
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_verses;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: authenticated saw % published verses, expected 1', n; END IF;
  SELECT count(*) INTO n FROM public_content.published_attestations;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: authenticated saw % attestations, expected 1', n; END IF;
END $$;
RESET ROLE;

rollback;
