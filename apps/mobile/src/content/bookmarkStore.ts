/**
 * Bookmark store (mobile-install-06a).
 *
 * Owns user-library state: chapter bookmarks plus the durable local mutation
 * outbox. Every toggle writes the bookmark row AND its outbox op in one
 * transaction, so no bookmark action is lost even if the app is force-closed
 * mid-write; server sync/drain lands with M07.
 *
 * This module never imports infrastructure or native modules. The
 * composition root (`app/_layout.tsx`) injects the SQLite-backed repository;
 * tests inject fakes. Reads stay synchronous so render paths never
 * restructure; an unusable store reads as empty (documented fallback below),
 * while writes throw a typed `BookmarkError` the UI turns into an
 * error-and-retry state.
 */

import type { PassageDbHandle } from './passageStore';

export interface Bookmark {
  id: string;
  translationId: string;
  bookOsis: string;
  chapter: number;
  createdAt: string;
}

export type OutboxOpKind = 'bookmark.add' | 'bookmark.remove';

/** A pulled server tombstone mapped to local coordinates (finding 3). */
export interface RemoteTombstoneLocal {
  translationId: string;
  bookOsis: string;
  chapter: number;
  /** Canonical ISO string; rows newer than this survive. */
  deletedAt: string;
}

export interface OutboxOp {
  seq: number;
  op: OutboxOpKind;
  entity: string;
  entityId: string;
  payload: string;
  createdAt: string;
  status: 'pending' | 'acked';
}

export type BookmarkErrorCode = 'unavailable' | 'invalid-input';

export class BookmarkError extends Error {
  readonly code: BookmarkErrorCode;

  constructor(code: BookmarkErrorCode, message: string) {
    super(message);
    this.name = 'BookmarkError';
    this.code = code;
  }
}

/** Feature-boundary contract; infrastructure adapters implement it. */
export interface BookmarkRepository {
  /** Newest first; empty when none or when this source has no rows. */
  listBookmarks(translationId: string): Bookmark[];
  isBookmarked(translationId: string, bookOsis: string, chapter: number): boolean;
  /** Pending (undrained) mutations, oldest first. Drain lands with M07. */
  listPendingOps(): OutboxOp[];
  /** Flips the bookmark; resolves true when the chapter ends up saved. */
  toggleBookmark(row: Bookmark): Promise<{ bookmarked: boolean }>;
  /**
   * Marks pushed outbox rows drained (M07b sync). Removes the rows so a
   * replay never resends them; unknown seqs are ignored.
   */
  ackOps(seqs: number[]): Promise<void>;
  /**
   * Inserts server bookmarks missing locally WITHOUT creating outbox ops
   * (M07b pull merge). Dedupe is by location; earliest created_at wins.
   */
  applyRemoteBookmarks(rows: Bookmark[]): Promise<{ inserted: number }>;
  /**
   * Deletes local bookmarks outranked by pulled server tombstones WITHOUT
   * creating outbox ops (finding 3). Only rows whose stored created_at is
   * at or before the tombstone's deletedAt are removed; newer local rows
   * survive. Timestamps must already be canonical ISO strings.
   */
  applyRemoteTombstones(rows: RemoteTombstoneLocal[]): Promise<{ removed: number }>;
}

export interface BookmarkInitDeps {
  createRepository: (db: PassageDbHandle) => BookmarkRepository;
  db: PassageDbHandle;
  newId: () => string;
}

let repo: BookmarkRepository | null = null;
let newId: () => string = () => {
  throw new BookmarkError('unavailable', 'Bookmark store is not initialized.');
};

export function initializeBookmarkStore(deps: BookmarkInitDeps): void {
  repo = deps.createRepository(deps.db);
  newId = deps.newId;
}

export function resetBookmarkStore(): void {
  repo = null;
  newId = () => {
    throw new BookmarkError('unavailable', 'Bookmark store is not initialized.');
  };
}

function validateLocation(translationId: string, bookOsis: string, chapter: number): void {
  if (!translationId || !bookOsis || !Number.isInteger(chapter) || chapter < 1) {
    throw new BookmarkError(
      'invalid-input',
      'Bookmarks need a translation, a book, and a chapter of 1 or more.',
    );
  }
}

/** False when the store is unusable: the chapter simply reads as unsaved. */
export function isBookmarked(translationId: string, bookOsis: string, chapter: number): boolean {
  try {
    return repo?.isBookmarked(translationId, bookOsis, chapter) ?? false;
  } catch {
    // Unreadable store (e.g. dropped database): render unsaved, never crash.
    return false;
  }
}

/** Empty when the store is unusable: the library simply renders no rows. */
export function listBookmarks(translationId: string): Bookmark[] {
  try {
    return repo?.listBookmarks(translationId) ?? [];
  } catch {
    // Unreadable store: render the empty state, never crash.
    return [];
  }
}

/** Empty when the store is unusable. */
export function listPendingOps(): OutboxOp[] {
  try {
    return repo?.listPendingOps() ?? [];
  } catch {
    return [];
  }
}

/**
 * Toggles the chapter bookmark. Throws `BookmarkError('unavailable')` when
 * the store is not initialized and `BookmarkError('invalid-input')` for bad
 * locations; driver failures propagate for the UI error-and-retry state.
 */
export async function toggleBookmark(
  translationId: string,
  bookOsis: string,
  chapter: number,
): Promise<{ bookmarked: boolean }> {
  validateLocation(translationId, bookOsis, chapter);
  if (!repo) {
    throw new BookmarkError('unavailable', 'Bookmarks are not ready yet. Try again in a moment.');
  }
  return repo.toggleBookmark({
    id: newId(),
    translationId,
    bookOsis,
    chapter,
    createdAt: new Date().toISOString(),
  });
}
