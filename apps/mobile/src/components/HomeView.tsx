import { StyleSheet, View } from 'react-native';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { DailyCard } from '@/components/DailyCard';
import { ContinueCard } from '@/components/ContinueCard';
import type { ContinueReadingFixture, DailyVerseFixture } from '@/fixtures/home';

export interface HomeViewProps {
  greeting: string;
  daily: DailyVerseFixture;
  progress: ContinueReadingFixture;
  onReadInContext: () => void;
  onShare: () => void;
  onOpenPassage: (passageKey: string) => void;
}

/**
 * Home landing — see DESIGN_SPEC.md §6.1. Order: compact header, daily
 * feature card, explicit actions (Read in context is the filled primary),
 * Continue Reading card. Presentational: all navigation/share injected so
 * this renders in tests with no router or native modules.
 */
export function HomeView({
  greeting,
  daily,
  progress,
  onReadInContext,
  onShare,
  onOpenPassage,
}: HomeViewProps) {
  return (
    <Screen testID="home-screen">
      <AppText variant="title1" accessibilityRole="header">
        {greeting}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.tagline}>
        One story. Read slowly.
      </AppText>

      <View style={styles.card}>
        <DailyCard daily={daily} />
      </View>

      <View style={styles.actions}>
        <View style={styles.primaryAction}>
          <Button
            title="Read in context"
            onPress={onReadInContext}
            testID="read-in-context"
            accessibilityHint={`Opens ${daily.referenceLabel} in the passage reader`}
          />
        </View>
        <View style={styles.secondaryActions}>
          <Button title="Share" variant="secondary" onPress={onShare} testID="share-verse" />
          <Button
            title="Download"
            variant="secondary"
            disabled
            testID="download-verse"
            accessibilityHint="Downloads unlock once translation rights are confirmed"
          />
        </View>
        <AppText variant="caption" color="textSecondary" style={styles.rightsNote}>
          Downloads unlock once translation rights are confirmed. Prototype text: World English
          Bible (Public Domain) — not licensed production content.
        </AppText>
      </View>

      <AppText variant="title3" accessibilityRole="header" style={styles.sectionTitle}>
        Continue reading
      </AppText>
      <ContinueCard progress={progress} onOpen={() => onOpenPassage(progress.passageKey)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: {
    marginTop: space[1],
  },
  card: {
    marginTop: space[4],
  },
  actions: {
    marginTop: space[3],
  },
  primaryAction: {
    marginBottom: space[2],
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: space[2],
  },
  rightsNote: {
    marginTop: space[2],
  },
  sectionTitle: {
    marginTop: space[6],
    marginBottom: space[2],
  },
});
