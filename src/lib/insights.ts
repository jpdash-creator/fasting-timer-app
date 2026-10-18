import { subDays } from 'date-fns';
import type { Fast, ProtocolId } from '../types';
import { completed } from './stats';
import { HOUR } from './fastMath';

export type InsightTip = 'keepGoing' | 'tryLonger' | 'tryShorter' | 'logMood' | 'moreData';

export interface WeeklyInsight {
  /** ISO weekday 1..7 with the best average mood, or null. */
  bestWeekday: number | null;
  bestWeekdayMood: number | null;
  /** Protocol with the highest goal-met rate (min 2 fasts), or null. */
  bestProtocolId: ProtocolId | null;
  bestProtocolRate: number | null;
  /** Average mood of longer (>= median) vs shorter fasts. */
  moodLong: number | null;
  moodShort: number | null;
  tip: InsightTip;
  sample: number;
}

const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

/** BR-10: rule-based, last 28 days, template output only (no medical language). */
export function weeklyInsight(fasts: Fast[], now = Date.now()): WeeklyInsight {
  const since = subDays(new Date(now), 28).getTime();
  const recent = completed(fasts).filter((f) => f.endAt >= since);
  const moods = recent.filter((f) => f.mood !== null);

  const byDay = new Map<number, number[]>();
  for (const f of moods) {
    const wd = ((new Date(f.endAt).getDay() + 6) % 7) + 1;
    byDay.set(wd, [...(byDay.get(wd) ?? []), f.mood as number]);
  }
  let bestWeekday: number | null = null;
  let bestWeekdayMood: number | null = null;
  for (const [wd, arr] of byDay) {
    const a = avg(arr)!;
    if (bestWeekdayMood === null || a > bestWeekdayMood) { bestWeekday = wd; bestWeekdayMood = a; }
  }

  const byProto = new Map<ProtocolId, Fast[]>();
  for (const f of recent) byProto.set(f.protocolId, [...(byProto.get(f.protocolId) ?? []), f]);
  let bestProtocolId: ProtocolId | null = null;
  let bestProtocolRate: number | null = null;
  for (const [id, arr] of byProto) {
    if (arr.length < 2) continue;
    const rate = arr.filter((f) => f.goalMet).length / arr.length;
    if (bestProtocolRate === null || rate > bestProtocolRate) { bestProtocolId = id; bestProtocolRate = rate; }
  }

  let moodLong: number | null = null;
  let moodShort: number | null = null;
  if (moods.length >= 4) {
    const lens = moods.map((f) => f.endAt - f.startAt).sort((a, b) => a - b);
    const median = lens[Math.floor(lens.length / 2)];
    moodLong = avg(moods.filter((f) => f.endAt - f.startAt >= median).map((f) => f.mood as number));
    moodShort = avg(moods.filter((f) => f.endAt - f.startAt < median).map((f) => f.mood as number));
  }

  const goalRate = recent.length ? recent.filter((f) => f.goalMet).length / recent.length : 0;
  const avgH = recent.length ? recent.reduce((a, f) => a + (f.endAt - f.startAt), 0) / recent.length / HOUR : 0;
  let tip: InsightTip;
  if (recent.length < 3) tip = 'moreData';
  else if (moods.length < 3) tip = 'logMood';
  else if (moodLong !== null && moodShort !== null && moodLong >= moodShort + 0.5 && goalRate >= 0.7) tip = 'tryLonger';
  else if (goalRate < 0.5 && avgH > 0) tip = 'tryShorter';
  else tip = 'keepGoing';

  return { bestWeekday, bestWeekdayMood, bestProtocolId, bestProtocolRate, moodLong, moodShort, tip, sample: recent.length };
}
