// Safety net: native-only (react-native-config). Values come from VITE_* env vars on web.
const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
const Config: Record<string, string | undefined> = {
  PRIVACY_URL: env.VITE_PRIVACY_URL,
  TERMS_URL: env.VITE_TERMS_URL,
  SUPPORT_EMAIL: env.VITE_SUPPORT_EMAIL,
  USE_MOCK_PURCHASES: env.VITE_USE_MOCK_PURCHASES,
  PAYWALL_MODE: env.VITE_PAYWALL_MODE,
};
export default Config;
export { Config };
