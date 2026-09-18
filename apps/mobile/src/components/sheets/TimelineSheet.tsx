import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { ReferenceText } from '@/components/ReferenceText';
import { Button } from '@/components/Button';
import { draftNotice, formatYear, getTimeline } from '@/content/neh2Draft';

interface TimelineSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenPassage?: (passageKey: string) => void;
}

/**
 * Passage-centered timeline rendered from the unreviewed AI draft.
 * Opens scrolled to the highlighted passage event; precision and
 * disagreement labels come from the draft records and are never presented
 * as settled fact.
 */
export function TimelineSheet({ visible, onClose, onOpenPassage }: TimelineSheetProps) {
  const { colors } = useTheme();
  const events = getTimeline();
  const scrollRef = useRef<ScrollView>(null);
  const legendHeight = useRef(0);
  const activeY = useRef<number | null>(null);
  const didScroll = useRef(false);

  // Layout positions arrive piecemeal; jump once both are known. Approximate
  // by design — the goal is landing on the passage event, not pixel perfection.
  const maybeScroll = () => {
    if (!visible || didScroll.current || activeY.current === null) return;
    didScroll.current = true;
    scrollRef.current?.scrollTo({
      y: Math.max(0, legendHeight.current + activeY.current - 140),
      animated: false,
    });
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      eyebrow="Timeline · Draft"
      title="Biblical timeline"
      full
      testID="timeline-sheet"
      scrollRef={scrollRef}
    >
      <View
        style={styles.legend}
        onLayout={(event) => {
          legendHeight.current = event.nativeEvent.layout.height;
          maybeScroll();
        }}
      >
        <AppText variant="metadata">
          <AppText variant="metadata" color="accent">
            ●
          </AppText>{' '}
          Biblical events
        </AppText>
        <AppText variant="metadata">
          <AppText variant="metadata" color="textSecondary">
            ●
          </AppText>{' '}
          World history
        </AppText>
      </View>
      <View style={[styles.rail, { borderColor: colors.border }]}>
        {events.map((event) => {
          // Draft convention: the foreground event whose relevance names the
          // reader's position renders highlighted.
          const active = event.relevance.toLowerCase().includes('you are here');
          const year = formatYear(event.start);
          const precision =
            event.date_precision === 'approximate'
              ? 'APPROXIMATE'
              : event.date_precision.toUpperCase();
          return (
            <View
              key={event.canonical_key}
              testID={`timeline-${event.canonical_key}`}
              onLayout={
                active
                  ? (layoutEvent) => {
                      activeY.current = layoutEvent.nativeEvent.layout.y;
                      maybeScroll();
                    }
                  : undefined
              }
              style={[
                styles.item,
                active && { backgroundColor: colors.accentSoft, borderRadius: radius.button },
              ]}
            >
              <AppText variant="label" style={styles.year}>
                {year}
              </AppText>
              <View
                style={[
                  styles.node,
                  {
                    backgroundColor: active ? colors.accent : colors.border,
                    borderColor: colors.canvas,
                  },
                ]}
              />
              <View style={styles.itemText}>
                <AppText variant="label">
                  {event.title}
                  <AppText variant="caption" color="accent">
                    {' '}
                    {precision}
                  </AppText>
                </AppText>
                <ReferenceText
                  text={`${event.description} ${event.relevance}`}
                  onOpenPassage={onOpenPassage}
                  variant="metadata"
                  color="textSecondary"
                  style={styles.note}
                />
              </View>
            </View>
          );
        })}
      </View>
      <AppText variant="metadata" color="textSecondary">
        {draftNotice}
      </AppText>
      <View style={styles.action}>
        <Button title="Back to reading" onPress={onClose} testID="timeline-back" />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: space[4],
    marginVertical: space[2],
  },
  rail: {
    borderLeftWidth: 2,
    marginLeft: space[8],
    paddingLeft: space[4],
    marginVertical: space[2],
  },
  item: {
    flexDirection: 'row',
    paddingVertical: space[3],
    gap: space[2],
  },
  year: {
    width: 52,
    marginLeft: -space[10],
  },
  node: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    marginTop: 4,
  },
  itemText: {
    flex: 1,
  },
  note: {
    marginTop: space[1],
    lineHeight: 20,
  },
  action: {
    marginTop: space[4],
  },
});
