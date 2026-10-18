import { addDays } from 'date-fns';
import { assert, at, check, describe, H, metOn, mkFast, withTZ } from './harness';
import { computeStreaks, countingDays } from '../../src/lib/fastMath';
import { computeBadges } from '../../src/lib/badges';
import type { Fast } from '../../src/types';

/** goal-met fasts ending at noon on the given [month, day] pairs of `year`. */
const run = (year: number, days: [number, number][]) => days.map(([m, d]) => metOn(year, m, d));
/** consecutive local days starting at (y,m,d) for n days, built with addDays (never +24h). */
const consecutive = (y: number, m: number, d: number, n: number): Fast[] => {
  const out: Fast[] = [];
  for (let i = 0; i < n; i++) {
    const day = addDays(new Date(y, m - 1, d, 12), i);
    out.push(metOn(day.getFullYear(), day.getMonth() + 1, day.getDate()));
  }
  return out;
};
const today = (y: number, m: number, d: number, h = 18) => new Date(y, m - 1, d, h, 0);

describe('BR-09 streaks');
check('no fasts -> 0/0', () => {
  assert.deepEqual(computeStreaks([], true, today(2026, 6, 10)), { current: 0, longest: 0, freezesUsed: [] });
});
check('only goal-met fasts count; several fasts on one day count once', () => {
  const fasts = [
    metOn(2026, 6, 9), metOn(2026, 6, 9, 20),
    mkFast({ startAt: at(2026, 6, 10, 1), endAt: at(2026, 6, 10, 9), goalMet: false }),
  ];
  assert.equal(countingDays(fasts).size, 1);
  const s = computeStreaks(fasts, false, today(2026, 6, 10));
  assert.equal(s.current, 1); // 9th counts, 10th (not met) does not; yesterday is live
});
check('streak up to today', () => {
  const s = computeStreaks(consecutive(2026, 6, 6, 5), false, today(2026, 6, 10));
  assert.equal(s.current, 5);
  assert.equal(s.longest, 5);
});
check('streak up to yesterday stays alive while today has no fast yet', () => {
  const s = computeStreaks(consecutive(2026, 6, 5, 5), false, today(2026, 6, 10, 9));
  assert.equal(s.current, 5);
});
check('streak that ended two days ago is broken but longest is kept', () => {
  const s = computeStreaks(consecutive(2026, 6, 5, 4), false, today(2026, 6, 10));
  assert.equal(s.current, 0);
  assert.equal(s.longest, 4);
});
check('a gap breaks the streak (no freeze) and longest reports the best run', () => {
  const fasts = run(2026, [[6, 1], [6, 2], [6, 3], [6, 4], [6, 6], [6, 7]]);
  const s = computeStreaks(fasts, false, today(2026, 6, 7));
  assert.equal(s.current, 2);
  assert.equal(s.longest, 4);
});

describe('BR-09 weekly freeze (Pro)');
// 2026-06-08 is a Monday.
check('freeze bridges a single missed day', () => {
  const fasts = run(2026, [[6, 8], [6, 9], [6, 11], [6, 12]]); // Wed 10th missed
  const s = computeStreaks(fasts, true, today(2026, 6, 12));
  assert.equal(s.current, 4);
  assert.deepEqual(s.freezesUsed, ['2026-06-10']);
  assert.equal(computeStreaks(fasts, false, today(2026, 6, 12)).current, 2); // free users: broken
});
check('only one freeze per calendar week (Mon-start)', () => {
  const fasts = run(2026, [[6, 8], [6, 10], [6, 12]]); // Tue 9th and Thu 11th missed, same week
  const s = computeStreaks(fasts, true, today(2026, 6, 12));
  assert.deepEqual(s.freezesUsed, ['2026-06-09']);
  assert.equal(s.current, 1); // second gap in the week breaks it
});
check('a new week gets a new freeze (Sun and the next Wed are in different weeks)', () => {
  // Sat 6th, Mon 8th (Sun 7th missed -> week of Jun 1), Tue 9th, Thu 11th (Wed 10th missed -> week of Jun 8)
  const fasts = run(2026, [[6, 6], [6, 8], [6, 9], [6, 11]]);
  const s = computeStreaks(fasts, true, today(2026, 6, 11));
  assert.deepEqual(s.freezesUsed, ['2026-06-07', '2026-06-10']);
  assert.equal(s.current, 4);
});
check('two consecutive missed days are never bridged', () => {
  const fasts = run(2026, [[6, 8], [6, 11], [6, 12]]);
  const s = computeStreaks(fasts, true, today(2026, 6, 12));
  assert.equal(s.current, 2);
  assert.deepEqual(s.freezesUsed, []);
});
check('freeze cannot rescue a missed day that is not followed by a counting day', () => {
  const fasts = run(2026, [[6, 8], [6, 9]]);
  const s = computeStreaks(fasts, true, today(2026, 6, 11, 9)); // 10th missed, today (11th) nothing yet
  assert.equal(s.current, 0);
});
check('freezes show up as the calendar snowflake list', () => {
  const fasts = run(2026, [[6, 8], [6, 10]]);
  assert.deepEqual(computeStreaks(fasts, true, today(2026, 6, 10)).freezesUsed, ['2026-06-09']);
});

describe('BR-09 month / year boundaries (addDays semantics)');
check('month end: Jan 30 - Feb 2', () => {
  const s = computeStreaks(consecutive(2026, 1, 30, 4), false, today(2026, 2, 2));
  assert.equal(s.current, 4);
});
check('non-leap February -> March', () => {
  const s = computeStreaks(consecutive(2026, 2, 26, 5), false, today(2026, 3, 2)); // 26,27,28,Mar1,Mar2
  assert.equal(s.current, 5);
});
check('leap day 2028-02-29', () => {
  const s = computeStreaks(consecutive(2028, 2, 27, 4), false, today(2028, 3, 1)); // 27,28,29,Mar1
  assert.equal(s.current, 4);
});
check('year end', () => {
  const s = computeStreaks(consecutive(2026, 12, 30, 4), false, today(2027, 1, 2));
  assert.equal(s.current, 4);
});
check('freeze across a month boundary', () => {
  const fasts = run(2026, [[7, 30], [8, 1]]); // Jul 31 missed (Fri), Aug 1 Sat
  const s = computeStreaks(fasts, true, today(2026, 8, 1));
  assert.equal(s.current, 2);
  assert.deepEqual(s.freezesUsed, ['2026-07-31']);
});

describe('BR-09 DST and zones');
const zones: [string, number, number, number][] = [
  ['America/New_York', 2026, 3, 6], // spring forward Sun 8 Mar
  ['America/New_York', 2026, 10, 30], // fall back Sun 1 Nov
  ['Europe/Berlin', 2026, 3, 27], // Sun 29 Mar
  ['Europe/Berlin', 2026, 10, 24], // Sun 25 Oct
  ['Australia/Sydney', 2026, 10, 2], // Sun 4 Oct (southern hemisphere)
  ['America/Santiago', 2026, 9, 4], // 00:00 does not exist on 6 Sep
  ['Asia/Kolkata', 2026, 3, 6],
];
for (const [tz, y, m, d] of zones) {
  check(`6-day streak across a clock change in ${tz} from ${y}-${m}-${d}`, () => {
    withTZ(tz, () => {
      const fasts = consecutive(y, m, d, 6);
      const last = addDays(new Date(y, m - 1, d, 18), 5);
      const s = computeStreaks(fasts, false, last);
      assert.equal(s.current, 6, `${tz}: ${JSON.stringify(s)}`);
      assert.equal(s.longest, 6);
    });
  });
}
check('the day after a missed day across DST still resets without freeze, bridges with freeze', () => {
  withTZ('America/New_York', () => {
    const fasts = run(2026, [[3, 7], [3, 9]]); // Sun 8th (DST day) missed
    assert.equal(computeStreaks(fasts, false, today(2026, 3, 9)).current, 1);
    const s = computeStreaks(fasts, true, today(2026, 3, 9));
    assert.equal(s.current, 2);
    assert.deepEqual(s.freezesUsed, ['2026-03-08']);
  });
});
check('a fast ending 23:59 vs 00:01 lands on different days in the device zone', () => {
  withTZ('Europe/Berlin', () => {
    const a = mkFast({ startAt: at(2026, 6, 1, 7), endAt: at(2026, 6, 1, 23, 59), goalMet: true });
    const b = mkFast({ startAt: at(2026, 6, 1, 8), endAt: at(2026, 6, 2, 0, 1), goalMet: true });
    assert.equal(countingDays([a]).has('2026-06-01'), true);
    assert.equal(countingDays([b]).has('2026-06-02'), true);
    assert.equal(computeStreaks([a, b], false, today(2026, 6, 2)).current, 2);
  });
});
check('same data in two zones: streak only depends on local days', () => {
  const fasts = consecutive(2026, 6, 1, 3);
  const a = withTZ('Pacific/Auckland', () => computeStreaks(consecutive(2026, 6, 1, 3), false, today(2026, 6, 3)).current);
  const b = withTZ('Pacific/Honolulu', () => computeStreaks(consecutive(2026, 6, 1, 3), false, today(2026, 6, 3)).current);
  assert.equal(a, 3);
  assert.equal(b, 3);
  assert.equal(fasts.length, 3);
});
check('long history (3 years of daily fasts) is fast and exact', () => {
  const t0 = Date.now();
  const fasts = consecutive(2023, 1, 1, 365 * 3);
  const s = computeStreaks(fasts, true, addDays(new Date(2023, 0, 1, 18), 365 * 3 - 1));
  assert.equal(s.current, 365 * 3);
  assert.ok(Date.now() - t0 < 1500);
});

describe('FR-21 badges');
check('first fast, streak badges use the longest streak, hours and 20h badges', () => {
  const none = computeBadges([], false, today(2026, 6, 10));
  assert.ok(none.every((b) => !b.earned));
  const fasts = consecutive(2026, 6, 1, 7); // each 16h => 112h total, 7-day streak
  const b = Object.fromEntries(computeBadges(fasts, false, today(2026, 6, 7)).map((x) => [x.id, x.earned]));
  assert.deepEqual(b, { firstFast: true, streak3: true, streak7: true, streak30: false, hours100: true, first20h: false });
  const long = mkFast({ startAt: at(2026, 6, 1, 0), endAt: at(2026, 6, 1, 0) + 20 * H, goalMet: true });
  assert.equal(computeBadges([long], false, today(2026, 6, 2)).find((x) => x.id === 'first20h')?.earned, true);
  const almost = mkFast({ startAt: at(2026, 6, 1, 0), endAt: at(2026, 6, 1, 0) + 20 * H - 1, goalMet: true });
  assert.equal(computeBadges([almost], false, today(2026, 6, 2)).find((x) => x.id === 'first20h')?.earned, false);
});
check('a broken streak keeps the badge earned (longest, not current)', () => {
  const fasts = consecutive(2026, 5, 1, 7);
  const b = computeBadges(fasts, false, today(2026, 6, 20));
  assert.equal(b.find((x) => x.id === 'streak7')?.earned, true);
  assert.equal(computeStreaks(fasts, false, today(2026, 6, 20)).current, 0);
});
