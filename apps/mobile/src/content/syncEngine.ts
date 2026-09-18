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
 * - Tombstone-wins: server identity is the LOCATION, never the client
 *   id, so concurrent devices converge instead of colliding (finding 3).
 *   Removes record server tombstones; a later add loses to a newer
 *   tombstone instead of resurrecting the row, and a newer add clears the
 *   tombstone it outranks. Timestamp ties go to the delete; unparseable
 *   stamps stay pending (fail-closed). Cross-device clock skew can
 *   misorder near-simultaneous add/remove pairs — documented, not solved.
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
import type { Bookmark, BookmarkRepository, OutboxOp, RemoteTombstoneLocal } from './bookmarkStore';

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

const remoteTombstoneSchema = z.object({
  refsys: z.string().min(1),
  local_key: z.string().min(1),
  deleted_at: z.string().min(1),
});

export interface RemoteBookmark {
  id: string;
  refsys: string;
  localKey: string;
  createdAt: string;
}

export interface RemoteTombstone {
  refsys: string;
  localKey: string;
  deletedAt: string;
}

/**
 * Feature-boundary contract for the server side; the Supabase adapter is
 * the only implementation. Identity is the LOCATION (user, refsys,
 * local_key) — never the client id — so concurrent devices converge
 * instead of colliding (finding 3). Removes are tombstone-wins per the
 * decided D3 policy: a remove records a tombstone and deletes the row; a
 * later add loses to a newer tombstone instead of resurrecting the row.
 */
export interface BookmarkRemoteSource {
  /** Location-identity upsert: converges, never conflicts across devices. */
  pushAdd(row: RemoteBookmark): Promise<void>;
  /** Records the tombstone, then deletes the row (in that order). */
  pushRemove(refsys: string, localKey: string, deletedAt: string, opId: string): Promise<void>;
  findTombstone(refsys: string, localKey: string): Promise<RemoteTombstone | null>;
  clearTombstone(refsys: string, localKey: string): Promise<void>;
  pull(): Promise<{ bookmarks: RemoteBookmark[]; tombstones: RemoteTombstone[] }>;
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
  /** Remote tombstones pulled (before filtering). */
  pulledTombstones: number;
  /** Pushes acked without applying: a newer tombstone already won. */
  suppressed: number;
  /** Local rows deleted by pulled tombstones (no outbox echo). */
  removed: number;
}

/** Milliseconds since epoch, or null when the stamp is unparseable. */
function parseStamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isInteger(parsed) ? parsed : null;
}

/** Canonical UTC form so ISO strings compare lexicographically anywhere. */
function canonicalStamp(value: string): string | null {
  const parsed = parseStamp(value);
  return parsed === null ? null : new Date(parsed).toISOString();
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
    pulledTombstones: 0,
    suppressed: 0,
    removed: 0,
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
        // Tombstone-wins: a newer remove already decided this location.
        // Ack the stale add without resurrecting the row. A newer add
        // outranks the tombstone and clears it. Ties go to the delete.
        // Unparseable stamps stay pending (fail-closed, operator-visible).
        const opTime = parseStamp(op.createdAt);
        if (opTime === null) {
          result.skippedInvalid += 1;
          continue;
        }
        const tomb = await remote.findTombstone(location.refsys, location.localKey);
        const tombTime = tomb ? parseStamp(tomb.deletedAt) : null;
        if (tomb && tombTime === null) {
          result.skippedInvalid += 1;
          continue;
        }
        if (tomb && tombTime !== null && tombTime >= opTime) {
          result.suppressed += 1;
        } else {
          await remote.pushAdd({
            id: op.entityId,
            refsys: location.refsys,
            localKey: location.localKey,
            createdAt: op.createdAt,
          });
          if (tomb) await remote.clearTombstone(location.refsys, location.localKey);
          result.pushed += 1;
        }
      } else {
        await remote.pushRemove(location.refsys, location.localKey, op.createdAt, op.entityId);
        result.pushed += 1;
      }
    } catch (error) {
      // Keep what converged: ack successes before surfacing the failure.
      await bookmarks.ackOps(acked);
      if (error instanceof SyncError) throw error;
      throw new SyncError('network', 'Sync did not finish. Try again when online.');
    }
    acked.push(op.seq);
  }
  await bookmarks.ackOps(acked);

  let remoteRows: RemoteBookmark[];
  let remoteTombs: RemoteTombstone[];
  try {
    const pulled = await remote.pull();
    remoteRows = pulled.bookmarks;
    remoteTombs = pulled.tombstones;
  } catch (error) {
    if (error instanceof SyncError) throw error;
    throw new SyncError('network', 'Sync did not finish. Try again when online.');
  }
  result.pulled = remoteRows.length;
  result.pulledTombstones = remoteTombs.length;

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

  // A pulled tombstone deletes the local row it outranks (same
  // tombstone-wins rule as push), with no outbox echo: the delete is
  // already recorded server-side. Unparseable stamps stay local and
  // counted rather than deleting user data on doubt.
  const stale: RemoteTombstoneLocal[] = [];
  for (const tomb of remoteTombs) {
    const parsed = remoteTombstoneSchema.safeParse({
      refsys: tomb.refsys,
      local_key: tomb.localKey,
      deleted_at: tomb.deletedAt,
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
    const canonical = canonicalStamp(parsed.data.deleted_at);
    if (!coords || !canonical) {
      result.skippedInvalid += 1;
      continue;
    }
    stale.push({
      translationId: BSB_TRANSLATION_ID,
      bookOsis: coords.bookOsis,
      chapter: coords.chapter,
      deletedAt: canonical,
    });
  }
  const cleared = await bookmarks.applyRemoteTombstones(stale);
  result.removed = cleared.removed;

  try {
    await cursors.setCursor(BOOKMARKS_CURSOR_KEY, nowIso());
  } catch {
    // The cursor is an optimization; convergence does not depend on it.
  }
  return result;
}
