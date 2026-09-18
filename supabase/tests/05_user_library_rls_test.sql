-- Test: User library RLS — cross-user denial (R1-B, migration 06).
-- Every check is a real assertion (EXCEPTION on violation). No string PASS.
-- Proves SECURITY.md ownership: auth.uid() = user_id on select/insert/
-- update/delete, forged user_id fails, and User A never sees User B rows.
--
-- Impersonation primitive (verified first, so a broken harness fails loudly
-- instead of passing vacuously):
--   SELECT set_config('request.jwt.claims', '{"sub":"<uuid>"}', true);
--   SET ROLE authenticated;
-- Run: psql "$DATABASE_URL" -f supabase/tests/05_user_library_rls_test.sql
-- Single transaction, rolls back. Requires a superuser-equivalent role.
-- Supabase-gated runs: docs/REGISTRY_MIGRATION_NOTES.md.

begin;

-- Synthetic users (clearly not real; valid UUIDs for auth.uid() casts).
-- A = 11111111-1111-1111-1111-111111111111
-- B = 22222222-2222-2222-2222-222222222222

-- 1. RLS enabled on both user tables (named, exact).
DO $$
DECLARE
  missing text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO missing
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'private_staging'
    AND c.relkind = 'r'
    AND c.relname IN ('profiles', 'bookmarks')
    AND NOT c.relrowsecurity;
  IF missing IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL: RLS not enabled on user tables: %', missing;
  END IF;
END $$;

-- 2. Anonymous gets no access to user tables (no grants: expects error).
SET ROLE anon;
DO $$
BEGIN
  PERFORM 1 FROM private_staging.bookmarks LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon could read private_staging.bookmarks';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Neh.2.4');
  RAISE EXCEPTION 'FAIL: anon could insert into private_staging.bookmarks';
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

-- 4. User A creates and reads an owned bookmark.
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Neh.2.4');
END $$;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmarks;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: user A sees % bookmarks, expected 1', c;
  END IF;
END $$;

-- 5. User A updates the owned bookmark (ROW_COUNT proves the write).
DO $$
DECLARE
  c integer;
BEGIN
  UPDATE private_staging.bookmarks SET local_key = 'Neh.2.5'
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS c = ROW_COUNT;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: user A updated % rows, expected 1', c;
  END IF;
END $$;

-- 6. Forged user_id insert fails (WITH CHECK, not just visibility).
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('22222222-2222-2222-2222-222222222222', 'refsys:eng-v22', 'Neh.2.4');
  RAISE EXCEPTION 'FAIL: forged user_id insert succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;

-- 7. Forged profile insert fails the same way.
DO $$
BEGIN
  INSERT INTO private_staging.profiles (id)
  VALUES ('22222222-2222-2222-2222-222222222222');
  RAISE EXCEPTION 'FAIL: forged profile insert succeeded';
EXCEPTION
  WHEN insufficient_privilege THEN NULL;
END $$;

-- 8. User A creates an owned profile (proves legitimate writes pass).
DO $$
BEGIN
  INSERT INTO private_staging.profiles (id)
  VALUES ('11111111-1111-1111-1111-111111111111');
END $$;
RESET ROLE;

-- 9. Switch to user B: sees nothing of A's.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmarks;
  IF c <> 0 THEN
    RAISE EXCEPTION 'FAIL: user B sees % of user A bookmarks, expected 0', c;
  END IF;
END $$;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.profiles;
  IF c <> 0 THEN
    RAISE EXCEPTION 'FAIL: user B sees % of user A profiles, expected 0', c;
  END IF;
END $$;

-- 10. User B cannot update or delete A's rows (0 changes, no error).
DO $$
DECLARE
  c integer;
BEGIN
  UPDATE private_staging.bookmarks SET local_key = 'Neh.2.9'
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS c = ROW_COUNT;
  IF c <> 0 THEN
    RAISE EXCEPTION 'FAIL: user B updated % of user A rows', c;
  END IF;
  DELETE FROM private_staging.bookmarks
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS c = ROW_COUNT;
  IF c <> 0 THEN
    RAISE EXCEPTION 'FAIL: user B deleted % of user A rows', c;
  END IF;
END $$;

-- 11. User B creates an owned row (proves the policy is per-user, not deny-all).
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('22222222-2222-2222-2222-222222222222', 'refsys:eng-v22', 'Neh.2.1');
END $$;
RESET ROLE;

-- 12. Privileged role sees both rows (proves isolation was RLS, not absence).
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmarks;
  IF c <> 2 THEN
    RAISE EXCEPTION 'FAIL: privileged sees % bookmarks, expected 2', c;
  END IF;
END $$;

-- 13. User A deletes the owned row (proves owned delete works).
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;
DO $$
DECLARE
  c integer;
BEGIN
  DELETE FROM private_staging.bookmarks
  WHERE user_id = '11111111-1111-1111-1111-111111111111';
  GET DIAGNOSTICS c = ROW_COUNT;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: user A deleted % own rows, expected 1', c;
  END IF;
END $$;
RESET ROLE;

-- 14. Exactly one row (B's) remains.
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmarks;
  IF c <> 1 THEN
    RAISE EXCEPTION 'FAIL: % bookmarks remain, expected 1', c;
  END IF;
END $$;

rollback;
