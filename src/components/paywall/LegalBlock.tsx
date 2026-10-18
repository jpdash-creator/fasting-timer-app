import React, { useState } from 'react';
import { Linking, Platform, Pressable, Text, View } from 'react-native';
import { hit, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import type { PlanPackage } from '../../services/purchases';
import { HAS_PRIVACY_URL, HAS_TERMS_URL, PRIVACY_URL, TERMS_URL } from '../../lib/links';
import { PRIVACY_POLICY_TEXT, TERMS_TEXT } from '../../lib/legalText';
import { LegalTextSheet } from '../settings/LegalTextSheet';

export { PRIVACY_URL, TERMS_URL };

const storeName = () =>
  Platform.OS === 'ios' ? t('paywall.legal.appStore')
    : Platform.OS === 'android' ? t('paywall.legal.googlePlay') : t('paywall.legal.store');

function LinkText({ label, onPress, role = 'link' }: { label: string; onPress: () => void; role?: 'link' | 'button' }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={role} accessibilityLabel={label} onPress={onPress}
      style={{ minHeight: hit.min, justifyContent: 'center', paddingHorizontal: space.sm }}
    >
      <Text style={[type.caption, { color: colors.accent, fontWeight: '600', textDecorationLine: 'underline' }]}>{label}</Text>
    </Pressable>
  );
}

/** Required subscription disclosures (App Store 3.1.2, Google Play policy). Shown directly under the CTA. */
export function LegalBlock({ pkg, onRestore, busy }: { pkg: PlanPackage | null; onRestore: () => void; busy?: boolean }) {
  const { colors } = useTheme();
  const store = storeName();
  const [doc, setDoc] = useState<null | 'privacy' | 'terms'>(null);
  const open = (url: string) => { Linking.openURL(url).catch(() => {}); };

  let price: string | null = null;
  if (pkg) {
    const period = t(`paywall.plan.per.${pkg.periodLabel}`);
    if (pkg.id === 'lifetime') price = t('paywall.legal.lifetime', { price: pkg.priceString });
    else if (pkg.trialDays > 0) price = t('paywall.legal.trial', { days: pkg.trialDays, price: pkg.priceString, period, store });
    else price = t('paywall.legal.sub', { price: pkg.priceString, period, store });
  }
  const isSub = !!pkg && pkg.id !== 'lifetime';
  const small = { ...type.caption, color: colors.textSecondary, textAlign: 'center' as const, lineHeight: 18 };

  return (
    <View style={{ gap: space.sm, alignItems: 'center' }}>
      {price ? <Text style={[small, { color: colors.text }]}>{price}</Text> : null}
      {isSub ? <Text style={small}>{t('paywall.legal.renew', { store })}</Text> : null}
      {pkg && pkg.trialDays > 0 && isSub ? <Text style={small}>{t('paywall.legal.trialConverts')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' }}>
        <LinkText label={t('paywall.legal.terms')} onPress={() => (HAS_TERMS_URL ? open(TERMS_URL) : setDoc('terms'))} />
        <LinkText label={t('paywall.legal.privacy')} onPress={() => (HAS_PRIVACY_URL ? open(PRIVACY_URL) : setDoc('privacy'))} />
        <LinkText label={t('paywall.legal.restore')} role="button" onPress={() => { if (!busy) onRestore(); }} />
      </View>
      <LegalTextSheet
        visible={doc !== null} onClose={() => setDoc(null)}
        title={doc === 'terms' ? t('paywall.legal.terms') : t('paywall.legal.privacy')}
        text={doc === 'terms' ? TERMS_TEXT : PRIVACY_POLICY_TEXT}
      />
    </View>
  );
}
