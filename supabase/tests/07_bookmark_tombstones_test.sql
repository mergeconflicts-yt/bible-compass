-- Test: Bookmark tombstone RLS + convergence primitives (finding 3, migration 08).
-- Every check is a real assertion (EXCEPTION on violation). No string PASS.
-- Proves SECURITY.md ownership on bookmark_tombstones (auth.uid() = user_id
-- on select/insert/update/delete, forged user_id fails, cross-user denial)
-- plus the two statements the sync adapter depends on: location upsert is
-- idempotent under RLS, and a tombstoned location stays tombstoned until
-- explicitly cleared.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/07_bookmark_tombstones_test.sql
-- Single transaction, rolls back. Requires a superuser-equivalent role.
-- Supabase-gated runs: docs/REGISTRY_MIGRATION_NOTES.md.

begin;

-- Synthetic users (clearly not real; valid UUIDs for auth.uid() casts).
-- A = 11111111-1111-1111-1111-111111111111
-- B = 22222222-2222-2222-2222-222222222222

-- 1. RLS enabled on the tombstone table (named, exact).
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private_staging'
    AND c.relkind = 'r'
    AND c.relname IN ('bookmark_tombstones')
    AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on tombstone tables: %', missing;
  END IF;
END $$;

-- 2. Anonymous gets no access (no grants: expects error).
SET ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.bookmark_tombstones LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon could read private_staging.bookmark_tombstones';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO private_staging.bookmark_tombstones (user_id, refsys, local_key)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Neh.2.4');
  RAISE EXCEPTION 'FAIL: anon could insert into private_staging.bookmark_tombstones';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 3. Impersonation primitive works (loud failure, never silent green).
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;
DO $$
DECLARE
  u uuid;
BEGIN
  SELECT auth.uid() INTO u;
  IF u IS DISTINCT FROM '11111111-1111-1111-1111-111111111111'::uuid THEN
    RAISE EXCEPTION 'FAIL: auth.uid() impersonation broken (got %)', u;
  END IF;
END $$;

-- 4. User A writes a tombstone and reads it back.
DO $$
BEGIN
  INSERT INTO private_staging.bookmark_tombstones (user_id, refsys, local_key, client_op_id)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Neh.2.4', 'op-1');
END $$;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmark_tombstones;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: user A sees % tombstones, expected 1', c;
  END IF;
END $$;

-- 5. Location upsert is idempotent under RLS (the adapter's remove replay).
DO $$
BEGIN
  INSERT INTO private_staging.bookmark_tombstones (user_id, refsys, local_key, client_op_id)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Neh.2.4', 'op-1')
  ON CONFLICT (user_id, refsys, local_key) DO UPDATE SET client_op_id = EXCLUDED.client_op_id;
END $$;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmark_tombstones;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: upsert duplicated the tombstone (% rows)', c;
  END IF;
END $$;

-- 6. Forged user_id insert fails (WITH CHECK, not just visibility).
DO $$
BEGIN
  INSERT INTO private_staging.bookmark_tombstones (user_id, refsys, local_key)
  VALUES ('22222222-2222-2222-2222-222222222222', 'refsys:eng-v22', 'Neh.2.4');
  RAISE EXCEPTION 'FAIL: forged tombstone user_id insert succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
RESET ROLE;

-- 7. Switch to user B: sees nothing of A's, cannot touch A's rows.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmark_tombstones;
  IF c <> 0 THEN
    RAISE EXCEPTION 'FAIL: user B sees % of user A tombstones, expected 0', c;
  END IF;
END $$;
DO $$
DECLARE
  c integer;
BEGIN
  DELETE FROM private_staging.bookmark_tombstones
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS c = ROW_COUNT;
  IF c <> 0 THEN
    RAISE EXCEPTION 'FAIL: user B deleted % of user A tombstones', c;
  END IF;
END $$;

-- 8. User B creates an owned tombstone (policy is per-user, not deny-all).
DO $$
BEGIN
  INSERT INTO private_staging.bookmark_tombstones (user_id, refsys, local_key)
  VALUES ('22222222-2222-2222-2222-222222222222', 'refsys:eng-v22', 'Neh.2.1');
END $$;
RESET ROLE;

-- 9. Privileged role sees both rows (proves isolation was RLS, not absence).
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmark_tombstones;
  IF c <> 2 THEN
    RAISE EXCEPTION 'FAIL: privileged sees % tombstones, expected 2', c;
  END IF;
END $$;

-- 10. User A clears the owned tombstone (proves owned delete works: an
-- explicitly newer add removes the tombstone it outranks).
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;
DO $$
DECLARE
  c integer;
BEGIN
  DELETE FROM private_staging.bookmark_tombstones
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS c = ROW_COUNT;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: user A deleted % own tombstones, expected 1', c;
  END IF;
END $$;
RESET ROLE;

-- 11. Exactly one row (B's) remains.
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmark_tombstones;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: % tombstones remain, expected 1', c;
  END IF;
END $$;

rollback;
