-- Migration: 20260916000018_external_ids_and_predicate_ontology
-- Findings 24 and 26.
--
-- 1. Structured external identifiers. Source IDs were embedded in canonical
--    keys/slugs with no mapping table, so downstream consumers could not tell
--    which source (and which row) an identity came from, nor carry the
--    evidence. entity_external_ids records (source, external_id, evidence)
--    per entity. It does not change the canonical key: de-embedding IDs from
--    keys is a breaking rename that needs its own migration + owner sign-off.
-- 2. Controlled relationship-predicate ontology. The predicates table is
--    seeded from content/curation/relationship-ontology.json; the importer and
--    validators reject any predicate outside the ontology, so a package can no
--    longer introduce predicates dynamically.
--
-- Additive; drafts only.

-- ---------------------------------------------------------------------------
-- 1. entity_external_ids
-- ---------------------------------------------------------------------------
create table if not exists private_staging.entity_external_ids (
  entity_id uuid not null references private_staging.entities(id) on delete restrict,
  source text not null,
  external_id text not null,
  label text,
  evidence_key text,
  created_at timestamptz not null default now(),
  primary key (entity_id, source, external_id)
);
create index if not exists idx_entity_external_ids_external
  on private_staging.entity_external_ids (source, external_id);

alter table private_staging.entity_external_ids enable row level security;
revoke all on private_staging.entity_external_ids from public, anon, authenticated;
create policy deny_all_entity_external_ids on private_staging.entity_external_ids
  for all to anon, authenticated using (false) with check (false);

-- ---------------------------------------------------------------------------
-- 2. Seed the controlled predicate ontology (mirrors
--    content/curation/relationship-ontology.json — keep them in sync).
-- ---------------------------------------------------------------------------
insert into private_staging.relationship_predicates (key, inverse, is_symmetric) values
  ('relationship:son', 'relationship:father', false),
  ('relationship:father', 'relationship:son', false),
  ('relationship:mother', 'relationship:son', false),
  ('relationship:daughter', 'relationship:father', false),
  ('relationship:brother', 'relationship:brother', true),
  ('relationship:sister', 'relationship:sister', true),
  ('relationship:half-brother', 'relationship:half-brother', true),
  ('relationship:half-sister', 'relationship:half-sister', true),
  ('relationship:husband', 'relationship:wife', false),
  ('relationship:wife', 'relationship:husband', false),
  ('relationship:ancestor', 'relationship:descendant', false),
  ('relationship:descendant', 'relationship:ancestor', false),
  ('relationship:grandfather', 'relationship:grandson', false),
  ('relationship:grandmother', 'relationship:granddaughter', false),
  ('relationship:grandson', 'relationship:grandfather', false),
  ('relationship:granddaughter', 'relationship:grandmother', false),
  ('relationship:uncle', 'relationship:nephew', false),
  ('relationship:aunt', 'relationship:nephew', false),
  ('relationship:nephew', 'relationship:uncle', false),
  ('relationship:cousin', 'relationship:cousin', true),
  ('relationship:son-in-law', 'relationship:father-in-law', false),
  ('relationship:daughter-in-law', 'relationship:mother-in-law', false),
  ('relationship:father-in-law', 'relationship:son-in-law', false),
  ('relationship:mother-in-law', 'relationship:daughter-in-law', false),
  ('relationship:brother-in-law', 'relationship:brother-in-law', true),
  ('relationship:sister-in-law', 'relationship:sister-in-law', true),
  ('relationship:concubine', null, false),
  ('relationship:servant', 'relationship:master', false),
  ('relationship:master', 'relationship:servant', false),
  ('relationship:disciple', 'relationship:rabbi', false),
  ('relationship:rabbi', 'relationship:disciple', false),
  ('relationship:apostle', null, false),
  ('relationship:patron', 'relationship:client', false),
  ('relationship:client', 'relationship:patron', false),
  ('relationship:ally', 'relationship:ally', true),
  ('relationship:opposes', 'relationship:opposes', true),
  ('relationship:army-commander', null, false),
  ('relationship:army-captain', null, false),
  ('relationship:chief', null, false),
  ('relationship:chief-official', null, false),
  ('relationship:lieutenant', null, false),
  ('relationship:officer', null, false),
  ('relationship:chamberlain', null, false),
  ('relationship:holds_role', null, false),
  ('relationship:serves', null, false),
  ('relationship:rules', null, false),
  ('relationship:governs', null, false),
  ('relationship:provides', null, false),
  ('relationship:keeper_of', null, false),
  ('relationship:original-heir', null, false),
  ('relationship:original-inheritor', null, false),
  ('relationship:killer', 'relationship:victim', false),
  ('relationship:killed-by', null, false),
  ('relationship:victim', 'relationship:killer', false),
  ('relationship:exiled', null, false),
  ('relationship:exiled-by', null, false),
  ('relationship:located_in', null, false),
  ('relationship:part_of', null, false)
on conflict (key) do nothing;
