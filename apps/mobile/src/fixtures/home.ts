/**
 * PROTOTYPE FIXTURE — not production content.
 *
 * Home content only: greeting-adjacent progress plus the daily verse pointer.
 * Verse wording comes from the bundled translation loader (single source of
 * truth), currently the Berean Standard Bible — see `src/content/bsb.ts` and
 * `docs/CONTENT_RIGHTS.md`. Telugu and Tamil remain OPEN (ADR-001).
 */

import { activeTranslation, getVerseText } from '@/content/bsb';

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

const dailyText =
  getVerseText('Neh', 2, 4) ?? '“What is your request?” replied the king.';

export const dailyVerseFixture: DailyVerseFixture = {
  canonicalKey: 'Neh.2.4',
  passageKey: 'Neh.2.1-Neh.2.8',
  referenceLabel: 'Nehemiah 2:4',
  text: dailyText,
  translationShort: activeTranslation.short,
  translationNote: `${activeTranslation.name} · ${activeTranslation.short} · Rights basis: owner-confirmed berean.bible terms`,
  dateLabel: 'Verse of the day',
};

export const continueReadingFixture: ContinueReadingFixture = {
  passageKey: 'Neh.2.1-Neh.2.8',
  bookLabel: 'Nehemiah',
  chapter: 2,
  lastVerseLabel: 'Verse 5',
  contextLabel: 'Return from exile',
  translationShort: activeTranslation.short,
};
