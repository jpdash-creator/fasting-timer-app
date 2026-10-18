import { addDays, format, startOfDay, startOfWeek } from 'date-fns';
import type { Fast } from '../types';
import { HOUR } from './fastMath';

export const completed = (fasts: Fast[]) => fasts.filter((f): f is Fast & { endAt: number } => f.endAt !== null);

export const durationMs = (f: { startAt: number; endAt: number | null }, now = Date.now()) => (f.endAt ?? now) - f.startAt;

export interface Totals {
  totalFasts: number;
  totalHours: number;
  avgHours: number;
  goalRate: number; // 0..1
}

export function computeTotals(fasts: Fast[]): Totals {
  const done = completed(fasts);
  if (!done.length) return { totalFasts: 0, totalHours: 0, avgHours: 0, goalRate: 0 };
  const ms = done.reduce((a, f) => a + (f.endAt - f.startAt), 0);
  const met = done.filter((f) => f.goalMet).length;
  return {
    totalFasts: done.length,
    totalHours: ms / HOUR,
    avgHours: ms / HOUR / done.length,
    goalRate: met / done.length,
  };
}

export interface DayPoint { key: string; date: Date; hours: number }

/** Hours per local day (BR-03: attributed to the day of endAt) for the `days` days ending today. */
export function hoursPerDay(fasts: Fast[], days: number, now = new Date()): DayPoint[] {
  const today = startOfDay(now);
  const out: DayPoint[] = [];
  const idx = new Map<string, number>();
  for (let i = days - 1; i >= 0; i--) {
    const d = addDays(today, -i);
    const key = format(d, 'yyyy-MM-dd');
    idx.set(key, out.length);
    out.push({ key, date: d, hours: 0 });
  }
  for (const f of completed(fasts)) {
    const i = idx.get(format(new Date(f.endAt), 'yyyy-MM-dd'));
    if (i !== undefined) out[i].hours += (f.endAt - f.startAt) / HOUR;
  }
  return out;
}

/** Trailing moving average (window days) of a numeric series. */
export function movingAverage(values: number[], window: number): number[] {
  return values.map((_, i) => {
    const from = Math.max(0, i - window + 1);
    const slice = values.slice(from, i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
}

/** Fast counts by ISO weekday, index 0 = Monday. */
export function fastsByWeekday(fasts: Fast[]): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const f of completed(fasts)) out[(new Date(f.endAt).getDay() + 6) % 7]++;
  return out;
}

/** Group fasts, newest first, by Monday-start week. */
export interface WeekGroup { weekStart: number; fasts: Fast[]; totalHours: number }
export function groupByWeek(fasts: Fast[]): WeekGroup[] {
  const now = Date.now();
  const sorted = [...fasts].sort((a, b) => (b.endAt ?? now) - (a.endAt ?? now));
  const groups: WeekGroup[] = [];
  for (const f of sorted) {
    const ws = startOfWeek(new Date(f.endAt ?? now), { weekStartsOn: 1 }).getTime();
    let g = groups[groups.length - 1];
    if (!g || g.weekStart !== ws) {
      g = { weekStart: ws, fasts: [], totalHours: 0 };
      groups.push(g);
    }
    g.fasts.push(f);
    g.totalHours += durationMs(f, now) / HOUR;
  }
  return groups;
}

/** FR-13 filter by protocol and note search. */
export function filterFasts(fasts: Fast[], protocolId: string | null, query: string): Fast[] {
  const q = query.trim().toLowerCase();
  return fasts.filter(
    (f) => (!protocolId || f.protocolId === protocolId) && (!q || f.note.toLowerCase().includes(q)),
  );
}

/** FR-10 per-day calendar marks. goalMet = at least one goal-met fast ended that day. */
export function calendarMarks(fasts: Fast[]): Map<string, { fasts: number; goalMet: boolean }> {
  const m = new Map<string, { fasts: number; goalMet: boolean }>();
  for (const f of completed(fasts)) {
    const k = format(new Date(f.endAt), 'yyyy-MM-dd');
    const cur = m.get(k) ?? { fasts: 0, goalMet: false };
    cur.fasts++;
    if (f.goalMet) cur.goalMet = true;
    m.set(k, cur);
  }
  return m;
}
const STEPS = [1, 2, 4, 5, 6, 8, 10, 12, 20, 24, 25, 50, 100, 200, 500, 1000];

export type Axis = { lo: number; hi: number; step: number; sections: number };

/**
 * Nice integer axis: picks a step so the range needs at most `maxSections` sections,
 * with lo/hi rounded outward to step multiples (hi >= max, lo <= min).
 * `minSections` keeps small data from producing a squashed axis.
 */
export function niceAxis(min: number, max: number, opts: { minSections?: number; maxSections?: number; zeroBased?: boolean } = {}): Axis {
  const { minSections = 3, maxSections = 5, zeroBased = true } = opts;
  const lo0 = zeroBased ? 0 : min;
  const span = Math.max(1, max - lo0);
  let step = STEPS[STEPS.length - 1];
  for (const s of STEPS) {
    if (Math.ceil(span / s) <= maxSections) { step = s; break; }
  }
  // For tiny data, prefer a smaller step so we still get at least minSections.
  while (step > 1 && Math.ceil(span / step) < minSections && STEPS.includes(step)) {
    const smaller = [...STEPS].reverse().find((s) => s < step);
    if (!smaller || Math.ceil(span / smaller) > maxSections) break;
    step = smaller;
  }
  const lo = zeroBased ? 0 : Math.floor(min / step) * step;
  let sections = Math.max(1, Math.ceil((max - lo) / step));
  if (zeroBased) sections = Math.max(sections, Math.min(minSections, maxSections));
  return { lo, hi: lo + sections * step, step, sections };
}
