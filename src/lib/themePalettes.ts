import type { Colors } from '../theme';

/** Accent themes. 'teal' is the free default; the rest are Pro. */
export type AccentTheme = 'teal' | 'ocean' | 'dusk' | 'sunrise';
export const ACCENT_THEMES: AccentTheme[] = ['teal', 'ocean', 'dusk', 'sunrise'];
export const DEFAULT_ACCENT: AccentTheme = 'teal';

export function isAccentTheme(v: unknown): v is AccentTheme {
  return typeof v === 'string' && (ACCENT_THEMES as string[]).includes(v);
}

/** Neutrals are shared by every theme so layout, text and states read identically. */
const lightBase = {
  bg: '#FAFAF7', surface: '#FFFFFF', text: '#1A1A1A', textSecondary: '#666666',
  eatingRing: '#C27400', danger: '#C23A3A', border: '#E6E6E0', onAccent: '#FFFFFF', track: '#E8EDEA',
  eatingText: '#8A5200', controlBorder: '#7F7F78', overlay: 'rgba(0,0,0,0.45)',
  toastBg: '#1A1A1A', toastFg: '#FAFAF7',
};
const darkBase = {
  bg: '#0F1412', surface: '#1A211E', text: '#F2F2F2', textSecondary: '#A8B0AC',
  eatingRing: '#F5B45E', danger: '#F08080', border: '#2A3430', track: '#26302C',
  eatingText: '#F5B45E', controlBorder: '#7A8681', overlay: 'rgba(0,0,0,0.6)',
  toastBg: '#F2F2F2', toastFg: '#0F1412',
};

type Accents = Pick<Colors, 'accent' | 'accentSoft' | 'fastingRing' | 'success' | 'accentMuted' | 'onAccent'>;
const build = (base: Omit<Colors, keyof Accents> & Partial<Accents>, a: Accents): Colors => ({ ...base, ...a } as Colors);

const SUCCESS_LIGHT = '#26705F';
const SUCCESS_DARK = '#4FB59E';

export const palettes: Record<AccentTheme, { light: Colors; dark: Colors }> = {
  teal: {
    light: build(lightBase, { accent: '#26705F', accentSoft: '#DFF1EC', fastingRing: '#26705F', success: '#26705F', accentMuted: '#5E9686', onAccent: '#FFFFFF' }),
    dark: build(darkBase, { accent: '#4FB59E', accentSoft: '#1E3A33', fastingRing: '#4FB59E', success: '#4FB59E', accentMuted: '#3A7A6A', onAccent: '#0B1512' }),
  },
  ocean: {
    light: build(lightBase, { accent: '#1F5E8F', accentSoft: '#DEEBF6', fastingRing: '#1F5E8F', success: SUCCESS_LIGHT, accentMuted: '#5F90B8', onAccent: '#FFFFFF' }),
    dark: build(darkBase, { accent: '#6BB3E8', accentSoft: '#1B3347', fastingRing: '#6BB3E8', success: SUCCESS_DARK, accentMuted: '#3F7AA6', onAccent: '#0A1620' }),
  },
  dusk: {
    light: build(lightBase, { accent: '#5B4FA8', accentSoft: '#E8E5F6', fastingRing: '#5B4FA8', success: SUCCESS_LIGHT, accentMuted: '#8F86C9', onAccent: '#FFFFFF' }),
    dark: build(darkBase, { accent: '#A99BEB', accentSoft: '#2A2547', fastingRing: '#A99BEB', success: SUCCESS_DARK, accentMuted: '#6C60B0', onAccent: '#14102B' }),
  },
  sunrise: {
    light: build(lightBase, { accent: '#B2451E', accentSoft: '#FBE6DD', fastingRing: '#B2451E', success: SUCCESS_LIGHT, accentMuted: '#C27650', onAccent: '#FFFFFF' }),
    dark: build(darkBase, { accent: '#F2926A', accentSoft: '#44261A', fastingRing: '#F2926A', success: SUCCESS_DARK, accentMuted: '#B0603F', onAccent: '#2A1006' }),
  },
};

export function getPalette(theme: AccentTheme, scheme: 'light' | 'dark'): Colors {
  return palettes[theme][scheme];
}

/** Gradient stops (top-left to bottom-right) for the app-icon field and the preview card. */
export const iconGradients: Record<AccentTheme, [string, string]> = {
  teal: ['#318A75', '#1B5446'],
  ocean: ['#2F7FBF', '#173F63'],
  dusk: ['#7468C8', '#3A2F7A'],
  sunrise: ['#E0683A', '#8A2F14'],
};
