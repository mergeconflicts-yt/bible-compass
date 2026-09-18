import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ArtworkCard } from '@/components/ArtworkCard';
import { ComposerSheet } from '@/components/sheets/ComposerSheet';
import { ContextFlow } from '@/components/sheets/ContextFlow';
import type { ContinueReadingFixture, DailyVerseFixture } from '@/fixtures/home';
import { useOptionalPreferences } from '@/theme/ThemeProvider';

export interface HomeViewProps {
  greeting: string;
  daily: DailyVerseFixture;
  progress: ContinueReadingFixture;
  onReadInContext: () => void;
  onShare: () => void;
  onOpenPassage: (passageKey: string) => void;
}

/**
 * Home landing — demo/design-spec.html #v-home. Order: greeting, verse
 * artwork, action row (Read in context primary + share/composer + disabled
 * download), Continue reading card with progress ring, Explore context card.
 * Presentational: navigation/share injected; sheets are local UI state.
 */
export function HomeView({
  greeting,
  daily,
  progress,
  onReadInContext,
  onShare,
  onOpenPassage,
}: HomeViewProps) {
  const { colors } = useTheme();
  const [composerOpen, setComposerOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const preferences = useOptionalPreferences();

  return (
    <Screen testID="home-screen">
      <AppText variant="title3" accessibilityRole="header">
        {greeting}
      </AppText>
      <AppText variant="body" color="textSecondary" style={styles.tagline}>
        One story. Read slowly.
      </AppText>

      <View style={styles.card}>
        <ArtworkCard
          kicker="Verse of the day"
          verse={daily.text}
          reference={daily.referenceLabel}
          attribution={preferences?.translation.attribution ?? daily.translationNote}
          testID="daily-artwork"
        />
      </View>

      <View style={styles.actionRow}>
        <View style={styles.primaryAction}>
          <Button
            title="Read in context"
            onPress={onReadInContext}
            testID="read-in-context"
            accessibilityHint={`Opens ${daily.referenceLabel} in the passage reader`}
          />
        </View>
        <IconButton
          name="share-outline"
          accessibilityLabel="Share verse"
          onPress={() => setComposerOpen(true)}
          testID="share-verse"
        />
        <IconButton
          name="download-outline"
          accessibilityLabel="Download verse image"
          accessibilityHint="Downloads unlock once translation rights are confirmed"
          onPress={() => undefined}
          disabled
          testID="download-verse"
        />
      </View>

      <AppText variant="title3" accessibilityRole="header" style={styles.sectionTitle}>
        Continue reading
      </AppText>
      <Pressable
        onPress={() => onOpenPassage(progress.passageKey)}
        testID="continue-reading-card"
        accessibilityRole="button"
        accessibilityLabel={`Continue reading ${progress.bookLabel} chapter ${progress.chapter}, ${progress.lastVerseLabel}`}
        style={({ pressed }) => [
          styles.contCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.ring, { borderColor: colors.border, borderTopColor: colors.brand }]} />
        <View style={styles.contText}>
          <AppText variant="title3">
            {progress.bookLabel} {progress.chapter}
          </AppText>
          <AppText variant="metadata" color="textSecondary">
            {progress.lastVerseLabel} · {progress.contextLabel} · {progress.translationShort}
          </AppText>
        </View>
        <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
      </Pressable>

      <AppText variant="title3" accessibilityRole="header" style={styles.sectionTitle}>
        Explore context
      </AppText>
      <Pressable
        onPress={() => setContextOpen(true)}
        testID="explore-context-card"
        accessibilityRole="button"
        accessibilityLabel="Where are we in the story? Persian period, Jerusalem"
        style={({ pressed }) => [
          styles.contCard,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
            opacity: pressed ? 0.85 : 1,
          },
        ]}
      >
        <View style={[styles.storyDot, { backgroundColor: colors.accentSoft }]}>
          <View style={[styles.storyDotInner, { backgroundColor: colors.textPrimary }]} />
        </View>
        <View style={styles.contText}>
          <AppText variant="label">Where are we in the story?</AppText>
          <AppText variant="metadata" color="textSecondary">
            445 BC · Persian period · Jerusalem
          </AppText>
        </View>
      </Pressable>

      <AppText variant="caption" color="textSecondary" style={styles.protoNote}>
        {`Scripture in ${preferences?.translation.name ?? 'Berean Standard Bible'} — change it in Settings.`}
      </AppText>

      <ComposerSheet
        visible={composerOpen}
        onClose={() => setComposerOpen(false)}
        onShare={onShare}
      />
      <ContextFlow
        visible={contextOpen}
        onClose={() => setContextOpen(false)}
        onOpenPassage={(key) => {
          setContextOpen(false);
          onOpenPassage(key);
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  tagline: {
    marginTop: space[1],
  },
  card: {
    marginTop: space[3],
  },
  actionRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[3],
    alignItems: 'stretch',
  },
  primaryAction: {
    flex: 1.4,
  },
  sectionTitle: {
    marginTop: space[6],
    marginBottom: space[2],
  },
  contCard: {
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[4],
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    minHeight: space[12],
  },
  contText: {
    flex: 1,
  },
  ring: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 6,
  },
  storyDot: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storyDotInner: {
    width: 22,
    height: 22,
    borderRadius: 11,
  },
  protoNote: {
    textAlign: 'center',
    margin: space[4],
    lineHeight: 20,
  },
});
