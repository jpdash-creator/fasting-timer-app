import React from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScaffold, OptionCard } from '../../components/onboarding/OnboardingScaffold';
import { useOnboardingDraft } from '../../components/onboarding/draft';
import { useSettingsStore } from '../../stores/settingsStore';
import { t } from '../../lib/i18n';
import type { Settings } from '../../types';

const GOALS: { id: Settings['goal']; icon: 'trending-down' | 'scale-outline' | 'flash-outline' | 'calendar-outline' }[] = [
  { id: 'lose', icon: 'trending-down' },
  { id: 'maintain', icon: 'scale-outline' },
  { id: 'focus', icon: 'flash-outline' },
  { id: 'routine', icon: 'calendar-outline' },
];

export default function GoalStep() {
  const router = useRouter();
  const goal = useOnboardingDraft((s) => s.goal);
  const setGoal = useOnboardingDraft((s) => s.setGoal);
  return (
    <OnboardingScaffold
      step={1} stepName="goal" title={t('onboarding.goal.title')} subtitle={t('onboarding.goal.subtitle')}
      canContinue={goal !== null}
      onContinue={() => {
        if (!goal) return;
        useSettingsStore.getState().update({ goal });
        router.push('/(onboarding)/experience');
      }}
    >
      {GOALS.map((g) => (
        <OptionCard key={g.id} icon={g.icon} label={t(`onboarding.goal.${g.id}`)} selected={goal === g.id} onPress={() => setGoal(g.id)} />
      ))}
    </OnboardingScaffold>
  );
}
