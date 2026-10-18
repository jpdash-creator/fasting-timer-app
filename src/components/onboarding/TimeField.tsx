import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Ionicons } from '../../platform/icons';
import { hit, icon as iconSize, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';

const toDate = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
};
const toHHMM = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
const shift = (hhmm: string, deltaMin: number) => {
  const [h, m] = hhmm.split(':').map(Number);
  const total = (((h * 60 + m + deltaMin) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

/** Labeled time picker: native on iOS/Android, 15-minute stepper on web. Value is "HH:MM". */
export function TimeField({ label, value, onChange }: {
  label: string; value: string; onChange: (hhmm: string) => void;
}) {
  const { colors, radius } = useTheme();
  const a11y = t('onboarding.schedule.pick', { label, time: value });

  const box = {
    minHeight: hit.comfortable + 8, flexDirection: 'row' as const, alignItems: 'center' as const, gap: space.md,
    paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.card,
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  };
  const labelEl = (
    <Text style={[type.bodyEmphasis, { flex: 1, color: colors.text }]}>{label}</Text>
  );

  if (Platform.OS === 'ios') {
    return (
      <View style={box}>
        {labelEl}
        <DateTimePicker
          mode="time" display="compact" value={toDate(value)} minuteInterval={5}
          accessibilityLabel={a11y}
          onValueChange={(_e, d) => onChange(toHHMM(d))}
        />
      </View>
    );
  }

  if (Platform.OS === 'android') {
    return (
      <Pressable
        accessibilityRole="button" accessibilityLabel={a11y}
        onPress={() =>
          DateTimePickerAndroid.open({
            mode: 'time', is24Hour: true, value: toDate(value),
            onValueChange: (_e, d) => onChange(toHHMM(d)),
          })
        }
        style={box}
      >
        {labelEl}
        <Text style={[type.subtitle, type.tabular, { color: colors.accent }]}>{value}</Text>
        <Ionicons name="time-outline" size={iconSize.md} color={colors.textSecondary} />
      </Pressable>
    );
  }

  const stepBtn = (icon: 'remove' | 'add', delta: number, lbl: string) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={`${lbl}, ${label}`}
      onPress={() => onChange(shift(value, delta))}
      style={{ width: hit.min, height: hit.min, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}
    >
      <Ionicons name={icon} size={iconSize.md} color={colors.accent} />
    </Pressable>
  );
  return (
    <View style={box} role="group" accessibilityLabel={a11y}>
      {labelEl}
      {stepBtn('remove', -15, t('onboarding.schedule.decrease'))}
      <Text style={[type.subtitle, type.tabular, { color: colors.text, minWidth: 64, textAlign: 'center' }]}>{value}</Text>
      {stepBtn('add', 15, t('onboarding.schedule.increase'))}
    </View>
  );
}
