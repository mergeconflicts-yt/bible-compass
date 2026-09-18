/**
 * SQLite database adapter (mobile-install-01).
 *
 * The only module allowed to import `expo-sqlite` or `expo-crypto`.
 * Screens, components, and hooks must use repository interfaces built on
 * `SqliteExecutor`, never this module's internals or the Expo API directly.
 *
 * Pragmas follow the Expo SDK v57 guidance: WAL journal mode for
 * performance, and `foreign_keys = ON` on every open because expo-sqlite
 * leaves foreign-key enforcement off by default (without it, the
 * `verses` → `reference_units` constraint in `001_core` would not hold).
 */

import * as Crypto from 'expo-crypto';
import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import type { PassageDbHandle } from '@/content/passageStore';

import { MIGRATIONS } from './migrations';
import { migrate } from './runner';
import type { HashSql, SqliteExecutor } from './types';

export const DATABASE_FILE = 'bible-compass.db';

export const hashSqlWithExpoCrypto: HashSql = async (sql: string): Promise<string> => {
  const hex = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, sql);
  return `sha256:${hex}`;
};

/**
 * Stable client UUID for user mutations (bookmarks, outbox ops) per
 * `docs/CONTEXT_DATA_ARCHITECTURE.md`. Lives here because this module is
 * the only one allowed to import `expo-crypto`.
 */
export function newClientId(): string {
  return Crypto.randomUUID();
}

/**
 * Adapts a live handle to the content layer's structural contract
 * (type-only import: erased at runtime, no layering violation at runtime).
 */
export function asPassageDbHandle(db: SQLiteDatabase): PassageDbHandle {
  return {
    execAsync: (source: string) => db.execAsync(source),
    runAsync: (source: string, params: (string | number)[] = []) =>
      db.runAsync(source, params).then((result) => ({
        lastInsertRowId: result.lastInsertRowId,
        changes: result.changes,
      })),
    getAllAsync: <T>(source: string, params: (string | number)[] = []) =>
      db.getAllAsync<T>(source, params),
    getAllSync: <T>(source: string, params: (string | number)[]) =>
      db.getAllSync<T>(source, params),
    getFirstSync: <T>(source: string, params: (string | number)[]) =>
      db.getFirstSync<T>(source, params),
    withTransactionAsync: (task: () => Promise<void>) => db.withTransactionAsync(task),
  };
}

/**
 * Opens the app database, enables required pragmas, and applies pending
 * migrations. Safe to call on every cold start: a migrated database is a
 * verified no-op returning the handle.
 */
export async function openAppDatabase(): Promise<SQLiteDatabase> {
  const db = await openDatabaseAsync(DATABASE_FILE);
  await db.execAsync('PRAGMA journal_mode = WAL;');
  await db.execAsync('PRAGMA foreign_keys = ON;');
  // Explicit adaptation at the boundary: the runner depends only on the
  // narrow `SqliteExecutor` contract, never on the Expo API directly.
  const executor: SqliteExecutor = {
    execAsync: (source) => db.execAsync(source),
    runAsync: async (source, params = []) => {
      const result = await db.runAsync(source, params);
      return { lastInsertRowId: result.lastInsertRowId, changes: result.changes };
    },
    getAllAsync: <T>(source: string, params: (string | number)[] = []) =>
      db.getAllAsync<T>(source, params),
    withTransactionAsync: (task) => db.withTransactionAsync(task),
  };
  await migrate(executor, MIGRATIONS, hashSqlWithExpoCrypto);
  return db;
}
