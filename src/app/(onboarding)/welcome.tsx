import React, { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { useRouter } from '../../router';
import Animated, {
  Easing, FadeInDown, useAnimatedProps, useSharedValue, withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { Body, PrimaryButton, Screen, Title } from '../../components/ui';
import { icon as iconSize, layout, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { track } from '../../lib/analytics';
import { useReduceMotion } from '../../lib/timerHooks';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const HERO_SIZE = 200;
const HERO_STROKE = 14;
const HERO_TARGET = 0.67; // 16 of 24 hours
const HERO_MS = 900;

/** Decorative 16:8 arc. Fills 0 to 67 percent once on mount; static under reduce motion. */
function HeroRing({ size, color, track: trackColor, reduceMotion }: {
  size: number; color: string; track: string; reduceMotion: boolean;
}) {
  const r = (size - HERO_STROKE) / 2;
  const c = 2 * Math.PI * r;
  const p = useSharedValue(reduceMotion ? HERO_TARGET : 0);
  useEffect(() => {
    if (reduceMotion) { p.value = HERO_TARGET; return; }
    p.value = withTiming(HERO_TARGET, { duration: HERO_MS, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, p]);
  const arc = useAnimatedProps(() => ({ strokeDashoffset: c * (1 - p.value) }));
  return (
    <Svg width={size} height={size} aria-hidden>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={trackColor} strokeWidth={HERO_STROKE} fill="none" />
      <AnimatedCircle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={HERO_STROKE} fill="none" strokeLinecap="round"
        strokeDasharray={`${c} ${c}`} animatedProps={arc} transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
    </Svg>
  );
}

const POINTS = [
  { key: 'point1', icon: 'timer-outline' },
  { key: 'point2', icon: 'notifications-outline' },
  { key: 'point3', icon: 'stats-chart-outline' },
] as const;

export default function Welcome() {
  const { colors } = useTheme();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  useEffect(() => { track('onboarding_step_viewed', { step: 'welcome' }); }, []);
  const enter = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).duration(500));
  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flex: 1, paddingHorizontal: layout.screenX, justifyContent: 'center', gap: space.xxl }}>
        <Animated.View entering={enter(0)} style={{ alignItems: 'center' }}>
          <View style={{ width: HERO_SIZE, height: HERO_SIZE, alignItems: 'center', justifyContent: 'center' }}>
            <HeroRing size={HERO_SIZE} color={colors.fastingRing} track={colors.track} reduceMotion={reduceMotion} />
            <View style={{ position: 'absolute', alignItems: 'center' }}>
              <Text maxFontSizeMultiplier={1.2} style={[type.stat, { color: colors.text }]}>16:8</Text>
              <Text maxFontSizeMultiplier={1.2} style={[type.caption, { color: colors.textSecondary }]}>
                {t('onboarding.welcome.tagline')}
              </Text>
            </View>
          </View>
        </Animated.View>
        <Animated.View entering={enter(120)} style={{ gap: space.md }}>
          <Title style={{ textAlign: 'center' }}>{t('onboarding.welcome.title')}</Title>
          <Body secondary style={{ textAlign: 'center' }}>{t('onboarding.welcome.subtitle')}</Body>
        </Animated.View>
        <Animated.View entering={enter(240)} style={{ gap: space.lg }}>
          {POINTS.map((p) => (
            <View key={p.key} style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
              <Ionicons
                name={p.icon} size={iconSize.lg} color={colors.accent}
                accessibilityElementsHidden importantForAccessibility="no"
              />
              <Text style={[type.body, { color: colors.text, flex: 1 }]}>{t(`onboarding.welcome.${p.key}`)}</Text>
            </View>
          ))}
        </Animated.View>
      </View>
      <View style={{ paddingHorizontal: layout.screenX, paddingBottom: space.lg }}>
        <PrimaryButton label={t('onboarding.welcome.cta')} onPress={() => router.push('/(onboarding)/goal')} />
      </View>
    </Screen>
  );
}
