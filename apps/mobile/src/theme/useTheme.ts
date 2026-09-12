import { useColorScheme as useSystemScheme } from './useColorScheme';
import { colorsFor, type ColorScheme, type ThemeColors } from './tokens';
import { useOptionalPreferences } from './ThemeProvider';

export interface AppTheme {
  scheme: ColorScheme;
  colors: ThemeColors;
}

/**
 * Resolves the semantic token set. Prefers the in-app appearance override
 * (Reading options / Settings) when a provider is mounted; otherwise follows
 * the OS color scheme so bare components stay test-safe.
 */
export function useTheme(): AppTheme {
  const preferences = useOptionalPreferences();
  const system = useSystemScheme();
  if (preferences) {
    return { scheme: preferences.scheme, colors: preferences.colors };
  }
  const scheme: ColorScheme = system === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colorsFor(scheme) };
}
