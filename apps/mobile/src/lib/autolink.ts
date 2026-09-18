import { BOOKS } from '@/content/books';
import { getDraft } from '@/content/neh2Draft';

export interface PassageContext {
  bookOsis: string;
  chapter: number;
}

export interface RefSpan {
  text: string;
  /** Canonical passage key, or null when the span is plain prose. */
  passageKey: string | null;
}

/**
 * Short forms actually used in draft copy. Full registry names resolve too;
 * anything else stays plain text rather than risk a wrong destination.
 */
const BOOK_ALIASES: Record<string, string> = {
  Neh: 'Neh',
  Ezra: 'Ezra',
};

const BOOK_NAMES: Record<string, string> = Object.fromEntries(
  BOOKS.map((book) => [book.name, book.osis]),
);

/**
 * Human reference forms in draft prose: "Neh 1", "Ezra 4:17–23", "Neh 6:15",
 * verse-relative "(v10)", "(vv13–15)", "(vv13, 15)". Deliberately narrow:
 * bare ranges ("1–7"), years ("445 BC") and unknown books never link.
 * Hermes-safe: no lookbehind.
 */
const REF_PATTERN =
  /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\s+(\d+)(?::(\d+)(?:\s*[–-]\s*(\d+))?)?|\bv{1,2}\.?(\d+(?:\s*,\s*\d+)*)(?:\s*[–-]\s*(\d+))?/g;

function resolveBook(word: string): string | null {
  return BOOK_ALIASES[word] ?? BOOK_NAMES[word] ?? null;
}

/** Draft passage start (Neh 2); explicit context wins where the caller knows it. */
function draftContext(): PassageContext {
  const [bookOsis, chapterRaw] = getDraft().passage.split('.');
  const chapter = Number.parseInt(chapterRaw ?? '', 10);
  if (!bookOsis || !Number.isInteger(chapter)) return { bookOsis: 'Neh', chapter: 2 };
  return { bookOsis, chapter };
}

/**
 * Splits prose into plain and linked spans. Verse-relative forms resolve
 * against the given chapter; absolute forms carry their own address.
 */
export function splitReferences(text: string, context?: PassageContext): RefSpan[] {
  const here = context ?? draftContext();
  const spans: RefSpan[] = [];
  let cursor = 0;
  REF_PATTERN.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = REF_PATTERN.exec(text)) !== null) {
    const [full, bookWord, chapterRaw, verseRaw, rangeEndRaw, relativeRaw, relativeEndRaw] = match;
    let key: string | null = null;
    if (bookWord !== undefined) {
      const osis = resolveBook(bookWord);
      if (osis) {
        const chapter = Number(chapterRaw);
        if (verseRaw === undefined) {
          key = `${osis}.${chapter}`;
        } else {
          const verse = Number(verseRaw);
          key =
            rangeEndRaw === undefined
              ? `${osis}.${chapter}.${verse}`
              : `${osis}.${chapter}.${verse}-${osis}.${chapter}.${Number(rangeEndRaw)}`;
        }
      }
    } else if (relativeRaw !== undefined) {
      const verses = relativeRaw.split(',').map((part) => Number(part.trim()));
      const first = verses[0];
      const last =
        relativeEndRaw !== undefined ? Number(relativeEndRaw) : verses[verses.length - 1];
      if (first !== undefined && last !== undefined && Number.isInteger(first)) {
        key =
          last === first
            ? `${here.bookOsis}.${here.chapter}.${first}`
            : `${here.bookOsis}.${here.chapter}.${first}-${here.bookOsis}.${here.chapter}.${last}`;
      }
    }
    const index = match.index;
    if (index > cursor) spans.push({ text: text.slice(cursor, index), passageKey: null });
    spans.push({ text: full, passageKey: key });
    cursor = index + full.length;
  }
  if (cursor < text.length) spans.push({ text: text.slice(cursor), passageKey: null });
  return spans.filter((span) => span.text.length > 0);
}
