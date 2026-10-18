import { Platform } from 'react-native';
import { Config } from '../../platform/config';
import type { PurchasesService } from './PurchasesService';
import { MockPurchasesService } from './MockPurchasesService';
import { StorePurchasesService } from './StorePurchasesService';

export * from './PurchasesService';

// Store billing needs native code: web, or the USE_MOCK_PURCHASES=1 env flag (.env.*) => mock.
export const isMockPurchases =
  Platform.OS === 'web' ||
  Config.USE_MOCK_PURCHASES === '1';

export const purchases: PurchasesService = isMockPurchases
  ? new MockPurchasesService()
  : new StorePurchasesService();
