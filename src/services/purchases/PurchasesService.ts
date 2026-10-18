import type { PurchaseState } from '../../types';

export type PlanId = 'annual' | 'monthly' | 'weekly' | 'lifetime';

/** Store-agnostic package shape so screens never touch store SDK types. */
export interface PlanPackage {
  id: PlanId;
  productId: string; // fw_pro_annual ...
  priceString: string; // localized, e.g. "$39.99"
  price: number;
  currency: string;
  periodLabel: string; // "year" | "month" | "week" | "once"
  trialDays: number; // 0 if none
  perMonthString?: string; // localized monthly equivalent for annual
  native?: unknown; // store-specific data (e.g. Android offer token)
}

export interface Offering {
  packages: PlanPackage[];
}

export interface PurchasesService {
  init(): Promise<void>;
  getOffering(): Promise<Offering | null>;
  purchase(pkg: PlanPackage): Promise<PurchaseState>;
  restore(): Promise<PurchaseState>;
  refresh(): Promise<PurchaseState>;
  manageSubscriptionUrl(): string;
}

export class PurchaseCancelledError extends Error {
  constructor() { super('cancelled'); this.name = 'PurchaseCancelledError'; }
}
export class PurchasePendingError extends Error {
  constructor() { super('pending'); this.name = 'PurchasePendingError'; }
}
