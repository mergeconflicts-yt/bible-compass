import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { space } from '@/theme/tokens';
import { Screen } from '@/components/Screen';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { IconButton } from '@/components/IconButton';
import { ArtworkCard } from '@/components/ArtworkCard';
import { ComposerSheet } from '@/components/sheets/ComposerSheet';
import { ContextFlow } from '@/components/sheets/ContextFlow';
import {
  dailyVerseReferenceFor,
  dailyVerseTextFor,
  surroundingPassageLabelFor,
  surroundingPassageMetaFor,
} from '@/fixtures/demo';
import { useOptionalPreferences } from '@/theme/ThemeProvider';
import { getDraft } from '@/content/neh2Draft';

export interface DailyViewProps {
  dateLabel: string;
  onBack: () => void;
  onShare: () => void;
  onOpenPassage: (passageKey: string) => void;
}

/**
 * Full daily verse experience — demo #v-daily. Artwork, actions, The moment,
 * Who/Where/When shortcuts into context, and the surrounding-passage card
 * whose primary action is reading, not sharing.
 */
export function DailyView({ dateLabel, onBack, onShare, onOpenPassage }: DailyViewProps) {
  const [composerOpen, setComposerOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const preferences = useOptionalPreferences();
  const translationId = preferences?.translationId ?? 'BSB';

  return (
    <Screen testID="daily-screen">
      <View style={styles.header}>
        <IconButton name="chevron-back" accessibilityLabel="Back" onPress={onBack} testID="daily-back" />
        <View style={styles.headerTitle}>
          <AppText variant="title3" style={styles.centered}>
            Verse of the day
          </AppText>
          <AppText variant="metadata" color="textSecondary" style={styles.centered}>
            {dateLabel}
          </AppText>
        </View>
        <IconButton
          name="share-outline"
          accessibilityLabel="Share verse"
          onPress={() => setComposerOpen(true)}
          testID="daily-share"
        />
      </View>

      <View style={styles.card}>
        <ArtworkCard
          kicker="Verse of the day"
          verse={dailyVerseTextFor(translationId)}
          reference={dailyVerseReferenceFor(translationId)}
          attribution={preferences?.translation.attribution ?? 'Berean Standard Bible · BSB'}
          testID="daily-artwork"
        />
      </View>

      <View style={styles.actionRow}>
        <View style={styles.primaryAction}>
          <Button
            title="Read in context"
            onPress={() => onOpenPassage('Neh.2.1-Neh.2.8')}
            testID="daily-read-in-context"
          />
        </View>
        <IconButton
          name="share-outline"
          accessibilityLabel="Share verse"
          onPress={() => setComposerOpen(true)}
          testID="daily-share-action"
        />
        <IconButton
          name="download-outline"
          accessibilityLabel="Download verse image"
          accessibilityHint="Downloads unlock once translation rights are confirmed"
          onPress={() => undefined}
          disabled
          testID="daily-download"
        />
      </View>

      <View style={styles.momentTag}>
        <AppText variant="metadata" color="accent">
          The moment
        </AppText>
      </View>
      <AppText variant="title1" accessibilityRole="header">
        What is happening?
      </AppText>
      <AppText variant="body" scripture style={styles.momentText}>
        {getDraft().the_moment.text}
      </AppText>

      <View style={styles.chips}>
        {['Who', 'Where', 'When'].map((chip) => (
          <View key={chip} style={styles.chip}>
            <Button title={chip} variant="secondary" onPress={() => setContextOpen(true)} testID={`daily-chip-${chip.toLowerCase()}`} />
          </View>
        ))}
      </View>

      <View style={styles.passCard}>
        <AppText variant="title2">Read the surrounding passage</AppText>
        <AppText variant="body" color="textSecondary" style={styles.passMeta}>
          {surroundingPassageMetaFor(translationId)} · Prototype text
        </AppText>
        <Button
          title={`Read ${surroundingPassageLabelFor(translationId)}`}
          onPress={() => onOpenPassage('Neh.2.1-Neh.2.8')}
          testID="daily-read-passage"
        />
      </View>

      <AppText variant="caption" color="textSecondary" style={styles.protoNote}>
        Unreviewed AI draft. Production moment text requires reviewed sources.
      </AppText>

      <ComposerSheet visible={composerOpen} onClose={() => setComposerOpen(false)} onShare={onShare} />
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  headerTitle: {
    flex: 1,
  },
  centered: {
    textAlign: 'center',
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
  momentTag: {
    marginTop: space[6],
    marginBottom: space[1],
  },
  momentText: {
    marginTop: space[2],
  },
  chips: {
    flexDirection: 'row',
    gap: space[2],
    marginVertical: space[3],
  },
  chip: {
    flex: 1,
  },
  passCard: {
    marginTop: space[2],
    gap: space[2],
  },
  passMeta: {
    marginBottom: space[1],
  },
  protoNote: {
    textAlign: 'center',
    margin: space[4],
  },
});
