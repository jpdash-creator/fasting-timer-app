import React, { useState } from 'react';
import { Platform, Pressable, Text, TextInput, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { hit, icon as iconSize, radius, space, type, useTheme } from '../../theme';
import { haptic, Row } from '../ui';
import { t } from '../../lib/i18n';

const MIN_ROW = hit.comfortable;

export function Chevron() {
  const { colors } = useTheme();
  return <Ionicons name="chevron-forward" size={iconSize.md - 2} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />;
}

/** Pro badge: outlined so text contrast holds in light and dark (accent on surface >= 4.5:1). */
export function ProBadge({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{
      borderWidth: 1.5, borderColor: colors.accent, borderRadius: radius.chip,
      paddingHorizontal: space.sm, paddingVertical: space.xs / 2,
    }}>
      <Text style={[type.micro, { color: colors.accent, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

/** Tappable navigation / action row with an optional trailing value and chevron. */
export function LinkRow({ label, value, onPress, hint, destructive, icon, showChevron = true }: {
  label: string; value?: string; onPress: () => void; hint?: string; destructive?: boolean;
  icon?: React.ComponentProps<typeof Ionicons>['name']; showChevron?: boolean;
}) {
  const { colors } = useTheme();
  const stacked = (value?.length ?? 0) > 18; // long values (e-mail) go under the label
  return (
    <Pressable
      onPress={() => { haptic('light'); onPress(); }}
      accessibilityRole="button"
      accessibilityHint={hint}
      style={({ pressed }) => ({
        minHeight: MIN_ROW, flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: space.lg, paddingVertical: space.sm, opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon ? <Ionicons name={icon} size={iconSize.md} color={destructive ? colors.danger : colors.accent} /> : null}
      {stacked ? (
        <View style={{ flex: 1 }}>
          <Text style={[type.body, { color: destructive ? colors.danger : colors.text }]}>{label}</Text>
          <Text style={[type.caption, { color: colors.textSecondary, marginTop: space.xs / 2 }]}>{value}</Text>
        </View>
      ) : (
        <>
          <Text style={[type.body, { flex: 1, color: destructive ? colors.danger : colors.text }]}>{label}</Text>
          {value ? <Text style={[type.body, { color: colors.textSecondary, flexShrink: 1, textAlign: "right" }]}>{value}</Text> : null}
        </>
      )}
      {showChevron ? <Chevron /> : null}
    </Pressable>
  );
}

/** Purely visual switch (the surrounding Pressable carries the switch semantics, so nothing is nested). */
function SwitchVisual({ value, disabled }: { value: boolean; disabled?: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false} importantForAccessibility="no-hide-descendants" aria-hidden
      style={{
        width: 51, height: 31, borderRadius: 16, padding: 2, justifyContent: 'center',
        backgroundColor: value ? colors.accent : colors.track, opacity: disabled ? 0.6 : 1,
        borderWidth: 1, borderColor: value ? colors.accent : colors.controlBorder,
      }}
    >
      <View style={{
        width: 25, height: 25, borderRadius: 13, backgroundColor: value ? colors.onAccent : colors.textSecondary,
        alignSelf: value ? 'flex-end' : 'flex-start',
      }} />
    </View>
  );
}

/** Whole row toggles; exposes switch semantics to screen readers. */
export function ToggleRow({ label, hint, value, onValueChange, badge, disabled }: {
  label: string; hint?: string; value: boolean; onValueChange: (v: boolean) => void;
  badge?: string; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={disabled}
      onPress={() => { haptic('light'); onValueChange(!value); }}
      accessibilityRole="switch"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
      accessibilityHint={hint}
      aria-checked={value} aria-disabled={!!disabled}
      style={({ pressed }) => ({
        minHeight: MIN_ROW, flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: space.lg, paddingVertical: space.sm, opacity: disabled ? 0.5 : pressed ? 0.7 : 1,
      })}
    >
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={[type.body, { color: colors.text }]}>{label}</Text>
          {badge ? <ProBadge label={badge} /> : null}
        </View>
        {hint ? <Text style={[type.caption, { color: colors.textSecondary, marginTop: space.xs / 2 }]}>{hint}</Text> : null}
      </View>
      <SwitchVisual value={value} disabled={disabled} />
    </Pressable>
  );
}

function RoundButton({ icon, label, onPress, disabled }: {
  icon: 'remove' | 'add'; label: string; onPress: () => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={() => { haptic('light'); onPress(); }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      aria-disabled={!!disabled}
      hitSlop={4}
      style={({ pressed }) => ({
        width: hit.min, height: hit.min, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center',
        borderWidth: 1.5, borderColor: colors.accent, opacity: disabled ? 0.35 : pressed ? 0.7 : 1,
      })}
    >
      <Ionicons name={icon} size={iconSize.md} color={colors.accent} />
    </Pressable>
  );
}

/** − value + row. `onBlocked` lets Pro-gated steppers redirect to the paywall instead of changing. */
export function StepperRow({ label, valueText, onDecrease, onIncrease, canDecrease = true, canIncrease = true,
  decreaseLabel, increaseLabel, badge }: {
  label: string; valueText: string; onDecrease: () => void; onIncrease: () => void;
  canDecrease?: boolean; canIncrease?: boolean; decreaseLabel: string; increaseLabel: string; badge?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessible={false}
      style={{
        minHeight: MIN_ROW, flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
        gap: space.md, paddingHorizontal: space.lg, paddingVertical: space.sm,
      }}
    >
      <View style={{ flex: 1, minWidth: 140, flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
        <Text style={[type.body, { color: colors.text }]}>{label}</Text>
        {badge ? <ProBadge label={badge} /> : null}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <RoundButton icon="remove" label={decreaseLabel} onPress={onDecrease} disabled={!canDecrease} />
        <Text
          accessibilityLabel={`${label}, ${valueText}`}
          role="status" accessibilityLiveRegion="polite"
          style={[type.body, type.tabular, { color: colors.text, minWidth: 72, textAlign: 'center' }]}
        >
          {valueText}
        </Text>
        <RoundButton icon="add" label={increaseLabel} onPress={onIncrease} disabled={!canIncrease} />
      </View>
    </View>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
export const isValidTime = (s: string) => /^([01]?\d|2[0-3]):[0-5]\d$/.test(s);
export const normalizeTime = (s: string) => {
  const [h, m] = s.split(':').map(Number);
  return `${pad(h)}:${pad(m)}`;
};
function toDate(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h || 0, m || 0, 0, 0);
  return d;
}

/** Time of day row: native picker on iOS (compact), dialog on Android, text input on web. */
export function TimeRow({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const { colors, scheme } = useTheme();
  const [showAndroid, setShowAndroid] = useState(false);
  const [draft, setDraft] = useState(value);
  const [invalid, setInvalid] = useState(false);
  const a11y = t('settings.reminders.timeLabel', { label, time: value });

  const commitDraft = (s: string) => {
    setDraft(s);
    if (isValidTime(s)) { setInvalid(false); onChange(normalizeTime(s)); } else setInvalid(s.length >= 4);
  };

  return (
    <View style={{
      minHeight: MIN_ROW, flexDirection: 'row', alignItems: 'center', gap: space.md,
      paddingHorizontal: space.lg, paddingVertical: space.sm,
    }}>
      <Text style={[type.body, { flex: 1, color: colors.text }]}>{label}</Text>
      {Platform.OS === 'ios' ? (
        <DateTimePicker
          value={toDate(value)} mode="time" display="compact" themeVariant={scheme}
          accessibilityLabel={a11y}
          onValueChange={(_e, d) => onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`)}
        />
      ) : Platform.OS === 'android' ? (
        <>
          <Pressable
            onPress={() => setShowAndroid(true)} accessibilityRole="button" accessibilityLabel={a11y}
            style={{ minHeight: hit.min, minWidth: 80, justifyContent: 'center', alignItems: 'center',
              borderRadius: radius.control, backgroundColor: colors.accentSoft, paddingHorizontal: space.md }}
          >
            <Text style={[type.body, type.tabular, { color: colors.text }]}>{value}</Text>
          </Pressable>
          {showAndroid ? (
            <DateTimePicker
              value={toDate(value)} mode="time" is24Hour
              onValueChange={(_e, d) => {
                setShowAndroid(false);
                onChange(`${pad(d.getHours())}:${pad(d.getMinutes())}`);
              }}
              onDismiss={() => setShowAndroid(false)}
            />
          ) : null}
        </>
      ) : (
        <View style={{ alignItems: 'flex-end' }}>
          <TextInput
            value={draft} onChangeText={commitDraft} onEndEditing={() => setDraft(value)}
            inputMode="numeric" maxLength={5} placeholder="22:00" placeholderTextColor={colors.textSecondary}
            accessibilityLabel={a11y}
            style={[type.body, type.tabular, {
              minHeight: hit.min, minWidth: 88, textAlign: 'center', color: colors.text, borderRadius: radius.control,
              borderWidth: 1.5, borderColor: invalid ? colors.danger : colors.controlBorder, backgroundColor: colors.bg,
            }]}
          />
          {invalid ? <Text style={[type.caption, { color: colors.danger }]}>{t('settings.reminders.timeInvalid')}</Text> : null}
        </View>
      )}
    </View>
  );
}

export { Row };
