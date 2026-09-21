-- Test: Canon/reference/edition staging — enforceable (R1-B, Task 17A).
-- Every check is a real assertion (EXCEPTION on violation). No string PASS.
-- Run: psql "$DATABASE_URL" -f supabase/tests/02_canon_reference_edition_test.sql
-- Single transaction, rolls back. Requires a superuser-equivalent role for
-- SET ROLE impersonation. Supabase-gated runs: docs/REGISTRY_MIGRATION_NOTES.md.

begin;

-- 1. RLS enabled on all 11 canon/reference/edition tables (named, exact).
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private_staging'
    AND c.relkind = 'r'
    AND c.relname IN ('canons', 'scripture_works', 'canon_work_memberships', 'reference_systems', 'reference_units', 'reference_mappings', 'scripture_scopes', 'scope_members', 'translation_works', 'translation_editions', 'translation_edition_verses')
    AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on staging tables: %', missing;
  END IF;
END $$;

-- 2. No write grants to anon/authenticated/public on those 11 tables.
-- (SELECT grants exist only where migration 05 allows published reads.)
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.role_table_grants
  WHERE table_schema = 'private_staging'
    AND table_name IN ('canons', 'scripture_works', 'canon_work_memberships', 'reference_systems', 'reference_units', 'reference_mappings', 'scripture_scopes', 'scope_members', 'translation_works', 'translation_editions', 'translation_edition_verses')
    AND grantee IN ('anon', 'authenticated', 'public')
    AND privilege_type IN ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE', 'REFERENCES', 'TRIGGER');
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: % write grants on canon tables', n;
  END IF;
END $$;

-- 3. Anonymous cannot read staging canon tables (no grant: expects error).
SET ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.canons LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon could read private_staging.canons';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 4. Structural reference tables are readable by design (the published read
-- API needs book codes and reference keys — migration 20260915000013), while
-- other staging canon tables stay private.
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.reference_units LIMIT 1;
END $$;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.canons LIMIT 1;
  RAISE EXCEPTION 'FAIL: authenticated could read private_staging.canons';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.reference_mappings LIMIT 1;
  RAISE EXCEPTION 'FAIL: authenticated could read private_staging.reference_mappings';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 5. reference_units keeps both uniqueness scopes (refsys,local) + (refsys,ordinal).
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM pg_constraint
  WHERE conrelid = 'private_staging.reference_units'::regclass
    AND contype = 'u';
  IF n <> 2 THEN
    RAISE EXCEPTION 'FAIL: reference_units has % unique constraints, expected 2', n;
  END IF;
END $$;

-- 6. Digest CHECK enforced: bad source_artifact_sha256 rejected.
-- Chain built with collision-proof probe keys (ON CONFLICT guards).
DO $$
DECLARE
  canon_id uuid;
  work_id uuid;
  refsys_id uuid;
  trans_id uuid;
BEGIN
  INSERT INTO private_staging.canons (key, name)
  VALUES ('canon:prot-66', 'probe-rls-test')
  ON CONFLICT (key) DO NOTHING;
  SELECT id INTO canon_id FROM private_staging.canons WHERE key = 'canon:prot-66';
  INSERT INTO private_staging.scripture_works (key, osis_code, name, testament)
  VALUES ('work:Prob:prot-66', 'Prob', 'Probe', 'OT')
  ON CONFLICT (key) DO NOTHING;
  SELECT id INTO work_id FROM private_staging.scripture_works WHERE key = 'work:Prob:prot-66';
  INSERT INTO private_staging.reference_systems (key, canon_id, version, status)
  VALUES ('refsys:eng-v99', canon_id, 99, 'draft')
  ON CONFLICT (key) DO NOTHING;
  SELECT id INTO refsys_id FROM private_staging.reference_systems WHERE key = 'refsys:eng-v99';
  INSERT INTO private_staging.translation_works (key, language_tag, name, publisher)
  VALUES ('trans:bsb', 'en', 'probe', 'probe')
  ON CONFLICT (key) DO NOTHING;
  SELECT id INTO trans_id FROM private_staging.translation_works WHERE key = 'trans:bsb';
  INSERT INTO private_staging.translation_editions
    (work_id, key, language_tag, reference_system_id, revision_date, source_artifact_sha256, attribution, status)
  VALUES (
    trans_id,
    'edition:bsb@20260915:sha-deadbeef',
    'en',
    refsys_id,
    '2026-09-15',
    'bad-sha',
    'probe',
    'draft'
  );
  RAISE EXCEPTION 'FAIL: invalid source_artifact_sha256 was accepted';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;

-- 7. Mapping kinds stay closed: bogus kind rejected (no FKs on this table,
-- so the CHECK is isolated deterministically).
DO $$
BEGIN
  INSERT INTO private_staging.reference_mappings
    (from_refsys, from_unit, to_refsys, to_unit, kind, review_state)
  VALUES ('refsys:eng-v22', 'Neh.2.4', 'refsys:tel-v1', 'Neh.2.4a', 'bogus', 'draft');
  RAISE EXCEPTION 'FAIL: invalid mapping kind was accepted';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;

-- 8. Published-edition immutability trigger exists.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM pg_trigger WHERE tgname LIKE 'trg_prevent_published%';
  IF n < 1 THEN
    RAISE EXCEPTION 'FAIL: published-edition immutability trigger missing';
  END IF;
END $$;

rollback;
