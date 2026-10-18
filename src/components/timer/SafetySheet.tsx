import React from 'react';
import { View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Body, PrimaryButton, Title } from '../ui';
import { Sheet } from './Sheet';
import { hit, icon, radius, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import type { SafetyLevel } from '../../lib/timerSafety';

/** BR-07: non-dismissible until read. At 72 h the user must accept the risks to keep counting. */
export function SafetySheet({ level, onAcknowledge, onEndFast }: {
  level: SafetyLevel | null; onAcknowledge: () => void; onEndFast: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Sheet visible={level !== null} dismissible={false} title={level !== null ? t(`timer.safety.title${level}`) : ''}>
      {level !== null ? (
        <>
          <View style={{
            width: hit.comfortable - 8, height: hit.comfortable - 8, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.accentSoft,
          }}>
            <Ionicons name="heart-outline" size={icon.lg} color={colors.accent} />
          </View>
          <Title>{t(`timer.safety.title${level}`)}</Title>
          <Body>{t(`timer.safety.body${level}`)}</Body>
          <PrimaryButton
            label={level === 72 ? t('timer.safety.understand') : t('timer.safety.read')}
            onPress={onAcknowledge}
          />
          {level === 72 ? (
            <PrimaryButton label={t('timer.safety.endInstead')} variant="secondary" onPress={onEndFast} />
          ) : null}
        </>
      ) : null}
    </Sheet>
  );
}
