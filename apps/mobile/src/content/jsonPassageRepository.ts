/**
 * Bundled-JSON passage repository: thin wrapper over the existing
 * `content/bsb` accessors. This is both the pre-SQLite behavior and the
 * permanent offline fallback when SQLite is unavailable or a chapter is
 * not installed.
 */

import { booksFor, getChapter, getVerseText, type ChapterBlock } from './bsb';
import type { PassageRepository, VerseHit } from './passageRepository';

export class JsonPassageRepository implements PassageRepository {
  getChapterBlocks(
    bookOsis: string,
    chapter: number,
    translationId: string,
  ): ChapterBlock[] | null {
    return getChapter(bookOsis, chapter, translationId)?.blocks ?? null;
  }

  getVerseText(
    bookOsis: string,
    chapter: number,
    verse: number,
    translationId: string,
  ): string | null {
    return getVerseText(bookOsis, chapter, verse, translationId);
  }

  searchVerses(query: string, translationId: string, limit: number): VerseHit[] {
    const needle = query.trim().toLowerCase();
    if (!needle || limit < 1) return [];
    // Bounded bundle scan: canonical order, early exit at the cap. Only
    // runs when SQLite is unavailable (the store prefers it); asset loads
    // are cached by the bundler after first touch.
    const hits: VerseHit[] = [];
    for (const book of booksFor(translationId)) {
      for (let chapter = 1; chapter <= book.chapters; chapter += 1) {
        const content = getChapter(book.osis, chapter, translationId);
        if (!content) continue;
        for (const block of content.blocks) {
          if (block.kind !== 'verse') continue;
          if (block.text.toLowerCase().includes(needle)) {
            hits.push({ bookOsis: book.osis, chapter, verse: block.number, text: block.text });
            if (hits.length >= limit) return hits;
          }
        }
      }
    }
    return hits;
  }
}
