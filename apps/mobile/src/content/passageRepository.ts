/**
 * Passage repository contract (feature boundary).
 *
 * Infrastructure adapters implement this interface; screens and hooks
 * depend only on it (via `passageStore`), never on SQLite, Supabase, or
 * bundled-asset modules directly. All methods are synchronous so render
 * paths never restructure around data access.
 */

import type { ChapterBlock } from './bsb';

export type { ChapterBlock } from './bsb';

export interface VerseHit {
  bookOsis: string;
  chapter: number;
  verse: number;
  text: string;
}

export interface PassageRepository {
  /** Chapter blocks in display order, or null when this source lacks the chapter. */
  getChapterBlocks(bookOsis: string, chapter: number, translationId: string): ChapterBlock[] | null;
  /** Plain verse text, or null when absent. */
  getVerseText(
    bookOsis: string,
    chapter: number,
    verse: number,
    translationId: string,
  ): string | null;
  /**
   * Verse-text hits in canonical order, capped at `limit`. Blank queries
   * return no hits; implementations match substrings (no stemming, no
   * separate index artifact).
   */
  searchVerses(query: string, translationId: string, limit: number): VerseHit[];
}
