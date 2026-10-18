import { assert, at, check, describe, D, H, MIN, mkFast, withTZ } from './harness';
import {
  dayKey, eatingWindowEnd, endTimeBounds, formatDuration, formatHM, isGoalMet, timerState, validateFastTimes,
} from '../../src/lib/fastMath';
import {
  PRESET_PROTOCOLS, getProtocol, isPlannedFastingDay, nextPlannedFastingDay, recommendProtocol,
} from '../../src/lib/protocols';
import { STAGES, stageAt, stagesReached } from '../../src/lib/stageData';
import { levelFor } from '../../src/lib/timerSafety';

describe('BR-01 timer maths');
check('elapsed / remaining / percent derive from timestamps only', () => {
  const f = { startAt: 1_000_000, targetMinutes: 960 };
  const s = timerState(f, f.startAt + 4 * H);
  assert.equal(s.elapsedMs, 4 * H);
  assert.equal(s.remainingMs, 12 * H);
  assert.equal(s.percent, 0.25);
  assert.equal(s.overMs, 0);
  assert.equal(s.clockSkew, false);
});
check('percent caps at 1, remaining at 0, over counts past the goal (+HH:MM over goal)', () => {
  const f = { startAt: 0, targetMinutes: 600 };
  const s = timerState(f, 10 * H + 61 * 1000);
  assert.equal(s.percent, 1);
  assert.equal(s.remainingMs, 0);
  assert.equal(s.overMs, 61_000);
  assert.equal(formatDuration(s.overMs, false), '00:01'); // AC-05 "+00:01 over goal"
});
check('device clock moved backwards: elapsed clamps to 0 and skew flag is set (spec 16.2)', () => {
  const s = timerState({ startAt: 10 * H, targetMinutes: 960 }, 9 * H);
  assert.equal(s.elapsedMs, 0);
  assert.equal(s.clockSkew, true);
  assert.equal(s.percent, 0);
});
check('a restart changes nothing: same inputs give the same output (AC-02/FR-05)', () => {
  const f = { startAt: at(2026, 3, 1, 20), targetMinutes: 960 };
  const now = f.startAt + 10 * MIN;
  assert.deepEqual(timerState(f, now), timerState(f, now));
  assert.ok(timerState(f, now).elapsedMs >= 10 * MIN);
});
check('time-zone change during a fast does not change elapsed (AC-14)', () => {
  const start = Date.UTC(2026, 0, 10, 20, 0);
  const now = start + 9 * H;
  const a = withTZ('America/New_York', () => timerState({ startAt: start, targetMinutes: 960 }, now));
  const b = withTZ('Asia/Kolkata', () => timerState({ startAt: start, targetMinutes: 960 }, now));
  assert.deepEqual(a, b);
});
check('spring-forward night: elapsed is real elapsed time, not wall-clock difference', () => {
  withTZ('America/New_York', () => {
    const start = at(2026, 3, 7, 20); // Sat 20:00 EST
    const now = at(2026, 3, 8, 12); // Sun 12:00 EDT (clocks jumped 02:00 -> 03:00)
    assert.equal(timerState({ startAt: start, targetMinutes: 960 }, now).elapsedMs, 15 * H);
  });
});
check('zero/invalid target does not divide by zero', () => {
  const s = timerState({ startAt: 0, targetMinutes: 0 }, H);
  assert.equal(s.percent, 0);
});

describe('BR-02 goal tolerance');
check('goal met at exactly 98% of target, not 1 ms below', () => {
  const f = { startAt: 0, targetMinutes: 960 };
  const need = 960 * MIN * 0.98;
  assert.equal(isGoalMet(f, need), true);
  assert.equal(isGoalMet(f, need - 1), false);
});
check('goal met at / above target; not met for a short fast', () => {
  const f = { startAt: 0, targetMinutes: 960 };
  assert.equal(isGoalMet(f, 16 * H), true);
  assert.equal(isGoalMet(f, 20 * H), true);
  assert.equal(isGoalMet(f, 8 * H), false);
});
check('a few seconds early (< 2%) still counts', () => {
  assert.equal(isGoalMet({ startAt: 0, targetMinutes: 960 }, 16 * H - 30_000), true);
});

describe('BR-03 day attribution');
check('a fast belongs to the local day of endAt (crossing midnight)', () => {
  withTZ('America/New_York', () => {
    const f = mkFast({ startAt: at(2026, 5, 10, 20), endAt: at(2026, 5, 11, 12) });
    assert.equal(dayKey(f), '2026-05-11');
  });
});
check('end at 00:30 local counts for the new day, 23:59 for the old', () => {
  withTZ('Asia/Kolkata', () => {
    assert.equal(dayKey({ startAt: 0, endAt: at(2026, 5, 11, 0, 30) }), '2026-05-11');
    assert.equal(dayKey({ startAt: 0, endAt: at(2026, 5, 10, 23, 59) }), '2026-05-10');
  });
});
check('day key follows the device zone (same instant, different local day)', () => {
  const end = Date.UTC(2026, 5, 10, 23, 30); // 23:30 UTC
  assert.equal(withTZ('UTC', () => dayKey({ startAt: 0, endAt: end })), '2026-06-10');
  assert.equal(withTZ('Asia/Kolkata', () => dayKey({ startAt: 0, endAt: end })), '2026-06-11');
});
check('a running fast belongs to today', () => {
  const k = dayKey({ startAt: Date.now() - H, endAt: null });
  const d = new Date();
  const exp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  assert.equal(k, exp);
});

describe('BR-04 protocol recommendation');
const rec = recommendProtocol;
check('window <= 8h -> 16:8, <= 10h -> 14:10, else 12:12', () => {
  assert.equal(rec('12:00', '20:00', 'some'), '16_8');
  assert.equal(rec('12:00', '19:00', 'some'), '16_8');
  assert.equal(rec('12:00', '20:01', 'some'), '14_10');
  assert.equal(rec('10:00', '20:00', 'some'), '14_10');
  assert.equal(rec('10:00', '20:01', 'some'), '12_12');
  assert.equal(rec('07:00', '21:00', 'some'), '12_12');
});
check('experienced users get 18:6 whatever the window', () => {
  assert.equal(rec('12:00', '20:00', 'experienced'), '18_6');
  assert.equal(rec('07:00', '21:00', 'experienced'), '18_6');
});
check('new users never get more than 16:8', () => {
  for (const [a, b] of [['12:00', '14:00'], ['12:00', '20:00'], ['08:00', '22:00'], ['00:00', '00:00']]) {
    const id = rec(a, b, 'new');
    assert.ok(['12_12', '14_10', '16_8'].includes(id), `${a}-${b} -> ${id}`);
  }
});
check('a last meal after midnight wraps (window computed modulo 24h)', () => {
  assert.equal(rec('18:00', '01:00', 'some'), '16_8'); // 7h window
  assert.equal(rec('20:00', '20:00', 'some'), '12_12'); // 24h
});

describe('BR-05 eating window');
check('window end = actual endAt + eating minutes, even when the fast ran over goal', () => {
  const p = getProtocol('16_8', { customProtocols: [] });
  const startAt = at(2026, 1, 1, 20);
  const target = startAt + p.fastingMinutes * MIN;
  const endAt = target + 90 * MIN; // ran 90 min over
  assert.equal(eatingWindowEnd(endAt, p.eatingMinutes), endAt + 8 * H);
  assert.notEqual(eatingWindowEnd(endAt, p.eatingMinutes), target + 8 * H);
});
check('24h+ protocols have no eating window', () => {
  assert.equal(getProtocol('36H', { customProtocols: [] }).eatingMinutes, 0);
  assert.equal(getProtocol('5_2', { customProtocols: [] }).eatingMinutes, 0);
});

describe('BR-06 edit validation');
const now = at(2026, 6, 15, 12);
const prev = mkFast({ id: 'p', startAt: at(2026, 6, 14, 8), endAt: at(2026, 6, 14, 20) });
check('start must be before end', () => {
  assert.equal(validateFastTimes(now - 2 * H, now - 3 * H, [], undefined, now)?.key, 'validation.startBeforeEnd');
  assert.equal(validateFastTimes(now - 2 * H, now - 2 * H, [], undefined, now)?.key, 'validation.startBeforeEnd');
  assert.equal(validateFastTimes(now - 3 * H, now - 2 * H, [], undefined, now), null);
});
check('start and end cannot be in the future', () => {
  assert.equal(validateFastTimes(now + MIN, null, [], undefined, now)?.key, 'validation.startFuture');
  assert.equal(validateFastTimes(now - 3 * H, now + MIN, [], undefined, now)?.key, 'validation.endFuture');
});
check('duration <= 7 days (exactly 7d ok, 1 ms over rejected)', () => {
  const end = now - H;
  assert.equal(validateFastTimes(end - 7 * D, end, [], undefined, now), null);
  assert.equal(validateFastTimes(end - 7 * D - 1, end, [], undefined, now)?.key, 'validation.tooLong');
});
check('a running fast older than 7 days is rejected too', () => {
  assert.equal(validateFastTimes(now - 8 * D, null, [], undefined, now)?.key, 'validation.tooLong');
  assert.equal(validateFastTimes(now - 6 * D, null, [], undefined, now), null);
});
check('overlap with another fast is blocked with the date param (AC-04)', () => {
  const e = validateFastTimes(at(2026, 6, 14, 18), at(2026, 6, 14, 23), [prev], undefined, now);
  assert.equal(e?.key, 'validation.overlap');
  assert.ok(e?.params?.date);
});
check('containing / contained / partial overlaps all blocked; touching is allowed', () => {
  const s = prev.startAt;
  const en = prev.endAt as number;
  assert.equal(validateFastTimes(s - H, en + H, [prev], undefined, now)?.key, 'validation.overlap'); // contains
  assert.equal(validateFastTimes(s + H, en - H, [prev], undefined, now)?.key, 'validation.overlap'); // inside
  assert.equal(validateFastTimes(s - 2 * H, s + H, [prev], undefined, now)?.key, 'validation.overlap'); // leading edge
  assert.equal(validateFastTimes(en, en + 4 * H, [prev], undefined, now), null); // back to back
  assert.equal(validateFastTimes(s - 4 * H, s, [prev], undefined, now), null);
});
check('editing a fast ignores itself', () => {
  assert.equal(validateFastTimes(prev.startAt, prev.endAt, [prev], prev.id, now), null);
});
check('a running fast counts as occupied until now', () => {
  const running = mkFast({ id: 'r', startAt: now - 5 * H, endAt: null });
  assert.equal(validateFastTimes(now - 8 * H, now - 4 * H, [running], undefined, now)?.key, 'validation.overlap');
  assert.equal(validateFastTimes(now - 12 * H, now - 6 * H, [running], undefined, now), null);
});
check('backdated start overlapping the previous fast is blocked (spec 16.5)', () => {
  assert.equal(validateFastTimes((prev.endAt as number) - H, null, [prev], undefined, now)?.key, 'validation.overlap');
});

describe('stages (spec 11.3) and long-fast safety (BR-07)');
check('stage thresholds fed 0 / early 4 / fatburn 12 / ketosis 16 / deep 24', () => {
  assert.deepEqual(STAGES.map((s) => [s.id, s.startHour]), [['fed', 0], ['early', 4], ['fatburn', 12], ['ketosis', 16], ['deep', 24]]);
  assert.equal(stageAt(0).id, 'fed');
  assert.equal(stageAt(4 * H - 1).id, 'fed');
  assert.equal(stageAt(4 * H).id, 'early');
  assert.equal(stageAt(12 * H).id, 'fatburn');
  assert.equal(stageAt(16 * H).id, 'ketosis');
  assert.equal(stageAt(24 * H).id, 'deep');
  assert.equal(stageAt(-5).id, 'fed');
  assert.deepEqual(stagesReached(13 * H), ['fed', 'early', 'fatburn']);
});
check('safety sheet levels at 24 / 48 / 72 h', () => {
  assert.equal(levelFor(23.99 * H), 0);
  assert.equal(levelFor(24 * H), 24);
  assert.equal(levelFor(48 * H), 48);
  assert.equal(levelFor(72 * H), 72);
  assert.equal(levelFor(200 * H), 72);
});

describe('FR-01 / FR-02 protocols');
check('presets match the spec and only 16:8 is free', () => {
  const m = Object.fromEntries(PRESET_PROTOCOLS.map((p) => [p.id, [p.fastingMinutes / 60, p.eatingMinutes / 60]]));
  assert.deepEqual(m, {
    '12_12': [12, 12], '14_10': [14, 10], '16_8': [16, 8], '18_6': [18, 6], '20_4': [20, 4],
    OMAD: [23, 1], '5_2': [24, 0], '36H': [36, 0],
  });
  assert.deepEqual(PRESET_PROTOCOLS.filter((p) => !p.proOnly).map((p) => p.id), ['16_8']);
  assert.deepEqual(PRESET_PROTOCOLS.find((p) => p.id === '5_2')?.weeklyPattern, { fastingDays: [2, 5] });
});
check('unknown protocol id falls back to 16:8; custom ids resolve', () => {
  assert.equal(getProtocol('custom_zzz', { customProtocols: [] }).id, '16_8');
  const c = { id: 'custom_a' as const, name: 'x', fastingMinutes: 600, eatingMinutes: 840, isCustom: true, color: '#fff' };
  assert.equal(getProtocol('custom_a', { customProtocols: [c] }).fastingMinutes, 600);
});

check('5:2 planned fasting days (ISO Tue/Fri) and next-day lookup (spec 16.11)', () => {
  const p = PRESET_PROTOCOLS.find((x) => x.id === '5_2')!;
  assert.equal(isPlannedFastingDay(p, new Date(2026, 9, 20)), true); // Tue
  assert.equal(isPlannedFastingDay(p, new Date(2026, 9, 23)), true); // Fri
  assert.equal(isPlannedFastingDay(p, new Date(2026, 9, 18)), false); // Sun
  assert.equal(isPlannedFastingDay(PRESET_PROTOCOLS[2], new Date(2026, 9, 20)), false);
  assert.equal(nextPlannedFastingDay(p, new Date(2026, 9, 20))?.getDate(), 23); // strictly after Tue -> Fri
  assert.equal(nextPlannedFastingDay(p, new Date(2026, 9, 23))?.getDate(), 27); // Fri -> next Tue
  assert.equal(nextPlannedFastingDay(PRESET_PROTOCOLS[2], new Date(2026, 9, 20)), null);
  assert.equal(p.fastingMinutes, 24 * 60); // planned days default to a 24 h target
});
check('end sheet bounds never trap a fast older than 7 days (BR-06)', () => {
  const now = 100 * D;
  const fresh = endTimeBounds(now - 2 * D, now);
  assert.deepEqual(fresh, { stale: false, max: now });
  const old = endTimeBounds(now - 10 * D, now);
  assert.equal(old.stale, true);
  assert.equal(old.max, now - 3 * D); // start + 7 days
  assert.equal(validateFastTimes(now - 10 * D, old.max, [], undefined, now), null);
  assert.equal(validateFastTimes(now - 10 * D, now, [], undefined, now)?.key, 'validation.tooLong');
});

describe('formatting');
check('formatDuration / formatHM', () => {
  assert.equal(formatDuration(3_723_000), '01:02:03');
  assert.equal(formatDuration(3_723_000, false), '01:02');
  assert.equal(formatDuration(-5), '00:00:00');
  assert.equal(formatDuration(100 * H), '100:00:00');
  assert.equal(formatHM(90 * MIN), '1h 30m');
  assert.equal(formatHM(45 * MIN), '45m');
});
