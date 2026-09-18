/**
 * Supabase bookmark-sync adapter (mobile-install-07b).
 *
 * The only module besides `auth.ts` allowed to import
 * `@supabase/supabase-js`. Implements the `BookmarkRemoteSource` port from
 * `content/syncEngine`: idempotent push (adds upsert by client id, removes
 * delete by location for cross-device tombstone-wins) plus full pull.
 * RLS (`auth.uid() = user_id`) is the authorization boundary — this adapter
 * never bypasses it and never touches `service_role` keys
 * (docs/SECURITY.md). Only the public anon key enters the bundle.
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import { SyncError, type BookmarkRemoteSource, type RemoteBookmark } from '@/content/syncEngine';

interface ServerBookmarkRow {
  id: string;
  refsys: string;
  local_key: string;
  created_at: string;
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
    // `authenticated` (migration 20260915000006_user_library). There is no
    // public view: anon has no grants and reads nothing.
    return this.client.schema('private_staging');
  }

  async pushAdd(row: RemoteBookmark): Promise<void> {
    try {
      const { error } = await this.table().from('bookmarks').upsert(
        {
          id: row.id,
          user_id: this.userId,
          refsys: row.refsys,
          local_key: row.localKey,
        },
        { onConflict: 'id' },
      );
      if (error) throw new Error(error.message);
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw toSyncError(error);
    }
  }

  async pushRemove(refsys: string, localKey: string): Promise<void> {
    try {
      // Delete by location (not id): a remove converges even when the row
      // was created on another device with a different client id.
      const { error } = await this.table()
        .from('bookmarks')
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

  async pull(): Promise<RemoteBookmark[]> {
    try {
      const { data, error } = await this.table()
        .from('bookmarks')
        .select('id, refsys, local_key, created_at')
        .eq('user_id', this.userId)
        .order('created_at', { ascending: true });
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as ServerBookmarkRow[];
      return rows.map((row) => ({
        id: row.id,
        refsys: row.refsys,
        localKey: row.local_key,
        createdAt: row.created_at,
      }));
    } catch (error) {
      if (error instanceof SyncError) throw error;
      throw toSyncError(error);
    }
  }
}
