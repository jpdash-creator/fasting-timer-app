import React, { useState } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { hit, space, radius, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { Body, haptic } from '../ui';
import { dateTimeLabel } from '../../lib/timerFormat';
import { MIN } from '../../lib/fastMath';
import { WebDateTimeInput } from '../logs/DateTimeField';

/** Picks a moment in [min, max]: quick "x ago" chips plus an exact picker. */
export function TimeChooser({ value, onChange, min, max, offsetsMin }: {
  value: number; onChange: (ms: number) => void; min: number; max: number; offsetsMin: number[];
}) {
  const { colors } = useTheme();
  const [showIos, setShowIos] = useState(false);
  const clamp = (v: number) => Math.min(max, Math.max(min, v));

  const pickAndroid = () => {
    const base = new Date(clamp(value));
    DateTimePickerAndroid.open({
      value: base, mode: 'date', minimumDate: new Date(min), maximumDate: new Date(max),
      onValueChange: (_e, d) => {
        const withDate = new Date(d);
        withDate.setHours(base.getHours(), base.getMinutes(), 0, 0);
        DateTimePickerAndroid.open({
          value: withDate, mode: 'time',
          onValueChange: (_e2, d2) => onChange(clamp(d2.getTime())),
          onDismiss: () => {},
        });
      },
      onDismiss: () => {},
    });
  };

  const chip = (key: string, label: string, onPress: () => void) => (
    <Pressable
      key={key} accessibilityRole="button" accessibilityLabel={label}
      onPress={() => { haptic('light'); onPress(); }}
      style={({ pressed }) => ({
        minHeight: hit.min, paddingHorizontal: space.lg, borderRadius: radius.chip, justifyContent: 'center',
        backgroundColor: colors.accentSoft, borderWidth: 1, borderColor: colors.controlBorder, opacity: pressed ? 0.8 : 1,
      })}
    >
      <Text style={[type.bodyEmphasis, { color: colors.accent }]}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: space.md }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {offsetsMin.map((m) =>
          chip(
            String(m),
            m >= 60 ? t('timer.time.agoShort', { n: m / 60 }) : t('timer.time.agoMin', { n: m }),
            () => onChange(clamp(Date.now() - m * MIN)),
          ),
        )}
        {Platform.OS !== 'web'
          ? chip('exact', t('timer.time.pickExact'), () => (Platform.OS === 'android' ? pickAndroid() : setShowIos((s) => !s)))
          : null}
      </View>
      {Platform.OS === 'ios' && showIos ? (
        <DateTimePicker
          value={new Date(clamp(value))} mode="datetime" display="spinner"
          minimumDate={new Date(min)} maximumDate={new Date(max)}
          onValueChange={(_e, d) => onChange(clamp(d.getTime()))}
        />
      ) : null}
      {Platform.OS === 'web' ? (
        <WebDateTimeInput value={clamp(value)} min={min} max={max} fullWidth label={t('timer.time.dateTimeA11y')}
          onChange={(v) => onChange(clamp(v))} />
      ) : null}
      <Body>{t('timer.time.currentValue', { time: dateTimeLabel(value) })}</Body>
    </View>
  );
}
