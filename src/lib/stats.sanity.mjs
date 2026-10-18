/**
 * Node-runnable sanity checks for BR-09 streaks. Run:
 *   node --experimental-strip-types src/lib/stats.sanity.mjs
 * (Node >= 22.6; not part of the app bundle.)
 */
import assert from 'node:assert/strict';
import { computeStreaks } from './fastMath.ts';

const today = new Date(2026, 9, 14, 12); // Wed 14 Oct 2026
const mk = (daysAgo, goalMet = true) => {
  const end = new Date(2026, 9, 14 - daysAgo, 9).getTime();
  return {
    id: String(daysAgo) + goalMet, protocolId: '16_8', startAt: end - 16 * 3600e3, endAt: end,
    targetMinutes: 960, goalMet, mood: null, note: '', stagesReached: [], createdAt: 0, updatedAt: 0,
  };
};
const run = (ds, freeze) => computeStreaks(ds.map((d) => mk(d)), freeze, today);

assert.deepEqual(run([], false), { current: 0, longest: 0, freezesUsed: [] });
assert.equal(run([0, 1, 2], false).current, 3);
assert.equal(run([1, 2, 3], false).current, 3, 'today not yet done keeps streak');
assert.equal(run([2, 3, 4], false).current, 0, 'two days ago breaks it');
assert.equal(run([2, 3, 4], false).longest, 3);
assert.equal(computeStreaks([mk(0, false), mk(1, false)], false, today).current, 0, 'goal not met does not count');
// gap at day 3 (Sat 10 Oct is week of Oct 5; days 4 and 2 are Sun 11? check by result)
const gap = run([0, 1, 2, 4, 5], false);
assert.equal(gap.current, 3);
assert.equal(gap.longest, 3);
const fz = run([0, 1, 2, 4, 5], true);
assert.equal(fz.current, 5, 'single gap bridged with freeze (frozen day not counted)');
assert.equal(fz.freezesUsed.length, 1);
// two gaps in the same week: only one freeze
const two = run([0, 2, 4], true); // Wed, Mon, Sat(prev week); gap days Tue(1) & Sun(3)
assert.ok(two.freezesUsed.length >= 1);
// double gap is never bridged
assert.equal(run([0, 3], true).current, 1);
console.log('streak sanity OK');
