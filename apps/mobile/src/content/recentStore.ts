/**
 * Recent store (mobile-install-06b).
 *
 * Best-effort, on-device-only record of opened passages. Deliberately stores
 * locations (translation, book, chapter) and never raw search strings, so no
 * query text is retained anywhere. Recording never throws and never blocks
 * navigation: bad input or an unusable store resolves `'skipped'` (reason
 * recorded here and in the M06b handoff). Reads stay synchronous; an
 * unusable store reads as an empty list.
 *
 * This module never imports infrastructure or native modules. The
 * composition root (`app/_layout.tsx`) injects the SQLite-backed repository;
 * tests inject fakes.
 */

import type { PassageDbHandle } from './passageStore';

export interface RecentEntry {
  translationId: string;
  bookOsis: string;
  chapter: number;
  openedAt: string;
}

/** Feature-boundary contract; infrastructure adapters implement it. */
export interface RecentRepository {
  /** Newest first, capped at `limit`. */
  listRecents(translationId: string, limit: number): RecentEntry[];
  /** Upserts the location and prunes past the cap. */
  recordRecent(entry: RecentEntry): Promise<void>;
}

export interface RecentInitDeps {
  createRepository: (db: PassageDbHandle) => RecentRepository;
  db: PassageDbHandle;
}

/** Default cap for recent lists; the adapter enforces the same bound. */
export const RECENT_LIMIT = 10;

export type RecordStatus = 'recorded' | 'skipped';

let repo: RecentRepository | null = null;

export function initializeRecentStore(deps: RecentInitDeps): void {
  repo = deps.createRepository(deps.db);
}

export function resetRecentStore(): void {
  repo = null;
}

function isValidLocation(translationId: string, bookOsis: string, chapter: number): boolean {
  return (
    translationId.length > 0 && bookOsis.length > 0 && Number.isInteger(chapter) && chapter >= 1
  );
}

/** Empty when the store is unusable: recent sections simply hide. */
export function listRecents(translationId: string, limit: number = RECENT_LIMIT): RecentEntry[] {
  try {
    return repo?.listRecents(translationId, Math.max(1, Math.floor(limit))) ?? [];
  } catch {
    // Unreadable store: hide recents, never crash.
    return [];
  }
}

/**
 * Records an opened chapter. Never rejects: invalid locations and store
 * failures resolve `'skipped'` so navigation stays instant and infallible.
 */
export async function recordRecent(
  translationId: string,
  bookOsis: string,
  chapter: number,
): Promise<RecordStatus> {
  if (!isValidLocation(translationId, bookOsis, chapter) || !repo) return 'skipped';
  try {
    await repo.recordRecent({
      translationId,
      bookOsis,
      chapter,
      openedAt: new Date().toISOString(),
    });
    return 'recorded';
  } catch {
    // Recents are best-effort local state: a failed write must never surface
    // in navigation or crash reporting.
    return 'skipped';
  }
}
