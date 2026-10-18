import type { Fast } from '../types';
import { computeStreaks, HOUR } from './fastMath';
import { completed } from './stats';

export type BadgeId = 'firstFast' | 'streak3' | 'streak7' | 'streak30' | 'hours100' | 'first20h';

export interface Badge { id: BadgeId; earned: boolean; progress: number /* 0..1 */ }

/** FR-21. Pure: derived from fasts only. Streak badges use the longest streak ever. */
export function computeBadges(fasts: Fast[], freeze = false, today = new Date()): Badge[] {
  const done = completed(fasts);
  const { longest } = computeStreaks(fasts, freeze, today);
  const hours = done.reduce((a, f) => a + (f.endAt - f.startAt), 0) / HOUR;
  const has20 = done.some((f) => f.endAt - f.startAt >= 20 * HOUR);
  const cap = (v: number, n: number) => Math.min(1, v / n);
  return [
    { id: 'firstFast', earned: done.length >= 1, progress: cap(done.length, 1) },
    { id: 'streak3', earned: longest >= 3, progress: cap(longest, 3) },
    { id: 'streak7', earned: longest >= 7, progress: cap(longest, 7) },
    { id: 'streak30', earned: longest >= 30, progress: cap(longest, 30) },
    { id: 'hours100', earned: hours >= 100, progress: cap(hours, 100) },
    { id: 'first20h', earned: has20, progress: has20 ? 1 : 0 },
  ];
}

export const earnedBadges = (fasts: Fast[], freeze = false) => computeBadges(fasts, freeze).filter((b) => b.earned);
