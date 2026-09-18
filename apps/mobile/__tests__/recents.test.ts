/**
 * On-device recents (mobile-install-06b).
 *
 * Part A proves the store contract against an in-memory fake: upsert floats
 * re-opens to the top without duplicates, the cap holds, and recording never
 * throws. Part B proves restart durability on a real engine (`node:sqlite`,
 * needs Node 22 + --experimental-sqlite via the `test` script).
 */

import {
  initializeRecentStore,
  listRecents,
  recordRecent,
  resetRecentStore,
  RECENT_LIMIT,
} from '../src/content/recentStore';
import type { PassageDbHandle } from '../src/content/passageStore';
import { SqliteRecents, RECENT_CAP } from '../src/infrastructure/sqlite/recents';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';

interface StoredRecent {
  seq: number;
  translation_id: string;
  book: string;
  chapter: number;
  opened_at: string;
}

/** Newest-first with an insertion tiebreak, mirroring the adapter's
 * `(opened_at DESC, id DESC)` so same-millisecond records order
 * deterministically. */
function byNewest(a: StoredRecent, b: StoredRecent): number {
  return b.opened_at.localeCompare(a.opened_at) || b.seq - a.seq;
}

class FakeRecentHandle implements PassageDbHandle {
  recents = new Map<string, StoredRecent>();
  seq = 0;

  async execAsync(): Promise<void> {}

  async runAsync(
    source: string,
    params: Array<string | number> = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    if (source.startsWith('INSERT INTO recents')) {
      const [translation_id, book, chapter, opened_at] = params;
      const key = `${translation_id}|${book}|${chapter}`;
      this.recents.set(key, {
        seq: (this.seq += 1),
        translation_id: String(translation_id),
        book: String(book),
        chapter: Number(chapter),
        opened_at: String(opened_at),
      });
      // Mirror the adapter's prune: keep the newest RECENT_CAP per translation.
      const rows = [...this.recents.values()]
        .filter((row) => row.translation_id === String(translation_id))
        .sort(byNewest);
      for (const extra of rows.slice(RECENT_CAP)) {
        this.recents.delete(`${extra.translation_id}|${extra.book}|${extra.chapter}`);
      }
      return { lastInsertRowId: this.recents.size, changes: 1 };
    }
    if (source.startsWith('DELETE FROM recents')) {
      return { lastInsertRowId: 0, changes: 0 };
    }
    throw new Error(`fake cannot run: ${source}`);
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  getAllSync<T>(source: string, params: Array<string | number>): T[] {
    if (source.includes('FROM recents')) {
      const [translation_id, limit] = params;
      return [...this.recents.values()]
        .filter((row) => row.translation_id === String(translation_id))
        .sort(byNewest)
        .slice(0, Number(limit)) as unknown as T[];
    }
    throw new Error(`fake cannot read: ${source}`);
  }

  getFirstSync<T>(): T | null {
    return null;
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = new Map(this.recents);
    try {
      await task();
    } catch (error) {
      this.recents = snapshot;
      throw error;
    }
  }
}

function initStore(fake: FakeRecentHandle): void {
  initializeRecentStore({ createRepository: (db) => new SqliteRecents(db), db: fake });
}

beforeEach(() => {
  resetRecentStore();
});

afterEach(() => {
  resetRecentStore();
});

describe('recent store', () => {
  it('records opens newest-first without duplicates', async () => {
    const fake = new FakeRecentHandle();
    initStore(fake);
    await expect(recordRecent('BSB', 'Neh', 2)).resolves.toBe('recorded');
    await expect(recordRecent('BSB', 'Ezra', 4)).resolves.toBe('recorded');
    await expect(recordRecent('BSB', 'Neh', 2)).resolves.toBe('recorded');
    const recents = listRecents('BSB');
    expect(recents.map((entry) => `${entry.bookOsis}.${entry.chapter}`)).toEqual([
      'Neh.2',
      'Ezra.4',
    ]);
  });

  it('scopes recents by translation and honors the limit', async () => {
    const fake = new FakeRecentHandle();
    initStore(fake);
    await recordRecent('BSB', 'Neh', 2);
    await recordRecent('tel_irv', 'Neh', 2);
    expect(listRecents('BSB')).toHaveLength(1);
    expect(listRecents('tel_irv')).toHaveLength(1);
    expect(listRecents('BSB', 1)).toHaveLength(1);
    expect(RECENT_LIMIT).toBe(RECENT_CAP);
  });

  it('prunes past the cap, keeping the newest', async () => {
    const fake = new FakeRecentHandle();
    initStore(fake);
    for (let chapter = 1; chapter <= RECENT_CAP + 2; chapter += 1) {
      await recordRecent('BSB', 'Neh', chapter);
    }
    const recents = listRecents('BSB', RECENT_CAP + 10);
    expect(recents).toHaveLength(RECENT_CAP);
    expect(recents[0]?.chapter).toBe(RECENT_CAP + 2);
  });

  it('skips bad locations and failing stores without throwing', async () => {
    const fake = new FakeRecentHandle();
    initStore(fake);
    await expect(recordRecent('BSB', 'Neh', 0)).resolves.toBe('skipped');
    await expect(recordRecent('BSB', '', 2)).resolves.toBe('skipped');
    expect(listRecents('BSB')).toEqual([]);
    resetRecentStore();
    await expect(recordRecent('BSB', 'Neh', 2)).resolves.toBe('skipped');
    expect(listRecents('BSB')).toEqual([]);
  });
});

declare const require: (path: string) => unknown;

// Node builtins via require (same convention as sqlite-projection.test.ts:
// no @types/node in this project, so no static `import ... from 'fs'`).
const { mkdtempSync, rmSync } = require('fs') as {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, opts: { recursive: boolean; force: boolean }) => void;
};
const { tmpdir } = require('os') as { tmpdir: () => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

interface NodeSqliteStatement {
  all<T>(...params: Array<string | number>): T[];
  get<T>(...params: Array<string | number>): T | undefined;
  run(...params: Array<string | number>): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
}

interface NodeSqliteDatabase {
  exec(source: string): void;
  prepare(source: string): NodeSqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (path: ':memory:' | string) => NodeSqliteDatabase;
}

function loadNodeSqlite(): NodeSqliteModule | null {
  try {
    return require('node:sqlite') as NodeSqliteModule;
  } catch {
    return null;
  }
}

const nodeSqlite = loadNodeSqlite();

(nodeSqlite ? describe : describe.skip)('recents survive a restart on a real engine', () => {
  it('records, closes, reopens, and keeps the list', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const dir = mkdtempSync(join(tmpdir(), 'm06b-recents-'));
    const file = join(dir, 'library.db');
    try {
      const openHandle = (path: string): { handle: PassageDbHandle; close: () => void } => {
        const raw = new (nodeSqlite as NodeSqliteModule).DatabaseSync(path);
        raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
        const handle: PassageDbHandle = {
          execAsync: async (source: string): Promise<void> => {
            raw.exec(source);
          },
          runAsync: async (source: string, params: Array<string | number> = []) => {
            const result = raw.prepare(source).run(...params);
            return {
              lastInsertRowId: Number(result.lastInsertRowid),
              changes: Number(result.changes),
            };
          },
          getAllAsync: async <T>(
            source: string,
            params: Array<string | number> = [],
          ): Promise<T[]> => raw.prepare(source).all<T>(...params),
          getAllSync: <T>(source: string, params: Array<string | number>): T[] =>
            raw.prepare(source).all<T>(...params),
          getFirstSync: <T>(source: string, params: Array<string | number>): T | null =>
            raw.prepare(source).get<T>(...params) ?? null,
          withTransactionAsync: async (task: () => Promise<void>): Promise<void> => {
            raw.exec('BEGIN IMMEDIATE;');
            try {
              await task();
              raw.exec('COMMIT;');
            } catch (error) {
              try {
                raw.exec('ROLLBACK;');
              } catch {
                // Already rolled back; surface the original failure.
              }
              throw error;
            }
          },
        };
        return { handle, close: () => raw.close() };
      };

      const first = openHandle(file);
      await first.handle.execAsync(LEDGER_SQL);
      for (const migration of MIGRATIONS) {
        await first.handle.execAsync(migration.sql);
      }
      initializeRecentStore({
        createRepository: (db) => new SqliteRecents(db),
        db: first.handle,
      });
      await expect(recordRecent('BSB', 'Neh', 2)).resolves.toBe('recorded');
      expect(listRecents('BSB')).toHaveLength(1);
      first.close();

      // Force-close equivalent: fresh handle on the same file, fresh store.
      resetRecentStore();
      const second = openHandle(file);
      initializeRecentStore({
        createRepository: (db) => new SqliteRecents(db),
        db: second.handle,
      });
      expect(listRecents('BSB').map((entry) => `${entry.bookOsis}.${entry.chapter}`)).toEqual([
        'Neh.2',
      ]);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

if (!nodeSqlite) {
  it.skip('SKIP: node:sqlite unavailable (needs Node 22 + --experimental-sqlite); restart durability test skipped loudly.', () =>
    undefined);
}
