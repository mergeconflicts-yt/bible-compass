# First MVP Data Model

## Modeling principles

- Use stable canonical Scripture coordinates across translations.
- Separate translation-independent meaning from translation-specific text.
- Use UUID primary keys internally and immutable canonical keys or slugs externally.
- Store timestamps as UTC `timestamptz`.
- Published content is immutable by version.
- Every user-owned row carries `user_id` and is protected by RLS.
- Every content surface can trace important claims to sources and review state.

## Canonical reference

```ts
type VerseCoordinate = {
  book: string;     // OSIS-style code, for example Neh
  chapter: number;  // 1-based
  verse: number;    // 1-based
};

type PassageReference = {
  start: VerseCoordinate;
  end: VerseCoordinate;
};
```

The parser must reject reversed, impossible or unsupported ranges with typed errors.

## Scripture tables

### `bible_books`

- `id uuid primary key`
- `canon text not null`
- `osis_code text unique not null`
- `name text not null`
- `order_index integer not null`

### `translation_licenses`

- `id uuid primary key`
- `name text not null`
- `display_allowed boolean not null`
- `offline_allowed boolean not null`
- `image_sharing_allowed boolean not null`
- `web_excerpt_allowed boolean not null`
- `required_attribution text`
- `territory_rules jsonb`
- `evidence_reference text`
- `status text not null`

### `translations`

One row per language translation. Launch set: English, Telugu, Tamil (see `CANONICAL_IDENTIFIERS.md`).
Each language translation requires its own `translation_licenses` row with independent rights evidence —
a license for English never implies rights for Telugu or Tamil.

- `id uuid primary key`
- `code text unique not null` (unique per language, e.g. `en.<translation-code>`)
- `language_tag text not null` (BCP 47: `en`, `te`, `ta`)
- `name text not null`
- `license_id uuid not null`
- `status text not null`
- Unique: language and code

### `verses`

One full set of rows per `translation_id` (English, Telugu and Tamil verse text is stored, never
machine-translated at read time).

- `id uuid primary key`
- `translation_id uuid not null`
- `book_id uuid not null`
- `chapter integer not null`
- `verse_number integer not null`
- `text text not null`
- `text_hash text not null`
- Unique: translation, book, chapter and verse

### `passages`

- `id uuid primary key`
- `canonical_key text unique not null`
- Start book, chapter and verse
- End book, chapter and verse
- `title text`
- `slug text unique not null`

### `passage_versions`

- `id uuid primary key`
- `passage_id uuid not null`
- `content_version integer not null`
- `locale text not null`
- `status text not null`
- `published_at timestamptz`
- `supersedes_id uuid`
- Unique: passage, locale and content version

## Context tables

### `entities`

Identity only. All human-readable descriptions live in `entity_localizations` so the same
canonical entity (`artaxerxes-i`, `jerusalem`) serves English, Telugu and Tamil.

- `id uuid primary key`
- `type text not null`
- `canonical_name text not null`
- `slug text unique not null`
- Temporal range and precision
- `confidence text not null`
- `review_status text not null`
- `content_version integer not null`

### `entity_localizations`

- `entity_id uuid not null`
- `language_tag text not null` (BCP 47: `en`, `te`, `ta`)
- `display_name text not null`
- `short_description text not null`
- `extended_description text`
- `review_status text not null`
- Unique: entity and language

Supported types initially:

- Person
- Place
- Empire or political entity
- Group
- Role or office
- Object
- Cultural practice
- Important term

### `entity_aliases`

- `entity_id uuid not null`
- `alias text not null`
- `language_tag text`
- Period fields where relevant
- `source_id uuid`

### `passage_contexts`

Holds the source-language (English) orientation row. Localized overrides live in
`passage_context_localizations`. If no approved localization exists for the user's locale,
fallback behavior is `OPEN` (see ADR-001).

- `passage_version_id uuid primary key`
- `who text not null`
- `where_text text not null`
- `when_text text not null`
- `what_text text not null`
- `before_text text not null`
- `stakes_text text not null`
- `immediate_summary text not null`

### `passage_context_localizations`

- `passage_version_id uuid not null` (references `passage_contexts`)
- `language_tag text not null` (BCP 47: `te`, `ta`; English is the source row above)
- `who text not null`
- `where_text text not null`
- `when_text text not null`
- `what_text text not null`
- `before_text text not null`
- `stakes_text text not null`
- `immediate_summary text not null`
- `review_status text not null`
- Unique: passage version and language

### `passage_entities`

- `passage_version_id uuid not null`
- `entity_id uuid not null`
- `role_in_passage text not null`
- `temporal_state text`
- `priority integer not null`
- Unique: passage version and entity

### `verse_anchors`

- `id uuid primary key`
- `translation_id uuid not null`
- `verse_id uuid not null`
- `start_offset integer not null`
- `end_offset integer not null`
- `matched_text text not null`
- `entity_id uuid`
- `context_card_id uuid`
- Exactly one target is required.

Anchor publication validation must verify:

```
verse.text.slice(startOffset, endOffset) === matchedText
```

Offsets from one translation may never be copied to another.

## Timeline and map tables

### `timeline_events`

- `id uuid primary key`
- `canonical_key text unique not null`
- `name text not null`
- Start and end date bounds
- `date_precision text not null`
- `description text not null`
- `confidence text not null`
- `review_status text not null`

### `passage_timeline_events`

- `passage_version_id uuid not null`
- `timeline_event_id uuid not null`
- `relevance text not null`
- `display_order integer not null`
- `display_mode text not null`

### `map_assets`

- `id uuid primary key`
- `canonical_key text unique not null`
- `title text not null`
- `storage_path text not null`
- `mime_type text not null`
- `width integer not null`
- `height integer not null`
- Period fields
- `projection_note text`
- `uncertainty_note text`
- `attribution text not null`
- `accessible_description text not null`
- `review_status text not null`

### `map_hotspots`

- `id uuid primary key`
- `map_asset_id uuid not null`
- `x_normalized numeric not null` between 0 and 1
- `y_normalized numeric not null` between 0 and 1
- `label text not null`
- `description text`
- `entity_id uuid`
- `confidence text not null`

## Sources and review

### `sources`

- `id uuid primary key`
- `source_type text not null`
- `title text not null`
- Author, publisher and edition fields
- `url text`
- `accessed_at date`
- `license text`
- `notes text`

### `content_citations`

- `id uuid primary key`
- `content_type text not null`
- `content_id uuid not null`
- `source_id uuid not null`
- `claim_note text not null`
- `source_location text`

## Publication status

Use explicit states:

`draft -> in_review -> approved -> published -> retired`

Only an explicit controlled operation can move `approved` to `published`.

## Daily verse tables

### `daily_verses`

- `id uuid primary key`
- `local_date date not null`
- `locale text not null`
- `translation_id uuid not null`
- Start and end verse coordinates
- `passage_id uuid not null`
- `moment_text text not null`
- `theme_id uuid not null`
- `status text not null`
- `published_at timestamptz`
- Unique: local date, locale and translation

### `verse_card_themes`

- `id uuid primary key`
- `canonical_key text unique not null`
- Background asset or color configuration
- Overlay configuration
- Text and accent colors
- Font roles
- Safe-area configuration by ratio
- Asset attribution
- `status text not null`

## User tables

### `profiles`

- `user_id uuid primary key`
- `locale text`
- `created_at timestamptz not null`

### `user_preferences`

- `user_id uuid primary key`
- Translation, theme and typography settings
- Notification enabled, time and quiet-hour settings
- `updated_at timestamptz not null`

### `reading_progress`

- `user_id uuid not null`
- `translation_id uuid not null`
- Canonical passage and visible verse coordinates
- `relative_offset numeric`
- `client_updated_at timestamptz not null`
- `server_updated_at timestamptz not null`
- Unique: user and translation

### `bookmarks`

- `id uuid primary key` generated by client
- `user_id uuid not null`
- `translation_id uuid not null`
- Verse range
- `created_at timestamptz not null`
- `updated_at timestamptz not null`
- `deleted_at timestamptz`

### `devices`

- `id uuid primary key`
- `user_id uuid not null`
- `push_token text not null` protected from public reads
- `platform text not null`
- `locale text`
- `timezone text`
- `enabled boolean not null`
- `last_seen_at timestamptz`

## Local SQLite model

Use local equivalents needed by the application, plus:

### `outbox`

- `mutation_id text primary key`
- `entity_type text not null`
- `entity_id text not null`
- `operation text not null`
- `payload text not null`
- `created_at text not null`
- `attempt_count integer not null`
- `last_error_code text`
- `completed_at text`

### `sync_cursors`

- `data_type text primary key`
- `cursor text`
- `updated_at text not null`

### `content_installations`

- `package_key text primary key`
- `content_version integer not null`
- `checksum text not null`
- `installed_at text not null`
- `status text not null`

## Required indexes

- Canonical passage lookup
- Translation, book, chapter and verse lookup
- Published content by status and publication date
- Entity slug and alias search
- Passage-entity and passage-timeline foreign keys
- User ownership and `updated_at` synchronization queries
- Outbox incomplete mutations by creation time
- Downloaded verse full-text search where licensing permits

## Migration rules

- Every schema change is a committed migration.
- Rebuild from an empty database in CI.
- Test upgrade from the previous released schema.
- Avoid destructive migration without a backup and recovery plan.
- Generate database client types in CI, but do not expose row types as domain models
