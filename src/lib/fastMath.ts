import { addDays, differenceInCalendarDays, format, isSameDay, startOfDay } from 'date-fns';
import type { Fast } from '../types';

export const MIN = 60_000;
export const HOUR = 3_600_000;

/** BR-01: everything derives from timestamps. */
export function timerState(fast: Pick<Fast, 'startAt' | 'targetMinutes'>, now = Date.now()) {
  const rawElapsed = now - fast.startAt;
  const elapsedMs = Math.max(0, rawElapsed);
  const targetMs = fast.targetMinutes * MIN;
  const remainingMs = Math.max(0, targetMs - elapsedMs);
  const percent = targetMs > 0 ? Math.min(1, elapsedMs / targetMs) : 0;
  const overMs = Math.max(0, elapsedMs - targetMs);
  return { elapsedMs, targetMs, remainingMs, percent, overMs, clockSkew: rawElapsed < 0 };
}

/** BR-02 */
export function isGoalMet(fast: Pick<Fast, 'startAt' | 'targetMinutes'>, endAt: number) {
  return endAt - fast.startAt >= fast.targetMinutes * MIN * 0.98;
}

/** "HH:MM:SS" or "HH:MM" */
export function formatDuration(ms: number, withSeconds = true) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const hh = Math.floor(total / 3600);
  const mm = Math.floor((total % 3600) / 60);
  const ss = total % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return withSeconds ? `${p(hh)}:${p(mm)}:${p(ss)}` : `${p(hh)}:${p(mm)}`;
}

export function formatHM(ms: number) {
  const m = Math.max(0, Math.round(ms / MIN));
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
}

/** BR-05 */
export function eatingWindowEnd(endAt: number, eatingMinutes: number) {
  return endAt + eatingMinutes * MIN;
}

/** BR-03: local calendar day key of the fast. */
export function dayKey(fast: Pick<Fast, 'startAt' | 'endAt'>) {
  return format(new Date(fast.endAt ?? Date.now()), 'yyyy-MM-dd');
}

/**
 * BR-06 / spec 16: latest allowed end time for a running fast. A fast that has already run more than
 * 7 days cannot end "now"; it must be ended at (at most) start + 7 days so the user is never trapped.
 */
export function endTimeBounds(startAt: number, now = Date.now()): { stale: boolean; max: number } {
  const cap = startAt + 7 * 24 * HOUR;
  return now > cap ? { stale: true, max: cap } : { stale: false, max: now };
}

/** BR-06: returns an error string key or null. */
export function validateFastTimes(
  startAt: number,
  endAt: number | null,
  others: Fast[],
  selfId?: string,
  now = Date.now(),
): { key: string; params?: Record<string, string> } | null {
  if (startAt > now) return { key: 'validation.startFuture' };
  // BR-06: duration <= 7 days also applies to a running fast (its duration so far).
  if (endAt === null && now - startAt > 7 * 24 * HOUR) return { key: 'validation.tooLong' };
  if (endAt !== null) {
    if (startAt >= endAt) return { key: 'validation.startBeforeEnd' };
    if (endAt > now) return { key: 'validation.endFuture' };
    if (endAt - startAt > 7 * 24 * HOUR) return { key: 'validation.tooLong' };
  }
  const end = endAt ?? now;
  for (const o of others) {
    if (o.id === selfId) continue;
    const oEnd = o.endAt ?? now;
    if (startAt < oEnd && end > o.startAt) {
      return { key: 'validation.overlap', params: { date: format(new Date(o.startAt), 'MMM d') } };
    }
  }
  return null;
}

/** BR-09: days (yyyy-MM-dd) that count = at least one goal-met fast ended that day. */
export function countingDays(fasts: Fast[]): Set<string> {
  const s = new Set<string>();
  for (const f of fasts) if (f.endAt && f.goalMet) s.add(format(new Date(f.endAt), 'yyyy-MM-dd'));
  return s;
}

export interface StreakResult { current: number; longest: number; freezesUsed: string[] }

const dkey = (d: Date) => format(d, 'yyyy-MM-dd');
const parseKey = (k: string) => new Date(k + 'T00:00:00');
/** Monday-start calendar week key. */
const weekKey = (d: Date) => dkey(addDays(startOfDay(d), -((d.getDay() + 6) % 7)));

/**
 * BR-09 streak calculation. A day counts if a goal-met fast ended that day.
 * Walks forward day by day. Today without a fast yet never breaks a streak
 * (the streak is "up to today or yesterday").
 * With `freeze` (Pro): one single missed day per calendar week (Mon-start) is
 * bridged automatically when it sits between two counting days. A frozen day
 * keeps the streak alive but does not add to its length.
 */
export function computeStreaks(fasts: Fast[], freeze: boolean, today = new Date()): StreakResult {
  const days = countingDays(fasts);
  if (days.size === 0) return { current: 0, longest: 0, freezesUsed: [] };
  const todayStart = startOfDay(today);
  const sorted = [...days].sort();
  const first = parseKey(sorted[0]);
  const freezesUsed: string[] = [];
  const usedWeeks = new Set<string>();
  let run = 0;
  let longest = 0;
  let prevCounted = false;
  const total = differenceInCalendarDays(todayStart, first);
  for (let i = 0; i <= total; i++) {
    const d = addDays(first, i);
    const k = dkey(d);
    if (days.has(k)) {
      run++;
      prevCounted = true;
    } else if (i === total) {
      // today with no goal-met fast yet: neither counts nor breaks
      break;
    } else {
      const wk = weekKey(d);
      const nextCounted = days.has(dkey(addDays(d, 1)));
      if (freeze && prevCounted && nextCounted && !usedWeeks.has(wk)) {
        usedWeeks.add(wk);
        freezesUsed.push(k);
        prevCounted = false; // a frozen day cannot itself be followed by another freeze
      } else {
        run = 0;
        prevCounted = false;
      }
    }
    longest = Math.max(longest, run);
  }
  // Streak only live if it reaches today or yesterday.
  const yKey = dkey(addDays(todayStart, -1));
  const live = days.has(dkey(todayStart)) || days.has(yKey);
  return { current: live ? run : 0, longest, freezesUsed };
}

export function isToday(ms: number) { return isSameDay(new Date(ms), new Date()); }
