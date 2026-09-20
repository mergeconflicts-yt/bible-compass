-- Test: Review/package RLS + public views — enforceable (R1-B, Task 17C).
-- Every check is a real assertion (EXCEPTION on violation). No string PASS.
-- Run: psql "$DATABASE_URL" -f supabase/tests/04_review_package_rls_test.sql
-- Single transaction, rolls back. Requires a superuser-equivalent role for
-- SET ROLE impersonation and seeding. Supabase-gated runs:
-- docs/REGISTRY_MIGRATION_NOTES.md.

begin;

-- 1. RLS enabled on all 5 review/package tables (named, exact).
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private_staging'
    AND c.relkind = 'r'
    AND c.relname IN ('approval_records', 'package_manifests', 'package_members', 'package_dependencies', 'publication_releases')
    AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on review tables: %', missing;
  END IF;
END $$;

-- 2. No write grants to anon/authenticated/public on those 5 tables.
-- (SELECT grants from migration 05 are published-reads only.)
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.role_table_grants
  WHERE table_schema = 'private_staging'
    AND table_name IN ('approval_records', 'package_manifests', 'package_members', 'package_dependencies', 'publication_releases')
    AND grantee IN ('anon', 'authenticated', 'public')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: % write grants on review tables', n;
  END IF;
END $$;

-- 3. Approval append-only trigger exists.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname LIKE 'trg_prevent_approval_update%';
  IF n < 1 THEN
    RAISE EXCEPTION 'FAIL: approval append-only trigger missing';
  END IF;
END $$;

-- 4. All 3 public views exist.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_views
  WHERE schemaname = 'public_content'
    AND viewname IN ('published_entities', 'published_attestations', 'published_verses');
  IF n <> 3 THEN
    RAISE EXCEPTION 'FAIL: expected 3 public_content views, found %', n;
  END IF;
END $$;

-- 5. All 3 public views run with caller rights (security_invoker).
DO $$
DECLARE
  bad text;
BEGIN
  SELECT string_agg(v.viewname, ', ' ORDER BY v.viewname) INTO bad
  FROM pg_views v
  JOIN pg_class c ON c.relname = v.viewname AND c.relnamespace = 'public_content'::regnamespace
  WHERE v.schemaname = 'public_content'
    AND v.viewname IN ('published_entities', 'published_attestations', 'published_verses')
    AND (c.reloptions IS NULL OR NOT (c.reloptions::text LIKE '%security_invoker=true%'));
  IF bad IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: views without security_invoker: %', bad;
  END IF;
END $$;

-- 6. Seed one published and one draft package (superuser bypasses RLS).
DO $$
DECLARE
  appr uuid;
BEGIN
  INSERT INTO private_staging.approval_records
    (subject_key, subject_digest, subject_revision, reviewer_id, reviewer_role, decision)
  VALUES (
    'test:seed:published',
    'sha256:' || repeat('e', 64),
    1,
    'synthetic-test-seed',
    'rights_reviewer',
    'approved'
  )
  RETURNING id INTO appr;
  INSERT INTO private_staging.package_manifests
    (key, locale, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at)
  VALUES (
    'en.bsb.neh-2@1:sha-12ab34cd',
    'en',
    '1.0.0',
    1,
    'sha256:' || repeat('f', 64),
    '1.0.0',
    appr,
    now() - interval '1 day'
  );
  INSERT INTO private_staging.package_manifests
    (key, locale, schema_version, content_version, checksum, minimum_app_version, approval_id, published_at)
  VALUES (
    'en.bsb.neh-2@2:sha-56cd78ef',
    'en',
    '1.0.0',
    2,
    'sha256:' || repeat('a', 64),
    '1.0.0',
    appr,
    NULL
  );
  INSERT INTO private_staging.entities (key, slug, type, identification_status, provenance)
  VALUES ('entity:synthetic-test-seed', 'synthetic-test-seed', 'place', 'established', 'synthetic-test');
  INSERT INTO private_staging.package_members (package_id, entity_id)
  VALUES (
    (SELECT id FROM private_staging.package_manifests WHERE key = 'en.bsb.neh-2@1:sha-12ab34cd'),
    (SELECT id FROM private_staging.entities WHERE key = 'entity:synthetic-test-seed')
  );
END $$;

-- 7. Anonymous sees exactly the published entity through the view.
SET ROLE anon;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM public_content.published_entities;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: anon sees % published entities, expected 1', c;
  END IF;
END $$;
RESET ROLE;

-- 8. Authenticated sees the same published entity (no less than anon).
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM public_content.published_entities;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: authenticated sees % published entities, expected 1', c;
  END IF;
END $$;
RESET ROLE;

-- 9. Anonymous cannot read approval records at all (no grant: expects error).
SET ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.approval_records LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon could read private_staging.approval_records';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 10. Anonymous direct table read exposes only the published entity.
SET ROLE anon;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.entities;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: anon direct entity read returned % rows, expected 1 (published only)', c;
  END IF;
END $$;
RESET ROLE;

-- 11. Anonymous published_verses returns the published-edition verse only.
-- Seeds a published and a draft edition of the same verse; the draft text
-- must be invisible to anon through both the view and the base table.
DO $$
DECLARE
  canon_id uuid;
  work_id uuid;
  refsys_id uuid;
  unit_id uuid;
  twork_id uuid;
  pub_ed uuid;
  draft_ed uuid;
BEGIN
  INSERT INTO private_staging.canons (key, name)
  VALUES ('canon:prot-66', 'Protestant 66') RETURNING id INTO canon_id;
  INSERT INTO private_staging.scripture_works (key, osis_code, name, testament)
  VALUES ('work:Neh:prot-66', 'Neh', 'Nehemiah', 'OT') RETURNING id INTO work_id;
  INSERT INTO private_staging.reference_systems (key, canon_id, version, status)
  VALUES ('refsys:eng-v22', canon_id, 22, 'active') RETURNING id INTO refsys_id;
  INSERT INTO private_staging.reference_units
    (reference_system_id, local_key, work_id, chapter_label, kind, ordinal)
  VALUES (refsys_id, 'Neh.2.4', work_id, '2', 'verse', 1) RETURNING id INTO unit_id;
  INSERT INTO private_staging.translation_works (key, language_tag, name, publisher)
  VALUES ('trans:bsb', 'en', 'BSB', 'test') RETURNING id INTO twork_id;
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
  VALUES (twork_id, 'edition:bsb@20260912:sha-12ab34cd', 'en', refsys_id, '2026-09-12',
    'sha256:' || repeat('b', 64), 'test', 'published') RETURNING id INTO pub_ed;
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
  VALUES (twork_id, 'edition:bsb@20260913:sha-34cd56ef', 'en', refsys_id, '2026-09-13',
    'sha256:' || repeat('c', 64), 'test', 'draft') RETURNING id INTO draft_ed;
  INSERT INTO private_staging.translation_edition_verses
    (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256)
  VALUES (pub_ed, unit_id, work_id, 2, 4, 'published text', 'sha256:' || repeat('d', 64));
  INSERT INTO private_staging.translation_edition_verses
    (edition_id, reference_unit_id, book_id, chapter, verse_number, text, text_sha256)
  VALUES (draft_ed, unit_id, work_id, 2, 4, 'draft text', 'sha256:' || repeat('e', 64));
END $$;

SET ROLE anon;
DO $$
DECLARE
  c integer;
  t text;
BEGIN
  SELECT count(*) INTO c FROM public_content.published_verses;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: anon sees % published verses, expected 1', c;
  END IF;
  SELECT text INTO t FROM public_content.published_verses;
  IF t <> 'published text' THEN
    RAISE EXCEPTION 'FAIL: anon published_verses exposed draft text';
  END IF;
  SELECT count(*) INTO c FROM private_staging.translation_edition_verses;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: anon direct verses read returned % rows, expected 1', c;
  END IF;
END $$;
RESET ROLE;

-- 12. published_attestations requires review_state = 'published'.
-- Seeds one published and one draft attestation in the published package;
-- only the published row may be visible to anon (view and base table).
DO $$
DECLARE
  scope_id uuid;
  unit_id uuid;
  ent_id uuid;
  pkg_id uuid;
  pub_claim uuid;
  draft_claim uuid;
BEGIN
  SELECT id INTO unit_id FROM private_staging.reference_units WHERE local_key = 'Neh.2.4';
  SELECT id INTO ent_id FROM private_staging.entities WHERE key = 'entity:synthetic-test-seed';
  SELECT id INTO pkg_id FROM private_staging.package_manifests WHERE key = 'en.bsb.neh-2@1:sha-12ab34cd';
  INSERT INTO private_staging.scripture_scopes
    (key, reference_system_id, kind, start_unit_id, end_unit_id, display_name, certainty)
  VALUES ('scope:test-scope:refsys:eng-v22:Neh.2.4',
    (SELECT reference_system_id FROM private_staging.reference_units WHERE id = unit_id),
    'chapter', unit_id, unit_id, 'test', 'established') RETURNING id INTO scope_id;
  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
  VALUES ('claim:test-published', 'entity', ent_id, 'test_pred', 'text', '"x"',
    'established', 'explicit', 'approved') RETURNING id INTO pub_claim;
  INSERT INTO private_staging.claims
    (key, subject_type, subject_id, predicate, object_type, object, evidence_status, textual_basis, review_state)
  VALUES ('claim:test-draft', 'entity', ent_id, 'test_pred', 'text', '"x"',
    'established', 'explicit', 'draft') RETURNING id INTO draft_claim;
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state)
  VALUES (ent_id, scope_id, unit_id, 'participant', 'explicit', pub_claim, 'published');
  INSERT INTO private_staging.reference_entity_attestations
    (entity_id, scope_id, reference_unit_id, kind, explicitness, claim_id, review_state)
  VALUES (ent_id, scope_id, unit_id, 'topic', 'explicit', draft_claim, 'draft');
  INSERT INTO private_staging.package_members (package_id, claim_id)
  VALUES (pkg_id, pub_claim), (pkg_id, draft_claim);
END $$;

SET ROLE anon;
DO $$
DECLARE
  c integer;
  rs text;
BEGIN
  SELECT count(*) INTO c FROM public_content.published_attestations;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: anon sees % published attestations, expected 1', c;
  END IF;
  SELECT review_state INTO rs FROM public_content.published_attestations;
  IF rs <> 'published' THEN
    RAISE EXCEPTION 'FAIL: published_attestations exposed review_state %', rs;
  END IF;
  SELECT count(*) INTO c FROM private_staging.reference_entity_attestations;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: anon direct attestations read returned % rows, expected 1', c;
  END IF;
END $$;
RESET ROLE;

-- 13. Public views expose exactly the client-safe columns (P2 allowlist).
-- Any future private column (provenance, created_at, surrogate ids) fails here.
DO $$
DECLARE
  got text;
BEGIN
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO got
  FROM information_schema.columns
  WHERE table_schema = 'public_content' AND table_name = 'published_entities';
  IF got <> 'key,slug,type,identification_status' THEN
    RAISE EXCEPTION 'FAIL: published_entities columns (%) are not the allowlist', got;
  END IF;
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO got
  FROM information_schema.columns
  WHERE table_schema = 'public_content' AND table_name = 'published_attestations';
  IF got <> 'entity_id,scope_id,reference_unit_id,kind,explicitness,review_state' THEN
    RAISE EXCEPTION 'FAIL: published_attestations columns (%) are not the allowlist', got;
  END IF;
  SELECT string_agg(column_name, ',' ORDER BY ordinal_position) INTO got
  FROM information_schema.columns
  WHERE table_schema = 'public_content' AND table_name = 'published_verses';
  IF got <> 'edition_id,reference_unit_id,book_id,chapter,verse_number,text,text_sha256' THEN
    RAISE EXCEPTION 'FAIL: published_verses columns (%) are not the allowlist', got;
  END IF;
END $$;

rollback;
