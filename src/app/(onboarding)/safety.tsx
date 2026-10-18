import React, { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { useRouter } from '../../router';
import { OnboardingScaffold } from '../../components/onboarding/OnboardingScaffold';
import { useOnboardingDraft } from '../../components/onboarding/draft';
import { Caption } from '../../components/ui';
import { hit, icon as iconSize, space, type, useTheme } from '../../theme';
import { useSettingsStore } from '../../stores/settingsStore';
import { t } from '../../lib/i18n';

const KEYS = ['adult', 'pregnant', 'medical'] as const;

export default function SafetyStep() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const safety = useOnboardingDraft((s) => s.safety);
  const toggle = useOnboardingDraft((s) => s.toggleSafety);
  const [warned, setWarned] = useState(false);
  const all = safety.every(Boolean);
  const showWarning = warned && !all;

  const proceed = () => {
    useSettingsStore.getState().update({ safetyAcknowledged: true });
    router.push('/(onboarding)/protocol');
  };

  return (
    <OnboardingScaffold
      step={4} stepName="safety" title={t('onboarding.safety.title')} subtitle={t('onboarding.safety.subtitle')}
      ctaLabel={showWarning ? t('onboarding.safety.understand') : undefined}
      onContinue={() => { if (all || showWarning) proceed(); else setWarned(true); }}
    >
      {KEYS.map((k, i) => {
        const on = safety[i];
        return (
          <Pressable
            key={k} accessibilityRole="checkbox" aria-checked={on}
            accessibilityLabel={t(`onboarding.safety.${k}`)} onPress={() => toggle(i as 0 | 1 | 2)}
            style={{
              minHeight: hit.comfortable + 8, flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg,
              borderRadius: radius.card, backgroundColor: colors.surface,
              borderWidth: on ? 2 : 1.5, borderColor: on ? colors.accent : colors.controlBorder,
            }}
          >
            <View style={{
              width: iconSize.lg, height: iconSize.lg, borderRadius: radius.control / 2, alignItems: 'center', justifyContent: 'center',
              borderWidth: 2, borderColor: on ? colors.accent : colors.controlBorder,
              backgroundColor: on ? colors.accent : 'transparent',
            }}>
              {on ? <Ionicons name="checkmark" size={iconSize.sm} color={colors.onAccent} /> : null}
            </View>
            <Text style={[type.body, { flex: 1, color: colors.text }]}>{t(`onboarding.safety.${k}`)}</Text>
          </Pressable>
        );
      })}
      {showWarning ? (
        <View
          accessibilityRole="alert" accessible
          style={{ padding: space.lg, borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.eatingRing, gap: space.xs }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons name="information-circle" size={iconSize.md} color={colors.eatingText} />
            <Text style={[type.bodyEmphasis, { color: colors.text, flexShrink: 1 }]}>{t('onboarding.safety.warningTitle')}</Text>
          </View>
          <Text style={[type.body, { color: colors.text }]}>{t('onboarding.safety.warning')}</Text>
        </View>
      ) : null}
      <Caption>{t('onboarding.safety.disclaimer')}</Caption>
    </OnboardingScaffold>
  );
}
