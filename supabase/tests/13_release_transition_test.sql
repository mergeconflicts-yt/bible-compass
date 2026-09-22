-- Test: end-to-end release transition (remaining blocker R3).
-- Simulates: import revision N, publish N, verify; import revision N+1 with
-- UNCHANGED plus CHANGED content, activate N+1; verify unchanged content is
-- still visible and changed context shows the new text. Single transaction,
-- rolls back.
--
-- This exercises the many-to-many membership model (R1): unchanged rows are
-- members of BOTH revisions, so activating the new release does not lose them.

begin;

-- --- Revision N: content, membership, publication ------------------------
DO $$
DECLARE
  canon_id uuid; work_id uuid; refsys_id uuid; unit_id uuid; scope_id uuid;
  twork_id uuid; ed_id uuid; verse_id uuid;
  appr_n uuid; pkg_n uuid;
  ent_id uuid; att_id uuid; art_id uuid; rev1 uuid;
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
    VALUES (refsys_id, 'Neh.2.4', work_id, '2', '4', 'verse', 9004)
    ON CONFLICT (reference_system_id, local_key) DO UPDATE SET local_key=EXCLUDED.local_key
    RETURNING id INTO unit_id;
  INSERT INTO private_staging.scripture_scopes
    (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty)
    VALUES ('scope:probe-rel:refsys:eng-v22:Neh.2.4', refsys_id, 'chapter', unit_id, unit_id, 'probe', 'established')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO scope_id;

  INSERT INTO private_staging.translation_works (key, language_tag, name, publisher)
    VALUES ('trans:bsb','en','BSB','probe') ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO twork_id;
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
    VALUES (twork_id, 'edition:bsb@20260912:sha-eeeeeeee', 'en', refsys_id, '2026-09-12',
      'sha256:' || repeat('e', 64), 'probe', 'published')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO ed_id;
  INSERT INTO private_staging.translation_edition_verses
    (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256)
    VALUES (ed_id, unit_id, work_id, 2, 4, 'O LORD, let Your ear be attentive.', 'sha256:' || repeat('e', 64))
    ON CONFLICT (edition_id, reference_unit_id) DO UPDATE SET text=EXCLUDED.text RETURNING id INTO verse_id;

  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
    VALUES ('entity:probe-rel','probe-rel','person','established','probe')
    ON CONFLICT (key) DO UPDATE SET key=EXCLUDED.key RETURNING id INTO ent_id;
  INSERT INTO private_staging.entity_names (entity_id, language_tag, form, normalized_form, kind)
    VALUES (ent_id, 'en', 'Probe Rel', 'probe rel', 'preferred') ON CONFLICT DO NOTHING;

  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state)
    VALUES (ent_id, scope_id, unit_id, 'participant', 'explicit', NULL, 'published')
    RETURNING id INTO att_id;

  -- Context revision 1 (v1 text).
  INSERT INTO private_staging.context_artifacts (scope_id) VALUES (scope_id)
    ON CONFLICT (scope_id) DO UPDATE SET scope_id=EXCLUDED.scope_id RETURNING id INTO art_id;
  INSERT INTO private_staging.context_revisions (artifact_id, revision) VALUES (art_id, 1)
    ON CONFLICT (artifact_id, revision) DO UPDATE SET revision=EXCLUDED.revision RETURNING id INTO rev1;
  INSERT INTO private_staging.context_sections (revision_id, kind, text, claim_ids)
    VALUES (rev1, 'who', 'Revision N context.', ARRAY[]::uuid[]);

  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
    VALUES ('en.bsb.all@101:sha-0a0a0a0a', 'sha256:' || repeat('1', 64), 101, 'probe', 'editorial_reviewer', 'approved')
    RETURNING id INTO appr_n;
  INSERT INTO private_staging.package_manifests
    (key, locale, translation_edition_id, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.all@101:sha-0a0a0a0a', 'en', ed_id, '2.0.0', 101, 'sha256:' || repeat('1', 64), '0.0.0', appr_n, now() - interval '1 day', 'cleared')
    RETURNING id INTO pkg_n;
  INSERT INTO private_staging.publication_releases (locale, package_id, is_active) VALUES ('en', pkg_n, true);

  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg_n, ent_id);
  INSERT INTO private_staging.package_members (package_id, context_revision_id) VALUES (pkg_n, rev1);
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id) VALUES
    (pkg_n, 'reference_entity_attestation', att_id),
    (pkg_n, 'entity_name', (SELECT id FROM private_staging.entity_names WHERE entity_id=ent_id AND normalized_form='probe rel'));
END $$;

-- Revision N is live: attestation and v1 context visible.
SET ROLE anon;
DO $$
DECLARE n integer; t text;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_attestations;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: rev N attestation visible = %', n; END IF;
  SELECT b->'contexts'->0->>'text' INTO t
    FROM public_content.published_context_bundle('scope:probe-rel:refsys:eng-v22:Neh.2.4') b;
  IF t IS DISTINCT FROM 'Revision N context.' THEN RAISE EXCEPTION 'FAIL: rev N context = %', COALESCE(t,'NULL'); END IF;
END $$;
RESET ROLE;

-- --- Revision N+1: unchanged rows re-registered, context changed, activate --
DO $$
DECLARE
  pkg_n uuid; pkg_next uuid; appr uuid;
  ent_id uuid; att_id uuid; art_id uuid; rev2 uuid; name_id uuid;
BEGIN
  SELECT id INTO pkg_n FROM private_staging.package_manifests WHERE key='en.bsb.all@101:sha-0a0a0a0a';
  SELECT id INTO ent_id FROM private_staging.entities WHERE key='entity:probe-rel';
  SELECT id INTO att_id FROM private_staging.reference_entity_attestations WHERE entity_id=ent_id;
  SELECT id INTO art_id FROM private_staging.context_artifacts WHERE scope_id=(SELECT id FROM private_staging.scripture_scopes WHERE key='scope:probe-rel:refsys:eng-v22:Neh.2.4');
  SELECT id INTO name_id FROM private_staging.entity_names WHERE entity_id=ent_id AND normalized_form='probe rel';

  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
    VALUES ('en.bsb.all@102:sha-0b0b0b0b', 'sha256:' || repeat('2', 64), 102, 'probe', 'editorial_reviewer', 'approved')
    RETURNING id INTO appr;
  INSERT INTO private_staging.package_manifests
    (key, locale, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at, rights_status)
    VALUES ('en.bsb.all@102:sha-0b0b0b0b', 'en', '2.0.0', 102, 'sha256:' || repeat('2', 64), '0.0.0', appr, now() - interval '1 hour', 'cleared')
    RETURNING id INTO pkg_next;

  -- Unchanged rows become members of the new revision too (many-to-many).
  INSERT INTO private_staging.package_members (package_id, entity_id) VALUES (pkg_next, ent_id);
  INSERT INTO private_staging.package_row_memberships (package_id, row_kind, row_id) VALUES
    (pkg_next, 'reference_entity_attestation', att_id),
    (pkg_next, 'entity_name', name_id);

  -- Changed context becomes revision 2 (not a silent reuse of revision 1).
  INSERT INTO private_staging.context_revisions (artifact_id, revision) VALUES (art_id, 2)
    ON CONFLICT (artifact_id, revision) DO UPDATE SET revision=EXCLUDED.revision RETURNING id INTO rev2;
  INSERT INTO private_staging.context_sections (revision_id, kind, text, claim_ids)
    VALUES (rev2, 'who', 'Revision N+1 context.', ARRAY[]::uuid[]);
  INSERT INTO private_staging.package_members (package_id, context_revision_id) VALUES (pkg_next, rev2);

  -- Activate N+1 and retire N (exactly one active release per locale).
  UPDATE private_staging.publication_releases SET is_active = false
    WHERE locale='en' AND package_id = pkg_n;
  INSERT INTO private_staging.publication_releases (locale, package_id, is_active) VALUES ('en', pkg_next, true);
END $$;

-- After the release transition: unchanged content still visible; changed
-- context shows the new text; the superseded context is gone.
SET ROLE anon;
DO $$
DECLARE n integer; t text;
BEGIN
  SELECT count(*) INTO n FROM public_content.published_attestations;
  IF n <> 1 THEN RAISE EXCEPTION 'FAIL: unchanged attestation lost after transition (% rows)', n; END IF;
  SELECT b->'contexts'->0->>'text' INTO t
    FROM public_content.published_context_bundle('scope:probe-rel:refsys:eng-v22:Neh.2.4') b;
  IF t IS DISTINCT FROM 'Revision N+1 context.' THEN
    RAISE EXCEPTION 'FAIL: changed context not applied after transition (got %)', COALESCE(t,'NULL');
  END IF;
END $$;
RESET ROLE;

rollback;
