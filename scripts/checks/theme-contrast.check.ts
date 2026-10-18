/** WCAG contrast for every text/graphic colour pair the app uses, for all 4 accent palettes x light/dark. */
import { assert, check, describe } from './harness';
import { ACCENT_THEMES, palettes } from '../../src/lib/themePalettes';
import type { Colors } from '../../src/theme';

function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * ch[0] + 0.7152 * ch[1] + 0.0722 * ch[2];
}
export function ratio(a: string, b: string): number {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

type K = keyof Colors;
/** [foreground, background] pairs that carry text (>= 4.5:1). */
const TEXT: [K, K][] = [
  ['text', 'bg'], ['text', 'surface'], ['text', 'accentSoft'],
  ['textSecondary', 'bg'], ['textSecondary', 'surface'], ['textSecondary', 'accentSoft'],
  ['accent', 'bg'], ['accent', 'surface'], ['accent', 'accentSoft'],
  ['onAccent', 'accent'],
  ['success', 'bg'], ['success', 'surface'], ['success', 'accentSoft'],
  ['danger', 'bg'], ['danger', 'surface'],
  ['eatingText', 'bg'], ['eatingText', 'surface'],
  ['toastFg', 'toastBg'],
];
/** Graphics, rings, borders, icons (>= 3:1). */
const GRAPHIC: [K, K][] = [
  ['fastingRing', 'bg'], ['fastingRing', 'surface'], ['fastingRing', 'track'], ['fastingRing', 'accentSoft'],
  ['success', 'track'],
  ['eatingRing', 'bg'], ['eatingRing', 'surface'],
  ['controlBorder', 'bg'], ['controlBorder', 'surface'], ['controlBorder', 'accentSoft'],
  ['accentMuted', 'bg'], ['accentMuted', 'surface'],
];

describe('Theme contrast (WCAG AA)');
describe('Theme contrast (WCAG AA)');
for (const theme of ACCENT_THEMES) {
  for (const scheme of ['light', 'dark'] as const) {
    const c = palettes[theme][scheme];
    check(`${theme}/${scheme}: all ${TEXT.length + GRAPHIC.length} pairs pass`, () => {
      const bad: string[] = [];
      for (const [f, b] of TEXT) { const r = ratio(c[f] as string, c[b] as string); if (r < 4.5) bad.push(`${f} on ${b} = ${r.toFixed(2)} (<4.5)`); }
      for (const [f, b] of GRAPHIC) { const r = ratio(c[f] as string, c[b] as string); if (r < 3) bad.push(`${f} on ${b} = ${r.toFixed(2)} (<3)`); }
      assert.deepEqual(bad, []);
    });
  }
}
