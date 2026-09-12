/**
 * PROTOTYPE FIXTURE — not production content.
 *
 * The verse wording below is the World English Bible (Public Domain), used
 * here only so the landing page can render before licensed translations are
 * selected. CONTENT_RIGHTS.md is BLOCKED: nothing in this file is approved
 * Scripture text, and it must never be treated as licensed production content.
 * Every surface that shows this text labels it as prototype.
 */

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

export const dailyVerseFixture: DailyVerseFixture = {
  canonicalKey: 'Neh.2.4',
  passageKey: 'Neh.2.1-Neh.2.8',
  referenceLabel: 'Nehemiah 2:4',
  text: 'Then the king said to me, “What is your request?” So I prayed to the God of heaven.',
  translationShort: 'WEB',
  translationNote: 'World English Bible · Public Domain · Prototype text',
  dateLabel: 'Verse of the day',
};

export const continueReadingFixture: ContinueReadingFixture = {
  passageKey: 'Neh.2.1-Neh.2.8',
  bookLabel: 'Nehemiah',
  chapter: 2,
  lastVerseLabel: 'Verse 5',
  contextLabel: 'Return from exile',
  translationShort: 'WEB',
};
