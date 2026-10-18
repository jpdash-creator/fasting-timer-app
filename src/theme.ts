import { useColorScheme } from 'react-native';
import { useSettingsStore } from './stores/settingsStore';
import { useIsPro } from './stores/purchaseStore';
import { DEFAULT_ACCENT, getPalette, isAccentTheme } from './lib/themePalettes';

export interface Colors {
  bg: string; surface: string; text: string; textSecondary: string;
  accent: string; accentSoft: string; fastingRing: string; eatingRing: string;
  danger: string; success: string; border: string; onAccent: string; track: string;
  /** Text-safe amber (eatingRing is for graphics only). */
  eatingText: string;
  /** >=3:1 boundary for inputs, search fields, unselected chips (border is hairlines only). */
  controlBorder: string;
  accentMuted: string;
  overlay: string;
  toastBg: string; toastFg: string;
}

/** Default (Teal) palettes; the full theme set lives in lib/themePalettes.ts. */
export const lightColors: Colors = getPalette('teal', 'light');
export const darkColors: Colors = getPalette('teal', 'dark');

export const radius = { card: 16, button: 28, chip: 999, sheet: 24, control: 12, bar: 4 };
/** Shared layout metrics: use instead of literals. */
export const layout = { screenX: 20, sectionGap: 24, scrollBottom: 120 };
export const hit = { min: 44, comfortable: 56 };
export const icon = { sm: 18, md: 22, lg: 26, hero: 44 };
export const motion = { fast: 200, base: 350, ring: 600, celebrate: 1400 };
/** Ring geometry shared by every progress ring. */
export const ring = { stroke: 16, strokeHero: 14, inner: 6 };
/** Custom-protocol colour choices (first = brand accent). */
export const protocolSwatches = ['#26705F', '#2A6F8E', '#4A5FA8', '#7A4FA0', '#B5557A', '#C0603A', '#8A7A2E', '#5F6B66'];
/** Tinted-shadow recipe: pair with shadowColor = colors.text (never pure black). */
export const elevation = {
  fab: { shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  card: { shadowOpacity: 0.08, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 2 },
};
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 };
export const type = {
  title: { fontSize: 28, fontWeight: '700' as const },
  body: { fontSize: 17 },
  bodyEmphasis: { fontSize: 17, fontWeight: '600' as const },
  label: { fontSize: 15, fontWeight: '600' as const },
  subtitle: { fontSize: 22, fontWeight: '700' as const },
  caption: { fontSize: 13 },
  micro: { fontSize: 12 },
  chart: { fontSize: 12 },
  stat: { fontSize: 34, fontWeight: '700' as const, fontVariant: ['tabular-nums' as const] },
  ring: { fontSize: 56, fontWeight: '600' as const, fontVariant: ['tabular-nums' as const] },
  tabular: { fontVariant: ['tabular-nums' as const] },
};

export function useTheme() {
  const system = useColorScheme();
  const pref = useSettingsStore((s) => s.settings.theme);
  const saved = useSettingsStore((s) => s.settings.accentTheme);
  const isPro = useIsPro();
  const scheme = pref === 'system' ? (system ?? 'light') : pref;
  // Non-Pro always renders Teal; the saved choice is kept and returns if Pro comes back.
  const accentTheme = isPro && isAccentTheme(saved) ? saved : DEFAULT_ACCENT;
  return { scheme, accentTheme, colors: getPalette(accentTheme, scheme === 'dark' ? 'dark' : 'light'), radius, space, type };
}
