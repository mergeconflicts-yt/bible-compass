/**
 * SQLite migration runner tests (mobile-install-01).
 *
 * The fake executor below models transaction commit/rollback and the ledger
 * lifecycle, but it does NOT execute SQL: table creation, constraints, and
 * foreign keys are validated against a real SQLite engine via the sqlite3
 * CLI (see handoff), not here. `expo-sqlite` and `expo-crypto` are mocked
 * per-file so no native module loads under Jest.
 */

import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';

import { DATABASE_FILE, openAppDatabase } from '../src/infrastructure/sqlite/database';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';
import { migrate, validateMigrations } from '../src/infrastructure/sqlite/runner';
import {
  MigrationError,
  type HashSql,
  type Migration,
  type SqliteExecutor,
} from '../src/infrastructure/sqlite/types';

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));

jest.mock('expo-crypto', () => ({
  CryptoDigestAlgorithm: { SHA256: 'SHA-256' },
  digestStringAsync: jest.fn(async () => '0'.repeat(64)),
}));

const mockedOpenDatabase = openDatabaseAsync as unknown as jest.Mock;

/**
 * Deterministic format-valid digest for runner-logic tests. This is NOT
 * SHA-256 (the suite must not depend on Node's `crypto`: the mobile
 * tsconfig only includes `jest` types). Genuine digest compatibility —
 * `expo-crypto` hex output matching `sha256:[0-9a-f]{64}` — is covered by
 * the `invalid-hash` fail-closed test plus device verification on first
 * `openAppDatabase` call (see handoff follow-ups).
 */
const hashSql: HashSql = async (sql: string): Promise<string> => {
  let material = sql;
  let out = '';
  let seed = 0;
  while (out.length < 64) {
    let hash = 2166136261 ^ seed;
    for (let index = 0; index < material.length; index += 1) {
      hash ^= material.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    seed += 1;
    out += (hash >>> 0).toString(16).padStart(8, '0');
    material = `${out}${seed}`;
  }
  return `sha256:${out.slice(0, 64)}`;
};

interface LedgerRow {
  version: number;
  name: string;
  sql_sha256: string;
}

class FakeExecutor implements SqliteExecutor {
  execCalls: string[] = [];
  runCalls: Array<{ sql: string; params: Array<string | number> }> = [];
  ledger: LedgerRow[] = [];
  failOnExecContaining: string | null = null;

  async execAsync(sql: string): Promise<void> {
    this.execCalls.push(sql);
    if (this.failOnExecContaining && sql.includes(this.failOnExecContaining)) {
      throw new Error(`fake exec failure on marker ${this.failOnExecContaining}`);
    }
  }

  async runAsync(
    sql: string,
    params: Array<string | number> = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    if (sql.startsWith('INSERT INTO schema_migrations')) {
      const [version, name, sql_sha256] = params as [number, string, string];
      this.ledger.push({ version, name, sql_sha256 });
    }
    this.runCalls.push({ sql, params });
    return { lastInsertRowId: this.runCalls.length, changes: 1 };
  }

  async getAllAsync<T>(sql: string): Promise<T[]> {
    if (sql.includes('FROM schema_migrations')) {
      return [...this.ledger] as unknown as T[];
    }
    return [];
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = {
      execCalls: [...this.execCalls],
      runCalls: [...this.runCalls],
      ledger: [...this.ledger],
    };
    try {
      await task();
    } catch (error) {
      this.execCalls = snapshot.execCalls;
      this.runCalls = snapshot.runCalls;
      this.ledger = snapshot.ledger;
      throw error;
    }
  }
}

function insertCount(fake: FakeExecutor): number {
  return fake.runCalls.filter((call) => call.sql.startsWith('INSERT INTO schema_migrations'))
    .length;
}

describe('sqlite migration runner', () => {
  it('applies the production registry on a fresh database and records the ledger', async () => {
    const fake = new FakeExecutor();
    const result = await migrate(fake, MIGRATIONS, hashSql);
    expect(result).toEqual({ applied: [1, 2, 3, 4, 5, 6, 7], skipped: [] });
    expect(fake.ledger).toHaveLength(7);
    expect(fake.ledger.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(fake.ledger.map((row) => row.name)).toEqual([
      'core_001',
      'headings_002',
      'library_003',
      'recents_004',
      'progress_005',
      'sync_006',
      'reminder_007',
    ]);
    for (const [index, row] of fake.ledger.entries()) {
      const expectedSha = await hashSql(MIGRATIONS[index]?.sql ?? '');
      expect(row?.sql_sha256).toBe(expectedSha);
    }
    expect(fake.execCalls[0]).toContain('CREATE TABLE IF NOT EXISTS schema_migrations');
  });

  it('is a verified no-op on re-run', async () => {
    const fake = new FakeExecutor();
    await migrate(fake, MIGRATIONS, hashSql);
    const creates = fake.execCalls.filter((sql) =>
      sql.includes('CREATE TABLE content_installations'),
    );
    const second = await migrate(fake, MIGRATIONS, hashSql);
    expect(second).toEqual({ applied: [], skipped: [1, 2, 3, 4, 5, 6, 7] });
    expect(
      fake.execCalls.filter((sql) => sql.includes('CREATE TABLE content_installations')),
    ).toHaveLength(creates.length);
    expect(insertCount(fake)).toBe(7);
  });

  it('fails closed when registered SQL drifts from the applied ledger', async () => {
    const fake = new FakeExecutor();
    await migrate(fake, MIGRATIONS, hashSql);
    const insertsBefore = insertCount(fake);
    const tampered: Migration[] = [
      { ...(MIGRATIONS[0] as Migration), sql: `${MIGRATIONS[0]?.sql}\n-- tampered` },
    ];
    await expect(migrate(fake, tampered, hashSql)).rejects.toMatchObject({ code: 'ledger-drift' });
    expect(insertCount(fake)).toBe(insertsBefore);
  });

  it('fails closed when a registered name drifts from the applied ledger', async () => {
    const fake = new FakeExecutor();
    await migrate(fake, MIGRATIONS, hashSql);
    const renamed: Migration[] = [{ ...(MIGRATIONS[0] as Migration), name: 'renamed_001' }];
    await expect(migrate(fake, renamed, hashSql)).rejects.toMatchObject({ code: 'ledger-drift' });
  });

  it('rolls back a failing migration without recording a version', async () => {
    const fake = new FakeExecutor();
    fake.failOnExecContaining = '__FAIL__';
    const failing: Migration[] = [
      { version: 9, name: 'boom_009', sql: 'CREATE TABLE t (id TEXT); -- __FAIL__' },
    ];
    await expect(migrate(fake, failing, hashSql)).rejects.toMatchObject({
      code: 'migration-failed',
    });
    expect(fake.ledger).toHaveLength(0);
    expect(insertCount(fake)).toBe(0);
  });

  it('applies out-of-order registries in ascending version order', async () => {
    const fake = new FakeExecutor();
    const registry: Migration[] = [
      { version: 2, name: 'second_002', sql: 'SELECT 1; -- MARKER_SECOND' },
      { version: 1, name: 'first_001', sql: 'SELECT 1; -- MARKER_FIRST' },
    ];
    const result = await migrate(fake, registry, hashSql);
    expect(result.applied).toEqual([1, 2]);
    const firstAt = fake.execCalls.findIndex((sql) => sql.includes('MARKER_FIRST'));
    const secondAt = fake.execCalls.findIndex((sql) => sql.includes('MARKER_SECOND'));
    expect(firstAt).toBeGreaterThanOrEqual(0);
    expect(secondAt).toBeGreaterThan(firstAt);
  });

  it('rejects duplicate versions before touching the database', async () => {
    const fake = new FakeExecutor();
    const registry: Migration[] = [
      { version: 1, name: 'first_001', sql: 'SELECT 1;' },
      { version: 1, name: 'second_001', sql: 'SELECT 2;' },
    ];
    await expect(migrate(fake, registry, hashSql)).rejects.toMatchObject({
      code: 'duplicate-version',
    });
    expect(fake.execCalls).toHaveLength(0);
  });

  it('rejects empty bodies, bad versions, and bad names before touching the database', async () => {
    for (const bad of [
      [{ version: 1, name: 'empty_001', sql: '   \n ' }],
      [{ version: 0, name: 'zero_000', sql: 'SELECT 1;' }],
      [{ version: 1, name: 'Bad Name', sql: 'SELECT 1;' }],
    ] as Migration[][]) {
      const fake = new FakeExecutor();
      await expect(migrate(fake, bad, hashSql)).rejects.toBeInstanceOf(MigrationError);
      expect(fake.execCalls).toHaveLength(0);
    }
  });

  it('rejects a corrupt ledger row instead of trusting it', async () => {
    const fake = new FakeExecutor();
    fake.ledger.push({
      version: '1',
      name: 'core_001',
      sql_sha256: 'sha256:' + 'a'.repeat(64),
    } as unknown as LedgerRow);
    await expect(migrate(fake, MIGRATIONS, hashSql)).rejects.toMatchObject({
      code: 'ledger-invalid',
    });
  });

  it('rejects a hasher that does not return sha256 hex', async () => {
    const fake = new FakeExecutor();
    const bogus: HashSql = async () => 'bogus';
    await expect(migrate(fake, MIGRATIONS, bogus)).rejects.toMatchObject({ code: 'invalid-hash' });
  });

  it('keeps the production registry to versions 1-7 (reminder lands in M07c)', () => {
    expect(validateMigrations(MIGRATIONS).map((migration) => migration.version)).toEqual([
      1, 2, 3, 4, 5, 6, 7,
    ]);
  });
});

describe('sqlite database adapter wiring', () => {
  it('opens the app database, enables pragmas, and migrates', async () => {
    const fake = new FakeExecutor();
    mockedOpenDatabase.mockResolvedValue(fake as unknown as SQLiteDatabase);
    const db = await openAppDatabase();
    expect(mockedOpenDatabase).toHaveBeenCalledWith(DATABASE_FILE);
    expect(DATABASE_FILE).toBe('bible-compass.db');
    expect(fake.execCalls).toContain('PRAGMA journal_mode = WAL;');
    expect(fake.execCalls).toContain('PRAGMA foreign_keys = ON;');
    expect(fake.ledger.map((row) => row.version)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(db).toBe(fake);
  });
});
