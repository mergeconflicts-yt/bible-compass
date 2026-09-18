/**
 * Release-hygiene tripwires (mobile-install-08 headless hardening).
 *
 * These tests fail loudly on changes that need explicit owner + privacy
 * review per AGENTS.md and docs/SECURITY.md: a new runtime dependency, a
 * new native permission or plugin, push-credential wiring, or a new
 * user-facing error string that might leak sensitive material. Updating an
 * allow-list here is itself the review record — never silence a failure
 * without recording why.
 *
 * No native modules load in this file: stores run on fakes and the
 * package/app manifests are read as JSON.
 */

import {
  AuthError,
  getAuthSnapshot,
  initializeAuthStore,
  resetAuthStore,
  signInWith,
  signOut,
  type AuthProvider,
} from '../src/content/authStore';
import { resetBookmarkStore, toggleBookmark } from '../src/content/bookmarkStore';
import {
  SyncError,
  initializeSyncEngine,
  resetSyncEngine,
  syncNow,
  type BookmarkRemoteSource,
  type SyncCursorStore,
} from '../src/content/syncEngine';
import {
  disableReminder,
  enableReminder,
  getReminderSnapshot,
  initializeReminderStore,
  resetReminderStore,
  type ReminderPrefs,
  type ReminderPrefsRepository,
  type ReminderScheduler,
} from '../src/content/reminderStore';

declare const require: (path: string) => unknown;

interface MobileManifest {
  dependencies: Record<string, string>;
  devDependencies: Record<string, string>;
}

interface ExpoConfig {
  plugins: unknown[];
  android?: { permissions?: string[] };
  ios?: { infoPlist?: Record<string, unknown>; UIBackgroundModes?: string[] };
}

const mobilePackage = require('../package.json') as MobileManifest;
const appJson = require('../app.json') as { expo: ExpoConfig };

/** Exact runtime surface that ships to users. Any addition, removal, or version drift fails until reviewed. */
const ALLOWED_DEPENDENCIES: Record<string, string> = {
  '@expo/vector-icons': '15.0.2',
  '@supabase/supabase-js': '2.116.0',
  expo: '57.0.22',
  'expo-constants': '57.0.18',
  'expo-crypto': '~57.0.3',
  'expo-font': '57.0.4',
  'expo-linking': '57.0.10',
  'expo-notifications': '57.0.20',
  'expo-router': '57.0.21',
  'expo-secure-store': '57.0.4',
  'expo-splash-screen': '57.0.9',
  'expo-sqlite': '~57.0.3',
  'expo-status-bar': '57.0.1',
  'expo-symbols': '57.0.3',
  'expo-web-browser': '57.0.3',
  react: '19.2.3',
  'react-dom': '19.2.3',
  'react-native': '0.86.3',
  'react-native-reanimated': '4.5.1',
  'react-native-safe-area-context': '5.7.0',
  'react-native-screens': '4.26.0',
  'react-native-web': '0.21.0',
  'react-native-worklets': '0.10.1',
  zod: '3.23.8',
};

/** Build-time surface. A new entry here is a supply-chain decision. */
const ALLOWED_DEV_DEPENDENCIES: Record<string, string> = {
  '@testing-library/react-native': '13.3.3',
  '@types/jest': '30.0.0',
  '@types/node': '20.19.43',
  '@types/react': '19.2.2',
  eslint: '9.39.5',
  'eslint-config-expo': '57.0.2',
  jest: '29.7.0',
  'jest-expo': '57.0.5',
  prettier: '3.9.6',
  'react-test-renderer': '19.2.3',
  'ts-jest': '29.4.12',
  typescript: '6.0.3',
};

/** Exact native-module surface. A new plugin is a permission review. */
const ALLOWED_PLUGINS: unknown[] = [
  'expo-router',
  [
    'expo-splash-screen',
    {
      image: './assets/images/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#ffffff',
    },
  ],
  'expo-sqlite',
  'expo-secure-store',
  'expo-notifications',
];

describe('dependency and permission inventory', () => {
  it('ships exactly the reviewed runtime dependencies', () => {
    expect(mobilePackage.dependencies).toEqual(ALLOWED_DEPENDENCIES);
  });

  it('builds with exactly the reviewed dev dependencies', () => {
    expect(mobilePackage.devDependencies).toEqual(ALLOWED_DEV_DEPENDENCIES);
  });

  it('declares exactly the reviewed native plugins', () => {
    expect(appJson.expo.plugins).toEqual(ALLOWED_PLUGINS);
  });

  it('requests no device permission beyond notifications', () => {
    // No android.permissions block at all: only the notification runtime
    // prompt (user-gated) and RECEIVE_BOOT_COMPLETED (library manifest).
    expect(appJson.expo.android?.permissions ?? []).toEqual([]);
    const infoPlist = appJson.expo.ios?.infoPlist ?? {};
    for (const key of Object.keys(infoPlist)) {
      expect(key).not.toMatch(/NSLocation|NSCamera|NSMicrophone|NSContacts|NSMotion/);
    }
    expect(appJson.expo.ios?.UIBackgroundModes ?? []).toEqual([]);
  });

  it('configures no remote-push surface on the notifications plugin', () => {
    const entry = appJson.expo.plugins.find(
      (plugin) =>
        (typeof plugin === 'string' && plugin === 'expo-notifications') ||
        (Array.isArray(plugin) && plugin[0] === 'expo-notifications'),
    );
    expect(entry).toBeDefined();
    // Bare string form: no icon/sound assets, no background modes.
    // Push dispatch stays deferred post-MVP (DECISION_M07_SYNC D4).
    expect(entry).toBe('expo-notifications');
  });
});

class FakeAuth implements AuthProvider {
  constructor(private readonly behavior: 'ok' | 'generic-failure' = 'ok') {}

  async getSession(): Promise<null> {
    return null;
  }

  async signIn(): Promise<{ userId: string; provider: 'apple' }> {
    if (this.behavior === 'generic-failure') throw new Error('boom');
    return { userId: 'user-1', provider: 'apple' };
  }

  async signOut(): Promise<void> {}
}

class FakePrefs implements ReminderPrefsRepository {
  stored: ReminderPrefs = { enabled: false, hour: 8, minute: 0 };
  failSaves = false;

  getPrefs(): ReminderPrefs {
    return { ...this.stored };
  }

  async savePrefs(prefs: ReminderPrefs): Promise<void> {
    if (this.failSaves) throw new Error('disk full');
    this.stored = { ...prefs };
  }
}

class FakeScheduler implements ReminderScheduler {
  constructor(public permission: 'granted' | 'denied' | 'undetermined' = 'undetermined') {}

  async getPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
    return this.permission;
  }

  async requestPermission(): Promise<'granted' | 'denied' | 'undetermined'> {
    return this.permission;
  }

  async scheduleDaily(): Promise<void> {}

  async cancelAll(): Promise<void> {}
}

class FakeRemote implements BookmarkRemoteSource {
  async pushAdd(): Promise<void> {}

  async pushRemove(): Promise<void> {}

  async pull(): Promise<never[]> {
    throw new Error('offline');
  }
}

const fakeCursors: SyncCursorStore = {
  getCursor: () => null,
  setCursor: async () => {},
};

const SECRET_LIKE =
  /eyJ[A-Za-z0-9_-]{5,}|[0-9a-f]{8}-[0-9a-f]{4}|token|secret|password|key\s*[:=]/i;

beforeEach(() => {
  resetAuthStore();
  resetBookmarkStore();
  resetSyncEngine();
  resetReminderStore();
});

afterEach(() => {
  resetAuthStore();
  resetBookmarkStore();
  resetSyncEngine();
  resetReminderStore();
});

describe('user-facing error copy', () => {
  it('keeps the exact reviewed bookmark messages', async () => {
    await expect(toggleBookmark('', 'Neh', 2)).rejects.toThrow(
      'Bookmarks need a translation, a book, and a chapter of 1 or more.',
    );
    await expect(toggleBookmark('BSB', 'Neh', 2)).rejects.toThrow(
      'Bookmarks are not ready yet. Try again in a moment.',
    );
  });

  it('keeps the exact reviewed auth messages', async () => {
    await expect(signInWith('apple')).rejects.toThrow('Sync is not configured in this build.');

    initializeAuthStore({
      createAuth: () => new FakeAuth('generic-failure'),
      wipeLibrary: async () => {},
    });
    await signInWith('apple');
    expect(getAuthSnapshot()).toMatchObject({
      status: 'error',
      message: 'Sign-in failed. Try again in a moment.',
    });

    resetAuthStore();
    initializeAuthStore({
      createAuth: () => ({
        getSession: async () => ({ userId: 'user-9', provider: 'google' as const }),
        signIn: async () => ({ userId: 'user-9', provider: 'google' as const }),
        signOut: async () => {},
      }),
      wipeLibrary: async () => {
        throw new Error('disk full');
      },
    });
    await signOut();
    expect(getAuthSnapshot().message).toBe(
      'Sign-out did not finish — your library may remain. Try again.',
    );
  });

  it('keeps the exact reviewed sync messages', async () => {
    await expect(syncNow()).rejects.toThrow('Sync is not configured in this build.');

    initializeSyncEngine({
      bookmarks: {
        listBookmarks: () => [],
        isBookmarked: () => false,
        listPendingOps: () => [],
        toggleBookmark: async () => ({ bookmarked: true }),
        ackOps: async () => {},
        applyRemoteBookmarks: async () => ({ inserted: 0 }),
      },
      cursors: fakeCursors,
      remote: new FakeRemote(),
      getUserId: () => null,
      nowIso: () => '2026-09-15T09:00:00.000Z',
    });
    await expect(syncNow()).rejects.toThrow('Sign in to sync bookmarks.');

    resetSyncEngine();
    initializeSyncEngine({
      bookmarks: {
        listBookmarks: () => [],
        isBookmarked: () => false,
        listPendingOps: () => [],
        toggleBookmark: async () => ({ bookmarked: true }),
        ackOps: async () => {},
        applyRemoteBookmarks: async () => ({ inserted: 0 }),
      },
      cursors: fakeCursors,
      remote: new FakeRemote(),
      getUserId: () => 'user-1',
      nowIso: () => '2026-09-15T09:00:00.000Z',
    });
    try {
      await syncNow();
      throw new Error('expected syncNow to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(SyncError);
      expect((error as SyncError).message).toBe('Sync did not finish. Try again when online.');
    }
  });

  it('keeps the exact reviewed reminder messages', async () => {
    await expect(enableReminder()).rejects.toThrow(
      'Reminders are not ready yet. Try again in a moment.',
    );

    initializeReminderStore({
      createPrefs: () => new FakePrefs(),
      createScheduler: () => new FakeScheduler('denied'),
      nowIso: () => '2026-09-15T09:00:00.000Z',
    });
    await enableReminder();
    expect(getReminderSnapshot().message).toBe(
      'Notifications are off — enable them in system settings, then try again.',
    );

    resetReminderStore();
    const prefs = new FakePrefs();
    prefs.failSaves = true;
    initializeReminderStore({
      createPrefs: () => prefs,
      createScheduler: () => new FakeScheduler('granted'),
      nowIso: () => '2026-09-15T09:00:00.000Z',
    });
    // Granted permission but the schedule itself fails.
    const failingScheduler = new FakeScheduler('granted');
    failingScheduler.scheduleDaily = async () => {
      throw new Error('os rejected');
    };
    resetReminderStore();
    initializeReminderStore({
      createPrefs: () => new FakePrefs(),
      createScheduler: () => failingScheduler,
      nowIso: () => '2026-09-15T09:00:00.000Z',
    });
    await enableReminder();
    expect(getReminderSnapshot().message).toBe(
      'The reminder could not be set. Try again in a moment.',
    );

    resetReminderStore();
    initializeReminderStore({
      createPrefs: () => prefs,
      createScheduler: () => new FakeScheduler('granted'),
      nowIso: () => '2026-09-15T09:00:00.000Z',
    });
    await disableReminder();
    expect(getReminderSnapshot().message).toBe(
      'The reminder could not be turned off. Try again in a moment.',
    );
  });

  it('leaks no secret-like material in any reviewed message', async () => {
    const messages: string[] = [];
    const capture = (error: unknown): void => {
      if (error instanceof AuthError) messages.push(error.message);
      else if (error instanceof Error) messages.push(error.message);
    };
    try {
      await toggleBookmark('', 'Neh', 2);
    } catch (error) {
      capture(error);
    }
    try {
      await signInWith('apple');
    } catch (error) {
      capture(error);
    }
    try {
      await syncNow();
    } catch (error) {
      capture(error);
    }
    try {
      await enableReminder();
    } catch (error) {
      capture(error);
    }
    messages.push(
      getAuthSnapshot().message ?? '',
      getReminderSnapshot().message ?? '',
      'Sign-out did not finish — your library may remain. Try again.',
      'Sign-in failed. Try again in a moment.',
      'Sync did not finish. Try again when online.',
      'Notifications are off — enable them in system settings, then try again.',
      'The reminder could not be set. Try again in a moment.',
      'The reminder could not be turned off. Try again in a moment.',
    );
    expect(messages.length).toBeGreaterThan(5);
    for (const message of messages) {
      expect(message).not.toMatch(SECRET_LIKE);
      expect(message).not.toContain('undefined');
      expect(message).not.toContain('[object');
    }
  });
});
