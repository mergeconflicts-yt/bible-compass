import { StyleSheet, View } from 'react-native';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface TranslationBadgeProps {
  shortName: string;
  fullNote: string;
}

/**
 * Shows the short translation name wherever Scripture could otherwise be
 * ambiguous. Non-interactive in this slice: the translation information
 * screen lands with the reader slice. Never implies app ownership.
 */
export function TranslationBadge({ shortName, fullNote }: TranslationBadgeProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.badge, { borderColor: colors.border, backgroundColor: colors.surfaceSubtle }]}
      accessibilityRole="text"
      accessibilityLabel={`Translation: ${fullNote}`}
    >
      <AppText variant="label" color="textSecondary">
        {shortName}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    minHeight: 32,
    justifyContent: 'center',
  },
});
