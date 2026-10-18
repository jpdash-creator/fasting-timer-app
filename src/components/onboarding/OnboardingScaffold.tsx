import React, { useEffect } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { Body, PrimaryButton, Screen, Title } from '../ui';
import { hit, icon as iconSize, layout, radius as radii, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { track } from '../../lib/analytics';

export const ONBOARDING_STEPS = 7; // goal .. plan-summary (welcome has no progress)

export function ProgressBar({ current, total }: { current: number; total: number }) {
  const { colors } = useTheme();
  const w = useSharedValue((current - 1) / total);
  useEffect(() => { w.value = withTiming(current / total, { duration: 380 }); }, [current, total, w]);
  const fill = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View
      accessible accessibilityRole="progressbar"
      accessibilityLabel={t('onboarding.progress', { current, total })}
      accessibilityValue={{ min: 0, max: total, now: current }}
      style={{ height: 6, borderRadius: radii.bar, backgroundColor: colors.track, overflow: 'hidden', flex: 1 }}
    >
      <Animated.View style={[{ height: 6, borderRadius: radii.bar, backgroundColor: colors.accent }, fill]} />
    </View>
  );
}

export function OnboardingScaffold({
  step, stepName, title, subtitle, children, ctaLabel, onContinue, canContinue = true,
  footerExtra, backTarget, scroll = true,
}: {
  step: number; stepName: string; title: string; subtitle?: string; children: React.ReactNode;
  ctaLabel?: string; onContinue: () => void; canContinue?: boolean; footerExtra?: React.ReactNode;
  backTarget?: string; scroll?: boolean;
}) {
  const { colors } = useTheme();
  const router = useRouter();

  useEffect(() => { track('onboarding_step_viewed', { step: stepName }); }, [stepName]);

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace((backTarget ?? '/(onboarding)/welcome') as any);
  };

  const content = (
    <View style={{ paddingHorizontal: layout.screenX, paddingTop: space.lg, gap: space.sm }}>
      <Title>{title}</Title>
      {subtitle ? <Body secondary>{subtitle}</Body> : null}
      <View style={{ marginTop: space.lg, gap: space.md }}>{children}</View>
    </View>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.sm, paddingTop: space.sm }}>
        <Pressable
          accessibilityRole="button" accessibilityLabel={t('onboarding.back')}
          onPress={goBack} hitSlop={8}
          style={{ width: hit.min + 4, height: hit.min + 4, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="chevron-back" size={iconSize.lg} color={colors.text} />
        </Pressable>
        <ProgressBar current={step} total={ONBOARDING_STEPS} />
        <View style={{ width: hit.min + 4 }} />
      </View>
      {scroll ? (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: layout.sectionGap }} keyboardShouldPersistTaps="handled">
          {content}
        </ScrollView>
      ) : (
        <View style={{ flex: 1 }}>{content}</View>
      )}
      <View style={{ paddingHorizontal: layout.screenX, paddingBottom: space.lg, paddingTop: space.sm, gap: space.sm }}>
        {footerExtra}
        <PrimaryButton
          label={ctaLabel ?? t('onboarding.continue')}
          onPress={onContinue}
          disabled={!canContinue}
        />
      </View>
    </Screen>
  );
}

export function OptionCard({ label, hint, selected, onPress, icon, badge }: {
  label: string; hint?: string; selected: boolean; onPress: () => void;
  icon?: keyof typeof Ionicons.glyphMap; badge?: string;
}) {
  const { colors, radius } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      aria-checked={selected}
      accessibilityLabel={[label, badge, hint].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: hit.comfortable + 8, flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card,
        // Selection = border + radio only; fill and icon stay constant to cut noise.
        backgroundColor: colors.surface,
        borderWidth: selected ? 2 : 1.5, borderColor: selected ? colors.accent : colors.controlBorder,
        opacity: pressed ? 0.9 : 1, transform: [{ scale: pressed ? 0.985 : 1 }],
      })}
    >
      {icon ? <Ionicons name={icon} size={iconSize.md + 2} color={colors.accent} /> : null}
      <View style={{ flex: 1, gap: space.xs / 2 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={[type.bodyEmphasis, { color: colors.text, flexShrink: 1 }]}>{label}</Text>
          {badge ? (
            <View style={{ backgroundColor: colors.accent, borderRadius: radii.chip, paddingHorizontal: space.sm, paddingVertical: space.xs / 2 }}>
              <Text style={[type.micro, { color: colors.onAccent, fontWeight: '700' }]}>{badge}</Text>
            </View>
          ) : null}
        </View>
        {hint ? <Text style={[type.caption, { color: colors.textSecondary }]}>{hint}</Text> : null}
      </View>
      <View
        style={{
          width: 24, height: 24, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center',
          borderWidth: 2, borderColor: selected ? colors.accent : colors.controlBorder,
          backgroundColor: selected ? colors.accent : 'transparent',
        }}
      >
        {selected ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
      </View>
    </Pressable>
  );
}
