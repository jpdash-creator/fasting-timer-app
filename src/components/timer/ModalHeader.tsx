import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Title, haptic } from '../ui';
import { hit, icon, layout, space, useTheme } from '../../theme';
import { t } from '../../lib/i18n';

/**
 * The one modal header. `variant="plain"` drops the tinted circle (e.g. paywall over imagery).
 * `onClose` defaults to router.back().
 */
export function ModalHeader({ title, onClose, variant = 'default' }: {
  title: string; onClose?: () => void; variant?: 'default' | 'plain';
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const plain = variant === 'plain';
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: layout.screenX, paddingVertical: space.md }}>
      <View style={{ flex: 1 }}><Title>{title}</Title></View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={t('timer.a11y.close')}
        hitSlop={8}
        onPress={() => { haptic('light'); if (onClose) onClose(); else router.back(); }}
        style={({ pressed }) => ({
          width: hit.min, height: hit.min, borderRadius: hit.min / 2, alignItems: 'center', justifyContent: 'center',
          backgroundColor: plain ? 'transparent' : colors.accentSoft, opacity: pressed ? 0.7 : 1,
        })}
      >
        <Ionicons name="close" size={plain ? icon.lg : icon.md} color={plain ? colors.textSecondary : colors.accent} />
      </Pressable>
    </View>
  );
}

/** Single source of mood faces (value n = index + 1). */
export const MOODS = ['😣', '😕', '😐', '🙂', '😄'] as const;
export type Mood = 1 | 2 | 3 | 4 | 5;

/** Five-face mood row shared by the Timer quick card and the fast summary. */
export function MoodPicker({ value, onChange, size = 52, filled = false }: {
  value: Mood | null; onChange: (m: Mood | null) => void; size?: number; filled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
      {MOODS.map((emoji, i) => {
        const n = (i + 1) as Mood;
        const selected = value === n;
        return (
          <Pressable
            key={n} accessibilityRole="button" aria-pressed={selected}
            accessibilityLabel={`${t('timer.quick.moodSet', { n })}, ${t(`timer.moods.${n}`)}`}
            onPress={() => { haptic('light'); onChange(selected ? null : n); }}
            style={({ pressed }) => ({
              width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center',
              backgroundColor: selected ? colors.accentSoft : filled ? colors.surface : 'transparent',
              borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.controlBorder,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ fontSize: Math.round(size / 2) }} maxFontSizeMultiplier={1.2}>{emoji}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
