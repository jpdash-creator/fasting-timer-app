import { useEffect, useState } from 'react';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PurchaseState } from '../types';
import { WEEK_MS, isEntitled, msUntilLapse } from '../lib/entitlement';
import { storage } from './storage';

export { WEEK_MS };

const initial: PurchaseState = {
  isPro: false, source: 'none', expiresAt: null, billingIssue: false, lastCheckedAt: 0,
};

interface PurchaseStoreState extends PurchaseState {
  hasHydrated: boolean;
  /** Dev/mock only: forces Pro on (ignored in release builds, see lib/entitlement). */
  mockPro: boolean;
  setState: (p: PurchaseState) => void;
  setMockPro: (v: boolean) => void;
}

export const usePurchaseStore = create<PurchaseStoreState>()(
  persist(
    (set) => ({
      ...initial,
      hasHydrated: false,
      mockPro: false,
      setState: (p) => set({ ...p }),
      setMockPro: (v) => set({ mockPro: v }),
    }),
    {
      name: 'fw.purchase',
      version: 1,
      storage,
      partialize: (s) =>
        ({
          isPro: s.isPro, source: s.source, expiresAt: s.expiresAt,
          billingIssue: s.billingIssue, lastCheckedAt: s.lastCheckedAt, mockPro: s.mockPro,
        }) as any,
      onRehydrateStorage: () => () => usePurchaseStore.setState({ hasHydrated: true }),
    },
  ),
);

/** Non-hook Pro check for services and plain functions. */
export function isProNow(now = Date.now()): boolean {
  return isEntitled(usePurchaseStore.getState(), now);
}

const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * Single source of truth for Pro. Trusts cached state up to 7 days past expiry (offline grace) and
 * re-renders by itself when that grace lapses, so a long-running session never keeps stale Pro.
 */
export function useIsPro(): boolean {
  const isPro = usePurchaseStore((s) => s.isPro);
  const expiresAt = usePurchaseStore((s) => s.expiresAt);
  const mockPro = usePurchaseStore((s) => s.mockPro);
  const [tick, setTick] = useState(0);
  const input = { isPro, expiresAt, mockPro };

  useEffect(() => {
    const ms = msUntilLapse(input);
    if (ms === null) return undefined;
    const id = setTimeout(() => setTick((n) => n + 1), Math.min(ms + 50, MAX_TIMEOUT));
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro, expiresAt, mockPro, tick]);

  return isEntitled(input);
}
