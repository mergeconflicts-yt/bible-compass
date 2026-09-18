import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider, router } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import 'react-native-reanimated';

import { AppPreferencesProvider, usePreferences } from '@/theme/ThemeProvider';
import { getChapter as getBundledChapter } from '@/content/bsb';
import {
  BSB_EDITION_KEY,
  BSB_REFSYS,
  BSB_TRANSLATION_ID,
  initializePassageContent,
} from '@/content/passageStore';
import { initializeBookmarkStore } from '@/content/bookmarkStore';
import { initializeRecentStore } from '@/content/recentStore';
import { initializeProgressStore } from '@/content/progressStore';
import { initializeReminderStore, restoreReminder } from '@/content/reminderStore';
import { todayKey } from '@/lib/daily';
import { getAuthSnapshot, initializeAuthStore, restoreSession } from '@/content/authStore';
import { initializeSyncEngine, syncNow, type RemoteBookmark } from '@/content/syncEngine';
import { config, isSyncConfigured } from '@/config';
import { createAppSupabaseClient, SupabaseAuth } from '@/infrastructure/supabase/auth';
import { SupabaseBookmarkSync } from '@/infrastructure/supabase/bookmarksSync';
import { wipeUserData } from '@/infrastructure/sqlite/library';
import {
  asPassageDbHandle,
  hashSqlWithExpoCrypto,
  newClientId,
  openAppDatabase,
} from '@/infrastructure/sqlite/database';
import { projectChapter } from '@/infrastructure/sqlite/projection';
import { SqlitePassageRepository } from '@/infrastructure/sqlite/passageRepository';
import { SqliteBookmarks } from '@/infrastructure/sqlite/bookmarks';
import { SqliteRecents } from '@/infrastructure/sqlite/recents';
import { SqliteProgress } from '@/infrastructure/sqlite/progress';
import { SqliteReminders } from '@/infrastructure/sqlite/reminders';
import { SqliteSyncState } from '@/infrastructure/sqlite/syncState';
import {
  ExpoReminderScheduler,
  installReminderPresentation,
  subscribeReminderResponses,
} from '@/infrastructure/notifications/reminder';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  // Offline-first content: open SQLite once, project Nehemiah for the
  // default translation, and activate the passage, bookmark, recent, and
  // progress repositories. Fire-and-forget by design — any failure keeps
  // bundled JSON with zero visual change (bookmarks unpersisted, recents
  // hidden, continue-reading defaulted), and no state updates here means no
  // act() noise in tests.
  useEffect(() => {
    const seed = async (): Promise<void> => {
      const handle = asPassageDbHandle(await openAppDatabase());
      await initializePassageContent(
        {
          openDatabase: async () => handle,
          projectChapter: (db, input, opts, hashText) => projectChapter(db, input, opts, hashText),
          hashText: (text) => hashSqlWithExpoCrypto(text),
          getBundledChapter: (bookOsis, chapter, translationId) =>
            getBundledChapter(bookOsis, chapter, translationId),
          createRepository: (db) => new SqlitePassageRepository(db, BSB_EDITION_KEY, BSB_REFSYS),
        },
        BSB_TRANSLATION_ID,
      );
      initializeBookmarkStore({
        createRepository: (db) => new SqliteBookmarks(db),
        db: handle,
        newId: () => newClientId(),
      });
      initializeRecentStore({
        createRepository: (db) => new SqliteRecents(db),
        db: handle,
      });
      initializeProgressStore({
        createRepository: (db) => new SqliteProgress(db),
        db: handle,
      });
      initializeReminderStore({
        createPrefs: () => new SqliteReminders(handle),
        createScheduler: () => new ExpoReminderScheduler(),
        nowIso: () => new Date().toISOString(),
      });
      // Reminder presentation must never break the reader: a failure here
      // (e.g. an unsupported build) leaves the store usable for retry.
      try {
        await installReminderPresentation();
      } catch {
        // Reminders unavailable on this build; opt-in reports it per attempt.
      }
      restoreReminder().catch(() => {});
      // Auth is opt-in and project-gated: unconfigured builds stay fully
      // anonymous with the account section honestly disabled.
      if (isSyncConfigured() && config.supabaseUrl && config.supabaseAnonKey) {
        const supabase = createAppSupabaseClient(config.supabaseUrl, config.supabaseAnonKey);
        initializeAuthStore({
          createAuth: () => new SupabaseAuth(supabase),
          wipeLibrary: () => wipeUserData(handle),
        });
        // Sync engine shares the handle and client but never runs on boot:
        // the user id is read lazily so sign-in/out needs no re-init, and
        // the post-restore sync below is fire-and-forget (offline startup
        // must never wait for the network).
        const remoteForCurrentUser = (): SupabaseBookmarkSync =>
          new SupabaseBookmarkSync(supabase, getAuthSnapshot().userId ?? '');
        initializeSyncEngine({
          bookmarks: new SqliteBookmarks(handle),
          cursors: new SqliteSyncState(handle),
          remote: {
            pushAdd: (row: RemoteBookmark) => remoteForCurrentUser().pushAdd(row),
            pushRemove: (refsys: string, localKey: string, deletedAt: string, opId: string) =>
              remoteForCurrentUser().pushRemove(refsys, localKey, deletedAt, opId),
            findTombstone: (refsys: string, localKey: string) =>
              remoteForCurrentUser().findTombstone(refsys, localKey),
            clearTombstone: (refsys: string, localKey: string) =>
              remoteForCurrentUser().clearTombstone(refsys, localKey),
            pull: () => remoteForCurrentUser().pull(),
          },
          getUserId: () => getAuthSnapshot().userId,
          nowIso: () => new Date().toISOString(),
        });
        await restoreSession();
        if (getAuthSnapshot().status === 'signed-in') {
          syncNow().catch(() => {});
        }
      }
    };
    seed().catch(() => {});
  }, []);
  // Reminder taps open today's daily verse (cold-start tap included).
  // Notification failures never break navigation: no subscription, no taps.
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    try {
      unsubscribe = subscribeReminderResponses(() => {
        router.push({ pathname: '/daily/[date]', params: { date: todayKey() } });
      });
    } catch {
      unsubscribe = null;
    }
    return () => {
      unsubscribe?.();
    };
  }, []);
  return (
    <AppPreferencesProvider>
      <ThemedNav />
    </AppPreferencesProvider>
  );
}

function ThemedNav() {
  const { scheme } = usePreferences();

  return (
    <ThemeProvider value={scheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="daily/[date]" options={{ headerShown: false }} />
        <Stack.Screen name="passage/[reference]" options={{ headerShown: false }} />
      </Stack>
    </ThemeProvider>
  );
}
