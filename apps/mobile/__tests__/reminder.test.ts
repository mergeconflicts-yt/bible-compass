/**
 * Daily-reminder store (mobile-install-07c).
 *
 * Store tests against in-memory fakes (no native modules): fail-closed
 * unconfigured reads, default-disabled init, opt-in permission flow
 * (prompt only from the explicit toggle), denied-permission guidance,
 * opt-out cancel, boot restore, and scheduler-failure handling. The
 * adapter section proves the 007 table round-trips on a real engine
 * (`node:sqlite`, needs Node 22 + --experimental-sqlite via the `test`
 * script) including clamp-back of out-of-range rows.
 */

import {
  REMINDER_HOUR,
  REMINDER_MINUTE,
  ReminderError,
  disableReminder,
  enableReminder,
  getReminderSnapshot,
  initializeReminderStore,
  isReminderReady,
  resetReminderStore,
  restoreReminder,
  type ReminderPermission,
  type ReminderPrefs,
  type ReminderPrefsRepository,
  type ReminderScheduler,
} from '../src/content/reminderStore';
import type { PassageDbHandle } from '../src/content/passageStore';
import { SqliteReminders } from '../src/infrastructure/sqlite/reminders';
import { LEDGER_SQL } from '../src/infrastructure/sqlite/runner';
import { MIGRATIONS } from '../src/infrastructure/sqlite/migrations';

declare const require: (path: string) => unknown;

class FakePrefs implements ReminderPrefsRepository {
  stored: ReminderPrefs = { enabled: false, hour: REMINDER_HOUR, minute: REMINDER_MINUTE };
  saves = 0;

  getPrefs(): ReminderPrefs {
    return { ...this.stored };
  }

  async savePrefs(prefs: ReminderPrefs): Promise<void> {
    this.saves += 1;
    this.stored = { ...prefs };
  }
}

class FakeScheduler implements ReminderScheduler {
  permission: ReminderPermission = 'undetermined';
  permissionCalls: string[] = [];
  scheduled: { hour: number; minute: number }[] = [];
  cancels = 0;
  failSchedule = false;

  async getPermission(): Promise<ReminderPermission> {
    this.permissionCalls.push('get');
    return this.permission;
  }

  async requestPermission(): Promise<ReminderPermission> {
    this.permissionCalls.push('request');
    return this.permission;
  }

  async scheduleDaily(hour: number, minute: number): Promise<void> {
    if (this.failSchedule) throw new Error('fake schedule failure');
    this.scheduled.push({ hour, minute });
  }

  async cancelAll(): Promise<void> {
    this.cancels += 1;
  }
}

function initStore(prefs: FakePrefs, scheduler: FakeScheduler): void {
  initializeReminderStore({
    createPrefs: () => prefs,
    createScheduler: () => scheduler,
    nowIso: () => '2026-09-15T09:00:00.000Z',
  });
}

beforeEach(() => {
  resetReminderStore();
});

afterEach(() => {
  resetReminderStore();
});

describe('reminder store', () => {
  it('fails closed when uninitialized', async () => {
    expect(isReminderReady()).toBe(false);
    expect(getReminderSnapshot().status).toBe('disabled');
    await expect(enableReminder()).rejects.toMatchObject({ code: 'unconfigured' });
    await expect(disableReminder()).rejects.toMatchObject({ code: 'unconfigured' });
  });

  it('starts disabled and restores persisted opt-in on init', () => {
    initStore(new FakePrefs(), new FakeScheduler());
    expect(getReminderSnapshot()).toMatchObject({
      status: 'disabled',
      prefs: { enabled: false, hour: 8, minute: 0 },
    });

    resetReminderStore();
    const prefs = new FakePrefs();
    prefs.stored = { enabled: true, hour: 8, minute: 0 };
    initStore(prefs, new FakeScheduler());
    expect(getReminderSnapshot().status).toBe('enabled');
  });

  it('opts in with one permission prompt, then persists and schedules 08:00', async () => {
    const prefs = new FakePrefs();
    const scheduler = new FakeScheduler();
    scheduler.permission = 'undetermined';
    scheduler.requestPermission = async () => {
      scheduler.permissionCalls.push('request');
      scheduler.permission = 'granted';
      return 'granted';
    };
    initStore(prefs, scheduler);

    await enableReminder();

    expect(scheduler.permissionCalls).toEqual(['get', 'request']);
    expect(scheduler.scheduled).toEqual([{ hour: 8, minute: 0 }]);
    expect(prefs.stored).toEqual({ enabled: true, hour: 8, minute: 0 });
    expect(getReminderSnapshot().status).toBe('enabled');
  });

  it('skips the prompt when permission is already granted', async () => {
    const scheduler = new FakeScheduler();
    initStore(new FakePrefs(), scheduler);
    // getPermission reports granted on first call; the store must not
    // request a second time. Model that by flipping after the get.
    const seen: string[] = [];
    scheduler.getPermission = async () => {
      seen.push('get');
      return 'granted';
    };
    scheduler.requestPermission = async () => {
      seen.push('request');
      return 'granted';
    };

    await enableReminder();

    expect(seen).toEqual(['get']);
  });

  it('stays disabled with settings guidance when permission is denied', async () => {
    const prefs = new FakePrefs();
    const scheduler = new FakeScheduler();
    scheduler.permission = 'denied';
    initStore(prefs, scheduler);

    await enableReminder();

    const snapshot = getReminderSnapshot();
    expect(snapshot.status).toBe('error');
    expect(snapshot.message).toContain('system settings');
    expect(prefs.stored.enabled).toBe(false);
    expect(scheduler.scheduled).toEqual([]);
  });

  it('reports a retryable error when scheduling fails', async () => {
    const scheduler = new FakeScheduler();
    scheduler.permission = 'granted';
    scheduler.failSchedule = true;
    initStore(new FakePrefs(), scheduler);

    await enableReminder();

    const snapshot = getReminderSnapshot();
    expect(snapshot.status).toBe('error');
    expect(snapshot.prefs.enabled).toBe(false);
  });

  it('opts out by cancelling and persisting disabled', async () => {
    const prefs = new FakePrefs();
    prefs.stored = { enabled: true, hour: 8, minute: 0 };
    const scheduler = new FakeScheduler();
    initStore(prefs, scheduler);

    await disableReminder();

    expect(scheduler.cancels).toBe(1);
    expect(prefs.stored.enabled).toBe(false);
    expect(getReminderSnapshot().status).toBe('disabled');
  });

  it('restores the persisted schedule on boot without prompting', async () => {
    const prefs = new FakePrefs();
    prefs.stored = { enabled: true, hour: 8, minute: 0 };
    const scheduler = new FakeScheduler();
    scheduler.permission = 'granted';
    initStore(prefs, scheduler);

    await restoreReminder();

    expect(scheduler.permissionCalls).toEqual(['get']);
    expect(scheduler.scheduled).toEqual([{ hour: 8, minute: 0 }]);
    expect(getReminderSnapshot().status).toBe('enabled');
  });

  it('does nothing on boot when disabled or permission was revoked', async () => {
    const disabledPrefs = new FakePrefs();
    const disabledScheduler = new FakeScheduler();
    initStore(disabledPrefs, disabledScheduler);
    await restoreReminder();
    expect(disabledScheduler.scheduled).toEqual([]);

    resetReminderStore();
    const revokedPrefs = new FakePrefs();
    revokedPrefs.stored = { enabled: true, hour: 8, minute: 0 };
    const revokedScheduler = new FakeScheduler();
    revokedScheduler.permission = 'denied';
    initStore(revokedPrefs, revokedScheduler);
    await restoreReminder();
    expect(revokedScheduler.scheduled).toEqual([]);
    // Prefs stay as the user left them for the next launch.
    expect(revokedPrefs.stored.enabled).toBe(true);
  });

  it('exposes ReminderError for unconfigured use', () => {
    expect(new ReminderError('unconfigured', 'x')).toMatchObject({ code: 'unconfigured' });
  });
});

interface NodeSqliteStatement {
  all<T>(...params: (string | number)[]): T[];
  get<T>(...params: (string | number)[]): T | undefined;
  run(...params: (string | number)[]): {
    changes: number | bigint;
    lastInsertRowid: number | bigint;
  };
}

interface NodeSqliteDatabase {
  exec(source: string): void;
  prepare(source: string): NodeSqliteStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => NodeSqliteDatabase;
}

function loadNodeSqlite(): NodeSqliteModule | null {
  try {
    return require('node:sqlite') as NodeSqliteModule;
  } catch {
    return null;
  }
}

const nodeSqlite = loadNodeSqlite();

const { mkdtempSync, rmSync } = require('fs') as {
  mkdtempSync: (prefix: string) => string;
  rmSync: (path: string, opts: { recursive: boolean; force: boolean }) => void;
};
const { tmpdir } = require('os') as { tmpdir: () => string };
const { join } = require('path') as { join: (...parts: string[]) => string };

(nodeSqlite ? describe : describe.skip)('reminder prefs on a real engine', () => {
  it('round-trips the opt-in row and rejects out-of-range writes', async () => {
    if (!nodeSqlite) throw new Error('unreachable: suite skips without node:sqlite');
    const dir = mkdtempSync(join(tmpdir(), 'm07c-reminder-'));
    const file = join(dir, 'reminder.db');
    try {
      const raw = new (nodeSqlite as NodeSqliteModule).DatabaseSync(file);
      raw.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
      const handle: PassageDbHandle = {
        execAsync: async (source: string): Promise<void> => {
          raw.exec(source);
        },
        runAsync: async (source: string, params: (string | number)[] = []) => {
          const result = raw.prepare(source).run(...params);
          return {
            lastInsertRowId: Number(result.lastInsertRowid),
            changes: Number(result.changes),
          };
        },
        getAllAsync: async <T>(source: string, params: (string | number)[] = []): Promise<T[]> =>
          raw.prepare(source).all<T>(...params),
        getAllSync: <T>(source: string, params: (string | number)[]): T[] =>
          raw.prepare(source).all<T>(...params),
        getFirstSync: <T>(source: string, params: (string | number)[]): T | null =>
          raw.prepare(source).get<T>(...params) ?? null,
        withTransactionAsync: async (task: () => Promise<void>): Promise<void> => {
          raw.exec('BEGIN IMMEDIATE;');
          try {
            await task();
            raw.exec('COMMIT;');
          } catch (error) {
            try {
              raw.exec('ROLLBACK;');
            } catch {
              // Already rolled back; surface the original failure.
            }
            throw error;
          }
        },
      };
      await handle.execAsync(LEDGER_SQL);
      for (const migration of MIGRATIONS) {
        await handle.execAsync(migration.sql);
      }
      const repo = new SqliteReminders(handle);

      expect(repo.getPrefs()).toEqual({ enabled: false, hour: 8, minute: 0 });
      await repo.savePrefs({ enabled: true, hour: 8, minute: 0 });
      expect(repo.getPrefs()).toEqual({ enabled: true, hour: 8, minute: 0 });
      // Out-of-range rows never land: the CHECK rejects them and the
      // stored row keeps serving the approved 08:00.
      await expect(
        handle.runAsync('UPDATE reminder SET hour = ?, minute = ? WHERE id = 1', [99, -1]),
      ).rejects.toThrow();
      expect(repo.getPrefs()).toEqual({ enabled: true, hour: 8, minute: 0 });
      raw.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

if (!nodeSqlite) {
  it.skip('SKIP: node:sqlite unavailable (needs Node 22 + --experimental-sqlite); reminder adapter test skipped loudly.', () =>
    undefined);
}
