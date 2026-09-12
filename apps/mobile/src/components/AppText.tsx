import { type ReactNode, type Ref } from 'react';
import { Text, type TextProps } from 'react-native';
import { fontFamily, typeScale, type ThemeColors, type TypeToken } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface AppTextProps extends TextProps {
  variant?: TypeToken;
  color?: keyof ThemeColors;
  scripture?: boolean;
  ref?: Ref<Text>;
  children: ReactNode;
}

/** Token-driven text. Scripture uses the reading (serif) font. */
export function AppText({
  variant = 'body',
  color = 'textPrimary',
  scripture = false,
  ref,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();
  const token = typeScale[variant];
  return (
    <Text
      ref={ref}
      style={[
        {
          fontSize: token.size,
          lineHeight: token.lineHeight,
          fontWeight: token.weight,
          color: colors[color],
          fontFamily: scripture ? fontFamily.scripture : fontFamily.interface,
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}
