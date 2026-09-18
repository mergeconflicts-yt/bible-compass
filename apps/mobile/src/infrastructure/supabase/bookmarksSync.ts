/**
 * Supabase bookmark-sync adapter (finding 3).
 *
 * The only module besides `auth.ts` allowed to import
 * `@supabase/supabase-js`. Implements the `BookmarkRemoteSource` port from
 * `content/syncEngine`: location-identity upserts (converge across
 * devices, never conflict on client ids) plus server tombstones for
 * tombstone-wins removes. RLS (`auth.uid() = user_id`) is the
 * authorization boundary — this adapter never bypasses it and never
 * touches `service_role` keys (docs/SECURITY.md). Only the public anon
 * key enters the bundle.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  SyncError,
  type BookmarkRemoteSource,
  type RemoteBookmark,
  type RemoteTombstone,
} from '@/content/syncEngine';

interface ServerBookmarkRow {
  id: string;
  refsys: string;
  local_key: string;
  created_at: string;
}

interface ServerTombstoneRow {
  refsys: string;
  local_key: string;
  deleted_at: string;
}

function toSyncError(error: unknown): SyncError {
  const message = error instanceof Error ? error.message : 'Sync did not finish.';
  const lowered = message.toLowerCase();
  if (lowered.includes('jwt') || lowered.includes('auth') || lowered.includes('unauthorized')) {
    return new SyncError('auth', 'Your session expired. Sign in again.');
  }
  return new SyncError('network', 'Sync did not finish. Try again when online.');
}

export class SupabaseBookmarkSync implements BookmarkRemoteSource {
  constructor(
    private readonly client: SupabaseClient,
    private readonly userId: string,
  ) {}

  private table(): ReturnType<SupabaseClient['schema']> {
    // User-library tables live in private_staging with owner RLS grants to
    // `authenticated` (migrations 20260915000006_user_library,
    // 20260915000007_bookmark_identity, 20260915000008_bookmark_tombstones).
    // There is no public view: anon has no grants and reads nothing.
    return this.client.schema('private_staging');
  }

  async pushAdd(row: RemoteBookmark): Promise<void> {
    try {
      // Identity is (user, refsys, local_key): concurrent devices upsert
      // the same row instead of colliding on client ids. The id is left
      // to its default — the client never addresses rows by id.
      const { error } = await this.table().from('bookmarks').upsert(
        {
          user_id: this.userId,
          refsys: row.refsys,
          local_key: row.localKey,
        },
        { onConflict: 'user_id,refsys,local_key', ignoreDuplicates: true },
      );
      if (error) throw new Error(error.message);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw toSyncError(error);
    }
  }

  async pushRemove(
    refsys: string,
    localKey: string,
    deletedAt: string,
    opId: string,
  ): Promise<void> {
    try {
      // Tombstone first, then the row: a crash between the calls leaves a
      // tombstone without a row (a later newer add clears it), never a
      // row without a tombstone (which would resurrect on replay).
      const { error: tombError } = await this.table().from('bookmark_tombstones').upsert(
        {
          user_id: this.userId,
          refsys,
          local_key: localKey,
          deleted_at: deletedAt,
          client_op_id: opId,
        },
        { onConflict: 'user_id,refsys,local_key' },
      );
      if (tombError) throw new Error(tombError.message);
      const { error: deleteError } = await this.table()
        .from('bookmarks')
        .delete()
        .eq('user_id', this.userId)
        .eq('refsys', refsys)
        .eq('local_key', localKey);
      if (deleteError) throw new Error(deleteError.message);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw toSyncError(error);
    }
  }

  async findTombstone(refsys: string, localKey: string): Promise<RemoteTombstone | null> {
    try {
      const { data, error } = await this.table()
        .from('bookmark_tombstones')
        .select('refsys, local_key, deleted_at')
        .eq('user_id', this.userId)
        .eq('refsys', refsys)
        .eq('local_key', localKey)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return null;
      const row = data as ServerTombstoneRow;
      return { refsys: row.refsys, localKey: row.local_key, deletedAt: row.deleted_at };
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw toSyncError(error);
    }
  }

  async clearTombstone(refsys: string, localKey: string): Promise<void> {
    try {
      const { error } = await this.table()
        .from('bookmark_tombstones')
        .delete()
        .eq('user_id', this.userId)
        .eq('refsys', refsys)
        .eq('local_key', localKey);
      if (error) throw new Error(error.message);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw toSyncError(error);
    }
  }

  async pull(): Promise<{ bookmarks: RemoteBookmark[]; tombstones: RemoteTombstone[] }> {
    try {
      const [{ data: markData, error: markError }, { data: tombData, error: tombError }] =
        await Promise.all([
          this.table()
            .from('bookmarks')
            .select('id, refsys, local_key, created_at')
            .eq('user_id', this.userId)
            .order('created_at', { ascending: true }),
          this.table()
            .from('bookmark_tombstones')
            .select('refsys, local_key, deleted_at')
            .eq('user_id', this.userId)
            .order('deleted_at', { ascending: true }),
        ]);
      if (markError) throw new Error(markError.message);
      if (tombError) throw new Error(tombError.message);
      return {
        bookmarks: ((markData ?? []) as ServerBookmarkRow[]).map((row) => ({
          id: row.id,
          refsys: row.refsys,
          localKey: row.local_key,
          createdAt: row.created_at,
        })),
        tombstones: ((tombData ?? []) as ServerTombstoneRow[]).map((row) => ({
          refsys: row.refsys,
          localKey: row.local_key,
          deletedAt: row.deleted_at,
        })),
      };
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw toSyncError(error);
    }
  }
}
