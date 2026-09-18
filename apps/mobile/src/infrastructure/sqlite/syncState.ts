/**
 * SQLite sync-state adapter (mobile-install-07b).
 *
 * Owns the `sync_state_006` key/value table: cursors recording the last
 * successful pull per scope. Implements the `SyncCursorStore` port defined
 * by `content/syncEngine`; only the composition root wires this adapter.
 * Cursor reads fail closed to null and cursor-write failures are
 * non-fatal by engine design (the cursor is an optimization — sync
 * converges without it).
 */

import type { PassageDbHandle } from '@/content/passageStore';
import type { SyncCursorStore } from '@/content/syncEngine';

export class SqliteSyncState implements SyncCursorStore {
  constructor(private readonly db: PassageDbHandle) {}

  getCursor(key: string): string | null {
    try {
      const row = this.db.getFirstSync<{ value: string }>(
        'SELECT value FROM sync_state WHERE key = ?',
        [key],
      );
      return row?.value ?? null;
    } catch {
      return null;
    }
  }

  async setCursor(key: string, value: string): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO sync_state (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value',
      [key, value],
    );
  }
}
