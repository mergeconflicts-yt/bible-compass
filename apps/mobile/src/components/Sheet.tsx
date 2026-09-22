import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import {
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type AccessibilityRole,
} from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { space } from '@/theme/tokens';
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
  /** Modal entrance animation. Use 'none' when sheets swap in place. */
  animationType?: 'none' | 'slide' | 'fade';
  children: ReactNode;
}

/**
 * Accessible bottom sheet: scrim dismiss, grab handle, eyebrow + title
 * header with a 48dp close control, scrollable content. Adaptive side panels
 * land with the tablet pass; phones use this everywhere — see DESIGN_SPEC.
 */
export function Sheet({
  visible,
  onClose,
  eyebrow,
  title,
  full,
  testID,
  closeOnly,
  headerContent,
  scrollRef,
  animationType = 'slide',
  children,
}: SheetProps) {
  const { colors } = useTheme();
  // Pull-down dismiss: the sheet follows the finger and closes past a
  // distance/velocity threshold, then snaps back. Only takes over when the
  // content is scrolled to the top and the drag goes down, so scrolling,
  // taps and horizontal gestures are never stolen. Driven by Reanimated so
  // the drag never passes through static style validation.
  const dragY = useSharedValue(0);
  const scrollOffset = useRef(0);
  const onCloseRef = useRef(onClose);
  // eslint-disable-next-line react-hooks/refs -- latest-ref sync during render is the documented React pattern for stable gesture callbacks.
  onCloseRef.current = onClose;
  useEffect(() => {
    if (visible) dragY.value = 0;
  }, [visible, dragY]);
  const animatedSheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: dragY.value }],
  }));
  const dismissPan = useRef(
    // eslint-disable-next-line react-hooks/refs -- onCloseRef is read in gesture handlers at event time, not during render.
    PanResponder.create({
      onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponder: (_, gesture) =>
        gesture.dy > 10 && Math.abs(gesture.dy) > Math.abs(gesture.dx) && scrollOffset.current <= 0,
      onPanResponderMove: (_, gesture) => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue mutation is the sanctioned native-driver model.
        if (gesture.dy > 0) dragY.value = gesture.dy;
      },
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.7) onCloseRef.current();
        // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue mutation is the sanctioned native-driver model.
        else dragY.value = withSpring(0);
      },
      onPanResponderTerminate: () => {
        // eslint-disable-next-line react-hooks/immutability -- Reanimated SharedValue mutation is the sanctioned native-driver model.
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
      <AppText variant="title2">×</AppText>
    </Pressable>
  );
  return (
    <Modal
      visible={visible}
      transparent
      animationType={animationType}
      onRequestClose={onClose}
      testID={testID}
    >
      {/* eslint-disable-next-line react-hooks/refs -- panHandlers run at event time; spreading passes (never reads) ref-held handlers. */}
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
          // RN 0.86 types omit the dialog role; assertion preserves screen-reader semantics. Revisit on SDK upgrade.
          accessibilityRole={'dialog' as unknown as AccessibilityRole}
          // Reanimated 4.x prop types omit accessibilityModal (RN supports it at
          // runtime); spread preserves the prop exactly without weakening the rest.
          {...{ accessibilityModal: true }}
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
