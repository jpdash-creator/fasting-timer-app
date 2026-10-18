import type { PurchaseState } from '../../types';
import { usePurchaseStore } from '../../stores/purchaseStore';
import type { Offering, PlanPackage, PurchasesService } from './PurchasesService';

const PACKAGES: PlanPackage[] = [
  { id: 'annual', productId: 'fw_pro_annual', priceString: '$39.99', price: 39.99, currency: 'USD', periodLabel: 'year', trialDays: 3, perMonthString: '$3.33' },
  { id: 'monthly', productId: 'fw_pro_monthly', priceString: '$9.99', price: 9.99, currency: 'USD', periodLabel: 'month', trialDays: 0 },
  { id: 'weekly', productId: 'fw_pro_weekly', priceString: '$4.99', price: 4.99, currency: 'USD', periodLabel: 'week', trialDays: 0 },
  { id: 'lifetime', productId: 'fw_pro_lifetime', priceString: '$79.99', price: 79.99, currency: 'USD', periodLabel: 'once', trialDays: 0 },
];

const DAY = 86_400_000;

export class MockPurchasesService implements PurchasesService {
  async init() {}
  async getOffering(): Promise<Offering | null> {
    await new Promise((r) => setTimeout(r, 250));
    return { packages: PACKAGES };
  }
  private commit(next: PurchaseState) {
    usePurchaseStore.getState().setState(next);
    return next;
  }
  async purchase(pkg: PlanPackage): Promise<PurchaseState> {
    await new Promise((r) => setTimeout(r, 400));
    const now = Date.now();
    const lifetime = pkg.id === 'lifetime';
    const span = pkg.id === 'annual' ? 365 : pkg.id === 'monthly' ? 30 : 7;
    return this.commit({
      isPro: true,
      source: lifetime ? 'lifetime' : pkg.trialDays > 0 ? 'trial' : 'subscription',
      expiresAt: lifetime ? null : now + (pkg.trialDays > 0 ? pkg.trialDays : span) * DAY,
      billingIssue: false,
      lastCheckedAt: now,
    });
  }
  async restore(): Promise<PurchaseState> {
    const s = usePurchaseStore.getState();
    return this.commit({
      isPro: s.isPro, source: s.source, expiresAt: s.expiresAt,
      billingIssue: s.billingIssue, lastCheckedAt: Date.now(),
    });
  }
  async refresh(): Promise<PurchaseState> {
    return this.restore();
  }
  manageSubscriptionUrl() {
    return 'https://apps.apple.com/account/subscriptions';
  }
}
