import { DomainError } from "./errors";
import type { ReferenceSystemKey } from "./canon";
import { ALLOWED_REFSYS } from "./canon";

export interface VerseCoordinate {
  book: string;
  chapter: number;
  verse: number;
}

export interface ParsedReference {
  kind: "verse" | "range" | "chapter";
  start: VerseCoordinate;
  end: VerseCoordinate;
  canonicalKey: string;
  refsys: ReferenceSystemKey;
  qualifiedKey: string;
}

const BOOKS: ReadonlySet<string> = new Set<string>([
  "Gen",
  "Exod",
  "Lev",
  "Num",
  "Deut",
  "Josh",
  "Judg",
  "Ruth",
  "1Sam",
  "2Sam",
  "1Kgs",
  "2Kgs",
  "1Chr",
  "2Chr",
  "Ezra",
  "Neh",
  "Esth",
  "Job",
  "Ps",
  "Prov",
  "Eccl",
  "Song",
  "Isa",
  "Jer",
  "Lam",
  "Ezek",
  "Dan",
  "Hos",
  "Joel",
  "Amos",
  "Obad",
  "Jon",
  "Mic",
  "Nah",
  "Hab",
  "Zeph",
  "Hag",
  "Zech",
  "Mal",
  "Matt",
  "Mark",
  "Luke",
  "John",
  "Acts",
  "Rom",
  "1Cor",
  "2Cor",
  "Gal",
  "Eph",
  "Phil",
  "Col",
  "1Thess",
  "2Thess",
  "1Tim",
  "2Tim",
  "Titus",
  "Phlm",
  "Heb",
  "Jas",
  "1Pet",
  "2Pet",
  "1John",
  "2John",
  "3John",
  "Jude",
  "Rev",
]);

const VERSE_PATTERN = /^([A-Za-z1-9]+)\.(\d+)\.(\d+)$/;
const CHAPTER_PATTERN = /^([A-Za-z1-9]+)\.(\d+)$/;

function hasNonAscii(s: string): boolean {
  return /[^\x00-\x7F]/.test(s);
}

function parseVerse(text: string): VerseCoordinate {
  if (hasNonAscii(text)) {
    throw new DomainError(
      "invalid-unicode",
      `"${text}" contains non-ASCII where ASCII is required.`,
    );
  }
  const m = VERSE_PATTERN.exec(text.trim());
  if (!m) {
    throw new DomainError(
      "format",
      `"${text}" is not a reference we understand. Try Neh.2.4.`,
    );
  }
  const [, book, ch, vs] = m as unknown as [string, string, string, string];
  if (!BOOKS.has(book)) {
    throw new DomainError(
      "unsupported-book",
      `"${book}" is not available in this build yet.`,
    );
  }
  return { book, chapter: Number(ch), verse: Number(vs) };
}

function parseChapter(text: string): VerseCoordinate {
  if (hasNonAscii(text)) {
    throw new DomainError(
      "invalid-unicode",
      `"${text}" contains non-ASCII where ASCII is required.`,
    );
  }
  const m = CHAPTER_PATTERN.exec(text.trim());
  if (!m) {
    throw new DomainError(
      "format",
      `"${text}" is not a reference we understand.`,
    );
  }
  const [, book, ch] = m as unknown as [string, string, string];
  if (!BOOKS.has(book)) {
    throw new DomainError("unsupported-book", `"${book}" is not available.`);
  }
  return { book, chapter: Number(ch), verse: 0 };
}

function compare(a: VerseCoordinate, b: VerseCoordinate): number {
  if (a.chapter !== b.chapter) return a.chapter - b.chapter;
  return a.verse - b.verse;
}

export interface ParseOptions {
  refsys: ReferenceSystemKey;
  edition?: string;
}

export function parseQualifiedReference(
  input: string,
  refsys: string,
  opts?: { editionRefsys?: string },
): ParsedReference {
  if (!input || input.trim().length === 0) {
    throw new DomainError("empty", "Enter a reference like Neh.2.4.");
  }
  if (hasNonAscii(input)) {
    throw new DomainError(
      "invalid-unicode",
      `"${input}" contains non-ASCII where ASCII is required. Use English book codes.`,
    );
  }
  if (!ALLOWED_REFSYS.has(refsys)) {
    throw new DomainError(
      "unsupported-reference-system",
      `"${refsys}" is not a supported reference system.`,
    );
  }
  const validatedRefsys = refsys as ReferenceSystemKey;
  if (opts?.editionRefsys && opts.editionRefsys !== validatedRefsys) {
    throw new DomainError(
      "mismatched-refsys-edition",
      `Edition refsys "${opts.editionRefsys}" does not match requested refsys "${validatedRefsys}".`,
    );
  }
  // ambiguous-scope: bare chapter Neh.2 vs scope:neh-2
  // For now, bare chapter is allowed but caller must handle disambiguation
  const parts = input.split("-");
  if (parts.length > 2) {
    throw new DomainError("format", `"${input}" has too many ranges.`);
  }
  if (parts.length === 1) {
    const trimmed = parts[0]?.trim() ?? "";
    if (CHAPTER_PATTERN.test(trimmed) && !VERSE_PATTERN.test(trimmed)) {
      const start = parseChapter(trimmed);
      return {
        kind: "chapter",
        start,
        end: start,
        canonicalKey: trimmed,
        refsys: validatedRefsys,
        qualifiedKey: `${validatedRefsys}:${trimmed}`,
      };
    }
    const start = parseVerse(trimmed);
    return {
      kind: "verse",
      start,
      end: start,
      canonicalKey: trimmed,
      refsys: validatedRefsys,
      qualifiedKey: `${validatedRefsys}:${trimmed}`,
    };
  }
  const start = parseVerse(parts[0] ?? "");
  const end = parseVerse(parts[1] ?? "");
  if (start.book !== end.book) {
    throw new DomainError("format", `"${input}" spans more than one book.`);
  }
  if (compare(start, end) > 0) {
    throw new DomainError("reversed", `"${input}" ends before it starts.`);
  }
  const canonicalKey = `${(parts[0] ?? "").trim()}-${(parts[1] ?? "").trim()}`;
  return {
    kind: "range",
    start,
    end,
    canonicalKey,
    refsys: validatedRefsys,
    qualifiedKey: `${validatedRefsys}:${canonicalKey}`,
  };
}

export type ReferenceMappingKind =
  | "equivalent"
  | "split"
  | "merge"
  | "overlap"
  | "renumbered"
  | "omitted"
  | "added"
  | "uncertain";

export interface ReferenceMapping {
  from: string;
  to: string;
  kind: ReferenceMappingKind;
  fromRefsys: ReferenceSystemKey;
  toRefsys: ReferenceSystemKey;
}

export function isValidMappingKind(k: string): boolean {
  return (
    k === "equivalent" ||
    k === "split" ||
    k === "merge" ||
    k === "overlap" ||
    k === "renumbered" ||
    k === "omitted" ||
    k === "added" ||
    k === "uncertain"
  );
}
