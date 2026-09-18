-- Migration: 20260915000008_bookmark_tombstones
-- Finding 3: server tombstones for bookmark removes (tombstone-wins per
-- docs/DECISION_M07_SYNC.md D3, already decided). A remove upserts a
-- tombstone row and deletes the bookmark row; a later add compares its
-- timestamp against the tombstone and loses to a newer tombstone instead
-- of resurrecting the bookmark. The primary key doubles as the location
-- uniqueness constraint. Additive only; the staging tables hold no
-- production data.
--
-- Deliberately NO foreign key to auth.users: the RLS policy
-- (auth.uid() = user_id) is the authorization boundary per SECURITY.md.
-- Account-deletion cleanup of orphan rows is follow-up work (tombstones
-- per SECURITY.md).

CREATE TABLE private_staging.bookmark_tombstones (
  user_id uuid NOT NULL,
  refsys text NOT NULL,
  local_key text NOT NULL,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  client_op_id text NOT NULL DEFAULT '',
  PRIMARY KEY (user_id, refsys, local_key)
);
CREATE INDEX idx_tombstones_user_id ON private_staging.bookmark_tombstones (user_id);

ALTER TABLE private_staging.bookmark_tombstones ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON private_staging.bookmark_tombstones TO authenticated;

CREATE POLICY tombstones_owner ON private_staging.bookmark_tombstones
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
