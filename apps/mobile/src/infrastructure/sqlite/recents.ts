/**
 * SQLite recents repository (mobile-install-06b).
 *
 * Reads and writes the M06b `recents_004` table. Recording upserts the
 * location (re-opens float to the top) and prunes past the cap in the same
 * transaction, so the table stays bounded. Driver errors propagate; the
 * store converts them to `'skipped'` because recents must never break
 * navigation.
 */

import type { PassageDbHandle } from '@/content/passageStore';
import type { RecentEntry, RecentRepository } from '@/content/recentStore';

/** Maximum recents kept per translation; enforced on every write. */
export const RECENT_CAP = 10;

interface RecentRow {
  translation_id: string;
  book: string;
  chapter: number;
  opened_at: string;
}

export class SqliteRecents implements RecentRepository {
  constructor(private readonly db: PassageDbHandle) {}

  listRecents(translationId: string, limit: number): RecentEntry[] {
    const rows = this.db.getAllSync<RecentRow>(
      'SELECT translation_id, book, chapter, opened_at FROM recents WHERE translation_id = ? ORDER BY opened_at DESC, id DESC LIMIT ?',
      [translationId, Math.max(1, Math.floor(limit))],
    );
    return rows.map((row) => ({
      translationId: row.translation_id,
      bookOsis: row.book,
      chapter: row.chapter,
      openedAt: row.opened_at,
    }));
  }

  async recordRecent(entry: RecentEntry): Promise<void> {
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        'INSERT INTO recents (translation_id, book, chapter, opened_at) VALUES (?, ?, ?, ?) ON CONFLICT (translation_id, book, chapter) DO UPDATE SET opened_at = excluded.opened_at',
        [entry.translationId, entry.bookOsis, entry.chapter, entry.openedAt],
      );
      await this.db.runAsync(
        'DELETE FROM recents WHERE translation_id = ? AND id NOT IN (SELECT id FROM recents WHERE translation_id = ? ORDER BY opened_at DESC, id DESC LIMIT ?)',
        [entry.translationId, entry.translationId, RECENT_CAP],
      );
    });
  }
}
