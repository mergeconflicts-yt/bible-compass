/**
 * PROTOTYPE FIXTURE — not production content.
 *
 * Home content only: greeting-adjacent progress plus the daily verse pointer.
 * Verse wording comes from the passage store (SQLite-first, bundled JSON
 * fallback — single source of truth) for the requested translation — see
 * `src/content/passageStore.ts` and `docs/CONTENT_RIGHTS.md`.
 */

import { bookNameFor, translationById, verseLabel } from '@/content/bsb';
import { resolveDailyVerseText } from '@/content/passageStore';
import { getProgress } from '@/content/progressStore';

export interface DailyVerseFixture {
  canonicalKey: string;
  passageKey: string;
  referenceLabel: string;
  text: string;
  translationShort: string;
  translationNote: string;
  dateLabel: string;
}

export interface ContinueReadingFixture {
  passageKey: string;
  bookLabel: string;
  chapter: number;
  lastVerseLabel: string;
  contextLabel: string;
  translationShort: string;
}

export function buildDailyVerseFixture(translationId: string): DailyVerseFixture {
  const record = translationById(translationId);
  return {
    canonicalKey: 'Neh.2.4',
    passageKey: 'Neh.2.1-Neh.2.8',
    referenceLabel: verseLabel('Neh', 2, 4, translationId),
    // Absent everywhere (no SQLite row, no bundled verse): empty, never
    // invented wording. The bundled asset carries Neh.2.4, so this fires
    // only when content itself is missing.
    text: resolveDailyVerseText(translationId) ?? '',
    translationShort: record?.short ?? 'BSB',
    translationNote: record
      ? `${record.name} · ${record.short} · Rights basis: ${record.rightsBasis}`
      : 'BSB · Rights basis unknown',
    dateLabel: 'Verse of the day',
  };
}

export function buildContinueReadingFixture(translationId: string): ContinueReadingFixture {
  const stored = getProgress(translationId);
  // Never started (or store unusable): the pilot entry point, unchanged.
  if (!stored) {
    return {
      passageKey: 'Neh.2.1-Neh.2.8',
      bookLabel: bookNameFor('Neh', translationId),
      chapter: 2,
      lastVerseLabel: 'Verse 5',
      contextLabel: 'Return from exile',
      translationShort: translationById(translationId)?.short ?? 'BSB',
    };
  }
  // Resume exactly where the reader left off: verse links land on the verse,
  // chapter-top positions open the chapter. The context line stays neutral —
  // per-book context copy is unapproved content work (M04), never invented here.
  return {
    passageKey:
      stored.verse >= 1
        ? `${stored.bookOsis}.${stored.chapter}.${stored.verse}`
        : `${stored.bookOsis}.${stored.chapter}`,
    bookLabel: bookNameFor(stored.bookOsis, translationId),
    chapter: stored.chapter,
    lastVerseLabel: stored.verse >= 1 ? `Verse ${stored.verse}` : 'Chapter top',
    contextLabel: 'Continue where you left off',
    translationShort: translationById(translationId)?.short ?? 'BSB',
  };
}
