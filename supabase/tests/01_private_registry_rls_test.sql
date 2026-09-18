-- Test: Private registry RLS — enforceable (R1-B).
-- Every check below is a real assertion: any violation raises EXCEPTION and
-- aborts with a non-zero exit. String-returning PASS/FAIL selects are banned.
--
-- Run (single transaction, rolls back, no state changes):
--   psql "$DATABASE_URL" -f supabase/tests/01_private_registry_rls_test.sql
-- Run as a superuser/service_role-equivalent (default local DATABASE_URL user)
-- so SET ROLE impersonation is permitted. Supabase-gated runs: see
-- docs/REGISTRY_MIGRATION_NOTES.md (explicit SUPABASE_TESTS_SKIPPED notice
-- when no stack is available; never silent).

begin;

-- 1. RLS enabled on exactly the 11 private_registry tables.
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private_registry'
    AND c.relkind = 'r'
    AND c.relname IN ('sources', 'source_releases', 'source_artifacts', 'rights_components', 'operation_grants', 'approval_records', 'audit_receipts', 'raw_records', 'import_runs', 'external_mappings', 'findings')
    AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on private_registry tables: %', missing;
  END IF;
END $$;

-- 2. Zero grants of any kind to anon/authenticated/public on private_registry.
DO $$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n
  FROM information_schema.role_table_grants
  WHERE table_schema = 'private_registry'
    AND grantee IN ('anon', 'authenticated', 'public');
  IF n <> 0 THEN
    RAISE EXCEPTION 'FAIL: % grants to anon/authenticated/public on private_registry', n;
  END IF;
END $$;

-- 3. Anonymous cannot read private registry (expects permission error).
SET ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM private_registry.sources LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon could read private_registry.sources';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 4. Authenticated cannot read private registry either.
SET ROLE authenticated;
DO $$
BEGIN
  PERFORM 1 FROM private_registry.sources LIMIT 1;
  RAISE EXCEPTION 'FAIL: authenticated could read private_registry.sources';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 5. Authenticated cannot insert into private registry.
SET ROLE authenticated;
DO $$
BEGIN
  INSERT INTO private_registry.sources (source_key, publisher)
  VALUES ('source:test:probe', 'probe');
  RAISE EXCEPTION 'FAIL: authenticated could insert into private_registry.sources';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 6. Digest CHECK is still enforced (privileged run; expects check violation).
DO $$
DECLARE
  src uuid;
BEGIN
  INSERT INTO private_registry.sources (source_key, publisher)
  VALUES ('source:test:invalid-sha-probe', 'probe');
  SELECT id INTO src FROM private_registry.sources
  WHERE source_key = 'source:test:invalid-sha-probe';
  INSERT INTO private_registry.source_releases
    (source_id, release_key, commit_or_tag, artifact_sha256, byte_size, retrieved_at, license_evidence_sha256, required_attribution, status)
  VALUES (
    src,
    'release:source:test:invalid-sha-probe@abc123:sha-deadbeef',
    'abc123',
    'bad-sha',
    100,
    now(),
    'sha256:' || repeat('b', 64),
    'probe',
    'candidate'
  );
  RAISE EXCEPTION 'FAIL: invalid artifact_sha256 was accepted';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;

-- 7. Quarantine-path CHECK is still enforced.
DO $$
DECLARE
  src uuid;
  rel uuid;
BEGIN
  INSERT INTO private_registry.sources (source_key, publisher)
  VALUES ('source:test:quarantine-probe', 'probe');
  SELECT id INTO src FROM private_registry.sources
  WHERE source_key = 'source:test:quarantine-probe';
  INSERT INTO private_registry.source_releases
    (source_id, release_key, commit_or_tag, artifact_sha256, byte_size, retrieved_at, license_evidence_sha256, required_attribution, status)
  VALUES (
    src,
    'release:source:test:quarantine-probe@abc123:sha-deadbeef',
    'abc123',
    'sha256:' || repeat('a', 64),
    100,
    now(),
    'sha256:' || repeat('b', 64),
    'probe',
    'candidate'
  );
  SELECT id INTO rel FROM private_registry.source_releases
  WHERE release_key = 'release:source:test:quarantine-probe@abc123:sha-deadbeef';
  INSERT INTO private_registry.source_artifacts
    (release_id, url, media_type, byte_size, sha256, quarantine_path)
  VALUES (
    rel,
    'https://example.invalid/bad.zip',
    'application/zip',
    100,
    'sha256:' || repeat('a', 64),
    '/tmp/bad.zip'
  );
  RAISE EXCEPTION 'FAIL: bad quarantine_path was accepted';
EXCEPTION
  WHEN check_violation THEN NULL;
END $$;

-- 8. Unknown operation state stays permitted in storage but denied by the
-- evaluator (fail-closed). DB shape check only; denial is proven by the
-- registry unit suite (rights-unknown) in CI.
DO $$
DECLARE
  has_unknown boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'private_registry'
      AND table_name = 'operation_grants'
      AND column_name = 'state'
  ) INTO has_unknown;
  IF NOT has_unknown THEN
    RAISE EXCEPTION 'FAIL: operation_grants.state column missing';
  END IF;
END $$;

rollback;
