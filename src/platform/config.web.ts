// Web (Vite) variant of config.ts. Lookup order: window.__FASTLINE_CONFIG__ (runtime override, e.g. injected
// by a hosting page), import.meta.env.VITE_<KEY>, then process.env.<KEY> / VITE_<KEY> when defined by a bundler.
export type ConfigKey = 'PRIVACY_URL' | 'TERMS_URL' | 'SUPPORT_EMAIL' | 'USE_MOCK_PURCHASES' | 'PAYWALL_MODE';

type Source = Record<string, string | undefined>;

function viteEnv(): Source {
  try {
    return ((import.meta as unknown as { env?: Source }).env ?? {}) as Source;
  } catch {
    return {};
  }
}

export function getConfig(key: ConfigKey): string | undefined {
  const w = typeof window !== 'undefined'
    ? ((window as unknown as { __FASTLINE_CONFIG__?: Source }).__FASTLINE_CONFIG__ ?? {})
    : {};
  const p: Source = typeof process !== 'undefined' && process.env ? (process.env as Source) : {};
  const e = viteEnv();
  const v = w[key] ?? e[`VITE_${key}`] ?? p[key] ?? p[`VITE_${key}`];
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
