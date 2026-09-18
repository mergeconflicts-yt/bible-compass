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

rollback;
