import 'react-native-gesture-handler';
import { useEffect, useRef, useState } from 'react';
import { AppState, I18nManager, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFastStore } from '../stores/fastStore';
import { useLogStore } from '../stores/logStore';
import { useIsPro, usePurchaseStore } from '../stores/purchaseStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useTheme } from '../theme';
import { purchases } from '../services/purchases';
import { RTL_LANGS, setLanguage } from '../lib/i18n';
import {
  isHardDismissed, shouldShowExpiredPaywall, usePaywallMeta,
} from '../lib/paywallTriggers';
import {
  initNotifications, rescheduleAll, subscribeToNotificationResponses,
} from '../services/notifications';

SplashScreen.preventAutoHideAsync().catch(() => {});

function useHydrated() {
  const a = useSettingsStore((s) => s.hasHydrated);
  const b = useFastStore((s) => s.hasHydrated);
  const c = useLogStore((s) => s.hasHydrated);
  const d = usePurchaseStore((s) => s.hasHydrated);
  const e = usePaywallMeta((s) => s.hasHydrated);
  return a && b && c && d && e;
}

export default function RootLayout() {
  const hydrated = useHydrated();
  const { colors, scheme } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const onboardingDone = useSettingsStore((s) => s.settings.onboardingDone);
  const language = useSettingsStore((s) => s.settings.language);
  // Set the locale during render (not only in an effect) so the first paint after hydration is already translated.
  setLanguage(language);
  const paywallMode = useSettingsStore((s) => s.settings.paywallMode);
  const planReady = usePaywallMeta((s) => s.planReady);
  const everPro = usePaywallMeta((s) => s.everPro);
  const isPro = useIsPro();
  const [purchasesReady, setPurchasesReady] = useState(false);
  const launchHandled = useRef(false);

  useEffect(() => {
    setLanguage(language);
    const rtl = RTL_LANGS.includes((language || '').split('-')[0]);
    if (I18nManager.isRTL !== rtl) I18nManager.forceRTL(rtl);
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      // WCAG 3.1.1: page language + direction follow the in-app language.
      const tag = language || (typeof navigator !== 'undefined' ? navigator.language : '') || 'en';
      document.documentElement.lang = tag;
      document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    }
  }, [language]);

  // Web only: visible keyboard focus ring on every focusable RN element (WCAG 2.4.7 / 2.4.11).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    let el = document.getElementById('fl-focus-style') as HTMLStyleElement | null;
    if (!el) { el = document.createElement('style'); el.id = 'fl-focus-style'; document.head.appendChild(el); }
    el.textContent = `[tabindex]:focus-visible,button:focus-visible,input:focus-visible,a:focus-visible{outline:3px solid ${colors.accent} !important;outline-offset:2px !important;}`;
  }, [colors.accent]);

  // Web only: Space activates radio / tab / checkbox elements like a native control (react-native-web handles Enter only).
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' || e.repeat) return;
      const el = e.target as HTMLElement | null;
      const role = el?.getAttribute?.('role');
      if (!el || el.tagName === 'INPUT' || el.tagName === 'BUTTON' || el.tagName === 'TEXTAREA') return;
      if (role === 'radio' || role === 'tab' || role === 'checkbox') { e.preventDefault(); el.click(); }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    SplashScreen.hideAsync().catch(() => {});
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
    if (!hydrated) return;
    const root = segments[0] as string | undefined;
    const inOnboarding = root === '(onboarding)';
    const inPaywall = root === 'paywall';
    if (!onboardingDone) {
      if (inOnboarding || inPaywall) return;
      if (paywallMode === 'hard' && planReady) router.replace({ pathname: '/paywall', params: { trigger: 'onboarding' } });
      else router.replace('/(onboarding)/welcome');
    } else if (inOnboarding) {
      router.replace('/');
    }
  }, [hydrated, onboardingDone, paywallMode, planReady, segments, router]);

  // Launch paywall: hard mode and not Pro, or (soft) an expired trial / subscription, at most once per day.
  useEffect(() => {
    if (!hydrated || !purchasesReady || !onboardingDone || launchHandled.current) return;
    launchHandled.current = true;
    if (paywallMode === 'hard') {
      if (!isPro && !isHardDismissed()) router.push({ pathname: '/paywall', params: { trigger: 'hard_launch' } });
    } else if (shouldShowExpiredPaywall(isPro)) {
      router.push({ pathname: '/paywall', params: { trigger: 'expired' } });
    }
  }, [hydrated, purchasesReady, onboardingDone, paywallMode, isPro, router]);

  if (!hydrated) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.bg }}>
      <SafeAreaProvider>
        <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
          <Stack.Screen name="paywall" options={{ presentation: 'modal', gestureEnabled: false }} />
          {[
            'protocol-picker', 'fast-editor', 'fast-summary', 'log-weight', 'log-water',
            'stage-info', 'share-card',
          ].map((name) => (
            <Stack.Screen key={name} name={name} options={{ presentation: 'modal' }} />
          ))}
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
