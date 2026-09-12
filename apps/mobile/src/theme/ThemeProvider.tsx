import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme as useSystemScheme } from './useColorScheme';
import { colorsFor, type ColorScheme, type ThemeColors } from './tokens';

export type AppearanceOverride = ColorScheme | null;

/** Reading text sizes for Scripture: IMG_4195 match scaled down 25% by owner. */
export const scriptureSizes = [21, 23, 24] as const;
export const scriptureSizeLabels = ['default', 'large', 'largest'] as const;

interface PreferencesValue {
  scheme: ColorScheme;
  colors: ThemeColors;
  appearanceOverride: AppearanceOverride;
  setAppearanceOverride: (override: AppearanceOverride) => void;
  toggleAppearance: () => void;
  scriptureSizeIndex: number;
  cycleScriptureSize: () => void;
}

const PreferencesContext = createContext<PreferencesValue | null>(null);

/**
 * Ephemeral UI preferences (appearance override, reading text size).
 * No persistence yet — preferences sync lands with the saved/account slices.
 * Components must keep working when no provider is mounted (tests).
 */
export function AppPreferencesProvider({ children }: { children: ReactNode }) {
  const system = useSystemScheme();
  const [appearanceOverride, setAppearanceOverride] = useState<AppearanceOverride>(null);
  const [scriptureSizeIndex, setScriptureSizeIndex] = useState(0);

  const scheme: ColorScheme =
    appearanceOverride ?? (system === 'dark' ? 'dark' : 'light');

  const toggleAppearance = useCallback(() => {
    setAppearanceOverride((current) => {
      const effective = current ?? (system === 'dark' ? 'dark' : 'light');
      return effective === 'dark' ? 'light' : 'dark';
    });
  }, [system]);

  const cycleScriptureSize = useCallback(() => {
    setScriptureSizeIndex((index) => (index + 1) % scriptureSizes.length);
  }, []);

  const value = useMemo<PreferencesValue>(
    () => ({
      scheme,
      colors: colorsFor(scheme),
      appearanceOverride,
      setAppearanceOverride,
      toggleAppearance,
      scriptureSizeIndex,
      cycleScriptureSize,
    }),
    [scheme, appearanceOverride, toggleAppearance, scriptureSizeIndex, cycleScriptureSize],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences(): PreferencesValue {
  const context = useContext(PreferencesContext);
  if (!context) {
    throw new Error('usePreferences must be used inside AppPreferencesProvider');
  }
  return context;
}

/** Optional read: falls back to the system scheme outside a provider. */
export function useOptionalPreferences(): PreferencesValue | null {
  return useContext(PreferencesContext);
}
