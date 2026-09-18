-- Migration: 20260915000007_bookmark_identity
-- M07b: one bookmark per (user, refsys, local_key). Two devices pushing the
-- same location concurrently must converge instead of duplicating rows, and
-- the client's existence-check push stays idempotent at the database level.
-- Additive only; the staging table holds no production data.

ALTER TABLE private_staging.bookmarks
  ADD CONSTRAINT bookmarks_user_location_unique
  UNIQUE (user_id, refsys, local_key);
