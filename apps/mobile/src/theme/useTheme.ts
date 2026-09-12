import { useColorScheme as useSystemScheme } from './useColorScheme';
import { colorsFor, type ColorScheme, type ThemeColors } from './tokens';

export interface AppTheme {
  scheme: ColorScheme;
  colors: ThemeColors;
}

/** Resolves the semantic token set for the current OS color scheme. */
export function useTheme(): AppTheme {
  const system = useSystemScheme();
  const scheme: ColorScheme = system === 'dark' ? 'dark' : 'light';
  return { scheme, colors: colorsFor(scheme) };
}
