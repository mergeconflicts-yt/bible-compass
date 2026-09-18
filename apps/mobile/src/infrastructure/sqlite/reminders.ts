/**
 * SQLite reminder-prefs adapter (mobile-install-07c).
 *
 * Owns the single-row `reminder_007` table (id = 1). Reads fail closed to
 * the store defaults; out-of-range rows (e.g. written by a future build)
 * are clamped back to the approved 08:00 rather than trusted. Driver
 * errors propagate so the store can render error-and-retry.
 */

import type { PassageDbHandle } from '@/content/passageStore';
import {
  REMINDER_DEFAULTS,
  REMINDER_HOUR,
  REMINDER_MINUTE,
  type ReminderPrefs,
  type ReminderPrefsRepository,
} from '@/content/reminderStore';

interface ReminderRow {
  enabled: number;
  hour: number;
  minute: number;
}

function sanitize(row: ReminderRow | null): ReminderPrefs {
  if (!row) return { ...REMINDER_DEFAULTS };
  const hour =
    Number.isInteger(row.hour) && row.hour >= 0 && row.hour < 24 ? row.hour : REMINDER_HOUR;
  const minute =
    Number.isInteger(row.minute) && row.minute >= 0 && row.minute < 60
      ? row.minute
      : REMINDER_MINUTE;
  return { enabled: row.enabled === 1, hour, minute };
}

export class SqliteReminders implements ReminderPrefsRepository {
  constructor(private readonly db: PassageDbHandle) {}

  getPrefs(): ReminderPrefs {
    const row = this.db.getFirstSync<ReminderRow>(
      'SELECT enabled, hour, minute FROM reminder WHERE id = 1',
      [],
    );
    return sanitize(row);
  }

  async savePrefs(prefs: ReminderPrefs): Promise<void> {
    await this.db.runAsync(
      'INSERT INTO reminder (id, enabled, hour, minute, updated_at) VALUES (1, ?, ?, ?, ?) ON CONFLICT (id) DO UPDATE SET enabled = excluded.enabled, hour = excluded.hour, minute = excluded.minute, updated_at = excluded.updated_at',
      [prefs.enabled ? 1 : 0, prefs.hour, prefs.minute, new Date().toISOString()],
    );
  }
}
