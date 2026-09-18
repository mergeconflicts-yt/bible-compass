/**
 * Bookmark sync engine (mobile-install-07b).
 *
 * Engine tests against in-memory fakes (no native modules, no network):
 * fail-closed unconfigured/anonymous states, BSB-only push with ops left
 * pending for other translations, op-log replay order with tombstone-wins,
 * idempotent retry after partial failure, union-merge pull without outbox
 * echo, remote validation, cursor persistence, and auth-error propagation.
 */

import {
  BOOKMARKS_CURSOR_KEY,
  SyncError,
  fromServerLocation,
  initializeSyncEngine,
  isSyncReady,
  resetSyncEngine,
  syncNow,
  toServerLocation,
  type BookmarkRemoteSource,
  type RemoteBookmark,
  type SyncCursorStore,
  type SyncResult,
} from '../src/content/syncEngine';
import type { Bookmark, BookmarkRepository, OutboxOp } from '../src/content/bookmarkStore';
import type { PassageDbHandle } from '../src/content/passageStore';
import { SqliteBookmarks } from '../src/infrastructure/sqlite/bookmarks';
import { SqliteSyncState } from '../src/infrastructure/sqlite/syncState';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';

declare const require: (path: string) => unknown;

function bsbPayload(book: string, chapter: number): string {
  return JSON.stringify({ translation_id: 'BSB', book, chapter });
}

class FakeBookmarks implements BookmarkRepository {
  marks = new Map<string, Bookmark>();
  ops: OutboxOp[] = [];
  private seq = 0;

  private locationKey(translationId: string, bookOsis: string, chapter: number): string {
    return `${translationId}:${bookOsis}.${chapter}`;
  }

  enqueue(
    op: OutboxOp['op'],
    entityId: string,
    payload: string,
    createdAt = '2026-09-15T08:00:00.000Z',
  ): void {
    this.ops.push({
      seq: (this.seq += 1),
      op,
      entity: 'bookmark',
      entityId,
      payload,
      createdAt,
      status: 'pending',
    });
  }

  seedBookmark(mark: Bookmark): void {
    this.marks.set(this.locationKey(mark.translationId, mark.bookOsis, mark.chapter), mark);
  }

  listBookmarks(translationId: string): Bookmark[] {
    return [...this.marks.values()].filter((mark) => mark.translationId === translationId);
  }

  isBookmarked(translationId: string, bookOsis: string, chapter: number): boolean {
    return this.marks.has(this.locationKey(translationId, bookOsis, chapter));
  }

  listPendingOps(): OutboxOp[] {
    return [...this.ops];
  }

  async toggleBookmark(row: Bookmark): Promise<{ bookmarked: boolean }> {
    const key = this.locationKey(row.translationId, row.bookOsis, row.chapter);
    if (this.marks.has(key)) {
      this.marks.delete(key);
      this.enqueue('bookmark.remove', row.id, bsbPayload(row.bookOsis, row.chapter));
      return { bookmarked: false };
    }
    this.marks.set(key, row);
    this.enqueue('bookmark.add', row.id, bsbPayload(row.bookOsis, row.chapter));
    return { bookmarked: true };
  }

  async ackOps(seqs: number[]): Promise<void> {
    const acked = new Set(seqs);
    this.ops = this.ops.filter((op) => !acked.has(op.seq));
  }

  async applyRemoteBookmarks(rows: Bookmark[]): Promise<{ inserted: number }> {
    let inserted = 0;
    for (const row of rows) {
      const key = this.locationKey(row.translationId, row.bookOsis, row.chapter);
      const existing = this.marks.get(key);
      if (existing) {
        if (row.createdAt < existing.createdAt) {
          this.marks.set(key, { ...existing, createdAt: row.createdAt });
        }
        continue;
      }
      this.marks.set(key, row);
      inserted += 1;
    }
    return { inserted };
  }
}

class FakeCursors implements SyncCursorStore {
  values = new Map<string, string>();

  getCursor(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  async setCursor(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }
}

class FakeRemote implements BookmarkRemoteSource {
  /** Server rows keyed by client id. */
  rows = new Map<string, RemoteBookmark>();
  calls: string[] = [];
  failPushAt = -1;
  failPull = false;
  authFailure = false;

  async pushAdd(row: RemoteBookmark): Promise<void> {
    this.calls.push(`add:${row.id}`);
    if (this.authFailure) throw new SyncError('auth', 'session expired');
    if (this.calls.length === this.failPushAt) throw new SyncError('network', 'offline');
    this.rows.set(row.id, row);
  }

  async pushRemove(refsys: string, localKey: string): Promise<void> {
    this.calls.push(`remove:${refsys}:${localKey}`);
    if (this.authFailure) throw new SyncError('auth', 'session expired');
    if (this.calls.length === this.failPushAt) throw new SyncError('network', 'offline');
    for (const [id, row] of this.rows) {
      if (row.refsys === refsys && row.localKey === localKey) this.rows.delete(id);
    }
  }

  async pull(): Promise<RemoteBookmark[]> {
    this.calls.push('pull');
    if (this.authFailure) throw new SyncError('auth', 'session expired');
    if (this.failPull) throw new SyncError('network', 'offline');
    return [...this.rows.values()];
  }
}

const NOW = '2026-09-15T09:00:00.000Z';

function initEngine(
  bookmarks: FakeBookmarks,
  remote: FakeRemote,
  cursors: FakeCursors,
  userId: string | null = 'user-1',
): void {
  initializeSyncEngine({
    bookmarks,
    cursors,
    remote,
    getUserId: () => userId,
    nowIso: () => NOW,
  });
}

beforeEach(() => {
  resetSyncEngine();
});

afterEach(() => {
  resetSyncEngine();
});

describe('sync identity mapping', () => {
  it('maps BSB chapters to the English reference system', () => {
    expect(toServerLocation('BSB', 'Neh', 2)).toEqual({
      refsys: 'refsys:eng-v22',
      localKey: 'Neh.2',
    });
  });

  it('refuses non-BSB translations so they stay local-only', () => {
    expect(toServerLocation('tel_irv', 'Neh', 2)).toBeNull();
    expect(toServerLocation('tam_irv', 'Neh', 2)).toBeNull();
    expect(toServerLocation('', 'Neh', 2)).toBeNull();
    expect(toServerLocation('BSB', 'Neh', 0)).toBeNull();
  });

  it('parses server keys and rejects malformed ones', () => {
    expect(fromServerLocation('Neh.2')).toEqual({ bookOsis: 'Neh', chapter: 2 });
    expect(fromServerLocation('Neh.0')).toBeNull();
    expect(fromServerLocation('Neh')).toBeNull();
    expect(fromServerLocation('')).toBeNull();
    expect(fromServerLocation('Neh.2.4')).toBeNull();
  });
});

describe('sync engine', () => {
  it('fails closed when uninitialized or anonymous', async () => {
    expect(isSyncReady()).toBe(false);
    await expect(syncNow()).rejects.toMatchObject({ code: 'unconfigured' });

    initEngine(new FakeBookmarks(), new FakeRemote(), new FakeCursors(), null);
    expect(isSyncReady()).toBe(true);
    await expect(syncNow()).rejects.toMatchObject({ code: 'anonymous' });
  });

  it('pushes adds then removes in order; the remove wins on the server', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    const cursors = new FakeCursors();
    initEngine(bookmarks, remote, cursors);
    bookmarks.enqueue('bookmark.add', 'client-1', bsbPayload('Neh', 2));
    bookmarks.enqueue('bookmark.remove', 'client-1', bsbPayload('Neh', 2));

    const result: SyncResult = await syncNow();

    expect(result.pushed).toBe(2);
    expect(remote.calls).toEqual(['add:client-1', 'remove:refsys:eng-v22:Neh.2', 'pull']);
    expect(remote.rows.size).toBe(0);
    expect(bookmarks.listPendingOps()).toEqual([]);
    expect(cursors.getCursor(BOOKMARKS_CURSOR_KEY)).toBe(NOW);
  });

  it('leaves non-BSB ops pending while BSB ops still push', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    initEngine(bookmarks, remote, new FakeCursors());
    bookmarks.enqueue(
      'bookmark.add',
      'client-te',
      JSON.stringify({ translation_id: 'tel_irv', book: 'Neh', chapter: 2 }),
    );
    bookmarks.enqueue('bookmark.add', 'client-bsb', bsbPayload('Ezra', 4));

    const result = await syncNow();

    expect(result.pushed).toBe(1);
    expect(result.skippedNonBsb).toBe(1);
    expect(remote.rows.has('client-bsb')).toBe(true);
    expect(remote.rows.has('client-te')).toBe(false);
    expect(bookmarks.listPendingOps().map((op) => op.entityId)).toEqual(['client-te']);
  });

  it('leaves malformed ops pending and counts them', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    initEngine(bookmarks, remote, new FakeCursors());
    bookmarks.enqueue('bookmark.add', 'client-bad', 'not-json');
    bookmarks.enqueue('bookmark.add', 'client-bad-chapter', bsbPayload('Neh', 0));
    bookmarks.enqueue('bookmark.add', 'client-good', bsbPayload('Neh', 2));

    const result = await syncNow();

    expect(result.pushed).toBe(1);
    expect(result.skippedInvalid).toBe(2);
    expect(bookmarks.listPendingOps()).toHaveLength(2);
  });

  it('acks partial progress before surfacing a network failure, then converges on retry', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    initEngine(bookmarks, remote, new FakeCursors());
    bookmarks.enqueue('bookmark.add', 'client-1', bsbPayload('Neh', 2));
    bookmarks.enqueue('bookmark.add', 'client-2', bsbPayload('Ezra', 4));
    remote.failPushAt = 2;

    await expect(syncNow()).rejects.toMatchObject({ code: 'network' });
    expect(bookmarks.listPendingOps().map((op) => op.entityId)).toEqual(['client-2']);
    expect(remote.rows.has('client-1')).toBe(true);

    // Retry replays only the remainder (idempotent by client id).
    remote.failPushAt = -1;
    const result = await syncNow();
    expect(result.pushed).toBe(1);
    expect(bookmarks.listPendingOps()).toEqual([]);
    expect(remote.rows.size).toBe(2);
  });

  it('propagates expired sessions without acking the failed op', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    remote.authFailure = true;
    initEngine(bookmarks, remote, new FakeCursors());
    bookmarks.enqueue('bookmark.add', 'client-1', bsbPayload('Neh', 2));

    await expect(syncNow()).rejects.toMatchObject({ code: 'auth' });
    expect(bookmarks.listPendingOps()).toHaveLength(1);
  });

  it('pulls missing server rows locally without creating outbox echo', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    const cursors = new FakeCursors();
    initEngine(bookmarks, remote, cursors);
    remote.rows.set('server-1', {
      id: 'server-1',
      refsys: 'refsys:eng-v22',
      localKey: 'Neh.2',
      createdAt: '2026-09-14T08:00:00.000Z',
    });

    const result = await syncNow();

    expect(result.pulled).toBe(1);
    expect(result.inserted).toBe(1);
    expect(bookmarks.isBookmarked('BSB', 'Neh', 2)).toBe(true);
    // The merge writes no outbox ops, so the next sync pushes nothing.
    expect(bookmarks.listPendingOps()).toEqual([]);
    expect(cursors.getCursor(BOOKMARKS_CURSOR_KEY)).toBe(NOW);
  });

  it('keeps the earliest created_at on union merge and ignores foreign rows', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    initEngine(bookmarks, remote, new FakeCursors());
    bookmarks.seedBookmark({
      id: 'local-1',
      translationId: 'BSB',
      bookOsis: 'Neh',
      chapter: 2,
      createdAt: '2026-09-15T08:00:00.000Z',
    });
    remote.rows.set('server-older', {
      id: 'server-older',
      refsys: 'refsys:eng-v22',
      localKey: 'Neh.2',
      createdAt: '2026-09-14T08:00:00.000Z',
    });
    remote.rows.set('server-other-refsys', {
      id: 'server-other',
      refsys: 'refsys:tel-v1',
      localKey: 'Neh.2',
      createdAt: '2026-09-14T08:00:00.000Z',
    });
    remote.rows.set('server-bad-key', {
      id: 'server-bad',
      refsys: 'refsys:eng-v22',
      localKey: '???',
      createdAt: '2026-09-14T08:00:00.000Z',
    });

    const result = await syncNow();

    expect(result.inserted).toBe(0);
    expect(result.skippedRemote).toBe(2);
    expect(bookmarks.listBookmarks('BSB')).toHaveLength(1);
    expect(bookmarks.listPendingOps()).toEqual([]);
  });

  it('does not move the cursor when the pull fails', async () => {
    const bookmarks = new FakeBookmarks();
    const remote = new FakeRemote();
    const cursors = new FakeCursors();
    remote.failPull = true;
    initEngine(bookmarks, remote, cursors);

    await expect(syncNow()).rejects.toMatchObject({ code: 'network' });
    expect(cursors.getCursor(BOOKMARKS_CURSOR_KEY)).toBeNull();
  });
});

interface NodeSqliteStatement {
  all<T>(...params: (string | number)[]): T[];
  get<T>(...params: (string | number)[]): T | undefined;
  run(...params: (string | number)[]): {
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

const { mkdtempSync, rmSync } = require('fs') as {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, opts: { recursive: boolean; force: boolean }) => void;
};
const { tmpdir } = require('os') as { tmpdir: () => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

function openFileHandle(file: string): { handle: PassageDbHandle; close: () => void } {
  if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
  const raw = new (nodeSqlite as NodeSqliteModule).DatabaseSync(file);
  raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const handle: PassageDbHandle = {
    execAsync: async (source: string): Promise<void> => {
      raw.exec(source);
    },
    runAsync: async (source: string, params: (string | number)[] = []) => {
      const result = raw.prepare(source).run(...params);
      return {
        lastInsertRowId: Number(result.lastInsertRowid),
        changes: Number(result.changes),
      };
    },
    getAllAsync: async <T>(source: string, params: (string | number)[] = []): Promise<T[]> =>
      raw.prepare(source).all<T>(...params),
    getAllSync: <T>(source: string, params: (string | number)[]): T[] =>
      raw.prepare(source).all<T>(...params),
    getFirstSync: <T>(source: string, params: (string | number)[]): T | null =>
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

(nodeSqlite ? describe : describe.skip)('sync adapters on a real engine', () => {
  it('acks only listed outbox rows and merges remote rows without echo', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const dir = mkdtempSync(join(tmpdir(), 'm07b-sync-'));
    const file = join(dir, 'sync.db');
    try {
      const opened = openFileHandle(file);
      await opened.handle.execAsync(LEDGER_SQL);
      for (const migration of MIGRATIONS) {
        await opened.handle.execAsync(migration.sql);
      }
      const repo = new SqliteBookmarks(opened.handle);
      const cursors = new SqliteSyncState(opened.handle);

      await repo.toggleBookmark({
        id: 'local-1',
        translationId: 'BSB',
        bookOsis: 'Neh',
        chapter: 2,
        createdAt: '2026-09-15T08:00:00.000Z',
      });
      await repo.toggleBookmark({
        id: 'local-2',
        translationId: 'BSB',
        bookOsis: 'Ezra',
        chapter: 4,
        createdAt: '2026-09-15T08:01:00.000Z',
      });
      expect(repo.listPendingOps()).toHaveLength(2);

      // Acking one row leaves the other pending.
      await repo.ackOps([repo.listPendingOps()[0]?.seq ?? 0]);
      expect(repo.listPendingOps()).toHaveLength(1);

      // Remote merge inserts the missing chapter, keeps the local id and
      // earliest created_at for the known location, and writes no outbox.
      const merged = await repo.applyRemoteBookmarks([
        {
          id: 'server-older',
          translationId: 'BSB',
          bookOsis: 'Neh',
          chapter: 2,
          createdAt: '2026-09-14T08:00:00.000Z',
        },
        {
          id: 'server-new',
          translationId: 'BSB',
          bookOsis: 'Esth',
          chapter: 1,
          createdAt: '2026-09-14T08:00:00.000Z',
        },
      ]);
      expect(merged).toEqual({ inserted: 1 });
      expect(repo.isBookmarked('BSB', 'Esth', 1)).toBe(true);
      const neh = repo.listBookmarks('BSB').find((mark) => mark.bookOsis === 'Neh');
      expect(neh).toMatchObject({ id: 'local-1', createdAt: '2026-09-14T08:00:00.000Z' });
      expect(repo.listPendingOps()).toHaveLength(1);

      // Cursor round-trips and overwrites.
      expect(cursors.getCursor(BOOKMARKS_CURSOR_KEY)).toBeNull();
      await cursors.setCursor(BOOKMARKS_CURSOR_KEY, NOW);
      expect(cursors.getCursor(BOOKMARKS_CURSOR_KEY)).toBe(NOW);
      opened.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

if (!nodeSqlite) {
  it.skip('SKIP: node:sqlite unavailable (needs Node 22 + --experimental-sqlite); sync adapter test skipped loudly.', () =>
    undefined);
}
