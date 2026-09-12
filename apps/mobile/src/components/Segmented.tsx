import { Pressable, StyleSheet, View } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface SegmentedProps {
  options: readonly string[];
  selected: number;
  onSelect: (index: number) => void;
  accessibilityLabel: string;
  testID?: string;
  /** Compact density for sheet tab rows (36dp targets, tighter margins). */
  compact?: boolean;
}

/** Segmented control: one selected option, never color-only. */
export function Segmented({ options, selected, onSelect, accessibilityLabel, testID, compact }: SegmentedProps) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.track, compact && styles.compactTrack, { backgroundColor: colors.surfaceSubtle }]}
      role="tablist"
      aria-label={accessibilityLabel}
      testID={testID}
    >
      {options.map((option, index) => {
        const active = index === selected;
        return (
          <Pressable
            key={option}
            onPress={() => onSelect(index)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={option}
            testID={testID ? `${testID}-${index}` : undefined}
            style={[
              styles.option,
              compact && styles.compactOption,
              active && { backgroundColor: colors.surface, ...styles.activeShadow },
            ]}
          >
            <AppText variant="label" color={active ? 'textPrimary' : 'textSecondary'}>
              {option}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    borderRadius: radius.card,
    padding: space[1],
    marginVertical: space[3],
  },
  compactTrack: {
    marginVertical: space[2],
  },
  option: {
    flex: 1,
    borderRadius: space[3],
    minHeight: space[12],
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space[1],
  },
  compactOption: {
    minHeight: 36,
    paddingVertical: space[1],
  },
  activeShadow: {
    shadowColor: '#000',
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
  },
});
