import { Platform } from 'react-native';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { StoreBilling } from './StoreBilling';

export { PRODUCT_IDS } from './StoreBilling';

/**
 * Direct App Store / Google Play billing via react-native-iap 17 (OpenIAP, Nitro modules). No backend,
 * no third-party service. react-native-iap is imported dynamically so it is only loaded when real
 * billing is used (the web build resolves StorePurchasesService.web.ts instead and never sees it).
 * All logic lives in StoreBilling.ts (platform and module injected, unit-checked); this class only
 * wires the real platform, module and persisted entitlement cache (README "Billing architecture").
 */
export class StorePurchasesService extends StoreBilling {
  constructor() {
    super({
      os: Platform.OS === 'ios' ? 'ios' : 'android',
      loadIap: () => import('react-native-iap'),
      readState: () => {
        const s = usePurchaseStore.getState();
        return {
          isPro: s.isPro, source: s.source, expiresAt: s.expiresAt, billingIssue: s.billingIssue, lastCheckedAt: s.lastCheckedAt,
        };
      },
      writeState: (s) => usePurchaseStore.getState().setState(s),
    });
  }
}
