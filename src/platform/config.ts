// Typed build-time config. Native: react-native-config (values from .env.development / .env.production,
// see docs/MIGRATION.md). Node/tsx (scripts/checks): the harness stubs the native module with an empty
// object, so every key falls back to process.env. Web variant: config.web.ts.
import NativeConfig from 'react-native-config';

export type ConfigKey = 'PRIVACY_URL' | 'TERMS_URL' | 'SUPPORT_EMAIL' | 'USE_MOCK_PURCHASES' | 'PAYWALL_MODE';

type Source = Partial<Record<string, string | undefined>>;

const nodeEnv = (): Source => (typeof process !== 'undefined' && process.env ? process.env : {});

/** Reads a key at call time (the checks mutate process.env between assertions). */
export function getConfig(key: ConfigKey): string | undefined {
  const native = (NativeConfig ?? {}) as Source;
  const v = native[key] ?? nodeEnv()[key];
  return typeof v === 'string' ? v : undefined;
}

export const Config = {
  get PRIVACY_URL() { return getConfig('PRIVACY_URL'); },
  get TERMS_URL() { return getConfig('TERMS_URL'); },
  get SUPPORT_EMAIL() { return getConfig('SUPPORT_EMAIL'); },
  get USE_MOCK_PURCHASES() { return getConfig('USE_MOCK_PURCHASES'); },
  get PAYWALL_MODE() { return getConfig('PAYWALL_MODE'); },
};

export default Config;
