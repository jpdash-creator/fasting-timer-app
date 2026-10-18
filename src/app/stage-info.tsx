import React from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption, Card, Screen } from '../components/ui';
import { ModalHeader } from '../components/timer/ModalHeader';
import { icon, layout, radius, space, type, useTheme } from '../theme';
import { t } from '../lib/i18n';
import { formatHM, timerState } from '../lib/fastMath';
import { STAGES, stageAt, stageDescription, stageLabel } from '../lib/stages';
import { useNow } from '../lib/timerHooks';
import { selectActiveFast, useFastStore } from '../stores/fastStore';

export default function StageInfoScreen() {
  const { colors } = useTheme();
  const now = useNow(true);
  const active = useFastStore(selectActiveFast);
  const elapsed = active ? timerState(active, now).elapsedMs : null;
  const current = elapsed !== null ? stageAt(elapsed) : null;

  return (
    <Screen>
      <ModalHeader title={t('timer.stageInfo.title')} />
      <ScrollView {...({ tabIndex: 0 } as object)} /* keyboard-scrollable on web: the page has no other focusable content */ contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.sm, paddingBottom: space.xxl, gap: layout.sectionGap }}>
        {elapsed !== null ? (
          <Body secondary>{t('timer.stageInfo.elapsedNow', { time: formatHM(elapsed) })}</Body>
        ) : (
          <Body secondary>{t('timer.stageInfo.none')}</Body>
        )}

        <View style={{ gap: space.md }}>
          {STAGES.map((s) => {
            const isCurrent = current?.id === s.id;
            const reached = elapsed !== null && elapsed / 3_600_000 >= s.startHour;
            const state = isCurrent ? t('timer.stageInfo.current') : reached ? t('timer.stageInfo.reached') : t('timer.stageInfo.upcoming', { h: s.startHour });
            return (
              <View
                key={s.id} accessible role="group"
                accessibilityLabel={`${stageLabel(s.id)}, ${t('timer.stageInfo.fromHour', { h: s.startHour })}, ${state}`}
                style={{
                  borderRadius: radius.card, padding: space.lg, gap: space.sm,
                  backgroundColor: isCurrent ? colors.accentSoft : colors.surface,
                  borderWidth: isCurrent ? 2 : 1, borderColor: isCurrent ? colors.accent : colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
                  <Ionicons
                    name={isCurrent ? 'radio-button-on' : reached ? 'checkmark-circle' : 'ellipse-outline'}
                    size={icon.md} color={isCurrent || reached ? colors.accent : colors.textSecondary}
                  />
                  <Text style={[type.bodyEmphasis, { flex: 1, color: isCurrent || reached || elapsed === null ? colors.text : colors.textSecondary }]}>{stageLabel(s.id)}</Text>
                  <Caption>{isCurrent ? state : t('timer.stageInfo.fromHour', { h: s.startHour })}</Caption>
                </View>
                <Body secondary>{stageDescription(s.id)}</Body>
              </View>
            );
          })}
        </View>

        <Card style={{ gap: space.sm }}>
          <Body style={type.bodyEmphasis}>{t('timer.stageInfo.evidenceTitle')}</Body>
          <Body secondary>{t('timer.stageInfo.evidence')}</Body>
        </Card>

        <Caption>{t('disclaimer')}</Caption>
      </ScrollView>
    </Screen>
  );
}
