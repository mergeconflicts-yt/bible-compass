/**
 * Airplane-mode journey (mobile-install-06b exit gate).
 *
 * One file-backed database on a real engine (`node:sqlite`, needs Node 22 +
 * --experimental-sqlite via the `test` script) proves the offline loop with
 * no network and no bundle reads: project Nehemiah 2, find a verse by text
 * search, bookmark its chapter, open it (recent), force-close, reopen, and
 * lose nothing.
 */

import { getChapter as getJsonChapter } from '../src/content/bsb';
import {
  BSB_EDITION_KEY,
  BSB_REFSYS,
  resetPassageStore,
  searchVerseText,
  setPassageRepository,
  toChapterInput,
} from '../src/content/passageStore';
import {
  initializeBookmarkStore,
  isBookmarked,
  listPendingOps,
  resetBookmarkStore,
  toggleBookmark,
} from '../src/content/bookmarkStore';
import {
  initializeRecentStore,
  listRecents,
  recordRecent,
  resetRecentStore,
} from '../src/content/recentStore';
import type { PassageDbHandle } from '../src/content/passageStore';
import { SqlitePassageRepository } from '../src/infrastructure/sqlite/passageRepository';
import { SqliteBookmarks } from '../src/infrastructure/sqlite/bookmarks';
import { SqliteRecents } from '../src/infrastructure/sqlite/recents';
import { projectChapter } from '../src/infrastructure/sqlite/projection';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';
import type { HashSql } from '../src/infrastructure/sqlite/types';

declare const require: (path: string) => unknown;

// Node builtins via require (same convention as sqlite-projection.test.ts:
// no @types/node in this project, so no static `import ... from 'fs'`).
const { mkdtempSync, rmSync } = require('fs') as {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, opts: { recursive: boolean; force: boolean }) => void;
};
const { tmpdir } = require('os') as { tmpdir: () => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

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

function openHandle(
  engine: NodeSqliteModule,
  path: string,
): { handle: PassageDbHandle; close: () => void } {
  const raw = new engine.DatabaseSync(path);
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
    getAllAsync: async <T>(source: string, params: Array<string | number> = []): Promise<T[]> =>
      raw.prepare(source).all<T>(...params),
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
}

afterEach(() => {
  resetPassageStore();
  resetBookmarkStore();
  resetRecentStore();
});

(nodeSqlite ? describe : describe.skip)('airplane-mode journey', () => {
  it('searches, bookmarks, reopens, and loses nothing across a force-close', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const dir = mkdtempSync(join(tmpdir(), 'm06b-journey-'));
    const file = join(dir, 'offline.db');
    try {
      const engine = nodeSqlite as NodeSqliteModule;
      const first = openHandle(engine, file);
      await first.handle.execAsync(LEDGER_SQL);
      for (const migration of MIGRATIONS) {
        await first.handle.execAsync(migration.sql);
      }
      const nodeCrypto = require('crypto') as NodeCrypto;
      const nodeHash: HashSql = async (text: string) =>
        `sha256:${nodeCrypto.createHash('sha256').update(text, 'utf8').digest('hex')}`;
      const bundled = getJsonChapter('Neh', 2, 'BSB');
      if (!bundled) throw new Error('Neh.2 missing from bundled asset');
      const mapped = toChapterInput(bundled.blocks);
      await projectChapter(
        first.handle,
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

      // Wire all three stores to the offline database (no bundle reads below).
      setPassageRepository(new SqlitePassageRepository(first.handle, BSB_EDITION_KEY, BSB_REFSYS));
      let ids = 0;
      initializeBookmarkStore({
        createRepository: (db) => new SqliteBookmarks(db),
        db: first.handle,
        newId: () => `journey-${(ids += 1)}`,
      });
      initializeRecentStore({
        createRepository: (db) => new SqliteRecents(db),
        db: first.handle,
      });

      // 1. Verse-text search finds Nehemiah 2:4 offline.
      const hits = searchVerseText('request', 'BSB');
      expect(hits).toContainEqual(
        expect.objectContaining({ bookOsis: 'Neh', chapter: 2, verse: 4 }),
      );

      // 2. Bookmark the chapter; the mutation is durably queued.
      await expect(toggleBookmark('BSB', 'Neh', 2)).resolves.toEqual({ bookmarked: true });
      expect(listPendingOps().map((op) => op.op)).toEqual(['bookmark.add']);

      // 3. Open the chapter; it lands in recents.
      await expect(recordRecent('BSB', 'Neh', 2)).resolves.toBe('recorded');
      first.close();

      // 4. Force-close equivalent: fresh handles on the same file.
      resetPassageStore();
      resetBookmarkStore();
      resetRecentStore();
      const second = openHandle(engine, file);
      setPassageRepository(new SqlitePassageRepository(second.handle, BSB_EDITION_KEY, BSB_REFSYS));
      initializeBookmarkStore({
        createRepository: (db) => new SqliteBookmarks(db),
        db: second.handle,
        newId: () => `journey-${(ids += 1)}`,
      });
      initializeRecentStore({
        createRepository: (db) => new SqliteRecents(db),
        db: second.handle,
      });

      expect(searchVerseText('request', 'BSB')).toContainEqual(
        expect.objectContaining({ bookOsis: 'Neh', chapter: 2, verse: 4 }),
      );
      expect(isBookmarked('BSB', 'Neh', 2)).toBe(true);
      expect(listRecents('BSB').map((entry) => `${entry.bookOsis}.${entry.chapter}`)).toEqual([
        'Neh.2',
      ]);
      // The queue survived too: sync (M07) will find exactly one pending op.
      expect(listPendingOps().map((op) => op.op)).toEqual(['bookmark.add']);
      second.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

if (!nodeSqlite) {
  it.skip('SKIP: node:sqlite unavailable (needs Node 22 + --experimental-sqlite); airplane-mode journey test skipped loudly.', () =>
    undefined);
}
