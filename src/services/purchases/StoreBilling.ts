import type * as IapModule from 'expo-iap';
import { addDays, addMonths, addYears } from 'date-fns';
import type { PurchaseState } from '../../types';
import {
  PurchaseCancelledError,
  PurchasePendingError,
  type Offering,
  type PlanId,
  type PlanPackage,
  type PurchasesService,
} from './PurchasesService';

/**
 * Direct App Store / Google Play billing logic on top of expo-iap. No backend, no third party.
 *
 * This file has no react-native / store imports: the platform, the expo-iap module and the entitlement
 * cache are injected (see StorePurchasesService.ts), so the whole thing is unit-checked with
 * `npx tsx scripts/checks/run.ts` against mocked expo-iap shapes.
 *
 * Rules enforced here:
 *  - Pro is never granted for a purchase whose transaction was not finished/acknowledged.
 *  - Listeners are registered BEFORE initConnection (the store replays unfinished transactions then).
 *  - A successful store query always overwrites the cache (expiry/refund downgrade immediately);
 *    a failed query never changes it.
 */

export type Iap = typeof IapModule;
type IapPurchase = IapModule.Purchase;
type IapProduct = IapModule.ProductSubscription | IapModule.Product;
export type Os = 'ios' | 'android';

export const PRODUCT_IDS: Record<PlanId, string> = {
  annual: 'fw_pro_annual',
  monthly: 'fw_pro_monthly',
  weekly: 'fw_pro_weekly',
  lifetime: 'fw_pro_lifetime',
};
const SUB_SKUS = [PRODUCT_IDS.annual, PRODUCT_IDS.monthly, PRODUCT_IDS.weekly];
const LIFETIME_SKU = PRODUCT_IDS.lifetime;
export const ALL_SKUS = [...SUB_SKUS, LIFETIME_SKU];
const PLAN_BY_SKU: Record<string, PlanId> = {
  fw_pro_annual: 'annual', fw_pro_monthly: 'monthly', fw_pro_weekly: 'weekly', fw_pro_lifetime: 'lifetime',
};
const PERIOD: Record<PlanId, string> = { annual: 'year', monthly: 'month', weekly: 'week', lifetime: 'once' };
const DAY = 86_400_000;
/** The annual plan's free trial (spec 4.2). Used only to bound the Android expiry estimate. */
export const ANNUAL_TRIAL_DAYS = 3;
const DEFAULT_PURCHASE_TIMEOUT_MS = 10 * 60_000;

/** Native data kept on a PlanPackage so purchase() can build the request. */
export interface NativeRef {
  type: 'subs' | 'in-app';
  /** Android only: subscription offer token (base plan or free-trial offer). */
  offerToken?: string;
}

/* ------------------------------------------------------------------ pure mapping */

/** ISO-8601 duration ("P3D", "P1W", "P1M", "P1Y") to days. */
export function isoToDays(iso: string | undefined | null): number {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso ?? '');
  if (!m) return 0;
  const [, y, mo, w, d] = m;
  return (+(y ?? 0)) * 365 + (+(mo ?? 0)) * 30 + (+(w ?? 0)) * 7 + +(d ?? 0);
}

export function unitToDays(unit: string | null | undefined, n: number): number {
  switch (unit) {
    case 'day': return n;
    case 'week': return n * 7;
    case 'month': return n * 30;
    case 'year': return n * 365;
    default: return 0;
  }
}

export function isFreeTrialOffer(o: any): boolean {
  if (o?.paymentMode === 'free-trial') return true;
  const phases: any[] = o?.pricingPhasesAndroid?.pricingPhaseList ?? [];
  return phases.length > 1 && Number(phases[0]?.priceAmountMicros) === 0;
}

/** Picks the Android offer: the free-trial offer when wanted (annual), else the plain base-plan offer. */
export function pickAndroidOffer(product: any, wantTrial: boolean): any | null {
  const offers: any[] = (product.subscriptionOffers ?? []).filter((o: any) => !!o.offerTokenAndroid);
  if (!offers.length) return null;
  const trial = offers.find(isFreeTrialOffer);
  if (wantTrial && trial) return trial;
  const phaseCount = (o: any) => o.pricingPhasesAndroid?.pricingPhaseList?.length ?? 1;
  const isBase = (o: any) => !o.id || o.id === o.basePlanIdAndroid;
  return offers.find((o) => !isFreeTrialOffer(o) && isBase(o) && phaseCount(o) === 1)
    ?? offers.find((o) => !isFreeTrialOffer(o) && phaseCount(o) === 1)
    ?? offers.find((o) => !isFreeTrialOffer(o))
    ?? offers[0];
}

export function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/** Free-trial length on iOS. Prefers the standardized `subscriptionOffers`, falls back to the legacy fields. */
export function trialDaysIOS(p: any): number {
  const intro = (p.subscriptionOffers ?? []).find(
    (o: any) => o?.type === 'introductory' && o?.paymentMode === 'free-trial',
  );
  if (intro?.period) {
    return unitToDays(intro.period.unit, intro.period.value) * (Number(intro.periodCount ?? 1) || 1);
  }
  if (p.introductoryPricePaymentModeIOS !== 'free-trial') return 0;
  const n = Number(p.introductoryPriceNumberOfPeriodsIOS ?? 1) || 1;
  const per = p.introductoryPriceSubscriptionPeriodIOS;
  const unit = per?.unit ?? per;
  const value = per?.value ?? 1;
  return unitToDays(unit, value * n);
}

export function trialDaysAndroid(offer: any): number {
  if (!offer || !isFreeTrialOffer(offer)) return 0;
  const phase = (offer.pricingPhasesAndroid?.pricingPhaseList ?? [])[0];
  const days = isoToDays(phase?.billingPeriod) * (phase?.billingCycleCount || 1);
  if (days) return days;
  return unitToDays(offer.period?.unit, (offer.period?.value ?? 0) * (offer.periodCount ?? 1));
}

/**
 * Maps a store product to the app's PlanPackage. `introEligible=false` (iOS, user already used the
 * introductory offer in this subscription group) removes the trial so the paywall never advertises
 * a trial the store will not grant.
 */
export function buildPackage(product: IapProduct, os: Os, introEligible = true): PlanPackage | null {
  const id = PLAN_BY_SKU[product.id];
  if (!id) return null;
  const p: any = product;
  let priceString: string = p.displayPrice;
  let price: number = p.price ?? 0;
  let currency: string = p.currency ?? '';
  let trialDays = 0;
  const native: NativeRef = { type: id === 'lifetime' ? 'in-app' : 'subs' };

  if (id !== 'lifetime') {
    if (os === 'android') {
      const offer = pickAndroidOffer(p, id === 'annual');
      if (!offer) return null; // no purchasable offer (not configured / not eligible)
      native.offerToken = offer.offerTokenAndroid;
      trialDays = trialDaysAndroid(offer);
      const phases: any[] = offer.pricingPhasesAndroid?.pricingPhaseList ?? [];
      const recurring = phases[phases.length - 1];
      if (recurring) {
        priceString = recurring.formattedPrice || priceString;
        price = Number(recurring.priceAmountMicros) / 1_000_000 || price;
        currency = recurring.priceCurrencyCode || currency;
      }
    } else {
      trialDays = introEligible ? trialDaysIOS(p) : 0;
    }
  }

  return {
    id,
    productId: product.id,
    priceString,
    price,
    currency,
    periodLabel: PERIOD[id],
    trialDays,
    perMonthString: id === 'annual' && price > 0 ? formatMoney(price / 12, currency) : undefined,
    native,
  };
}

/**
 * Play does not expose the expiry on the client. Estimates the end of the current billing cycle from
 * the original purchase time (renewals keep the same anchor): anchor + k periods for the smallest k
 * that is in the future. Month/year steps clamp to month end (date-fns), never accumulate drift.
 * Inside the annual plan's first ANNUAL_TRIAL_DAYS the entitlement ends with the trial.
 */
export function estimateAndroidExpiry(plan: PlanId, anchor: number, now: number): number {
  if (plan === 'annual' && now - anchor < ANNUAL_TRIAL_DAYS * DAY) return anchor + ANNUAL_TRIAL_DAYS * DAY;
  const step = (k: number) => {
    const d = new Date(anchor);
    return (plan === 'annual' ? addYears(d, k) : plan === 'monthly' ? addMonths(d, k) : addDays(d, 7 * k)).getTime();
  };
  let k = 1;
  while (step(k) <= now && k < 10_000) k++;
  return step(k);
}

type Candidate = { isPro: true; source: PurchaseState['source']; expiresAt: number | null; billingIssue: boolean };

export function candidateFor(pu: IapPurchase, os: Os, now: number): Candidate | { suspended: true } | null {
  const plan = PLAN_BY_SKU[pu.productId];
  if (!plan || pu.purchaseState !== 'purchased') return null;
  const a: any = pu;

  if (plan === 'lifetime') {
    if (a.revocationDateIOS) return null; // refunded / revoked
    return { isPro: true, source: 'lifetime', expiresAt: null, billingIssue: false };
  }

  if (os === 'ios') {
    if (a.revocationDateIOS) return null;
    const exp: number | null | undefined = a.expirationDateIOS;
    const renewal = a.renewalInfoIOS;
    if (!exp || exp <= now) {
      // Billing grace period: Apple keeps access until gracePeriodExpirationDate while it retries.
      const grace: number | null | undefined = renewal?.gracePeriodExpirationDate;
      if (grace && grace > now) return { isPro: true, source: 'subscription', expiresAt: grace, billingIssue: true };
      return null;
    }
    const trial = a.offerIOS?.paymentMode === 'free-trial';
    return {
      isPro: true,
      source: trial ? 'trial' : 'subscription',
      expiresAt: exp,
      billingIssue: !!renewal?.isInBillingRetry,
    };
  }

  // Android: Play lists a subscription only while it grants access (active, cancelled-but-paid, grace
  // period). Account-hold subscriptions are suspended and must not grant access.
  if (a.isSuspendedAndroid) return { suspended: true };
  const anchor: number = a.transactionDate || now;
  const trial = plan === 'annual' && now - anchor < ANNUAL_TRIAL_DAYS * DAY;
  return {
    isPro: true,
    source: trial ? 'trial' : 'subscription',
    expiresAt: estimateAndroidExpiry(plan, anchor, now),
    billingIssue: false,
  };
}

/** Derives the app-level entitlement from the store's list of owned purchases. */
export function derive(purchases: IapPurchase[], os: Os, now: number): PurchaseState {
  let best: Candidate | null = null;
  let suspended = false;
  for (const pu of purchases) {
    const c = candidateFor(pu, os, now);
    if (!c) continue;
    if ('suspended' in c) { suspended = true; continue; }
    if (!best) { best = c; continue; }
    if (best.source === 'lifetime') continue;
    if (c.source === 'lifetime' || (c.expiresAt ?? 0) > (best.expiresAt ?? 0)) best = c;
  }
  if (best) return { ...best, lastCheckedAt: now };
  return { isPro: false, source: 'none', expiresAt: null, billingIssue: suspended, lastCheckedAt: now };
}

/** Android purchases must be acknowledged within 3 days (else refunded); iOS transactions must be finished. */
export function needsFinish(p: IapPurchase, os: Os): boolean {
  return os === 'ios' ? true : (p as any).isAcknowledgedAndroid !== true;
}

const RECONNECT_CODES = new Set([
  'service-disconnected', 'connection-closed', 'init-connection', 'service-timeout', 'not-prepared',
]);

/* ------------------------------------------------------------------ service */

export interface BillingDeps {
  os: Os;
  loadIap: () => Promise<Iap>;
  readState: () => PurchaseState;
  writeState: (s: PurchaseState) => void;
  now?: () => number;
  /** How long purchase() waits for the store before reporting "pending". */
  purchaseTimeoutMs?: number;
}

interface Waiter {
  productId: string;
  resolve: (s: PurchaseState) => void;
  reject: (e: unknown) => void;
  timer: ReturnType<typeof setTimeout> | null;
}

export class StoreBilling implements PurchasesService {
  private initPromise: Promise<boolean> | null = null;
  private subs: { remove: () => void }[] = [];
  private waiter: Waiter | null = null;
  private offering: Offering | null = null;

  constructor(private readonly deps: BillingDeps) {}

  private now() { return this.deps.now ? this.deps.now() : Date.now(); }

  /** Connects to the store and registers listeners. Safe to call repeatedly; never throws. */
  init(): Promise<void> {
    return this.ensure().then(() => undefined);
  }

  private ensure(): Promise<boolean> {
    if (!this.initPromise) {
      this.initPromise = this.connect().catch((e) => {
        console.warn('[purchases] store connection failed', e);
        this.initPromise = null; // allow a retry on the next call
        return false;
      });
    }
    return this.initPromise;
  }

  private async connect(): Promise<boolean> {
    const I = await this.deps.loadIap();
    // Register BEFORE initConnection: the store replays unfinished transactions as soon as it connects.
    const subs = [
      I.purchaseUpdatedListener((p) => { void this.onPurchaseUpdated(p); }),
      I.purchaseErrorListener((e) => this.onPurchaseError(e as { code?: string })),
      I.subscriptionBillingIssueListener(() => this.onBillingIssue()),
    ];
    try {
      const ok = await I.initConnection();
      if (!ok) throw new Error('billing unavailable');
    } catch (e) {
      subs.forEach((s) => s.remove());
      throw e;
    }
    this.subs = subs;
    return true;
  }

  /** Removes the listeners and closes the store connection. A later call re-initialises. */
  async endConnection(): Promise<void> {
    this.subs.forEach((s) => s.remove());
    this.subs = [];
    this.initPromise = null;
    try { const I = await this.deps.loadIap(); await I.endConnection(); } catch { /* ignore */ }
  }

  /** Runs a store call; on a dropped billing connection reconnects once and retries. */
  private async call<T>(fn: (I: Iap) => Promise<T>): Promise<T> {
    try {
      return await fn(await this.deps.loadIap());
    } catch (e: any) {
      if (!RECONNECT_CODES.has(String(e?.code ?? ''))) throw e;
      await this.endConnection();
      if (!(await this.ensure())) throw e;
      return fn(await this.deps.loadIap());
    }
  }

  async getOffering(): Promise<Offering | null> {
    if (!(await this.ensure())) return this.offering;
    try {
      const [subs, inapp] = await Promise.all([
        this.call((I) => I.fetchProducts({ skus: SUB_SKUS, type: 'subs' })),
        this.call((I) => I.fetchProducts({ skus: [LIFETIME_SKU], type: 'in-app' })),
      ]);
      const all = [...((subs ?? []) as IapProduct[]), ...((inapp ?? []) as IapProduct[])];
      const packages: PlanPackage[] = [];
      for (const product of all) {
        let eligible = true;
        const group = (product as any).subscriptionGroupIdIOS as string | null | undefined;
        if (this.deps.os === 'ios' && group && trialDaysIOS(product) > 0) {
          try { eligible = await this.call((I) => I.isEligibleForIntroOfferIOS(group)); } catch { eligible = true; }
        }
        const pkg = buildPackage(product, this.deps.os, eligible);
        if (pkg) packages.push(pkg);
      }
      const order: PlanId[] = ['annual', 'monthly', 'weekly', 'lifetime'];
      packages.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
      this.offering = packages.length ? { packages } : null;
    } catch (e) {
      console.warn('[purchases] fetchProducts failed', e);
    }
    return this.offering;
  }

  async purchase(pkg: PlanPackage): Promise<PurchaseState> {
    if (!(await this.ensure())) throw new Error('Store unavailable');
    if (this.waiter) this.settleWaiter((w) => w.reject(new PurchaseCancelledError())); // supersede a stale attempt
    const native = (pkg.native ?? { type: pkg.id === 'lifetime' ? 'in-app' : 'subs' }) as NativeRef;
    const timeoutMs = this.deps.purchaseTimeoutMs ?? DEFAULT_PURCHASE_TIMEOUT_MS;

    const done = new Promise<PurchaseState>((resolve, reject) => {
      const timer = setTimeout(() => this.settleWaiter((w) => w.reject(new PurchasePendingError())), timeoutMs);
      this.waiter = { productId: pkg.productId, resolve, reject, timer };
    });
    done.catch(() => {}); // avoid an unhandled rejection if requestPurchase throws first

    try {
      if (native.type === 'subs') {
        await this.call((I) => I.requestPurchase({
          type: 'subs',
          request: {
            apple: { sku: pkg.productId },
            google: {
              skus: [pkg.productId],
              subscriptionOffers: native.offerToken
                ? [{ sku: pkg.productId, offerToken: native.offerToken }]
                : undefined,
            },
          },
        }));
      } else {
        await this.call((I) => I.requestPurchase({
          type: 'in-app',
          request: { apple: { sku: pkg.productId }, google: { skus: [pkg.productId] } },
        }));
      }
    } catch (e) {
      this.settleWaiter(() => {});
      return this.mapError(e);
    }
    return done;
  }

  async restore(): Promise<PurchaseState> {
    if (!(await this.ensure())) throw new Error('Store unavailable');
    try { await this.call((I) => I.restorePurchases()); } catch (e) { console.warn('[purchases] restorePurchases failed', e); }
    return this.syncFromStore(true);
  }

  async refresh(): Promise<PurchaseState> {
    if (!(await this.ensure())) return this.currentState();
    return this.syncFromStore(false);
  }

  manageSubscriptionUrl() {
    return this.deps.os === 'ios'
      ? 'https://apps.apple.com/account/subscriptions'
      : 'https://play.google.com/store/account/subscriptions';
  }

  /**
   * Reads owned purchases, acknowledges any unacknowledged Android purchase and commits the derived
   * entitlement. Purchases whose acknowledgement failed are NOT counted (Pro is only granted for
   * finished transactions; the next refresh retries). On a store error the cache is untouched
   * (`strict` re-throws so an explicit Restore can tell the user).
   */
  private async syncFromStore(strict: boolean): Promise<PurchaseState> {
    let list: IapPurchase[];
    try {
      list = (await this.call((I) => I.getAvailablePurchases({
        onlyIncludeActiveItemsIOS: true,
        includeSuspendedAndroid: true,
      }))) as IapPurchase[];
    } catch (e) {
      console.warn('[purchases] getAvailablePurchases failed', e);
      if (strict) throw e;
      return this.currentState();
    }
    const owned = list.filter((p) => p.purchaseState === 'purchased' && ALL_SKUS.includes(p.productId));
    const unfinished = new Set<IapPurchase>();
    if (this.deps.os === 'android') {
      await Promise.all(
        owned.filter((p) => needsFinish(p, 'android')).map(async (p) => {
          if (!(await this.finish(p))) unfinished.add(p);
        }),
      );
    }
    const next = derive(owned.filter((p) => !unfinished.has(p)), this.deps.os, this.now());
    if (unfinished.size > 0 && !next.isPro) return this.currentState(); // never downgrade because an ack failed
    return this.commit(next);
  }

  /** finishTransaction (iOS) / acknowledge (Android). Resolves false instead of throwing. */
  private async finish(p: IapPurchase): Promise<boolean> {
    try {
      await this.call((I) => I.finishTransaction({ purchase: p, isConsumable: false }));
      return true;
    } catch (e) {
      console.warn('[purchases] finishTransaction failed', e);
      return false;
    }
  }

  private commit(next: PurchaseState): PurchaseState {
    this.deps.writeState(next);
    return next;
  }

  private currentState(): PurchaseState {
    const s = this.deps.readState();
    return {
      isPro: s.isPro, source: s.source, expiresAt: s.expiresAt, billingIssue: s.billingIssue, lastCheckedAt: s.lastCheckedAt,
    };
  }

  private settleWaiter(fn: (w: Waiter) => void) {
    const w = this.waiter;
    if (!w) return;
    this.waiter = null;
    if (w.timer) clearTimeout(w.timer);
    fn(w);
  }

  private async onPurchaseUpdated(p: IapPurchase) {
    if (!ALL_SKUS.includes(p.productId)) return;
    const w = this.waiter && this.waiter.productId === p.productId ? this.waiter : null;

    if (p.purchaseState === 'pending') {
      // Deferred payment (Ask to Buy, cash / slow payment methods). Do not grant or finish.
      if (w) this.settleWaiter((x) => x.reject(new PurchasePendingError()));
      return;
    }
    if (p.purchaseState !== 'purchased') return;

    // Finish / acknowledge FIRST: Android auto-refunds after 3 days, iOS replays on every launch.
    // Pro is granted only once that succeeded.
    if (needsFinish(p, this.deps.os)) {
      const ok = await this.finish(p);
      if (!ok) {
        if (w) this.settleWaiter((x) => x.reject(new PurchasePendingError())); // retried on next refresh
        return;
      }
    }
    let state: PurchaseState;
    try {
      state = await this.syncFromStore(false);
      if (!state.isPro) state = this.commit(derive([p], this.deps.os, this.now())); // store list may lag
    } catch {
      state = this.commit(derive([p], this.deps.os, this.now()));
    }
    if (w) this.settleWaiter((x) => x.resolve(state));
  }

  private onPurchaseError(e: { code?: string }) {
    const w = this.waiter;
    if (!w) return;
    this.settleWaiter(() => {});
    this.mapError(e).then(w.resolve, w.reject);
  }

  private onBillingIssue() {
    this.commit({ ...this.currentState(), billingIssue: true });
    void this.refresh()
      .then((s) => { if (s.isPro && !s.billingIssue) this.commit({ ...s, billingIssue: true }); })
      .catch(() => {});
  }

  /** Maps a store error to the app's error types. Resolves (via restore) for already-owned. */
  private async mapError(e: any): Promise<PurchaseState> {
    const code = String(e?.code ?? '');
    if (code === 'user-cancelled') throw new PurchaseCancelledError();
    if (code === 'pending' || code === 'deferred-payment') throw new PurchasePendingError();
    if (code === 'already-owned') return this.restore();
    const err = e instanceof Error ? e : new Error(e?.message ?? 'Purchase failed');
    if (code && !(err as any).code) (err as any).code = code;
    throw err;
  }
}
