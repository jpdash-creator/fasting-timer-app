import { MockPurchasesService } from './MockPurchasesService';

export { PRODUCT_IDS } from './StoreBilling';

/**
 * Web has no store billing: this variant keeps react-native-iap (native-only, Nitro) and the real
 * billing logic out of the web bundle. index.ts already selects the mock on web; this makes the
 * bundler-level guarantee too.
 */
export class StorePurchasesService extends MockPurchasesService {}
