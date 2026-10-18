import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Body, PrimaryButton, Title, haptic } from '../ui';
import { Sheet } from './Sheet';
import { TimeChooser } from './TimeChooser';
import { type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { HOUR, MIN, validateFastTimes } from '../../lib/fastMath';
import { getProtocol } from '../../lib/protocols';
import { rescheduleNotifications } from '../../lib/timerNotify';
import { useFastStore } from '../../stores/fastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Fast } from '../../types';

/** FR-04 / §7.2: "Start now" or "Started earlier…" (max 48 h back, BR-06 validated). */
export function StartSheet({ visible, onClose, onStarted }: {
  visible: boolean; onClose: () => void; onStarted: (f: Fast) => void;
}) {
  const { colors } = useTheme();
  const [earlier, setEarlier] = useState(false);
  const [startAt, setStartAt] = useState(() => Date.now() - HOUR);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) { setEarlier(false); setStartAt(Date.now() - HOUR); setError(null); }
  }, [visible]);

  const begin = (at: number) => {
    const fs = useFastStore.getState();
    if (fs.activeFastId) { setError(t('timer.startSheet.alreadyRunning')); return; }
    const now = Date.now();
    if (at < now - 48 * HOUR - MIN) { setError(t('timer.startSheet.tooFarBack')); return; }
    const err = validateFastTimes(at, null, fs.fasts, undefined, now);
    if (err) { setError(t(err.key, err.params)); return; }
    const settings = useSettingsStore.getState().settings;
    const fast = fs.startFast(getProtocol(settings.activeProtocolId, settings), at);
    haptic('success');
    rescheduleNotifications();
    onStarted(fast);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('timer.startSheet.title')}>
      <Title>{t('timer.startSheet.title')}</Title>
      {earlier ? (
        <>
          <Body secondary>{t('timer.startSheet.pickPrompt')}</Body>
          <TimeChooser
            value={startAt} onChange={(v) => { setStartAt(v); setError(null); }}
            min={Date.now() - 48 * HOUR} max={Date.now()} offsetsMin={[60, 120, 240, 480, 720]}
          />
          {error ? (
            <Text accessibilityRole="alert" style={[type.label, { color: colors.danger, fontWeight: '400' }]}>{error}</Text>
          ) : null}
          <PrimaryButton label={t('timer.startSheet.confirm')} onPress={() => begin(startAt)} />
          <PrimaryButton label={t('common.cancel')} variant="ghost" onPress={() => setEarlier(false)} />
        </>
      ) : (
        <>
          {error ? (
            <Text accessibilityRole="alert" style={[type.label, { color: colors.danger, fontWeight: '400' }]}>{error}</Text>
          ) : null}
          <PrimaryButton label={t('timer.startSheet.now')} onPress={() => begin(Date.now())} />
          <PrimaryButton label={t('timer.startSheet.earlier')} variant="secondary" onPress={() => setEarlier(true)} />
        </>
      )}
    </Sheet>
  );
}
