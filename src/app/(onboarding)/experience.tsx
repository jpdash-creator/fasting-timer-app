import React from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScaffold, OptionCard } from '../../components/onboarding/OnboardingScaffold';
import { useOnboardingDraft } from '../../components/onboarding/draft';
import { useSettingsStore } from '../../stores/settingsStore';
import { t } from '../../lib/i18n';
import type { Settings } from '../../types';

const LEVELS: { id: Settings['experience']; icon: 'leaf-outline' | 'walk-outline' | 'barbell-outline' }[] = [
  { id: 'new', icon: 'leaf-outline' },
  { id: 'some', icon: 'walk-outline' },
  { id: 'experienced', icon: 'barbell-outline' },
];

export default function ExperienceStep() {
  const router = useRouter();
  const experience = useOnboardingDraft((s) => s.experience);
  const setExperience = useOnboardingDraft((s) => s.setExperience);
  return (
    <OnboardingScaffold
      step={2} stepName="experience" title={t('onboarding.experience.title')} subtitle={t('onboarding.experience.subtitle')}
      canContinue={experience !== null}
      onContinue={() => {
        if (!experience) return;
        useSettingsStore.getState().update({ experience });
        router.push('/(onboarding)/schedule');
      }}
    >
      {LEVELS.map((l) => (
        <OptionCard
          key={l.id} icon={l.icon} label={t(`onboarding.experience.${l.id}`)}
          hint={t(`onboarding.experience.${l.id}Hint`)} selected={experience === l.id} onPress={() => setExperience(l.id)}
        />
      ))}
    </OnboardingScaffold>
  );
}
