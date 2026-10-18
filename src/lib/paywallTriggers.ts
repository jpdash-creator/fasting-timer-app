import { useCallback } from 'react';
import { useRouter } from '../router';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { storage } from '../stores/storage';
import { useFastStore } from '../stores/fastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { isProNow, useIsPro } from '../stores/purchaseStore';
import { getProtocol } from './protocols';
import { track } from './analytics';

export type PaywallTrigger = 'onboarding' | 'gate' | 'post_fast' | 'settings' | 'expired' | 'hard_launch';

const DAY_MS = 86_400_000;

interface PaywallMeta {
  hasHydrated: boolean;
  /** Onboarding plan summary reached (used to re-show the paywall in hard mode). */
  planReady: boolean;
  /** User has held Pro at some point (to detect expiry). */
  everPro: boolean;
  /** The post-3rd-fast offer has been shown. */
  postFastShown: boolean;
  lastExpiredShownAt: number;
  patch: (p: Partial<Omit<PaywallMeta, 'patch' | 'hasHydrated'>>) => void;
}

export const usePaywallMeta = create<PaywallMeta>()(
  persist(
    (set) => ({
      hasHydrated: false,
      planReady: false,
      everPro: false,
      postFastShown: false,
      lastExpiredShownAt: 0,
      patch: (p) => set(p),
    }),
    {
      name: 'fw.paywallMeta',
      version: 1,
      storage,
      partialize: (s) =>
        ({
          planReady: s.planReady, everPro: s.everPro, postFastShown: s.postFastShown,
          lastExpiredShownAt: s.lastExpiredShownAt,
        }) as any,
      onRehydrateStorage: () => () => usePaywallMeta.setState({ hasHydrated: true }),
    },
  ),
);

/** Expired trial/subscription on launch: at most once per day. */
export function shouldShowExpiredPaywall(isPro: boolean, now = Date.now()): boolean {
  const m = usePaywallMeta.getState();
  return m.everPro && !isPro && now - m.lastExpiredShownAt >= DAY_MS;
}

export function markExpiredShown(now = Date.now()) {
  usePaywallMeta.getState().patch({ lastExpiredShownAt: now });
}

/**
 * Call after the 3rd completed fast's celebration/summary. Soft mode only, non-Pro only,
 * shows the paywall once. Returns true if the paywall was opened.
 */
export function usePostFastPaywall(): () => boolean {
  const router = useRouter();
  const isPro = useIsPro();
  return useCallback(() => {
    const { paywallMode } = useSettingsStore.getState().settings;
    if (paywallMode !== 'soft' || isPro) return false;
    const completed = useFastStore.getState().fasts.filter((f) => f.endAt !== null).length;
    const meta = usePaywallMeta.getState();
    if (completed < 3 || meta.postFastShown) return false;
    meta.patch({ postFastShown: true });
    router.push({ pathname: '/paywall', params: { trigger: 'post_fast' } });
    return true;
  }, [isPro, router]);
}

/** Settings -> "Upgrade to Pro". */
export function useOpenUpgrade() {
  const router = useRouter();
  return useCallback(
    () => router.push({ pathname: '/paywall', params: { trigger: 'settings' } }),
    [router],
  );
}

/** Hard-mode launch paywall: dismissed once for this app session. */
let hardDismissedThisSession = false;
export const isHardDismissed = () => hardDismissedThisSession;
export const markHardDismissed = () => { hardDismissedThisSession = true; };

/**
 * Finish onboarding after the paywall was handled (purchase, or close in soft mode).
 * Free users on a Pro-only protocol fall back to 16:8 (the free protocol).
 */
export function completeOnboarding() {
  const store = useSettingsStore.getState();
  const s = store.settings;
  const pro = isProNow();
  const patch: Partial<typeof s> = { onboardingDone: true };
  if (!pro && getProtocol(s.activeProtocolId, s).proOnly) patch.activeProtocolId = '16_8';
  store.update(patch);
  usePaywallMeta.getState().patch({ planReady: false });
  track('onboarding_completed', { mode: s.paywallMode, pro });
}
