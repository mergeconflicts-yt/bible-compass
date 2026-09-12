import { StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { Button } from '@/components/Button';
import { companion, translationAttribution } from '@/fixtures/demo';

interface CompanionSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenEntity: () => void;
  onOpenContext: () => void;
}

/** Verse companion — demo #s-companion. Passage-specific moment, kept separate from the reusable profile. */
export function CompanionSheet({ visible, onClose, onOpenEntity, onOpenContext }: CompanionSheetProps) {
  const { colors } = useTheme();
  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="Verse companion"
      title={companion.verseLabel}
      full
      testID="companion-sheet"
    >
      <View style={[styles.scriptBox, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
        <AppText variant="caption" color="accent">
          SCRIPTURE
        </AppText>
        <AppText variant="title2" scripture style={styles.phrase}>
          {companion.phrase}
        </AppText>
        <AppText variant="caption" color="textSecondary">
          {translationAttribution}
        </AppText>
      </View>

      <View style={[styles.moment, { backgroundColor: colors.accentSoft }]}>
        <AppText variant="caption" color="accent">
          {companion.eyebrow.toUpperCase()}
        </AppText>
        <AppText variant="title2" style={styles.momentHeading}>
          {companion.heading}
        </AppText>
        <AppText variant="body" scripture>
          {companion.text}
        </AppText>
      </View>

      <Button
        title="Who was Artaxerxes? ›"
        variant="secondary"
        onPress={onOpenEntity}
        testID="companion-open-entity"
      />
      <View style={styles.contextAction}>
        <Button
          title="ⓘ Understand the whole passage"
          variant="secondary"
          onPress={onOpenContext}
          testID="companion-open-context"
        />
      </View>

      <View style={[styles.srcBox, { backgroundColor: colors.surfaceSubtle }]}>
        <AppText variant="caption">WHY THIS APPEARS HERE</AppText>
        <AppText variant="metadata" color="textSecondary" style={styles.srcText}>
          This explanation belongs to this exact reading moment. The reusable profile remains
          separate.
        </AppText>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  scriptBox: {
    borderLeftWidth: 4,
    borderRadius: 14,
    padding: space[4],
    marginVertical: space[3],
  },
  phrase: {
    marginVertical: space[2],
  },
  moment: {
    borderRadius: 18,
    padding: space[5],
    marginVertical: space[3],
  },
  momentHeading: {
    marginVertical: space[2],
  },
  contextAction: {
    marginTop: space[2],
  },
  srcBox: {
    borderRadius: radius.button,
    padding: space[4],
    marginTop: space[4],
  },
  srcText: {
    marginTop: space[1],
    lineHeight: 20,
  },
});
