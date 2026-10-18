import { subDays } from 'date-fns';
import type { WeightEntry } from '../types';

const LB_PER_KG = 2.2046226218;
export const kgToDisplay = (kg: number, unit: 'kg' | 'lb') => (unit === 'kg' ? kg : kg * LB_PER_KG);
export const displayToKg = (v: number, unit: 'kg' | 'lb') => (unit === 'kg' ? v : v / LB_PER_KG);
/** 1 decimal, BR-12 display. */
export const fmtWeight = (kg: number, unit: 'kg' | 'lb') => kgToDisplay(kg, unit).toFixed(1);

/** Parse user input (comma decimals ok). Returns kg, or null if invalid / outside 20-500 kg. */
export function parseWeightInput(text: string, unit: 'kg' | 'lb'): number | null {
  const v = parseFloat(text.replace(',', '.'));
  if (!isFinite(v)) return null;
  const kg = displayToKg(v, unit);
  return kg >= 20 && kg <= 500 ? Math.round(kg * 100) / 100 : null;
}

export type WeightRange = 7 | 30 | 90;

export function inRange(entries: WeightEntry[], days: WeightRange, now = Date.now()) {
  const since = subDays(new Date(now), days).getTime();
  return entries.filter((e) => e.at >= since).sort((a, b) => a.at - b.at);
}

/** 7-day trailing moving average evaluated at each entry (BR-12). */
export function weightMovingAverage(entries: WeightEntry[], windowDays = 7): number[] {
  const sorted = [...entries].sort((a, b) => a.at - b.at);
  return sorted.map((e) => {
    const from = e.at - windowDays * 86_400_000;
    const w = sorted.filter((x) => x.at <= e.at && x.at > from);
    return w.reduce((a, x) => a + x.kg, 0) / w.length;
  });
}
