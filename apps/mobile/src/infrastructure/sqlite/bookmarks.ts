/**
 * SQLite bookmark repository (mobile-install-06a).
 *
 * Reads the M06a `library_003` tables. Every toggle writes the bookmark row
 * AND its outbox op inside one transaction, so a force-close can never
 * persist one without the other. Driver errors propagate so the caller can
 * render error-and-retry; they are never swallowed into silent state.
 */

import type { PassageDbHandle } from '@/content/passageStore';
import type {
  Bookmark,
  BookmarkRepository,
  OutboxOp,
  RemoteTombstoneLocal,
} from '@/content/bookmarkStore';

interface BookmarkRow {
  id: string;
  translation_id: string;
  book: string;
  chapter: number;
  created_at: string;
}

interface OutboxRow {
  seq: number;
  op: string;
  entity: string;
  entity_id: string;
  payload: string;
  created_at: string;
  status: string;
}

function toBookmark(row: BookmarkRow): Bookmark {
  return {
    id: row.id,
    translationId: row.translation_id,
    bookOsis: row.book,
    chapter: row.chapter,
    createdAt: row.created_at,
  };
}

export class SqliteBookmarks implements BookmarkRepository {
  constructor(private readonly db: PassageDbHandle) {}

  listBookmarks(translationId: string): Bookmark[] {
    const rows = this.db.getAllSync<BookmarkRow>(
      'SELECT id, translation_id, book, chapter, created_at FROM bookmarks WHERE translation_id = ? ORDER BY created_at DESC, rowid DESC',
      [translationId],
    );
    return rows.map(toBookmark);
  }

  isBookmarked(translationId: string, bookOsis: string, chapter: number): boolean {
    const row = this.db.getFirstSync<{ id: string }>(
      'SELECT id FROM bookmarks WHERE translation_id = ? AND book = ? AND chapter = ?',
      [translationId, bookOsis, chapter],
    );
    return row !== null;
  }

  listPendingOps(): OutboxOp[] {
    const rows = this.db.getAllSync<OutboxRow>(
      'SELECT seq, op, entity, entity_id, payload, created_at, status FROM outbox WHERE status = ? ORDER BY seq ASC',
      ['pending'],
    );
    return rows.map((row) => ({
      seq: row.seq,
      op: row.op as OutboxOp['op'],
      entity: row.entity,
      entityId: row.entity_id,
      payload: row.payload,
      createdAt: row.created_at,
      status: row.status as OutboxOp['status'],
    }));
  }

  async toggleBookmark(row: Bookmark): Promise<{ bookmarked: boolean }> {
    let bookmarked = false;
    await this.db.withTransactionAsync(async () => {
      const existing = this.db.getFirstSync<BookmarkRow>(
        'SELECT id, translation_id, book, chapter, created_at FROM bookmarks WHERE translation_id = ? AND book = ? AND chapter = ?',
        [row.translationId, row.bookOsis, row.chapter],
      );
      if (existing) {
        await this.db.runAsync('DELETE FROM bookmarks WHERE id = ?', [existing.id]);
        await this.db.runAsync(
          "INSERT INTO outbox (op, entity, entity_id, payload, created_at, status) VALUES ('bookmark.remove', 'bookmark', ?, ?, ?, 'pending')",
          [
            existing.id,
            JSON.stringify({
              translation_id: existing.translation_id,
              book: existing.book,
              chapter: existing.chapter,
            }),
            row.createdAt,
          ],
        );
        bookmarked = false;
        return;
      }
      await this.db.runAsync(
        'INSERT INTO bookmarks (id, translation_id, book, chapter, created_at) VALUES (?, ?, ?, ?, ?)',
        [row.id, row.translationId, row.bookOsis, row.chapter, row.createdAt],
      );
      await this.db.runAsync(
        "INSERT INTO outbox (op, entity, entity_id, payload, created_at, status) VALUES ('bookmark.add', 'bookmark', ?, ?, ?, 'pending')",
        [
          row.id,
          JSON.stringify({
            translation_id: row.translationId,
            book: row.bookOsis,
            chapter: row.chapter,
          }),
          row.createdAt,
        ],
      );
      bookmarked = true;
    });
    return { bookmarked };
  }

  async ackOps(seqs: number[]): Promise<void> {
    const clean = seqs.filter((seq) => Number.isInteger(seq) && seq > 0);
    if (clean.length === 0) return;
    await this.db.withTransactionAsync(async () => {
      for (const seq of clean) {
        await this.db.runAsync('DELETE FROM outbox WHERE seq = ?', [seq]);
      }
    });
  }

  async applyRemoteBookmarks(rows: Bookmark[]): Promise<{ inserted: number }> {
    let inserted = 0;
    if (rows.length === 0) return { inserted };
    await this.db.withTransactionAsync(async () => {
      for (const row of rows) {
        if (!row.translationId || !row.bookOsis || !Number.isInteger(row.chapter)) continue;
        if (row.chapter < 1) continue;
        const existing = this.db.getFirstSync<{ id: string; created_at: string }>(
          'SELECT id, created_at FROM bookmarks WHERE translation_id = ? AND book = ? AND chapter = ?',
          [row.translationId, row.bookOsis, row.chapter],
        );
        if (existing) {
          // Union merge keeps the earliest created_at for the location.
          // The local id is kept stable so pending outbox ops stay linked;
          // server removes converge by location, not by id (see syncEngine).
          if (row.createdAt < existing.created_at) {
            await this.db.runAsync('UPDATE bookmarks SET created_at = ? WHERE id = ?', [
              row.createdAt,
              existing.id,
            ]);
          }
          continue;
        }
        await this.db.runAsync(
          'INSERT OR IGNORE INTO bookmarks (id, translation_id, book, chapter, created_at) VALUES (?, ?, ?, ?, ?)',
          [row.id, row.translationId, row.bookOsis, row.chapter, row.createdAt],
        );
        inserted += 1;
      }
    });
    return { inserted };
  }

  async applyRemoteTombstones(rows: RemoteTombstoneLocal[]): Promise<{ removed: number }> {
    let removed = 0;
    if (rows.length === 0) return { removed };
    await this.db.withTransactionAsync(async () => {
      for (const row of rows) {
        if (!row.translationId || !row.bookOsis || !Number.isInteger(row.chapter)) continue;
        if (row.chapter < 1 || !row.deletedAt) continue;
        // Canonical ISO strings compare lexicographically; the engine
        // normalizes before calling. Newer local rows survive the delete.
        const result = await this.db.runAsync(
          'DELETE FROM bookmarks WHERE translation_id = ? AND book = ? AND chapter = ? AND created_at <= ?',
          [row.translationId, row.bookOsis, row.chapter, row.deletedAt],
        );
        removed += result.changes;
      }
    });
    return { removed };
  }
}
