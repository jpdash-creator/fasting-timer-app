import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { Card, PrimaryButton } from '../ui';
import { hit, icon, radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import type { Totals } from '../../lib/stats';
import type { WeeklyInsight } from '../../lib/insights';
import type { Badge } from '../../lib/badges';
import { format } from 'date-fns';
import { getProtocol } from '../../lib/protocols';
import { useSettingsStore } from '../../stores/settingsStore';

export function SegmentedControl<T extends string>({ options, value, onChange }: {
  options: { id: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View accessibilityRole="tablist" style={{
      flexDirection: 'row', padding: space.xs, borderRadius: radius.button, backgroundColor: colors.track, gap: space.xs,
    }}>
      {options.map((o) => {
        const active = o.id === value;
        return (
          <Pressable key={o.id} accessibilityRole="tab" aria-selected={active}
            accessibilityLabel={o.label} onPress={() => onChange(o.id)}
            style={{ flex: 1, minHeight: hit.min, borderRadius: radius.button - space.xs, alignItems: 'center', justifyContent: 'center',
              backgroundColor: active ? colors.accentSoft : 'transparent',
              borderWidth: 1.5, borderColor: active ? colors.accent : 'transparent' }}>
            <Text style={[type.label, { color: active ? colors.accent : colors.textSecondary, fontWeight: active ? '700' : '500' }]}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function StreakCard({ label, days, icon: iconName, a11yHint }: {
  label: string; days: number; icon: React.ComponentProps<typeof Ionicons>['name']; a11yHint?: string;
}) {
  const { colors } = useTheme();
  return (
    <Card style={{ flex: 1, gap: space.xs }}>
      <View accessible role="group" accessibilityLabel={`${label}: ${t('stats.days', { count: days })}`} accessibilityHint={a11yHint}
        style={{ gap: space.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
          <Ionicons name={iconName} size={icon.sm} color={colors.accent} />
          <Text style={[type.caption, { color: colors.textSecondary }]}>{label}</Text>
        </View>
        <Text style={[type.stat, { color: colors.text }]}>{days}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{t('stats.days', { count: days })}</Text>
      </View>
    </Card>
  );
}

export function TotalsGrid({ totals }: { totals: Totals }) {
  const { colors } = useTheme();
  const items = [
    { label: t('stats.totals.fasts'), value: String(totals.totalFasts) },
    { label: t('stats.totals.hours'), value: String(Math.round(totals.totalHours)) },
    { label: t('stats.totals.avg'), value: `${totals.avgHours.toFixed(1)} ${t('common.hours')}` },
    { label: t('stats.totals.rate'), value: `${Math.round(totals.goalRate * 100)}%` },
  ];
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
      {items.map((it) => (
        <Card key={it.label} style={{ width: '47.5%', flexGrow: 1, gap: space.xs, minHeight: 84 }}>
          <View accessible role="group" accessibilityLabel={`${it.label}: ${it.value}`}>
            <Text style={[type.tabular, { fontSize: 26, fontWeight: '700', color: colors.text }]}>{it.value}</Text>
            <Text style={[type.caption, { color: colors.textSecondary }]}>{it.label}</Text>
          </View>
        </Card>
      ))}
    </View>
  );
}

export function InsightCard({ insight }: { insight: WeeklyInsight }) {
  const { colors } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const lines: string[] = [];
  if (insight.bestWeekday) {
    lines.push(t('stats.insight.bestDay', { day: format(new Date(2024, 0, insight.bestWeekday), 'EEEE') }));
  }
  if (insight.bestProtocolId && insight.bestProtocolRate !== null) {
    lines.push(t('stats.insight.bestProtocol', {
      name: getProtocol(insight.bestProtocolId, settings).name, pct: Math.round(insight.bestProtocolRate * 100),
    }));
  }
  if (insight.moodLong !== null && insight.moodShort !== null) {
    lines.push(t('stats.insight.moodLength', { long: insight.moodLong.toFixed(1), short: insight.moodShort.toFixed(1) }));
  }
  lines.push(t(`stats.insight.tip.${insight.tip}`));
  return (
    <Card style={{ backgroundColor: colors.accentSoft, gap: space.sm }}>
      <View accessible role="group" accessibilityLabel={`${t('stats.insight.title')}. ${lines.join(' ')}`} style={{ gap: space.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
          <Ionicons name="bulb-outline" size={icon.sm} color={colors.accent} />
          <Text accessibilityRole="header" style={[type.bodyEmphasis, { color: colors.text }]}>{t('stats.insight.title')}</Text>
        </View>
        {lines.map((l, i) => (
          <Text key={i} style={[type.body, { color: colors.text }]}>{l}</Text>
        ))}
        <Text style={[type.caption, { color: colors.textSecondary }]}>{t('stats.insight.disclaimer')}</Text>
      </View>
    </Card>
  );
}

const BADGE_ICON: Record<string, React.ComponentProps<typeof Ionicons>['name']> = {
  firstFast: 'flag', streak3: 'flame', streak7: 'flame', streak30: 'trophy', hours100: 'hourglass', first20h: 'moon',
};

export function BadgesRow({ badges }: { badges: Badge[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.sm }}>
      <Text accessibilityRole="header" style={[type.bodyEmphasis, { color: colors.text }]}>{t('stats.badges.title')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.md }}>
        {badges.map((b) => (
          <View key={b.id} accessible role="img"
            accessibilityLabel={`${t(`stats.badges.${b.id}`)}, ${b.earned ? t('stats.badges.earned') : t('stats.badges.locked', { pct: Math.round(b.progress * 100) })}`}
            style={{ width: 88, alignItems: 'center', gap: space.xs }}>
            <View style={{
              width: hit.comfortable, height: hit.comfortable, borderRadius: hit.comfortable / 2, alignItems: 'center', justifyContent: 'center',
              backgroundColor: b.earned ? colors.accentSoft : colors.track,
              borderWidth: b.earned ? 2 : 1, borderColor: b.earned ? colors.accent : colors.border,
            }}>
              <Ionicons name={b.earned ? BADGE_ICON[b.id] : 'lock-closed'} size={24}
                color={b.earned ? colors.accent : colors.textSecondary} />
            </View>
            <Text style={[type.caption, { color: colors.text, textAlign: 'center' }]} numberOfLines={2}>{t(`stats.badges.${b.id}`)}</Text>
            {!b.earned ? (
              <Text style={[type.micro, { color: colors.textSecondary }]}>{Math.round(b.progress * 100)}%</Text>
            ) : null}
          </View>
        ))}
      </View>
    </View>
  );
}

export function LockedCard({ title, body, onUnlock }: { title: string; body: string; onUnlock: () => void }) {
  const { colors } = useTheme();
  return (
    <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
      <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="lock-closed" size={icon.md} color={colors.accent} />
      </View>
      <Text accessibilityRole="header" style={[type.bodyEmphasis, { color: colors.text, textAlign: 'center' }]}>{title}</Text>
      <Text style={[type.caption, { color: colors.textSecondary, textAlign: 'center' }]}>{body}</Text>
      <PrimaryButton variant="secondary" label={t('common.unlock')} onPress={onUnlock} style={{ marginTop: space.sm, alignSelf: 'stretch' }} />
    </Card>
  );
}
