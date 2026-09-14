import { type ReactNode, type Ref } from 'react';
import { Text, type TextProps } from 'react-native';
import { fontFamily, typeScale, type ThemeColors, type TypeToken } from '@/theme/tokens';
import { isIndicTranslation } from '@/content/bsb';
import { useTheme } from '@/theme/useTheme';
import { useOptionalPreferences } from '@/theme/ThemeProvider';

interface AppTextProps extends TextProps {
  variant?: TypeToken;
  color?: keyof ThemeColors;
  scripture?: boolean;
  ref?: Ref<Text>;
  children: ReactNode;
}

/** Token-driven text. Scripture uses the reading font, Indic scale for ta/te. */
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
  const preferences = useOptionalPreferences();
  const token =
    scripture && preferences && isIndicTranslation(preferences.translationId)
      ? typeScale.scriptureIndic
      : typeScale[variant];
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
