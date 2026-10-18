import { useRouter } from 'expo-router';
import { useIsPro } from '../stores/purchaseStore';
import { useSettingsStore } from '../stores/settingsStore';

/**
 * Gate a Pro-only action. Returns a function: `gate('csv_export', () => doExport())`.
 * Pro users run the action; others are sent to the paywall modal with the trigger as a param.
 * (Hard mode: non-Pro users never reach the app beyond onboarding, but gating still applies.)
 */
export function useProGate() {
  const isPro = useIsPro();
  const router = useRouter();
  return (feature: string, action: () => void) => {
    if (isPro) return action();
    router.push({ pathname: '/paywall', params: { trigger: 'gate', feature } });
  };
}

export function usePaywallMode() {
  return useSettingsStore((s) => s.settings.paywallMode);
}
