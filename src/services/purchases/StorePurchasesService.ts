import { Platform } from 'react-native';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { StoreBilling } from './StoreBilling';

export { PRODUCT_IDS } from './StoreBilling';

/**
 * Direct App Store / Google Play billing via expo-iap. No backend, no third-party service.
 * expo-iap is imported dynamically so web / Expo Go bundles never load the native module.
 * All logic lives in StoreBilling.ts (platform and module injected, unit-checked); this class only
 * wires the real platform, module and persisted entitlement cache (README "Billing architecture").
 */
export class StorePurchasesService extends StoreBilling {
  constructor() {
    super({
      os: Platform.OS === 'ios' ? 'ios' : 'android',
      loadIap: () => import('expo-iap'),
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
