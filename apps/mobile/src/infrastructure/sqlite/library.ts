/**
 * User-library wipe (mobile-install-07a).
 *
 * Deletes every user-data row — bookmarks, outbox, recents, progress — in
 * one transaction for sign-out (owner decision D5: destructive). Licensed
 * Scripture cache tables (`content_installations`, `reference_units`,
 * `verses`, `headings`) are deliberately untouched: they re-seed from the
 * bundle and are not user data.
 */

import type { PassageDbHandle } from '@/content/passageStore';

const USER_TABLES = ['outbox', 'bookmarks', 'recents', 'progress'] as const;

export async function wipeUserData(db: PassageDbHandle): Promise<void> {
  await db.withTransactionAsync(async () => {
    for (const table of USER_TABLES) {
      await db.runAsync(`DELETE FROM ${table}`);
    }
  });
}
