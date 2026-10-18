import React, { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScaffold, OptionCard } from '../../components/onboarding/OnboardingScaffold';
import { planWindow, useOnboardingDraft } from '../../components/onboarding/draft';
import { Caption } from '../../components/ui';
import { useSettingsStore } from '../../stores/settingsStore';
import { PRESET_PROTOCOLS, recommendProtocol } from '../../lib/protocols';
import { t } from '../../lib/i18n';
import type { ProtocolId } from '../../types';

export default function ProtocolStep() {
  const router = useRouter();
  const { firstMeal, lastMeal, experience } = useSettingsStore.getState().settings;
  const recommended = useMemo<ProtocolId>(() => recommendProtocol(firstMeal, lastMeal, experience), [firstMeal, lastMeal, experience]);
  const draft = useOnboardingDraft((s) => s.protocolId);
  const setProtocol = useOnboardingDraft((s) => s.setProtocol);
  const selected = draft ?? recommended;

  const ordered = useMemo(
    () => [...PRESET_PROTOCOLS].sort((a, b) => (a.id === recommended ? -1 : b.id === recommended ? 1 : 0)),
    [recommended],
  );

  return (
    <OnboardingScaffold
      step={5} stepName="protocol" title={t('onboarding.protocol.title')} subtitle={t('onboarding.protocol.subtitle')}
      onContinue={() => {
        const p = PRESET_PROTOCOLS.find((x) => x.id === selected) ?? PRESET_PROTOCOLS[2];
        const w = planWindow(firstMeal, lastMeal, p.id);
        useSettingsStore.getState().update({ activeProtocolId: p.id, lastMeal: w.to });
        router.push('/(onboarding)/reminders');
      }}
    >
      {ordered.map((p) => {
        const hint = p.eatingMinutes > 0
          ? t('onboarding.protocol.fastEat', { fast: p.fastingMinutes / 60, eat: p.eatingMinutes / 60 })
          : t('onboarding.protocol.fastOnly', { fast: p.fastingMinutes / 60 });
        return (
          <OptionCard
            key={p.id}
            label={p.name}
            badge={p.id === recommended ? t('onboarding.protocol.recommended') : p.proOnly ? t('onboarding.protocol.needsPro') : undefined}
            hint={`${hint}. ${t(`onboarding.protocol.descriptions.${p.id}`)}`}
            selected={selected === p.id}
            onPress={() => setProtocol(p.id)}
          />
        );
      })}
      <Caption>{t('onboarding.protocol.proNote')}</Caption>
    </OnboardingScaffold>
  );
}
