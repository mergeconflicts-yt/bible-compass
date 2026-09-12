import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { Modal, PanResponder, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  eyebrow?: string;
  title?: string;
  full?: boolean;
  testID?: string;
  /** Fixed close control without a title row (long content, e.g. full cards). */
  closeOnly?: boolean;
  /** Left-side content for the closeOnly header (e.g. icon + name). Sticky. */
  headerContent?: ReactNode;
  /** Lets content drive the scroll position (e.g. land on an item). */
  scrollRef?: RefObject<ScrollView | null>;
  children: ReactNode;
}

/**
 * Accessible bottom sheet: scrim dismiss, grab handle, eyebrow + title
 * header with a 48dp close control, scrollable content. Adaptive side panels
 * land with the tablet pass; phones use this everywhere — see DESIGN_SPEC.
 */
export function Sheet({ visible, onClose, eyebrow, title, full, testID, closeOnly, headerContent, scrollRef, children }: SheetProps) {
  const { colors } = useTheme();
  // Pull-down dismiss: the sheet follows the finger and closes past a
  // distance/velocity threshold, then snaps back. Only takes over when the
  // content is scrolled to the top and the drag goes down, so scrolling,
  // taps and horizontal gestures are never stolen. Driven by Reanimated so
  // the drag never passes through static style validation.
  const dragY = useSharedValue(0);
  const scrollOffset = useRef(0);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (visible) dragY.value = 0;
  }, [visible, dragY]);
  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));
  const dismissPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 10 &&
        Math.abs(gesture.dy) > Math.abs(gesture.dx) &&
        scrollOffset.current <= 0,
      onPanResponderMove: (_, gesture) => {
        if (gesture.dy > 0) dragY.value = gesture.dy;
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.7) onCloseRef.current();
        else dragY.value = withSpring(0);
      },
      onPanResponderTerminate: () => {
        dragY.value = withSpring(0);
      },
    }),
  ).current;
  const closeControl = (
    <Pressable
      onPress={onClose}
      accessibilityRole="button"
      accessibilityLabel="Close"
      testID={testID ? `${testID}-close` : undefined}
      style={[styles.close, { borderColor: colors.border }]}
    >
      <AppText variant="title2">
        ×
      </AppText>
    </Pressable>
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <View style={[styles.scrim, { backgroundColor: colors.scrim }]} {...dismissPan.panHandlers}>
        <Pressable
          style={styles.scrimPress}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <Animated.View
          style={[
            styles.sheet,
            full && styles.full,
            { backgroundColor: colors.canvas, borderColor: colors.border },
            animatedSheetStyle,
          ]}
          accessibilityRole="dialog"
          accessibilityModal
          accessibilityLabel={title}
        >
          <View style={[styles.grab, { backgroundColor: colors.border }]} />
          {title ? (
            <View style={styles.head}>
              <View style={styles.headText}>
                {eyebrow ? (
                  <AppText variant="caption" color="accent" style={styles.eyebrow}>
                    {eyebrow.toUpperCase()}
                  </AppText>
                ) : null}
                <AppText variant="title2" accessibilityRole="header">
                  {title}
                </AppText>
              </View>
              {closeControl}
            </View>
          ) : closeOnly ? (
            <View style={styles.head}>
              <View style={styles.headText}>{headerContent}</View>
              {closeControl}
            </View>
          ) : null}
          <ScrollView
            ref={scrollRef}
            showsVerticalScrollIndicator={false}
            scrollEventThrottle={16}
            onScroll={(event) => {
              scrollOffset.current = event.nativeEvent.contentOffset.y;
            }}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scrimPress: {
    flex: 1,
  },
  sheet: {
    maxHeight: '72%',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    borderTopWidth: 1,
    paddingHorizontal: space[5],
    paddingTop: space[3],
    paddingBottom: space[8],
  },
  full: {
    maxHeight: '92%',
  },
  grab: {
    width: 44,
    height: 5,
    borderRadius: 3,
    alignSelf: 'center',
    marginBottom: space[3],
  },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[3],
    marginBottom: space[2],
  },
  headText: {
    flex: 1,
  },
  eyebrow: {
    letterSpacing: 1.5,
    marginBottom: space[1],
  },
  close: {
    minWidth: space[12],
    minHeight: space[12],
    alignItems: 'center',
    justifyContent: 'center',
  },
});
