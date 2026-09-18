import { useEffect, useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { scriptureSizeLabels, usePreferences } from '@/theme/ThemeProvider';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { TRANSLATION_ORDER, translationById, type ScriptureLanguage } from '@/content/bsb';
import {
  getAuthSnapshot,
  isAuthReady,
  signInWith,
  signOut,
  subscribeAuth,
  type AuthProviderId,
  type AuthState,
} from '@/content/authStore';
import { syncNow } from '@/content/syncEngine';
import {
  disableReminder,
  enableReminder,
  getReminderSnapshot,
  isReminderReady,
  subscribeReminder,
  type ReminderState,
} from '@/content/reminderStore';

interface SettingsRow {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  onPress?: () => void;
  testID: string;
}

/**
 * Settings — demo #s-settings content as a full tab screen (a sheet over a
 * tab has no faithful native equivalent; content and order match the demo).
 * Appearance, reading-text and translation rows are functional; the
 * translation list offers every bundled translation (BSB, IRV Tamil, IRV Telugu).
 */
const LANGUAGE_NAMES: Record<ScriptureLanguage, string> = {
  en: 'English',
  ta: 'Tamil',
  te: 'Telugu',
};

const PROVIDER_META: Record<
  AuthProviderId,
  { icon: keyof typeof Ionicons.glyphMap; title: string }
> = {
  apple: { icon: 'logo-apple', title: 'Sign in with Apple' },
  google: { icon: 'logo-google', title: 'Sign in with Google' },
};

export function SettingsView() {
  const preferences = usePreferences();
  const [auth, setAuth] = useState<AuthState>(getAuthSnapshot);
  useEffect(() => subscribeAuth(() => setAuth(getAuthSnapshot())), []);
  const [reminder, setReminder] = useState<ReminderState>(getReminderSnapshot);
  useEffect(() => subscribeReminder(() => setReminder(getReminderSnapshot())), []);
  const remindersReady = isReminderReady();
  // A provider is installed only when a sync project is configured
  // (composition root gates on it), so this doubles as "sync available".
  const configured = isAuthReady();

  const handleSignIn = (provider: AuthProviderId) => {
    // The store owns all state; this only absorbs the tap-before-init race
    // (unconfigured throw with no state change to render). A successful
    // first sign-in uploads local bookmarks via the union merge; failures
    // stay silent here (the next launch retries after restore).
    signInWith(provider)
      .then(() => {
        if (getAuthSnapshot().status === 'signed-in') syncNow().catch(() => {});
      })
      .catch(() => {});
  };

  const handleSignOut = () => {
    // D5: sign-out wipes the on-device library — confirm, destructively.
    Alert.alert(
      'Sign out?',
      'This deletes bookmarks, recents and reading progress on this device.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
      ],
    );
  };

  // Reminder opt-in is the explicit user action that authorizes the single
  // OS permission prompt (SECURITY.md:118). Failures surface as row state
  // with retry; unconfigured taps throw silently with no state change.
  const handleReminderToggle = () => {
    if (!remindersReady || reminder.status === 'enabling') return;
    if (reminder.status === 'enabled') {
      disableReminder().catch(() => {});
    } else {
      enableReminder().catch(() => {});
    }
  };

  const translationOptions = TRANSLATION_ORDER.map((id) => translationById(id)).filter(
    (record): record is NonNullable<typeof record> => record !== null,
  );

  const rows: SettingsRow[] = [
    { icon: 'globe-outline', title: 'App language', meta: 'English', testID: 'settings-language' },
    {
      icon: 'moon-outline',
      title: 'Appearance',
      meta: `Currently ${preferences.scheme} · tap to switch`,
      onPress: preferences.toggleAppearance,
      testID: 'settings-appearance',
    },
    {
      icon: 'text-outline',
      title: 'Reading text',
      meta: `Size: ${scriptureSizeLabels[preferences.scriptureSizeIndex] ?? 'default'}`,
      onPress: preferences.cycleScriptureSize,
      testID: 'settings-text-size',
    },
    {
      icon: 'download-outline',
      title: 'Downloads',
      meta: `${preferences.translation.short} · bundled with the app · prototype`,
      testID: 'settings-downloads',
    },
    {
      icon: 'information-circle-outline',
      title: 'Translations and licences',
      meta: 'Sources, permissions and attribution · rights review pending',
      testID: 'settings-licences',
    },
  ];

  return (
    <Screen testID="settings-screen">
      <AppText variant="caption" color="accent" style={styles.eyebrow}>
        PREFERENCES
      </AppText>
      <AppText variant="title2" accessibilityRole="header">
        Settings
      </AppText>
      {rows.map((row) =>
        row.onPress ? (
          <Pressable
            key={row.testID}
            onPress={row.onPress}
            testID={row.testID}
            accessibilityRole="button"
            accessibilityLabel={`${row.title}, ${row.meta}`}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <RowContent icon={row.icon} title={row.title} meta={row.meta} chevron />
          </Pressable>
        ) : (
          <View key={row.testID} testID={row.testID} style={styles.row}>
            <RowContent icon={row.icon} title={row.title} meta={row.meta} />
          </View>
        ),
      )}
      <AppText variant="caption" color="accent" style={[styles.eyebrow, styles.sectionGap]}>
        ACCOUNT
      </AppText>
      {auth.status === 'signed-in' ? (
        <>
          <View key="account-status" testID="settings-account-status" style={styles.row}>
            <RowContent
              icon="person-circle-outline"
              title="Signed in"
              meta={`via ${auth.provider === 'apple' ? 'Apple' : 'Google'} · bookmarks can sync`}
            />
          </View>
          <Pressable
            key="account-sign-out"
            onPress={handleSignOut}
            testID="settings-sign-out"
            accessibilityRole="button"
            accessibilityLabel="Sign out, Deletes the library on this device"
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <RowContent
              icon="log-out-outline"
              title="Sign out"
              meta="Deletes the library on this device"
              chevron
            />
          </Pressable>
        </>
      ) : !configured ? (
        <View key="account-unavailable" testID="settings-account-status" style={styles.row}>
          <RowContent
            icon="person-circle-outline"
            title="Sync unavailable"
            meta="No project configured in this build"
          />
        </View>
      ) : (
        (Object.keys(PROVIDER_META) as AuthProviderId[]).map((provider) => (
          <Pressable
            key={`account-sign-in-${provider}`}
            onPress={() => handleSignIn(provider)}
            testID={`settings-sign-in-${provider}`}
            accessibilityRole="button"
            accessibilityLabel={
              auth.status === 'signing-in'
                ? 'Signing in'
                : auth.status === 'error' && auth.message
                  ? `${PROVIDER_META[provider].title}, ${auth.message}, tap to retry`
                  : `${PROVIDER_META[provider].title}, Sync bookmarks across devices`
            }
            disabled={auth.status === 'signing-in'}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <RowContent
              icon={PROVIDER_META[provider].icon}
              title={PROVIDER_META[provider].title}
              meta={
                auth.status === 'signing-in'
                  ? 'Signing in…'
                  : auth.status === 'error' && auth.message
                    ? `${auth.message} · tap to retry`
                    : 'Sync bookmarks across devices'
              }
              chevron
            />
          </Pressable>
        ))
      )}
      <AppText variant="caption" color="accent" style={[styles.eyebrow, styles.sectionGap]}>
        REMINDERS
      </AppText>
      {!remindersReady ? (
        <View key="reminder-unready" testID="settings-reminder" style={styles.row}>
          <RowContent icon="notifications-outline" title="Daily reminder" meta="Not ready yet" />
        </View>
      ) : (
        <Pressable
          key="reminder-toggle"
          onPress={handleReminderToggle}
          testID="settings-reminder"
          accessibilityRole="switch"
          accessibilityState={{ disabled: reminder.status === 'enabling' }}
          accessibilityLabel={
            reminder.status === 'enabled'
              ? 'Daily reminder, On, Daily at 08:00, tap to turn off'
              : reminder.status === 'error' && reminder.message
                ? `Daily reminder, ${reminder.message}, tap to retry`
                : 'Daily reminder, Off, Daily at 08:00, tap to turn on'
          }
          disabled={reminder.status === 'enabling'}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <RowContent
            icon="notifications-outline"
            title="Daily reminder"
            meta={
              reminder.status === 'enabling'
                ? 'Setting reminder…'
                : reminder.status === 'enabled'
                  ? 'On · Daily at 08:00'
                  : reminder.status === 'error' && reminder.message
                    ? `${reminder.message} · tap to retry`
                    : 'Off · Daily at 08:00'
            }
            chevron={reminder.status !== 'enabling'}
          />
        </Pressable>
      )}
      <AppText variant="caption" color="accent" style={[styles.eyebrow, styles.sectionGap]}>
        BIBLE TRANSLATIONS
      </AppText>
      {translationOptions.map((record) => {
        const selected = preferences.translationId === record.id;
        return (
          <Pressable
            key={record.id}
            onPress={() => preferences.setTranslationId(record.id)}
            testID={`settings-translation-${record.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={`${record.name}, ${record.short}`}
            style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
          >
            <RowContent
              icon="book-outline"
              title={record.name}
              meta={`${LANGUAGE_NAMES[record.language]} · ${record.short}`}
              selected={selected}
            />
          </Pressable>
        );
      })}
    </Screen>
  );
}

function RowContent({
  icon,
  title,
  meta,
  chevron,
  selected,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  meta: string;
  chevron?: boolean;
  selected?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.inner, { borderColor: colors.border }]}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons name={icon} size={24} color={colors.accent} />
      </View>
      <View style={styles.text}>
        <AppText variant="label">{title}</AppText>
        <AppText variant="metadata" color="textSecondary">
          {meta}
        </AppText>
      </View>
      {selected ? (
        <Ionicons name="checkmark" size={20} color={colors.accent} />
      ) : chevron ? (
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  eyebrow: {
    letterSpacing: 1.5,
    marginBottom: space[1],
  },
  sectionGap: {
    marginTop: space[4],
  },
  row: {
    minHeight: space[12],
    justifyContent: 'center',
  },
  inner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    borderBottomWidth: 1,
    paddingVertical: space[3],
  },
  icon: {
    width: 52,
    height: 52,
    borderRadius: radius.button,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
  },
});
