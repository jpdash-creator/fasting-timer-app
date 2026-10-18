import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '../../platform/icons';
import { useLocalSearchParams, useRouter } from '../../router';
import { format } from 'date-fns';
import { Caption, PrimaryButton, Screen, Separator, Title } from '../../components/ui';
import { FastRow } from '../../components/history/FastRow';
import { HistoryCalendar } from '../../components/history/HistoryCalendar';
import { FilterBar } from '../../components/history/FilterBar';
import { LockedHistory } from '../../components/history/LockedHistory';
import { UndoToast, type ToastState } from '../../components/logs/UndoToast';
import { hit, icon, layout, radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { computeStreaks, HOUR } from '../../lib/fastMath';
import { allProtocols, getProtocol } from '../../lib/protocols';
import { calendarMarks, completed, filterFasts, groupByWeek } from '../../lib/stats';
import { useProGate } from '../../lib/proGate';
import { useFastStore } from '../../stores/fastStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { useIsPro } from '../../stores/purchaseStore';
import type { Fast } from '../../types';

type Item =
  | { kind: 'week'; key: string; weekStart: number; hours: number; count: number }
  | { kind: 'fast'; key: string; fast: Fast; locked?: boolean }
  | { kind: 'locked'; key: string; count: number }
  | { kind: 'noMatch'; key: string };

const FREE_DAYS = 7;

export default function HistoryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const gate = useProGate();
  const isPro = useIsPro();
  const fasts = useFastStore((s) => s.fasts);
  const customProtocols = useSettingsStore((s) => s.settings.customProtocols);
  const activeProtocolId = useSettingsStore((s) => s.settings.activeProtocolId);
  const fastingWeekdays = useMemo(
    () => getProtocol(activeProtocolId, { customProtocols }).weeklyPattern?.fastingDays,
    [activeProtocolId, customProtocols],
  );
  // Deep link fastline://history?date=YYYY-MM-DD selects that calendar day (spec 6).
  const { date: dateParam } = useLocalSearchParams<{ date?: string | string[] }>();
  const [query, setQuery] = useState('');
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const [day, setDay] = useState<string | null>(null);
  const [focusDate, setFocusDate] = useState<string | undefined>(undefined);
  useEffect(() => {
    const raw = Array.isArray(dateParam) ? dateParam[0] : dateParam;
    if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return;
    const d = new Date(raw + 'T00:00:00');
    if (isNaN(d.getTime()) || format(d, 'yyyy-MM-dd') !== raw) return;
    setDay(raw);
    setFocusDate(raw);
  }, [dateParam]);
  const [toast, setToast] = useState<ToastState | null>(null);

  const done = useMemo(() => completed(fasts), [fasts]);
  const freeCutoff = Date.now() - FREE_DAYS * 24 * HOUR;
  const visibleAll = useMemo(
    () => (isPro ? done : done.filter((f) => f.endAt >= freeCutoff)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [done, isPro],
  );
  const hiddenCount = done.length - visibleAll.length;

  const marks = useMemo(() => calendarMarks(visibleAll), [visibleAll]);
  const freezes = useMemo(
    () => new Set(isPro ? computeStreaks(fasts, true).freezesUsed : []),
    [fasts, isPro],
  );

  const protocols = useMemo(() => {
    const used = new Set(done.map((f) => f.protocolId));
    return allProtocols({ customProtocols }).filter((p) => used.has(p.id)).map((p) => ({ id: p.id, name: p.name }));
  }, [done, customProtocols]);

  const items = useMemo<Item[]>(() => {
    const base = filterFasts(visibleAll, protocolId, query);
    const filtered = day ? base.filter((f) => f.endAt !== null && format(f.endAt, 'yyyy-MM-dd') === day) : base;
    const out: Item[] = [];
    for (const g of groupByWeek(filtered)) {
      out.push({ kind: 'week', key: `w${g.weekStart}`, weekStart: g.weekStart, hours: g.totalHours, count: g.fasts.length });
      for (const f of g.fasts) out.push({ kind: 'fast', key: f.id, fast: f });
    }
    if (!filtered.length && done.length) out.push({ kind: 'noMatch', key: 'nomatch' });
    if (hiddenCount > 0) out.push({ kind: 'locked', key: 'locked', count: hiddenCount });
    return out;
  }, [visibleAll, protocolId, query, day, hiddenCount, done.length]);

  const dismissToast = useCallback(() => setToast(null), []);

  const onDelete = useCallback((id: string) => {
    const removed = useFastStore.getState().deleteFast(id);
    if (!removed) return;
    setToast({
      id: Date.now(), message: t('history.deleted'),
      onUndo: () => useFastStore.getState().restoreFast(removed),
    });
  }, []);

  const unlock = () => gate('history', () => {});
  const addPast = () => router.push('/fast-editor');

  const header = (
    <View style={{ gap: space.md, paddingBottom: space.md }}>
      <Title>{t('history.title')}</Title>
      {done.length > 0 ? (
        <>
          <HistoryCalendar marks={marks} freezes={freezes} selectedDay={day} onSelectDay={setDay} focusDate={focusDate} fastingWeekdays={fastingWeekdays} />
          {day ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${t('history.filter.day', { date: format(new Date(day + 'T00:00:00'), 'MMM d') })}, ${t('history.filter.clearDay')}`}
              onPress={() => setDay(null)}
              style={{ minHeight: hit.min, flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: space.sm,
                paddingHorizontal: space.lg, borderRadius: radius.chip, backgroundColor: colors.accentSoft }}
            >
              <Text style={[type.label, { color: colors.accent }]}>
                {t('history.filter.day', { date: format(new Date(day + 'T00:00:00'), 'MMM d') })}
              </Text>
              <Ionicons name="close" size={icon.sm} color={colors.accent} />
            </Pressable>
          ) : null}
          <FilterBar query={query} onQuery={setQuery} protocols={protocols} selected={protocolId} onSelect={setProtocolId} />
        </>
      ) : null}
    </View>
  );

  const renderItem = ({ item }: { item: Item }) => {
    switch (item.kind) {
      case 'week':
        return (
          <View style={{ paddingTop: space.lg, paddingBottom: space.sm, paddingHorizontal: space.xs }}>
            <Text accessibilityRole="header" style={[type.caption, { color: colors.textSecondary, fontWeight: '700', textTransform: 'uppercase' }]}>
              {t('history.week', { date: format(item.weekStart, 'MMM d'), hours: Math.round(item.hours), count: item.count })}
            </Text>
          </View>
        );
      case 'fast':
        return (
          <View style={{ backgroundColor: colors.surface }}>
            <FastRow
              fast={item.fast}
              onPress={() => router.push({ pathname: '/fast-editor', params: { id: item.fast.id } })}
              onDelete={() => onDelete(item.fast.id)}
            />
            <Separator />
          </View>
        );
      case 'locked':
        return <LockedHistory hiddenCount={item.count} onUnlock={unlock} />;
      case 'noMatch':
        return (
          <View style={{ padding: space.xl, alignItems: 'center' }}>
            <Caption>{t('history.noMatch')}</Caption>
          </View>
        );
    }
  };

  if (done.length === 0) {
    return (
      <Screen>
        <View style={{ flex: 1, paddingHorizontal: layout.screenX, paddingTop: space.lg, paddingBottom: space.lg }}>
          <Title>{t('history.title')}</Title>
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, paddingHorizontal: space.xl }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="calendar-outline" size={icon.hero} color={colors.accent} />
            </View>
            <Text accessibilityRole="header" style={[type.subtitle, { color: colors.text, textAlign: 'center' }]}>{t('history.empty.title')}</Text>
            <Text style={[type.body, { color: colors.textSecondary, textAlign: 'center' }]}>{t('history.empty.body')}</Text>
            <PrimaryButton label={t('history.empty.cta')} onPress={() => router.replace('/')} style={{ marginTop: space.md, alignSelf: 'stretch' }} />
            <PrimaryButton variant="ghost" label={t('history.add')} onPress={addPast} />
          </View>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={{ flex: 1 }}>
        <FlashList
          data={items}
          renderItem={renderItem}
          keyExtractor={(i) => i.key}
          getItemType={(i) => i.kind}
          ListHeaderComponent={header}
          contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.lg, paddingBottom: layout.scrollBottom }}
          keyboardShouldPersistTaps="handled"
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('history.add')}
          onPress={addPast}
          style={({ pressed }) => ({
            position: 'absolute', right: layout.screenX, bottom: space.lg, height: hit.comfortable, minWidth: hit.comfortable,
            paddingHorizontal: space.xl, borderRadius: radius.button, backgroundColor: colors.accent,
            flexDirection: 'row', alignItems: 'center', gap: space.sm, opacity: pressed ? 0.85 : 1,
            shadowColor: colors.text, shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4,
          })}
        >
          <Ionicons name="add" size={icon.md} color={colors.onAccent} />
          <Text style={[type.bodyEmphasis, { color: colors.onAccent }]}>{t('history.addShort')}</Text>
        </Pressable>
        <UndoToast toast={toast} onDismiss={dismissToast} bottom={hit.comfortable + space.lg * 2} />
      </View>
    </Screen>
  );
}
