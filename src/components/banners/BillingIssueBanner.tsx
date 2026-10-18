import React from 'react';
import { Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { usePurchaseStore } from '../../stores/purchaseStore';
import { purchases } from '../../services/purchases';

/** Shown when the store reports a billing problem (grace period). Renders nothing otherwise. */
export function BillingIssueBanner() {
  const { colors } = useTheme();
  const billingIssue = usePurchaseStore((s) => s.billingIssue);
  if (!billingIssue) return null;
  return (
    <View
      accessible accessibilityRole="alert"
      accessibilityLabel={`${t('paywall.billingIssue.title')}. ${t('paywall.billingIssue.body')}`}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md,
        borderRadius: radius.card, backgroundColor: colors.surface,
        borderWidth: 1, borderColor: colors.danger,
      }}
    >
      <Ionicons name="alert-circle-outline" size={22} color={colors.danger} importantForAccessibility="no" />
      <View style={{ flex: 1 }}>
        <Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{t('paywall.billingIssue.title')}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{t('paywall.billingIssue.body')}</Text>
      </View>
      <Pressable
        accessibilityRole="link" accessibilityLabel={t('paywall.billingIssue.open')}
        onPress={() => { Linking.openURL(purchases.manageSubscriptionUrl()).catch(() => {}); }}
        style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space.sm, maxWidth: 110 }}
      >
        <Text style={[type.label, { color: colors.danger }]}>{t('paywall.billingIssue.open')}</Text>
      </Pressable>
    </View>
  );
}
