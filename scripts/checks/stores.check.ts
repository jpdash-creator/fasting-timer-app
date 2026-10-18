import { assert, asyncStorageStub, at, check, describe, H, MIN, metOn, mkFast } from './harness';
import { useFastStore } from '../../src/stores/fastStore';
import { useSettingsStore, defaultSettings, mergeSettings } from '../../src/stores/settingsStore';
import { isProNow, usePurchaseStore } from '../../src/stores/purchaseStore';
import { resilient, setStorageFailureHandler } from '../../src/stores/storage';
import { maybeAutoStartNextFast } from '../../src/lib/timerAutoStart';
import { getProtocol } from '../../src/lib/protocols';

const p168 = () => getProtocol('16_8', { customProtocols: [] });
const reset = () => useFastStore.setState({ fasts: [], activeFastId: null });

describe('fastStore');
check('startFast stores timestamps only (never elapsed) and sets the target snapshot', () => {
  reset();
  const f = useFastStore.getState().startFast(p168(), 1_000);
  assert.equal(f.startAt, 1_000);
  assert.equal(f.endAt, null);
  assert.equal(f.targetMinutes, 960);
  assert.equal(f.goalMet, null);
  assert.ok(!('elapsed' in f) && !('elapsedMs' in f));
  assert.equal(useFastStore.getState().activeFastId, f.id);
});
check('a second start while one is running returns the running fast (spec 16.4)', () => {
  reset();
  const a = useFastStore.getState().startFast(p168(), 1_000);
  const b = useFastStore.getState().startFast(p168(), 2_000);
  assert.equal(b.id, a.id);
  assert.equal(useFastStore.getState().fasts.length, 1);
  const c = useFastStore.getState().addFast({ ...a, id: 'x', endAt: null } as never);
  assert.equal(c.id, a.id);
  assert.equal(useFastStore.getState().fasts.length, 1);
});
check('endFast computes goalMet with the 2% tolerance and stages reached', () => {
  reset();
  const s = useFastStore.getState();
  const f = s.startFast(p168(), 0);
  const done = useFastStore.getState().endFast(960 * MIN * 0.98) as NonNullable<ReturnType<typeof s.endFast>>;
  assert.equal(done.goalMet, true);
  assert.deepEqual(done.stagesReached, ['fed', 'early', 'fatburn']); // 15.68 h: ketosis starts at 16 h
  assert.equal(useFastStore.getState().activeFastId, null);
  assert.equal(done.id, f.id);
  const g = useFastStore.getState().startFast(p168(), 5_000_000_000);
  assert.equal(useFastStore.getState().endFast(g.startAt + 960 * MIN * 0.98 - 1)?.goalMet, false);
  assert.equal(useFastStore.getState().endFast(), null); // nothing running
});
check('editing times recomputes goalMet and stages; protocol change updates the target', () => {
  reset();
  const s = useFastStore.getState();
  s.addFast({ protocolId: '16_8', startAt: 0, endAt: 8 * H, targetMinutes: 960, goalMet: null, mood: null, note: '', stagesReached: [] });
  const id = useFastStore.getState().fasts[0].id;
  assert.equal(useFastStore.getState().fasts[0].goalMet, false);
  useFastStore.getState().updateFast(id, { endAt: 16 * H });
  assert.equal(useFastStore.getState().fasts[0].goalMet, true);
  assert.deepEqual(useFastStore.getState().fasts[0].stagesReached.slice(-1), ['ketosis']);
  useFastStore.getState().updateFast(id, { targetMinutes: 1200 });
  assert.equal(useFastStore.getState().fasts[0].goalMet, false);
});
check('switching protocol mid-fast keeps the running fast and changes only the target (FR-03)', () => {
  reset();
  const f = useFastStore.getState().startFast(p168(), 1_000);
  useFastStore.getState().setActiveTarget(getProtocol('18_6', { customProtocols: [] }));
  const cur = useFastStore.getState().fasts[0];
  assert.equal(cur.id, f.id);
  assert.equal(cur.startAt, 1_000);
  assert.equal(cur.targetMinutes, 1080);
  assert.equal(cur.protocolId, '18_6');
});
check('delete + undo (restoreFast) round-trips; clearAll empties (delete all data)', () => {
  reset();
  const s = useFastStore.getState();
  s.addFast({ protocolId: '16_8', startAt: 0, endAt: 17 * H, targetMinutes: 960, goalMet: null, mood: 3, note: 'n', stagesReached: [] });
  const f = useFastStore.getState().fasts[0];
  const removed = useFastStore.getState().deleteFast(f.id);
  assert.equal(useFastStore.getState().fasts.length, 0);
  useFastStore.getState().restoreFast(removed!);
  assert.deepEqual(useFastStore.getState().fasts[0], f);
  useFastStore.getState().clearAll();
  assert.equal(useFastStore.getState().fasts.length, 0);
  assert.equal(useFastStore.getState().activeFastId, null);
});

describe('settingsStore');
check('default paywall mode is soft (project decision) and not persisted', () => {
  assert.equal(defaultSettings.paywallMode, 'soft');
  assert.equal(mergeSettings({ paywallMode: 'hard' }).paywallMode, 'soft');
});
check('rehydrating an older/partial payload keeps saved values and fills new fields', async () => {
  await asyncStorageStub.setItem('fw.settings', JSON.stringify({
    state: { settings: { onboardingDone: true, units: { weight: 'lb' }, reminders: { fastStart: false } } }, version: 1,
  }));
  await useSettingsStore.persist.rehydrate();
  const s = useSettingsStore.getState().settings;
  assert.equal(s.onboardingDone, true);
  assert.equal(s.units.weight, 'lb');
  assert.equal(s.units.volume, 'ml');
  assert.equal(s.reminders.fastStart, false);
  assert.equal(s.reminders.windowClosingOffsetMin, 30);
  assert.deepEqual(s.reminders.quietHours, { enabled: false, from: '22:00', to: '07:00' });
  assert.equal(s.waterGoalMl, 2000);
  assert.deepEqual(s.customProtocols, []);
  assert.equal(useSettingsStore.getState().hasHydrated, true);
});
check('empty storage rehydrates to defaults; reset() restores onboarding (AC-16)', async () => {
  await asyncStorageStub.removeItem('fw.settings');
  await useSettingsStore.persist.rehydrate();
  useSettingsStore.getState().update({ onboardingDone: true, units: { weight: 'lb', volume: 'oz' } });
  useSettingsStore.getState().reset();
  const s = useSettingsStore.getState().settings;
  assert.equal(s.onboardingDone, false);
  assert.equal(s.units.weight, 'kg');
});

describe('purchaseStore / isProNow');
check('isProNow follows cached state and the 7-day grace', () => {
  const now = at(2026, 6, 10, 12);
  usePurchaseStore.getState().setState({ isPro: true, source: 'subscription', expiresAt: now - 3 * 86_400_000, billingIssue: false, lastCheckedAt: now });
  assert.equal(isProNow(now), true);
  assert.equal(isProNow(now + 5 * 86_400_000), false);
  usePurchaseStore.getState().setState({ isPro: true, source: 'lifetime', expiresAt: null, billingIssue: false, lastCheckedAt: now });
  assert.equal(isProNow(now + 900 * 86_400_000), true);
  usePurchaseStore.getState().setState({ isPro: false, source: 'none', expiresAt: null, billingIssue: false, lastCheckedAt: now });
  assert.equal(isProNow(now), false);
});
check('a persisted mockPro flag does nothing in a release build (__DEV__ false)', () => {
  usePurchaseStore.getState().setMockPro(true);
  assert.equal(isProNow(), false);
  usePurchaseStore.getState().setMockPro(false);
});

describe('BR-08 maybeAutoStartNextFast (store integration)');
check('creates the next fast at windowEnd when due, once, for Pro with auto-start on', () => {
  reset();
  const end = at(2026, 6, 10, 12);
  useFastStore.setState({ fasts: [mkFast({ id: 'prev', startAt: end - 16 * H, endAt: end, goalMet: true })], activeFastId: null });
  useSettingsStore.getState().update({ autoStartNextFast: true, activeProtocolId: '16_8' });
  usePurchaseStore.getState().setState({ isPro: true, source: 'lifetime', expiresAt: null, billingIssue: false, lastCheckedAt: 0 });

  assert.equal(maybeAutoStartNextFast(end + 2 * H), null); // window still open
  const f = maybeAutoStartNextFast(end + 9 * H);
  assert.ok(f);
  assert.equal(f?.startAt, end + 8 * H);
  assert.equal(useFastStore.getState().fasts.length, 2);
  assert.equal(maybeAutoStartNextFast(end + 9 * H), null); // already running
  usePurchaseStore.getState().setState({ isPro: false, source: 'none', expiresAt: null, billingIssue: false, lastCheckedAt: 0 });
  useSettingsStore.getState().update({ autoStartNextFast: false });
  reset();
});
check('does nothing for free users even if the flag is on', () => {
  reset();
  const end = at(2026, 6, 10, 12);
  useFastStore.setState({ fasts: [metOn(2026, 6, 10)], activeFastId: null });
  useSettingsStore.getState().update({ autoStartNextFast: true });
  assert.equal(maybeAutoStartNextFast(end + 20 * H), null);
  useSettingsStore.getState().update({ autoStartNextFast: false });
  reset();
});

describe('spec 16.7 storage write failures');
check('a failed write is retried once; if it fails again the user is told and state stays in memory', async () => {
  let calls = 0;
  let failTimes = 1;
  const base = {
    getItem: async () => null,
    removeItem: async () => {},
    setItem: async () => { calls++; if (calls <= failTimes) throw new Error('disk full'); },
  };
  const seen: string[] = [];
  setStorageFailureHandler((name) => { seen.push(name); });
  const s = resilient(base);
  await s.setItem('k', 'v'); // fails once, succeeds on retry
  assert.equal(calls, 2);
  assert.deepEqual(seen, []);
  calls = 0;
  failTimes = 5;
  await s.setItem('k2', 'v'); // fails twice -> handler, no throw
  assert.equal(calls, 2);
  assert.deepEqual(seen, ['k2']);
});
