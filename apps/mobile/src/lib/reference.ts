/**
 * Canonical Scripture reference parsing and validation.
 * Identifiers are stable and language-independent per docs/CANONICAL_IDENTIFIERS.md:
 * verse `Neh.2.4`, passage range `Neh.2.1-Neh.2.8`.
 * The landing slice supports Nehemiah only; anything else is honestly
 * reported as unsupported rather than guessed.
 */

export type ReferenceErrorCode = 'empty' | 'format' | 'reversed' | 'unsupported-book';

export class ReferenceParseError extends Error {
  readonly code: ReferenceErrorCode;

  constructor(code: ReferenceErrorCode, message: string) {
    super(message);
    this.name = 'ReferenceParseError';
    this.code = code;
  }
}

export interface VerseCoordinate {
  book: string;
  chapter: number;
  verse: number;
}

export interface ParsedReference {
  kind: 'verse' | 'range';
  start: VerseCoordinate;
  end: VerseCoordinate;
  canonicalKey: string;
}

/** OSIS-style book codes supported by this build. */
const SUPPORTED_BOOKS: Record<string, string> = {
  Neh: 'Nehemiah',
};

const VERSE_PATTERN = /^([A-Za-z1-9]+)\.(\d+)\.(\d+)$/;

function parseVerse(text: string): VerseCoordinate {
  const match = VERSE_PATTERN.exec(text.trim());
  if (!match) {
    throw new ReferenceParseError(
      'format',
      `“${text}” is not a reference we understand. Try a format like Neh.2.4.`,
    );
  }
  const [, book, chapterRaw, verseRaw] = match;
  const displayName = SUPPORTED_BOOKS[book];
  if (!displayName) {
    throw new ReferenceParseError(
      'unsupported-book',
      `“${book}” is not available in this build yet. Nehemiah is the supported book.`,
    );
  }
  return { book, chapter: Number(chapterRaw), verse: Number(verseRaw) };
}

function compare(a: VerseCoordinate, b: VerseCoordinate): number {
  if (a.chapter !== b.chapter) {
    return a.chapter - b.chapter;
  }
  return a.verse - b.verse;
}

/**
 * Parses `Neh.2.4` or `Neh.2.1-Neh.2.8`. Throws a typed ReferenceParseError for
 * empty input, malformed input, reversed ranges, or unsupported books.
 */
export function parseReference(input: string): ParsedReference {
  if (!input || input.trim().length === 0) {
    throw new ReferenceParseError('empty', 'Enter a reference like Neh.2.4.');
  }
  const parts = input.split('-');
  if (parts.length > 2) {
    throw new ReferenceParseError(
      'format',
      `“${input}” is not a reference we understand. Try a format like Neh.2.4.`,
    );
  }
  const start = parseVerse(parts[0]);
  const end = parts.length === 2 ? parseVerse(parts[1]) : start;
  if (start.book !== end.book) {
    throw new ReferenceParseError(
      'format',
      `“${input}” spans more than one book, which this build does not support yet.`,
    );
  }
  if (compare(start, end) > 0) {
    throw new ReferenceParseError(
      'reversed',
      `“${input}” ends before it starts. Put the earlier verse first, like Neh.2.1-Neh.2.8.`,
    );
  }
  const canonicalKey =
    parts.length === 2 ? `${parts[0].trim()}-${parts[1].trim()}` : parts[0].trim();
  return { kind: parts.length === 2 ? 'range' : 'verse', start, end, canonicalKey };
}

/** Human-readable label, e.g. `Nehemiah 2:1–8`. Display only — never a key. */
export function formatReference(ref: ParsedReference): string {
  const name = SUPPORTED_BOOKS[ref.start.book] ?? ref.start.book;
  if (ref.kind === 'verse') {
    return `${name} ${ref.start.chapter}:${ref.start.verse}`;
  }
  if (ref.start.chapter === ref.end.chapter) {
    return `${name} ${ref.start.chapter}:${ref.start.verse}–${ref.end.verse}`;
  }
  return `${name} ${ref.start.chapter}:${ref.start.verse}–${ref.end.chapter}:${ref.end.verse}`;
}
