import React, { useState } from 'react';
import { useRouter } from 'expo-router';
import { OnboardingScaffold } from '../../components/onboarding/OnboardingScaffold';
import { TimeField } from '../../components/onboarding/TimeField';
import { windowHours } from '../../components/onboarding/draft';
import { Body } from '../../components/ui';
import { useSettingsStore } from '../../stores/settingsStore';
import { recommendProtocol } from '../../lib/protocols';
import { t } from '../../lib/i18n';

export default function ScheduleStep() {
  const router = useRouter();
  const saved = useSettingsStore.getState().settings;
  const [first, setFirst] = useState(saved.firstMeal);
  const [last, setLast] = useState(saved.lastMeal);
  return (
    <OnboardingScaffold
      step={3} stepName="schedule" title={t('onboarding.schedule.title')} subtitle={t('onboarding.schedule.subtitle')}
      onContinue={() => {
        const s = useSettingsStore.getState();
        s.update({
          firstMeal: first, lastMeal: last,
          activeProtocolId: recommendProtocol(first, last, s.settings.experience),
        });
        router.push('/(onboarding)/safety');
      }}
    >
      <TimeField label={t('onboarding.schedule.firstMeal')} value={first} onChange={setFirst} />
      <TimeField label={t('onboarding.schedule.lastMeal')} value={last} onChange={setLast} />
      <Body secondary>{t('onboarding.schedule.window', { hours: windowHours(first, last) })}</Body>
    </OnboardingScaffold>
  );
}
