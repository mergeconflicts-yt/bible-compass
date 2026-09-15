/**
 * SQLite infrastructure public API (mobile-install-01).
 *
 * Feature modules may import from this barrel only. They must not reach
 * into `database.ts` for the raw Expo handle except through a repository
 * interface defined at the feature boundary.
 */

export { DATABASE_FILE, hashSqlWithExpoCrypto, openAppDatabase } from './database';
export { MIGRATIONS } from './migrations';
export { LEDGER_SQL, migrate, validateMigrations } from './runner';
export type {
  HashSql,
  LedgerRow,
  MigrateResult,
  Migration,
  MigrationErrorCode,
  SqliteExecutor,
} from './types';
export { MigrationError } from './types';
