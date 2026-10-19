import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Image, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '../platform/icons';
import { useLocalSearchParams, useRouter } from '../router';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { haptic, PrimaryButton, Toast } from '../components/ui';
import { BenefitRow, PlanCard } from '../components/paywall/PlanCard';
import { LegalBlock } from '../components/paywall/LegalBlock';
import { BillingIssueBanner } from '../components/banners';
import { hit, icon as iconSize, layout, space, type, useTheme } from '../theme';
import appIconImage from '../../assets/icon.png';
import { t } from '../lib/i18n';
import { track } from '../lib/analytics';
import {
  completeOnboarding, markExpiredShown, markHardDismissed,
} from '../lib/paywallTriggers';
import { useSettingsStore } from '../stores/settingsStore';
import { usePurchaseStore } from '../stores/purchaseStore';
import {
  isMockPurchases, purchases, PurchaseCancelledError, PurchasePendingError,
  type Offering, type PlanId, type PlanPackage,
} from '../services/purchases';

/** Flip to true once the store listing has real ratings. Fabricated social proof is not allowed. */
const SHOW_SOCIAL_PROOF = false;
const SOCIAL_PROOF_RATING = '4.8';
const CLOSE_DELAY_MS = 3000;

type LoadState = 'loading' | 'ready' | 'unavailable';
type Banner = { kind: 'info' | 'error'; text: string } | null;

export default function Paywall() {
  const { colors, radius } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ trigger?: string; feature?: string }>();
  const trigger = params.trigger ?? 'settings';
  const mode = useSettingsStore((s) => s.settings.paywallMode);
  const isOnboarding = trigger === 'onboarding';
  const isHardGate = mode === 'hard' && (isOnboarding || trigger === 'hard_launch');
  const delayedClose = isOnboarding || trigger === 'hard_launch' || trigger === 'expired';

  const [load, setLoad] = useState<LoadState>('loading');
  const [offering, setOffering] = useState<Offering | null>(null);
  const [selected, setSelected] = useState<PlanId>('annual');
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState<Banner>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [closeVisible, setCloseVisible] = useState(!delayedClose);
  const finished = useRef(false);

  useEffect(() => {
    track('paywall_viewed', { trigger, mode });
    if (trigger === 'expired') markExpiredShown();
  }, [trigger, mode]);

  useEffect(() => {
    if (closeVisible) return;
    const id = setTimeout(() => setCloseVisible(true), CLOSE_DELAY_MS);
    return () => clearTimeout(id);
  }, [closeVisible]);

  // Android back must not bypass the delayed close button.
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => !closeVisible);
    return () => sub.remove();
  }, [closeVisible]);

  const fetchOffering = useCallback(async () => {
    setLoad('loading');
    try {
      const o = await Promise.race<Offering | null>([
        purchases.getOffering(),
        new Promise<null>((r) => setTimeout(() => r(null), 12000)),
      ]);
      if (!o || o.packages.length === 0) { setLoad('unavailable'); return; }
      setOffering(o);
      const ids = o.packages.map((p) => p.id);
      setSelected((cur) => (ids.includes(cur) ? cur : (ids.find((i) => i !== 'lifetime') ?? ids[0])));
      setLoad('ready');
    } catch {
      setLoad('unavailable');
    }
  }, []);
  useEffect(() => { void fetchOffering(); }, [fetchOffering]);

  const pkgs = offering?.packages ?? [];
  const byId = (id: PlanId) => pkgs.find((p) => p.id === id);
  const subs = (['annual', 'monthly', 'weekly'] as PlanId[]).map(byId).filter((p): p is PlanPackage => !!p);
  const lifetime = byId('lifetime');
  const current = byId(selected) ?? subs[0] ?? null;

  const ctaLabel = useMemo(() => {
    if (busy) return t('paywall.cta.purchasing');
    if (!current) return t('paywall.cta.annual', { price: '' }).trim();
    if (current.id === 'lifetime') return t('paywall.cta.lifetime', { price: current.priceString });
    if (current.trialDays > 0) return t('paywall.cta.trial', { days: current.trialDays });
    return t(`paywall.cta.${current.id}`, { price: current.priceString });
  }, [current, busy]);

  const finish = useCallback(() => {
    if (finished.current) return;
    finished.current = true;
    if (isOnboarding) completeOnboarding();
    if (router.canGoBack() && !isOnboarding) router.back();
    else router.replace('/');
  }, [isOnboarding, router]);

  const close = useCallback(() => {
    if (busy) return;
    if (isOnboarding) {
      if (mode === 'hard') { router.replace('/(onboarding)/plan-summary'); return; }
      finish();
      return;
    }
    if (trigger === 'hard_launch') markHardDismissed();
    if (router.canGoBack()) router.back(); else router.replace('/');
  }, [busy, isOnboarding, mode, finish, router, trigger]);

  const succeed = useCallback((msg: string) => {
    haptic('success');
    setToast(msg);
    setTimeout(finish, 1300);
  }, [finish]);

  const onSelect = (id: PlanId) => {
    haptic('light');
    setSelected(id);
    track('paywall_plan_selected', { plan: id });
  };

  const onRestore = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const st = await purchases.restore();
      track('restore_completed', { pro: st.isPro });
      if (st.isPro) succeed(t('paywall.state.restored'));
      else setBanner({ kind: 'info', text: t('paywall.state.nothingToRestore') });
    } catch {
      setBanner({ kind: 'error', text: t('paywall.state.error') });
    } finally {
      setBusy(false);
    }
  }, [busy, succeed]);

  const onPurchase = useCallback(async (pkg: PlanPackage | null) => {
    if (!pkg || busy) return;
    setBusy(true);
    setBanner(null);
    try {
      const st = await purchases.purchase(pkg);
      if (st.isPro) {
        track(pkg.trialDays > 0 ? 'trial_started' : 'purchase_completed', { plan: pkg.id });
        succeed(t('paywall.state.success'));
      }
    } catch (e: any) {
      if (e instanceof PurchaseCancelledError) {
        // silent
      } else if (e instanceof PurchasePendingError) {
        setBanner({ kind: 'info', text: t('paywall.state.pending') });
      } else {
        track('purchase_failed', { code: String(e?.code ?? 'unknown') });
        setBanner({ kind: 'error', text: t('paywall.state.error') });
      }
    } finally {
      setBusy(false);
    }
  }, [busy, succeed]);

  // A purchase that completed out-of-band (e.g. Android pending approval) unlocks the flow.
  const isPro = usePurchaseStore((s) => s.isPro);
  const wasPro = useRef(isPro);
  useEffect(() => {
    if (isPro && !wasPro.current && !finished.current) succeed(t('paywall.state.success'));
    wasPro.current = isPro;
  }, [isPro, succeed]);

  // Deep link / stale route for someone who already owns Pro: nothing to sell, leave.
  useEffect(() => {
    if (wasPro.current && !isOnboarding) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const headline = isOnboarding ? t('paywall.headlineOnboarding')
    : trigger === 'expired' ? t('paywall.expired.headline') : t('paywall.headline');
  const subhead = trigger === 'expired' ? t('paywall.expired.sub')
    : isHardGate ? t('paywall.hardNote')
    : ['gate', 'post_fast', 'settings'].includes(trigger) ? t(`paywall.trigger.${trigger}`) : t('paywall.subhead');

  return (
    <SafeAreaView role="main" edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ height: hit.comfortable, justifyContent: 'center', paddingLeft: space.sm }}>
        {closeVisible ? (
          <Animated.View entering={FadeIn.duration(250)}>
            <Pressable
              accessibilityRole="button" accessibilityLabel={t('paywall.close')} onPress={close} hitSlop={8}
              disabled={busy}
              style={{ width: hit.min + 4, height: hit.min + 4, alignItems: 'center', justifyContent: 'center', opacity: busy ? 0.4 : 1 }}
            >
              <Ionicons name="close" size={iconSize.lg} color={colors.textSecondary} />
            </Pressable>
          </Animated.View>
        ) : null}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingBottom: layout.scrollBottom / 2, gap: layout.sectionGap }} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(450)} style={{ alignItems: 'center', gap: space.md }}>
          <Image
            source={appIconImage} accessibilityIgnoresInvertColors
            style={{ width: 72, height: 72, borderRadius: radius.card }} accessibilityElementsHidden importantForAccessibility="no"
          />
          <Text accessibilityRole="header" style={[type.title, { color: colors.text, textAlign: 'center' }]}>{headline}</Text>
          <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center' }]}>{subhead}</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(100).duration(450)} style={{ gap: space.xs }}>
          <BenefitRow icon="timer-outline" label={t('paywall.benefit1')} />
          <BenefitRow icon="notifications-outline" label={t('paywall.benefit2')} />
          <BenefitRow icon="stats-chart-outline" label={t('paywall.benefit3')} />
        </Animated.View>

        {SHOW_SOCIAL_PROOF ? (
          <View style={{ flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: space.xs }}>
            <Ionicons name="star" size={iconSize.sm} color={colors.eatingText} />
            <Text style={[type.label, { color: colors.text }]}>{t('paywall.socialProof', { rating: SOCIAL_PROOF_RATING })}</Text>
          </View>
        ) : null}

        <BillingIssueBanner />

        {banner ? (
          <View
            accessibilityRole="alert" accessible
            style={{
              padding: space.md, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1.5,
              borderColor: banner.kind === 'error' ? colors.danger : colors.controlBorder,
            }}
          >
            <Text style={[type.body, { color: colors.text }]}>{banner.text}</Text>
          </View>
        ) : null}

        {load === 'loading' ? (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }} accessibilityLiveRegion="polite">
            <ActivityIndicator color={colors.accent} />
            <Text style={[type.body, { color: colors.textSecondary }]}>{t('paywall.state.loading')}</Text>
          </View>
        ) : null}

        {load === 'unavailable' ? (
          <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.md }}>
            <Text accessibilityRole="alert" style={[type.body, { color: colors.text, textAlign: 'center' }]}>{t('paywall.state.unavailable')}</Text>
            <PrimaryButton variant="secondary" label={t('paywall.state.retry')} onPress={fetchOffering} style={{ alignSelf: 'stretch' }} />
            <LegalBlock pkg={null} onRestore={onRestore} busy={busy} />
          </View>
        ) : null}

        {load === 'ready' ? (
          <Animated.View entering={FadeInDown.delay(150).duration(450)} style={{ gap: space.lg }}>
            <View accessibilityRole="radiogroup" style={{ gap: space.md }}>
              {subs.map((p) => (
                <PlanCard key={p.id} pkg={p} monthly={byId('monthly')} selected={selected === p.id} onPress={() => onSelect(p.id)} disabled={busy} />
              ))}
            </View>

            <PrimaryButton label={ctaLabel} onPress={() => onPurchase(current)} disabled={busy || !current} />

            {lifetime ? (
              <Pressable
                accessibilityRole="button" accessibilityLabel={t('paywall.lifetime', { price: lifetime.priceString })}
                disabled={busy} onPress={() => onPurchase(lifetime)}
                style={{ minHeight: hit.min, alignItems: 'center', justifyContent: 'center' }}
              >
                <Text style={[type.label, { color: colors.accent, textAlign: 'center' }]}>
                  {t('paywall.lifetime', { price: lifetime.priceString })}
                </Text>
              </Pressable>
            ) : null}

            <LegalBlock pkg={current} onRestore={onRestore} busy={busy} />
            {isMockPurchases && __DEV__ ? (
              <Text style={[type.micro, { color: colors.textSecondary, textAlign: 'center' }]}>{t('paywall.state.mockNote')}</Text>
            ) : null}
          </Animated.View>
        ) : null}
      </ScrollView>

      {toast ? <Toast message={toast} bottom={space.xxl} /> : null}
    </SafeAreaView>
  );
}

