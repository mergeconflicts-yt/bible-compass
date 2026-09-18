/**
 * Reading-progress store (mobile-install-06c).
 *
 * Best-effort, on-device-only record of where the reader left off: one row
 * per translation (book, chapter, verse — verse 0 marks the chapter top,
 * matching `lib/reference`). Local-only: the M07 sync scope covers
 * bookmarks, so progress deliberately has no outbox queue (nothing would
 * drain it). Recording never throws and never blocks the reader: bad input
 * or an unusable store resolves `'skipped'` (reason recorded here and in the
 * M06c handoff). Reads stay synchronous; an unusable store reads as never
 * started.
 *
 * This module never imports infrastructure or native modules. The
 * composition root (`app/_layout.tsx`) injects the SQLite-backed repository;
 * tests inject fakes.
 */

import type { PassageDbHandle } from './passageStore';

export interface ProgressEntry {
  translationId: string;
  bookOsis: string;
  chapter: number;
  /** Last-read verse; 0 marks the chapter top. */
  verse: number;
  updatedAt: string;
}

/** Feature-boundary contract; infrastructure adapters implement it. */
export interface ProgressRepository {
  /** The stored position, or null when reading never started. */
  getProgress(translationId: string): ProgressEntry | null;
  /** Upserts the position for the translation. */
  recordProgress(entry: ProgressEntry): Promise<void>;
}

export interface ProgressInitDeps {
  createRepository: (db: PassageDbHandle) => ProgressRepository;
  db: PassageDbHandle;
}

export type ProgressStatus = 'recorded' | 'skipped';

let repo: ProgressRepository | null = null;

export function initializeProgressStore(deps: ProgressInitDeps): void {
  repo = deps.createRepository(deps.db);
}

export function resetProgressStore(): void {
  repo = null;
}

function isValidPosition(
  translationId: string,
  bookOsis: string,
  chapter: number,
  verse: number,
): boolean {
  return (
    translationId.length > 0 &&
    bookOsis.length > 0 &&
    Number.isInteger(chapter) &&
    chapter >= 1 &&
    Number.isInteger(verse) &&
    verse >= 0
  );
}

/** Null when reading never started or the store is unusable. */
export function getProgress(translationId: string): ProgressEntry | null {
  try {
    return repo?.getProgress(translationId) ?? null;
  } catch {
    // Unreadable store: render the never-started default, never crash.
    return null;
  }
}

/**
 * Records the reading position. Never rejects: invalid positions and store
 * failures resolve `'skipped'` so the reader stays instant and infallible.
 */
export async function recordProgress(
  translationId: string,
  bookOsis: string,
  chapter: number,
  verse: number,
): Promise<ProgressStatus> {
  if (!isValidPosition(translationId, bookOsis, chapter, verse) || !repo) return 'skipped';
  try {
    await repo.recordProgress({
      translationId,
      bookOsis,
      chapter,
      verse,
      updatedAt: new Date().toISOString(),
    });
    return 'recorded';
  } catch {
    // Progress is best-effort local state: a failed write must never surface
    // in the reader or crash reporting.
    return 'skipped';
  }
}
