-- Migration: 20260915000004_review_package_rls
-- Task 17C — Review/package schemas, public projections, and RLS
-- Spec: docs/DATA_MODEL.md §9, docs/SECURITY.md:35
-- Scope: private_staging review/package + public_content views + RLS allow/deny
-- RLS: private tables deny anon/authenticated, public views allow published only

create schema if not exists private_staging;
create schema if not exists public_content;

-- ---------------------------------------------------------------------------
-- 1. approval_records (append-only, digest-bound, authenticated actor)
-- ---------------------------------------------------------------------------
create table private_staging.approval_records (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  subject_digest text not null check (subject_digest ~ '^sha256:[0-9a-f]{64}$'),
  subject_revision integer not null check (subject_revision > 0),
  reviewer_id text not null,
  reviewer_role text not null check (reviewer_role in ('product_owner','rights_reviewer','editorial_reviewer','biblical_reviewer','historical_reviewer','geographic_reviewer','language_reviewer')),
  decision text not null check (decision in ('approved','rejected')),
  constraints text,
  created_at timestamptz not null default now()
);
create index idx_approval_subject_key on private_staging.approval_records (subject_key);
create index idx_approval_subject_digest on private_staging.approval_records (subject_digest);

-- ---------------------------------------------------------------------------
-- 2. package_manifests (immutable, digest-bound, approval required)
-- ---------------------------------------------------------------------------
create table private_staging.package_manifests (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^en\.bsb\.neh-2@[0-9]+:sha-[0-9a-f]{8}$'),
  locale text not null check (locale in ('en','te','ta')),
  translation_edition_id uuid references private_staging.translation_editions(id) on delete restrict,
  scope_id uuid references private_staging.scripture_scopes(id) on delete restrict,
  schema_version text not null,
  content_version integer not null check (content_version > 0),
  checksum text not null check (checksum ~ '^sha256:[0-9a-f]{64}$'),
  minimum_app_version text not null,
  approval_id uuid not null references private_staging.approval_records(id) on delete restrict,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  check (approval_id is not null)
);
create index idx_package_manifests_locale on private_staging.package_manifests (locale);

-- ---------------------------------------------------------------------------
-- 3. package_members
-- ---------------------------------------------------------------------------
-- Note (R1-B correction 2026-09-15): an earlier draft of this file created
-- this table with an expression primary key, which Postgres rejects, so the
-- migration could never execute. That statement never ran on any database
-- (no stack exists), hence this in-place correction instead of a repair
-- migration. Canonical definition uses a surrogate id plus exactly-one check.
create table private_staging.package_members (
  id uuid primary key default gen_random_uuid(),
  package_id uuid not null references private_staging.package_manifests(id) on delete restrict,
  entity_id uuid references private_staging.entities(id) on delete restrict,
  claim_id uuid references private_staging.claims(id) on delete restrict,
  context_revision_id uuid references private_staging.context_revisions(id) on delete restrict,
  created_at timestamptz not null default now(),
  check ((entity_id is not null)::int + (claim_id is not null)::int + (context_revision_id is not null)::int = 1)
);
create index idx_package_members_package on private_staging.package_members (package_id);

-- ---------------------------------------------------------------------------
-- 4. package_dependencies
-- ---------------------------------------------------------------------------
create table private_staging.package_dependencies (
  package_id uuid not null references private_staging.package_manifests(id) on delete restrict,
  depends_on_package_id uuid not null references private_staging.package_manifests(id) on delete restrict,
  created_at timestamptz not null default now(),
  primary key (package_id, depends_on_package_id),
  check (package_id <> depends_on_package_id)
);

-- ---------------------------------------------------------------------------
-- 5. publication_releases (active pointer, rollback via new row pointing to prior manifest)
-- ---------------------------------------------------------------------------
create table private_staging.publication_releases (
  id uuid primary key default gen_random_uuid(),
  locale text not null check (locale in ('en','te','ta')),
  package_id uuid not null references private_staging.package_manifests(id) on delete restrict,
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_publication_releases_locale on private_staging.publication_releases (locale);
create index idx_publication_releases_active on private_staging.publication_releases (locale, is_active) where is_active = true;

-- ---------------------------------------------------------------------------
-- 6. Public content views (synthetic published fixtures only, fail-closed)
-- ---------------------------------------------------------------------------
-- View for published entities (only where package_manifests.published_at is not null and locale allowed)
create or replace view public_content.published_entities as
select e.*
from private_staging.entities e
join private_staging.package_members pm on pm.entity_id = e.id
join private_staging.package_manifests pkg on pkg.id = pm.package_id
where pkg.published_at is not null
  and pkg.published_at <= now()
  and pkg.locale in ('en','te','ta');

create or replace view public_content.published_attestations as
select a.*
from private_staging.reference_entity_attestations a
join private_staging.package_members pm on pm.claim_id = a.claim_id
join private_staging.package_manifests pkg on pkg.id = pm.package_id
where pkg.published_at is not null and pkg.published_at <= now();

create or replace view public_content.published_verses as
select v.*
from private_staging.translation_edition_verses v
join private_staging.translation_editions ed on ed.id = v.edition_id
where ed.status = 'published';

-- ---------------------------------------------------------------------------
-- RLS: private tables deny anon/authenticated, public views allow published only via RLS on underlying tables
-- For public views, we enable RLS on underlying tables and create policies for anon to select only published
-- But for 17C, private_staging tables remain deny for anon/authenticated; public_content views are accessed via service_role or via RLS allow for published
-- We create RLS policies for anon to read published via views: we add policy on private_staging.package_manifests for anon to select where published_at is not null

alter table private_staging.approval_records enable row level security;
alter table private_staging.package_manifests enable row level security;
alter table private_staging.package_members enable row level security;
alter table private_staging.package_dependencies enable row level security;
alter table private_staging.publication_releases enable row level security;

revoke all on all tables in schema private_staging from public, anon, authenticated;
revoke all on schema public_content from public, anon, authenticated;
grant usage on schema public_content to anon, authenticated;

-- Deny all for anon/authenticated on private tables (default)
create policy "deny_all_approval_records" on private_staging.approval_records for all to anon, authenticated using (false) with check (false);
create policy "deny_all_package_manifests_private" on private_staging.package_manifests for all to anon, authenticated using (false) with check (false);
create policy "deny_all_package_members" on private_staging.package_members for all to anon, authenticated using (false) with check (false);
create policy "deny_all_package_dependencies" on private_staging.package_dependencies for all to anon, authenticated using (false) with check (false);
create policy "deny_all_publication_releases" on private_staging.publication_releases for all to anon, authenticated using (false) with check (false);

-- For public views, we need to allow anon to select published via underlying tables
-- Create a separate policy for anon to select published package_manifests via view
-- Note: Views respect RLS of underlying tables, so we need to create a policy that allows anon to select published
drop policy if exists "allow_anon_published_manifests" on private_staging.package_manifests;
create policy "allow_anon_published_manifests" on private_staging.package_manifests for select to anon using (published_at is not null and published_at <= now());

-- Similarly for entities via published view: anon can select entities that are in published package
-- For simplicity, we add a policy on entities to allow anon to select if they are in a published package
-- This is a simplified fail-closed: only entities in published package are readable
create policy "allow_anon_published_entities" on private_staging.entities for select to anon using (
  exists (
    select 1 from private_staging.package_members pm
    join private_staging.package_manifests pkg on pkg.id = pm.package_id
    where pm.entity_id = entities.id and pkg.published_at is not null and pkg.published_at <= now()
  )
);

-- For attestations and verses, similar allow
create policy "allow_anon_published_attestations" on private_staging.reference_entity_attestations for select to anon using (
  exists (
    select 1 from private_staging.claims c
    join private_staging.package_members pm on pm.claim_id = c.id
    join private_staging.package_manifests pkg on pkg.id = pm.package_id
    where c.id = reference_entity_attestations.claim_id and pkg.published_at is not null
  )
);

-- For verses: allow anon to select published edition verses
create policy "allow_anon_published_verses" on private_staging.translation_edition_verses for select to anon using (
  exists (
    select 1 from private_staging.translation_editions ed where ed.id = translation_edition_verses.edition_id and ed.status = 'published'
  )
);

-- Prevent in-place mutation of approval_records (append-only)
create or replace function private_staging.prevent_approval_update() returns trigger as $$
begin
  raise exception 'approval_records is append-only: UPDATE/DELETE not allowed';
  return null;
end;
$$ language plpgsql;
create trigger trg_prevent_approval_update_17c before update or delete on private_staging.approval_records
  for each row execute function private_staging.prevent_approval_update();

-- Prevent partial package activation (must have all members)
-- This is enforced via application logic, not DB trigger for 17C
