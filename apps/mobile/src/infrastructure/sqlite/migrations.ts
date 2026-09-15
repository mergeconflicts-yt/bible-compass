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

/**
 * Ordered migration registry. New migrations append with the next version;
 * never edit an applied migration (drift is detected and fails closed).
 */
export const MIGRATIONS: Migration[] = [{ version: 1, name: 'core_001', sql: CORE_001_SQL }];
