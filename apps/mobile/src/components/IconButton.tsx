import { Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface IconButtonProps {
  name: keyof typeof Ionicons.glyphMap;
  accessibilityLabel: string;
  onPress: () => void;
  disabled?: boolean;
  testID?: string;
  accessibilityHint?: string;
}

/** 48dp bordered icon button — see DESIGN_SPEC touch targets. */
export function IconButton({
  name,
  accessibilityLabel,
  onPress,
  disabled = false,
  testID,
  accessibilityHint,
}: IconButtonProps) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
        },
      ]}
    >
      <Ionicons name={name} size={22} color={colors.textPrimary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    width: space[12],
    height: space[12],
    borderRadius: radius.button,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
