-- Migration: 20260915000003_knowledge_claim_context
-- Task 17B — Knowledge, claim, and context staging migrations
-- Spec: docs/DATA_MODEL.md §5-§8, Gate D PASSED, 17A DONE
-- Scope: private_staging entities/names, claims, attestations, mentions, relevance, relationships, events, places, context
-- RLS: private only

create extension if not exists postgis;

-- ---------------------------------------------------------------------------
-- 1. entities
-- ---------------------------------------------------------------------------
create table private_staging.entities (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^entity:[a-z0-9-]+$'),
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  type text not null check (type in ('person','place','collective','polity','role','object','structure','practice','institution','theme','event')),
  identification_status text not null check (identification_status in ('established','traditional','proposed','disputed','unknown')),
  provenance text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 2. entity_names
-- ---------------------------------------------------------------------------
create table private_staging.entity_names (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references private_staging.entities(id) on delete restrict,
  language_tag text not null check (language_tag in ('en','te','ta')),
  form text not null,
  normalized_form text not null,
  kind text not null check (kind in ('preferred','alias','title','epithet','transliteration')),
  source_claim_id uuid,
  created_at timestamptz not null default now(),
  unique (entity_id, language_tag, normalized_form)
);
create index idx_entity_names_normalized on private_staging.entity_names (normalized_form);

-- ---------------------------------------------------------------------------
-- 3. entity_descriptions
-- ---------------------------------------------------------------------------
create table private_staging.entity_descriptions (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references private_staging.entities(id) on delete restrict,
  locale text not null check (locale in ('en','te','ta')),
  revision integer not null check (revision > 0),
  short_desc text not null,
  extended_desc text,
  source_locale text not null default 'en',
  review_state text not null check (review_state in ('draft','in_review','approved','published')),
  created_at timestamptz not null default now(),
  unique (entity_id, locale, revision)
);

-- ---------------------------------------------------------------------------
-- 4. claims
-- ---------------------------------------------------------------------------
create table private_staging.claims (
  id uuid primary key default gen_random_uuid(),
  key text not null unique check (key ~ '^claim:[a-z0-9-]+$'),
  subject_type text not null check (subject_type in ('entity','scope','event','place','text','date','geometry')),
  subject_id uuid not null,
  predicate text not null,
  object_type text not null check (object_type in ('entity','scope','text','number','date_range','geometry','controlled')),
  object jsonb not null,
  evidence_status text not null check (evidence_status in ('established','probable','possible','disputed','unknown')),
  textual_basis text not null check (textual_basis in ('explicit','strongly_implied','inferred','disputed')),
  date_precision text check (date_precision in ('exact','range','decade','century','unknown')),
  location_precision text check (location_precision in ('exact_site','approximate','area','candidates','unknown')),
  review_state text not null check (review_state in ('draft','in_review','approved','published')),
  supersedes_id uuid references private_staging.claims(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index idx_claims_subject on private_staging.claims (subject_type, subject_id);

-- ---------------------------------------------------------------------------
-- 5. claim_citations
-- ---------------------------------------------------------------------------
create table private_staging.claim_citations (
  id uuid primary key default gen_random_uuid(),
  claim_id uuid not null references private_staging.claims(id) on delete restrict,
  source_release_id uuid not null,
  source_edition_id uuid references private_staging.translation_editions(id) on delete restrict,
  locator text not null,
  support_kind text not null check (support_kind in ('supports','qualifies','disputes','background')),
  digest text not null check (digest ~ '^sha256:[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
create index idx_claim_citations_claim on private_staging.claim_citations (claim_id);

-- ---------------------------------------------------------------------------
-- 6. relationship_predicates (controlled vocab)
-- ---------------------------------------------------------------------------
create table private_staging.relationship_predicates (
  key text primary key check (key ~ '^[a-z:_-]+$'),
  inverse text,
  symmetric boolean not null default false,
  created_at timestamptz not null default now()
);
insert into private_staging.relationship_predicates (key, inverse, symmetric) values
  ('served_as', 'held_by', false),
  ('family_of', 'family_of', true),
  ('ruled', 'ruled_by', false),
  ('located_in', 'contains', false),
  ('member_of', 'has_member', false)
on conflict (key) do nothing;

-- ---------------------------------------------------------------------------
-- 7. entity_relationship_assertions
-- ---------------------------------------------------------------------------
create table private_staging.entity_relationship_assertions (
  id uuid primary key default gen_random_uuid(),
  subject_entity_id uuid not null references private_staging.entities(id) on delete restrict,
  predicate text not null references private_staging.relationship_predicates(key) on delete restrict,
  object_entity_id uuid not null references private_staging.entities(id) on delete restrict,
  scope_id uuid references private_staging.scripture_scopes(id) on delete restrict,
  temporal_qualifier jsonb,
  place_qualifier jsonb,
  certainty text not null check (certainty in ('established','probable','possible','disputed','unknown')),
  created_at timestamptz not null default now(),
  check (subject_entity_id <> object_entity_id)
);

-- ---------------------------------------------------------------------------
-- 8. reference_entity_attestations (translation-independent, canonical)
-- ---------------------------------------------------------------------------
create table private_staging.reference_entity_attestations (
  id uuid primary key default gen_random_uuid(),
  entity_id uuid not null references private_staging.entities(id) on delete restrict,
  scope_id uuid not null references private_staging.scripture_scopes(id) on delete restrict,
  reference_unit_id uuid not null references private_staging.reference_units(id) on delete restrict,
  kind text not null check (kind in ('primary_subject','participant','location','topic','genealogical_member','implied_referent','disputed_referent')),
  explicitness text not null check (explicitness in ('explicit','strongly_implied','inferred','disputed')),
  claim_id uuid not null references private_staging.claims(id) on delete restrict,
  review_state text not null check (review_state in ('draft','in_review','approved','published')),
  created_at timestamptz not null default now(),
  unique (entity_id, scope_id, reference_unit_id, kind)
);
create index idx_attestations_entity_scope on private_staging.reference_entity_attestations (entity_id, scope_id);

-- ---------------------------------------------------------------------------
-- 9. edition_mentions (edition-specific surface)
-- ---------------------------------------------------------------------------
create table private_staging.edition_mentions (
  id uuid primary key default gen_random_uuid(),
  edition_id uuid not null references private_staging.translation_editions(id) on delete restrict,
  verse_id uuid not null references private_staging.translation_edition_verses(id) on delete restrict,
  entity_id uuid references private_staging.entities(id) on delete restrict,
  context_card_id uuid,
  form text not null check (form in ('explicit_name','alias','title','pronoun','indirect','collective','unnamed')),
  quote text not null,
  occurrence_ordinal integer not null check (occurrence_ordinal > 0),
  pipeline_text_sha256 text not null check (pipeline_text_sha256 ~ '^sha256:[0-9a-f]{64}$'),
  review_state text not null check (review_state in ('draft','in_review','approved','published')),
  created_at timestamptz not null default now(),
  check ((entity_id is not null)::int + (context_card_id is not null)::int = 1)
);
create index idx_edition_mentions_edition_verse on private_staging.edition_mentions (edition_id, verse_id);

-- ---------------------------------------------------------------------------
-- 10. edition_render_spans
-- ---------------------------------------------------------------------------
create table private_staging.edition_render_spans (
  mention_id uuid primary key references private_staging.edition_mentions(id) on delete restrict,
  start_grapheme integer not null check (start_grapheme >= 0),
  end_grapheme integer not null check (end_grapheme > start_grapheme),
  start_utf16 integer not null check (start_utf16 >= 0),
  end_utf16 integer not null check (end_utf16 > start_utf16),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 11. scope_entity_relevance
-- ---------------------------------------------------------------------------
create table private_staging.scope_entity_relevance (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references private_staging.scripture_scopes(id) on delete restrict,
  entity_id uuid not null references private_staging.entities(id) on delete restrict,
  role_in_passage text not null,
  importance text not null check (importance in ('central','supporting','background')),
  is_attested boolean not null,
  created_at timestamptz not null default now(),
  unique (scope_id, entity_id)
);
create index idx_scope_relevance_scope on private_staging.scope_entity_relevance (scope_id);

-- ---------------------------------------------------------------------------
-- 12. scope_entity_relevance_localizations
-- ---------------------------------------------------------------------------
create table private_staging.scope_entity_relevance_localizations (
  scope_id uuid not null references private_staging.scripture_scopes(id) on delete restrict,
  entity_id uuid not null references private_staging.entities(id) on delete restrict,
  locale text not null check (locale in ('te','ta')),
  explanation text not null,
  review_state text not null check (review_state in ('draft','in_review','approved','published')),
  created_at timestamptz not null default now(),
  primary key (scope_id, entity_id, locale)
);

-- ---------------------------------------------------------------------------
-- 13. events (entity subtype)
-- ---------------------------------------------------------------------------
create table private_staging.events (
  entity_id uuid primary key references private_staging.entities(id) on delete restrict,
  event_kind text not null,
  start_date jsonb,
  end_date jsonb,
  chronology_system text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 14. event_participants
-- ---------------------------------------------------------------------------
create table private_staging.event_participants (
  event_id uuid not null references private_staging.events(entity_id) on delete restrict,
  entity_id uuid not null references private_staging.entities(id) on delete restrict,
  role text not null,
  claim_id uuid references private_staging.claims(id) on delete restrict,
  primary key (event_id, entity_id, role)
);

-- ---------------------------------------------------------------------------
-- 15. event_places
-- ---------------------------------------------------------------------------
create table private_staging.event_places (
  event_id uuid not null references private_staging.events(entity_id) on delete restrict,
  place_id uuid not null references private_staging.entities(id) on delete restrict,
  role text,
  claim_id uuid references private_staging.claims(id) on delete restrict,
  primary key (event_id, place_id)
);

-- ---------------------------------------------------------------------------
-- 16. event_scripture_accounts
-- ---------------------------------------------------------------------------
create table private_staging.event_scripture_accounts (
  event_id uuid not null references private_staging.events(entity_id) on delete restrict,
  scope_id uuid not null references private_staging.scripture_scopes(id) on delete restrict,
  relation text not null check (relation in ('reports','recalls','anticipates','interprets','alludes')),
  claim_id uuid references private_staging.claims(id) on delete restrict,
  primary key (event_id, scope_id)
);

-- ---------------------------------------------------------------------------
-- 17. places + place_geometries (entity subtype)
-- ---------------------------------------------------------------------------
create table private_staging.place_geometries (
  entity_id uuid primary key references private_staging.entities(id) on delete restrict,
  geometry geometry(Point,4326),
  crs text not null,
  precision text not null check (precision in ('exact_site','approximate','area','candidates','unknown')),
  period tstzrange,
  evidence_claim_id uuid references private_staging.claims(id) on delete restrict,
  component_license text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- 18. context_artifacts / revisions / sections / localizations
-- ---------------------------------------------------------------------------
create table private_staging.context_artifacts (
  id uuid primary key default gen_random_uuid(),
  scope_id uuid not null references private_staging.scripture_scopes(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique (scope_id)
);

create table private_staging.context_revisions (
  id uuid primary key default gen_random_uuid(),
  artifact_id uuid not null references private_staging.context_artifacts(id) on delete restrict,
  revision integer not null check (revision > 0),
  created_at timestamptz not null default now(),
  unique (artifact_id, revision)
);

create table private_staging.context_sections (
  id uuid primary key default gen_random_uuid(),
  revision_id uuid not null references private_staging.context_revisions(id) on delete restrict,
  kind text not null check (kind in ('who','where','when','what','before','stakes','immediate_summary')),
  text text not null,
  claim_ids uuid[] not null,
  created_at timestamptz not null default now()
);

create table private_staging.context_section_localizations (
  revision_id uuid not null references private_staging.context_revisions(id) on delete restrict,
  kind text not null check (kind in ('who','where','when','what','before','stakes','immediate_summary')),
  locale text not null check (locale in ('te','ta')),
  text text not null,
  review_state text not null check (review_state in ('draft','in_review','approved','published')),
  created_at timestamptz not null default now(),
  primary key (revision_id, kind, locale)
);

-- ---------------------------------------------------------------------------
-- RLS: private only
-- ---------------------------------------------------------------------------
alter table private_staging.entities enable row level security;
alter table private_staging.entity_names enable row level security;
alter table private_staging.entity_descriptions enable row level security;
alter table private_staging.claims enable row level security;
alter table private_staging.claim_citations enable row level security;
alter table private_staging.relationship_predicates enable row level security;
alter table private_staging.entity_relationship_assertions enable row level security;
alter table private_staging.reference_entity_attestations enable row level security;
alter table private_staging.edition_mentions enable row level security;
alter table private_staging.edition_render_spans enable row level security;
alter table private_staging.scope_entity_relevance enable row level security;
alter table private_staging.scope_entity_relevance_localizations enable row level security;
alter table private_staging.events enable row level security;
alter table private_staging.event_participants enable row level security;
alter table private_staging.event_places enable row level security;
alter table private_staging.event_scripture_accounts enable row level security;
alter table private_staging.place_geometries enable row level security;
alter table private_staging.context_artifacts enable row level security;
alter table private_staging.context_revisions enable row level security;
alter table private_staging.context_sections enable row level security;
alter table private_staging.context_section_localizations enable row level security;

revoke all on all tables in schema private_staging from public, anon, authenticated;

create policy "deny_all_entities" on private_staging.entities for all to anon, authenticated using (false) with check (false);
create policy "deny_all_entity_names" on private_staging.entity_names for all to anon, authenticated using (false) with check (false);
create policy "deny_all_entity_descriptions" on private_staging.entity_descriptions for all to anon, authenticated using (false) with check (false);
create policy "deny_all_claims" on private_staging.claims for all to anon, authenticated using (false) with check (false);
create policy "deny_all_claim_citations" on private_staging.claim_citations for all to anon, authenticated using (false) with check (false);
create policy "deny_all_relationship_predicates" on private_staging.relationship_predicates for all to anon, authenticated using (false) with check (false);
create policy "deny_all_entity_relationship_assertions" on private_staging.entity_relationship_assertions for all to anon, authenticated using (false) with check (false);
create policy "deny_all_attestations" on private_staging.reference_entity_attestations for all to anon, authenticated using (false) with check (false);
create policy "deny_all_edition_mentions" on private_staging.edition_mentions for all to anon, authenticated using (false) with check (false);
create policy "deny_all_edition_render_spans" on private_staging.edition_render_spans for all to anon, authenticated using (false) with check (false);
create policy "deny_all_scope_relevance" on private_staging.scope_entity_relevance for all to anon, authenticated using (false) with check (false);
create policy "deny_all_scope_relevance_localizations" on private_staging.scope_entity_relevance_localizations for all to anon, authenticated using (false) with check (false);
create policy "deny_all_events" on private_staging.events for all to anon, authenticated using (false) with check (false);
create policy "deny_all_event_participants" on private_staging.event_participants for all to anon, authenticated using (false) with check (false);
create policy "deny_all_event_places" on private_staging.event_places for all to anon, authenticated using (false) with check (false);
create policy "deny_all_event_scripture_accounts" on private_staging.event_scripture_accounts for all to anon, authenticated using (false) with check (false);
create policy "deny_all_place_geometries" on private_staging.place_geometries for all to anon, authenticated using (false) with check (false);
create policy "deny_all_context_artifacts" on private_staging.context_artifacts for all to anon, authenticated using (false) with check (false);
create policy "deny_all_context_revisions" on private_staging.context_revisions for all to anon, authenticated using (false) with check (false);
create policy "deny_all_context_sections" on private_staging.context_sections for all to anon, authenticated using (false) with check (false);
create policy "deny_all_context_section_localizations" on private_staging.context_section_localizations for all to anon, authenticated using (false) with check (false);
