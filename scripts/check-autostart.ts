// @ts-nocheck - run with: npx tsx scripts/check-autostart.ts
import assert from 'node:assert/strict';
import { decideAutoStart, nextAutoStartAt, nextFastingDayStart, MAX_LATE_MS } from '../src/lib/autoStartDecision';

const H = 3_600_000;
const t0 = new Date(2026, 0, 6, 12, 0).getTime(); // Tue 6 Jan 2026 12:00 local
const p168 = { fastingMinutes: 960 };
const p52 = { fastingMinutes: 1440, weeklyPattern: { fastingDays: [2, 5] } };
const base = { enabled: true, pro: true, hasActiveFast: false, lastEndAt: t0, lastEatingMinutes: 480, next: p168 };

assert.equal(nextAutoStartAt(t0, 480, p168), t0 + 8 * H);
assert.equal(nextAutoStartAt(t0, 0, p168), null); // 36h / 5:2 last fast, no window
assert.deepEqual(decideAutoStart({ ...base, now: t0 + 2 * H }), { kind: 'wait', at: t0 + 8 * H });
assert.deepEqual(decideAutoStart({ ...base, now: t0 + 8 * H }), { kind: 'start', startAt: t0 + 8 * H });
assert.deepEqual(decideAutoStart({ ...base, now: t0 + 10 * H }), { kind: 'start', startAt: t0 + 8 * H });
assert.equal(decideAutoStart({ ...base, now: t0 + 8 * H + MAX_LATE_MS + 1 }).kind, 'none'); // stale
assert.equal(decideAutoStart({ ...base, enabled: false, now: t0 + 9 * H }).kind, 'none');
assert.equal(decideAutoStart({ ...base, pro: false, now: t0 + 9 * H }).kind, 'none');
assert.equal(decideAutoStart({ ...base, hasActiveFast: true, now: t0 + 9 * H }).kind, 'none');
assert.equal(decideAutoStart({ ...base, lastEndAt: null, now: t0 + 9 * H }).kind, 'none');
assert.equal(decideAutoStart({ ...base, now: t0 + 9 * H, handledEndAt: t0 }).reason, 'handled');
assert.equal(decideAutoStart({ ...base, now: t0 + 9 * H, overlaps: () => true }).reason, 'overlap');
// OMAD-like short fast target: never back-date past the target
assert.equal(decideAutoStart({ ...base, next: { fastingMinutes: 120 }, now: t0 + 11 * H }).reason, 'stale');

// 5:2: Tue noon end -> next fasting day is Fri 00:00 (not Tue itself)
const fri = new Date(2026, 0, 9, 0, 0).getTime();
assert.equal(nextFastingDayStart(t0, [2, 5]), fri);
assert.equal(nextAutoStartAt(t0, 0, p52), fri);
assert.deepEqual(decideAutoStart({ ...base, lastEatingMinutes: 0, next: p52, now: fri - H }), { kind: 'wait', at: fri });
assert.deepEqual(decideAutoStart({ ...base, lastEatingMinutes: 0, next: p52, now: fri + 2 * H }), { kind: 'start', startAt: fri });
// Sunday = 7
assert.equal(new Date(nextFastingDayStart(t0, [7])).getDay(), 0);
// exact midnight is allowed
assert.equal(nextFastingDayStart(fri, [5]), fri);
console.log('autostart ok');
