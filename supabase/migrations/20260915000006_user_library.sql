-- Migration: 20260915000006_user_library
-- R1-B: minimal user-owned tables so cross-user RLS denial is testable.
--
-- Deliberately NO foreign key to auth.users: the RLS policy
-- (auth.uid() = user_id) is the authorization boundary per SECURITY.md,
-- and an FK would couple migrations to auth-schema internals. Application
-- logic plus auth guarantee referenced users exist. Account-deletion
-- cleanup of orphan rows is follow-up work (tombstones per SECURITY.md).

CREATE TABLE private_staging.profiles (
  id uuid PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE private_staging.bookmarks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  refsys text NOT NULL,
  local_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_bookmarks_user_id ON private_staging.bookmarks (user_id);

ALTER TABLE private_staging.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE private_staging.bookmarks ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON private_staging.profiles TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON private_staging.bookmarks TO authenticated;

CREATE POLICY profiles_owner ON private_staging.profiles
  FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE POLICY bookmarks_owner ON private_staging.bookmarks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
