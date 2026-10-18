import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { OnboardingScaffold } from '../../components/onboarding/OnboardingScaffold';
import { PrimaryButton, Caption } from '../../components/ui';
import { hit, icon as iconSize, space, type, useTheme } from '../../theme';
import { requestPermission } from '../../services/notifications';
import { t } from '../../lib/i18n';

const ROWS = [
  { k: 'r1', icon: 'play-circle-outline' },
  { k: 'r2', icon: 'hourglass-outline' },
  { k: 'r3', icon: 'flag-outline' },
] as const;

export default function RemindersStep() {
  const router = useRouter();
  const { colors, radius } = useTheme();
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const next = () => router.push('/(onboarding)/plan-summary');

  const enable = async () => {
    if (busy) return;
    setBusy(true);
    const status = await requestPermission();
    setBusy(false);
    if (status === 'granted') { setNote(t('onboarding.reminders.enabledNote')); }
    else if (status === 'denied') { setNote(t('onboarding.reminders.deniedNote')); }
    setTimeout(next, status === 'granted' || status === 'denied' ? 700 : 0);
  };

  return (
    <OnboardingScaffold
      step={6} stepName="reminders" title={t('onboarding.reminders.title')} subtitle={t('onboarding.reminders.subtitle')}
      ctaLabel={t('onboarding.reminders.enable')} canContinue={!busy} onContinue={enable}
      footerExtra={<PrimaryButton variant="ghost" label={t('onboarding.reminders.later')} onPress={next} disabled={busy} />}
    >
      {ROWS.map((r) => (
        <View
          key={r.k}
          style={{
            flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.lg, minHeight: hit.comfortable + 8,
            borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
          }}
        >
          <View style={{ width: hit.min - 4, height: hit.min - 4, borderRadius: radius.chip, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name={r.icon} size={iconSize.md} color={colors.accent} />
          </View>
          <Text style={[type.body, { flex: 1, color: colors.text }]}>{t(`onboarding.reminders.${r.k}`)}</Text>
        </View>
      ))}
      {note ? <Caption>{note}</Caption> : null}
    </OnboardingScaffold>
  );
}
