/**
 * SQLite infrastructure contracts (mobile-install-01).
 *
 * Screens and feature code must never import `expo-sqlite` directly.
 * They depend on these contracts; `database.ts` is the only adapter that
 * touches the Expo SQLite API. The runner depends only on `zod`, so the
 * migration logic is fully testable without native modules.
 */

export interface Migration {
  /** Positive integer schema version, unique across the registry. */
  version: number;
  /** Lowercase identifier, e.g. `core_001`. Stored in the ledger. */
  name: string;
  /** One or more SQL statements applied atomically. */
  sql: string;
}

/** One applied-migration ledger row, as persisted in SQLite. */
export interface LedgerRow {
  version: number;
  name: string;
  sql_sha256: string;
}

/**
 * Minimal async executor surface. `expo-sqlite`'s `SQLiteDatabase` satisfies
 * this interface structurally (methods declared with method shorthand, so
 * parameter bivariance applies). Tests inject an in-memory fake instead.
 */
export interface SqliteExecutor {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    params?: (string | number)[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(source: string, params?: (string | number)[]): Promise<T[]>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

/** Computes `sha256:<64 hex>` for a migration body. Injected for testability. */
export type HashSql = (sql: string) => Promise<string>;

export interface MigrateResult {
  applied: number[];
  skipped: number[];
}

export type MigrationErrorCode =
  | 'duplicate-version'
  | 'empty-migration'
  | 'invalid-version'
  | 'invalid-name'
  | 'invalid-hash'
  | 'invalid-input'
  | 'ledger-invalid'
  | 'ledger-drift'
  | 'migration-failed';

export class MigrationError extends Error {
  readonly code: MigrationErrorCode;

  constructor(code: MigrationErrorCode, message: string) {
    super(message);
    this.name = 'MigrationError';
    this.code = code;
  }
}
