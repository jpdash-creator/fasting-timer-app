import React, { useEffect, useRef } from 'react';
import { Platform, Text, View, useWindowDimensions } from 'react-native';
import { Card } from '../ui';
import { layout, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';

/** Shared chart geometry so all four plots line up. */
export const CHART_H = 140;
export const YAXIS_W = 40;
const CARD_PAD = space.lg;

/** One chart width for every chart: screen minus screen gutters, card padding and the y-axis gutter. */
export function useChartWidth() {
  const { width } = useWindowDimensions();
  return Math.max(200, Math.min(width, 640) - layout.screenX * 2 - CARD_PAD * 2 - YAXIS_W);
}

class Boundary extends React.Component<{ fallback: React.ReactNode; children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {}
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

/**
 * Fallback if the chart library errors: a plain list of first / last / lowest / highest values.
 * No bars, so nothing can misrepresent an offset axis.
 */
export function ValueList({ data, unit }: { data: { label: string; value: number }[]; unit?: string }) {
  const { colors } = useTheme();
  if (!data.length) return null;
  const vals = data.map((d) => d.value);
  const rows = [
    { key: 'valFirst', v: vals[0] },
    { key: 'valLast', v: vals[vals.length - 1] },
    { key: 'valMin', v: Math.min(...vals) },
    { key: 'valMax', v: Math.max(...vals) },
  ];
  return (
    <View style={{ gap: space.xs }}>
      {rows.map((r) => (
        <View key={r.key} style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{t(`stats.charts.${r.key}`)}</Text>
          <Text style={[type.caption, type.tabular, { color: colors.text, fontWeight: '600' }]}>
            {Math.round(r.v * 10) / 10}{unit ? ` ${unit}` : ''}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** Small readout bubble used by chart tooltips and pointers. Text wears text tokens, not series colour. */
export function ReadoutBubble({ lines }: { lines: string[] }) {
  const { colors } = useTheme();
  return (
    <View style={{
      backgroundColor: colors.toastBg, borderRadius: 8, paddingHorizontal: space.sm, paddingVertical: space.xs,
      alignItems: 'center',
    }}>
      {lines.map((l, i) => (
        <Text key={i} style={[type.micro, type.tabular, { color: colors.toastFg, fontWeight: i === 0 ? '700' : '400' }]}>{l}</Text>
      ))}
    </View>
  );
}

/**
 * Card with title, visible text summary (the chart's text alternative) and the chart itself,
 * which is hidden from screen readers since the summary carries the same information.
 */
export function ChartCard({ title, summary, fallback, children }: {
  title: string; summary: string; fallback: React.ReactNode; children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const plot = useRef<unknown>(null);
  // Web: the plot is hidden from assistive tech (the text summary replaces it), so its press targets
  // must not be keyboard tab stops either. Pointer press-to-read tooltips keep working.
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof MutationObserver === 'undefined') return;
    const el = plot.current as (Element & { querySelectorAll: (q: string) => NodeListOf<Element> }) | null;
    if (!el?.querySelectorAll) return;
    const fix = () => el.querySelectorAll('[tabindex]').forEach((n) => { if (n.getAttribute('tabindex') !== '-1') n.setAttribute('tabindex', '-1'); });
    fix();
    const mo = new MutationObserver(fix);
    mo.observe(el, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);
  return (
    <Card style={{ gap: space.sm }}>
      <View accessible accessibilityLabel={`${title}. ${summary}`} accessibilityRole="summary" style={{ gap: space.xs }}>
        <Text style={[type.bodyEmphasis, { color: colors.text }]}>{title}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{summary}</Text>
      </View>
      <View ref={plot as React.Ref<never>} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        <Boundary fallback={fallback}>{children}</Boundary>
      </View>
    </Card>
  );
}
