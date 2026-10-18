import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, {
  FadeInDown, useAnimatedStyle, useSharedValue, withDelay, withSpring, withTiming,
} from 'react-native-reanimated';
import { OnboardingScaffold } from '../../components/onboarding/OnboardingScaffold';
import { planWindow } from '../../components/onboarding/draft';
import { hit, icon as iconSize, space, type, useTheme } from '../../theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { getProtocol } from '../../lib/protocols';
import { completeOnboarding, usePaywallMeta } from '../../lib/paywallTriggers';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { haptic } from '../../components/ui';
import { t } from '../../lib/i18n';
import { useReduceMotion } from '../../lib/timerHooks';

function CheckRow({ label, delay }: { label: string; delay: number }) {
  const { colors, radius } = useTheme();
  const reduceMotion = useReduceMotion();
  const s = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (reduceMotion) { s.value = 1; return; }
    s.value = withDelay(delay, withSpring(1, { damping: 12, stiffness: 160 }));
  }, [delay, s, reduceMotion]);
  const pop = useAnimatedStyle(() => ({ transform: [{ scale: s.value }], opacity: withTiming(s.value > 0 ? 1 : 0) }));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.min - 8 }} accessible role="group" accessibilityLabel={label}>
      <Animated.View
        style={[{ width: iconSize.lg + 2, height: iconSize.lg + 2, borderRadius: radius.chip, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' }, pop]}
      >
        <Ionicons name="checkmark" size={iconSize.sm} color={colors.onAccent} />
      </Animated.View>
      <Text style={[type.body, { color: colors.text, flex: 1 }]}>{label}</Text>
    </View>
  );
}

export default function PlanSummary() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const reduceMotion = useReduceMotion();
  const settings = useSettingsStore((s) => s.settings);
  const proto = getProtocol(settings.activeProtocolId, settings);
  const w = planWindow(settings.firstMeal, settings.lastMeal, proto.id, proto.eatingMinutes);
  const to = proto.eatingMinutes > 0 ? w.to : settings.lastMeal;
  const hard = settings.paywallMode === 'hard';

  useEffect(() => {
    usePaywallMeta.getState().patch({ planReady: true });
    haptic('success');
  }, []);

  const line1 = t('onboarding.summary.plan', { protocol: proto.name });
  const line2 = t('onboarding.summary.window', { from: w.from, to });
  const line3 = t('onboarding.summary.first', { time: to });

  return (
    <OnboardingScaffold
      step={7} stepName="plan_summary" title={t('onboarding.summary.title')}
      ctaLabel={hard ? t('onboarding.summary.ctaHard') : t('onboarding.summary.cta')}
      backTarget="/(onboarding)/reminders"
      onContinue={() => {
        const ps = usePurchaseStore.getState();
        if (ps.isPro || ps.mockPro) completeOnboarding();
        else router.replace({ pathname: '/paywall', params: { trigger: 'onboarding' } });
      }}
    >
      <Animated.View
        entering={reduceMotion ? undefined : FadeInDown.duration(500)} accessible role="group" accessibilityLabel={t('onboarding.summary.a11y', { protocol: proto.name, from: w.from, to, time: to })}
        style={{ padding: space.xl, borderRadius: radius.card, backgroundColor: colors.accentSoft, gap: space.xs }}
      >
        <Text style={[type.title, { color: colors.text }]}>{line1}</Text>
        <Text style={[type.body, type.tabular, { color: colors.text }]}>{line2}</Text>
        <Text style={[type.body, type.tabular, { color: colors.text }]}>{line3}</Text>
      </Animated.View>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        <CheckRow label={t('onboarding.summary.check1')} delay={500} />
        <CheckRow label={t('onboarding.summary.check2')} delay={900} />
        <CheckRow label={t('onboarding.summary.check3')} delay={1300} />
      </View>
      {hard ? <Text style={[type.label, { color: colors.textSecondary, fontWeight: '400' }]}>{t('onboarding.summary.unlockNote')}</Text> : null}
    </OnboardingScaffold>
  );
}
