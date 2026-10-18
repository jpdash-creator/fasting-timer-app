import React from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { hit, radius, space, type, useTheme } from '../../theme';

const toLocalInput = (ms: number) => format(ms, "yyyy-MM-dd'T'HH:mm");

/** Styled, themed web date+time input (type=datetime-local). Web only. */
export function WebDateTimeInput({ value, onChange, min, max, label, fullWidth }: {
  value: number; onChange: (ms: number) => void; min?: number; max?: number; label: string; fullWidth?: boolean;
}) {
  const { colors, scheme } = useTheme();
  return React.createElement('input', {
    type: 'datetime-local', value: toLocalInput(value),
    min: min !== undefined ? toLocalInput(min) : undefined,
    max: max !== undefined ? toLocalInput(max) : undefined,
    'aria-label': label, title: label,
    onChange: (e: { target: { value: string } }) => {
      const v = new Date(e.target.value).getTime();
      if (!isNaN(v)) onChange(v);
    },
    style: {
      boxSizing: 'border-box', minHeight: hit.min, height: hit.min, padding: `0 ${space.md}px`, borderRadius: radius.control,
      border: `1px solid ${colors.controlBorder}`, backgroundColor: colors.surface, color: colors.text,
      colorScheme: scheme, fontFamily: 'inherit', fontSize: type.body.fontSize, fontVariantNumeric: 'tabular-nums',
      outlineColor: colors.accent, cursor: 'pointer', width: fullWidth ? '100%' : undefined, minWidth: 200,
    },
  });
}

/**
 * Date + time field. iOS: native compact picker. Android: date dialog then time dialog.
 * Web: styled datetime-local input.
 */
export function DateTimeField({ label, value, onChange, maximumDate, accessibilityHint }: {
  label: string; value: number; onChange: (ms: number) => void; maximumDate?: Date; accessibilityHint?: string;
}) {
  const { colors, scheme } = useTheme();
  const shown = format(value, 'EEE, MMM d, yyyy · p');

  const openAndroid = () => {
    DateTimePickerAndroid.open({
      value: new Date(value), mode: 'date', maximumDate,
      onValueChange: (_e, d) => {
        DateTimePickerAndroid.open({
          value: d, mode: 'time', is24Hour: false,
          onValueChange: (_e2, d2) => onChange(d2.getTime()),
          onDismiss: () => {},
        });
      },
      onDismiss: () => {},
    });
  };

  return (
    <View style={{ minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: space.md }}>
      <Text style={[type.body, { color: colors.text, minWidth: 64 }]}>{label}</Text>
      <View style={{ flex: 1, alignItems: 'flex-end' }}>
        {Platform.OS === 'ios' ? (
          <DateTimePicker
            value={new Date(value)} mode="datetime" display="compact" maximumDate={maximumDate}
            themeVariant={scheme} accessibilityLabel={`${label}, ${shown}`} accessibilityHint={accessibilityHint}
            onValueChange={(_e, d) => onChange(d.getTime())}
          />
        ) : Platform.OS === 'android' ? (
          <Pressable
            accessibilityRole="button" accessibilityLabel={`${label}, ${shown}`} accessibilityHint={accessibilityHint}
            onPress={openAndroid}
            style={{ minHeight: 48, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.card,
              backgroundColor: colors.accentSoft }}
          >
            <Text style={[type.bodyEmphasis, { color: colors.accent }]}>{shown}</Text>
          </Pressable>
        ) : (
          <WebDateTimeInput
            value={value} onChange={onChange} label={`${label}, ${shown}`}
            max={maximumDate ? Math.floor(maximumDate.getTime() / 60000) * 60000 : undefined}
          />
        )}
      </View>
    </View>
  );
}
