import React, { useMemo } from 'react';
import { I18nManager, Platform, Pressable, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { hit, icon, radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { isoWeekday } from '../../lib/protocols';

export interface DayMark { fasts: number; goalMet: boolean }

/** FR-10: dot per day with a completed fast, filled if goal met, snowflake for freeze days. */
export function HistoryCalendar({ marks, freezes, selectedDay, onSelectDay, focusDate, fastingWeekdays }: {
  marks: Map<string, DayMark>; freezes: Set<string>;
  /** yyyy-MM-dd of the day the list is filtered to (tap again to clear). */
  selectedDay?: string | null; onSelectDay?: (day: string | null) => void;
  /** yyyy-MM-dd to scroll the visible month to (deep link). */
  focusDate?: string;
  /** ISO weekdays (1 = Mon) planned for fasting by the active 5:2 protocol; upcoming ones get a dashed outline. */
  fastingWeekdays?: number[];
}) {
  const { colors, scheme } = useTheme();
  const today = format(new Date(), 'yyyy-MM-dd');
  const isWeb = Platform.OS === 'web';
  // Roving tab stop (web): one marked day per month is tabbable, arrow keys move between marked days.
  const rovingByMonth = useMemo(() => {
    const out = new Map<string, string>();
    for (const k of Array.from(marks.keys()).sort()) { const mo = k.slice(0, 7); if (!out.has(mo)) out.set(mo, k); }
    if (selectedDay && marks.has(selectedDay)) out.set(selectedDay.slice(0, 7), selectedDay);
    return out;
  }, [marks, selectedDay]);
  const onKeyDown = (e: any) => {
    if (!isWeb) return;
    const key = e.key as string;
    const nav = ['ArrowRight', 'ArrowLeft', 'ArrowDown', 'ArrowUp', 'Home', 'End'];
    if (!nav.includes(key)) return;
    const root = e.currentTarget as HTMLElement | undefined;
    const target = e.target as HTMLElement | undefined;
    if (!root || !target || !target.closest?.('[data-calday]')) return;
    const days = Array.from(root.querySelectorAll<HTMLElement>('[data-calday]'));
    const i = days.indexOf(target.closest('[data-calday]') as HTMLElement);
    if (i < 0) return;
    const rtl = document.documentElement.dir === 'rtl';
    const fwd = key === 'ArrowDown' || key === (rtl ? 'ArrowLeft' : 'ArrowRight');
    const next = key === 'Home' ? 0 : key === 'End' ? days.length - 1 : i + (fwd ? 1 : -1);
    const el = days[Math.max(0, Math.min(days.length - 1, next))];
    if (el) { e.preventDefault?.(); el.focus(); }
  };

  const Day = useMemo(() => {
    const D = ({ date }: { date?: { dateString: string; day: number } }) => {
      if (!date) return null;
      const m = marks.get(date.dateString);
      const frozen = freezes.has(date.dateString);
      const isToday = date.dateString === today;
      const planned = !!fastingWeekdays?.includes(isoWeekday(new Date(date.dateString + 'T00:00:00'))) && date.dateString >= today;
      const label = [
        format(new Date(date.dateString + 'T00:00:00'), 'EEEE, MMMM d'),
        m ? (m.goalMet ? t('history.cal.goalMet', { count: m.fasts }) : t('history.cal.fasted', { count: m.fasts })) : '',
        frozen ? t('history.cal.freeze') : '',
        planned ? t('history.cal.planned') : '',
      ].filter(Boolean).join('. ');
      const selected = selectedDay === date.dateString;
      const interactive = !!m && !!onSelectDay;
      const body = (
        <>
          <View style={{
            width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
            borderWidth: isToday || planned ? 1.5 : 0, borderColor: isToday ? colors.accent : colors.textSecondary,
            borderStyle: !isToday && planned ? 'dashed' : 'solid',
            backgroundColor: selected ? colors.accentSoft : 'transparent',
          }}>
            <Text style={[type.label, { color: colors.text, fontWeight: selected ? '700' : '400' }]}>{date.day}</Text>
          </View>
          <View style={{ height: 12, alignItems: 'center', justifyContent: 'center' }}>
            {frozen ? (
              <Ionicons name="snow" size={12} color={colors.accent} />
            ) : m ? (
              // 8 px marker with a 2 px surface gap around it.
              <View style={{ padding: 2, backgroundColor: colors.surface, borderRadius: radius.chip }}>
                <View style={{
                  width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.accent,
                  backgroundColor: m.goalMet ? colors.accent : 'transparent',
                }} />
              </View>
            ) : null}
          </View>
        </>
      );
      const cell = { width: 40, height: hit.min, alignItems: 'center' as const, justifyContent: 'center' as const };
      return interactive ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel={label} accessibilityHint={t('history.cal.filterHint')}
          accessibilityState={{ selected }} aria-pressed={selected}
          {...(isWeb ? ({ dataSet: { calday: '1' }, tabIndex: rovingByMonth.get(date.dateString.slice(0, 7)) === date.dateString ? 0 : -1 } as any) : null)}
          onPress={() => onSelectDay?.(selected ? null : date.dateString)} style={cell}
        >
          {body}
        </Pressable>
      ) : (
        <View accessible role="img" accessibilityLabel={label} style={cell}>{body}</View>
      );
    };
    return D;
  }, [marks, freezes, today, colors, selectedDay, onSelectDay, fastingWeekdays, isWeb, rovingByMonth]);

  // Custom header: the library's default header is a focusable role="slider" without a name on web.
  const Header = useMemo(() => {
    const H = ({ month, addMonth }: { month?: any; addMonth?: (n: number) => void }) => {
      if (!month) return null;
      const title = format(new Date(month.getFullYear(), month.getMonth(), 1), 'MMMM yyyy');
      const rtl = Platform.OS === 'web' ? typeof document !== 'undefined' && document.documentElement.dir === 'rtl' : I18nManager.isRTL;
      const arrow = (dir: -1 | 1) => (
        <Pressable
          accessibilityRole="button" accessibilityLabel={t(dir < 0 ? 'history.cal.prevMonth' : 'history.cal.nextMonth')}
          onPress={() => addMonth?.(dir)} hitSlop={4}
          style={{ width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' }}
        >
          <Ionicons name={(dir < 0) !== rtl ? 'chevron-back' : 'chevron-forward'} size={icon.md} color={colors.accent} />
        </Pressable>
      );
      return (
        <View>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.sm }}>
            {arrow(-1)}
            <Text accessibilityRole="header" aria-level={2} style={[type.body, { color: colors.text, fontWeight: '700' }]}>{title}</Text>
            {arrow(1)}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', paddingBottom: space.xs }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => (
              <Text key={i} style={[type.micro, { width: 40, textAlign: 'center', color: colors.textSecondary }]}>
                {format(new Date(2024, 0, 1 + i), 'EEEEEE')}
              </Text>
            ))}
          </View>
        </View>
      );
    };
    return H;
  }, [colors]);

  return (
    <View {...(isWeb ? ({ onKeyDown } as any) : null)}>
      <Calendar
        customHeader={Header as any}
        key={scheme}
        current={focusDate}
        firstDay={1}
        dayComponent={Day as any}
        enableSwipeMonths
        theme={{
          backgroundColor: colors.surface, calendarBackground: colors.surface,
          textSectionTitleColor: colors.textSecondary, monthTextColor: colors.text,
          arrowColor: colors.accent, textMonthFontWeight: '700', textMonthFontSize: type.body.fontSize,
          textDayHeaderFontSize: type.micro.fontSize,
        }}
        style={{ borderRadius: radius.card, paddingBottom: space.sm }}
      />
      <View accessible role="img" accessibilityLabel={fastingWeekdays?.length ? `${t('history.cal.legendA11y')} ${t('history.cal.legendPlanned')}` : t('history.cal.legendA11y')}
        style={{ flexDirection: 'row', gap: space.lg, paddingTop: space.sm, paddingHorizontal: space.xs, flexWrap: 'wrap' }}>
        <Legend icon={<View style={{ width: 8, height: 8, borderRadius: 4, borderWidth: 1.5, borderColor: colors.accent }} />} label={t('history.cal.legendFast')} />
        <Legend icon={<View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent }} />} label={t('history.cal.legendGoal')} />
        <Legend icon={<Ionicons name="snow" size={12} color={colors.accent} />} label={t('history.cal.legendFreeze')} />
        {fastingWeekdays?.length ? (
          <Legend icon={<View style={{ width: 10, height: 10, borderRadius: 5, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.textSecondary }} />} label={t('history.cal.legendPlanned')} />
        ) : null}
      </View>
    </View>
  );
}

function Legend({ icon, label }: { icon: React.ReactNode; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
      {icon}
      <Text style={[type.caption, { color: colors.textSecondary }]}>{label}</Text>
    </View>
  );
}
