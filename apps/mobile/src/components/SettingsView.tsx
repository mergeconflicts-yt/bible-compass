import { StyleSheet, View } from 'react-native';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { scriptureSizeLabels, usePreferences } from '@/theme/ThemeProvider';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { TRANSLATION_ORDER, translationById, type ScriptureLanguage } from '@/content/bsb';

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

export function SettingsView() {
  const preferences = usePreferences();

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
