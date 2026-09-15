-- Migration: 20260914000001_private_registry_init
-- Task 07A — Private operational-registry migration and privileges
-- Scope: Nehemiah 2 slice only; no canonical/public content views
-- Spec: docs/DATA_MODEL.md §2 + §9 approval_records + Task 07 registry contract
-- Prereq: Task 07 handoff docs/handoffs/task-07-registry.json
-- RLS: private_registry.* revoked from public/anon/authenticated; service_role bypasses RLS
-- Recovery: forward-fix by adding new migration; rollback via `supabase db reset` to prior migration (see docs/REGISTRY_MIGRATION_NOTES.md)

-- Enable pgcrypto for gen_random_uuid()
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Schema
-- ---------------------------------------------------------------------------
create schema if not exists private_registry;

-- ---------------------------------------------------------------------------
-- 1. sources (append-only registry of source identities)
-- ---------------------------------------------------------------------------
create table private_registry.sources (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique check (source_key ~ '^source:[a-z0-9:.-]+$'),
  publisher text not null,
  description text,
  created_at timestamptz not null default now()
);
create index if not exists idx_sources_source_key on private_registry.sources (source_key);

-- ---------------------------------------------------------------------------
-- 2. source_releases (immutable bytes + license evidence, digest-bound)
-- ---------------------------------------------------------------------------
create table private_registry.source_releases (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references private_registry.sources(id) on delete restrict,
  release_key text not null unique check (release_key ~ '^release:source:[a-z0-9:.-]+@[a-z0-9._-]+:sha-[0-9a-f]{8,64}$'),
  commit_or_tag text not null check (commit_or_tag <> '' and commit_or_tag not in ('main','master','HEAD') and commit_or_tag !~ '/'),
  artifact_sha256 text not null check (artifact_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  byte_size bigint not null check (byte_size > 0),
  retrieved_at timestamptz not null,
  license_evidence_sha256 text not null check (license_evidence_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  required_attribution text not null,
  status text not null check (status in ('candidate','approved_for_evaluation','rejected','superseded')),
  created_at timestamptz not null default now(),
  unique (source_id, release_key)
);
create index if not exists idx_source_releases_source_id on private_registry.source_releases (source_id);
create index if not exists idx_source_releases_artifact_sha256 on private_registry.source_releases (artifact_sha256);

-- ---------------------------------------------------------------------------
-- 3. source_artifacts (quarantine metadata, no public read)
-- ---------------------------------------------------------------------------
create table private_registry.source_artifacts (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references private_registry.source_releases(id) on delete restrict,
  url text not null,
  media_type text not null,
  byte_size bigint not null check (byte_size > 0),
  sha256 text not null check (sha256 ~ '^sha256:[0-9a-f]{64}$'),
  quarantine_path text not null check (quarantine_path like 'content/quarantine/%'),
  created_at timestamptz not null default now()
);
create index if not exists idx_source_artifacts_release_id on private_registry.source_artifacts (release_id);

-- ---------------------------------------------------------------------------
-- 4. rights_components (per-component license, pathsOrFields explicit)
-- ---------------------------------------------------------------------------
create table private_registry.rights_components (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references private_registry.source_releases(id) on delete restrict,
  component_key text not null check (component_key ~ '^[a-z0-9:_-]+$'),
  paths_or_fields jsonb not null check (jsonb_array_length(paths_or_fields) > 0),
  license_spdx text not null,
  license_evidence_url text,
  license_evidence_sha256 text not null check (license_evidence_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  required_attribution text,
  created_at timestamptz not null default now(),
  unique (release_id, component_key)
);

-- ---------------------------------------------------------------------------
-- 5. operation_grants (fail-closed: unknown = denied, expiry/territory/language limits)
-- ---------------------------------------------------------------------------
create table private_registry.operation_grants (
  id uuid primary key default gen_random_uuid(),
  component_id uuid not null references private_registry.rights_components(id) on delete restrict,
  operation text not null check (operation in ('evaluation_import','drafting','publication','external_ai_processing','embedding')),
  state text not null default 'unknown' check (state in ('allowed','denied','unknown')),
  territory text,
  language_tag text check (language_tag in ('en','te','ta')),
  effective_from date,
  effective_to date,
  provenance text not null,
  created_at timestamptz not null default now(),
  check (effective_from is null or effective_to is null or effective_from <= effective_to)
);
create index if not exists idx_operation_grants_component_id on private_registry.operation_grants (component_id);

-- ---------------------------------------------------------------------------
-- 6. approval_records (append-only, digest-bound, authenticated actor)
-- ---------------------------------------------------------------------------
create table private_registry.approval_records (
  id uuid primary key default gen_random_uuid(),
  subject_key text not null,
  subject_digest text not null check (subject_digest ~ '^sha256:[0-9a-f]{64}$'),
  subject_revision integer check (subject_revision > 0),
  reviewer_id text not null,
  reviewer_role text not null check (reviewer_role in ('product_owner','rights_reviewer','editorial_reviewer')),
  decision text not null check (decision in ('approved','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists idx_approval_records_subject_key on private_registry.approval_records (subject_key);
create index if not exists idx_approval_records_subject_digest on private_registry.approval_records (subject_digest);

-- ---------------------------------------------------------------------------
-- 7. audit_receipts (authorization evaluation audit, one per attempt)
-- ---------------------------------------------------------------------------
create table private_registry.audit_receipts (
  id uuid primary key default gen_random_uuid(),
  receipt_key text not null unique check (receipt_key ~ '^audit:[a-z0-9-]+$'),
  attempt_id text not null,
  request_digest text not null check (request_digest ~ '^sha256:[0-9a-f]{64}$'),
  release_digest text not null check (release_digest ~ '^sha256:[0-9a-f]{64}$'),
  decision text not null check (decision in ('allowed','denied')),
  reason text not null,
  evaluated_at timestamptz not null default now(),
  grants_digest text not null check (grants_digest ~ '^sha256:[0-9a-f]{64}$'),
  approvals_digest text not null check (approvals_digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 8. raw_records (source-specific staging, preserved raw)
-- ---------------------------------------------------------------------------
create table private_registry.raw_records (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references private_registry.source_artifacts(id) on delete restrict,
  upstream_id text not null,
  raw_payload jsonb not null,
  ingested_at timestamptz not null default now()
);
create index if not exists idx_raw_records_artifact_id on private_registry.raw_records (artifact_id);
create index if not exists idx_raw_records_upstream_id on private_registry.raw_records (upstream_id);

-- ---------------------------------------------------------------------------
-- 9. import_runs (row counts, checksums)
-- ---------------------------------------------------------------------------
create table private_registry.import_runs (
  id uuid primary key default gen_random_uuid(),
  release_id uuid not null references private_registry.source_releases(id) on delete restrict,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  row_count integer check (row_count >= 0),
  rejected_row_count integer check (rejected_row_count >= 0),
  checksum text not null check (checksum ~ '^sha256:[0-9a-f]{64}$')
);

-- ---------------------------------------------------------------------------
-- 10. external_mappings (source-local → canonical crosswalk, non-destructive)
-- ---------------------------------------------------------------------------
create table private_registry.external_mappings (
  id uuid primary key default gen_random_uuid(),
  source_key text not null check (source_key ~ '^source:[a-z0-9:.-]+$'),
  release_id uuid not null references private_registry.source_releases(id) on delete restrict,
  upstream_kind text not null,
  upstream_id text not null,
  canonical_entity_id uuid,
  mapping_state text not null check (mapping_state in ('exact','probable','possible','distinct','unresolved','composite','split')),
  evidence jsonb not null,
  created_at timestamptz not null default now(),
  unique (source_key, release_id, upstream_kind, upstream_id)
);
create index if not exists idx_external_mappings_source_key on private_registry.external_mappings (source_key, release_id, upstream_kind, upstream_id);

-- ---------------------------------------------------------------------------
-- 11. findings (rejected rows, ambiguous identity, unmapped reference)
-- ---------------------------------------------------------------------------
create table private_registry.findings (
  id uuid primary key default gen_random_uuid(),
  import_run_id uuid not null references private_registry.import_runs(id) on delete restrict,
  code text not null,
  severity text not null check (severity in ('blocking','warning','info')),
  payload jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists idx_findings_import_run_id on private_registry.findings (import_run_id);

-- ---------------------------------------------------------------------------
-- RLS: private only — revoke public, enable RLS, no policies for anon/authenticated
-- service_role bypasses RLS (Supabase default). This satisfies docs/SECURITY.md:55-65
-- ---------------------------------------------------------------------------
-- Enable RLS on every private_registry table
alter table private_registry.sources enable row level security;
alter table private_registry.source_releases enable row level security;
alter table private_registry.source_artifacts enable row level security;
alter table private_registry.rights_components enable row level security;
alter table private_registry.operation_grants enable row level security;
alter table private_registry.approval_records enable row level security;
alter table private_registry.audit_receipts enable row level security;
alter table private_registry.raw_records enable row level security;
alter table private_registry.import_runs enable row level security;
alter table private_registry.external_mappings enable row level security;
alter table private_registry.findings enable row level security;

-- Revoke all on private_registry schema and tables from public/anon/authenticated
revoke all on schema private_registry from public, anon, authenticated;
revoke all on all tables in schema private_registry from public, anon, authenticated;

-- Explicit deny policies for anon/authenticated (defense-in-depth; even if RLS enabled with no policy, they deny)
-- For approval_records, enforce append-only: no UPDATE/DELETE for anyone except service_role bypass
create policy "deny_all_anon_authenticated_sources" on private_registry.sources for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_source_releases" on private_registry.source_releases for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_source_artifacts" on private_registry.source_artifacts for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_rights_components" on private_registry.rights_components for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_operation_grants" on private_registry.operation_grants for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_raw_records" on private_registry.raw_records for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_import_runs" on private_registry.import_runs for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_external_mappings" on private_registry.external_mappings for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_findings" on private_registry.findings for all to anon, authenticated using (false) with check (false);

-- Approval records: append-only — allow INSERT only via service_role (bypasses RLS), deny SELECT/UPDATE/DELETE for anon/authenticated
create policy "deny_all_anon_authenticated_approval_records" on private_registry.approval_records for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_audit_receipts" on private_registry.audit_receipts for all to anon, authenticated using (false) with check (false);

-- Additional immutable guard: prevent UPDATE/DELETE via trigger for non-service_role
-- (service_role bypasses RLS, so trigger only fires for non-bypass roles)
create or replace function private_registry.prevent_approval_mutation() returns trigger as $$
begin
  raise exception 'approval_records is append-only: UPDATE/DELETE not allowed (Task 07A)';
  return null;
end;
$$ language plpgsql;

create trigger trg_prevent_approval_update before update or delete on private_registry.approval_records
  for each row execute function private_registry.prevent_approval_mutation();

create trigger trg_prevent_audit_update before update or delete on private_registry.audit_receipts
  for each row execute function private_registry.prevent_approval_mutation();

-- Prevent mutation of published release artifact_sha256 (immutability hint; full immutability enforced via supersedes_id in later tasks)
-- For now, ensure no UPDATE on source_releases.artifact_sha256 via trigger
create or replace function private_registry.prevent_release_mutation() returns trigger as $$
begin
  if old.artifact_sha256 is distinct from new.artifact_sha256 or old.release_key is distinct from new.release_key then
    raise exception 'source_releases is immutable: release_key/artifact_sha256 cannot be updated';
  end if;
  return new;
end;
$$ language plpgsql;
create trigger trg_prevent_release_mutation before update on private_registry.source_releases
  for each row execute function private_registry.prevent_release_mutation();
