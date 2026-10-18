import { assert, check, describe, D } from './harness';
import { WEEK_MS, graceLapsed, inGrace, isEntitled, mockProAllowed, msUntilLapse } from '../../src/lib/entitlement';

const NOW = 1_800_000_000_000;

describe('FR-25 entitlement / offline grace (spec 16.8)');
check('free state is never Pro, whatever expiresAt says', () => {
  assert.equal(isEntitled({ isPro: false, expiresAt: NOW + D }, NOW, false), false);
  assert.equal(isEntitled({ isPro: false, expiresAt: null }, NOW, false), false);
});
check('lifetime (expiresAt null) never lapses', () => {
  assert.equal(isEntitled({ isPro: true, expiresAt: null }, NOW + 50 * 365 * D, false), true);
  assert.equal(msUntilLapse({ isPro: true, expiresAt: null }, NOW, false), null);
});
check('active subscription before expiry', () => {
  assert.equal(isEntitled({ isPro: true, expiresAt: NOW + D }, NOW, false), true);
});
check('cached Pro is trusted for exactly 7 days past expiry, then lapses (AC-09)', () => {
  const exp = NOW - 3 * D;
  const s = { isPro: true, expiresAt: exp };
  assert.equal(isEntitled(s, exp, false), true);
  assert.equal(isEntitled(s, exp + WEEK_MS, false), true); // boundary inclusive
  assert.equal(isEntitled(s, exp + WEEK_MS + 1, false), false);
  assert.equal(inGrace(s, NOW), true);
  assert.equal(inGrace(s, exp + WEEK_MS + 1), false);
  assert.equal(inGrace({ isPro: true, expiresAt: NOW + D }, NOW), false);
});
check('msUntilLapse tells the hook when to re-render', () => {
  assert.equal(msUntilLapse({ isPro: true, expiresAt: NOW }, NOW, false), WEEK_MS);
  assert.equal(msUntilLapse({ isPro: true, expiresAt: NOW - 8 * D }, NOW, false), 0);
  assert.equal(msUntilLapse({ isPro: false, expiresAt: NOW }, NOW, false), null);
});
check('mockPro is honoured only when mock Pro is allowed (dev build / forced mock purchases)', () => {
  const s = { isPro: false, expiresAt: null, mockPro: true };
  assert.equal(isEntitled(s, NOW, false), false); // release build with a stale persisted flag
  assert.equal(isEntitled(s, NOW, true), true);
  const g = globalThis as { __DEV__?: boolean };
  const prevDev = g.__DEV__;
  const prevEnv = process.env.EXPO_PUBLIC_USE_MOCK_PURCHASES;
  try {
    g.__DEV__ = false;
    delete process.env.EXPO_PUBLIC_USE_MOCK_PURCHASES;
    assert.equal(mockProAllowed(), false);
    g.__DEV__ = true;
    assert.equal(mockProAllowed(), true);
    g.__DEV__ = false;
    process.env.EXPO_PUBLIC_USE_MOCK_PURCHASES = '1';
    assert.equal(mockProAllowed(), true);
  } finally {
    g.__DEV__ = prevDev;
    if (prevEnv === undefined) delete process.env.EXPO_PUBLIC_USE_MOCK_PURCHASES; else process.env.EXPO_PUBLIC_USE_MOCK_PURCHASES = prevEnv;
  }
});

describe('spec 16.8 grace-lapsed banner');
check('graceLapsed is true only after the 7-day grace on an expiring cached Pro', () => {
  const exp = NOW - 10 * D;
  assert.equal(graceLapsed({ isPro: true, expiresAt: exp }, exp + WEEK_MS, false), false); // boundary still entitled
  assert.equal(graceLapsed({ isPro: true, expiresAt: exp }, exp + WEEK_MS + 1, false), true);
  assert.equal(graceLapsed({ isPro: true, expiresAt: NOW + D }, NOW, false), false);
  assert.equal(graceLapsed({ isPro: true, expiresAt: null }, NOW + 900 * D, false), false); // lifetime
  assert.equal(graceLapsed({ isPro: false, expiresAt: exp }, NOW, false), false); // already free
  assert.equal(graceLapsed({ isPro: true, expiresAt: exp, mockPro: true }, NOW, true), false);
});
