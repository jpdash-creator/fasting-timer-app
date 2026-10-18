import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Ionicons } from '../../platform/icons';
import { useRouter } from '../../router';
import { format } from 'date-fns';
import { Card, PrimaryButton, Separator, haptic } from '../ui';
import { CHART_H, ChartCard, ReadoutBubble, ValueList, useChartWidth } from './ChartCard';
import { LockedCard, SegmentedControl } from './Widgets';
import { hit, icon, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { useProGate } from '../../lib/proGate';
import { niceAxis } from '../../lib/stats';
import { fmtWeight, inRange, kgToDisplay, weightMovingAverage, type WeightRange } from '../../lib/statsWeight';
import { useLogStore } from '../../stores/logStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useIsPro } from '../../stores/purchaseStore';

const FREE_ENTRIES = 7;

export function WeightPanel() {
  const { colors } = useTheme();
  const router = useRouter();
  const gate = useProGate();
  const isPro = useIsPro();
  const weights = useLogStore((s) => s.weights);
  const unit = useSettingsStore((s) => s.settings.units.weight);
  const goalKg = useSettingsStore((s) => s.settings.goalWeightKg);
  const [range, setRange] = useState<WeightRange>(30);
  const w = useChartWidth();

  const sorted = useMemo(() => [...weights].sort((a, b) => a.at - b.at), [weights]);
  const latest = sorted[sorted.length - 1] ?? null;
  const prev = sorted[sorted.length - 2] ?? null;
  const delta = latest && prev ? kgToDisplay(latest.kg - prev.kg, unit) : null;

  const open = (step?: number) =>
    router.push({ pathname: '/log-weight', params: step ? { step: String(step) } : {} });

  const rangeEntries = useMemo(() => inRange(sorted, range), [sorted, range]);
  const avg = useMemo(() => weightMovingAverage(sorted).slice(-rangeEntries.length || undefined), [sorted, rangeEntries.length]);

  const chart = (() => {
    if (rangeEntries.length < 2) {
      return <Text style={[type.body, { color: colors.textSecondary }]}>{t('stats.weight.needTwo')}</Text>;
    }
    const pts = rangeEntries.map((e, i) => ({
      value: Number(kgToDisplay(e.kg, unit).toFixed(1)),
      label: '',
      date: format(e.at, 'MMM d'),
    }));
    const trend = avg.map((v) => ({ value: Number(kgToDisplay(v, unit).toFixed(1)) }));
    const goal = goalKg !== null ? kgToDisplay(goalKg, unit) : null;
    const vals = [...pts.map((p) => p.value), ...trend.map((p) => p.value), ...(goal !== null ? [goal] : [])];
    const axis = niceAxis(Math.min(...vals), Math.max(...vals), { minSections: 2, maxSections: 4, zeroBased: false });
    const lo = axis.lo;
    const hi = axis.hi;
    const first = pts[0].value;
    const last = pts[pts.length - 1].value;
    const summary = t('stats.weight.chartSummary', {
      count: pts.length, days: range, from: first.toFixed(1), to: last.toFixed(1), unit,
    }) + (goal !== null ? ' ' + t('stats.weight.goalLine', { goal: goal.toFixed(1), unit }) : '');
    return (
      <ChartCard title={t('stats.weight.chartTitle', { days: range, unit })} summary={summary}
        fallback={<ValueList data={pts} unit={unit} />}>
        <LineChart
          data={pts} data2={trend} width={w} height={CHART_H} yAxisOffset={lo} maxValue={hi - lo} noOfSections={axis.sections} roundToDigits={0}
          spacing={Math.max(6, (w - 24) / Math.max(1, pts.length - 1))} initialSpacing={12} endSpacing={12}
          color1={colors.textSecondary} color2={colors.accent} thickness1={1} thickness2={3}
          dataPointsColor1={colors.textSecondary} dataPointsRadius1={4} hideDataPoints2
          rulesColor={colors.border} yAxisThickness={0} xAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textSecondary, ...type.chart }}
          disableScroll
          showReferenceLine1={goal !== null} referenceLine1Position={goal ?? 0}
          referenceLine1Config={{
            color: colors.textSecondary, dashWidth: 6, dashGap: 4, thickness: 2,
            labelText: goal !== null ? t('stats.weight.legendGoal', { goal: goal.toFixed(1), unit }) : undefined,
            labelTextStyle: { color: colors.textSecondary, ...type.chart, position: 'absolute', right: 0, top: -18 },
          }}
          pointerConfig={{
            pointerStripColor: colors.textSecondary, pointerStripWidth: 1, pointerColor: colors.accent, radius: 5,
            pointerLabelWidth: 150, pointerLabelHeight: 56, activatePointersOnLongPress: false,
            autoAdjustPointerLabelPosition: true, pointerVanishDelay: 2500,
            pointerLabelComponent: (items: { value: number; date?: string }[]) => (
              <ReadoutBubble lines={[
                `${items[0].value} ${unit}`,
                ...(items[1] ? [`${t('stats.weight.legendAverage')} ${items[1].value} ${unit}`] : []),
                items[0].date ?? '',
              ].filter(Boolean)} />
            ),
          }}
        />
        {/* First/last date drawn here: chart x-labels are clipped to the (tiny) per-point slot. */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 36, paddingRight: space.xs, marginTop: space.xs }} importantForAccessibility="no-hide-descendants" aria-hidden>
          <Text style={[type.chart, { color: colors.textSecondary }]}>{pts[0].date}</Text>
          <Text style={[type.chart, { color: colors.textSecondary }]}>{pts[pts.length - 1].date}</Text>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.xs, marginTop: space.md }}>
          <LegendItem mark={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.textSecondary }} />}
            label={t('stats.weight.legendEntries')} />
          <LegendItem mark={<View style={{ width: 16, height: 3, borderRadius: 2, backgroundColor: colors.accent }} />}
            label={t('stats.weight.legendAverage')} />
          {goal !== null ? (
            <LegendItem
              mark={<View style={{ width: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
                <View style={{ width: 6, height: 2, backgroundColor: colors.textSecondary }} />
                <View style={{ width: 6, height: 2, backgroundColor: colors.textSecondary }} />
              </View>}
              label={t('stats.weight.legendGoal', { goal: goal.toFixed(1), unit })} />
          ) : null}
        </View>
      </ChartCard>
    );
  })();

  const stepBtn = (name: 'remove' | 'add', step: number, label: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label}
      onPress={() => { haptic('light'); open(step); }}
      style={{ width: hit.comfortable, height: hit.comfortable, borderRadius: hit.comfortable / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accentSoft }}>
      <Ionicons name={name} size={icon.lg} color={colors.accent} />
    </Pressable>
  );

  return (
    <View style={{ gap: space.lg }}>
      <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.xl }}>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{t('stats.weight.current')}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xl }}>
          {stepBtn('remove', -1, t('stats.weight.lower'))}
          <View accessible role="group" accessibilityLabel={latest ? t('stats.weight.currentA11y', { value: fmtWeight(latest.kg, unit), unit }) : t('stats.weight.none')}
            style={{ alignItems: 'center', minWidth: 120 }}>
            <Text style={[type.tabular, { fontSize: 48, fontWeight: '700', color: latest ? colors.text : colors.textSecondary }]}>
              {latest ? fmtWeight(latest.kg, unit) : '–'}
            </Text>
            <Text style={[type.body, { color: colors.textSecondary }]}>{unit}</Text>
          </View>
          {stepBtn('add', 1, t('stats.weight.higher'))}
        </View>
        {delta !== null ? (
          <Text style={[type.body, { color: colors.textSecondary }]}>
            {delta === 0 ? t('stats.weight.noChange')
              : t(delta < 0 ? 'stats.weight.down' : 'stats.weight.up', { value: Math.abs(delta).toFixed(1), unit })}
          </Text>
        ) : null}
        {!latest ? <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('stats.weight.empty')}</Text> : null}
      </Card>

      <PrimaryButton label={t('stats.weight.log')} onPress={() => open()} />

      {isPro ? (
        <>
          {sorted.length ? <SegmentedControl<'7' | '30' | '90'>
            value={String(range) as '7' | '30' | '90'} onChange={(v) => setRange(Number(v) as WeightRange)}
            options={[{ id: '7', label: t('stats.weight.range', { days: 7 }) }, { id: '30', label: t('stats.weight.range', { days: 30 }) }, { id: '90', label: t('stats.weight.range', { days: 90 }) }]}
          /> : null}
          {sorted.length ? chart : null}
          {goalKg === null && sorted.length ? <Text style={[type.caption, { color: colors.textSecondary }]}>{t('stats.weight.goalHint')}</Text> : null}
        </>
      ) : (
        <>
          {sorted.length ? (
            <Card style={{ paddingVertical: space.xs, paddingHorizontal: 0 }}>
              {[...sorted].reverse().slice(0, FREE_ENTRIES).map((e, i, arr) => (
                <View key={e.id}>
                  <View style={{ minHeight: hit.comfortable, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg }}>
                    <Text style={[type.body, { color: colors.textSecondary }]}>{format(e.at, 'EEE, MMM d')}</Text>
                    <Text style={[type.bodyEmphasis, type.tabular, { color: colors.text }]}>{fmtWeight(e.kg, unit)} {unit}</Text>
                  </View>
                  {i < arr.length - 1 ? <Separator /> : null}
                </View>
              ))}
            </Card>
          ) : null}
          <LockedCard title={t('stats.weight.lockedTitle')} body={t('stats.weight.lockedBody')} onUnlock={() => gate('weight_chart', () => {})} />
        </>
      )}
    </View>
  );
}


function LegendItem({ mark, label }: { mark: React.ReactNode; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {mark}
      <Text style={[type.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}
