-- Migration: 20260915000012_curation_imports
-- Task EN-03 — Nehemiah 2 curation importer support.
--
-- Two changes, both necessary for a faithful transactional import:
--   1. private_staging.curation_imports: one idempotency/receipt row per
--      curation package import. Replay of identical bytes is a no-op; replay
--      of changed bytes for the same package fails.
--   2. reference_entity_attestations.claim_id becomes nullable: the EN-01
--      canonical package allows a canonical attestation with no supporting
--      claim (e.g. an object merely present in a verse). Nothing is exposed
--      publicly; the table stays private with RLS enabled and revoked grants.
--
-- No other schema changes. Drafts only; no publication, no anon access.

-- ---------------------------------------------------------------------------
-- 1. import receipts (append-once per package key)
-- ---------------------------------------------------------------------------
create table if not exists private_staging.curation_imports (
  package_key text primary key check (package_key ~ '^[a-z0-9:-]+$'),
  package_revision integer not null check (package_revision > 0),
  payload_digest text not null check (payload_digest ~ '^sha256:[0-9a-f]{64}$'),
  receipt jsonb not null,
  imported_at timestamptz not null default now()
);

alter table private_staging.curation_imports enable row level security;
revoke all on private_staging.curation_imports from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. allow canonical attestations without a supporting claim
-- ---------------------------------------------------------------------------
alter table private_staging.reference_entity_attestations
  alter column claim_id drop not null;
