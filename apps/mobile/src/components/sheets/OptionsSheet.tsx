import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { scriptureSizeLabels, usePreferences } from '@/theme/ThemeProvider';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';

interface OptionsSheetProps {
  visible: boolean;
  onClose: () => void;
}

/** Reading options — demo #s-options. Bookmark is local state; theme and text size are functional. */
export function OptionsSheet({ visible, onClose }: OptionsSheetProps) {
  const { colors } = useTheme();
  const preferences = usePreferences();
  const [bookmarked, setBookmarked] = useState(false);

  const rows = [
    {
      icon: 'bookmark-outline' as const,
      title: bookmarked ? 'Bookmarked' : 'Bookmark chapter',
      meta: bookmarked ? 'Saved on this device' : 'Save for later',
      onPress: () => setBookmarked((saved) => !saved),
      testID: 'options-bookmark',
    },
    {
      icon: 'moon-outline' as const,
      title: 'Theme',
      meta: `Currently ${preferences.scheme} · tap to switch light or dark`,
      onPress: preferences.toggleAppearance,
      testID: 'options-theme',
    },
    {
      icon: 'text-outline' as const,
      title: 'Text size and spacing',
      meta: `Reader appearance (${scriptureSizeLabels[preferences.scriptureSizeIndex] ?? 'default'})`,
      onPress: preferences.cycleScriptureSize,
      testID: 'options-text-size',
    },
  ];

  return (
    <Sheet visible={visible} onClose={onClose} eyebrow="Reader" title="Reading options" testID="options-sheet">
      {rows.map((row) => (
        <Pressable
          key={row.testID}
          onPress={row.onPress}
          testID={row.testID}
          accessibilityRole="button"
          accessibilityLabel={`${row.title}, ${row.meta}`}
          style={({ pressed }) => [styles.row, { opacity: pressed ? 0.7 : 1 }]}
        >
          <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
            <Ionicons name={row.icon} size={24} color={colors.accent} />
          </View>
          <View style={styles.text}>
            <AppText variant="label">{row.title}</AppText>
            <AppText variant="metadata" color="textSecondary">
              {row.meta}
            </AppText>
          </View>
        </Pressable>
      ))}
      <View style={[styles.offline, { borderColor: colors.border }]}>
        <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
          <Ionicons name="download-outline" size={24} color={colors.accent} />
        </View>
        <View style={styles.text}>
          <AppText variant="label">Available offline</AppText>
          <AppText variant="metadata" color="textSecondary">
            Downloaded successfully · prototype
          </AppText>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'center',
    borderBottomWidth: 0,
    paddingVertical: space[3],
    minHeight: space[12],
  },
  offline: {
    flexDirection: 'row',
    gap: space[3],
    alignItems: 'center',
    paddingVertical: space[3],
    minHeight: space[12],
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
