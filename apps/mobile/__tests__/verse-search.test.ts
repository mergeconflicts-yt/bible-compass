/**
 * Offline verse-text search (mobile-install-06b).
 *
 * Part A proves store routing against stubs: SQLite-first, JSON fallback,
 * blank queries short-circuit, and the cap clamps. Part B proves the
 * SQLite adapter's LIKE escaping against a recording reader, and end to end
 * on a real engine (`node:sqlite`, needs Node 22 + --experimental-sqlite
 * via the `test` script) over the projected Nehemiah 2.
 */

import { getVerseText as getJsonVerseText } from '../src/content/bsb';
import {
  resetPassageStore,
  searchVerseText,
  setPassageRepository,
  toChapterInput,
  BSB_EDITION_KEY,
  BSB_REFSYS,
  VERSE_SEARCH_MAX,
} from '../src/content/passageStore';
import { getChapter as getJsonChapter } from '../src/content/bsb';
import type { PassageRepository, VerseHit } from '../src/content/passageRepository';
import { projectChapter } from '../src/infrastructure/sqlite/projection';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';
import { SqlitePassageRepository } from '../src/infrastructure/sqlite/passageRepository';
import type { HashSql } from '../src/infrastructure/sqlite/types';

declare const require: (path: string) => unknown;

const SQLITE_HIT: VerseHit = {
  bookOsis: 'Neh',
  chapter: 2,
  verse: 4,
  text: 'Seeded from SQLite, not the bundle.',
};

class StubRepository implements PassageRepository {
  lastLimit = 0;

  getChapterBlocks(): null {
    return null;
  }

  getVerseText(): null {
    return null;
  }

  searchVerses(query: string, _translationId: string, limit: number): VerseHit[] {
    this.lastLimit = limit;
    if (query === 'boom') throw new Error('store unavailable');
    if (query === 'sqlite-only') return [SQLITE_HIT];
    return [];
  }
}

beforeEach(() => {
  resetPassageStore();
});

afterEach(() => {
  resetPassageStore();
});

describe('verse search routing', () => {
  it('reads hits from the active (SQLite) repository first', () => {
    const stub = new StubRepository();
    setPassageRepository(stub);
    expect(searchVerseText('sqlite-only', 'BSB')).toEqual([SQLITE_HIT]);
  });

  it('falls back to the bundled scan when SQLite has no hits', () => {
    setPassageRepository(new StubRepository());
    // The full verse text always matches itself: deterministic by construction.
    const verseText = getJsonVerseText('Neh', 2, 4, 'BSB') ?? '';
    expect(verseText.length).toBeGreaterThan(0);
    const hits = searchVerseText(verseText, 'BSB');
    expect(hits).toContainEqual({
      bookOsis: 'Neh',
      chapter: 2,
      verse: 4,
      text: verseText,
    });
  });

  it('falls back to the bundled scan when SQLite throws', () => {
    setPassageRepository(new StubRepository());
    const hits = searchVerseText('boom', 'BSB');
    // 'boom' matches no bundled verse; the point is no throw, empty hits.
    expect(hits).toEqual([]);
  });

  it('short-circuits blank queries without touching any source', () => {
    const stub = new StubRepository();
    setPassageRepository(stub);
    expect(searchVerseText('   ', 'BSB')).toEqual([]);
    expect(stub.lastLimit).toBe(0);
  });

  it('clamps the cap to the store maximum', () => {
    const stub = new StubRepository();
    setPassageRepository(stub);
    searchVerseText('sqlite-only', 'BSB', 500);
    expect(stub.lastLimit).toBe(VERSE_SEARCH_MAX);
  });
});

describe('sqlite verse search adapter', () => {
  it('escapes LIKE wildcards and never interpolates the query', () => {
    const calls: Array<{ sql: string; params: Array<string | number> }> = [];
    const reader = {
      getAllSync: <T>(sql: string, params: Array<string | number>): T[] => {
        calls.push({ sql, params });
        return [] as unknown as T[];
      },
      getFirstSync: <T>(): T | null => null,
    };
    const repo = new SqlitePassageRepository(reader, BSB_EDITION_KEY, BSB_REFSYS);
    expect(repo.searchVerses('100%_sure', 'BSB', 20)).toEqual([]);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.sql).toContain("ESCAPE '\\'");
    expect(calls[0]?.params).toEqual([BSB_EDITION_KEY, '%100\\%\\_sure%', 20]);
    expect(calls[0]?.sql).not.toContain('100%_sure');
  });

  it('returns no hits for blank queries or floors below one', () => {
    const reader = {
      getAllSync: <T>(): T[] => {
        throw new Error('must not read');
      },
      getFirstSync: <T>(): T | null => null,
    };
    const repo = new SqlitePassageRepository(reader, BSB_EDITION_KEY, BSB_REFSYS);
    expect(repo.searchVerses('  ', 'BSB', 20)).toEqual([]);
    expect(repo.searchVerses('request', 'BSB', 0)).toEqual([]);
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

(nodeSqlite ? describe : describe.skip)('verse search on a real engine', () => {
  it('finds projected verses by substring with literal wildcard handling', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const bundled = getJsonChapter('Neh', 2, 'BSB');
    if (!bundled) throw new Error('Neh.2 missing from bundled asset');
    const mapped = toChapterInput(bundled.blocks);

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
    await projectChapter(
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

    const reader = {
      getAllSync: <T>(source: string, params: Array<string | number>): T[] =>
        raw.prepare(source).all<T>(...params),
      getFirstSync: <T>(source: string, params: Array<string | number>): T | null =>
        raw.prepare(source).get<T>(...params) ?? null,
    };
    setPassageRepository(new SqlitePassageRepository(reader, BSB_EDITION_KEY, BSB_REFSYS));

    // Distinctive word from the real Neh.2.4 text (committed asset).
    const verseText = getJsonVerseText('Neh', 2, 4, 'BSB') ?? '';
    const word = verseText.split(/[^A-Za-z]+/).find((part) => part.length > 5) ?? 'request';
    const hits = searchVerseText(word, 'BSB');
    expect(hits.length).toBeGreaterThan(0);
    expect(hits).toContainEqual({
      bookOsis: 'Neh',
      chapter: 2,
      verse: 4,
      text: verseText,
    });
    // A literal percent matches nothing: wildcards never activate.
    expect(searchVerseText('100%', 'BSB')).toEqual([]);
    raw.close();
  });
});

if (!nodeSqlite) {
  it.skip('SKIP: node:sqlite unavailable (needs Node 22 + --experimental-sqlite); real-engine search test skipped loudly.', () =>
    undefined);
}
