/**
 * Bookmark sync engine (mobile-install-07b).
 *
 * Owns cross-device bookmark convergence: idempotent outbox push plus
 * cursored pull with op-log replay. Owner decisions (docs/DECISION_M07_SYNC.md):
 *
 * - D2: bookmarks ONLY. Recents stay local, progress is local-only.
 * - D3: op-log replay in order; BSB-only identity (`BSB` →
 *   `refsys:eng-v22`, `local_key = {book}.{chapter}`); first sign-in is a
 *   union merge (all local ops upload, then the pull dedupes by location
 *   keeping the earliest `created_at`).
 * - Tombstone-wins: removes delete by LOCATION server-side, so a remove
 *   converges even when the row was created on another device with a
 *   different client id.
 *
 * Fail-closed rules: unconfigured builds and anonymous sessions never touch
 * the network (`unconfigured` / `anonymous`); non-BSB ops stay pending
 * locally and are reported as skipped; malformed rows are skipped and
 * counted, never crashed on. Push successes are acked even when a later op
 * fails, so a retry never loses progress (replay is idempotent by client
 * op identity). Cloud account deletion needs an Edge Function that does not
 * exist yet — `deleteAccount` still reports cloud-pending (M07a).
 *
 * This module never imports infrastructure, native modules, or network
 * clients. The composition root (`app/_layout.tsx`) injects the SQLite
 * repository, the cursor store, and the Supabase remote source; tests inject
 * fakes.
 */

import { z } from 'zod';

import { BSB_REFSYS, BSB_TRANSLATION_ID } from './passageStore';
import type { Bookmark, BookmarkRepository, OutboxOp } from './bookmarkStore';

/** Local key grammar: `{book}.{chapter}`, e.g. `Neh.2`. */
const LOCAL_KEY_PATTERN = /^([A-Za-z1-9]+)\.([1-9][0-9]*)$/;

const outboxPayloadSchema = z.object({
  translation_id: z.string().min(1),
  book: z.string().min(1),
  chapter: z.number().int().min(1),
});

const remoteRowSchema = z.object({
  id: z.string().min(1),
  refsys: z.string().min(1),
  local_key: z.string().min(1),
  created_at: z.string().min(1),
});

export interface RemoteBookmark {
  id: string;
  refsys: string;
  localKey: string;
  createdAt: string;
}

/**
 * Feature-boundary contract for the server side; the Supabase adapter is
 * the only implementation. Adds are idempotent by client id (upsert);
 * removes delete by location (tombstone-wins across devices).
 */
export interface BookmarkRemoteSource {
  pushAdd(row: RemoteBookmark): Promise<void>;
  pushRemove(refsys: string, localKey: string): Promise<void>;
  pull(): Promise<RemoteBookmark[]>;
}

/** Feature-boundary contract for the pull cursor; SQLite implements it. */
export interface SyncCursorStore {
  getCursor(key: string): string | null;
  setCursor(key: string, value: string): Promise<void>;
}

export const BOOKMARKS_CURSOR_KEY = 'bookmarks:last_pull_at';

export type SyncErrorCode = 'unconfigured' | 'anonymous' | 'auth' | 'network' | 'unknown';

export class SyncError extends Error {
  readonly code: SyncErrorCode;

  constructor(code: SyncErrorCode, message: string) {
    super(message);
    this.name = 'SyncError';
    this.code = code;
  }
}

export interface SyncEngineDeps {
  bookmarks: BookmarkRepository;
  cursors: SyncCursorStore;
  remote: BookmarkRemoteSource;
  /** Current signed-in user id, or null when anonymous. */
  getUserId: () => string | null;
  nowIso: () => string;
}

export interface SyncResult {
  /** Outbox ops successfully applied server-side (and acked locally). */
  pushed: number;
  /** Server rows read on pull. */
  pulled: number;
  /** Server rows newly inserted locally. */
  inserted: number;
  /** Local non-BSB ops left pending (BSB-only v1, fail-closed). */
  skippedNonBsb: number;
  /** Malformed local ops (left pending) plus malformed remote rows. */
  skippedInvalid: number;
  /** Remote rows ignored (wrong refsys or unparseable key). */
  skippedRemote: number;
}

/** Local (translation, book, chapter) → server identity, or null for non-BSB. */
export function toServerLocation(
  translationId: string,
  bookOsis: string,
  chapter: number,
): { refsys: string; localKey: string } | null {
  if (translationId !== BSB_TRANSLATION_ID) return null;
  if (!bookOsis || !Number.isInteger(chapter) || chapter < 1) return null;
  return { refsys: BSB_REFSYS, localKey: `${bookOsis}.${chapter}` };
}

/** Server local_key → local coordinates, or null when unparseable. */
export function fromServerLocation(localKey: string): { bookOsis: string; chapter: number } | null {
  const match = LOCAL_KEY_PATTERN.exec(localKey);
  if (!match?.[1] || !match[2]) return null;
  return { bookOsis: match[1], chapter: Number(match[2]) };
}

let deps: SyncEngineDeps | null = null;

export function initializeSyncEngine(next: SyncEngineDeps): void {
  deps = next;
}

export function resetSyncEngine(): void {
  deps = null;
}

export function isSyncReady(): boolean {
  return deps !== null;
}

/**
 * Runs one push-then-pull cycle. Throws `SyncError` (`unconfigured` when no
 * engine is installed, `anonymous` when signed out, `auth` on expired
 * sessions, `network` when offline). Partial push progress is acked before
 * any throw so retries converge instead of duplicating work.
 */
export async function syncNow(): Promise<SyncResult> {
  if (!deps) {
    throw new SyncError('unconfigured', 'Sync is not configured in this build.');
  }
  const userId = deps.getUserId();
  if (!userId) {
    throw new SyncError('anonymous', 'Sign in to sync bookmarks.');
  }
  const { bookmarks, cursors, remote, nowIso } = deps;
  const result: SyncResult = {
    pushed: 0,
    pulled: 0,
    inserted: 0,
    skippedNonBsb: 0,
    skippedInvalid: 0,
    skippedRemote: 0,
  };

  const acked: number[] = [];
  const ops: OutboxOp[] = bookmarks.listPendingOps();
  for (const op of ops) {
    if (op.entity !== 'bookmark' || (op.op !== 'bookmark.add' && op.op !== 'bookmark.remove')) {
      result.skippedInvalid += 1;
      continue;
    }
    let payload: { translation_id: string; book: string; chapter: number };
    try {
      payload = outboxPayloadSchema.parse(JSON.parse(op.payload));
    } catch {
      result.skippedInvalid += 1;
      continue;
    }
    const location = toServerLocation(payload.translation_id, payload.book, payload.chapter);
    if (!location) {
      // BSB-only v1: other translations stay local-only, ops stay pending.
      result.skippedNonBsb += 1;
      continue;
    }
    try {
      if (op.op === 'bookmark.add') {
        await remote.pushAdd({
          id: op.entityId,
          refsys: location.refsys,
          localKey: location.localKey,
          createdAt: op.createdAt,
        });
      } else {
        await remote.pushRemove(location.refsys, location.localKey);
      }
    } catch (error) {
      // Keep what converged: ack successes before surfacing the failure.
      await bookmarks.ackOps(acked);
      if (error instanceof SyncError) throw error;
      throw new SyncError('network', 'Sync did not finish. Try again when online.');
    }
    acked.push(op.seq);
    result.pushed += 1;
  }
  await bookmarks.ackOps(acked);

  let remoteRows: RemoteBookmark[];
  try {
    remoteRows = await remote.pull();
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError('network', 'Sync did not finish. Try again when online.');
  }
  result.pulled = remoteRows.length;

  const missing: Bookmark[] = [];
  for (const row of remoteRows) {
    const parsed = remoteRowSchema.safeParse({
      id: row.id,
      refsys: row.refsys,
      local_key: row.localKey,
      created_at: row.createdAt,
    });
    if (!parsed.success) {
      result.skippedInvalid += 1;
      continue;
    }
    if (parsed.data.refsys !== BSB_REFSYS) {
      result.skippedRemote += 1;
      continue;
    }
    const coords = fromServerLocation(parsed.data.local_key);
    if (!coords) {
      result.skippedRemote += 1;
      continue;
    }
    // Remote identity is stable across devices, so the server id becomes
    // the local row id: a later toggle-off removes by location anyway.
    if (!bookmarks.isBookmarked(BSB_TRANSLATION_ID, coords.bookOsis, coords.chapter)) {
      missing.push({
        id: parsed.data.id,
        translationId: BSB_TRANSLATION_ID,
        bookOsis: coords.bookOsis,
        chapter: coords.chapter,
        createdAt: parsed.data.created_at,
      });
    }
  }
  const applied = await bookmarks.applyRemoteBookmarks(missing);
  result.inserted = applied.inserted;

  try {
    await cursors.setCursor(BOOKMARKS_CURSOR_KEY, nowIso());
  } catch {
    // The cursor is an optimization; convergence does not depend on it.
  }
  return result;
}
