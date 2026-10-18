import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, I18nManager, StatusBar } from 'react-native';
import { DarkTheme, DefaultTheme, NavigationContainer, type Theme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFastStore } from './stores/fastStore';
import { useLogStore } from './stores/logStore';
import { useIsPro, usePurchaseStore } from './stores/purchaseStore';
import { useSettingsStore } from './stores/settingsStore';
import { useTheme } from './theme';
import { purchases } from './services/purchases';
import { RTL_LANGS, setLanguage } from './lib/i18n';
import {
  isHardDismissed, shouldShowExpiredPaywall, usePaywallMeta,
} from './lib/paywallTriggers';
import {
  initNotifications, rescheduleAll, subscribeToNotificationResponses,
} from './services/notifications';
import { hideSplash } from './platform/splash';
import { useWebDocumentEffects } from './navigation/webEffects';
import RootNavigator from './navigation/RootNavigator';
import { linking } from './navigation/linking';
import { navigationRef } from './navigation/navigationRef';
import { flushPendingNavigation, router } from './router';


function useHydrated() {
  const a = useSettingsStore((s) => s.hasHydrated);
  const b = useFastStore((s) => s.hasHydrated);
  const c = useLogStore((s) => s.hasHydrated);
  const d = usePurchaseStore((s) => s.hasHydrated);
  const e = usePaywallMeta((s) => s.hasHydrated);
  return a && b && c && d && e;
}

/** Name of the focused root-stack route ('Tabs' | 'Onboarding' | 'Paywall' | ...): the old `useSegments()[0]`. */
function currentRootRoute(): string | undefined {
  if (!navigationRef.isReady()) return undefined;
  const s = navigationRef.getRootState();
  return s?.routes[s.index]?.name;
}

export default function App() {
  const hydrated = useHydrated();
  const { colors, scheme } = useTheme();
  const onboardingDone = useSettingsStore((s) => s.settings.onboardingDone);
  const language = useSettingsStore((s) => s.settings.language);
  // Set the locale during render (not only in an effect) so the first paint after hydration is already translated.
  setLanguage(language);
  const paywallMode = useSettingsStore((s) => s.settings.paywallMode);
  const planReady = usePaywallMeta((s) => s.planReady);
  const everPro = usePaywallMeta((s) => s.everPro);
  const isPro = useIsPro();
  const [purchasesReady, setPurchasesReady] = useState(false);
  const [rootRoute, setRootRoute] = useState<string | undefined>(undefined);
  const launchHandled = useRef(false);

  useEffect(() => {
    setLanguage(language);
    const rtl = RTL_LANGS.includes((language || '').split('-')[0]);
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
  }, [language]);

  // Web only: <html lang/dir>, focus-visible ring, Space-key activation.
  useWebDocumentEffects(language, colors.accent);

  useEffect(() => {
    if (!hydrated) return;
    void hideSplash();
    purchases.init().then(() => purchases.refresh()).catch(() => {}).finally(() => setPurchasesReady(true));
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') {
        purchases.refresh().catch(() => {});
        void rescheduleAll();
      }
    });
    return () => sub.remove();
  }, [hydrated]);

  // Notifications: handler, tap-to-open, and re-sync whenever fasts / reminder settings / Pro change.
  useEffect(() => {
    if (!hydrated) return;
    initNotifications();
    const unsubResponses = subscribeToNotificationResponses();
    void rescheduleAll();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const queue = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { void rescheduleAll(); }, 400);
    };
    const u1 = useFastStore.subscribe((s, p) => {
      if (s.fasts !== p.fasts || s.activeFastId !== p.activeFastId) queue();
    });
    const u2 = useSettingsStore.subscribe((s, p) => {
      const a = s.settings;
      const b = p.settings;
      if (
        a.reminders !== b.reminders || a.firstMeal !== b.firstMeal || a.lastMeal !== b.lastMeal ||
        a.activeProtocolId !== b.activeProtocolId || a.customProtocols !== b.customProtocols
      ) queue();
    });
    const u3 = usePurchaseStore.subscribe((s, p) => {
      if (s.isPro !== p.isPro || s.mockPro !== p.mockPro) queue();
    });
    return () => {
      if (timer) clearTimeout(timer);
      unsubResponses(); u1(); u2(); u3();
    };
  }, [hydrated]);

  // Remember that the user has held Pro, so we can detect an expired trial / subscription later.
  useEffect(() => {
    if (hydrated && isPro && !everPro) usePaywallMeta.getState().patch({ everPro: true });
  }, [hydrated, isPro, everPro]);

  // Onboarding routing. Hard mode: plan completed but not unlocked -> paywall re-shown on next launch.
  useEffect(() => {
    if (!hydrated || !rootRoute) return;
    const inOnboarding = rootRoute === 'Onboarding';
    const inPaywall = rootRoute === 'Paywall';
    if (!onboardingDone) {
      if (inOnboarding || inPaywall) return;
      if (paywallMode === 'hard' && planReady) router.replace({ pathname: '/paywall', params: { trigger: 'onboarding' } });
      else router.replace('/(onboarding)/welcome');
    } else if (inOnboarding) {
      router.replace('/');
    }
  }, [hydrated, onboardingDone, paywallMode, planReady, rootRoute]);

  // Launch paywall: hard mode and not Pro, or (soft) an expired trial / subscription, at most once per day.
  useEffect(() => {
    if (!hydrated || !purchasesReady || !rootRoute || !onboardingDone || launchHandled.current) return;
    launchHandled.current = true;
    if (paywallMode === 'hard') {
      if (!isPro && !isHardDismissed()) router.push({ pathname: '/paywall', params: { trigger: 'hard_launch' } });
    } else if (shouldShowExpiredPaywall(isPro)) {
      router.push({ pathname: '/paywall', params: { trigger: 'expired' } });
    }
  }, [hydrated, purchasesReady, rootRoute, onboardingDone, paywallMode, isPro]);

  // Initial root route is decided once, from the hydrated stores (a URL on web / a deep link overrides it).
  const initial = useRef<{ route: 'Tabs' | 'Onboarding' | 'Paywall'; hardPaywall: boolean } | null>(null);
  if (hydrated && !initial.current) {
    const hardPaywall = !onboardingDone && paywallMode === 'hard' && planReady;
    initial.current = { route: onboardingDone ? 'Tabs' : hardPaywall ? 'Paywall' : 'Onboarding', hardPaywall };
  }

  const navTheme = useMemo<Theme>(() => {
    const base = scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: colors.accent, background: colors.bg, card: colors.surface,
        text: colors.text, border: colors.border, notification: colors.danger,
      },
    };
  }, [colors, scheme]);

  const syncRoute = useCallback(() => setRootRoute(currentRootRoute()), []);
  const onReady = useCallback(() => { syncRoute(); flushPendingNavigation(); }, [syncRoute]);

  if (!hydrated || !initial.current) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar barStyle={scheme === 'dark' ? 'light-content' : 'dark-content'} />
        <NavigationContainer
          ref={navigationRef}
          theme={navTheme}
          linking={linking}
          documentTitle={{ enabled: false }}
          onReady={onReady}
          onStateChange={syncRoute}
        >
          <RootNavigator
            initialRouteName={initial.current.route}
            initialPaywallParams={initial.current.hardPaywall ? { trigger: 'onboarding' } : undefined}
          />
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
