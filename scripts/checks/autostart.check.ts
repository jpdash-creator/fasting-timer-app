import { assert, at, check, describe, H, MIN, withTZ } from './harness';
import {
  MAX_LATE_MS, decideAutoStart, nextAutoStartAt, nextFastingDayStart, type AutoStartInput,
} from '../../src/lib/autoStartDecision';

const p168 = { fastingMinutes: 960 };
const p52 = { fastingMinutes: 1440, weeklyPattern: { fastingDays: [2, 5] } };
const end = at(2026, 6, 10, 12, 0); // Wed
const base: Omit<AutoStartInput, 'now'> = {
  enabled: true, pro: true, hasActiveFast: false, lastEndAt: end, lastEatingMinutes: 480, next: p168,
};

describe('BR-08 auto-start decision');
check('waits until windowEnd, then starts exactly at windowEnd (not at "now")', () => {
  assert.deepEqual(decideAutoStart({ ...base, now: end + 2 * H }), { kind: 'wait', at: end + 8 * H });
  assert.deepEqual(decideAutoStart({ ...base, now: end + 8 * H }), { kind: 'start', startAt: end + 8 * H });
  assert.deepEqual(decideAutoStart({ ...base, now: end + 10 * H }), { kind: 'start', startAt: end + 8 * H });
});
check('guards: disabled, not Pro, a fast is running, no previous fast', () => {
  const now = end + 9 * H;
  assert.equal(decideAutoStart({ ...base, now, enabled: false }).kind, 'none');
  assert.equal(decideAutoStart({ ...base, now, pro: false }).kind, 'none');
  assert.equal(decideAutoStart({ ...base, now, hasActiveFast: true }).kind, 'none');
  assert.equal(decideAutoStart({ ...base, now, lastEndAt: null }).kind, 'none');
});
check('stale: more than 12 h late, or later than the fast\'s own length, does not back-date', () => {
  const start = end + 8 * H;
  assert.equal(decideAutoStart({ ...base, now: start + MAX_LATE_MS }).kind, 'start');
  assert.equal(decideAutoStart({ ...base, now: start + MAX_LATE_MS + 1 }).kind, 'none');
  const short = { ...base, next: { fastingMinutes: 120 } };
  assert.equal(decideAutoStart({ ...short, now: start + 2 * H }).kind, 'none'); // would already be over
  assert.equal(decideAutoStart({ ...short, now: start + 2 * H - MIN }).kind, 'start');
});
check('never starts twice for the same ended fast, and never over an overlapping fast', () => {
  const now = end + 9 * H;
  assert.equal(decideAutoStart({ ...base, now, handledEndAt: end }).kind, 'none');
  assert.equal(decideAutoStart({ ...base, now, handledEndAt: end - 1 }).kind, 'start');
  assert.equal(decideAutoStart({ ...base, now, overlaps: () => true }).kind, 'none');
});
check('protocols without an eating window (36 h, 5:2 last) have no automatic next start', () => {
  assert.equal(decideAutoStart({ ...base, lastEatingMinutes: 0, now: end + 30 * H }).kind, 'none');
});
check('5:2: next fast starts at 00:00 of the next fasting weekday (Tue=2, Fri=5)', () => {
  assert.equal(nextAutoStartAt(end, 480, p52), at(2026, 6, 12, 0, 0)); // Wed 20:00 -> Fri
  assert.equal(nextAutoStartAt(at(2026, 6, 12, 12, 0), 0, p52), at(2026, 6, 16, 0, 0)); // Fri -> next Tue
  assert.equal(nextAutoStartAt(at(2026, 6, 14, 12, 0), 480, p52), at(2026, 6, 16, 0, 0)); // Sun -> Tue
});
check('nextFastingDayStart: ISO weekday mapping incl. Sunday=7, empty list, exact-midnight boundary', () => {
  assert.equal(nextFastingDayStart(at(2026, 6, 10, 12), [7]), at(2026, 6, 14, 0, 0)); // Sunday
  assert.equal(nextFastingDayStart(at(2026, 6, 10, 12), []), null);
  assert.equal(nextFastingDayStart(at(2026, 6, 15, 0, 0), [1]), at(2026, 6, 15, 0, 0)); // Monday 00:00 itself
  assert.equal(nextFastingDayStart(at(2026, 6, 15, 0, 1), [1]), at(2026, 6, 22, 0, 0));
});
check('5:2 start stays at local midnight across DST (no +24h arithmetic)', () => {
  withTZ('America/New_York', () => {
    // Fri 6 Mar 2026 12:00 -> next Tuesday 10 Mar 00:00 EDT (DST began 8 Mar)
    assert.equal(nextAutoStartAt(at(2026, 3, 6, 12), 480, p52), at(2026, 3, 10, 0, 0));
    const d = new Date(nextAutoStartAt(at(2026, 3, 6, 12), 480, p52) as number);
    assert.equal(d.getHours(), 0);
  });
  withTZ('Europe/Berlin', () => {
    const d = new Date(nextAutoStartAt(at(2026, 3, 27, 12), 480, p52) as number); // Fri -> Tue 31 Mar
    assert.equal(d.getDate(), 31);
    assert.equal(d.getHours(), 0);
  });
});
check('window length arithmetic is real elapsed time (8h window across the spring-forward gap)', () => {
  withTZ('America/New_York', () => {
    const e = at(2026, 3, 7, 22, 0); // Sat 22:00 EST; +8h of real time = Sun 07:00 EDT
    assert.equal(nextAutoStartAt(e, 480, p168), e + 8 * H);
  });
});
