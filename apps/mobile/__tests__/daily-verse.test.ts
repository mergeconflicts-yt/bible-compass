/**
 * Daily verse on SQLite reads (mobile-install-05).
 *
 * Cards (home, daily artwork, composer preview) and both Share actions read
 * through `resolveDailyVerseText`, which is SQLite-first. Part A proves the
 * routing with a stub repository; Part B proves the offline end-to-end path
 * by projecting the real bundled Nehemiah 2 into a real engine
 * (`node:sqlite`, needs Node 22 + --experimental-sqlite via the `test`
 * script) and reading the daily verse back through `SqlitePassageRepository`.
 */

import { buildDailyVerseFixture } from '../src/fixtures/home';
import { dailyVerseTextFor } from '../src/fixtures/demo';
import { getChapter as getJsonChapter, getVerseText as getJsonVerseText } from '../src/content/bsb';
import {
  BSB_EDITION_KEY,
  BSB_REFSYS,
  resetPassageStore,
  resolveDailyVerseText,
  setPassageRepository,
  toChapterInput,
} from '../src/content/passageStore';
import type { ChapterBlock, PassageRepository, VerseHit } from '../src/content/passageRepository';
import { projectChapter } from '../src/infrastructure/sqlite/projection';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';
import { SqlitePassageRepository } from '../src/infrastructure/sqlite/passageRepository';
import type { HashSql } from '../src/infrastructure/sqlite/types';

declare const require: (path: string) => unknown;

const SQLITE_TEXT = 'Seeded from SQLite, not the bundle.';

class StubRepository implements PassageRepository {
  constructor(private readonly verseText: string | null) {}

  getChapterBlocks(): ChapterBlock[] | null {
    return null;
  }

  getVerseText(bookOsis: string, chapter: number, verse: number): string | null {
    if (bookOsis === 'Neh' && chapter === 2 && verse === 4) return this.verseText;
    return null;
  }

  searchVerses(): VerseHit[] {
    return [];
  }
}

beforeEach(() => {
  resetPassageStore();
});

afterEach(() => {
  resetPassageStore();
});

describe('daily verse routing', () => {
  it('feeds cards and share text from the active (SQLite) repository', () => {
    setPassageRepository(new StubRepository(SQLITE_TEXT));
    expect(resolveDailyVerseText('BSB')).toBe(SQLITE_TEXT);
    expect(buildDailyVerseFixture('BSB').text).toBe(SQLITE_TEXT);
    expect(dailyVerseTextFor('BSB')).toBe(SQLITE_TEXT);
  });

  it('falls back to bundled JSON when SQLite lacks the verse', () => {
    setPassageRepository(new StubRepository(null));
    const bundled = getJsonVerseText('Neh', 2, 4, 'BSB');
    expect(bundled).toBeTruthy();
    expect(resolveDailyVerseText('BSB')).toBe(bundled);
    expect(buildDailyVerseFixture('BSB').text).toBe(bundled);
  });

  it('fails closed with no invented wording when the verse is absent everywhere', () => {
    setPassageRepository(new StubRepository(null));
    // 'XX' has no bundled chapter, so neither source can answer.
    expect(resolveDailyVerseText('XX')).toBeNull();
    expect(buildDailyVerseFixture('XX').text).toBe('');
    expect(dailyVerseTextFor('XX')).toBe('');
  });
});

interface NodeCrypto {
  createHash: (algorithm: string) => {
    update: (data: string, encoding: string) => { digest: (encoding: string) => string };
  };
}

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

(nodeSqlite ? describe : describe.skip)('daily verse from a real offline engine', () => {
  it('renders the daily card text from projected SQLite rows', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const bundled = getJsonChapter('Neh', 2, 'BSB');
    if (!bundled) throw new Error('Neh.2 missing from bundled asset');
    const mapped = toChapterInput(bundled.blocks);
    expect(mapped.verses).toHaveLength(20);

    const raw = new nodeSqlite.DatabaseSync(':memory:');
    raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
    const plug = {
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
      getAllAsync: async <T>(source: string, params: Array<string | number> = []): Promise<T[]> =>
        raw.prepare(source).all<T>(...params),
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

    await plug.execAsync(LEDGER_SQL);
    for (const migration of MIGRATIONS) {
      await plug.execAsync(migration.sql);
    }
    const nodeCrypto = require('crypto') as NodeCrypto;
    const nodeHash: HashSql = async (text: string) =>
      `sha256:${nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;

    const projected = await projectChapter(
      plug,
      { bookOsis: 'Neh', chapter: 2, verses: mapped.verses, headings: mapped.headings },
      {
        editionKey: BSB_EDITION_KEY,
        refsys: BSB_REFSYS,
        installationId: 'en.bsb.Neh.2@1',
        contentKey: 'en.bsb.Neh.2',
        contentVersion: 1,
      },
      nodeHash,
    );
    expect(projected.installed).toBe(true);

    const reader = {
      getAllSync: <T>(source: string, params: Array<string | number>): T[] =>
        raw.prepare(source).all<T>(...params),
      getFirstSync: <T>(source: string, params: Array<string | number>): T | null =>
        raw.prepare(source).get<T>(...params) ?? null,
    };
    setPassageRepository(new SqlitePassageRepository(reader, BSB_EDITION_KEY, BSB_REFSYS));

    // Binds the resolved value to the projected DB rows, not the bundle.
    const direct = reader.getFirstSync<{ text: string }>(
      'SELECT text FROM verses WHERE edition_key = ? AND refsys = ? AND book = ? AND chapter = ? AND verse = ?',
      [BSB_EDITION_KEY, BSB_REFSYS, 'Neh', 2, 4],
    );
    expect(direct?.text).toBeTruthy();
    expect(resolveDailyVerseText('BSB')).toBe(direct?.text);
    const expected = getJsonVerseText('Neh', 2, 4, 'BSB');
    expect(resolveDailyVerseText('BSB')).toBe(expected);
    expect(buildDailyVerseFixture('BSB').text).toBe(expected);
    expect(dailyVerseTextFor('BSB')).toBe(expected);
    raw.close();
  });
});

if (!nodeSqlite) {
  it.skip('SKIP: node:sqlite unavailable (needs Node 22 + --experimental-sqlite); real-engine daily-verse test skipped loudly.', () =>
    undefined);
}
