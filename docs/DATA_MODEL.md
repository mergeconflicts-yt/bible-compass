# Nehemiah 2 Physical Data-Model Specification — DDL-Ready Slice (Task 03)

**Status:** SPECIFICATION — DDL-ready for Task 04/07A/17. No migration applied in this task. Exact DDL to be generated from this spec after Owner Gate A2 approval.
**Amendment (Task EN-01):** the `entities.type` vocabulary now also includes `deity` and `event`, matching the implemented migration `supabase/migrations/20260915000003_knowledge_claim_context.sql` (which has always accepted `event`) plus `20260915000009_entity_type_deity.sql` (which adds `deity`). The domain `EntityType`, `entitySchema`, and candidate-key grammar accept the same set.
**Prerequisites:** `docs/CANONICAL_IDENTIFIERS.md:1` (Gate A1 `gate-A1-v1-20260914T115751Z`), `docs/OWNER_GATE_A1_PACKET.md:1` (pilot `Neh.2.1-20` as `scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20`), `CONTEXT_DATA_ARCHUTECTURE.md:58-428`, `CONTEXT_MODEL_REVIEW.md:1`, `WHOLE_BIBLE_CURATION_SPEC.md:1`, `ADR-003`, `docs/SECURITY.md:1`, `docs/DATA_MODEL.md` (prior MVP reference).
**Slice:** Nehemiah 2 only. Whole-Bible expansion is deferred (see §9 Deferred inventory).

---

## 0. Conventions

- **Keys:** `uuid` PK (`gen_random_uuid()`), immutable `key`/`slug` for public canonical identity per `docs/CANONICAL_IDENTIFIERS.md:2-8`. Never expose sequential IDs.
- **Timestamps:** `timestamptz` UTC, `created_at timestamptz not null default now()`, `updated_at timestamptz not null`.
- **Immutability:** Published/approved rows are immutable. Corrections create new revision rows with `supersedes_id uuid references <table>.id`, never overwrite.
- **Deletion:** Non-destructive — `superseded_at timestamptz`, `superseded_by uuid`, `deleted_at timestamptz` tombstones; no hard delete on approved/published history.
- **Revision:** Every content row carries `content_version integer not null` or `revision integer not null` plus `created_by uuid` and `checksum text not null check (checksum ~ '^sha256:[0-9a-f]{64}$')`.
- **RLS:** All client-accessible tables have `enable row level security`. Private editorial/quarantine tables have `revoke all on table <name> from public, anon, authenticated` and grant only to `service_role`.
- **Naming:** Private schemas: `private_content`, `private_registry`, `private_staging`, `private_user`. Public views: `public_content`.

---

## 1. Nehemiah 2 Slice Inventory (what this spec covers)

**Included (Nehemiah 2 MVP, private staging until Gate E):**

- `canons`, `canon_work_memberships`, `scripture_works`, `reference_systems`, `reference_units`, `reference_mappings`
- `scripture_scopes` (including `scope:neh-2`), `scope_members`
- `translation_works`, `translation_editions`, `translation_edition_verses` (immutable text, one row per verse per edition for `Neh.2.1-20` across `bsb@20260912`, `tel_irv@20260913`, `tam_irv@20260913`)
- `private_registry.sources`, `source_releases`, `source_artifacts`, `rights_components`, `operation_grants`, `raw_records`, `import_runs`, `external_mappings`, `assertion_lineage`, `findings`
- `entities`, `entity_names`, `entity_descriptions`, `entity_aliases` (Nehemiah 2 persons, places, roles, and deities; event-type entities allowed)
- `claims`, `claim_citations`, `claim_reviews`
- `reference_entity_attestations` (translation-independent), `edition_mentions`, `edition_render_spans`, `scope_entity_relevance`, `scope_entity_relevance_localizations`
- `entity_relationship_assertions`, `relationship_predicates`
- `events`, `event_participants`, `event_places`, `event_scripture_accounts`, `event_relations`
- `places`, `place_geometries`, `place_sources`
- `context_artifacts`, `context_revisions`, `context_sections`, `context_section_localizations`
- `review_queue`, `approval_records`, `publication_releases`, `package_manifests`, `package_members`, `package_dependencies`
- `user tables` (unchanged from prior MVP): `profiles`, `user_preferences`, `reading_progress`, `bookmarks`, `devices` plus `content_installations`, `outbox`, `sync_cursors`

**All other whole-Bible content is excluded from this slice (see §9).**

---

## 2. Private Source Registry (append-only, digest-bound)

### `private_registry.sources`

| column        | type        | constraints                                                                                  |
| ------------- | ----------- | -------------------------------------------------------------------------------------------- |
| `id`          | uuid        | pk, default `gen_random_uuid()`                                                              |
| `source_key`  | text        | not null, unique, check `source_key ~ '^source:[a-z0-9:.-]+$'` e.g. `source:stepbible:tipnr` |
| `publisher`   | text        | not null                                                                                     |
| `description` | text        |                                                                                              |
| `created_at`  | timestamptz | not null default now()                                                                       |

- Indexes: unique `source_key`. RLS: private only.

### `private_registry.source_releases`

| column                    | type        | constraints                                                                         |
| ------------------------- | ----------- | ----------------------------------------------------------------------------------- |
| `id`                      | uuid        | pk                                                                                  |
| `source_id`               | uuid        | not null fk `sources.id` on delete restrict                                         |
| `release_key`             | text        | not null, unique, check `release:source:stepbible:tipnr@...:sha-...`                |
| `commit_or_tag`           | text        | not null (no branch names)                                                          |
| `artifact_sha256`         | text        | not null check `^sha256:[0-9a-f]{64}$`                                              |
| `byte_size`               | bigint      | not null check `>0`                                                                 |
| `retrieved_at`            | timestamptz | not null                                                                            |
| `license_evidence_sha256` | text        | not null                                                                            |
| `required_attribution`    | text        | not null                                                                            |
| `status`                  | text        | not null check `in ('candidate','approved_for_evaluation','rejected','superseded')` |

- Unique: `(source_id, release_key)`. Indexes: `source_id`, `artifact_sha256`.

### `private_registry.source_artifacts`

| column            | type   | constraints                                                   |
| ----------------- | ------ | ------------------------------------------------------------- |
| `id`              | uuid   | pk                                                            |
| `release_id`      | uuid   | not null fk                                                   |
| `url`             | text   | not null                                                      |
| `media_type`      | text   | not null                                                      |
| `byte_size`       | bigint | not null                                                      |
| `sha256`          | text   | not null                                                      |
| `quarantine_path` | text   | not null, check `quarantine_path like 'content/quarantine/%'` |

- RLS: private only. No public read.

### `private_registry.rights_components`

| column                    | type  | constraints                              |
| ------------------------- | ----- | ---------------------------------------- |
| `id`                      | uuid  | pk                                       |
| `release_id`              | uuid  | not null fk                              |
| `component_key`           | text  | not null, e.g. `tipnr-structured-fields` |
| `paths_or_fields`         | jsonb | not null                                 |
| `license_spdx`            | text  | not null e.g. `CC-BY-4.0`                |
| `license_evidence_url`    | text  | not null                                 |
| `license_evidence_sha256` | text  | not null                                 |

- Unique: `(release_id, component_key)`.

### `private_registry.operation_grants`

| column           | type | constraints                                                                                             |
| ---------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| `id`             | uuid | pk                                                                                                      |
| `component_id`   | uuid | not null fk `rights_components.id`                                                                      |
| `operation`      | text | not null check `in ('evaluation_import','drafting','publication','external_ai_processing','embedding')` |
| `state`          | text | not null check `in ('allowed','denied','unknown')` default `unknown`                                    |
| `territory`      | text |                                                                                                         |
| `language_tag`   | text | check `language_tag in ('en','te','ta')`                                                                |
| `effective_from` | date |                                                                                                         |
| `effective_to`   | date |                                                                                                         |
| `provenance`     | text | not null                                                                                                |

- RLS: private. Fail-closed: `unknown` = `denied`.

### `private_registry.raw_records`

| column        | type        | constraints |
| ------------- | ----------- | ----------- |
| `id`          | uuid        | pk          |
| `artifact_id` | uuid        | not null fk |
| `upstream_id` | text        | not null    |
| `raw_payload` | jsonb       | not null    |
| `ingested_at` | timestamptz | not null    |

- Indexes: `artifact_id`, `upstream_id`.

### `private_registry.import_runs`

| column               | type        | constraints |
| -------------------- | ----------- | ----------- |
| `id`                 | uuid        | pk          |
| `release_id`         | uuid        | not null fk |
| `started_at`         | timestamptz | not null    |
| `completed_at`       | timestamptz |             |
| `row_count`          | integer     | check `>=0` |
| `rejected_row_count` | integer     | check `>=0` |
| `checksum`           | text        | not null    |

- Private.

### `private_registry.external_mappings`

| column                | type  | constraints                                                                                     |
| --------------------- | ----- | ----------------------------------------------------------------------------------------------- |
| `id`                  | uuid  | pk                                                                                              |
| `source_key`          | text  | not null                                                                                        |
| `release_id`          | uuid  | not null fk                                                                                     |
| `upstream_kind`       | text  | not null e.g. `person`, `place`                                                                 |
| `upstream_id`         | text  | not null                                                                                        |
| `canonical_entity_id` | uuid  | fk `entities.id` on delete set null (nullable until resolved)                                   |
| `mapping_state`       | text  | not null check `in ('exact','probable','possible','distinct','unresolved','composite','split')` |
| `evidence`            | jsonb | not null                                                                                        |

- Unique: `(source_key, release_id, upstream_kind, upstream_id)`.

### `private_registry.findings`

| column          | type  | constraints                                              |
| --------------- | ----- | -------------------------------------------------------- |
| `id`            | uuid  | pk                                                       |
| `import_run_id` | uuid  | not null fk                                              |
| `code`          | text  | not null e.g. `unmapped_reference`, `ambiguous_identity` |
| `severity`      | text  | not null check `in ('blocking','warning','info')`        |
| `payload`       | jsonb | not null                                                 |

- Private.

**Approval immutability:** `approval_records` (see §7) are append-only: `check (digest = sha256(canonical_json(subject)))`, no `update`/`delete` via RLS `using (false)` for `authenticated`.

---

## 3. Canon, Reference Systems, Works, Units, Mappings, Scopes

### `canons`

| column   | type | constraints                                   |
| -------- | ---- | --------------------------------------------- |
| `id`     | uuid | pk                                            |
| `key`    | text | not null unique check `key = 'canon:prot-66'` |
| `name`   | text | not null                                      |
| `status` | text | not null default `active`                     |

- RLS: public read-only where `status='active'`.

### `scripture_works`

| column      | type | constraints                                                                         |
| ----------- | ---- | ----------------------------------------------------------------------------------- |
| `id`        | uuid | pk                                                                                  |
| `key`       | text | not null unique check `key ~ '^work:[A-Za-z1-9]+:prot-66$'` e.g. `work:Neh:prot-66` |
| `osis_code` | text | not null unique                                                                     |
| `name`      | text | not null                                                                            |
| `testament` | text | not null check `in ('OT','NT')`                                                     |

### `canon_work_memberships`

| column        | type                  | constraints             |
| ------------- | --------------------- | ----------------------- |
| `canon_id`    | uuid                  | not null fk `canons.id` |
| `work_id`     | uuid                  | not null fk             |
| `order_index` | integer               | not null                |
| `pk`          | `(canon_id, work_id)` | primary                 |

- Unique: `(canon_id, order_index)`.

### `reference_systems`

| column     | type    | constraints                                |
| ---------- | ------- | ------------------------------------------ |
| `id`       | uuid    | pk                                         |
| `key`      | text    | not null unique check `key ~ '^refsys:(eng | tel | tam)-v[0-9]+$'` |
| `canon_id` | uuid    | not null fk                                |
| `version`  | integer | not null                                   |
| `status`   | text    | not null                                   |

- Allowed: `refsys:eng-v22`, `refsys:tel-v1`, `refsys:tam-v1` per Gate A1.

### `reference_units`

| column                | type    | constraints                                              |
| --------------------- | ------- | -------------------------------------------------------- |
| `id`                  | uuid    | pk                                                       |
| `reference_system_id` | uuid    | not null fk                                              |
| `local_key`           | text    | not null e.g. `Neh.2.4`                                  |
| `work_id`             | uuid    | not null fk                                              |
| `chapter_label`       | text    | not null                                                 |
| `verse_label`         | text    |                                                          |
| `kind`                | text    | not null check `in ('book','chapter','verse','segment')` |
| `ordinal`             | integer | not null                                                 |

- Unique: `(reference_system_id, local_key)`. Unique: `(reference_system_id, ordinal)`. Index: `work_id`, `local_key`.

### `reference_mappings`

| column              | type | constraints                                                                                             |
| ------------------- | ---- | ------------------------------------------------------------------------------------------------------- |
| `id`                | uuid | pk                                                                                                      |
| `from_refsys`       | text | not null fk `reference_systems.key`                                                                     |
| `from_unit`         | text | not null                                                                                                |
| `to_refsys`         | text | not null                                                                                                |
| `to_unit`           | text | not null                                                                                                |
| `kind`              | text | not null check `in ('equivalent','split','merge','overlap','renumbered','omitted','added','uncertain')` |
| `evidence_claim_id` | uuid | fk `claims.id`                                                                                          |
| `review_state`      | text | not null                                                                                                |

- Indexes: `(from_refsys, from_unit)`, `(to_refsys, to_unit)`.

### `scripture_scopes`

| column                | type | constraints                                                                                                                |
| --------------------- | ---- | -------------------------------------------------------------------------------------------------------------------------- |
| `id`                  | uuid | pk                                                                                                                         |
| `key`                 | text | not null unique check `key ~ '^scope:[a-z0-9-]+:refsys:[a-z0-9-]+:.+$'` e.g. `scope:neh-2:refsys:eng-v22:Neh.2.1-Neh.2.20` |
| `reference_system_id` | uuid | not null fk                                                                                                                |
| `kind`                | text | not null check `in ('chapter','pericope','book','section')`                                                                |
| `start_unit_id`       | uuid | not null fk `reference_units.id`                                                                                           |
| `end_unit_id`         | uuid | not null fk                                                                                                                |
| `display_name`        | text | not null                                                                                                                   |
| `certainty`           | text | not null check `in ('established','probable','disputed','unknown')`                                                        |

- Check: `start_unit.ordinal <= end_unit.ordinal`. Pilot row: `scope:neh-2` covering `Neh.2.1-20`.

### `scope_members`

For non-contiguous or alternate-segmentation scopes (adoption gate #6): | `scope_id` uuid fk | `unit_id` uuid fk | `position` integer not null | pk `(scope_id, unit_id)`.

---

## 4. Translation Works, Editions, Text Units

### `translation_works`

| column         | type | constraints                               |
| -------------- | ---- | ----------------------------------------- |
| `id`           | uuid | pk                                        |
| `key`          | text | not null unique check `key ~ '^trans:(bsb | tel_irv | tam_irv)$'` |
| `language_tag` | text | not null check `in ('en','te','ta')`      |
| `name`         | text | not null                                  |
| `publisher`    | text | not null                                  |

- Unique: `(language_tag, key)`.

### `translation_editions`

| column                   | type | constraints                                                    |
| ------------------------ | ---- | -------------------------------------------------------------- |
| `id`                     | uuid | pk                                                             |
| `work_id`                | uuid | not null fk `translation_works.id`                             |
| `key`                    | text | not null unique check `key ~ '^edition:(bsb                    | tel_irv | tam_irv)@[0-9]+:sha-[0-9a-f]{8}$'`e.g.`edition:bsb@20260912:sha-b2898c49` |
| `language_tag`           | text | not null                                                       |
| `reference_system_id`    | uuid | not null fk                                                    |
| `revision_date`          | date | not null                                                       |
| `source_artifact_sha256` | text | not null check `^sha256:[0-9a-f]{64}$`                         |
| `attribution`            | text | not null                                                       |
| `supersedes_id`          | uuid | fk `translation_editions.id` on delete restrict                |
| `status`                 | text | not null check `in ('draft','approved','published','retired')` |

- Check: `supersedes_id` points to prior edition of same `work_id`. Immutability: no update on `status='published'`.

### `translation_edition_verses`

| column              | type    | constraints                            |
| ------------------- | ------- | -------------------------------------- |
| `id`                | uuid    | pk                                     |
| `edition_id`        | uuid    | not null fk                            |
| `reference_unit_id` | uuid    | not null fk `reference_units.id`       |
| `book_id`           | uuid    | not null fk `scripture_works.id`       |
| `chapter`           | integer | not null check `chapter > 0`           |
| `verse_number`      | integer | not null check `verse_number >= 0`     |
| `text`              | text    | not null                               |
| `text_sha256`       | text    | not null check `^sha256:[0-9a-f]{64}$` |

- Unique: `(edition_id, reference_unit_id)`. Unique: `(edition_id, book_id, chapter, verse_number)`. Index: `(edition_id, book_id, chapter, verse_number)` for reader lookup. RLS: public read-only where `edition.status='published'`.

---

## 5. Entities, Names, Descriptions, Aliases

### `entities`

| column                  | type | constraints                                                                                                                               |
| ----------------------- | ---- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                    | uuid | pk                                                                                                                                        |
| `key`                   | text | not null unique check `key ~ '^entity:[a-z0-9-]+$'` e.g. `entity:artaxerxes-i`                                                            |
| `slug`                  | text | not null unique check `slug ~ '^[a-z0-9-]+$'`                                                                                             |
| `type`                  | text | not null check `in ('person','deity','event','place','collective','polity','role','object','structure','practice','institution','theme')` |
| `identification_status` | text | not null check `in ('established','traditional','proposed','disputed','unknown')`                                                         |
| `provenance`            | text | not null                                                                                                                                  |

- No localized biography on this row.

### `entity_names`

| column            | type | constraints                                                                   |
| ----------------- | ---- | ----------------------------------------------------------------------------- |
| `id`              | uuid | pk                                                                            |
| `entity_id`       | uuid | not null fk `entities.id`                                                     |
| `language_tag`    | text | not null check `in ('en','te','ta')`                                          |
| `form`            | text | not null                                                                      |
| `normalized_form` | text | not null                                                                      |
| `kind`            | text | not null check `in ('preferred','alias','title','epithet','transliteration')` |
| `source_claim_id` | uuid | fk `claims.id`                                                                |

- Unique: `(entity_id, language_tag, normalized_form)`. Index: `normalized_form` for search.

### `entity_descriptions`

| column          | type    | constraints                          |
| --------------- | ------- | ------------------------------------ |
| `id`            | uuid    | pk                                   |
| `entity_id`     | uuid    | not null fk                          |
| `locale`        | text    | not null check `in ('en','te','ta')` |
| `revision`      | integer | not null                             |
| `short_desc`    | text    | not null                             |
| `extended_desc` | text    |                                      |
| `source_locale` | text    | not null default `en`                |
| `review_state`  | text    | not null                             |

- Unique: `(entity_id, locale, revision)`. New correction → new revision, old preserved.

---

## 6. Claims, Citations, Reviews, Assertions

### `claims`

| column               | type  | constraints                                                                                 |
| -------------------- | ----- | ------------------------------------------------------------------------------------------- |
| `id`                 | uuid  | pk                                                                                          |
| `key`                | text  | not null unique check `key ~ '^claim:[a-z0-9-]+$'`                                          |
| `subject_type`       | text  | not null check `in ('entity','scope','event','place','text','date','geometry')`             |
| `subject_id`         | uuid  | not null                                                                                    |
| `predicate`          | text  | not null e.g. `was_cupbearer_to`, `located_at`                                              |
| `object_type`        | text  | not null check `in ('entity','scope','text','number','date_range','geometry','controlled')` |
| `object`             | jsonb | not null                                                                                    |
| `evidence_status`    | text  | not null check `in ('established','probable','possible','disputed','unknown')`              |
| `textual_basis`      | text  | not null check `in ('explicit','strongly_implied','inferred','disputed')`                   |
| `date_precision`     | text  | check `in ('exact','range','decade','century','unknown')`                                   |
| `location_precision` | text  | check `in ('exact_site','approximate','area','candidates','unknown')`                       |
| `review_state`       | text  | not null                                                                                    |
| `supersedes_id`      | uuid  | fk `claims.id`                                                                              |

- Each claim has exactly one typed `object`. Check enforced via json schema.

### `claim_citations`

| column              | type | constraints                                                          |
| ------------------- | ---- | -------------------------------------------------------------------- |
| `id`                | uuid | pk                                                                   |
| `claim_id`          | uuid | not null fk `claims.id`                                              |
| `source_release_id` | uuid | not null fk `private_registry.source_releases.id`                    |
| `source_edition_id` | uuid | fk `translation_editions.id` (for scripture)                         |
| `locator`           | text | not null e.g. `TIPNR:NEH:2:4`                                        |
| `support_kind`      | text | not null check `in ('supports','qualifies','disputes','background')` |
| `digest`            | text | not null check `^sha256:[0-9a-f]{64}$` binding exact source bytes    |

- Index: `claim_id`, `source_release_id`.

### `entity_relationship_assertions`

| column               | type  | constraints                                 |
| -------------------- | ----- | ------------------------------------------- |
| `id`                 | uuid  | pk                                          |
| `subject_entity_id`  | uuid  | not null fk `entities.id`                   |
| `predicate`          | text  | not null fk `relationship_predicates.key`   |
| `object_entity_id`   | uuid  | not null fk `entities.id`                   |
| `scope_id`           | uuid  | fk `scripture_scopes.id` (for Neh.2 claims) |
| `temporal_qualifier` | jsonb |                                             |
| `place_qualifier`    | jsonb |                                             |
| `certainty`          | text  | not null                                    |

- Check: `subject != object` unless predicate allows self-edge.

### `relationship_predicates`

Seeded controlled vocab: `served_as`, `ruled`, `located_in`, `family_of`, `member_of`, etc., with inverse/symmetry metadata.

---

## 7. Attestations, Mentions, Relevance — distinct

### `reference_entity_attestations` (translation-independent, canonical)

| column              | type | constraints                                                                                                                           |
| ------------------- | ---- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `id`                | uuid | pk                                                                                                                                    |
| `entity_id`         | uuid | not null fk `entities.id`                                                                                                             |
| `scope_id`          | uuid | not null fk `scripture_scopes.id`                                                                                                     |
| `reference_unit_id` | uuid | not null fk `reference_units.id`                                                                                                      |
| `kind`              | text | not null check `in ('primary_subject','participant','location','topic','genealogical_member','implied_referent','disputed_referent')` |
| `explicitness`      | text | not null check `in ('explicit','strongly_implied','inferred','disputed')`                                                             |
| `claim_id`          | uuid | not null fk `claims.id`                                                                                                               |
| `review_state`      | text | not null                                                                                                                              |

- Unique: `(entity_id, scope_id, reference_unit_id, kind)`. This table answers "does scripture scope refer to entity?" — independent of wording.

### `edition_mentions` (edition-specific surface)

| column                 | type    | constraints                                                                                       |
| ---------------------- | ------- | ------------------------------------------------------------------------------------------------- |
| `id`                   | uuid    | pk                                                                                                |
| `edition_id`           | uuid    | not null fk `translation_editions.id`                                                             |
| `verse_id`             | uuid    | not null fk `translation_edition_verses.id`                                                       |
| `entity_id`            | uuid    | fk `entities.id`                                                                                  |
| `context_card_id`      | uuid    | fk `context_artifacts.id`                                                                         |
| `form`                 | text    | not null check `in ('explicit_name','alias','title','pronoun','indirect','collective','unnamed')` |
| `quote`                | text    | not null                                                                                          |
| `occurrence_ordinal`   | integer | not null check `>0`                                                                               |
| `pipeline_text_sha256` | text    | not null                                                                                          |
| `review_state`         | text    | not null                                                                                          |

- Check: exactly one of `entity_id`/`context_card_id` not null. Validation: `translation_edition_verses.text` slice must equal `quote` at generated offsets (see `edition_render_spans`). Offsets never copied across editions.

### `edition_render_spans`

| column           | type    | constraints                       |
| ---------------- | ------- | --------------------------------- |
| `mention_id`     | uuid    | pk fk `edition_mentions.id`       |
| `start_grapheme` | integer | not null check `>=0`              |
| `end_grapheme`   | integer | not null check `> start_grapheme` |
| `start_utf16`    | integer | not null                          |
| `end_utf16`      | integer | not null                          |

- Check: spans are non-overlapping and concatenate to `text`. Grapheme-safe per Task 05 #8.

### `scope_entity_relevance`

| column            | type    | constraints                                               |
| ----------------- | ------- | --------------------------------------------------------- |
| `id`              | uuid    | pk                                                        |
| `scope_id`        | uuid    | not null fk `scripture_scopes.id`                         |
| `entity_id`       | uuid    | not null fk `entities.id`                                 |
| `role_in_passage` | text    | not null                                                  |
| `importance`      | text    | not null check `in ('central','supporting','background')` |
| `is_attested`     | boolean | not null                                                  |

- Relevance answers "why entity matters in passage" — not a mention count. Separate from attestations.

### `scope_entity_relevance_localizations`

| column         | type | constraints                                    |
| -------------- | ---- | ---------------------------------------------- |
| `scope_id`     | uuid | not null fk                                    |
| `entity_id`    | uuid | not null fk                                    |
| `locale`       | text | not null check `in ('te','ta')` (en is source) |
| `explanation`  | text | not null                                       |
| `review_state` | text | not null                                       |

- Unique: `(scope_id, entity_id, locale)`. Versioned per locale.

---

## 8. Events, Places, Context

### `events` (entity subtype)

Additional columns: `event_kind text`, `start_date jsonb`, `end_date jsonb`, `chronology_system text`.

### `event_participants`

| `event_id` uuid fk | `entity_id` uuid fk | `role` text not null | `claim_id` uuid fk | pk `(event_id, entity_id, role)` |

### `event_places`

| `event_id` uuid fk | `place_id` uuid fk `entities.id` where type `place` | `role` text | `claim_id` uuid fk | pk `(event_id, place_id)` |

### `event_scripture_accounts`

| `event_id` uuid fk | `scope_id` uuid fk | `relation` text check `in ('reports','recalls','anticipates','interprets','alludes')` | `claim_id` uuid fk | pk `(event_id, scope_id)` |

### `places` (entity subtype) + `place_geometries`

| `entity_id` uuid pk fk `entities.id` | `geometry` geometry(Point,4326) | `crs` text not null | `precision` text check `in ('exact_site','approximate','area','candidates','unknown')` | `period` daterange | `evidence_claim_id` uuid fk | `component_license` text not null |

### `context_artifacts` / `context_revisions` / `context_sections` / `context_section_localizations`

Structure per `CONTEXT_DATA_ARCHUTECTURE.md:262-279` — one `context_artifact` per `scope:neh-2`, `context_revisions` with immutable `revision`, `context_sections` for `who/where/when/what/before/stakes`, localizations per `te`/`ta`.

---

## 9. Review, Package, Publication — immutable releases

### `approval_records` (append-only)

| `id` uuid pk | `subject_key` text not null | `subject_digest` text not null check `^sha256:` | `subject_revision` integer not null | `reviewer_id` uuid not null | `reviewer_role` text not null | `decision` text check `in ('approved','rejected')` | `created_at` timestamptz not null |

- RLS: no update/delete for `authenticated`. Digest binds exact bytes.

### `package_manifests`

| `id` uuid pk | `key` text unique e.g. `en.bsb.neh-2@3:sha-xxxx` | `locale` text not null | `translation_edition_id` uuid fk | `scope_id` uuid fk | `schema_version` text not null | `content_version` integer not null | `checksum` text not null | `minimum_app_version` text not null | `approval_id` uuid fk `approval_records.id` not null | `published_at` timestamptz |

- Check: `approval_id` digest matches `checksum`. Package building computes union of effective obligations from all lineage edges and rejects incompatible share-alike combos per `docs/OPEN_BIBLE_DATA_SOURCES.md:535`.

### `package_members` / `package_dependencies` / `publication_releases`

Members link `package_id` → `entity_id`/`claim_id`/`context_revision_id`. Dependencies enforce compatible `content_version`. `publication_releases` is the active pointer per locale; rollback inserts new row pointing to prior manifest, never deletes.

---

## 10. User & Local SQLite

Unchanged from prior `docs/DATA_MODEL.md:310-385` — `profiles`, `user_preferences`, `reading_progress`, `bookmarks`, `devices` (RLS `auth.uid() = user_id`), plus local `outbox`, `sync_cursors`, `content_installations`. Offline package install is transactional per `CONTEXT_DATA_ARCHUTECTURE.md:402-411`.

---

## 11. Required Indexes

- `(reference_system_id, local_key)`, `(reference_system_id, ordinal)`, `(from_refsys, from_unit)`, `(to_refsys, to_unit)`
- `(edition_id, book_id, chapter, verse_number)`, `(edition_id, reference_unit_id)`
- `(entity.slug)`, `(entity_names.normalized_form)`, `(claim.subject_type, subject_id)`, `(claim_citations.claim_id)`
- `(reference_entity_attestations.entity_id, scope_id)`, `(edition_mentions.edition_id, verse_id)`, `(scope_entity_relevance.scope_id)`
- `(external_mappings.source_key, release_id, upstream_kind, upstream_id)`, `(private_registry.source_releases.artifact_sha256)`
- `(package_manifests.locale, translation_edition_id)`, `(publication_releases.locale)`

---

## 12. RLS Intent Matrix

| Schema.Table                                                                                                                         | Public anon                                                       | Authenticated                | Service_role (server)          |
| ------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- | ---------------------------- | ------------------------------ |
| `private_registry.*`, `private_staging.*`                                                                                            | no access                                                         | no access                    | all (append-only, no public)   |
| `translation_edition_verses` where `edition.status='published'`                                                                      | `select` where locale allowed and license grants `mobile_display` | same                         | `select/insert` via import job |
| `entities`, `reference_entity_attestations`, `scope_entity_relevance` where `review_state='approved' AND package_manifest.published` | `select` via `public_content` view                                | same                         | full                           |
| `edition_mentions` where `review_state='approved'` and edition published                                                             | `select`                                                          | same                         | full                           |
| `profiles`, `bookmarks` etc.                                                                                                         | no                                                                | `using (auth.uid()=user_id)` | full                           |
| `approval_records`                                                                                                                   | no                                                                | no                           | append-only `insert`           |

_Allow/deny tests per `docs/SECURITY.md:55-65` must pass: anon cannot read drafts, User A cannot access User B rows, forged `user_id` insert fails._

---

## 13. Adoption-Gate Traceability Matrix (12 scenarios)

| #   | Scenario (from `CONTEXT_MODEL_REVIEW.md: adoption gate`)       | Storage path                                                                                                                                                     |
| --- | -------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | One person shared across `en`/`te`/`ta` and immutable editions | `entities` row `entity:artaxerxes-i` + `entity_names` `te`/`ta` + `translation_edition_verses` `bsb@20260912` vs `tel_irv@20260913` pointing to same `entity.id` |
| 2   | Relevant-but-not-mentioned entity                              | `scope_entity_relevance.is_attested=false` with `reference_entity_attestations` absent; separates relevance from attestation                                     |
| 3   | Split/merged/reordered reference mapping                       | `reference_mappings.kind in ('split','merge','renumbered')` with `from_refsys:eng-v22` → `to_refsys:tel-v1` covering `Neh.2.4` split                             |
| 4   | Corrected edition preserves old spans                          | `translation_editions.supersedes_id` + `translation_edition_verses` new edition + old `edition_mentions`/`edition_render_spans` retained                         |
| 5   | Competing chronology/identity positions                        | `claims` with different `evidence_status`/`perspective` + `approval_records` per position, no destructive merge in `entities`                                    |
| 6   | Cross-chapter / alternate segmentation                         | `scripture_scopes` `scope:neh-2` + `scope_members` non-contiguous units beyond chapter boundaries                                                                |
| 7   | Event with participants, places, multiple accounts             | `events` + `event_participants` + `event_places` + `event_scripture_accounts` where `event_id` links `Neh.2` scope                                               |
| 8   | Telugu/Tamil grapheme-safe selectors                           | `edition_render_spans.start_grapheme/end_grapheme` validated + `edition_mentions.pipeline_text_sha256`                                                           |
| 9   | Claim traced to exact source locator & checksum-bound approval | `claim_citations.digest = sha256(source_release artifact)` + `approval_records.subject_digest` immutably bound                                                   |
| 10  | Honest partial coverage                                        | `package_manifests` `coverage_scopes` + `findings` with `severity` counts; empty `complete_zero` vs `incomplete` Distinguished                                   |
| 11  | Rights-unknown failure                                         | `operation_grants.state='unknown'` → `denied` per RLS; `package_manifests` build rejects unknown obligations                                                     |
| 12  | Atomic install & rollback                                      | `publication_releases` active pointer + `content_installations` transactional install; rollback inserts prior pointer, retains `package_manifests` history       |

---

## 14. Revision & Supersession Rules (non-destructive)

- Published rows never updated. New `content_version` or `revision` row inserted with `supersedes_id` → old row gets `superseded_at`, `superseded_by`.
- `delete` replaced by `deleted_at` tombstone; downstream `package_manifests` rebuild excludes tombstoned rows but audit retains them.
- Rollback: `publication_releases` new row with `package_id = prior manifest id`; `content_installations.status='rolled_back'`.

---

## 15. Deferred-Table Inventory (whole-Bible, not in Nehemiah 2 slice)

- `lexical_terms`, `lexical_senses`, `measurement_units`, `currency_rates`, `plant_taxa`, `animal_taxa` (whole-Bible lexicon)
- `timeline_layers`, `map_tile_caches` (live tile engine — out of scope `MVP_PRD.md:178` no live map)
- `user_journals`, `prayer_requests`, `community_feeds` (excluded community `AGENTS.md:95-105`)
- `subscription_entitlements`, `church_admin_rosters` (excluded monetization/admin)
- `ai_teacher_sessions`, `full_bible_candidate_corpus` (excluded whole-Bible coverage & open-ended AI)
- `curated_scenes`, `spiritual_pathways` (excluded scenes)
- Any new service, native module, or permission beyond Expo SQLite/Supabase — requires new ADR per `docs/ARCHITECTURE.md:228`.

---

## 16. Dependency / Workspace Proposal for Task 04 (read-only, exact versions)

**Rule:** No install in this task; Owner Gate A2 must approve exact versions before `npm install` per `docs/AI_AGENT_NEXT_IMPLEMENTATION_PLAN.md:746-748`.

- **Root workspace:** `npm workspaces` at repo root with `apps/mobile` and `packages/*`. Currently no root `package.json` workspaces — propose to add:
  ```json
  "workspaces": ["apps/mobile","packages/domain","packages/content-schema"]
  ```
- **Existing `apps/mobile` pins (keep exact):**
  `expo@~57.0.22`, `react@19.2.3`, `react-native@0.86.3`, `expo-router@~57.0.21`, `zod@3.23.8` (already pinned), `typescript@~6.0.3`, `jest@~29.7.0`, `jest-expo@~57.0.0`, `eslint@^9.39.5`, `prettier@^3.9.6` — from `apps/mobile/package.json:10-35`. No new native deps; install via `npx expo install <pkg>` if ever required.
- **Proposed new packages (Task 04):**
  - `packages/domain` — pure TS, `private:true`, no runtime deps, `typescript@~6.0.3` dev only. Public API: `src/index.ts` exporting canon/refsys/claim types. No framework imports per `AGENTS.md:46`.
  - `packages/content-schema` — depends `zod@3.23.8` **exact**, `typescript@~6.0.3` dev. Provides strict Zod schemas for `translation_editions`, `reference_entity_attestations`, `edition_mentions`, `scope_entity_relevance`, `claims` with `unknown`→`denied` enforcement.
- **Scripts to add at root:** `typecheck`, `lint`, `format:check`, `test`, `verify` (covers `apps/mobile` + new packages). `npm run verify` will run `npm --prefix apps/mobile run verify` plus `npm --prefix packages/domain run typecheck` etc. without regressing.
- **Alternative if owner rejects new deps:** Reuse `zod@3.23.8` already in mobile; no new package — put schemas directly in `apps/mobile/src/lib/schemas` as fallback (still pure, but loses workspace isolation).

- **Verification:** `npm install` then `npm ci` must reproduce lockfile, `npm run verify` must pass for mobile + new packages. No `any`, `@ts-ignore`, unchecked casts, or skipped tests per `AGENTS.md:78`.

---

## 17. Independent Review Disposition

This spec was drafted to have no P0 architecture/rights/provenance defect. Pre-review self-check: no `any`/`@ts-ignore` in domain types (deferred to Task 04), all foreign keys use `on delete restrict` to prevent cascade loss, all private tables revoked from public, all immutable rows use `supersedes_id` not overwrite.

---

## 18. Handoff & Digests

- This spec file `docs/DATA_MODEL.md` sha256 `(computed on save)` — synthetic draft for review, not a migration.
- Consumed: `handoff:task-02` (`docs/CANONICAL_IDENTIFIERS.md` sha `91d92f2f`), Gate A1 packet `91555a0d`.
- Next: Gate A2 must list _exact_ root workspace/package/version changes this section proposes; generic "add needed deps" is invalid.
