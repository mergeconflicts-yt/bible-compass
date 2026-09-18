/**
 * SQLite content projection (mobile-install-02).
 *
 * Projects one bundled Scripture chapter (already licensed, attributed, and
 * displayed from JSON today) into the versioned SQLite cache so the reader
 * works offline. Pure logic over `SqliteExecutor`: no Expo, React Native,
 * or UI imports, fully unit-testable with a recording fake.
 *
 * Scope guard: Scripture verses/units ONLY. Entity, attestation, mention,
 * and relevance data remain unapproved drafts (all publication gates void)
 * and must never be projected until human-approved content exists.
 *
 * Transactional install with keep-last-healthy semantics: one transaction
 * replaces this installation's chapter-scoped rows and marks the ledger
 * row healthy. Any failure rolls back, leaving the previous healthy
 * snapshot untouched. A healthy snapshot with a matching checksum is a
 * verified no-op (offline startup never waits on it).
 */

import { SHA256_PATTERN } from './runner';
import type { HashSql, SqliteExecutor } from './types';
import { MigrationError } from './types';

export interface SourceVerse {
  number: number;
  text: string;
}

/** A section heading rendered after `afterVerse` (0 = before verse 1). */
export interface SourceHeading {
  afterVerse: number;
  text: string;
}

export interface ChapterInput {
  bookOsis: string;
  chapter: number;
  verses: SourceVerse[];
  headings?: SourceHeading[];
}

export interface ProjectionOptions {
  /** Immutable edition key, e.g. `edition:bsb@20260912:sha-b2898c49`. */
  editionKey: string;
  /** Reference system, e.g. `refsys:eng-v22`. */
  refsys: string;
  /** Installation ledger id, e.g. `en.bsb.neh-2@1`. */
  installationId: string;
  /** Content key, e.g. `en.bsb.neh-2`. */
  contentKey: string;
  /** Monotonic content version. */
  contentVersion: number;
}

export interface ProjectionResult {
  /** False when a healthy snapshot with the same checksum already exists. */
  installed: boolean;
  checksum: string;
  units: number;
  verses: number;
  headings: number;
}

export function workKeyFor(bookOsis: string): string {
  return `work:${bookOsis}:prot-66`;
}

export function chapterLocalKey(bookOsis: string, chapter: number): string {
  return `${bookOsis}.${chapter}`;
}

export function verseLocalKey(bookOsis: string, chapter: number, verse: number): string {
  return `${bookOsis}.${chapter}.${verse}`;
}

/** Stable ordinal within a reference system: chapter units sort first. */
export function ordinalFor(chapter: number, verse: number): number {
  return chapter * 1000 + verse;
}

function validateInput(input: ChapterInput): void {
  if (!input.bookOsis || /[^\x00-\x7F]/.test(input.bookOsis)) {
    throw new MigrationError('invalid-input', 'Chapter input needs an ASCII book OSIS code.');
  }
  if (!Number.isInteger(input.chapter) || input.chapter <= 0) {
    throw new MigrationError('invalid-input', 'Chapter input needs a positive integer chapter.');
  }
  if (input.verses.length === 0) {
    throw new MigrationError('invalid-input', 'Refusing an empty chapter install.');
  }
  const seen = new Set<number>();
  for (const verse of input.verses) {
    if (!Number.isInteger(verse.number) || verse.number <= 0) {
      throw new MigrationError('invalid-input', 'Verse numbers must be positive integers.');
    }
    if (verse.text.trim().length === 0) {
      throw new MigrationError('invalid-input', `Verse ${verse.number} has empty text.`);
    }
    if (seen.has(verse.number)) {
      throw new MigrationError('invalid-input', `Duplicate verse number ${verse.number}.`);
    }
    seen.add(verse.number);
  }
  for (const heading of input.headings ?? []) {
    if (!Number.isInteger(heading.afterVerse) || heading.afterVerse < 0) {
      throw new MigrationError('invalid-input', 'Heading positions must be non-negative integers.');
    }
    if (heading.text.trim().length === 0) {
      throw new MigrationError('invalid-input', 'Heading text must not be empty.');
    }
  }
}

/**
 * Projects one chapter. All SQL uses bound parameters (never string
 * interpolation of content), so verse text cannot break or inject.
 */
export async function projectChapter(
  db: SqliteExecutor,
  input: ChapterInput,
  opts: ProjectionOptions,
  hashText: HashSql,
): Promise<ProjectionResult> {
  validateInput(input);
  const work = workKeyFor(input.bookOsis);
  const chapterKey = chapterLocalKey(input.bookOsis, input.chapter);
  const ordered = [...input.verses].sort((a, b) => a.number - b.number);

  const verseShas: string[] = [];
  for (const verse of ordered) {
    const sha = await hashText(verse.text);
    if (!SHA256_PATTERN.test(sha)) {
      throw new MigrationError('invalid-hash', 'Text hasher must return sha256:<64 hex>.');
    }
    verseShas.push(sha);
  }
  const headings = [...(input.headings ?? [])].sort((a, b) => a.afterVerse - b.afterVerse);
  const checksum = await hashText(
    JSON.stringify([
      ordered.map((verse, index) => [
        opts.refsys,
        verseLocalKey(input.bookOsis, input.chapter, verse.number),
        verse.text,
        verseShas[index],
      ]),
      headings.map((heading) => [opts.refsys, chapterKey, heading.afterVerse, heading.text]),
    ]),
  );
  if (!SHA256_PATTERN.test(checksum)) {
    throw new MigrationError('invalid-hash', 'Text hasher must return sha256:<64 hex>.');
  }

  // The executor contract carries no parameters on reads, so the healthy
  // check filters client-side over the tiny installations ledger (one row
  // per installed package, never verse-scale).
  const installations = await db.getAllAsync<{ id: string; checksum: string; status: string }>(
    'SELECT id, checksum, status FROM content_installations',
  );
  const match = installations.find((row) => row.id === opts.installationId);
  if (match && match.status === 'healthy' && match.checksum === checksum) {
    return { installed: false, checksum, units: 0, verses: 0, headings: 0 };
  }

  const now = new Date().toISOString();
  try {
    await db.withTransactionAsync(async () => {
      await db.runAsync('DELETE FROM verses WHERE edition_key = ? AND book = ? AND chapter = ?', [
        opts.editionKey,
        input.bookOsis,
        input.chapter,
      ]);
      // Units are translation-independent: only remove this chapter's units
      // that no remaining verse references, so other editions keep theirs.
      await db.runAsync(
        'DELETE FROM reference_units WHERE refsys = ? AND work = ? AND chapter = ? AND NOT EXISTS (SELECT 1 FROM verses v WHERE v.refsys = reference_units.refsys AND v.local_key = reference_units.local_key)',
        [opts.refsys, work, input.chapter],
      );
      await db.runAsync('DELETE FROM headings WHERE refsys = ? AND chapter_key = ?', [
        opts.refsys,
        chapterKey,
      ]);
      for (const heading of headings) {
        await db.runAsync(
          'INSERT INTO headings (refsys, chapter_key, position_verse, text) VALUES (?, ?, ?, ?)',
          [opts.refsys, chapterKey, heading.afterVerse, heading.text],
        );
      }
      await db.runAsync(
        'INSERT INTO reference_units (refsys, local_key, work, chapter, verse, kind, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [opts.refsys, chapterKey, work, input.chapter, 0, 'chapter', ordinalFor(input.chapter, 0)],
      );
      for (let index = 0; index < ordered.length; index += 1) {
        const verse = ordered[index] as SourceVerse;
        const localKey = verseLocalKey(input.bookOsis, input.chapter, verse.number);
        const sha = verseShas[index] as string;
        await db.runAsync(
          'INSERT INTO reference_units (refsys, local_key, work, chapter, verse, kind, ordinal) VALUES (?, ?, ?, ?, ?, ?, ?)',
          [
            opts.refsys,
            localKey,
            work,
            input.chapter,
            verse.number,
            'verse',
            ordinalFor(input.chapter, verse.number),
          ],
        );
        await db.runAsync(
          'INSERT INTO verses (edition_key, refsys, local_key, book, chapter, verse, text, text_sha256) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
          [
            opts.editionKey,
            opts.refsys,
            localKey,
            input.bookOsis,
            input.chapter,
            verse.number,
            verse.text,
            sha,
          ],
        );
      }
      await db.runAsync(
        'INSERT INTO content_installations (id, content_key, content_version, checksum, status, installed_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET content_key = excluded.content_key, content_version = excluded.content_version, checksum = excluded.checksum, status = excluded.status, installed_at = excluded.installed_at',
        [opts.installationId, opts.contentKey, opts.contentVersion, checksum, 'healthy', now],
      );
    });
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new MigrationError(
      'migration-failed',
      `Chapter install ${input.bookOsis}.${input.chapter} failed and was rolled back: ${reason}`,
    );
  }

  return {
    installed: true,
    checksum,
    units: ordered.length + 1,
    verses: ordered.length,
    headings: headings.length,
  };
}
