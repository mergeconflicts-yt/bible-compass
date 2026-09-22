-- Migration: 20260916000016_publication_integrity
-- Tasks: whole-English packaging, publication integrity, lossless witness links.
--
-- Additive only (applied migrations are never edited). Four concerns:
--
-- 1. Package keys can address a whole-canon package, not only the Nehemiah 2
--    fixture: `en.bsb.all@1:sha-xxxxxxxx` is now valid beside `en.bsb.neh-2@...`.
-- 2. Manifest integrity: a draft manifest may exist with no approval (so a
--    draft import can record membership), but a manifest cannot be PUBLISHED
--    unless its approval is approved, keyed to the manifest, and bound to the
--    exact checksum + content revision; rights must be cleared. Published
--    manifests are immutable. The active `publication_releases` pointer is the
--    only thing the public read path trusts.
-- 3. Active-release scoping helper `private_staging.package_is_published(uuid)`
--    used by the public views/function so an old, superseded manifest is never
--    visible once a newer release is active.
-- 4. Lossless witness links: the importer previously kept only the first
--    attestation claim and the first relationship scope. Join tables preserve
--    every claim link, and a stable unique key is added to relationship
--    assertions so the importer can attach those links deterministically.
--
-- Drafts only: nothing here approves or publishes content.

-- ---------------------------------------------------------------------------
-- 1. Wider manifest keys (whole-canon packages)
-- ---------------------------------------------------------------------------
alter table private_staging.package_manifests
  drop constraint if exists package_manifests_key_check;
-- Drop the table-level CHECK that forced approval_id NOT NULL; approval becomes
-- a publication gate, not an insertion requirement.
alter table private_staging.package_manifests
  drop constraint if exists package_manifests_check;
alter table private_staging.package_manifests
  add constraint package_manifests_key_check
  check (key ~ '^(en|te|ta)\.[a-z0-9-]+(\.[a-z0-9-]+)?@[0-9]+:sha-[0-9a-f]{8}$');
alter table private_staging.package_manifests
  alter column approval_id drop not null;

-- ---------------------------------------------------------------------------
-- 2. Rights / territory binding on the manifest
-- ---------------------------------------------------------------------------
alter table private_staging.package_manifests
  add column if not exists rights_status text not null default 'unknown'
    check (rights_status in ('unknown','cleared','denied')),
  add column if not exists allowed_territories text[] not null default array['*']::text[];

-- ---------------------------------------------------------------------------
-- 3. Immutability + publish-time approval binding
-- ---------------------------------------------------------------------------
create or replace function private_staging.prevent_manifest_mutation()
returns trigger
language plpgsql
as $$
declare
  published_now boolean;
begin
  if tg_op = 'DELETE' then
    raise exception 'package_manifests is append-only: DELETE not allowed';
  end if;

  if tg_op = 'INSERT' then
    published_now := new.published_at is not null;
  else
    -- Once published, the manifest is frozen.
    if old.published_at is not null then
      raise exception 'published package_manifests are immutable';
    end if;
    published_now := new.published_at is not null and old.published_at is null;
  end if;

  -- The publication transition itself requires a matching approved approval
  -- and cleared rights; the digest/revision are bound to the manifest.
  if published_now then
    if new.rights_status <> 'cleared' then
      raise exception 'cannot publish manifest %: rights_status is % (must be cleared)', new.key, new.rights_status;
    end if;
    if new.approval_id is null then
      raise exception 'cannot publish manifest %: no approval bound', new.key;
    end if;
    if not exists (
      select 1 from private_staging.approval_records a
      where a.id = new.approval_id
        and a.decision = 'approved'
        and a.subject_key = new.key
        and a.subject_digest = new.checksum
        and a.subject_revision = new.content_version
    ) then
      raise exception 'cannot publish manifest %: approval does not match its key, digest and revision', new.key;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_prevent_manifest_mutation on private_staging.package_manifests;
create trigger trg_prevent_manifest_mutation
  before insert or update or delete on private_staging.package_manifests
  for each row execute function private_staging.prevent_manifest_mutation();

-- ---------------------------------------------------------------------------
-- 4. Active-release published-package gate
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER so the public views (security_invoker) can call it without
-- exposing approval_records or publication_releases to anon directly.
create or replace function private_staging.package_is_published(p_package_id uuid)
returns boolean
language sql
stable
security definer
set search_path = private_staging, pg_temp
as $$
  select exists (
    select 1
    from private_staging.package_manifests pkg
    where pkg.id = p_package_id
      and pkg.published_at is not null
      and pkg.published_at <= now()
      and pkg.rights_status = 'cleared'
      -- exactly the active release for the locale, not any old manifest
      and exists (
        select 1 from private_staging.publication_releases pr
        where pr.package_id = pkg.id
          and pr.locale = pkg.locale
          and pr.is_active
      )
      and pkg.approval_id is not null
      and exists (
        select 1 from private_staging.approval_records a
        where a.id = pkg.approval_id
          and a.decision = 'approved'
          and a.subject_key = pkg.key
          and a.subject_digest = pkg.checksum
          and a.subject_revision = pkg.content_version
      )
  );
$$;
grant execute on function private_staging.package_is_published(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 5. Stable relationship-assertion identity (for claim links)
-- ---------------------------------------------------------------------------
create unique index if not exists uq_relationship_assertion
  on private_staging.entity_relationship_assertions
  (subject_entity_id, predicate, object_entity_id, scope_id);

-- ---------------------------------------------------------------------------
-- 6. Explicit row ownership so an importer converges its OWN rows only.
--
-- Every table an importer inserts into that can be shared across packages
-- (the same entity/scope/verse appears in more than one package) gains a
-- nullable origin_package_id. The whole-canon importer deletes only rows it
-- owns; a row first written by the locked Nehemiah 2 package keeps a NULL
-- origin and is never removed by a later English refresh. This replaces the
-- previous scope-wide deletes that could destroy another package's reviewed
-- rows and break the restrictive foreign keys on their localizations.
-- ---------------------------------------------------------------------------
alter table private_staging.reference_entity_attestations
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.entity_relationship_assertions
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.scope_entity_relevance
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.edition_mentions
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.event_participants
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.event_places
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.event_scripture_accounts
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.place_geometries
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.entity_descriptions
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.entity_names
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.events
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;
alter table private_staging.context_artifacts
  add column if not exists origin_package_id uuid references private_staging.package_manifests(id) on delete restrict;

create index if not exists idx_attestations_origin on private_staging.reference_entity_attestations (origin_package_id);
create index if not exists idx_relationship_origin on private_staging.entity_relationship_assertions (origin_package_id);
create index if not exists idx_relevance_origin on private_staging.scope_entity_relevance (origin_package_id);
create index if not exists idx_mentions_origin on private_staging.edition_mentions (origin_package_id);
create index if not exists idx_context_artifacts_origin on private_staging.context_artifacts (origin_package_id);

-- ---------------------------------------------------------------------------
-- 7. Lossless witness link tables (all private, deny-all)
-- ---------------------------------------------------------------------------
create table if not exists private_staging.reference_entity_attestation_claims (
  attestation_id uuid not null references private_staging.reference_entity_attestations(id) on delete restrict,
  claim_id uuid not null references private_staging.claims(id) on delete restrict,
  primary key (attestation_id, claim_id)
);

create table if not exists private_staging.entity_relationship_assertion_claims (
  assertion_id uuid not null references private_staging.entity_relationship_assertions(id) on delete restrict,
  claim_id uuid not null references private_staging.claims(id) on delete restrict,
  primary key (assertion_id, claim_id)
);

create table if not exists private_staging.event_participant_claims (
  event_id uuid not null,
  entity_id uuid not null,
  role text not null,
  claim_id uuid not null references private_staging.claims(id) on delete restrict,
  primary key (event_id, entity_id, role, claim_id),
  foreign key (event_id, entity_id, role)
    references private_staging.event_participants (event_id, entity_id, role) on delete restrict
);

create table if not exists private_staging.event_place_claims (
  event_id uuid not null,
  place_id uuid not null,
  claim_id uuid not null references private_staging.claims(id) on delete restrict,
  primary key (event_id, place_id, claim_id),
  foreign key (event_id, place_id)
    references private_staging.event_places (event_id, place_id) on delete restrict
);

create table if not exists private_staging.event_scripture_account_claims (
  event_id uuid not null,
  scope_id uuid not null,
  claim_id uuid not null references private_staging.claims(id) on delete restrict,
  primary key (event_id, scope_id, claim_id),
  foreign key (event_id, scope_id)
    references private_staging.event_scripture_accounts (event_id, scope_id) on delete restrict
);

alter table private_staging.reference_entity_attestation_claims enable row level security;
alter table private_staging.entity_relationship_assertion_claims enable row level security;
alter table private_staging.event_participant_claims enable row level security;
alter table private_staging.event_place_claims enable row level security;
alter table private_staging.event_scripture_account_claims enable row level security;

revoke all on private_staging.reference_entity_attestation_claims from public, anon, authenticated;
revoke all on private_staging.entity_relationship_assertion_claims from public, anon, authenticated;
revoke all on private_staging.event_participant_claims from public, anon, authenticated;
revoke all on private_staging.event_place_claims from public, anon, authenticated;
revoke all on private_staging.event_scripture_account_claims from public, anon, authenticated;

create policy deny_all_attestation_claims on private_staging.reference_entity_attestation_claims for all to anon, authenticated using (false) with check (false);
create policy deny_all_relationship_claims on private_staging.entity_relationship_assertion_claims for all to anon, authenticated using (false) with check (false);
create policy deny_all_event_participant_claims on private_staging.event_participant_claims for all to anon, authenticated using (false) with check (false);
create policy deny_all_event_place_claims on private_staging.event_place_claims for all to anon, authenticated using (false) with check (false);
create policy deny_all_event_account_claims on private_staging.event_scripture_account_claims for all to anon, authenticated using (false) with check (false);
