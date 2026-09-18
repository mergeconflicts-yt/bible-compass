/**
 * Passage content store (mobile-install-03).
 *
 * Owns repository selection: SQLite once initialized, bundled JSON always
 * as the permanent fallback. Reads stay synchronous so render paths never
 * restructure; every SQLite failure falls back to JSON for that call.
 *
 * This module never imports infrastructure or native modules. The
 * composition root (`app/_layout.tsx`) injects real adapters; tests inject
 * fakes. Empty catches below are the designed fallback (reason recorded
 * here and in the M03 handoff), never swallowed errors: they preserve
 * today's exact behavior whenever SQLite is unavailable.
 */

import {
  bookNameFor,
  booksFor,
  getChapter as getJsonChapter,
  getVerseText as getJsonVerseText,
  type ChapterBlock,
  type ChapterContent,
} from './bsb';
import { JsonPassageRepository } from './jsonPassageRepository';
import { canSearch, canStoreOffline } from './translationRights';
import type { PassageRepository, VerseHit } from './passageRepository';
import type {
  ChapterInput,
  ProjectionOptions,
  ProjectionResult,
} from '@/infrastructure/sqlite/projection';
import type { HashSql } from '@/infrastructure/sqlite/types';

/** Bundled-build coordinates (tools/build-bsb-assets.py), NOT approved
 * content: the edition key namespaces cached rows while per-verse hashes
 * are computed from actual bundled text. Other translations have no
 * defined edition keys and stay on bundled JSON (fail-closed). */
export const BSB_TRANSLATION_ID = 'BSB';
export const BSB_EDITION_KEY = 'edition:bsb@20260912:sha-b2898c49';
export const BSB_REFSYS = 'refsys:eng-v22';

export type PassageBackend = 'sqlite' | 'bundled-json';

/** Structural mirror of the infrastructure executor + sync reads. */
export interface PassageDbHandle {
  execAsync(source: string): Promise<void>;
  runAsync(
    source: string,
    params?: (string | number)[],
  ): Promise<{ lastInsertRowId: number; changes: number }>;
  getAllAsync<T>(source: string, params?: (string | number)[]): Promise<T[]>;
  getAllSync<T>(source: string, params: (string | number)[]): T[];
  getFirstSync<T>(source: string, params: (string | number)[]): T | null;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export interface PassageInitDeps {
  openDatabase: () => Promise<PassageDbHandle>;
  projectChapter: (
    db: PassageDbHandle,
    input: ChapterInput,
    opts: ProjectionOptions,
    hashText: HashSql,
  ) => Promise<ProjectionResult>;
  hashText: HashSql;
  getBundledChapter: (
    bookOsis: string,
    chapter: number,
    translationId: string,
  ) => ChapterContent | null;
  createRepository: (db: PassageDbHandle) => PassageRepository;
}

let backend: PassageBackend = 'sqlite';
let current: PassageRepository = new JsonPassageRepository();

export function setPassageBackend(next: PassageBackend): void {
  backend = next;
}

export function setPassageRepository(repo: PassageRepository): void {
  current = repo;
}

export function resetPassageStore(): void {
  backend = 'sqlite';
  current = new JsonPassageRepository();
}

/** Same signature and return contract as `content/bsb` `getChapter`. */
export function getPassageContent(
  bookOsis: string,
  chapter: number,
  translationId: string,
): ChapterContent | null {
  if (backend === 'sqlite') {
    try {
      const blocks = current.getChapterBlocks(bookOsis, chapter, translationId);
      if (blocks) {
        return {
          bookOsis,
          bookName: bookNameFor(bookOsis, translationId),
          chapter,
          blocks,
          verseCount: blocks.filter((block) => block.kind === 'verse').length,
        };
      }
    } catch {
      // SQLite unavailable or unreadable for this call: fall through to
      // bundled JSON below, preserving today's exact behavior.
    }
  }
  return getJsonChapter(bookOsis, chapter, translationId);
}

/** Prototype daily entry (Nehemiah 2:4); scheduled daily publication
 * lands with the backend slices — see `lib/daily`. */
/** Default verse-search cap; callers may narrow it, never widen past 50. */
export const VERSE_SEARCH_LIMIT = 20;
export const VERSE_SEARCH_MAX = 50;

export const DAILY_VERSE = { bookOsis: 'Neh', chapter: 2, verse: 4 } as const;

/** Daily verse text for cards and share, SQLite-first with bundled-JSON
 * fallback. Null when absent everywhere: callers render unavailable, never
 * invented wording. */
export function resolveDailyVerseText(translationId: string): string | null {
  if (backend === 'sqlite') {
    try {
      const text = current.getVerseText(
        DAILY_VERSE.bookOsis,
        DAILY_VERSE.chapter,
        DAILY_VERSE.verse,
        translationId,
      );
      if (text) return text;
    } catch {
      // SQLite unreadable for this call: fall through to bundled JSON.
    }
  }
  return getJsonVerseText(
    DAILY_VERSE.bookOsis,
    DAILY_VERSE.chapter,
    DAILY_VERSE.verse,
    translationId,
  );
}

/**
 * Verse-text hits for search, SQLite-first with bundled-JSON fallback.
 * Never throws: an unusable store reads as no hits. Search-denied
 * translations read as no hits (rights fail-closed, finding 2).
 */
export function searchVerseText(
  query: string,
  translationId: string,
  limit: number = VERSE_SEARCH_LIMIT,
): VerseHit[] {
  const cap = Math.min(Math.max(Math.floor(limit), 1), VERSE_SEARCH_MAX);
  if (!query.trim()) return [];
  if (!canSearch(translationId)) return [];
  if (backend === 'sqlite') {
    try {
      const hits = current.searchVerses(query, translationId, cap);
      if (hits.length > 0) return hits;
    } catch {
      // SQLite unreadable for this call: fall through to bundled JSON.
    }
  }
  try {
    return new JsonPassageRepository().searchVerses(query, translationId, cap);
  } catch {
    return [];
  }
}

export interface MappedChapterInput {
  verses: { number: number; text: string }[];
  headings: { afterVerse: number; text: string }[];
}

/** Splits asset blocks into verse rows plus headings anchored after the
 * preceding verse (0 = before verse 1). */
export function toChapterInput(blocks: ChapterBlock[]): MappedChapterInput {
  const verses: { number: number; text: string }[] = [];
  const headings: { afterVerse: number; text: string }[] = [];
  let lastVerse = 0;
  for (const block of blocks) {
    if (block.kind === 'heading') {
      headings.push({ afterVerse: lastVerse, text: block.text });
    } else {
      verses.push({ number: block.number, text: block.text });
      lastVerse = block.number;
    }
  }
  return { verses, headings };
}

/**
 * Opens the database, projects Nehemiah (the pilot slice) for the default
 * translation, and activates the SQLite repository. Never throws: any
 * failure keeps bundled JSON. Translations without offline rights or
 * edition keys skip SQLite entirely (fail-closed).
 */
export async function initializePassageContent(
  deps: PassageInitDeps,
  translationId: string = BSB_TRANSLATION_ID,
): Promise<'ready' | 'bundled-json'> {
  if (!canStoreOffline(translationId)) return 'bundled-json';
  try {
    const db = await deps.openDatabase();
    const book = booksFor(BSB_TRANSLATION_ID).find((entry) => entry.osis === 'Neh');
    const chapters = book?.chapters ?? 0;
    for (let chapter = 1; chapter <= chapters; chapter += 1) {
      try {
        const bundled = deps.getBundledChapter('Neh', chapter, BSB_TRANSLATION_ID);
        if (!bundled) continue;
        const mapped = toChapterInput(bundled.blocks);
        await deps.projectChapter(
          db,
          { bookOsis: 'Neh', chapter, verses: mapped.verses, headings: mapped.headings },
          {
            editionKey: BSB_EDITION_KEY,
            refsys: BSB_REFSYS,
            installationId: `en.bsb.Neh.${chapter}@1`,
            contentKey: `en.bsb.Neh.${chapter}`,
            contentVersion: 1,
          },
          deps.hashText,
        );
      } catch {
        // One bad chapter never blocks the rest; it stays on bundled JSON.
      }
    }
    setPassageRepository(deps.createRepository(db));
    return 'ready';
  } catch {
    // Database unavailable (e.g. headless Jest): stay on bundled JSON.
    return 'bundled-json';
  }
}
