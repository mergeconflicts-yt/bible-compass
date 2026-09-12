import { Pressable, StyleSheet, type AccessibilityState } from 'react-native';
import { radius, space } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AppText } from './AppText';

interface ButtonProps {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary';
  disabled?: boolean;
  testID?: string;
  accessibilityHint?: string;
}

/**
 * Single-action button. Minimum 48dp target, one visual emphasis per surface:
 * at most one primary button per row — see DESIGN_SPEC.md §1.
 */
export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled = false,
  testID,
  accessibilityHint,
}: ButtonProps) {
  const { colors } = useTheme();
  const isPrimary = variant === 'primary';
  const state: AccessibilityState = { disabled };
  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityState={state}
      accessibilityHint={accessibilityHint}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: isPrimary ? colors.brand : colors.surface,
          borderColor: isPrimary ? colors.brand : colors.border,
          opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <AppText
        variant="label"
        style={[styles.label, { color: isPrimary ? colors.textOnBrand : colors.textPrimary }]}
      >
        {title}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: space[12],
    borderRadius: radius.button,
    borderWidth: 1,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 16,
    lineHeight: 22,
  },
});
