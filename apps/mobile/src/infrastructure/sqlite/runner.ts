/**
 * Versioned migration runner (mobile-install-01).
 *
 * Fail-closed guarantees:
 * - The registry is validated before any database access.
 * - Persisted ledger rows are validated with Zod (corrupt ledger aborts).
 * - An applied migration whose registered SQL changed aborts with
 *   `ledger-drift` instead of re-applying or overwriting history.
 * - Each pending migration applies atomically: schema plus ledger insert in
 *   one transaction, so a failure leaves no recorded version behind.
 */

import { z } from 'zod';

import type { HashSql, LedgerRow, MigrateResult, Migration, SqliteExecutor } from './types';
import { MigrationError } from './types';

/** Ledger table preamble; idempotent by construction, not a migration. */
export const LEDGER_SQL = `CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  sql_sha256 TEXT NOT NULL,
  applied_at TEXT NOT NULL
);`;

export const SHA256_PATTERN = /^sha256:[0-9a-f]{64}$/;
const NAME_PATTERN = /^[a-z0-9_]+$/;

const ledgerRowSchema = z.object({
  version: z.number().int().positive(),
  name: z.string().min(1),
  sql_sha256: z.string().regex(SHA256_PATTERN),
});

/**
 * Validates the registry without touching the database. Returns a sorted
 * copy; throws `MigrationError` on duplicate versions, non-positive
 * versions, bad names, or empty bodies.
 */
export function validateMigrations(migrations: Migration[]): Migration[] {
  const seen = new Set<number>();
  for (const migration of migrations) {
    if (!Number.isInteger(migration.version) || migration.version <= 0) {
      throw new MigrationError(
        'invalid-version',
        `Migration version must be a positive integer, got ${migration.version}.`,
      );
    }
    if (!NAME_PATTERN.test(migration.name)) {
      throw new MigrationError(
        'invalid-name',
        `Migration name must match ${NAME_PATTERN}, got "${migration.name}".`,
      );
    }
    if (migration.sql.trim().length === 0) {
      throw new MigrationError(
        'empty-migration',
        `Migration ${migration.version} (${migration.name}) has an empty body.`,
      );
    }
    if (seen.has(migration.version)) {
      throw new MigrationError(
        'duplicate-version',
        `Duplicate migration version ${migration.version}.`,
      );
    }
    seen.add(migration.version);
  }
  return [...migrations].sort((a, b) => a.version - b.version);
}

/**
 * Applies pending migrations in ascending version order. Already-applied
 * versions are verified against the registry (drift fails closed) and
 * skipped. Returns applied and skipped version lists.
 */
export async function migrate(
  db: SqliteExecutor,
  migrations: Migration[],
  hashSql: HashSql,
): Promise<MigrateResult> {
  const defs = validateMigrations(migrations);

  await db.execAsync(LEDGER_SQL);
  const rows = await db.getAllAsync<unknown>(
    'SELECT version, name, sql_sha256 FROM schema_migrations ORDER BY version ASC',
  );
  const ledger = new Map<number, LedgerRow>();
  for (const row of rows) {
    const parsed = ledgerRowSchema.safeParse(row);
    if (!parsed.success) {
      throw new MigrationError(
        'ledger-invalid',
        `Corrupt schema_migrations row: ${parsed.error.issues[0]?.message ?? 'validation failed'}.`,
      );
    }
    if (ledger.has(parsed.data.version)) {
      throw new MigrationError(
        'ledger-invalid',
        `Duplicate ledger version ${parsed.data.version}.`,
      );
    }
    ledger.set(parsed.data.version, parsed.data);
  }

  const applied: number[] = [];
  const skipped: number[] = [];
  for (const def of defs) {
    const sha = await hashSql(def.sql);
    if (!SHA256_PATTERN.test(sha)) {
      throw new MigrationError(
        'invalid-hash',
        `Hasher must return sha256:<64 hex>, got "${sha.slice(0, 32)}…".`,
      );
    }
    const existing = ledger.get(def.version);
    if (existing) {
      if (existing.name !== def.name || existing.sql_sha256 !== sha) {
        throw new MigrationError(
          'ledger-drift',
          `Migration ${def.version} changed since it was applied (ledger: ${existing.name}, registry: ${def.name}). Restore the original SQL or add a new version.`,
        );
      }
      skipped.push(def.version);
      continue;
    }
    try {
      await db.withTransactionAsync(async () => {
        await db.execAsync(def.sql);
        await db.runAsync(
          'INSERT INTO schema_migrations (version, name, sql_sha256, applied_at) VALUES (?, ?, ?, ?)',
          [def.version, def.name, sha, new Date().toISOString()],
        );
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      throw new MigrationError(
        'migration-failed',
        `Migration ${def.version} (${def.name}) failed and was rolled back: ${reason}`,
      );
    }
    applied.push(def.version);
  }
  return { applied, skipped };
}
