/**
 * Versioned SQLite schema registry (mobile-install-01).
 *
 * This module has no runtime imports (only a type-only import, fully erased
 * on emit) so the SQL can be compiled standalone and validated against a
 * real SQLite engine in CI without the Expo runtime:
 *
 *   tsc src/infrastructure/sqlite/migrations.ts --outDir /tmp/sqlmig \
 *     --module commonjs --target es2022 --skipLibCheck
 *
 * SQL uses strict constraints and fails loudly on double-apply; the ledger
 * in `runner.ts` guarantees each version applies exactly once. Foreign keys
 * require `PRAGMA foreign_keys = ON`, which `database.ts` enables on every
 * open (expo-sqlite leaves it off by default).
 *
 * Metro cannot `require()` raw `.sql` files without a custom plugin, so the
 * registry lives here as string constants instead of separate asset files.
 * That keeps one reviewable source of truth that is also typechecked.
 */

import type { Migration } from './types';

const CORE_001_SQL = `
CREATE TABLE content_installations (
  id TEXT PRIMARY KEY,
  content_key TEXT NOT NULL,
  content_version INTEGER NOT NULL CHECK (content_version > 0),
  checksum TEXT NOT NULL CHECK (checksum LIKE 'sha256:%'),
  status TEXT NOT NULL CHECK (status IN ('installing', 'healthy', 'corrupt', 'rolled_back')),
  installed_at TEXT NOT NULL
);

CREATE TABLE reference_units (
  refsys TEXT NOT NULL,
  local_key TEXT NOT NULL,
  work TEXT NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter >= 0),
  verse INTEGER NOT NULL CHECK (verse >= 0),
  kind TEXT NOT NULL CHECK (kind IN ('book', 'chapter', 'verse')),
  ordinal INTEGER NOT NULL,
  PRIMARY KEY (refsys, local_key)
);

CREATE INDEX idx_reference_units_ordinal ON reference_units (refsys, ordinal);

CREATE TABLE verses (
  edition_key TEXT NOT NULL,
  refsys TEXT NOT NULL,
  local_key TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter > 0),
  verse INTEGER NOT NULL CHECK (verse >= 0),
  text TEXT NOT NULL CHECK (length(text) > 0),
  text_sha256 TEXT NOT NULL CHECK (text_sha256 LIKE 'sha256:%'),
  PRIMARY KEY (edition_key, refsys, local_key),
  FOREIGN KEY (refsys, local_key) REFERENCES reference_units (refsys, local_key)
);

CREATE INDEX idx_verses_lookup ON verses (edition_key, book, chapter, verse);
`.trim();

const HEADINGS_002_SQL = `
CREATE TABLE headings (
  id INTEGER PRIMARY KEY,
  refsys TEXT NOT NULL,
  chapter_key TEXT NOT NULL,
  position_verse INTEGER NOT NULL CHECK (position_verse >= 0),
  text TEXT NOT NULL CHECK (length(text) > 0)
);

CREATE INDEX idx_headings_chapter ON headings (refsys, chapter_key);
`.trim();

const LIBRARY_003_SQL = `
CREATE TABLE bookmarks (
  id TEXT PRIMARY KEY,
  translation_id TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter > 0),
  created_at TEXT NOT NULL,
  UNIQUE (translation_id, book, chapter)
);

CREATE INDEX idx_bookmarks_translation ON bookmarks (translation_id, created_at DESC);

CREATE TABLE outbox (
  seq INTEGER PRIMARY KEY,
  op TEXT NOT NULL CHECK (op IN ('bookmark.add', 'bookmark.remove')),
  entity TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL CHECK (length(payload) > 0),
  created_at TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'acked'))
);

CREATE INDEX idx_outbox_status ON outbox (status, seq);
`.trim();

const RECENTS_004_SQL = `
CREATE TABLE recents (
  id INTEGER PRIMARY KEY,
  translation_id TEXT NOT NULL,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter > 0),
  opened_at TEXT NOT NULL,
  UNIQUE (translation_id, book, chapter)
);

CREATE INDEX idx_recents_translation ON recents (translation_id, opened_at DESC);
`.trim();

const PROGRESS_005_SQL = `
CREATE TABLE progress (
  translation_id TEXT PRIMARY KEY,
  book TEXT NOT NULL,
  chapter INTEGER NOT NULL CHECK (chapter > 0),
  verse INTEGER NOT NULL CHECK (verse >= 0),
  updated_at TEXT NOT NULL
);
`.trim();

const SYNC_006_SQL = `
CREATE TABLE sync_state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL CHECK (length(value) > 0)
);
`.trim();

const REMINDER_007_SQL = `
CREATE TABLE reminder (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  enabled INTEGER NOT NULL CHECK (enabled IN (0, 1)),
  hour INTEGER NOT NULL CHECK (hour >= 0 AND hour < 24),
  minute INTEGER NOT NULL CHECK (minute >= 0 AND minute < 60),
  updated_at TEXT NOT NULL
);
`.trim();

/**
 * Ordered migration registry. New migrations append with the next version;
 * never edit an applied migration (drift is detected and fails closed).
 */
export const MIGRATIONS: Migration[] = [
  { version: 1, name: 'core_001', sql: CORE_001_SQL },
  { version: 2, name: 'headings_002', sql: HEADINGS_002_SQL },
  { version: 3, name: 'library_003', sql: LIBRARY_003_SQL },
  { version: 4, name: 'recents_004', sql: RECENTS_004_SQL },
  { version: 5, name: 'progress_005', sql: PROGRESS_005_SQL },
  { version: 6, name: 'sync_006', sql: SYNC_006_SQL },
  { version: 7, name: 'reminder_007', sql: REMINDER_007_SQL },
];
