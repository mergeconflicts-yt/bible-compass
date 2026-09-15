-- Migration: 20260915000002_canon_reference_edition
-- Task 17A — Canon/reference/edition staging migrations
-- Spec: docs/DATA_MODEL.md §3-§4, Gate D PASSED gate-D-v1-20260915T060000Z (P1 fixed)
-- Scope: private_staging canon, reference_systems, works, units, mappings, scopes, translation_works/editions/verses
-- RLS: private only — revoke public/anon/authenticated, service_role bypasses

create schema if not exists private_staging;

-- ---------------------------------------------------------------------------
-- 1. canons
-- ---------------------------------------------------------------------------
create table private_staging.canons (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key = 'canon:prot-66'),
  name text not null,
  status text not null default 'active' check (status in ('active','retired')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. scripture_works (books)
-- ---------------------------------------------------------------------------
create table private_staging.scripture_works (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^work:[A-Za-z1-9]+:prot-66$'),
  osis_code text not null unique,
  name text not null,
  testament text not null check (testament in ('OT','NT')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 3. canon_work_memberships
-- ---------------------------------------------------------------------------
create table private_staging.canon_work_memberships (
  canon_id uuid not null references private_staging.canons(id) on delete restrict,
  work_id uuid not null references private_staging.scripture_works(id) on delete restrict,
  order_index integer not null,
  primary key (canon_id, work_id),
  unique (canon_id, order_index)
);

-- ---------------------------------------------------------------------------
-- 4. reference_systems
-- ---------------------------------------------------------------------------
create table private_staging.reference_systems (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^refsys:(eng|tel|tam)-v[0-9]+$'),
  canon_id uuid not null references private_staging.canons(id) on delete restrict,
  version integer not null check (version > 0),
  status text not null check (status in ('active','draft','retired')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 5. reference_units
-- ---------------------------------------------------------------------------
create table private_staging.reference_units (
  id uuid primary key default gen_random_uuid(),
  reference_system_id uuid not null references private_staging.reference_systems(id) on delete restrict,
  local_key text not null,
  work_id uuid not null references private_staging.scripture_works(id) on delete restrict,
  chapter_label text not null,
  verse_label text,
  kind text not null check (kind in ('book','chapter','verse','segment')),
  ordinal integer not null,
  created_at timestamptz not null default now(),
  unique (reference_system_id, local_key),
  unique (reference_system_id, ordinal)
);
create index idx_ref_units_refsys_local on private_staging.reference_units (reference_system_id, local_key);
create index idx_ref_units_work on private_staging.reference_units (work_id);

-- ---------------------------------------------------------------------------
-- 6. reference_mappings
-- ---------------------------------------------------------------------------
create table private_staging.reference_mappings (
  id uuid primary key default gen_random_uuid(),
  from_refsys text not null,
  from_unit text not null,
  to_refsys text not null,
  to_unit text not null,
  kind text not null check (kind in ('equivalent','split','merge','overlap','renumbered','omitted','added','uncertain')),
  evidence_claim_id uuid,
  review_state text not null check (review_state in ('draft','in_review','approved','published')),
  created_at timestamptz not null default now()
);
create index idx_ref_mappings_from on private_staging.reference_mappings (from_refsys, from_unit);
create index idx_ref_mappings_to on private_staging.reference_mappings (to_refsys, to_unit);

-- ---------------------------------------------------------------------------
-- 7. scripture_scopes
-- ---------------------------------------------------------------------------
create table private_staging.scripture_scopes (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^scope:[a-z0-9-]+:refsys:[a-z0-9-]+:.+$'),
  reference_system_id uuid not null references private_staging.reference_systems(id) on delete restrict,
  kind text not null check (kind in ('chapter','pericope','book','section')),
  start_unit_id uuid not null references private_staging.reference_units(id) on delete restrict,
  end_unit_id uuid not null references private_staging.reference_units(id) on delete restrict,
  display_name text not null,
  certainty text not null check (certainty in ('established','probable','disputed','unknown')),
  created_at timestamptz not null default now(),
  check (start_unit_id <> end_unit_id or kind = 'chapter')
);

-- ---------------------------------------------------------------------------
-- 8. scope_members (for non-contiguous)
-- ---------------------------------------------------------------------------
create table private_staging.scope_members (
  scope_id uuid not null references private_staging.scripture_scopes(id) on delete restrict,
  unit_id uuid not null references private_staging.reference_units(id) on delete restrict,
  position integer not null,
  primary key (scope_id, unit_id)
);

-- ---------------------------------------------------------------------------
-- 9. translation_works
-- ---------------------------------------------------------------------------
create table private_staging.translation_works (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^trans:(bsb|tel_irv|tam_irv)$'),
  language_tag text not null check (language_tag in ('en','te','ta')),
  name text not null,
  publisher text not null,
  created_at timestamptz not null default now(),
  unique (language_tag, key)
);

-- ---------------------------------------------------------------------------
-- 10. translation_editions (immutable)
-- ---------------------------------------------------------------------------
create table private_staging.translation_editions (
  id uuid primary key default gen_random_uuid(),
  work_id uuid not null references private_staging.translation_works(id) on delete restrict,
  key text not null unique check (key ~ '^edition:(bsb|tel_irv|tam_irv)@[0-9]+:sha-[0-9a-f]{8}$'),
  language_tag text not null check (language_tag in ('en','te','ta')),
  reference_system_id uuid not null references private_staging.reference_systems(id) on delete restrict,
  revision_date date not null,
  source_artifact_sha256 text not null check (source_artifact_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  attribution text not null,
  supersedes_id uuid references private_staging.translation_editions(id) on delete restrict,
  status text not null check (status in ('draft','approved','published','retired')),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. translation_edition_verses (immutable text, one row per verse per edition)
-- ---------------------------------------------------------------------------
create table private_staging.translation_edition_verses (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references private_staging.translation_editions(id) on delete restrict,
  reference_unit_id uuid not null references private_staging.reference_units(id) on delete restrict,
  book_id uuid not null references private_staging.scripture_works(id) on delete restrict,
  chapter integer not null check (chapter > 0),
  verse_number integer not null check (verse_number >= 0),
  text text not null,
  text_sha256 text not null check (text_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz not null default now(),
  unique (edition_id, reference_unit_id),
  unique (edition_id, book_id, chapter, verse_number)
);
create index idx_edition_verses_edition_book_chapter on private_staging.translation_edition_verses (edition_id, book_id, chapter, verse_number);

-- ---------------------------------------------------------------------------
-- RLS: private only
-- ---------------------------------------------------------------------------
alter table private_staging.canons enable row level security;
alter table private_staging.scripture_works enable row level security;
alter table private_staging.canon_work_memberships enable row level security;
alter table private_staging.reference_systems enable row level security;
alter table private_staging.reference_units enable row level security;
alter table private_staging.reference_mappings enable row level security;
alter table private_staging.scripture_scopes enable row level security;
alter table private_staging.scope_members enable row level security;
alter table private_staging.translation_works enable row level security;
alter table private_staging.translation_editions enable row level security;
alter table private_staging.translation_edition_verses enable row level security;

revoke all on schema private_staging from public, anon, authenticated;
revoke all on all tables in schema private_staging from public, anon, authenticated;

create policy "deny_all_anon_authenticated_canons" on private_staging.canons for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_scripture_works" on private_staging.scripture_works for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_canon_work_memberships" on private_staging.canon_work_memberships for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_reference_systems" on private_staging.reference_systems for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_reference_units" on private_staging.reference_units for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_reference_mappings" on private_staging.reference_mappings for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_scripture_scopes" on private_staging.scripture_scopes for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_scope_members" on private_staging.scope_members for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_translation_works" on private_staging.translation_works for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_translation_editions" on private_staging.translation_editions for all to anon, authenticated using (false) with check (false);
create policy "deny_all_anon_authenticated_translation_edition_verses" on private_staging.translation_edition_verses for all to anon, authenticated using (false) with check (false);

-- Immutability: prevent update of published editions/verses
create or replace function private_staging.prevent_published_mutation() returns trigger as $$
begin
  if old.status = 'published' then
    raise exception 'translation_editions is immutable when status=published';
  end if;
  return new;
end;
$$ language plpgsql;
create trigger trg_prevent_published_edition_update before update on private_staging.translation_editions
  for each row execute function private_staging.prevent_published_mutation();

-- Prevent update of verse text (immutable)
create trigger trg_prevent_verse_update before update or delete on private_staging.translation_edition_verses
  for each row execute function private_staging.prevent_published_mutation();
