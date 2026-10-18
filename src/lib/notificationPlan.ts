/**
 * Pure planner for the spec section 12 notification table. No native / store / i18n imports so it
 * can be unit-checked with `npx tsx scripts/checks/run.ts`. services/notifications.ts feeds it the
 * current state and turns the returned message keys into localized copy.
 */
import type { Fast, Settings } from '../types';
import { HOUR, MIN, computeStreaks, formatHM } from './fastMath';
import { nextAutoStartAt } from './autoStartDecision';
import { getProtocol } from './protocols';

export type NotifId =
  | 'fast_start' | 'window_closing' | 'halfway' | 'one_hour' | 'goal'
  | 'long_fast_check' | 'streak_risk';

/** iOS keeps at most 64 pending local notifications. */
export const MAX_SCHEDULED = 64;

export interface PlannedNotification {
  id: NotifId;
  at: number;
  /** i18n key (notifications namespace) and its params. */
  key: string;
  params: Record<string, string | number>;
  /** Safety / completion messages: not dropped by quiet hours. */
  important?: boolean;
}

export interface PlanInput {
  now: number;
  settings: Settings;
  fasts: Fast[];
  activeFastId: string | null;
  pro: boolean;
}

type Quiet = { enabled: boolean; from: string; to: string };

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/** Local wall-clock `hhmm` on the local day of `base` shifted by `addDays` (DST-safe: setDate, never +24h). */
export function atLocal(base: Date, hhmm: string, addDays = 0): Date {
  const d = new Date(base);
  d.setDate(d.getDate() + addDays);
  const m = toMin(hhmm);
  d.setHours(Math.floor(m / 60), m % 60, 0, 0);
  return d;
}

export function inQuietHours(ts: number, q: Quiet): boolean {
  if (!q.enabled) return false;
  const d = new Date(ts);
  const cur = d.getHours() * 60 + d.getMinutes();
  const from = toMin(q.from);
  const to = toMin(q.to);
  if (from === to) return false;
  return from < to ? cur >= from && cur < to : cur >= from || cur < to;
}

/** First moment at/after `ts` that is outside quiet hours (delivery at quiet-hours end). */
export function deferFromQuiet(ts: number, q: Quiet): number {
  if (!inQuietHours(ts, q)) return ts;
  const d = new Date(ts);
  let end = atLocal(d, q.to);
  if (end.getTime() <= ts) end = atLocal(d, q.to, 1);
  return end.getTime();
}

/** Next local occurrence of `hhmm` strictly after `after`. */
export function nextOccurrence(hhmm: string, after: number): number {
  const today = atLocal(new Date(after), hhmm);
  return today.getTime() > after ? today.getTime() : atLocal(new Date(after), hhmm, 1).getTime();
}

const sameLocalDay = (a: number, b: number) => new Date(a).toDateString() === new Date(b).toDateString();

export function planNotifications(input: PlanInput): PlannedNotification[] {
  const { now, settings, fasts, activeFastId, pro } = input;
  const r = settings.reminders;
  const q = r.quietHours;
  const out: PlannedNotification[] = [];
  const active = fasts.find((f) => f.id === activeFastId && f.endAt === null) ?? null;

  if (active) {
    const targetMs = active.targetMinutes * MIN;
    const goalAt = active.startAt + targetMs;

    // goal: the one reminder free users get; on by default, sound on.
    if (r.fastEnd && goalAt > now) {
      out.push({
        id: 'goal', at: goalAt, important: true, key: 'notifications.goal',
        params: { hours: Math.round((targetMs / HOUR) * 10) / 10 },
      });
    }
    if (pro && r.halfway) {
      const at = active.startAt + targetMs / 2;
      if (at > now && !inQuietHours(at, q)) {
        out.push({ id: 'halfway', at, key: 'notifications.halfway', params: { remaining: formatHM(targetMs / 2) } });
      }
    }
    if (pro && r.oneHourLeft && active.targetMinutes >= 240) {
      const at = goalAt - HOUR;
      if (at > now && !inQuietHours(at, q)) out.push({ id: 'one_hour', at, key: 'notifications.oneHour', params: {} });
    }
    // Safety check-ins at 24 h and 48 h cannot be disabled while the fast is running.
    for (const h of [24, 48]) {
      const at = active.startAt + h * HOUR;
      if (at > now) out.push({ id: 'long_fast_check', at, important: true, key: 'notifications.longFast', params: { hours: h } });
    }
  } else {
    const proto = getProtocol(settings.activeProtocolId, settings);
    let lastDone: Fast | undefined;
    for (const f of fasts) if (f.endAt !== null && (!lastDone || f.endAt > (lastDone.endAt ?? 0))) lastDone = f;
    const lastProto = lastDone ? getProtocol(lastDone.protocolId, settings) : proto;
    const autoStart = pro && settings.autoStartNextFast && !!lastDone;

    if (autoStart && lastDone) {
      // BR-08: the next fast starts by itself at windowEnd (created when the app opens).
      const startAt = nextAutoStartAt(
        lastDone.endAt as number, lastProto.eatingMinutes,
        { fastingMinutes: proto.fastingMinutes, weeklyPattern: proto.weeklyPattern },
      );
      if (startAt !== null && startAt > now && r.fastStart) {
        out.push({
          id: 'fast_start', at: deferFromQuiet(startAt, q), important: true,
          key: 'notifications.autoStart', params: { protocol: proto.name },
        });
      }
    }

    let windowEnd = lastDone ? (lastDone.endAt as number) + lastProto.eatingMinutes * MIN : nextOccurrence(settings.lastMeal, now);
    if (windowEnd <= now) windowEnd = nextOccurrence(settings.lastMeal, now);

    if (pro && r.fastStart && !autoStart) {
      out.push({
        id: 'fast_start', at: deferFromQuiet(windowEnd, q),
        key: 'notifications.fastStart', params: { protocol: proto.name },
      });
    }
    if (pro && r.windowClosing) {
      const at = windowEnd - r.windowClosingOffsetMin * MIN;
      if (at > now && !inQuietHours(at, q)) {
        out.push({
          id: 'window_closing', at, key: 'notifications.windowClosing',
          params: { minutes: r.windowClosingOffsetMin },
        });
      }
    }
  }

  // streak_risk: 20:00 local on a day with no completed fast, streak >= 3, max one per day, not in
  // quiet hours. Scheduled for today when still ahead and nothing is done yet; for tomorrow when today
  // is already done (the streak is then at risk tomorrow). Cancelled/re-planned on every fast change.
  const streak = computeStreaks(fasts, pro, new Date(now)).current;
  if (streak >= 3) {
    const todayDone = fasts.some((f) => f.endAt !== null && f.goalMet && sameLocalDay(f.endAt, now));
    const tonight = atLocal(new Date(now), '20:00').getTime();
    let at: number | null = null;
    if (!todayDone && tonight > now) at = tonight;
    else if (todayDone) at = atLocal(new Date(now), '20:00', 1).getTime();
    if (at !== null && !inQuietHours(at, q)) {
      out.push({ id: 'streak_risk', at, key: 'notifications.streakRisk', params: { n: streak } });
    }
  }

  return out.sort((a, b) => a.at - b.at).slice(0, MAX_SCHEDULED);
}
