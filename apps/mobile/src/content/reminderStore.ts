/**
 * Daily-reminder store (mobile-install-07c).
 *
 * Owns the opt-in daily-verse reminder: disabled by default, explicit
 * enable only, permission requested solely as a result of the user's own
 * opt-in tap (docs/SECURITY.md:118). No server, no push credentials, no
 * token storage — the OS delivers one local notification per day (D4).
 *
 * Approved product policy (docs/DECISION_M07_SYNC.md): copy
 * "Your verse of the day is ready · Nehemiah 2:4", 08:00 local, opt-in
 * only. The persisted hour/minute default to 08:00 so a future
 * user-selected time needs no new migration; there is no time-picker UI
 * in this task.
 *
 * This module never imports infrastructure, native modules, or network
 * clients. The composition root (`app/_layout.tsx`) injects the SQLite
 * prefs repository and the notifications scheduler; tests inject fakes.
 */

export const REMINDER_HOUR = 8;
export const REMINDER_MINUTE = 0;

/** Approved PD-020 copy, split across title/body (the `·` join preserved). */
export const REMINDER_COPY = {
  title: 'Your verse of the day is ready',
  body: 'Nehemiah 2:4',
} as const;

/** Marker carried in the notification payload; taps open today's verse. */
export const REMINDER_PAYLOAD_KIND = 'daily-verse';

export interface ReminderPrefs {
  enabled: boolean;
  hour: number;
  minute: number;
}

export const REMINDER_DEFAULTS: ReminderPrefs = {
  enabled: false,
  hour: REMINDER_HOUR,
  minute: REMINDER_MINUTE,
};

/** Feature-boundary contract; the SQLite adapter implements it. */
export interface ReminderPrefsRepository {
  /** Fail-closed defaults when no row exists or the store is unreadable. */
  getPrefs(): ReminderPrefs;
  savePrefs(prefs: ReminderPrefs): Promise<void>;
}

export type ReminderPermission = 'granted' | 'denied' | 'undetermined';

/** Feature-boundary contract; the notifications adapter implements it. */
export interface ReminderScheduler {
  getPermission(): Promise<ReminderPermission>;
  /** Prompts only when called from the explicit opt-in flow. */
  requestPermission(): Promise<ReminderPermission>;
  /** Replaces any existing daily (cancel-then-schedule: exactly one). */
  scheduleDaily(hour: number, minute: number): Promise<void>;
  cancelAll(): Promise<void>;
}

export type ReminderStatus = 'disabled' | 'enabling' | 'enabled' | 'error';

export interface ReminderState {
  status: ReminderStatus;
  prefs: ReminderPrefs;
  message: string | null;
}

export type ReminderErrorCode = 'unconfigured' | 'unavailable';

export class ReminderError extends Error {
  readonly code: ReminderErrorCode;

  constructor(code: ReminderErrorCode, message: string) {
    super(message);
    this.name = 'ReminderError';
    this.code = code;
  }
}

export interface ReminderStoreDeps {
  createPrefs: () => ReminderPrefsRepository;
  createScheduler: () => ReminderScheduler;
  nowIso: () => string;
}

let deps: ReminderStoreDeps | null = null;
let state: ReminderState = { status: 'disabled', prefs: REMINDER_DEFAULTS, message: null };
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) {
    listener();
  }
}

/** React subscription for screens; the store itself stays UI-free. */
export function subscribeReminder(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getReminderSnapshot(): ReminderState {
  return state;
}

export function initializeReminderStore(next: ReminderStoreDeps): void {
  deps = next;
  // Fail-closed read: an unreadable store renders disabled, never crashes.
  try {
    const prefs = next.createPrefs().getPrefs();
    state = { status: prefs.enabled ? 'enabled' : 'disabled', prefs, message: null };
  } catch {
    state = { status: 'disabled', prefs: REMINDER_DEFAULTS, message: null };
  }
}

/** True once the composition root installs prefs + scheduler. */
export function isReminderReady(): boolean {
  return deps !== null;
}

export function resetReminderStore(): void {
  deps = null;
  state = { status: 'disabled', prefs: REMINDER_DEFAULTS, message: null };
  emit();
}

function validTime(hour: number, minute: number): boolean {
  return (
    Number.isInteger(hour) &&
    Number.isInteger(minute) &&
    hour >= 0 &&
    hour < 24 &&
    minute >= 0 &&
    minute < 60
  );
}

/**
 * Explicit opt-in. Requests OS permission only from this user action, then
 * persists and schedules at the approved 08:00. A denied permission or a
 * driver failure leaves the reminder disabled with a retryable message —
 * the reminder is never half-on.
 */
export async function enableReminder(): Promise<void> {
  if (!deps) {
    throw new ReminderError('unconfigured', 'Reminders are not ready yet. Try again in a moment.');
  }
  state = { status: 'enabling', prefs: state.prefs, message: null };
  emit();
  try {
    const scheduler = deps.createScheduler();
    let permission = await scheduler.getPermission();
    if (permission !== 'granted') {
      permission = await scheduler.requestPermission();
    }
    if (permission !== 'granted') {
      state = {
        status: 'error',
        prefs: { ...REMINDER_DEFAULTS },
        message: 'Notifications are off — enable them in system settings, then try again.',
      };
      emit();
      return;
    }
    const prefs: ReminderPrefs = {
      enabled: true,
      hour: REMINDER_HOUR,
      minute: REMINDER_MINUTE,
    };
    await scheduler.scheduleDaily(prefs.hour, prefs.minute);
    await deps.createPrefs().savePrefs(prefs);
    state = { status: 'enabled', prefs, message: null };
  } catch {
    state = {
      status: 'error',
      prefs: { ...REMINDER_DEFAULTS },
      message: 'The reminder could not be set. Try again in a moment.',
    };
  }
  emit();
}

/** Opt-out. Cancels the scheduled daily and persists disabled. */
export async function disableReminder(): Promise<void> {
  if (!deps) {
    throw new ReminderError('unconfigured', 'Reminders are not ready yet. Try again in a moment.');
  }
  try {
    await deps.createScheduler().cancelAll();
  } catch {
    // The local disabled state is authoritative; a failed cancel is
    // repaired by the next enable (cancel-then-schedule) or boot restore.
  }
  try {
    await deps.createPrefs().savePrefs({ ...REMINDER_DEFAULTS });
  } catch {
    state = {
      status: 'error',
      prefs: state.prefs,
      message: 'The reminder could not be turned off. Try again in a moment.',
    };
    emit();
    return;
  }
  state = { status: 'disabled', prefs: { ...REMINDER_DEFAULTS }, message: null };
  emit();
}

/**
 * Re-asserts the persisted schedule on cold start (the OS may drop
 * scheduled notifications across reinstalls or updates). Silent by design:
 * failures keep the persisted prefs untouched for the next launch.
 */
export async function restoreReminder(): Promise<void> {
  if (!deps) return;
  let prefs: ReminderPrefs;
  try {
    prefs = deps.createPrefs().getPrefs();
  } catch {
    return;
  }
  if (!prefs.enabled || !validTime(prefs.hour, prefs.minute)) return;
  try {
    if ((await deps.createScheduler().getPermission()) !== 'granted') return;
    await deps.createScheduler().scheduleDaily(prefs.hour, prefs.minute);
  } catch {
    // Next launch retries; prefs stay as the user left them.
  }
  state = { status: 'enabled', prefs, message: null };
  emit();
}
