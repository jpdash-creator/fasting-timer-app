import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { format } from 'date-fns';
import { CHART_H, ChartCard, ReadoutBubble, ValueList, useChartWidth } from './ChartCard';
import { radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { fastsByWeekday, hoursPerDay, movingAverage, niceAxis } from '../../lib/stats';
import type { Fast } from '../../types';

const dayLabels = Array.from({ length: 7 }, (_, i) => format(new Date(2024, 0, 1 + i), 'EEE')); // Mon..Sun
const r1 = (n: number) => Math.round(n * 10) / 10;

export function WeeklyHoursChart({ fasts }: { fasts: Fast[] }) {
  const { colors } = useTheme();
  const w = useChartWidth();
  const days = useMemo(() => hoursPerDay(fasts, 7), [fasts]);
  const total = days.reduce((a, d) => a + d.hours, 0);
  const bestIdx = days.reduce((a, d, i) => (d.hours > days[a].hours ? i : a), 0);
  const best = days[bestIdx];
  const hUnit = t('common.hours');
  const summary = total > 0
    ? t('stats.charts.weeklySummary', { total: r1(total), avg: r1(total / 7), day: format(best.date, 'EEEE') })
    : t('stats.charts.weeklyNone');
  const data = days.map((d, i) => ({
    value: r1(d.hours), label: format(d.date, 'EEE'), frontColor: colors.accent,
    // Persistent value label on the best day only (direct label, not on every bar).
    topLabelComponent: i === bestIdx && d.hours > 0
      ? () => <Text style={[type.micro, type.tabular, { color: colors.text, fontWeight: '700', width: 48, textAlign: 'center', marginBottom: space.xs }]}>{r1(d.hours)} {hUnit}</Text>
      : undefined,
  }));
  const barW = Math.floor(w / 7 * 0.5);
  const mx = Math.max(0, ...data.map((d) => d.value));
  const axis = niceAxis(0, mx + mx * 0.12); // headroom so the best-day label is not clipped
  return (
    <ChartCard title={t('stats.charts.weeklyTitle')} summary={summary}
      fallback={<ValueList data={data} unit={hUnit} />}>
      <BarChart
        data={data} width={w} height={CHART_H} barWidth={barW} spacing={Math.floor(w / 7 - barW)} initialSpacing={8} endSpacing={0}
        barBorderRadius={radius.bar} noOfSections={axis.sections} hideRules={false} rulesColor={colors.border}
        yAxisThickness={0} xAxisThickness={1} xAxisColor={colors.border} yAxisTextStyle={{ color: colors.textSecondary, ...type.chart }}
        xAxisLabelTextStyle={{ color: colors.textSecondary, ...type.chart }} disableScroll
        maxValue={axis.hi} roundToDigits={0} focusBarOnPress focusedBarConfig={{ color: colors.accent, opacity: 0.7 }}
        renderTooltip={(item: { value: number; label: string }, index: number) =>
          index === bestIdx ? null : <ReadoutBubble lines={[`${item.value} ${hUnit}`, item.label]} />}
      />
    </ChartCard>
  );
}

export function TrendChart({ fasts }: { fasts: Fast[] }) {
  const { colors } = useTheme();
  const w = useChartWidth();
  const days = useMemo(() => hoursPerDay(fasts, 30), [fasts]);
  const smooth = useMemo(() => movingAverage(days.map((d) => d.hours), 7), [days]);
  const first = smooth[6] ?? smooth[0];
  const last = smooth[smooth.length - 1];
  const hUnit = t('common.hours');
  const summary = t('stats.charts.trendSummary', { from: r1(first), to: r1(last) });
  const data = smooth.map((v, i) => ({
    value: r1(v), label: '', date: format(days[i].date, 'MMM d'),
  }));
  const axis = niceAxis(0, Math.max(0, ...data.map((d) => d.value)));
  return (
    <ChartCard title={t('stats.charts.trendTitle')} summary={summary}
      fallback={<ValueList data={data} unit={hUnit} />}>
      <LineChart
        data={data} width={w} height={CHART_H} color={colors.accent} thickness={3} curved hideDataPoints
        spacing={Math.max(4, (w - 16) / 30)} initialSpacing={8} endSpacing={0} noOfSections={axis.sections} maxValue={axis.hi} roundToDigits={0}
        rulesColor={colors.border} yAxisThickness={0} xAxisColor={colors.border}
        yAxisTextStyle={{ color: colors.textSecondary, ...type.chart }}
        disableScroll
        areaChart startFillColor={colors.accent} startOpacity={0.18} endOpacity={0.02}
        pointerConfig={{
          pointerStripColor: colors.textSecondary, pointerStripWidth: 1, pointerColor: colors.accent, radius: 5,
          pointerLabelWidth: 72, pointerLabelHeight: 44, activatePointersOnLongPress: false, autoAdjustPointerLabelPosition: true,
          pointerVanishDelay: 2500,
          pointerLabelComponent: (items: { value: number; date: string }[]) => (
            <ReadoutBubble lines={[`${items[0].value} ${hUnit}`, items[0].date]} />
          ),
        }}
      />
      {/* Dates drawn here: chart x-labels are clipped to the per-point slot. */}
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingLeft: 36, paddingRight: space.xs, marginTop: space.xs }} importantForAccessibility="no-hide-descendants" aria-hidden>
        {[0, Math.floor((data.length - 1) / 2), data.length - 1].map((i) => (
          <Text key={i} style={[type.chart, { color: colors.textSecondary }]}>{data[i]?.date}</Text>
        ))}
      </View>
    </ChartCard>
  );
}

export function WeekdayChart({ fasts }: { fasts: Fast[] }) {
  const { colors } = useTheme();
  const w = useChartWidth();
  const counts = useMemo(() => fastsByWeekday(fasts), [fasts]);
  const topIdx = counts.indexOf(Math.max(...counts));
  const hasAny = Math.max(...counts) > 0;
  const summary = hasAny
    ? t('stats.charts.weekdaySummary', { day: format(new Date(2024, 0, 1 + topIdx), 'EEEE'), count: counts[topIdx] })
    : t('stats.charts.weekdayNone');
  const data = counts.map((c, i) => ({
    value: c, label: dayLabels[i], frontColor: i === topIdx ? colors.accent : colors.accentMuted,
    topLabelComponent: i === topIdx && hasAny
      ? () => <Text style={[type.micro, type.tabular, { color: colors.text, fontWeight: '700', width: 32, textAlign: 'center', marginBottom: space.xs }]}>{c}</Text>
      : undefined,
  }));
  const barW = Math.floor(w / 7 * 0.5);
  const mxc = Math.max(0, ...counts);
  const axis = niceAxis(0, mxc + mxc * 0.12, { minSections: 2, maxSections: 4 });
  return (
    <ChartCard title={t('stats.charts.weekdayTitle')} summary={summary}
      fallback={<ValueList data={data.map((d) => ({ label: d.label, value: d.value }))} />}>
      <BarChart
        data={data} width={w} height={CHART_H} barWidth={barW} spacing={Math.floor(w / 7 - barW)} initialSpacing={8} endSpacing={0}
        barBorderRadius={radius.bar} noOfSections={axis.sections} roundToDigits={0} rulesColor={colors.border} yAxisThickness={0} xAxisColor={colors.border}
        yAxisTextStyle={{ color: colors.textSecondary, ...type.chart }} xAxisLabelTextStyle={{ color: colors.textSecondary, ...type.chart }}
        disableScroll maxValue={axis.hi} focusBarOnPress focusedBarConfig={{ color: colors.accent }}
        renderTooltip={(item: { value: number; label: string }, index: number) =>
          index === topIdx ? null : <ReadoutBubble lines={[String(item.value), item.label]} />}
      />
    </ChartCard>
  );
}
