import { Platform, useColorScheme } from 'react-native';

const light = {
  bg: '#FAFAF7',
  surface: '#FFFFFF',
  surfaceAlt: '#F1F0EA',
  text: '#1B1B18',
  muted: '#5E5E57',
  border: '#DDDBD2',
  primary: '#1F5F4A',
  onPrimary: '#FFFFFF',
  chip: '#E6EFEA',
  onChip: '#1F5F4A',
  warnBg: '#FFF1D6',
  warnText: '#6B4500',
  dangerBg: '#FDE2E0',
  dangerText: '#8A1C14',
};

const dark: typeof light = {
  bg: '#121411',
  surface: '#1B1E1A',
  surfaceAlt: '#232722',
  text: '#ECECE6',
  muted: '#A7A79E',
  border: '#33372F',
  primary: '#7CC4A6',
  onPrimary: '#0E1A15',
  chip: '#22332B',
  onChip: '#A8DCC5',
  warnBg: '#3A2D10',
  warnText: '#F5D08A',
  dangerBg: '#3C1A17',
  dangerText: '#F4B4AE',
};

export type Colors = typeof light;

export function useColors(): Colors {
  return useColorScheme() === 'dark' ? dark : light;
}

export const space = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 };
export const radius = { s: 8, m: 12, l: 16 };

/** Body text is large on purpose: people read this mid-conversation. Sizes scale with system font size. */
export const type = {
  title: 26,
  heading: 19,
  body: 17,
  small: 14,
  arabic: 26,
  urdu: 20,
};

export const fonts = {
  arabic: 'Amiri',
  urdu: Platform.select({ ios: 'Noto Nastaliq Urdu', default: 'NotoNastaliqUrdu' }),
};

export const RTL_LANGS = new Set(['ur', 'ar', 'fa']);
