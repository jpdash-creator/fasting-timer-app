/**
 * Pure entitlement derivation (FR-25, spec 16.8). No React / native imports so it can be unit-checked
 * with `npx tsx`. Single definition shared by useIsPro, notifications and auto-start.
 */
export const WEEK_MS = 7 * 24 * 3_600_000;

export interface EntitlementInput {
  isPro: boolean;
  /** null = never expires (lifetime) or unknown. */
  expiresAt: number | null;
  mockPro?: boolean;
}

/** Mock Pro is a developer affordance: honoured only in dev builds or when mock purchases are forced. */
export function mockProAllowed(): boolean {
  const dev = typeof __DEV__ !== 'undefined' && __DEV__;
  const forced = typeof process !== 'undefined' && process.env?.EXPO_PUBLIC_USE_MOCK_PURCHASES === '1';
  return dev || forced;
}

/**
 * Pro is active when the cached state says so and, for expiring entitlements, `now` is no more than
 * 7 days past `expiresAt` (offline grace). A successful store refresh overwrites the cache, so a
 * real expiry/refund downgrades immediately online.
 */
export function isEntitled(s: EntitlementInput, now = Date.now(), allowMock = mockProAllowed()): boolean {
  if (allowMock && s.mockPro) return true;
  if (!s.isPro) return false;
  if (s.expiresAt === null) return true;
  return now <= s.expiresAt + WEEK_MS;
}

/** Milliseconds until a currently-entitled state lapses, or null if it never will (or is not entitled). */
export function msUntilLapse(s: EntitlementInput, now = Date.now(), allowMock = mockProAllowed()): number | null {
  if (allowMock && s.mockPro) return null;
  if (!s.isPro || s.expiresAt === null) return null;
  return Math.max(0, s.expiresAt + WEEK_MS - now);
}

/** True when the cached subscription is past its expiry but still inside the 7-day grace (soft banner). */
export function inGrace(s: EntitlementInput, now = Date.now()): boolean {
  return s.isPro && s.expiresAt !== null && now > s.expiresAt && now <= s.expiresAt + WEEK_MS;
}

/**
 * True when the cached subscription's 7-day offline grace has lapsed without a successful store
 * refresh (spec 16.8 / edge case 8): Pro is withdrawn and the Timer shows a soft "couldn't verify" banner.
 */
export function graceLapsed(s: EntitlementInput, now = Date.now(), allowMock = mockProAllowed()): boolean {
  if (allowMock && s.mockPro) return false;
  return s.isPro && s.expiresAt !== null && now > s.expiresAt + WEEK_MS;
}
