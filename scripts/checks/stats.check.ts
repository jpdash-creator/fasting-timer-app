import { assert, at, check, describe, D, H, mkFast, withTZ } from './harness';
import { weeklyInsight } from '../../src/lib/insights';
import {
  calendarMarks, computeTotals, fastsByWeekday, filterFasts, groupByWeek, hoursPerDay, movingAverage, niceAxis,
} from '../../src/lib/stats';
import { displayToMl, fmtVolume, mlToDisplay, QUICK_ML, QUICK_OZ, todaysWater, totalMl } from '../../src/lib/statsWater';
import {
  displayToKg, fmtWeight, inRange, kgToDisplay, parseWeightInput, weightMovingAverage,
} from '../../src/lib/statsWeight';
import type { ProtocolId } from '../../src/types';

const NOW = at(2026, 6, 20, 12); // Saturday
/** completed fast ending `daysAgo` days before NOW at 08:00 (via setDate, DST-safe) with a length in hours. */
function fastAgo(daysAgo: number, hours: number, o: { mood?: 1 | 2 | 3 | 4 | 5 | null; met?: boolean; proto?: ProtocolId } = {}) {
  const end = new Date(NOW);
  end.setDate(end.getDate() - daysAgo);
  end.setHours(8, 0, 0, 0);
  return mkFast({
    startAt: end.getTime() - hours * H, endAt: end.getTime(), goalMet: o.met ?? true,
    mood: o.mood ?? null, protocolId: o.proto ?? '16_8',
  });
}

describe('BR-10 weekly insight');
check('fewer than 3 fasts -> moreData; 3+ without moods -> logMood', () => {
  assert.equal(weeklyInsight([fastAgo(1, 16), fastAgo(2, 16)], NOW).tip, 'moreData');
  const i = weeklyInsight([fastAgo(1, 16), fastAgo(2, 16), fastAgo(3, 16)], NOW);
  assert.equal(i.tip, 'logMood');
  assert.equal(i.bestWeekday, null);
});
check('uses only the last 28 days (exactly 28 days back included, older excluded)', () => {
  const exact = new Date(NOW);
  exact.setDate(exact.getDate() - 28);
  const onTheLine = mkFast({ startAt: exact.getTime() - 16 * H, endAt: exact.getTime(), mood: 5 });
  const justOlder = mkFast({ startAt: exact.getTime() - 17 * H, endAt: exact.getTime() - 1, mood: 5 });
  const i = weeklyInsight([fastAgo(27, 16, { mood: 5 }), onTheLine, justOlder, fastAgo(40, 16, { mood: 5 })], NOW);
  assert.equal(i.sample, 2);
});
check('best weekday = highest average mood (ISO 1=Mon)', () => {
  // NOW is Saturday: daysAgo 5 -> Monday, 4 -> Tuesday
  const fasts = [
    fastAgo(5, 16, { mood: 5 }), fastAgo(12, 16, { mood: 5 }), // Mondays
    fastAgo(4, 16, { mood: 3 }), fastAgo(11, 16, { mood: 4 }), // Tuesdays
  ];
  const i = weeklyInsight(fasts, NOW);
  assert.equal(i.bestWeekday, 1);
  assert.equal(i.bestWeekdayMood, 5);
});
check('best protocol = highest goal-met rate with at least 2 fasts', () => {
  const fasts = [
    fastAgo(1, 16, { proto: '16_8', met: true }), fastAgo(2, 16, { proto: '16_8', met: true }),
    fastAgo(3, 18, { proto: '18_6', met: true }), // only one fast: ignored
    fastAgo(4, 20, { proto: '20_4', met: false }), fastAgo(5, 20, { proto: '20_4', met: true }),
  ];
  const i = weeklyInsight(fasts, NOW);
  assert.equal(i.bestProtocolId, '16_8');
  assert.equal(i.bestProtocolRate, 1);
});
check('tryLonger when longer fasts have clearly better mood and goal rate is high', () => {
  const fasts = [
    fastAgo(1, 20, { mood: 5 }), fastAgo(2, 20, { mood: 5 }), fastAgo(3, 20, { mood: 5 }),
    fastAgo(4, 16, { mood: 3 }), fastAgo(5, 16, { mood: 3 }), fastAgo(6, 16, { mood: 3 }),
  ];
  const i = weeklyInsight(fasts, NOW);
  assert.equal(i.moodLong, 5);
  assert.equal(i.moodShort, 3);
  assert.equal(i.tip, 'tryLonger');
});
check('tryShorter when most fasts miss the goal; keepGoing when things are fine', () => {
  const miss = [1, 2, 3, 4].map((d, i) => fastAgo(d, 10, { mood: 3, met: i === 0 }));
  assert.equal(weeklyInsight(miss, NOW).tip, 'tryShorter');
  const fine = [1, 2, 3, 4].map((d) => fastAgo(d, 16, { mood: 4, met: true }));
  assert.equal(weeklyInsight(fine, NOW).tip, 'keepGoing');
});
check('running fasts are ignored', () => {
  const running = mkFast({ startAt: NOW - 3 * H, endAt: null });
  assert.equal(weeklyInsight([running], NOW).sample, 0);
});

describe('FR-14 totals and chart helpers');
check('totals: count, hours, average, goal-met rate (running fast excluded)', () => {
  const fasts = [fastAgo(1, 16), fastAgo(2, 12, { met: false }), mkFast({ startAt: NOW - H, endAt: null })];
  const t = computeTotals(fasts);
  assert.equal(t.totalFasts, 2);
  assert.equal(t.totalHours, 28);
  assert.equal(t.avgHours, 14);
  assert.equal(t.goalRate, 0.5);
  assert.deepEqual(computeTotals([]), { totalFasts: 0, totalHours: 0, avgHours: 0, goalRate: 0 });
});
check('hoursPerDay attributes hours to the day of endAt and covers the requested window', () => {
  const pts = hoursPerDay([fastAgo(0, 10), fastAgo(2, 16)], 7, new Date(NOW));
  assert.equal(pts.length, 7);
  assert.equal(pts[6].hours, 10);
  assert.equal(pts[4].hours, 16);
  assert.equal(pts.reduce((a, p) => a + p.hours, 0), 26);
  assert.equal(pts[0].key, '2026-06-14');
});
check('hoursPerDay window is calendar days across DST (no duplicated/skipped day)', () => {
  withTZ('America/New_York', () => {
    const now = new Date(2026, 2, 10, 12);
    const keys = hoursPerDay([], 5, now).map((p) => p.key);
    assert.deepEqual(keys, ['2026-03-06', '2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
  });
});
check('fastsByWeekday counts by ISO weekday of endAt (index 0 = Monday)', () => {
  const w = fastsByWeekday([fastAgo(5, 16), fastAgo(12, 16), fastAgo(0, 16)]); // Mon, Mon, Sat
  assert.deepEqual(w, [2, 0, 0, 0, 0, 1, 0]);
});
check('groupByWeek groups newest-first by Monday-start week', () => {
  const g = groupByWeek([fastAgo(0, 16), fastAgo(1, 16), fastAgo(7, 16)]); // Sat, Fri, prev Sat
  assert.equal(g.length, 2);
  assert.equal(g[0].fasts.length, 2);
  assert.equal(new Date(g[0].weekStart).getDay(), 1);
});
check('filterFasts by protocol and note search (case-insensitive)', () => {
  const a = { ...fastAgo(1, 16), note: 'Felt GREAT' };
  const b = { ...fastAgo(2, 18, { proto: '18_6' }), note: 'tired' };
  assert.deepEqual(filterFasts([a, b], '18_6', '').map((f) => f.id), [b.id]);
  assert.deepEqual(filterFasts([a, b], null, 'great').map((f) => f.id), [a.id]);
  assert.equal(filterFasts([a, b], null, '  ').length, 2);
});
check('calendarMarks: dot per day, goalMet when any fast that day met the goal', () => {
  const m = calendarMarks([fastAgo(1, 16, { met: false }), fastAgo(1, 16, { met: true }), fastAgo(3, 16, { met: false })]);
  assert.equal(m.size, 2);
  assert.deepEqual(m.get('2026-06-19'), { fasts: 2, goalMet: true });
  assert.deepEqual(m.get('2026-06-17'), { fasts: 1, goalMet: false });
});
check('movingAverage and niceAxis sanity', () => {
  assert.deepEqual(movingAverage([2, 4, 6], 2), [2, 3, 5]);
  const a = niceAxis(0, 13);
  assert.ok(a.hi >= 13 && a.lo === 0 && a.sections >= 3 && a.sections <= 5, JSON.stringify(a));
  const w = niceAxis(68.2, 71.9, { zeroBased: false, minSections: 2, maxSections: 4 });
  assert.ok(w.lo <= 68.2 && w.hi >= 71.9, JSON.stringify(w));
});

describe('BR-11 water');
check('unit conversion ml <-> oz and quick-add amounts (250/500/750 ml, 8/16/24 oz)', () => {
  assert.deepEqual(QUICK_ML, [250, 500, 750]);
  assert.deepEqual(QUICK_OZ, [8, 16, 24]);
  assert.equal(mlToDisplay(500, 'ml'), 500);
  assert.ok(Math.abs(mlToDisplay(500, 'oz') - 16.907) < 0.01);
  assert.equal(Math.round(displayToMl(8, 'oz')), 237);
  assert.equal(fmtVolume(2000, 'oz'), '68');
  for (const ml of [250, 500, 750, 2000]) assert.ok(Math.abs(displayToMl(mlToDisplay(ml, 'oz'), 'oz') - ml) < 1e-9);
});
check('daily total resets at local midnight (23:59:59.999 yesterday vs 00:00:00 today)', () => {
  withTZ('Europe/Berlin', () => {
    const now = at(2026, 6, 10, 15);
    const entries = [
      { id: 'a', at: at(2026, 6, 9, 23, 59) + 59_999, ml: 250 },
      { id: 'b', at: at(2026, 6, 10, 0, 0), ml: 500 },
      { id: 'c', at: at(2026, 6, 10, 14, 0), ml: 750 },
    ];
    assert.equal(totalMl(todaysWater(entries, now)), 1250);
  });
});
check('daily total on a DST day (23h / 25h long) still covers the whole local day', () => {
  withTZ('America/New_York', () => {
    for (const [m, d] of [[3, 8], [11, 1]]) {
      const entries = [
        { id: 'x', at: at(2026, m, d, 0, 0), ml: 100 },
        { id: 'y', at: at(2026, m, d, 23, 59), ml: 200 },
        { id: 'z', at: at(2026, m, d + 1, 0, 0), ml: 400 },
        { id: 'w', at: at(2026, m, d - 1, 23, 59), ml: 800 },
      ];
      assert.equal(totalMl(todaysWater(entries, at(2026, m, d, 12))), 300, `${m}/${d}`);
    }
  });
});

describe('BR-12 weight');
check('kg <-> lb conversion, 1-decimal display', () => {
  assert.equal(fmtWeight(70, 'kg'), '70.0');
  assert.equal(fmtWeight(70, 'lb'), '154.3');
  assert.ok(Math.abs(displayToKg(kgToDisplay(81.37, 'lb'), 'lb') - 81.37) < 1e-9);
});
check('entering a lb value stores kg and shows the same value back (no 0.1 drift)', () => {
  for (let tenth = 800; tenth <= 6000; tenth++) {
    const lb = tenth / 10;
    const kg = parseWeightInput(String(lb), 'lb');
    assert.ok(kg !== null);
    assert.equal(fmtWeight(kg as number, 'lb'), lb.toFixed(1), `lb=${lb}`);
  }
});
check('parseWeightInput: comma decimals, junk, and sane limits', () => {
  assert.equal(parseWeightInput('70,5', 'kg'), 70.5);
  assert.equal(parseWeightInput('abc', 'kg'), null);
  assert.equal(parseWeightInput('', 'kg'), null);
  assert.equal(parseWeightInput('19.9', 'kg'), null);
  assert.equal(parseWeightInput('500.1', 'kg'), null);
  assert.equal(parseWeightInput('20', 'kg'), 20);
});
check('range filter 7 / 30 / 90 days and 7-day trailing moving average', () => {
  const now = at(2026, 6, 20, 12);
  const mk = (daysAgo: number, kg: number) => ({ id: String(daysAgo), at: now - daysAgo * D, kg });
  const entries = [mk(100, 90), mk(60, 85), mk(20, 82), mk(5, 80), mk(1, 79)];
  assert.equal(inRange(entries, 7, now).length, 2);
  assert.equal(inRange(entries, 30, now).length, 3);
  assert.equal(inRange(entries, 90, now).length, 4);
  const avg = weightMovingAverage([mk(2, 80), mk(1, 82), mk(0, 84)]);
  assert.deepEqual(avg.map((v) => Math.round(v * 100) / 100), [80, 81, 82]);
  const gap = weightMovingAverage([mk(10, 100), mk(0, 80)]); // older than 7d drops out
  assert.equal(gap[1], 80);
});
