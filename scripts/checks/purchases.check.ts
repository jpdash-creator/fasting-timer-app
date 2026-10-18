import { assert, at, check, D, describe } from './harness';
import {
  ANNUAL_TRIAL_DAYS, StoreBilling, buildPackage, derive, estimateAndroidExpiry, isoToDays, needsFinish, pickAndroidOffer,
  type BillingDeps, type Iap, type Os,
} from '../../src/services/purchases/StoreBilling';
import { PurchaseCancelledError, PurchasePendingError, type PlanPackage } from '../../src/services/purchases/PurchasesService';
import type { PurchaseState } from '../../src/types';

const NOW = at(2026, 6, 10, 12, 0);
const A = (x: unknown) => x as never; // mocks do not carry the full expo-iap shapes

/* ------------------------------------------------------------------ fixtures */
const phase = (billingPeriod: string, micros: string, formattedPrice: string, cycles = 0) => ({
  billingPeriod, billingCycleCount: cycles, formattedPrice, priceAmountMicros: micros, priceCurrencyCode: 'USD', recurrenceMode: 1,
});
const trialOffer = {
  id: 'trial', basePlanIdAndroid: 'annual', offerTokenAndroid: 'tok-trial', paymentMode: 'free-trial', type: 'introductory',
  pricingPhasesAndroid: { pricingPhaseList: [phase('P3D', '0', 'Free', 1), phase('P1Y', '39990000', '$39.99')] },
};
const baseOffer = (plan: string, period: string, micros: string, price: string, id: string | null = null) => ({
  id, basePlanIdAndroid: plan, offerTokenAndroid: `tok-${plan}`, type: 'introductory',
  pricingPhasesAndroid: { pricingPhaseList: [phase(period, micros, price)] },
});
const androidAnnual = (offers: unknown[]) => A({
  id: 'fw_pro_annual', platform: 'android', type: 'subs', displayPrice: '$39.99', price: 39.99, currency: 'USD', subscriptionOffers: offers,
});
const androidMonthly = (offers: unknown[]) => A({
  id: 'fw_pro_monthly', platform: 'android', type: 'subs', displayPrice: '$9.99', price: 9.99, currency: 'USD', subscriptionOffers: offers,
});
const iosAnnual = (extra: Record<string, unknown> = {}) => A({
  id: 'fw_pro_annual', platform: 'ios', type: 'subs', displayPrice: '$39.99', price: 39.99, currency: 'USD',
  subscriptionGroupIdIOS: 'grp1', introductoryPricePaymentModeIOS: 'empty', ...extra,
});
const lifetime = A({ id: 'fw_pro_lifetime', platform: 'android', type: 'in-app', displayPrice: '$79.99', price: 79.99, currency: 'USD' });

const androidPurchase = (productId: string, o: Record<string, unknown> = {}) => A({
  id: `tx-${productId}`, productId, purchaseState: 'purchased', transactionDate: NOW - 10 * D, isAcknowledgedAndroid: true,
  isAutoRenewing: true, autoRenewingAndroid: true, quantity: 1, store: 'play', storeId: 'play', purchaseToken: 'tok', ...o,
});
const iosPurchase = (productId: string, o: Record<string, unknown> = {}) => A({
  id: `tx-${productId}`, productId, purchaseState: 'purchased', transactionDate: NOW - 2 * D, isAutoRenewing: true, quantity: 1,
  store: 'apple', storeId: 'apple', transactionId: 'tx1', expirationDateIOS: NOW + 20 * D, ...o,
});

describe('purchases: product mapping');
check('isoToDays', () => {
  assert.equal(isoToDays('P3D'), 3);
  assert.equal(isoToDays('P1W'), 7);
  assert.equal(isoToDays('P1M'), 30);
  assert.equal(isoToDays('P1Y'), 365);
  assert.equal(isoToDays('garbage'), 0);
  assert.equal(isoToDays(null), 0);
});
check('Android annual with the free-trial offer: trial token, 3 days, recurring price shown', () => {
  const pkg = buildPackage(androidAnnual([baseOffer('annual', 'P1Y', '39990000', '$39.99'), trialOffer]), 'android') as PlanPackage;
  assert.equal(pkg.id, 'annual');
  assert.equal(pkg.trialDays, 3);
  assert.equal((pkg.native as { offerToken: string }).offerToken, 'tok-trial');
  assert.equal(pkg.priceString, '$39.99');
  assert.equal(pkg.price, 39.99);
  assert.equal(pkg.periodLabel, 'year');
  assert.ok(pkg.perMonthString?.includes('3.33'), String(pkg.perMonthString));
});
check('Android annual when the user is not trial-eligible (no trial offer): base plan token, no trial', () => {
  const pkg = buildPackage(androidAnnual([baseOffer('annual', 'P1Y', '39990000', '$39.99')]), 'android') as PlanPackage;
  assert.equal(pkg.trialDays, 0);
  assert.equal((pkg.native as { offerToken: string }).offerToken, 'tok-annual');
});
check('Android monthly never uses a trial offer even if one exists; base offer id may equal the base plan id', () => {
  const o = pickAndroidOffer(androidMonthly([trialOffer, baseOffer('monthly', 'P1M', '9990000', '$9.99', 'monthly')]), false);
  assert.equal(o.offerTokenAndroid, 'tok-monthly');
  const pkg = buildPackage(androidMonthly([trialOffer, baseOffer('monthly', 'P1M', '9990000', '$9.99')]), 'android') as PlanPackage;
  assert.equal(pkg.trialDays, 0);
  assert.equal(pkg.periodLabel, 'month');
});
check('Android: a promo offer with an extra paid intro phase is not chosen over the plain base plan', () => {
  const promo = { ...baseOffer('monthly', 'P1M', '4990000', '$4.99', 'promo'), offerTokenAndroid: 'tok-promo',
    pricingPhasesAndroid: { pricingPhaseList: [phase('P1M', '4990000', '$4.99', 3), phase('P1M', '9990000', '$9.99')] } };
  const o = pickAndroidOffer(androidMonthly([promo, baseOffer('monthly', 'P1M', '9990000', '$9.99')]), false);
  assert.equal(o.offerTokenAndroid, 'tok-monthly');
});
check('Android subscription without any purchasable offer token is skipped', () => {
  assert.equal(buildPackage(androidAnnual([{ id: null, pricingPhasesAndroid: { pricingPhaseList: [] } }]), 'android'), null);
});
check('iOS trial days from standardized subscriptionOffers (3 days) and from the legacy fields', () => {
  const std = iosAnnual({ subscriptionOffers: [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'day', value: 3 }, periodCount: 1 }] });
  assert.equal((buildPackage(std, 'ios') as PlanPackage).trialDays, 3);
  const legacyUnit = iosAnnual({ introductoryPricePaymentModeIOS: 'free-trial', introductoryPriceNumberOfPeriodsIOS: '3', introductoryPriceSubscriptionPeriodIOS: 'day' });
  assert.equal((buildPackage(legacyUnit, 'ios') as PlanPackage).trialDays, 3);
  const legacyObj = iosAnnual({ introductoryPricePaymentModeIOS: 'free-trial', introductoryPriceNumberOfPeriodsIOS: '1', introductoryPriceSubscriptionPeriodIOS: { unit: 'week', value: 1 } });
  assert.equal((buildPackage(legacyObj, 'ios') as PlanPackage).trialDays, 7);
  assert.equal((buildPackage(iosAnnual(), 'ios') as PlanPackage).trialDays, 0);
});
check('iOS: a user who already used the introductory offer sees no trial', () => {
  const std = iosAnnual({ subscriptionOffers: [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'day', value: 3 }, periodCount: 1 }] });
  assert.equal((buildPackage(std, 'ios', false) as PlanPackage).trialDays, 0);
});
check('lifetime is a non-consumable in-app product; unknown SKUs are ignored', () => {
  const pkg = buildPackage(lifetime, 'android') as PlanPackage;
  assert.equal(pkg.id, 'lifetime');
  assert.equal((pkg.native as { type: string }).type, 'in-app');
  assert.equal(pkg.periodLabel, 'once');
  assert.equal(pkg.trialDays, 0);
  assert.equal(buildPackage(A({ id: 'other', displayPrice: '$1' }), 'android'), null);
});

describe('purchases: entitlement derivation (iOS)');
const d = (list: unknown[], os: Os, now = NOW) => derive(list as never, os, now);
check('active subscription -> Pro until expirationDate; free trial detected from the offer', () => {
  const s = d([iosPurchase('fw_pro_monthly')], 'ios');
  assert.deepEqual([s.isPro, s.source, s.expiresAt, s.billingIssue], [true, 'subscription', NOW + 20 * D, false]);
  const t = d([iosPurchase('fw_pro_annual', { offerIOS: { id: '', paymentMode: 'free-trial', type: 'introductory' } })], 'ios');
  assert.equal(t.source, 'trial');
});
check('expired subscription -> not Pro (no stale Pro)', () => {
  const s = d([iosPurchase('fw_pro_monthly', { expirationDateIOS: NOW - 1 })], 'ios');
  assert.deepEqual([s.isPro, s.source, s.expiresAt], [false, 'none', null]);
});
check('billing grace period keeps Pro and raises the billing-issue banner', () => {
  const s = d([iosPurchase('fw_pro_monthly', { expirationDateIOS: NOW - D, renewalInfoIOS: { gracePeriodExpirationDate: NOW + 5 * D, isInBillingRetry: true } })], 'ios');
  assert.deepEqual([s.isPro, s.billingIssue, s.expiresAt], [true, true, NOW + 5 * D]);
  const over = d([iosPurchase('fw_pro_monthly', { expirationDateIOS: NOW - 10 * D, renewalInfoIOS: { gracePeriodExpirationDate: NOW - D } })], 'ios');
  assert.equal(over.isPro, false);
});
check('billing retry on a still-valid period flags the banner', () => {
  const s = d([iosPurchase('fw_pro_monthly', { renewalInfoIOS: { isInBillingRetry: true } })], 'ios');
  assert.deepEqual([s.isPro, s.billingIssue], [true, true]);
});
check('refunded / revoked transactions (subscription or lifetime) grant nothing', () => {
  assert.equal(d([iosPurchase('fw_pro_monthly', { revocationDateIOS: NOW - 1 })], 'ios').isPro, false);
  assert.equal(d([iosPurchase('fw_pro_lifetime', { revocationDateIOS: NOW - 1, expirationDateIOS: null })], 'ios').isPro, false);
});
check('lifetime beats any subscription; the later expiry wins between subscriptions; pending is ignored', () => {
  const l = d([iosPurchase('fw_pro_annual', { expirationDateIOS: NOW + 300 * D }), iosPurchase('fw_pro_lifetime', { expirationDateIOS: null })], 'ios');
  assert.deepEqual([l.source, l.expiresAt], ['lifetime', null]);
  const m = d([iosPurchase('fw_pro_weekly', { expirationDateIOS: NOW + 3 * D }), iosPurchase('fw_pro_monthly', { expirationDateIOS: NOW + 25 * D })], 'ios');
  assert.equal(m.expiresAt, NOW + 25 * D);
  assert.equal(d([iosPurchase('fw_pro_monthly', { purchaseState: 'pending' })], 'ios').isPro, false);
  assert.equal(d([], 'ios').isPro, false);
  assert.equal(d([iosPurchase('someone.elses.product')], 'ios').isPro, false);
});

describe('purchases: entitlement derivation (Android expiry estimation)');
check('annual: estimate = purchase anchor + 1 year (after the 3-day trial window)', () => {
  const anchor = NOW - 10 * D;
  const s = d([androidPurchase('fw_pro_annual', { transactionDate: anchor })], 'android');
  assert.deepEqual([s.isPro, s.source], [true, 'subscription']);
  assert.equal(s.expiresAt, at(2027, 5, 31, 12, 0));
});
check('annual inside the 3-day trial window: source trial, expiry = trial end', () => {
  const anchor = NOW - 1 * D;
  const s = d([androidPurchase('fw_pro_annual', { transactionDate: anchor })], 'android');
  assert.equal(s.source, 'trial');
  assert.equal(s.expiresAt, anchor + ANNUAL_TRIAL_DAYS * D);
  assert.equal(d([androidPurchase('fw_pro_monthly', { transactionDate: anchor })], 'android').source, 'subscription');
});
check('monthly anchored on the 31st clamps to month end and never drifts (no Mar 3 / compounding)', () => {
  const anchor = at(2026, 1, 31, 12);
  assert.equal(estimateAndroidExpiry('monthly', anchor, at(2026, 2, 10, 12)), at(2026, 2, 28, 12));
  assert.equal(estimateAndroidExpiry('monthly', anchor, at(2026, 3, 15, 12)), at(2026, 3, 31, 12));
  assert.equal(estimateAndroidExpiry('monthly', anchor, at(2026, 4, 15, 12)), at(2026, 4, 30, 12));
  assert.equal(estimateAndroidExpiry('monthly', anchor, at(2026, 5, 15, 12)), at(2026, 5, 31, 12));
});
check('annual anchored on Feb 29 and weekly rolling over many cycles', () => {
  const leap = at(2028, 2, 29, 12);
  assert.equal(estimateAndroidExpiry('annual', leap, at(2029, 6, 1, 12)), at(2030, 2, 28, 12));
  const weekly = at(2021, 6, 10, 12);
  const e = estimateAndroidExpiry('weekly', weekly, NOW);
  assert.ok(e > NOW && e - NOW <= 7 * D + 3_600_000, `${e - NOW}`);
});
check('the estimate is always in the future (rolls forward over missed refreshes)', () => {
  for (const plan of ['weekly', 'monthly', 'annual'] as const) {
    for (let back = 5; back < 1500; back += 37) {
      const e = estimateAndroidExpiry(plan, NOW - back * D, NOW);
      assert.ok(e > NOW, `${plan} ${back}`);
    }
  }
});
check('suspended (account hold) grants nothing and raises the billing banner; lifetime still wins', () => {
  const s = d([androidPurchase('fw_pro_monthly', { isSuspendedAndroid: true })], 'android');
  assert.deepEqual([s.isPro, s.billingIssue, s.source], [false, true, 'none']);
  const both = d([androidPurchase('fw_pro_monthly', { isSuspendedAndroid: true }), androidPurchase('fw_pro_lifetime')], 'android');
  assert.deepEqual([both.isPro, both.source, both.billingIssue], [true, 'lifetime', false]);
});
check('refund: a purchase no longer listed by Play downgrades; pending/unknown states never grant', () => {
  assert.equal(d([], 'android').isPro, false);
  assert.equal(d([androidPurchase('fw_pro_monthly', { purchaseState: 'pending' })], 'android').isPro, false);
  assert.equal(d([androidPurchase('fw_pro_monthly', { purchaseState: 'unknown' })], 'android').isPro, false);
});
check('needsFinish: Android only when not yet acknowledged; iOS always', () => {
  assert.equal(needsFinish(androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: false }), 'android'), true);
  assert.equal(needsFinish(androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: null }), 'android'), true);
  assert.equal(needsFinish(androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: true }), 'android'), false);
  assert.equal(needsFinish(iosPurchase('fw_pro_monthly'), 'ios'), true);
});

/* ------------------------------------------------------------------ service flows */
interface Rig {
  svc: StoreBilling;
  log: string[];
  written: PurchaseState[];
  finished: { productId: string; isConsumable: boolean | null | undefined }[];
  emitUpdated: (p: unknown) => Promise<void>;
  emitError: (e: unknown) => Promise<void>;
  emitBilling: () => Promise<void>;
  cache: { s: PurchaseState };
  o: RigOpts;
}
interface RigOpts {
  os?: Os;
  owned?: unknown[];
  subs?: unknown[];
  inapp?: unknown[];
  initOk?: boolean;
  initThrows?: boolean;
  finishFails?: boolean;
  availableThrows?: unknown;
  availableThrowsOnce?: unknown;
  introEligible?: boolean;
  onRequest?: (args: any, rig: Rig) => void;
  timeoutMs?: number;
  replayOnInit?: unknown;
  cached?: Partial<PurchaseState>;
  requestThrows?: unknown;
  lastAvailableOptions?: unknown;
}
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

function rig(o: RigOpts = {}): Rig {
  const log: string[] = [];
  const written: PurchaseState[] = [];
  const finished: Rig['finished'] = [];
  const updated: ((p: unknown) => void)[] = [];
  const errors: ((e: unknown) => void)[] = [];
  const billing: ((p: unknown) => void)[] = [];
  const cache = { s: { isPro: false, source: 'none', expiresAt: null, billingIssue: false, lastCheckedAt: 0, ...o.cached } as PurchaseState };
  let availableThrowsOnce = o.availableThrowsOnce;
  const sub = (name: string, list: any[], fn: any) => {
    log.push(`listen:${name}`);
    list.push(fn);
    return { remove: () => { log.push(`remove:${name}`); list.splice(list.indexOf(fn), 1); } };
  };
  const iap = {
    purchaseUpdatedListener: (fn: any) => sub('updated', updated, fn),
    purchaseErrorListener: (fn: any) => sub('error', errors, fn),
    subscriptionBillingIssueListener: (fn: any) => sub('billing', billing, fn),
    initConnection: async () => {
      log.push('init');
      if (o.initThrows) throw new Error('boom');
      if (o.replayOnInit) updated.forEach((f) => f(o.replayOnInit));
      return o.initOk ?? true;
    },
    endConnection: async () => { log.push('end'); return true; },
    fetchProducts: async ({ skus, type }: { skus: string[]; type: string }) => {
      log.push(`fetch:${type}:${skus.join('+')}`);
      return type === 'subs' ? (o.subs ?? []) : (o.inapp ?? []);
    },
    requestPurchase: async (args: any) => {
      log.push(`request:${args.type}`);
      if (o.requestThrows) throw o.requestThrows;
      o.onRequest?.(args, r);
      return null;
    },
    finishTransaction: async ({ purchase, isConsumable }: any) => {
      log.push(`finish:${purchase.productId}`);
      finished.push({ productId: purchase.productId, isConsumable });
      if (o.finishFails) throw new Error('ack failed');
      const hit = (o.owned ?? []).find((x: any) => x.productId === purchase.productId) as any;
      if (hit) hit.isAcknowledgedAndroid = true;
    },
    getAvailablePurchases: async (opts: unknown) => {
      log.push('available');
      o.lastAvailableOptions = opts;
      if (availableThrowsOnce) { const e = availableThrowsOnce; availableThrowsOnce = undefined; throw e; }
      if (o.availableThrows) throw o.availableThrows;
      return o.owned ?? [];
    },
    restorePurchases: async () => { log.push('restore'); },
    isEligibleForIntroOfferIOS: async () => (o.introEligible ?? true),
  } as unknown as Iap;
  const deps: BillingDeps = {
    os: o.os ?? 'android',
    loadIap: async () => iap,
    readState: () => cache.s,
    writeState: (s) => { cache.s = s; written.push(s); log.push(`write:${s.isPro ? 'pro' : 'free'}`); },
    now: () => NOW,
    purchaseTimeoutMs: o.timeoutMs ?? 2000,
  };
  const r: Rig = {
    svc: new StoreBilling(deps), log, written, finished, cache, o,
    emitUpdated: async (p) => { updated.forEach((f) => f(p)); await tick(); },
    emitError: async (e) => { errors.forEach((f) => f(e)); await tick(); },
    emitBilling: async () => { billing.forEach((f) => f({})); await tick(); },
  };
  return r;
}
const annualPkg = (os: Os = 'android', trial = true): PlanPackage => buildPackage(
  os === 'android'
    ? androidAnnual(trial ? [baseOffer('annual', 'P1Y', '39990000', '$39.99'), trialOffer] : [baseOffer('annual', 'P1Y', '39990000', '$39.99')])
    : iosAnnual(),
  os,
) as PlanPackage;
const rejects = async (p: Promise<unknown>, cls: new (...a: never[]) => Error) => {
  try { await p; } catch (e) { assert.ok(e instanceof cls, `expected ${cls.name}, got ${(e as Error)?.constructor?.name}: ${(e as Error)?.message}`); return e; }
  assert.fail(`expected ${cls.name} rejection`);
};

describe('purchases: connection and listeners');
check('listeners are registered BEFORE initConnection (store replays unfinished transactions on connect)', async () => {
  const r = rig();
  await r.svc.init();
  const iInit = r.log.indexOf('init');
  assert.ok(iInit > 0);
  for (const l of ['listen:updated', 'listen:error', 'listen:billing']) assert.ok(r.log.indexOf(l) >= 0 && r.log.indexOf(l) < iInit, l);
});
check('a purchase replayed during initConnection is acknowledged and granted', async () => {
  const replay = androidPurchase('fw_pro_annual', { isAcknowledgedAndroid: false, transactionDate: NOW - 20 * D });
  const r = rig({ replayOnInit: replay, owned: [replay] });
  await r.svc.init();
  await tick(20);
  assert.ok(r.finished.some((f) => f.productId === 'fw_pro_annual'));
  assert.equal(r.cache.s.isPro, true);
});
check('init never throws; a failed connection removes its listeners and is retried next time', async () => {
  const r = rig({ initOk: false });
  await r.svc.init();
  assert.equal(r.log.filter((x) => x.startsWith('remove:')).length, 3);
  await r.svc.init();
  assert.equal(r.log.filter((x) => x === 'init').length, 2);
  await assert.rejects(r.svc.purchase(annualPkg()), /Store unavailable/);
  const t = rig({ initThrows: true });
  await t.svc.init();
  assert.equal(t.log.filter((x) => x.startsWith('remove:')).length, 3);
});
check('init is idempotent (one connection, three listeners)', async () => {
  const r = rig();
  await Promise.all([r.svc.init(), r.svc.init(), r.svc.init()]);
  assert.equal(r.log.filter((x) => x === 'init').length, 1);
  assert.equal(r.log.filter((x) => x.startsWith('listen:')).length, 3);
});
check('endConnection removes every listener and closes the store; re-init registers again', async () => {
  const r = rig();
  await r.svc.init();
  await r.svc.endConnection();
  assert.equal(r.log.filter((x) => x.startsWith('remove:')).length, 3);
  assert.ok(r.log.includes('end'));
  await r.svc.init();
  assert.equal(r.log.filter((x) => x === 'init').length, 2);
  assert.equal(r.log.filter((x) => x.startsWith('listen:')).length, 6);
});
check('a dropped billing connection (service-disconnected) reconnects once and retries', async () => {
  const r = rig({ owned: [androidPurchase('fw_pro_monthly')], availableThrowsOnce: { code: 'service-disconnected' } });
  const s = await r.svc.refresh();
  assert.equal(s.isPro, true);
  assert.equal(r.log.filter((x) => x === 'init').length, 2);
  assert.ok(r.log.includes('end'));
});

describe('purchases: purchase flow (Android)');
check('annual purchase sends the trial offer token, finishes (acknowledges) BEFORE granting Pro, resolves Pro', async () => {
  const p = androidPurchase('fw_pro_annual', { isAcknowledgedAndroid: false, transactionDate: NOW });
  const r = rig({ owned: [p], onRequest: (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); } });
  const state = await r.svc.purchase(annualPkg());
  assert.equal(state.isPro, true);
  assert.equal(state.source, 'trial');
  const req = r.log.find((x) => x.startsWith('request:'));
  assert.equal(req, 'request:subs');
  const firstFinish = r.log.indexOf('finish:fw_pro_annual');
  const firstGrant = r.log.indexOf('write:pro');
  assert.ok(firstFinish >= 0 && firstGrant > firstFinish, `finish ${firstFinish} grant ${firstGrant}\n${r.log.join('\n')}`);
  assert.equal(r.finished[0].isConsumable, false);
});
check('requestPurchase receives the chosen offer token for the subscription', async () => {
  let seen: any;
  const p = androidPurchase('fw_pro_annual', { isAcknowledgedAndroid: false, transactionDate: NOW });
  const r = rig({ owned: [p], onRequest: (a, rg) => { seen = a; setTimeout(() => void rg.emitUpdated(p), 0); } });
  await r.svc.purchase(annualPkg());
  assert.deepEqual(seen.request.google.subscriptionOffers, [{ sku: 'fw_pro_annual', offerToken: 'tok-trial' }]);
  assert.deepEqual(seen.request.google.skus, ['fw_pro_annual']);
  assert.deepEqual(seen.request.apple, { sku: 'fw_pro_annual' });
});
check('lifetime is bought as an in-app (non-consumable) product and finished with isConsumable=false', async () => {
  const p = androidPurchase('fw_pro_lifetime', { isAcknowledgedAndroid: false });
  const r = rig({ owned: [p], onRequest: (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); } });
  const state = await r.svc.purchase(buildPackage(lifetime, 'android') as PlanPackage);
  assert.equal(r.log.find((x) => x.startsWith('request:')), 'request:in-app');
  assert.deepEqual([state.isPro, state.source, state.expiresAt], [true, 'lifetime', null]);
  assert.equal(r.finished[0].isConsumable, false);
});
check('if acknowledging fails, Pro is NOT granted; the next refresh retries and then grants', async () => {
  const p = androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: false, transactionDate: NOW });
  const r = rig({ owned: [p], finishFails: true, onRequest: (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); } });
  await rejects(r.svc.purchase(buildPackage(androidMonthly([baseOffer('monthly', 'P1M', '9990000', '$9.99')]), 'android') as PlanPackage), PurchasePendingError);
  assert.equal(r.written.some((s) => s.isPro), false);
  assert.equal(r.cache.s.isPro, false);
  r.o.finishFails = false;
  const s = await r.svc.refresh();
  assert.equal(s.isPro, true);
});
check('a failed acknowledge during refresh never downgrades an already-Pro cache', async () => {
  const p = androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: false });
  const r = rig({ owned: [p], finishFails: true, cached: { isPro: true, source: 'subscription', expiresAt: NOW + 5 * D } });
  const s = await r.svc.refresh();
  assert.equal(s.isPro, true);
  assert.equal(r.written.length, 0);
});
check('pending payment (cash / slow method): rejects with PurchasePendingError, nothing granted or finished', async () => {
  const p = androidPurchase('fw_pro_monthly', { purchaseState: 'pending' });
  const r = rig({ onRequest: (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); } });
  await rejects(r.svc.purchase(buildPackage(androidMonthly([baseOffer('monthly', 'P1M', '9990000', '$9.99')]), 'android') as PlanPackage), PurchasePendingError);
  assert.equal(r.finished.length, 0);
  assert.equal(r.written.length, 0);
});
check('a pending purchase that completes later (no waiter) is acknowledged and unlocks Pro on its own', async () => {
  const p = androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: false, transactionDate: NOW });
  const r = rig({ owned: [p] });
  await r.svc.init();
  await r.emitUpdated(p);
  await tick(10);
  assert.equal(r.cache.s.isPro, true);
  assert.ok(r.finished.length >= 1);
});
check('user cancelled -> PurchaseCancelledError via the error listener and via a thrown requestPurchase', async () => {
  const r = rig({ onRequest: (_a, rg) => { setTimeout(() => void rg.emitError({ code: 'user-cancelled', message: 'x' }), 0); } });
  await rejects(r.svc.purchase(annualPkg()), PurchaseCancelledError);
  const t = rig({ requestThrows: { code: 'user-cancelled', message: 'x' } });
  await rejects(t.svc.purchase(annualPkg()), PurchaseCancelledError);
  assert.equal(r.written.length + t.written.length, 0);
});
check('deferred-payment (iOS Ask to Buy) and pending error codes -> PurchasePendingError', async () => {
  for (const code of ['deferred-payment', 'pending']) {
    const r = rig({ os: 'ios', onRequest: (_a, rg) => { setTimeout(() => void rg.emitError({ code, message: 'x' }), 0); } });
    await rejects(r.svc.purchase(annualPkg('ios')), PurchasePendingError);
  }
});
check('already-owned runs a restore and resolves with the restored entitlement', async () => {
  const owned = androidPurchase('fw_pro_annual');
  const r = rig({ owned: [owned], onRequest: (_a, rg) => { setTimeout(() => void rg.emitError({ code: 'already-owned', message: 'x' }), 0); } });
  const s = await r.svc.purchase(annualPkg());
  assert.equal(s.isPro, true);
  assert.ok(r.log.includes('restore'));
});
check('other store errors surface as Error with the store code attached (for analytics)', async () => {
  const r = rig({ onRequest: (_a, rg) => { setTimeout(() => void rg.emitError({ code: 'network-error', message: 'offline' }), 0); } });
  const e = (await rejects(r.svc.purchase(annualPkg()), Error)) as Error & { code?: string };
  assert.equal(e.code, 'network-error');
  assert.equal(e.message, 'offline');
});
check('a store that never answers ends in "pending" after the timeout (no stuck spinner)', async () => {
  const r = rig({ timeoutMs: 30 });
  await rejects(r.svc.purchase(annualPkg()), PurchasePendingError);
});
check('a new purchase attempt supersedes a stale waiter', async () => {
  const r = rig({ timeoutMs: 5000 });
  const first = r.svc.purchase(annualPkg());
  await tick();
  const p = androidPurchase('fw_pro_annual', { isAcknowledgedAndroid: false, transactionDate: NOW });
  r.o.owned = [p];
  r.o.onRequest = (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); };
  const second = r.svc.purchase(annualPkg());
  await rejects(first, PurchaseCancelledError);
  assert.equal((await second).isPro, true);
});

describe('purchases: purchase flow (iOS)');
check('iOS purchase finishes the transaction before granting and uses the transaction expiry', async () => {
  const p = iosPurchase('fw_pro_annual', { offerIOS: { id: '', paymentMode: 'free-trial', type: 'introductory' }, expirationDateIOS: NOW + 3 * D });
  const r = rig({ os: 'ios', owned: [p], onRequest: (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); } });
  const s = await r.svc.purchase(annualPkg('ios'));
  assert.deepEqual([s.isPro, s.source, s.expiresAt], [true, 'trial', NOW + 3 * D]);
  assert.ok(r.log.indexOf('finish:fw_pro_annual') < r.log.indexOf('write:pro'));
  assert.deepEqual((r.o.lastAvailableOptions as any).onlyIncludeActiveItemsIOS, true);
});
check('iOS: store list lagging right after purchase still grants from the purchase event', async () => {
  const p = iosPurchase('fw_pro_monthly');
  const r = rig({ os: 'ios', owned: [], onRequest: (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); } });
  const s = await r.svc.purchase(buildPackage(A({ id: 'fw_pro_monthly', displayPrice: '$9.99', price: 9.99, currency: 'USD' }), 'ios') as PlanPackage);
  assert.equal(s.isPro, true);
});
check('iOS: a finish failure means no Pro (transaction replays and is retried next launch)', async () => {
  const p = iosPurchase('fw_pro_monthly');
  const r = rig({ os: 'ios', owned: [p], finishFails: true, onRequest: (_a, rg) => { setTimeout(() => void rg.emitUpdated(p), 0); } });
  await rejects(r.svc.purchase(buildPackage(A({ id: 'fw_pro_monthly', displayPrice: '$9.99', price: 9.99, currency: 'USD' }), 'ios') as PlanPackage), PurchasePendingError);
  assert.equal(r.written.length, 0);
});

describe('purchases: restore / refresh / expiry');
check('restore: restorePurchases then a full query (including suspended); reinstall finds Pro (AC-08)', async () => {
  const r = rig({ owned: [androidPurchase('fw_pro_lifetime')] });
  const s = await r.svc.restore();
  assert.equal(s.isPro, true);
  assert.ok(r.log.indexOf('restore') < r.log.lastIndexOf('available'));
  assert.equal((r.o.lastAvailableOptions as any).includeSuspendedAndroid, true);
});
check('restore with nothing owned returns free; restore with the store unreachable throws (UI shows an error, not "nothing found")', async () => {
  const r = rig({ owned: [] });
  assert.equal((await r.svc.restore()).isPro, false);
  const t = rig({ availableThrows: new Error('offline') });
  await assert.rejects(t.svc.restore(), /offline/);
  const u = rig({ initOk: false });
  await assert.rejects(u.svc.restore(), /Store unavailable/);
});
check('refresh after expiry/refund: store no longer lists the purchase -> cache downgrades immediately (AC-09)', async () => {
  const r = rig({ owned: [], cached: { isPro: true, source: 'subscription', expiresAt: NOW + 5 * D } });
  const s = await r.svc.refresh();
  assert.equal(s.isPro, false);
  assert.equal(r.cache.s.isPro, false);
});
check('refresh with the store unreachable keeps the cached state untouched (offline grace)', async () => {
  const cached = { isPro: true, source: 'subscription' as const, expiresAt: NOW + 5 * D, lastCheckedAt: 7 };
  const r = rig({ availableThrows: new Error('offline'), cached });
  const s = await r.svc.refresh();
  assert.equal(s.isPro, true);
  assert.equal(s.lastCheckedAt, 7);
  assert.equal(r.written.length, 0);
  const u = rig({ initOk: false, cached });
  assert.equal((await u.svc.refresh()).isPro, true);
});
check('refresh acknowledges an unacknowledged Android purchase, leaves acknowledged ones alone', async () => {
  const unacked = androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: false });
  const r = rig({ owned: [unacked] });
  await r.svc.refresh();
  assert.equal(r.finished.length, 1);
  const r2 = rig({ owned: [androidPurchase('fw_pro_monthly', { isAcknowledgedAndroid: true })] });
  await r2.svc.refresh();
  assert.equal(r2.finished.length, 0);
});
check('billing-issue event raises the banner immediately and keeps Pro after the refresh', async () => {
  const r = rig({ owned: [androidPurchase('fw_pro_monthly')], cached: { isPro: true, source: 'subscription', expiresAt: NOW + 2 * D } });
  await r.svc.init();
  await r.emitBilling();
  await tick(10);
  assert.equal(r.cache.s.billingIssue, true);
  assert.equal(r.cache.s.isPro, true);
});
check('manageSubscriptionUrl per platform', () => {
  assert.ok(rig({ os: 'ios' }).svc.manageSubscriptionUrl().includes('apps.apple.com'));
  assert.ok(rig({ os: 'android' }).svc.manageSubscriptionUrl().includes('play.google.com'));
});

describe('purchases: offering');
check('getOffering queries subs and the lifetime in-app separately and orders annual, monthly, weekly, lifetime', async () => {
  const r = rig({
    subs: [
      androidMonthly([baseOffer('monthly', 'P1M', '9990000', '$9.99')]),
      androidAnnual([baseOffer('annual', 'P1Y', '39990000', '$39.99'), trialOffer]),
      A({ id: 'fw_pro_weekly', platform: 'android', type: 'subs', displayPrice: '$4.99', price: 4.99, currency: 'USD', subscriptionOffers: [baseOffer('weekly', 'P1W', '4990000', '$4.99')] }),
    ],
    inapp: [lifetime],
  });
  const o = await r.svc.getOffering();
  assert.deepEqual(o?.packages.map((p) => p.id), ['annual', 'monthly', 'weekly', 'lifetime']);
  assert.ok(r.log.includes('fetch:subs:fw_pro_annual+fw_pro_monthly+fw_pro_weekly'));
  assert.ok(r.log.includes('fetch:in-app:fw_pro_lifetime'));
  assert.equal(o?.packages[0].trialDays, 3);
  assert.equal(o?.packages[3].priceString, '$79.99');
});
check('iOS offering drops the trial when the user is not eligible (paywall never promises a trial the store will not give)', async () => {
  const sub = iosAnnual({ subscriptionOffers: [{ type: 'introductory', paymentMode: 'free-trial', period: { unit: 'day', value: 3 }, periodCount: 1 }] });
  const elig = await rig({ os: 'ios', subs: [sub], introEligible: true }).svc.getOffering();
  const inelig = await rig({ os: 'ios', subs: [sub], introEligible: false }).svc.getOffering();
  assert.equal(elig?.packages[0].trialDays, 3);
  assert.equal(inelig?.packages[0].trialDays, 0);
});
check('no products (offline / not configured) -> null so the paywall shows its retry state', async () => {
  assert.equal(await rig({ subs: [], inapp: [] }).svc.getOffering(), null);
  assert.equal(await rig({ initOk: false }).svc.getOffering(), null);
});
