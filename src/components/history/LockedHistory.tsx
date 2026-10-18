import React from 'react';
import { Text, View } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { PrimaryButton } from '../ui';
import { icon, radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';

/**
 * Blurred-style preview of older history for free users. blur is not available, so the
 * preview rows are decorative placeholders under a semi-opaque overlay (and hidden from a11y).
 */
export function LockedHistory({ hiddenCount, onUnlock }: { hiddenCount: number; onUnlock: () => void }) {
  const { colors } = useTheme();
  const bar = (w: `${number}%`) => (
    <View style={{ height: 12, width: w, borderRadius: radius.bar, backgroundColor: colors.track }} />
  );
  return (
    <View style={{ borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.surface,
      borderWidth: 1, borderColor: colors.border, marginTop: space.md }}>
      <View importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {[0, 1, 2].map((i) => (
          <View key={i} style={{ minHeight: 64, padding: space.lg, gap: 8, justifyContent: 'center' }}>
            {bar('48%')}
            {bar('72%')}
          </View>
        ))}
      </View>
      <View style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
        padding: space.lg, gap: space.sm,
      }}>
        <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.surface, opacity: 0.92 }} />
        <Ionicons name="lock-closed" size={icon.md} color={colors.accent} />
        <Text accessibilityRole="header" style={[type.bodyEmphasis, { color: colors.text, textAlign: 'center' }]}>
          {t('history.locked.title', { count: hiddenCount })}
        </Text>
        <Text style={[type.caption, { color: colors.textSecondary, textAlign: 'center' }]}>{t('history.locked.body')}</Text>
        <PrimaryButton variant="secondary" label={t('history.locked.cta')} onPress={onUnlock} style={{ marginTop: space.xs }} />
      </View>
    </View>
  );
}
