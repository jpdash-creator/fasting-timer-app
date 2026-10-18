import Constants from 'expo-constants';
import { Platform } from 'react-native';
import type { PurchasesService } from './PurchasesService';
import { MockPurchasesService } from './MockPurchasesService';
import { StorePurchasesService } from './StorePurchasesService';

export * from './PurchasesService';

// Store billing needs native code: Expo Go, web, or the env flag => mock.
export const isMockPurchases =
  Constants.appOwnership === 'expo' ||
  Platform.OS === 'web' ||
  process.env.EXPO_PUBLIC_USE_MOCK_PURCHASES === '1';

export const purchases: PurchasesService = isMockPurchases
  ? new MockPurchasesService()
  : new StorePurchasesService();
