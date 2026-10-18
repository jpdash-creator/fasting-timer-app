import React, { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Body, PrimaryButton, Title, haptic } from '../ui';
import { Sheet } from './Sheet';
import { TimeChooser } from './TimeChooser';
import { type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { MIN, endTimeBounds, formatHM, isGoalMet, validateFastTimes } from '../../lib/fastMath';
import { rescheduleNotifications } from '../../lib/timerNotify';
import { useFastStore } from '../../stores/fastStore';
import type { Fast } from '../../types';

/** §7.4: confirm sheet that prevents accidental taps. Supports "ended earlier" (FR-04). */
export function EndSheet({ visible, fast, now, onClose, onEnded }: {
  visible: boolean; fast: Fast | null; now: number; onClose: () => void; onEnded: (f: Fast) => void;
}) {
  const { colors } = useTheme();
  const [earlier, setEarlier] = useState(false);
  const [endAt, setEndAt] = useState(() => Date.now() - 30 * MIN);
  const [error, setError] = useState<string | null>(null);

  // BR-06: a fast older than 7 days can't end "now"; open straight on the end-time picker, capped at start + 7 d.
  const bounds = fast ? endTimeBounds(fast.startAt, now) : null;
  const stale = !!bounds?.stale;
  const staleMax = bounds?.max ?? 0;

  useEffect(() => {
    if (!visible) return;
    setEarlier(stale);
    setEndAt(stale ? staleMax : Date.now() - 30 * MIN);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, stale]);

  if (!fast || !bounds) return null;
  const goal = formatHM(fast.targetMinutes * MIN);
  const met = isGoalMet(fast, now);

  const finish = (at: number) => {
    const fs = useFastStore.getState();
    if (at <= fast.startAt + MIN) { setError(t('timer.endSheet.tooEarly')); return; }
    const err = validateFastTimes(fast.startAt, at, fs.fasts, fast.id, Date.now());
    if (err) { setError(t(err.key, err.params)); return; }
    const done = fs.endFast(at);
    if (!done) return;
    haptic('success');
    rescheduleNotifications();
    onEnded(done);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('timer.endSheet.title')}>
      <Title>{t('timer.endSheet.title')}</Title>
      <Body secondary>
        {t(met ? 'timer.endSheet.bodyMet' : 'timer.endSheet.body', {
          elapsed: formatHM(Math.max(0, now - fast.startAt)), goal,
        })}
      </Body>
      {stale ? <Body secondary>{t('timer.endSheet.staleNote')}</Body> : null}
      {earlier ? (
        <>
          <Body secondary>{t('timer.endSheet.pickPrompt')}</Body>
          <TimeChooser
            value={endAt} onChange={(v) => { setEndAt(v); setError(null); }}
            min={fast.startAt + 2 * MIN} max={bounds.max} offsetsMin={stale ? [] : [15, 30, 60, 120]}
          />
          {error ? <Text accessibilityRole="alert" style={[type.label, { color: colors.danger, fontWeight: '400' }]}>{error}</Text> : null}
          <PrimaryButton label={t('timer.endSheet.confirm')} onPress={() => finish(endAt)} />
          <PrimaryButton label={t('common.cancel')} variant="ghost" onPress={() => (stale ? onClose() : setEarlier(false))} />
        </>
      ) : (
        <>
          {error ? <Text accessibilityRole="alert" style={[type.label, { color: colors.danger, fontWeight: '400' }]}>{error}</Text> : null}
          <PrimaryButton label={t('timer.endSheet.now')} onPress={() => finish(Date.now())} />
          <PrimaryButton label={t('timer.endSheet.earlier')} variant="secondary" onPress={() => setEarlier(true)} />
          <PrimaryButton label={t('timer.endSheet.keepGoing')} variant="ghost" onPress={onClose} />
        </>
      )}
    </Sheet>
  );
}
