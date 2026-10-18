import React, { useRef } from 'react';
import { Platform, Pressable, Text, View } from 'react-native';
import ReanimatedSwipeable, { type SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import { Ionicons } from '@expo/vector-icons';
import { format, isSameDay } from 'date-fns';
import { hit, icon, radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { formatHM } from '../../lib/fastMath';
import { getProtocol } from '../../lib/protocols';
import { useSettingsStore } from '../../stores/settingsStore';
import type { Fast } from '../../types';
import { moodEmoji } from './moods';

export function fastSummaryLabel(f: Fast, protocolName: string) {
  const dur = formatHM((f.endAt ?? Date.now()) - f.startAt);
  const day = format(f.endAt ?? Date.now(), 'EEEE, MMMM d');
  return t('history.row.a11y', {
    protocol: protocolName, duration: dur, day,
    result: f.goalMet ? t('history.goalMet') : t('history.endedEarly'),
  });
}

/** Same-day: "Fri Oct 16, 8:00 AM → 12:00 PM". Crossing midnight: "Oct 16, 8:00 PM → Oct 17, 12:00 PM". */
export function fastRangeLabel(f: Fast) {
  if (!f.endAt) return t('history.row.range', { start: format(f.startAt, 'EEE MMM d, p'), end: '…' });
  if (isSameDay(f.startAt, f.endAt)) {
    return t('history.row.range', { start: format(f.startAt, 'EEE MMM d, p'), end: format(f.endAt, 'p') });
  }
  return t('history.row.range', { start: format(f.startAt, 'MMM d, p'), end: format(f.endAt, 'MMM d, p') });
}

export function FastRow({ fast, onPress, onDelete, disabled }: {
  fast: Fast; onPress: () => void; onDelete: () => void; disabled?: boolean;
}) {
  const { colors } = useTheme();
  const customProtocols = useSettingsStore((s) => s.settings.customProtocols);
  const protocol = getProtocol(fast.protocolId, { customProtocols });
  const ref = useRef<SwipeableMethods>(null);
  const dur = formatHM((fast.endAt ?? Date.now()) - fast.startAt);
  const met = !!fast.goalMet;
  const isWeb = Platform.OS === 'web';

  const rowPressable = (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={isWeb ? undefined : fastSummaryLabel(fast, protocol.name)}
      accessibilityHint={t('history.row.hint')}
      accessibilityActions={[{ name: 'delete', label: t('common.delete') }]}
      onAccessibilityAction={(e) => { if (e.nativeEvent.actionName === 'delete') onDelete(); }}
      style={({ pressed }) => ({
        minHeight: 64, flexDirection: 'row', alignItems: 'center', gap: space.md, flex: 1,
        paddingHorizontal: space.lg, paddingVertical: space.sm,
        backgroundColor: pressed ? colors.accentSoft : colors.surface,
      })}
    >
      <View style={{ width: 4, alignSelf: 'stretch', borderRadius: radius.bar / 2, backgroundColor: protocol.color }} />
      <View style={{ flex: 1 }}>
        <Text style={[type.bodyEmphasis, type.tabular, { color: colors.text }]} numberOfLines={1}>
          {protocol.name} · {dur}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary }]} numberOfLines={2}>
          {fastRangeLabel(fast)}
        </Text>
        {fast.note ? (
          <Text style={[type.caption, { color: colors.textSecondary }]} numberOfLines={1}>{fast.note}</Text>
        ) : null}
      </View>
      <View style={{ alignItems: 'flex-end', gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Ionicons name={met ? 'checkmark-circle' : 'ellipse-outline'} size={icon.sm}
            color={met ? colors.success : colors.textSecondary} />
          <Text style={[type.caption, { color: met ? colors.success : colors.textSecondary }]}>
            {met ? t('history.goalMet') : t('history.endedEarly')}
          </Text>
        </View>
        {fast.mood ? <Text style={{ fontSize: type.subtitle.fontSize }} importantForAccessibility="no">{moodEmoji(fast.mood)}</Text> : null}
      </View>
    </Pressable>
  );

  // Web: the delete button is a sibling of the row button (interactive controls must not nest).
  const row = isWeb ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, paddingRight: space.sm }}>
      {rowPressable}
      {(
        // Web has no swipe affordance (and Swipeable's native-driven handlers log errors there): visible delete button.
        <Pressable
          accessibilityRole="button" accessibilityLabel={t('history.deleteFast')} hitSlop={4}
          onPress={onDelete}
          style={({ pressed }) => ({
            width: hit.min, height: hit.min, borderRadius: hit.min / 2, alignItems: 'center', justifyContent: 'center',
            backgroundColor: pressed ? colors.accentSoft : 'transparent',
          })}
        >
          <Ionicons name="trash-outline" size={icon.md} color={colors.textSecondary} />
        </Pressable>
      )}
    </View>
  ) : rowPressable;

  // Web: skip Swipeable entirely (its worklet/native-driven handlers log "No handler for tag" there).
  if (disabled || isWeb) return row;
  return (
    <ReanimatedSwipeable
      ref={ref}
      overshootRight={false}
      rightThreshold={48}
      renderRightActions={() => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('history.deleteFast')}
          onPress={() => { ref.current?.close(); onDelete(); }}
          style={{ width: 88, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name="trash-outline" size={icon.md} color={colors.onAccent} />
          <Text style={[type.caption, { color: colors.onAccent, fontWeight: '600' }]}>{t('common.delete')}</Text>
        </Pressable>
      )}
      onSwipeableOpen={() => { ref.current?.close(); onDelete(); }}
    >
      {row}
    </ReanimatedSwipeable>
  );
}
