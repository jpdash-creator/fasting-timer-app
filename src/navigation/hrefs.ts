// Pure href parsing / route-map logic (no React Native imports: unit-checked via `npm run check`).
// Hrefs are the OLD expo-router paths ('/', '/history', '/(onboarding)/goal', '/paywall?trigger=gate', ...).

export type HrefParams = Record<string, string | number | undefined>;
export type Href = string | { pathname: string; params?: HrefParams };

export type TabName = 'Timer' | 'History' | 'Stats' | 'Settings';
export type OnboardingName =
  | 'Welcome' | 'Goal' | 'Experience' | 'Schedule' | 'Safety' | 'Protocol' | 'Reminders' | 'PlanSummary';
export type RootModalName =
  | 'Paywall' | 'ProtocolPicker' | 'FastEditor' | 'FastSummary' | 'LogWeight' | 'LogWater' | 'StageInfo' | 'ShareCard';

export type Target =
  | { kind: 'tab'; name: TabName; params: Record<string, string> }
  | { kind: 'onboarding'; name: OnboardingName; params: Record<string, string> }
  | { kind: 'root'; name: RootModalName; params: Record<string, string> };

/** Path (also the web URL) -> screen. '' is the Timer tab. Keep these URLs identical to the former Expo web app. */
export const TAB_PATHS: Record<TabName, string> = { Timer: '', History: 'history', Stats: 'stats', Settings: 'settings' };
export const ONBOARDING_PATHS: Record<OnboardingName, string> = {
  Welcome: 'welcome', Goal: 'goal', Experience: 'experience', Schedule: 'schedule', Safety: 'safety',
  Protocol: 'protocol', Reminders: 'reminders', PlanSummary: 'plan-summary',
};
export const ROOT_PATHS: Record<RootModalName, string> = {
  Paywall: 'paywall', ProtocolPicker: 'protocol-picker', FastEditor: 'fast-editor', FastSummary: 'fast-summary',
  LogWeight: 'log-weight', LogWater: 'log-water', StageInfo: 'stage-info', ShareCard: 'share-card',
};

function invert<T extends string>(m: Record<T, string>): Record<string, T> {
  const out: Record<string, T> = {};
  (Object.keys(m) as T[]).forEach((k) => { out[m[k]] = k; });
  return out;
}
const TAB_BY_PATH = invert(TAB_PATHS);
const ONB_BY_PATH = invert(ONBOARDING_PATHS);
const ROOT_BY_PATH = invert(ROOT_PATHS);

/** Strips query/hash, `(group)` segments, a trailing `index`, duplicate/trailing slashes; `/timer` is an alias of `/`. Returns '' for the root. */
export function normalizePathname(raw: string): string {
  let p = raw.split('#')[0].split('?')[0];
  const segs = p.split('/').filter((s) => s !== '' && !/^\(.*\)$/.test(s));
  if (segs.length && segs[segs.length - 1] === 'index') segs.pop();
  p = segs.join('/');
  if (p === 'timer') p = '';
  return p;
}

export function parseQuery(qs: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!qs) return out;
  const dec = (s: string) => { try { return decodeURIComponent(s.replace(/\+/g, ' ')); } catch { return s; } };
  for (const pair of qs.split('&')) {
    if (!pair) continue;
    const i = pair.indexOf('=');
    const k = dec(i < 0 ? pair : pair.slice(0, i));
    const v = i < 0 ? '' : dec(pair.slice(i + 1));
    if (k) out[k] = v;
  }
  return out;
}

export function parseHref(href: Href): { path: string; params: Record<string, string> } {
  const params: Record<string, string> = {};
  const raw = typeof href === 'string' ? href : href.pathname;
  const noHash = raw.split('#')[0];
  const q = noHash.indexOf('?');
  if (q >= 0) Object.assign(params, parseQuery(noHash.slice(q + 1)));
  if (typeof href !== 'string') {
    for (const [k, v] of Object.entries(href.params ?? {})) if (v !== undefined && v !== null) params[k] = String(v);
  }
  return { path: normalizePathname(raw), params };
}

/** Maps an expo-router style href to a React Navigation target, or null when it is unknown. */
export function resolveHref(href: Href): Target | null {
  const { path, params } = parseHref(href);
  if (path in TAB_BY_PATH) return { kind: 'tab', name: TAB_BY_PATH[path], params };
  if (path in ONB_BY_PATH) return { kind: 'onboarding', name: ONB_BY_PATH[path], params };
  if (path in ROOT_BY_PATH) return { kind: 'root', name: ROOT_BY_PATH[path], params };
  return null;
}

/** Rewrites an incoming URL path (web location / deep link) so the default parser understands it; the query string is kept. */
export function normalizeIncomingPath(path: string): string {
  const hashless = path.split('#')[0];
  const q = hashless.indexOf('?');
  const pathname = normalizePathname(q >= 0 ? hashless.slice(0, q) : hashless);
  return '/' + pathname + (q >= 0 ? hashless.slice(q) : '');
}

/** `screens` object for the React Navigation linking config. */
export function buildLinkingScreens() {
  return {
    Tabs: { screens: { ...TAB_PATHS } },
    Onboarding: { screens: { ...ONBOARDING_PATHS } },
    ...ROOT_PATHS,
  };
}
