/**
 * Durable bookmarks + outbox (mobile-install-06a).
 *
 * Part A proves the store contract against an in-memory fake handle:
 * toggle writes the bookmark row AND its outbox op atomically, reads are
 * newest-first, and the uninitialized store fails closed. Part B proves the
 * airplane-mode journey on a real engine (`node:sqlite`, needs Node 22 +
 * --experimental-sqlite via the `test` script): toggle, close, reopen the
 * database file, and the bookmark plus its outbox op survive.
 */

import {
  initializeBookmarkStore,
  isBookmarked,
  listBookmarks,
  listPendingOps,
  resetBookmarkStore,
  toggleBookmark,
  type Bookmark,
} from '../src/content/bookmarkStore';
import type { PassageDbHandle } from '../src/content/passageStore';
import { SqliteBookmarks } from '../src/infrastructure/sqlite/bookmarks';
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

interface StoredBookmark {
  id: string;
  translation_id: string;
  book: string;
  chapter: number;
  created_at: string;
}

interface StoredOp {
  seq: number;
  op: string;
  entity: string;
  entity_id: string;
  payload: string;
  created_at: string;
  status: string;
}

class FakeBookmarkHandle implements PassageDbHandle {
  bookmarks = new Map<string, StoredBookmark>();
  outbox: StoredOp[] = [];
  failOutboxWrites = false;

  async execAsync(): Promise<void> {}

  async runAsync(
    source: string,
    params: Array<string | number> = [],
  ): Promise<{ lastInsertRowId: number; changes: number }> {
    if (source.startsWith('INSERT INTO bookmarks')) {
      const [id, translation_id, book, chapter, created_at] = params;
      this.bookmarks.set(String(id), {
        id: String(id),
        translation_id: String(translation_id),
        book: String(book),
        chapter: Number(chapter),
        created_at: String(created_at),
      });
      return { lastInsertRowId: this.bookmarks.size, changes: 1 };
    }
    if (source.startsWith('DELETE FROM bookmarks')) {
      const deleted = this.bookmarks.delete(String(params[0])) ? 1 : 0;
      return { lastInsertRowId: 0, changes: deleted };
    }
    if (source.startsWith('INSERT INTO outbox')) {
      if (this.failOutboxWrites) throw new Error('fake outbox failure');
      // op/entity travel as SQL literals; only id, payload, instant are bound.
      const literals = /VALUES \('([^']+)', '([^']+)'/.exec(source);
      const [entity_id, payload, created_at] = params;
      this.outbox.push({
        seq: this.outbox.length + 1,
        op: literals?.[1] ?? 'bookmark.add',
        entity: literals?.[2] ?? 'bookmark',
        entity_id: String(entity_id),
        payload: String(payload),
        created_at: String(created_at),
        status: 'pending',
      });
      return { lastInsertRowId: this.outbox.length, changes: 1 };
    }
    throw new Error(`fake cannot run: ${source}`);
  }

  async getAllAsync<T>(): Promise<T[]> {
    return [];
  }

  getAllSync<T>(source: string, params: Array<string | number>): T[] {
    if (source.includes('FROM bookmarks')) {
      const [translation_id] = params;
      return [...this.bookmarks.values()]
        .filter((row) => row.translation_id === String(translation_id))
        .sort(
          (a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id),
        ) as unknown as T[];
    }
    if (source.includes('FROM outbox')) {
      return this.outbox.filter((row) => row.status === 'pending') as unknown as T[];
    }
    throw new Error(`fake cannot read: ${source}`);
  }

  getFirstSync<T>(source: string, params: Array<string | number>): T | null {
    if (source.includes('FROM bookmarks')) {
      if (source.includes('book = ?')) {
        const [translation_id, book, chapter] = params;
        const found = [...this.bookmarks.values()].find(
          (row) =>
            row.translation_id === String(translation_id) &&
            row.book === String(book) &&
            row.chapter === Number(chapter),
        );
        return (found ?? null) as unknown as T | null;
      }
      const found = this.bookmarks.get(String(params[0]));
      return (found ?? null) as unknown as T | null;
    }
    throw new Error(`fake cannot read: ${source}`);
  }

  async withTransactionAsync(task: () => Promise<void>): Promise<void> {
    const snapshot = { bookmarks: new Map(this.bookmarks), outbox: [...this.outbox] };
    try {
      await task();
    } catch (error) {
      this.bookmarks = snapshot.bookmarks;
      this.outbox = snapshot.outbox;
      throw error;
    }
  }
}

let ids = 0;

function initStore(fake: FakeBookmarkHandle): void {
  initializeBookmarkStore({
    createRepository: (db) => new SqliteBookmarks(db),
    db: fake,
    newId: () => `client-${(ids += 1)}`,
  });
}

beforeEach(() => {
  resetBookmarkStore();
  ids = 0;
});

afterEach(() => {
  resetBookmarkStore();
});

describe('bookmark store', () => {
  it('toggles a chapter on with a durable pending outbox op', async () => {
    const fake = new FakeBookmarkHandle();
    initStore(fake);
    await expect(toggleBookmark('BSB', 'Neh', 2)).resolves.toEqual({ bookmarked: true });
    expect(isBookmarked('BSB', 'Neh', 2)).toBe(true);
    expect(listBookmarks('BSB')).toHaveLength(1);
    expect(listBookmarks('BSB')[0]).toMatchObject({
      translationId: 'BSB',
      bookOsis: 'Neh',
      chapter: 2,
    });
    const ops = listPendingOps();
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({
      op: 'bookmark.add',
      entity: 'bookmark',
      status: 'pending',
    });
    expect(ops[0]?.entityId).toBe(listBookmarks('BSB')[0]?.id);
    expect(JSON.parse(ops[0]?.payload ?? '')).toEqual({
      translation_id: 'BSB',
      book: 'Neh',
      chapter: 2,
    });
  });

  it('toggles a chapter off with a remove op, keeping history in order', async () => {
    const fake = new FakeBookmarkHandle();
    initStore(fake);
    await toggleBookmark('BSB', 'Neh', 2);
    await expect(toggleBookmark('BSB', 'Neh', 2)).resolves.toEqual({ bookmarked: false });
    expect(isBookmarked('BSB', 'Neh', 2)).toBe(false);
    expect(listBookmarks('BSB')).toHaveLength(0);
    expect(listPendingOps().map((op) => op.op)).toEqual(['bookmark.add', 'bookmark.remove']);
  });

  it('lists newest bookmarks first and scopes by translation', async () => {
    const fake = new FakeBookmarkHandle();
    initStore(fake);
    await toggleBookmark('BSB', 'Neh', 2);
    await toggleBookmark('BSB', 'Ezra', 4);
    await toggleBookmark('tel_irv', 'Neh', 2);
    expect(listBookmarks('BSB').map((mark) => mark.bookOsis)).toEqual(['Ezra', 'Neh']);
    expect(listBookmarks('tel_irv').map((mark) => mark.bookOsis)).toEqual(['Neh']);
    expect(isBookmarked('BSB', 'Neh', 3)).toBe(false);
  });

  it('rolls back the bookmark row when the outbox write fails', async () => {
    const fake = new FakeBookmarkHandle();
    initStore(fake);
    fake.failOutboxWrites = true;
    await expect(toggleBookmark('BSB', 'Neh', 2)).rejects.toThrow('fake outbox failure');
    expect(isBookmarked('BSB', 'Neh', 2)).toBe(false);
    expect(listPendingOps()).toHaveLength(0);
  });

  it('rejects bad locations without touching the database', async () => {
    const fake = new FakeBookmarkHandle();
    initStore(fake);
    for (const bad of [
      ['BSB', 'Neh', 0],
      ['BSB', '', 2],
      ['', 'Neh', 2],
    ] as Array<[string, string, number]>) {
      await expect(toggleBookmark(bad[0], bad[1], bad[2])).rejects.toMatchObject({
        code: 'invalid-input',
      });
    }
    expect(listBookmarks('BSB')).toHaveLength(0);
    expect(listPendingOps()).toHaveLength(0);
  });

  it('fails closed when uninitialized: empty reads, typed write errors', async () => {
    expect(isBookmarked('BSB', 'Neh', 2)).toBe(false);
    expect(listBookmarks('BSB')).toEqual([]);
    expect(listPendingOps()).toEqual([]);
    await expect(toggleBookmark('BSB', 'Neh', 2)).rejects.toMatchObject({
      code: 'unavailable',
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

(nodeSqlite ? describe : describe.skip)('bookmarks survive a restart on a real engine', () => {
  it('toggles, closes, reopens, and loses nothing', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const dir = mkdtempSync(join(tmpdir(), 'm06a-bookmarks-'));
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
      let counter = 0;
      initializeBookmarkStore({
        createRepository: (db) => new SqliteBookmarks(db),
        db: first.handle,
        newId: () => `restart-${(counter += 1)}`,
      });
      await expect(toggleBookmark('BSB', 'Neh', 2)).resolves.toEqual({ bookmarked: true });
      expect(listBookmarks('BSB')).toHaveLength(1);
      expect(listPendingOps()).toHaveLength(1);
      first.close();

      // Force-close equivalent: fresh handle on the same file, fresh store.
      resetBookmarkStore();
      const second = openHandle(file);
      initializeBookmarkStore({
        createRepository: (db) => new SqliteBookmarks(db),
        db: second.handle,
        newId: () => `restart-${(counter += 1)}`,
      });
      expect(isBookmarked('BSB', 'Neh', 2)).toBe(true);
      const marks: Bookmark[] = listBookmarks('BSB');
      expect(marks).toHaveLength(1);
      expect(marks[0]).toMatchObject({ translationId: 'BSB', bookOsis: 'Neh', chapter: 2 });
      expect(listPendingOps().map((op) => op.op)).toEqual(['bookmark.add']);
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
