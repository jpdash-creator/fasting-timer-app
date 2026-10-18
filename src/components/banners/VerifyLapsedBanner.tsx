import React, { useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { graceLapsed } from '../../lib/entitlement';
import { usePurchaseStore, useIsPro } from '../../stores/purchaseStore';
import { purchases } from '../../services/purchases';

/**
 * Spec 16.8 / edge case 8: after the 7-day offline grace lapses without a successful store check,
 * Pro is withdrawn. Soft banner with Retry (purchases.refresh()). Renders nothing otherwise; a
 * successful refresh overwrites the cached state, which hides it.
 */
export function VerifyLapsedBanner() {
  const { colors } = useTheme();
  useIsPro(); // re-renders at the moment the grace lapses
  const isPro = usePurchaseStore((s) => s.isPro);
  const expiresAt = usePurchaseStore((s) => s.expiresAt);
  const mockPro = usePurchaseStore((s) => s.mockPro);
  const [busy, setBusy] = useState(false);
  if (!graceLapsed({ isPro, expiresAt, mockPro })) return null;

  const retry = async () => {
    if (busy) return;
    setBusy(true);
    try { await purchases.refresh(); } catch { /* still offline: banner stays */ } finally { setBusy(false); }
  };

  return (
    <View
      accessible accessibilityRole="alert"
      accessibilityLabel={`${t('paywall.verifyLapsed.title')}. ${t('paywall.verifyLapsed.body')}`}
      style={{
        flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.md,
        borderRadius: radius.card, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={22} color={colors.textSecondary} importantForAccessibility="no" />
      <View style={{ flex: 1, flexBasis: 200 }}>
        <Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{t('paywall.verifyLapsed.title')}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{t('paywall.verifyLapsed.body')}</Text>
      </View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={t('common.retry')} accessibilityState={{ busy, disabled: busy }}
        onPress={retry} disabled={busy}
        style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.sm }}
      >
        {busy ? <ActivityIndicator color={colors.accent} /> : <Text style={[type.label, { color: colors.accent }]}>{t('common.retry')}</Text>}
      </Pressable>
    </View>
  );
}
