-- Test: Bookmark identity uniqueness (M07b, migration 07).
-- Every check is a real assertion (EXCEPTION on violation). No string PASS.
-- Proves the (user_id, refsys, local_key) unique constraint: duplicate
-- locations for one user are rejected, the same location for two users is
-- allowed, and distinct locations still insert.
--
-- Run: psql "$DATABASE_URL" -f supabase/tests/06_bookmark_identity_test.sql
-- Single transaction, rolls back. Requires a superuser-equivalent role.
-- Supabase-gated runs: docs/REGISTRY_MIGRATION_NOTES.md.

begin;

-- Synthetic users (clearly not real; valid UUIDs for auth.uid() casts).
-- A = 11111111-1111-1111-1111-111111111111
-- B = 22222222-2222-2222-2222-222222222222
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
END $$;
SET ROLE authenticated;

-- 1. First insert at a location succeeds.
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Neh.2');
END $$;

-- 2. Duplicate location for the same user is rejected.
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Neh.2');
  RAISE EXCEPTION 'FAIL: duplicate (user, refsys, local_key) insert succeeded';
EXCEPTION
  WHEN unique_violation THEN NULL;
END $$;

-- 3. Same location for a different user is allowed.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}', true);
END $$;
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('22222222-2222-2222-2222-222222222222', 'refsys:eng-v22', 'Neh.2');
END $$;

-- 4. A different location for the first user is allowed.
DO $$
BEGIN
  PERFORM set_config('request.jwt.claims', '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
END $$;
DO $$
BEGIN
  INSERT INTO private_staging.bookmarks (user_id, refsys, local_key)
  VALUES ('11111111-1111-1111-1111-111111111111', 'refsys:eng-v22', 'Ezra.4');
END $$;

-- 5. Exactly three rows exist (proves 2 was rejected, 3 and 4 landed).
-- Count as the privileged owner: the bookmarks_owner RLS policy would
-- otherwise filter the count to the impersonated user only.
RESET ROLE;
DO $$
DECLARE
  c integer;
BEGIN
  SELECT count(*) INTO c FROM private_staging.bookmarks;
  IF c <> 3 THEN
    RAISE EXCEPTION 'FAIL: % bookmarks present, expected 3', c;
  END IF;
END $$;

rollback;
