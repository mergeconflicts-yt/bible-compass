/**
 * SQLite progress repository (mobile-install-06c).
 *
 * Reads and writes the M06c `progress_005` table: one row per translation,
 * upserted atomically by the single statement (no multi-table transaction
 * needed). Driver errors propagate; the store converts them to `'skipped'`
 * because progress must never break the reader.
 */

import type { PassageDbHandle } from '@/content/passageStore';
import type { ProgressEntry, ProgressRepository } from '@/content/progressStore';

interface ProgressRow {
  translation_id: string;
  book: string;
  chapter: number;
  verse: number;
  updated_at: string;
}

export class SqliteProgress implements ProgressRepository {
  constructor(private readonly db: PassageDbHandle) {}

  getProgress(translationId: string): ProgressEntry | null {
    const row = this.db.getFirstSync<ProgressRow>(
      'SELECT translation_id, book, chapter, verse, updated_at FROM progress WHERE translation_id = ?',
      [translationId],
    );
    if (!row) return null;
    return {
      translationId: row.translation_id,
      bookOsis: row.book,
      chapter: row.chapter,
      verse: row.verse,
      updatedAt: row.updated_at,
    };
  }

  async recordProgress(entry: ProgressEntry): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO progress (translation_id, book, chapter, verse, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT (translation_id) DO UPDATE SET book = excluded.book, chapter = excluded.chapter, verse = excluded.verse, updated_at = excluded.updated_at',
      [entry.translationId, entry.bookOsis, entry.chapter, entry.verse, entry.updatedAt],
    );
  }
}
