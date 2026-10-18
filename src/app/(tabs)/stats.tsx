import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { useRouter } from '../../router';
import { PrimaryButton, Screen, Title } from '../../components/ui';
import { BadgesRow, InsightCard, LockedCard, SegmentedControl, StreakCard, TotalsGrid } from '../../components/stats/Widgets';
import { TrendChart, WeekdayChart, WeeklyHoursChart } from '../../components/stats/OverviewCharts';
import { WeightPanel } from '../../components/stats/WeightPanel';
import { WaterPanel } from '../../components/stats/WaterPanel';
import { UndoToast, type ToastState } from '../../components/logs/UndoToast';
import { icon, layout, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { computeStreaks } from '../../lib/fastMath';
import { computeBadges } from '../../lib/badges';
import { weeklyInsight } from '../../lib/insights';
import { completed, computeTotals } from '../../lib/stats';
import { useProGate } from '../../lib/proGate';
import { useFastStore } from '../../stores/fastStore';
import { useIsPro } from '../../stores/purchaseStore';

type Tab = 'overview' | 'weight' | 'water';

export default function StatsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const gate = useProGate();
  const isPro = useIsPro();
  const fasts = useFastStore((s) => s.fasts);
  const [tab, setTab] = useState<Tab>('overview');
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismiss = useCallback(() => setToast(null), []);
  const showToast = useCallback((message: string, undo: () => void) => setToast({ id: Date.now(), message, onUndo: undo }), []);

  const done = useMemo(() => completed(fasts), [fasts]);
  const streaks = useMemo(() => computeStreaks(fasts, isPro), [fasts, isPro]);
  const totals = useMemo(() => computeTotals(fasts), [fasts]);
  const badges = useMemo(() => computeBadges(fasts, isPro), [fasts, isPro]);
  const insight = useMemo(() => weeklyInsight(fasts), [fasts]);
  const unlock = () => gate('stats', () => {});

  const overview = done.length < 2 ? (
    <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.xl }}>
      <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name="stats-chart-outline" size={icon.hero} color={colors.accent} />
      </View>
      <Text accessibilityRole="header" style={[type.subtitle, { color: colors.text, textAlign: 'center' }]}>{t('stats.empty.title')}</Text>
      <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center' }]}>
        {t('stats.empty.body', { count: 2 - done.length })}
      </Text>
      <PrimaryButton label={t('stats.empty.cta')} onPress={() => router.replace('/')} style={{ marginTop: space.md, alignSelf: 'stretch' }} />
    </View>
  ) : (
    <View style={{ gap: space.lg }}>
      <View style={{ flexDirection: 'row', gap: space.md }}>
        <StreakCard label={t('stats.streak.current')} days={streaks.current} icon="flame" />
        {isPro ? <StreakCard label={t('stats.streak.longest')} days={streaks.longest} icon="trophy" /> : null}
      </View>
      {isPro ? (
        <>
          <TotalsGrid totals={totals} />
          <WeeklyHoursChart fasts={fasts} />
          <TrendChart fasts={fasts} />
          <WeekdayChart fasts={fasts} />
          <InsightCard insight={insight} />
        </>
      ) : (
        <LockedCard title={t('stats.locked.title')} body={t('stats.locked.body')} onUnlock={unlock} />
      )}
      <BadgesRow badges={badges} />
    </View>
  );

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.lg, gap: layout.sectionGap, paddingBottom: layout.scrollBottom }}>
          <Title>{t('stats.title')}</Title>
          <SegmentedControl<Tab>
            value={tab} onChange={setTab}
            options={[
              { id: 'overview', label: t('stats.tabs.overview') },
              { id: 'weight', label: t('stats.tabs.weight') },
              { id: 'water', label: t('stats.tabs.water') },
            ]}
          />
          {tab === 'overview' ? overview : tab === 'weight' ? <WeightPanel /> : <WaterPanel onToast={showToast} />}
        </ScrollView>
        <UndoToast toast={toast} onDismiss={dismiss} />
      </View>
    </Screen>
  );
}
