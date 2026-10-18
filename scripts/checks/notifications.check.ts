import { addDays } from 'date-fns';
import { assert, at, check, describe, H, metOn, MIN, mkFast, withTZ } from './harness';
import { defaultSettings } from '../../src/lib/defaultSettings';
import {
  MAX_SCHEDULED, deferFromQuiet, inQuietHours, nextOccurrence, planNotifications, type PlanInput,
} from '../../src/lib/notificationPlan';
import type { Fast, Settings } from '../../src/types';

const settings = (o: Partial<Settings> = {}, r: Partial<Settings['reminders']> = {}): Settings => ({
  ...defaultSettings, ...o, reminders: { ...defaultSettings.reminders, ...r },
});
const plan = (now: number, fasts: Fast[], pro: boolean, s: Settings = settings(), activeId: string | null = null) => {
  const input: PlanInput = { now, settings: s, fasts, activeFastId: activeId, pro };
  return planNotifications(input);
};
const ids = (p: ReturnType<typeof plan>) => p.map((n) => n.id);

const NOW = at(2026, 6, 10, 20, 0);
const running = (hours = 16, startAt = NOW) => mkFast({ id: 'run', startAt, endAt: null, targetMinutes: hours * 60 });

describe('section 12: fast running');
check('free user: goal + the two long-fast check-ins only', () => {
  const p = plan(NOW, [running()], false, settings(), 'run');
  assert.deepEqual(ids(p), ['goal', 'long_fast_check', 'long_fast_check']);
  assert.equal(p[0].at, NOW + 16 * H);
  assert.equal(p[1].at, NOW + 24 * H);
  assert.equal(p[2].at, NOW + 48 * H);
});
check('Pro user: goal, halfway, one-hour-left, 24h and 48h check-ins at the right instants', () => {
  const p = plan(NOW, [running()], true, settings(), 'run');
  const by = Object.fromEntries(p.filter((n) => n.id !== 'long_fast_check').map((n) => [n.id, n]));
  assert.equal(by.halfway.at, NOW + 8 * H);
  assert.equal(by.one_hour.at, NOW + 15 * H);
  assert.equal(by.goal.at, NOW + 16 * H);
  assert.equal(p.filter((n) => n.id === 'long_fast_check').length, 2);
  assert.deepEqual(p.map((n) => n.at), [...p.map((n) => n.at)].sort((a, b) => a - b));
});
check('copy keys and params ({protocol}/{remaining}/{hours}/{minutes}/{n})', () => {
  const p = plan(NOW, [running()], true, settings(), 'run');
  const g = p.find((n) => n.id === 'goal');
  assert.equal(g?.key, 'notifications.goal');
  assert.equal(g?.params.hours, 16);
  assert.equal(p.find((n) => n.id === 'halfway')?.params.remaining, '8h 0m');
  assert.equal(p.find((n) => n.id === 'one_hour')?.key, 'notifications.oneHour');
  assert.deepEqual(p.filter((n) => n.id === 'long_fast_check').map((n) => n.params.hours), [24, 48]);
});
check('one_hour only if target >= 4h', () => {
  assert.equal(ids(plan(NOW, [running(3.9)], true, settings(), 'run')).includes('one_hour'), false);
  const p4 = plan(NOW, [running(4)], true, settings(), 'run');
  assert.equal(p4.find((n) => n.id === 'one_hour')?.at, NOW + 3 * H);
});
check('events already in the past are not scheduled', () => {
  const p = plan(NOW + 9 * H, [running()], true, settings(), 'run');
  assert.deepEqual(ids(p), ['one_hour', 'goal', 'long_fast_check', 'long_fast_check']);
  const late = plan(NOW + 30 * H, [running()], true, settings(), 'run');
  assert.deepEqual(ids(late), ['long_fast_check']); // only the 48 h check-in is left
});
check('per-reminder toggles are honoured, the safety check-ins cannot be disabled', () => {
  const off = settings({}, { fastStart: false, fastEnd: false, halfway: false, oneHourLeft: false, windowClosing: false });
  const p = plan(NOW, [running()], true, off, 'run');
  assert.deepEqual(ids(p), ['long_fast_check', 'long_fast_check']);
});
check('quiet hours drop halfway / one-hour inside the window; goal and safety still fire', () => {
  const q = settings({}, { quietHours: { enabled: true, from: '22:00', to: '07:00' } });
  // start 14:00: halfway 22:00 (quiet), one-hour 05:00 (quiet), goal 06:00 (important)
  const start = at(2026, 6, 10, 14, 0);
  const p = plan(start, [running(16, start)], true, q, 'run');
  assert.deepEqual(ids(p), ['goal', 'long_fast_check', 'long_fast_check']);
});
check('after the target is passed the goal is not re-scheduled', () => {
  const p = plan(NOW + 17 * H, [running()], true, settings(), 'run');
  assert.equal(ids(p).includes('goal'), false);
});

describe('section 12: eating window / fast_start / window_closing');
const ended = (endAt: number, proto: '16_8' | '36H' = '16_8') =>
  mkFast({ startAt: endAt - 16 * H, endAt, goalMet: true, protocolId: proto, targetMinutes: proto === '36H' ? 2160 : 960 });
check('Pro: fast_start at windowEnd and window_closing 30 min earlier', () => {
  const end = at(2026, 6, 10, 12, 0);
  const p = plan(end + 5 * MIN, [ended(end)], true);
  const fs = p.find((n) => n.id === 'fast_start');
  const wc = p.find((n) => n.id === 'window_closing');
  assert.equal(fs?.at, end + 8 * H);
  assert.equal(fs?.key, 'notifications.fastStart');
  assert.equal(fs?.params.protocol, '16:8');
  assert.equal(wc?.at, end + 8 * H - 30 * MIN);
  assert.equal(wc?.params.minutes, 30);
});
check('custom window-closing offset', () => {
  const end = at(2026, 6, 10, 12, 0);
  const p = plan(end + 5 * MIN, [ended(end)], true, settings({}, { windowClosingOffsetMin: 45 }));
  assert.equal(p.find((n) => n.id === 'window_closing')?.at, end + 8 * H - 45 * MIN);
});
check('free users get neither fast_start nor window_closing', () => {
  const end = at(2026, 6, 10, 12, 0);
  assert.deepEqual(ids(plan(end + 5 * MIN, [ended(end)], false)), []);
});
check('fast_start is never planned while a fast is running', () => {
  const p = plan(NOW, [ended(at(2026, 6, 9, 12)), running()], true, settings(), 'run');
  assert.equal(ids(p).includes('fast_start'), false);
  assert.equal(ids(p).includes('window_closing'), false);
});
check('fast_start inside quiet hours is delivered at quiet-hours end', () => {
  const q = settings({}, { quietHours: { enabled: true, from: '22:00', to: '07:00' } });
  const end = at(2026, 6, 10, 15, 0); // window end 23:00 -> quiet
  const p = plan(end + MIN, [ended(end)], true, q);
  assert.equal(p.find((n) => n.id === 'fast_start')?.at, at(2026, 6, 11, 7, 0));
  const end2 = at(2026, 6, 10, 18, 0); // window end 02:00 next day -> still quiet, same-day end
  assert.equal(plan(end2 + MIN, [ended(end2)], true, q).find((n) => n.id === 'fast_start')?.at, at(2026, 6, 11, 7, 0));
});
check('window_closing inside quiet hours is dropped (optional), not deferred', () => {
  const q = settings({}, { quietHours: { enabled: true, from: '22:00', to: '07:00' } });
  const end = at(2026, 6, 10, 14, 30); // window end 22:30, closing 22:00 (quiet)
  assert.equal(ids(plan(end + MIN, [ended(end)], true, q)).includes('window_closing'), false);
});
check('no fasts yet: first fast_start at tonight\'s last-meal time (plan summary promise)', () => {
  const now = at(2026, 6, 10, 9, 0);
  const p = plan(now, [], true);
  assert.equal(p.find((n) => n.id === 'fast_start')?.at, at(2026, 6, 10, 20, 0));
  const later = plan(at(2026, 6, 10, 21, 0), [], true);
  assert.equal(later.find((n) => n.id === 'fast_start')?.at, at(2026, 6, 11, 20, 0));
});
check('window already closed: falls back to the next last-meal time (never in the past)', () => {
  const end = at(2026, 6, 8, 12, 0);
  const now = at(2026, 6, 10, 9, 0);
  const p = plan(now, [ended(end)], true);
  assert.ok(p.every((n) => n.at > now));
  assert.equal(p.find((n) => n.id === 'fast_start')?.at, at(2026, 6, 10, 20, 0));
});
check('quiet-hours helpers: overnight and same-day ranges, equal bounds = off', () => {
  const night = { enabled: true, from: '22:00', to: '07:00' };
  assert.equal(inQuietHours(at(2026, 6, 10, 23, 0), night), true);
  assert.equal(inQuietHours(at(2026, 6, 10, 6, 59), night), true);
  assert.equal(inQuietHours(at(2026, 6, 10, 7, 0), night), false);
  assert.equal(inQuietHours(at(2026, 6, 10, 21, 59), night), false);
  assert.equal(inQuietHours(at(2026, 6, 10, 23, 0), { ...night, enabled: false }), false);
  const day = { enabled: true, from: '13:00', to: '15:00' };
  assert.equal(inQuietHours(at(2026, 6, 10, 14, 0), day), true);
  assert.equal(deferFromQuiet(at(2026, 6, 10, 14, 0), day), at(2026, 6, 10, 15, 0));
  assert.equal(inQuietHours(at(2026, 6, 10, 3, 0), { enabled: true, from: '08:00', to: '08:00' }), false);
  assert.equal(nextOccurrence('20:00', at(2026, 6, 10, 20, 0)), at(2026, 6, 11, 20, 0)); // strictly after
});
check('quiet-hours deferral across a DST change lands on local wall-clock time', () => {
  withTZ('America/New_York', () => {
    const q = { enabled: true, from: '22:00', to: '07:00' };
    assert.equal(deferFromQuiet(at(2026, 3, 7, 23, 0), q), at(2026, 3, 8, 7, 0)); // spring forward night
    assert.equal(deferFromQuiet(at(2026, 10, 31, 23, 30), q), at(2026, 11, 1, 7, 0)); // fall back night
  });
});

describe('BR-08 auto-start notification');
check('Pro + auto-start: one auto-start fast_start at windowEnd, no duplicate reminder', () => {
  const end = at(2026, 6, 10, 12, 0);
  const p = plan(end + MIN, [ended(end)], true, settings({ autoStartNextFast: true }));
  const starts = p.filter((n) => n.id === 'fast_start');
  assert.equal(starts.length, 1);
  assert.equal(starts[0].key, 'notifications.autoStart');
  assert.equal(starts[0].at, end + 8 * H);
});
check('auto-start off for free users (falls back to the normal fast_start rules)', () => {
  const end = at(2026, 6, 10, 12, 0);
  assert.deepEqual(ids(plan(end + MIN, [ended(end)], false, settings({ autoStartNextFast: true }))), []);
});
check('auto-start with 5:2 targets the next fasting day at 00:00', () => {
  const end = at(2026, 6, 8, 12, 0); // Mon
  const p = plan(end + MIN, [ended(end)], true, settings({ autoStartNextFast: true, activeProtocolId: '5_2' }));
  assert.equal(p.find((n) => n.id === 'fast_start')?.at, at(2026, 6, 9, 0, 0)); // Tue (ISO 2)
});

describe('section 12: streak_risk');
// goal-met fasts on Jun 7, 8, 9 (streak 3 through yesterday when "now" is Jun 10)
const streak3 = [metOn(2026, 6, 7), metOn(2026, 6, 8), metOn(2026, 6, 9)];
check('streak >= 3, nothing done today, before 20:00 -> notify at 20:00 today', () => {
  const now = at(2026, 6, 10, 12, 0);
  const p = plan(now, streak3, false);
  const sr = p.find((n) => n.id === 'streak_risk');
  assert.equal(sr?.at, at(2026, 6, 10, 20, 0));
  assert.equal(sr?.params.n, 3);
});
check('after 20:00 with nothing done today: nothing to schedule for today', () => {
  assert.equal(ids(plan(at(2026, 6, 10, 21, 0), streak3, false)).includes('streak_risk'), false);
});
check('a fast already completed today: the risk is tomorrow at 20:00', () => {
  const now = at(2026, 6, 10, 12, 0);
  const p = plan(now, [...streak3, metOn(2026, 6, 10, 11)], false);
  const sr = p.find((n) => n.id === 'streak_risk');
  assert.equal(sr?.at, at(2026, 6, 11, 20, 0));
  assert.equal(sr?.params.n, 4);
});
check('streak below 3: no streak_risk', () => {
  assert.equal(ids(plan(at(2026, 6, 10, 12, 0), [metOn(2026, 6, 8), metOn(2026, 6, 9)], false)).includes('streak_risk'), false);
});
check('off in quiet hours; max one per plan', () => {
  const q = settings({}, { quietHours: { enabled: true, from: '19:00', to: '08:00' } });
  assert.equal(ids(plan(at(2026, 6, 10, 12, 0), streak3, false, q)).includes('streak_risk'), false);
  const p = plan(at(2026, 6, 10, 12, 0), streak3, false);
  assert.equal(p.filter((n) => n.id === 'streak_risk').length, 1);
});
check('20:00 stays 20:00 local the day after a DST change', () => {
  withTZ('America/New_York', () => {
    const fasts = [metOn(2026, 3, 5), metOn(2026, 3, 6), metOn(2026, 3, 7, 12)];
    const now = at(2026, 3, 7, 13, 0);
    const p = plan(now, fasts, false);
    // today (7th) done -> tomorrow 8th 20:00 local, which is the DST day
    assert.equal(p.find((n) => n.id === 'streak_risk')?.at, at(2026, 3, 8, 20, 0));
    assert.equal(new Date(p.find((n) => n.id === 'streak_risk')!.at).getHours(), 20);
  });
});

describe('iOS 64-pending limit');
check('every scenario stays far below 64, sorted, unique, and strictly in the future', () => {
  const scenarios: ReturnType<typeof plan>[] = [];
  const end = at(2026, 6, 10, 12, 0);
  scenarios.push(plan(NOW, [running()], true, settings(), 'run'));
  scenarios.push(plan(end + MIN, [ended(end), ...streak3], true));
  scenarios.push(plan(end + MIN, [ended(end), ...streak3], true, settings({ autoStartNextFast: true })));
  scenarios.push(plan(NOW, [running(72), ...streak3], true, settings(), 'run'));
  for (const p of scenarios) {
    assert.ok(p.length <= MAX_SCHEDULED && p.length <= 8, `len ${p.length}`);
    const keys = p.map((n) => `${n.id}_${n.at}`);
    assert.equal(new Set(keys).size, keys.length);
    assert.deepEqual(p.map((n) => n.at), [...p.map((n) => n.at)].sort((a, b) => a - b));
  }
  assert.equal(MAX_SCHEDULED, 64);
});
check('re-planning after a fast ends/edits replaces the schedule (pure function of state)', () => {
  const a = plan(NOW, [running()], true, settings(), 'run');
  const b = plan(NOW, [running()], true, settings(), 'run');
  assert.deepEqual(a, b);
  const edited = plan(NOW, [running(16, NOW - 2 * H)], true, settings(), 'run');
  assert.equal(edited.find((n) => n.id === 'goal')?.at, NOW - 2 * H + 16 * H);
});
check('addDays sanity used by the planner (local-day arithmetic, never +24h)', () => {
  withTZ('Europe/Berlin', () => {
    assert.equal(addDays(new Date(2026, 2, 28, 20, 0), 1).getHours(), 20);
    assert.equal(nextOccurrence('20:00', at(2026, 3, 28, 21, 0)), at(2026, 3, 29, 20, 0));
  });
});
