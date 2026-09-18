/**
 * SQLite passage repository (mobile-install-03).
 *
 * Reads the M01/M02 offline cache. Rows are namespaced by edition key, so
 * a translation without projected rows simply yields null and the caller
 * falls back to bundled JSON — that namespacing IS the fail-closed
 * mechanism (no per-translation branching here). Driver errors propagate
 * so the caller can fall back; they are never swallowed into empty data.
 */

import type { ChapterBlock, PassageRepository, VerseHit } from '@/content/passageRepository';

/** Minimal sync-read surface; `expo-sqlite` handles satisfy it structurally. */
export interface SyncDbReader {
  getAllSync<T>(source: string, params: (string | number)[]): T[];
  getFirstSync<T>(source: string, params: (string | number)[]): T | null;
}

interface HeadingRow {
  position_verse: number;
  text: string;
}

interface VerseRow {
  verse: number;
  text: string;
}

interface SearchRow {
  book: string;
  chapter: number;
  verse: number;
  text: string;
}

export class SqlitePassageRepository implements PassageRepository {
  constructor(
    private readonly db: SyncDbReader,
    private readonly editionKey: string,
    private readonly refsys: string,
  ) {}

  getChapterBlocks(
    bookOsis: string,
    chapter: number,
    translationId: string,
  ): ChapterBlock[] | null {
    void translationId;
    const verses = this.db.getAllSync<VerseRow>(
      'SELECT verse, text FROM verses WHERE edition_key = ? AND refsys = ? AND book = ? AND chapter = ? ORDER BY verse ASC',
      [this.editionKey, this.refsys, bookOsis, chapter],
    );
    if (verses.length === 0) return null;
    const headings = this.db.getAllSync<HeadingRow>(
      'SELECT position_verse, text FROM headings WHERE refsys = ? AND chapter_key = ? ORDER BY position_verse ASC, rowid ASC',
      [this.refsys, `${bookOsis}.${chapter}`],
    );
    const blocks: ChapterBlock[] = [];
    let headIndex = 0;
    const pushHeadingsThrough = (verseNumber: number): void => {
      while (headIndex < headings.length) {
        const heading = headings[headIndex] as HeadingRow;
        if (heading.position_verse > verseNumber) break;
        blocks.push({ kind: 'heading', text: heading.text });
        headIndex += 1;
      }
    };
    pushHeadingsThrough(0);
    for (const verse of verses) {
      blocks.push({ kind: 'verse', number: verse.verse, text: verse.text });
      pushHeadingsThrough(verse.verse);
    }
    // Defensive: headings past the last verse still render, never vanish.
    pushHeadingsThrough(Number.MAX_SAFE_INTEGER);
    return blocks;
  }

  getVerseText(
    bookOsis: string,
    chapter: number,
    verse: number,
    translationId: string,
  ): string | null {
    void translationId;
    const row = this.db.getFirstSync<{ text: string }>(
      'SELECT text FROM verses WHERE edition_key = ? AND refsys = ? AND book = ? AND chapter = ? AND verse = ?',
      [this.editionKey, this.refsys, bookOsis, chapter, verse],
    );
    return row?.text ?? null;
  }

  searchVerses(query: string, translationId: string, limit: number): VerseHit[] {
    void translationId;
    const needle = query.trim();
    if (!needle || limit < 1) return [];
    // Substring match over the already-projected rows: no separate index
    // artifact. LIKE wildcards in the query match literally (escaped);
    // the pattern itself stays a bound parameter, never interpolated.
    const escaped = needle.replace(/[\\%_]/g, (char) => `\\${char}`);
    const rows = this.db.getAllSync<SearchRow>(
      "SELECT book, chapter, verse, text FROM verses WHERE edition_key = ? AND text LIKE ? ESCAPE '\\' ORDER BY book ASC, chapter ASC, verse ASC LIMIT ?",
      [this.editionKey, `%${escaped}%`, Math.floor(limit)],
    );
    return rows.map((row) => ({
      bookOsis: row.book,
      chapter: row.chapter,
      verse: row.verse,
      text: row.text,
    }));
  }
}
