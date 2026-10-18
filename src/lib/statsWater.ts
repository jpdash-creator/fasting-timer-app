import { endOfDay, startOfDay } from 'date-fns';
import type { WaterEntry } from '../types';

const ML_PER_OZ = 29.5735;
export const mlToDisplay = (ml: number, unit: 'ml' | 'oz') => (unit === 'ml' ? ml : ml / ML_PER_OZ);
export const displayToMl = (v: number, unit: 'ml' | 'oz') => (unit === 'ml' ? v : v * ML_PER_OZ);
export const fmtVolume = (ml: number, unit: 'ml' | 'oz') => String(Math.round(mlToDisplay(ml, unit)));

export const QUICK_ML = [250, 500, 750];
export const QUICK_OZ = [8, 16, 24];

/** BR-11: today's entries in local time (resets at local midnight), newest first. */
export function todaysWater(entries: WaterEntry[], now = Date.now()): WaterEntry[] {
  const s = startOfDay(now).getTime();
  const e = endOfDay(now).getTime();
  return entries.filter((w) => w.at >= s && w.at <= e).sort((a, b) => b.at - a.at);
}

export const totalMl = (entries: WaterEntry[]) => entries.reduce((a, w) => a + w.ml, 0);
