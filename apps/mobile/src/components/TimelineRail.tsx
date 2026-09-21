import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';
import { formatYear, getTimeline } from '@/content/neh2Draft';

const ITEM_WIDTH = 88;
/* Dot-center geometry: item top padding (4) + year line (14) + gap (2) + dot radius (5). */
const DOT_CENTER_Y = 4 + 14 + 2 + 5;

export interface RailStop {
  key: string;
  /** Short top-line label (a year for legacy stops, a range for curated ones). */
  top: string;
  title: string;
}

interface TimelineRailProps {
  /** Canonical key of the passage event; null highlights nothing. */
  activeKey: string | null;
  onOpenTimeline: () => void;
  /**
   * Curated stops to render instead of the legacy prototype timeline.
   * When omitted, the legacy draft timeline renders (other chapters).
   */
  stops?: RailStop[];
}

/**
 * Compact horizontal biblical timeline: year above, dot on a single
 * connecting line, short event name below. Full-width swipeable strip;
 * centers the passage event on mount. Every stop opens the full vertical
 * timeline, which renders the same dataset with complete details.
 */
export function TimelineRail({ activeKey, onOpenTimeline, stops }: TimelineRailProps) {
  const { colors } = useTheme();
  // Load the legacy prototype timeline only when curated stops are absent
  // (non-Nehemiah chapters). The curated flow never reads neh2Draft here.
  const items: RailStop[] =
    stops ??
    getTimeline().map((event) => ({
      key: event.canonical_key,
      top: formatYear(event.start),
      title: event.title,
    }));
  const scrollRef = useRef<ScrollView>(null);
  const offsetRef = useRef(0);
  const [width, setWidth] = useState(0);
  const activeIndex = items.findIndex((item) => item.key === activeKey);

  useEffect(() => {
    if (width > 0 && activeIndex > 0) {
      const x = Math.max(0, activeIndex * ITEM_WIDTH - width / 2 + ITEM_WIDTH / 2);
      offsetRef.current = x;
      scrollRef.current?.scrollTo({ x, animated: false });
    }
  }, [width, activeIndex]);

  return (
    <View
      testID="timeline-rail"
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      accessibilityRole="image"
      accessibilityLabel={`Biblical timeline, ${items.length} events. Currently showing ${
        activeIndex >= 0
          ? (items[activeIndex]?.title ?? 'no highlighted passage')
          : 'no highlighted passage'
      }.`}
    >
      <ScrollView
        ref={scrollRef}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(event) => {
          offsetRef.current = event.nativeEvent.contentOffset.x;
        }}
        contentContainerStyle={styles.track}
        style={styles.scroller}
      >
        <View>
          <View
            style={[
              styles.backdrop,
              {
                top: DOT_CENTER_Y - 1,
                left: ITEM_WIDTH / 2,
                right: ITEM_WIDTH / 2,
                backgroundColor: colors.border,
              },
            ]}
            pointerEvents="none"
          />
          <View style={styles.stops}>
            {items.map((item) => {
              const active = item.key === activeKey;
              return (
                <Pressable
                  key={item.key}
                  onPress={onOpenTimeline}
                  testID={`rail-${item.key}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${item.title}, ${item.top}. Open timeline.`}
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.item,
                    active && { backgroundColor: colors.accentSoft, borderRadius: 10 },
                  ]}
                >
                  <AppText
                    variant="caption"
                    color="textSecondary"
                    style={styles.year}
                    numberOfLines={1}
                  >
                    {item.top}
                  </AppText>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: active ? colors.accent : colors.border,
                        borderColor: colors.canvas,
                      },
                    ]}
                  />
                  <AppText
                    variant="caption"
                    color={active ? 'accent' : 'textSecondary'}
                    style={styles.label}
                    numberOfLines={2}
                  >
                    {item.title}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  stops: {
    position: 'relative',
    flexDirection: 'row',
  },
  backdrop: {
    position: 'absolute',
    height: 2,
    borderRadius: 1,
  },
  item: {
    width: ITEM_WIDTH,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingVertical: space[1],
  },
  year: {
    fontSize: 11,
    lineHeight: 14,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 2,
    marginVertical: 2,
  },
  label: {
    textAlign: 'center',
    fontSize: 11,
    lineHeight: 14,
    minHeight: 28,
  },
  scroller: {
    flex: 1,
  },
  track: {
    alignItems: 'stretch',
    paddingVertical: space[1],
  },
});
