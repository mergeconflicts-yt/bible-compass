/**
 * Canonical Scripture reference parsing and validation.
 * Identifiers are stable and language-independent per docs/CANONICAL_IDENTIFIERS.md:
 * verse `Neh.2.4`, passage range `Neh.2.1-Neh.2.8`, whole chapter `Neh.2`.
 * Book names come from the generated registry so parser and browser agree.
 */

import { BOOKS, bookByOsis } from '@/content/books';

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
  kind: 'verse' | 'range' | 'chapter';
  start: VerseCoordinate;
  end: VerseCoordinate;
  canonicalKey: string;
}

/** OSIS-style book code -> display name, from the generated registry. */
const BOOK_NAMES: Record<string, string> = Object.fromEntries(
  BOOKS.map((book) => [book.osis, book.name]),
);

const VERSE_PATTERN = /^([A-Za-z1-9]+)\.(\d+)\.(\d+)$/;
const CHAPTER_PATTERN = /^([A-Za-z1-9]+)\.(\d+)$/;

function displayName(book: string): string {
  const name = BOOK_NAMES[book];
  if (!name) {
    throw new ReferenceParseError(
      'unsupported-book',
      `“${book}” is not available in this build yet.`,
    );
  }
  return name;
}

function parseVerse(text: string): VerseCoordinate {
  const match = VERSE_PATTERN.exec(text.trim());
  if (!match) {
    throw new ReferenceParseError(
      'format',
      `“${text}” is not a reference we understand. Try a format like Neh.2.4.`,
    );
  }
  const [, book, chapterRaw, verseRaw] = match;
  displayName(book as string);
  return { book: book as string, chapter: Number(chapterRaw), verse: Number(verseRaw) };
}

function parseChapter(text: string): VerseCoordinate {
  const match = CHAPTER_PATTERN.exec(text.trim());
  if (!match) {
    throw new ReferenceParseError(
      'format',
      `“${text}” is not a reference we understand. Try a format like Neh.2.4.`,
    );
  }
  const [, book, chapterRaw] = match;
  displayName(book as string);
  // Whole chapter: verse 0 marks "the full chapter", never a real verse.
  return { book: book as string, chapter: Number(chapterRaw), verse: 0 };
}

function compare(a: VerseCoordinate, b: VerseCoordinate): number {
  if (a.chapter !== b.chapter) {
    return a.chapter - b.chapter;
  }
  return a.verse - b.verse;
}

/**
 * Parses `Neh.2.4`, `Neh.2.1-Neh.2.8`, or whole-chapter `Neh.2`.
 * Throws a typed ReferenceParseError for empty input, malformed input,
 * reversed ranges, or unsupported books.
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
  if (parts.length === 1) {
    const trimmed = parts[0]?.trim() ?? '';
    if (CHAPTER_PATTERN.test(trimmed) && !VERSE_PATTERN.test(trimmed)) {
      const start = parseChapter(trimmed);
      return { kind: 'chapter', start, end: start, canonicalKey: trimmed };
    }
    const start = parseVerse(trimmed);
    return { kind: 'verse', start, end: start, canonicalKey: trimmed };
  }
  const start = parseVerse(parts[0] ?? '');
  const end = parseVerse(parts[1] ?? '');
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
  const canonicalKey = `${(parts[0] ?? '').trim()}-${(parts[1] ?? '').trim()}`;
  return { kind: 'range', start, end, canonicalKey };
}

/**
 * Display label for a whole chapter, e.g. `Nehemiah 2`. Falls back to the
 * raw coordinates for locations the registry does not know.
 */
export function chapterLabel(bookOsis: string, chapter: number): string {
  try {
    return formatReference(parseReference(`${bookOsis}.${chapter}`));
  } catch {
    return `${bookOsis} ${chapter}`;
  }
}

/** Human-readable label, e.g. `Nehemiah 2:1–8` or `Nehemiah 2`. Display only — never a key. */
export function formatReference(ref: ParsedReference): string {
  const entry = bookByOsis(ref.start.book);
  const name = entry ? entry.name : ref.start.book;
  if (ref.kind === 'chapter') {
    return `${name} ${ref.start.chapter}`;
  }
  if (ref.kind === 'verse') {
    return `${name} ${ref.start.chapter}:${ref.start.verse}`;
  }
  if (ref.start.chapter === ref.end.chapter) {
    return `${name} ${ref.start.chapter}:${ref.start.verse}–${ref.end.verse}`;
  }
  return `${name} ${ref.start.chapter}:${ref.start.verse}–${ref.end.chapter}:${ref.end.verse}`;
}
