import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { hit, icon as iconSize, radius as radii, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import type { PlanPackage } from '../../services/purchases';

/** Readable text colour on the accent fill in both themes (>= 4.5:1). */
export function useOnAccent() {
  return useTheme().colors.onAccent;
}

export function Badge({ label }: { label: string }) {
  const { colors } = useTheme();
  const fg = useOnAccent();
  return (
    <View style={{ backgroundColor: colors.accent, borderRadius: radii.chip, paddingHorizontal: space.sm, paddingVertical: space.xs / 2 }}>
      <Text style={[type.micro, { color: fg, fontWeight: '700' }]}>{label}</Text>
    </View>
  );
}

export function BenefitRow({ icon, label }: { icon: keyof typeof Ionicons.glyphMap; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md, minHeight: hit.min }} accessible role="group" accessibilityLabel={label}>
      <View style={{ width: hit.min - 8, height: hit.min - 8, borderRadius: radii.chip, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={icon} size={iconSize.md} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
      </View>
      <Text style={[type.body, { flex: 1, color: colors.text }]}>{label}</Text>
    </View>
  );
}

const periodName = (p: PlanPackage) => t(`paywall.plan.per.${p.periodLabel}`);

export function PlanCard({ pkg, monthly, selected, onPress, disabled }: {
  pkg: PlanPackage; monthly?: PlanPackage; selected: boolean; onPress: () => void; disabled?: boolean;
}) {
  const { colors, radius } = useTheme();
  const isAnnual = pkg.id === 'annual';
  const name = t(`paywall.plan.${pkg.id}`);
  const billed = t(
    pkg.id === 'annual' ? 'paywall.plan.billedYearly' : pkg.id === 'monthly' ? 'paywall.plan.billedMonthly' : 'paywall.plan.billedWeekly',
    { price: pkg.priceString },
  );
  const badge = isAnnual
    ? pkg.trialDays > 0 ? t('paywall.plan.trialBadge', { days: pkg.trialDays }) : t('paywall.plan.bestValue')
    : null;
  const mainPrice = isAnnual && pkg.perMonthString ? t('paywall.plan.perMonth', { price: pkg.perMonthString }) : `${pkg.priceString}/${periodName(pkg)}`;
  const strike = isAnnual && monthly ? monthly.priceString : null;
  const label = [name, badge, billed, mainPrice].filter(Boolean).join(', ');

  return (
    <Pressable
      accessibilityRole="radio" aria-checked={selected} aria-disabled={!!disabled}
      accessibilityLabel={label} disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: space.lg, paddingVertical: space.md, borderRadius: radius.card,
        backgroundColor: selected ? colors.accentSoft : colors.surface,
        borderWidth: selected ? 2 : 1.5, borderColor: selected ? colors.accent : colors.controlBorder,
        opacity: pressed ? 0.9 : 1,
      })}
    >
      <View style={{
        width: 24, height: 24, borderRadius: radii.chip, alignItems: 'center', justifyContent: 'center',
        borderWidth: 2, borderColor: selected ? colors.accent : colors.controlBorder,
        backgroundColor: selected ? colors.accent : 'transparent',
      }}>
        {selected ? <Ionicons name="checkmark" size={16} color={colors.onAccent} /> : null}
      </View>
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
          <Text style={[type.bodyEmphasis, { color: colors.text, fontWeight: '700' }]}>{name}</Text>
          {badge ? <Badge label={badge} /> : null}
        </View>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{billed}</Text>
      </View>
      <View style={{ alignItems: 'flex-end', maxWidth: '38%' }}>
        {strike ? (
          <Text style={[type.caption, { color: colors.textSecondary, textDecorationLine: 'line-through' }]}>{strike}/{t('paywall.plan.per.month')}</Text>
        ) : null}
        <Text style={[type.bodyEmphasis, type.tabular, { color: colors.text, fontWeight: '700' }]}>{mainPrice}</Text>
      </View>
    </Pressable>
  );
}
