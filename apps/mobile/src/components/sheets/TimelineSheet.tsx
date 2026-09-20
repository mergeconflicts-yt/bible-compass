import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { ReferenceText } from '@/components/ReferenceText';
import { Button } from '@/components/Button';
import { previewEvents, previewNotice } from '@/content/neh2Preview';

interface TimelineSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenPassage?: (passageKey: string) => void;
}

/**
 * Passage events rendered from the generated Nehemiah 2 preview asset.
 * The curated packages carry no dates, so rows show the passage range plus
 * participants and places instead of years. Precision labels are honest:
 * everything here is unverified draft content (see previewNotice).
 */
export function TimelineSheet({ visible, onClose, onOpenPassage }: TimelineSheetProps) {
  const { colors } = useTheme();
  const events = previewEvents();
  const scrollRef = useRef<ScrollView>(null);
  const legendHeight = useRef(0);
  const activeY = useRef<number | null>(null);
  const didScroll = useRef(false);

  // Layout positions arrive piecemeal; jump once both are known.
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
      eyebrow="Timeline · Draft preview"
      title="Events in Nehemiah 2"
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
          Curated passage events
        </AppText>
      </View>
      <View style={[styles.rail, { borderColor: colors.border }]}>
        {events.map((event, index) => {
          const participants = event.participants.map((person) => person.name).join(', ');
          const places = event.places.map((place) => place.name).join(', ');
          return (
            <View
              key={event.key}
              testID={`timeline-${event.key}`}
              onLayout={
                index === 0
                  ? (layoutEvent) => {
                      activeY.current = layoutEvent.nativeEvent.layout.y;
                      maybeScroll();
                    }
                  : undefined
              }
              style={styles.item}
            >
              <AppText variant="label" style={styles.year}>
                {event.range}
              </AppText>
              <View
                style={[
                  styles.node,
                  {
                    backgroundColor: colors.border,
                    borderColor: colors.canvas,
                  },
                ]}
              />
              <View style={styles.itemText}>
                <AppText variant="label">{event.title}</AppText>
                {participants ? (
                  <AppText variant="metadata" color="textSecondary" style={styles.note}>
                    {`With ${participants}`}
                  </AppText>
                ) : null}
                {places ? (
                  <ReferenceText
                    text={`At ${places}`}
                    onOpenPassage={onOpenPassage}
                    variant="metadata"
                    color="textSecondary"
                    style={styles.note}
                  />
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      <AppText variant="metadata" color="textSecondary">
        {previewNotice()}
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
