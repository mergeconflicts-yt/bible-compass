/**
 * Reading progress (mobile-install-06c).
 *
 * Part A proves the store contract against an in-memory fake: one row per
 * translation, latest write wins, invalid positions and unusable stores
 * resolve 'skipped', and the home fixture renders stored positions (verse
 * links land on the verse, chapter tops open the chapter) with the pilot
 * entry point as the never-started default. Part B proves restart
 * durability on a real engine (`node:sqlite`, needs Node 22 +
 * --experimental-sqlite via the `test` script).
 */

import { buildContinueReadingFixture } from '../src/fixtures/home';
import {
  getProgress,
  initializeProgressStore,
  recordProgress,
  resetProgressStore,
} from '../src/content/progressStore';
import type { PassageDbHandle } from '../src/content/passageStore';
import { SqliteProgress } from '../src/infrastructure/sqlite/progress';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';

declare const require: (path: string) => unknown;

// Node builtins via require (same convention as sqlite-projection.test.ts:
// no @types/node in this project, so no static `import ... from 'fs'`).
const { mkdtempSync, rmSync } = require('fs') as {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, opts: { recursive: boolean; force: boolean }) => void;
};
const { tmpdir } = require('os') as { tmpdir: () => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

interface StoredProgress {
  translation_id: string;
  book: string;
  chapter: number;
  verse: number;
  updated_at: string;
}

class FakeProgressHandle implements PassageDbHandle {
  rows = new Map<string, StoredProgress>();

  async execAsync(): Promise<void> {}

  async runAsync(
    source: string,
    params: Array<string | number> = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    if (source.startsWith('INSERT INTO progress')) {
      const [translation_id, book, chapter, verse, updated_at] = params;
      this.rows.set(String(translation_id), {
        translation_id: String(translation_id),
        book: String(book),
        chapter: Number(chapter),
        verse: Number(verse),
        updated_at: String(updated_at),
      });
      return { lastInsertRowId: 1, changes: 1 };
    }
    throw new Error(`fake cannot run: ${source}`);
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  getAllSync<T>(): T[] {
    return [];
  }

  getFirstSync<T>(source: string, params: Array<string | number>): T | null {
    if (source.includes('FROM progress')) {
      const found = this.rows.get(String(params[0]));
      return (found ?? null) as unknown as T | null;
    }
    throw new Error(`fake cannot read: ${source}`);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    await task();
  }
}

function initStore(fake: FakeProgressHandle): void {
  initializeProgressStore({ createRepository: (db) => new SqliteProgress(db), db: fake });
}

beforeEach(() => {
  resetProgressStore();
});

afterEach(() => {
  resetProgressStore();
});

describe('progress store', () => {
  it('records and reads back the position, latest write wins', async () => {
    const fake = new FakeProgressHandle();
    initStore(fake);
    expect(getProgress('BSB')).toBeNull();
    await expect(recordProgress('BSB', 'Neh', 2, 0)).resolves.toBe('recorded');
    expect(getProgress('BSB')).toMatchObject({
      translationId: 'BSB',
      bookOsis: 'Neh',
      chapter: 2,
      verse: 0,
    });
    await expect(recordProgress('BSB', 'Neh', 2, 5)).resolves.toBe('recorded');
    expect(getProgress('BSB')).toMatchObject({ chapter: 2, verse: 5 });
    expect(fake.rows.size).toBe(1);
  });

  it('scopes positions by translation', async () => {
    const fake = new FakeProgressHandle();
    initStore(fake);
    await recordProgress('BSB', 'Neh', 2, 5);
    await recordProgress('tel_irv', 'Neh', 3, 0);
    expect(getProgress('BSB')).toMatchObject({ chapter: 2, verse: 5 });
    expect(getProgress('tel_irv')).toMatchObject({ chapter: 3, verse: 0 });
    expect(getProgress('tam_irv')).toBeNull();
  });

  it('skips bad positions and unusable stores without throwing', async () => {
    const fake = new FakeProgressHandle();
    initStore(fake);
    await expect(recordProgress('BSB', 'Neh', 0, 0)).resolves.toBe('skipped');
    await expect(recordProgress('BSB', 'Neh', 2, -1)).resolves.toBe('skipped');
    await expect(recordProgress('BSB', '', 2, 1)).resolves.toBe('skipped');
    expect(getProgress('BSB')).toBeNull();
    resetProgressStore();
    await expect(recordProgress('BSB', 'Neh', 2, 1)).resolves.toBe('skipped');
    expect(getProgress('BSB')).toBeNull();
  });
});

describe('continue-reading fixture', () => {
  it('keeps the pilot entry point when reading never started', () => {
    expect(buildContinueReadingFixture('BSB')).toEqual({
      passageKey: 'Neh.2.1-Neh.2.8',
      bookLabel: 'Nehemiah',
      chapter: 2,
      lastVerseLabel: 'Verse 5',
      contextLabel: 'Return from exile',
      translationShort: 'BSB',
    });
  });

  it('resumes stored verse positions with a landing link', async () => {
    initStore(new FakeProgressHandle());
    await recordProgress('BSB', 'Neh', 2, 5);
    expect(buildContinueReadingFixture('BSB')).toMatchObject({
      passageKey: 'Neh.2.5',
      bookLabel: 'Nehemiah',
      chapter: 2,
      lastVerseLabel: 'Verse 5',
    });
  });

  it('opens the chapter top for verse-zero positions', async () => {
    initStore(new FakeProgressHandle());
    await recordProgress('BSB', 'Ezra', 4, 0);
    expect(buildContinueReadingFixture('BSB')).toMatchObject({
      passageKey: 'Ezra.4',
      lastVerseLabel: 'Chapter top',
    });
  });
});

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

(nodeSqlite ? describe : describe.skip)('progress survives a restart on a real engine', () => {
  it('records, closes, reopens, and resumes', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const dir = mkdtempSync(join(tmpdir(), 'm06c-progress-'));
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
      initializeProgressStore({
        createRepository: (db) => new SqliteProgress(db),
        db: first.handle,
      });
      await expect(recordProgress('BSB', 'Neh', 2, 5)).resolves.toBe('recorded');
      first.close();

      // Force-close equivalent: fresh handle on the same file, fresh store.
      resetProgressStore();
      const second = openHandle(file);
      initializeProgressStore({
        createRepository: (db) => new SqliteProgress(db),
        db: second.handle,
      });
      expect(getProgress('BSB')).toMatchObject({
        translationId: 'BSB',
        bookOsis: 'Neh',
        chapter: 2,
        verse: 5,
      });
      expect(buildContinueReadingFixture('BSB')).toMatchObject({ passageKey: 'Neh.2.5' });
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
