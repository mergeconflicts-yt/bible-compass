import { Platform } from 'react-native';

/**
 * Semantic design tokens — the single source of truth for color, spacing and
 * type. Components must reference these tokens, never raw values.
 * Source: docs/DESIGN_SPEC.md §3 (Visual system).
 */

export const lightColors = {
  canvas: '#F7F4EE',
  surface: '#FFFCF7',
  surfaceSubtle: '#EFE9DD',
  textPrimary: '#18242D',
  textSecondary: '#59656E',
  textOnBrand: '#FFFFFF',
  brand: '#285C58',
  brandPressed: '#1E4845',
  accent: '#A86F28',
  accentSoft: '#F1E4CE',
  border: '#DDD6CA',
  focus: '#1D67D7',
  success: '#2F6C4D',
  warning: '#8A5A17',
  danger: '#B33A3A',
  scrim: 'rgba(15, 24, 30, 0.52)',
} as const;

export const darkColors = {
  canvas: '#101614',
  surface: '#18201E',
  surfaceSubtle: '#222C29',
  textPrimary: '#F3F0E8',
  textSecondary: '#B9C1BC',
  textOnBrand: '#FFFFFF',
  brand: '#72AAA4',
  brandPressed: '#8BBCB7',
  accent: '#D6A65B',
  accentSoft: '#392F21',
  border: '#34403C',
  focus: '#77A7FF',
  success: '#78B993',
  warning: '#E2B766',
  danger: '#FF8E8E',
  scrim: 'rgba(0, 0, 0, 0.64)',
} as const;

export type ThemeColors = {
  [K in keyof typeof lightColors]: string;
};

export type ColorScheme = 'light' | 'dark';

export function colorsFor(scheme: ColorScheme): ThemeColors {
  return scheme === 'dark' ? darkColors : lightColors;
}

/** 4dp base grid — see DESIGN_SPEC.md §3.3. */
export const space = {
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  8: 32,
  10: 40,
  11: 44,
  12: 48,
} as const;

export const radius = {
  card: 16,
  prominent: 24,
  button: 14,
} as const;

export interface TypeStyle {
  size: number;
  lineHeight: number;
  weight: '400' | '500' | '600' | '700';
}

/** Type scale — see DESIGN_SPEC.md §3.2. Sizes are pre-OS-scaling sp. */
export const typeScale = {
  display: { size: 36, lineHeight: 43, weight: '700' },
  title1: { size: 30, lineHeight: 38, weight: '700' },
  title2: { size: 24, lineHeight: 31, weight: '700' },
  title3: { size: 20, lineHeight: 27, weight: '600' },
  body: { size: 16, lineHeight: 24, weight: '400' },
  bodyStrong: { size: 16, lineHeight: 24, weight: '600' },
  metadata: { size: 13, lineHeight: 18, weight: '500' },
  label: { size: 14, lineHeight: 20, weight: '600' },
  caption: { size: 12, lineHeight: 17, weight: '500' },
  scripture: { size: 20, lineHeight: 32, weight: '400' },
  scriptureIndic: { size: 20, lineHeight: 36, weight: '400' },
  verseNumber: { size: 12, lineHeight: 18, weight: '600' },
} as const satisfies Record<string, TypeStyle>;

export type TypeToken = keyof typeof typeScale;

/**
 * Font families. Bundled reading/interface fonts (Inter, Source Serif 4,
 * Noto Serif Telugu/Tamil) land with the UI-1 theme task; until then the
 * platform serif/sans keeps the reader usable with no visible reflow risk.
 */
export const fontFamily = {
  interface: Platform.select({ ios: undefined, android: undefined, default: undefined }),
  scripture: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }),
} as const;
