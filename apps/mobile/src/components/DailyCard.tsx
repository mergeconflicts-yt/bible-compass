import { StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { DailyVerseFixture } from '@/fixtures/home';
import { AppText } from './AppText';
import { TranslationBadge } from './TranslationBadge';

interface DailyCardProps {
  daily: DailyVerseFixture;
}

/**
 * Verse-of-the-Day feature card: the most visually prominent object on Home.
 * Artwork keeps verse, reference and translation inside it — see
 * DESIGN_SPEC.md §6.1. Tapping the artwork is wired by the parent.
 */
export function DailyCard({ daily }: DailyCardProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.artwork, { backgroundColor: colors.brand, borderColor: colors.brandPressed }]}
      accessibilityRole="image"
      accessibilityLabel={`Verse of the day artwork: ${daily.referenceLabel}`}
    >
      <AppText variant="label" style={{ color: colors.textOnBrand, letterSpacing: 1.5 }}>
        {daily.dateLabel.toUpperCase()}
      </AppText>
      <AppText variant="title2" scripture style={[styles.verse, { color: colors.textOnBrand }]}>
        {daily.text}
      </AppText>
      <AppText variant="title3" style={{ color: colors.textOnBrand }}>
        {daily.referenceLabel}
      </AppText>
      <View style={styles.badgeRow}>
        <TranslationBadge shortName={daily.translationShort} fullNote={daily.translationNote} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  artwork: {
    borderRadius: radius.prominent,
    borderWidth: 1,
    padding: space[6],
    aspectRatio: 4 / 5,
    maxHeight: 460,
    justifyContent: 'flex-end',
  },
  verse: {
    marginVertical: space[3],
  },
  badgeRow: {
    marginTop: space[3],
  },
});
