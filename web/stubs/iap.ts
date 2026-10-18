// Safety net: native-only (react-native-iap). Purchases on web use the mock/unavailable path.
const unavailable = async () => {
  throw new Error('In-app purchases are not available on web');
};
export const initConnection = async () => false;
export const endConnection = async () => undefined;
export const fetchProducts = async () => [] as unknown[];
export const requestPurchase = unavailable;
export const finishTransaction = async () => undefined;
export const getAvailablePurchases = async () => [] as unknown[];
export const restorePurchases = async () => undefined;
export const getActiveSubscriptions = async () => [] as unknown[];
export const hasActiveSubscriptions = async () => false;
export const deepLinkToSubscriptions = async () => undefined;
export const getStorefront = async () => '';
export const purchaseUpdatedListener = () => ({ remove: () => undefined });
export const purchaseErrorListener = () => ({ remove: () => undefined });
export const ErrorCode = { UserCancelled: 'user-cancelled' } as const;
export const useIAP = () => ({ connected: false });
