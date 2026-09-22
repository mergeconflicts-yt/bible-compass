import { useRef } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { Sheet } from '@/components/Sheet';
import { AppText } from '@/components/AppText';
import { ReferenceText } from '@/components/ReferenceText';
import { Button } from '@/components/Button';
import { previewEvents, previewNotice, shortRange, type PreviewEvent } from '@/content/neh2Preview';

interface TimelineSheetProps {
  visible: boolean;
  onClose: () => void;
  onOpenPassage?: (passageKey: string) => void;
  /** Modal entrance animation; 'none' when this sheet swaps in the context flow. */
  animationType?: 'none' | 'slide' | 'fade';
}

/**
 * Vertical passage timeline rendered from the generated Nehemiah 2 preview
 * asset: one row per event laid out as line · dot · verse details, with the
 * connecting line running through the dots (trimmed at the two ends). The
 * curated packages carry no dates, so each dot is labelled with its same-book
 * reference range. Everything here is unverified draft content (see
 * previewNotice).
 */
export function TimelineSheet({
  visible,
  onClose,
  onOpenPassage,
  animationType,
}: TimelineSheetProps) {
  const { colors } = useTheme();
  // The sheet is mounted even when hidden; never let invalid preview data
  // throw during render. Show an honest unavailable state instead.
  let events: PreviewEvent[] = [];
  let unavailable = false;
  try {
    events = previewEvents();
  } catch {
    unavailable = true;
  }
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
      animationType={animationType}
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
      {unavailable ? (
        <AppText variant="body" color="textSecondary" testID="timeline-unavailable">
          The Nehemiah 2 preview failed validation, so passage events are unavailable.
        </AppText>
      ) : null}
      <View style={styles.timeline} testID="timeline-body">
        {events.map((event, index) => {
          const participants = event.participants.map((person) => person.name).join(', ');
          const places = event.places.map((place) => place.name).join(', ');
          const last = index === events.length - 1;
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
              {/* Dot anchored to the event title; the line runs down from it
                  to the next dot, so dots mark each heading. */}
              <View style={styles.railCol}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: colors.accent, borderColor: colors.canvas },
                  ]}
                />
                <AppText variant="caption" color="textSecondary" style={styles.railRange}>
                  {shortRange(event.range)}
                </AppText>
                <View
                  style={[
                    styles.line,
                    last ? styles.lineNone : styles.lineFlex,
                    { backgroundColor: last ? 'transparent' : colors.border },
                  ]}
                />
              </View>
              <View style={styles.details}>
                <AppText variant="title3" style={styles.title}>
                  {event.title}
                </AppText>
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
        <Button title="Back" onPress={onClose} testID="timeline-back" />
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
  timeline: {
    marginVertical: space[3],
  },
  item: {
    flexDirection: 'row',
    gap: space[3],
  },
  railCol: {
    width: 48,
    alignItems: 'center',
  },
  line: {
    width: 2,
  },
  lineFlex: {
    flex: 1,
  },
  lineNone: {
    flex: 0,
    height: 0,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    // Anchor the dot to the first line of the event title.
    marginTop: 4,
    marginBottom: 2,
  },
  railRange: {
    fontSize: 10,
    lineHeight: 12,
    marginVertical: 2,
    textAlign: 'center',
  },
  details: {
    flex: 1,
    paddingBottom: space[5],
  },
  title: {
    marginTop: 0,
  },
  note: {
    marginTop: space[1],
    lineHeight: 20,
  },
  action: {
    marginTop: space[4],
  },
});
