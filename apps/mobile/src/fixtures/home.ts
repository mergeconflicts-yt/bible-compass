/**
 * PROTOTYPE FIXTURE — not production content.
 *
 * Home content only: greeting-adjacent progress plus the daily verse pointer.
 * Verse wording comes from the bundled translation loader (single source of
 * truth) for the requested translation — see `src/content/bsb.ts` and
 * `docs/CONTENT_RIGHTS.md`.
 */

import { bookNameFor, getVerseText, translationById, verseLabel } from '@/content/bsb';

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

const FALLBACK_VERSE = '“What is your request?” replied the king.';

export function buildDailyVerseFixture(translationId: string): DailyVerseFixture {
  const record = translationById(translationId);
  return {
    canonicalKey: 'Neh.2.4',
    passageKey: 'Neh.2.1-Neh.2.8',
    referenceLabel: verseLabel('Neh', 2, 4, translationId),
    text: getVerseText('Neh', 2, 4, translationId) ?? FALLBACK_VERSE,
    translationShort: record?.short ?? 'BSB',
    translationNote: record
      ? `${record.name} · ${record.short} · Rights basis: ${record.rightsBasis}`
      : 'BSB · Rights basis unknown',
    dateLabel: 'Verse of the day',
  };
}

export function buildContinueReadingFixture(translationId: string): ContinueReadingFixture {
  return {
    passageKey: 'Neh.2.1-Neh.2.8',
    bookLabel: bookNameFor('Neh', translationId),
    chapter: 2,
    lastVerseLabel: 'Verse 5',
    contextLabel: 'Return from exile',
    translationShort: translationById(translationId)?.short ?? 'BSB',
  };
}
