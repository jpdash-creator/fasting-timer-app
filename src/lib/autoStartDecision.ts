/**
 * Pure decision logic for BR-08 (auto-start next fast). No store / native imports so it can be
 * unit-checked with `npx tsx scripts/check-autostart.ts`.
 */
const MIN = 60_000;
const HOUR = 3_600_000;

/** A fast is never back-dated by more than this (the user has clearly been away). */
export const MAX_LATE_MS = 12 * HOUR;

export interface NextProtocolInfo {
  fastingMinutes: number;
  /** ISO weekdays (1 = Mon .. 7 = Sun), e.g. 5:2 */
  weeklyPattern?: { fastingDays: number[] };
}

/** First local midnight at/after `from` that falls on one of the ISO weekdays. */
export function nextFastingDayStart(from: number, days: number[]): number | null {
  if (!days.length) return null;
  const base = new Date(from);
  for (let i = 0; i <= 8; i++) {
    const d = new Date(base.getFullYear(), base.getMonth(), base.getDate() + i, 0, 0, 0, 0);
    const iso = d.getDay() === 0 ? 7 : d.getDay();
    if (d.getTime() >= from && days.includes(iso)) return d.getTime();
  }
  return null;
}

/**
 * When the next fast should begin. Normally windowEnd = endAt + eatingMinutes. For weekly-pattern
 * protocols (5:2) the next fast begins at the start of the next fasting day. Protocols without an
 * eating window (36 h) have no automatic next start.
 */
export function nextAutoStartAt(
  lastEndAt: number, lastEatingMinutes: number, next: NextProtocolInfo,
): number | null {
  const windowEnd = lastEndAt + Math.max(0, lastEatingMinutes) * MIN;
  if (next.weeklyPattern && next.weeklyPattern.fastingDays.length) {
    return nextFastingDayStart(windowEnd, next.weeklyPattern.fastingDays);
  }
  if (lastEatingMinutes <= 0) return null;
  return windowEnd;
}

export type AutoStartDecision =
  | { kind: 'start'; startAt: number }
  | { kind: 'wait'; at: number }
  | { kind: 'none'; reason: string };

export interface AutoStartInput {
  enabled: boolean;
  pro: boolean;
  hasActiveFast: boolean;
  now: number;
  lastEndAt: number | null;
  lastEatingMinutes: number;
  next: NextProtocolInfo;
  /** endAt of a fast we already auto-started from (prevents a second start after the user deletes it). */
  handledEndAt?: number | null;
  /** true when a fast already overlaps [startAt, now]. */
  overlaps?: (startAt: number) => boolean;
}

export function decideAutoStart(i: AutoStartInput): AutoStartDecision {
  if (!i.enabled) return { kind: 'none', reason: 'disabled' };
  if (!i.pro) return { kind: 'none', reason: 'not-pro' };
  if (i.hasActiveFast) return { kind: 'none', reason: 'active' };
  if (i.lastEndAt === null) return { kind: 'none', reason: 'no-previous' };
  const startAt = nextAutoStartAt(i.lastEndAt, i.lastEatingMinutes, i.next);
  if (startAt === null) return { kind: 'none', reason: 'no-window' };
  if (i.now < startAt) return { kind: 'wait', at: startAt };
  const late = i.now - startAt;
  if (late > MAX_LATE_MS || late >= i.next.fastingMinutes * MIN) return { kind: 'none', reason: 'stale' };
  if (i.handledEndAt === i.lastEndAt) return { kind: 'none', reason: 'handled' };
  if (i.overlaps?.(startAt)) return { kind: 'none', reason: 'overlap' };
  return { kind: 'start', startAt };
}
