import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import type { ContinueReadingFixture } from '@/fixtures/home';
import { AppText } from './AppText';
import { TranslationBadge } from './TranslationBadge';

interface ContinueCardProps {
  progress: ContinueReadingFixture;
  onOpen: () => void;
}

/**
 * Continue Reading card: book/chapter, last visible verse, translation badge
 * and one restrained context label. The whole card is one destination —
 * bookmark/options stay separate controls (future slice).
 */
export function ContinueCard({ progress, onOpen }: ContinueCardProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onOpen}
      testID="continue-reading-card"
      accessibilityRole="button"
      accessibilityLabel={`Continue reading ${progress.bookLabel} chapter ${progress.chapter}, ${progress.lastVerseLabel}`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        <View style={styles.text}>
          <AppText variant="title2">
            {progress.bookLabel} {progress.chapter}
          </AppText>
          <AppText variant="metadata" color="textSecondary" style={styles.meta}>
            {progress.lastVerseLabel} · {progress.contextLabel}
          </AppText>
          <View style={styles.badgeRow}>
            <TranslationBadge
              shortName={progress.translationShort}
              fullNote={`${progress.translationShort} · Prototype text`}
            />
          </View>
        </View>
        <Ionicons name="chevron-forward" size={24} color={colors.textSecondary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[5],
    minHeight: space[12],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  text: {
    flex: 1,
  },
  meta: {
    marginTop: space[1],
  },
  badgeRow: {
    marginTop: space[2],
  },
});
