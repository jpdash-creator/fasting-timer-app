import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { useFocusEffect, useRouter } from '../../router';
import { Body, Caption, Card, PrimaryButton, Row, Screen, Separator, Title, Toast, haptic } from '../../components/ui';
import { ProgressRing } from '../../components/timer/ProgressRing';
import { Confetti } from '../../components/timer/Confetti';
import { MoodPicker } from '../../components/timer/ModalHeader';
import { StartSheet } from '../../components/timer/StartSheet';
import { EndSheet } from '../../components/timer/EndSheet';
import { SafetySheet } from '../../components/timer/SafetySheet';
import { hit, icon, layout, radius, space, type, useTheme } from '../../theme';
import { i18n, t } from '../../lib/i18n';
import { MIN, eatingWindowEnd, formatDuration, formatHM, timerState } from '../../lib/fastMath';
import { getProtocol, isPlannedFastingDay, nextPlannedFastingDay } from '../../lib/protocols';
import { stageAt, stageLabel } from '../../lib/stages';
import { clockLabel, spokenDuration } from '../../lib/timerFormat';
import { useNow, useReduceMotion } from '../../lib/timerHooks';
import { lastEndedFast, maybeAutoStartNextFast } from '../../lib/timerAutoStart';
import { getSeenLevel, levelFor, markSeenLevel, type SafetyLevel } from '../../lib/timerSafety';
import { rescheduleNotifications } from '../../lib/timerNotify';
import { selectActiveFast, useFastStore } from '../../stores/fastStore';
import { useLogStore } from '../../stores/logStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { BillingIssueBanner, NotificationPermissionBanner, VerifyLapsedBanner } from '../../components/banners';

const ML_PER_OZ = 29.5735;

/** HH:MM at ring size plus :SS in smaller secondary digits (the per-second churn stays in the small digits). */
function RingClock({ ms }: { ms: number }) {
  const { colors } = useTheme();
  const [hh, mm, ss] = formatDuration(ms).split(':');
  return (
    <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'center', direction: 'ltr' }}>
      <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={[type.ring, { color: colors.text, flexShrink: 1 }]}>
        {`${hh}:${mm}`}
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={[type.tabular, { fontSize: 28, fontWeight: '500', color: colors.textSecondary }]}>
        {`:${ss}`}
      </Text>
    </View>
  );
}

export default function TimerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const now = useNow(true);

  const settings = useSettingsStore((s) => s.settings);
  const fasts = useFastStore((s) => s.fasts);
  const active = useFastStore(selectActiveFast);
  const water = useLogStore((s) => s.water);

  const [startOpen, setStartOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [safety, setSafety] = useState<SafetyLevel | null>(null);
  const [confetti, setConfetti] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [replayKey, setReplayKey] = useState(0);
  const prevOver = useRef<boolean | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const confettiTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Ring eases 0 -> target over 600 ms each time the tab gains focus (live ticks stay linear).
  useFocusEffect(useCallback(() => { setReplayKey((k) => k + 1); }, []));
  // Clear pending timeouts on unmount.
  useEffect(() => () => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    if (confettiTimer.current) clearTimeout(confettiTimer.current);
  }, []);

  // BR-08: auto-start on focus and whenever the eating window closes while we are looking.
  useFocusEffect(useCallback(() => { maybeAutoStartNextFast(); }, []));
  useEffect(() => { if (!active) maybeAutoStartNextFast(now); }, [now, active]);

  const protocol = getProtocol(active?.protocolId ?? settings.activeProtocolId, settings);
  const ts = active ? timerState(active, now) : null;
  const over = !!active && !!ts && ts.elapsedMs >= ts.targetMs;
  const last = useMemo(() => lastEndedFast(fasts), [fasts]);
  const lastProto = last ? getProtocol(last.protocolId, settings) : null;
  const windowEnd = last?.endAt && lastProto && lastProto.eatingMinutes > 0
    ? eatingWindowEnd(last.endAt, lastProto.eatingMinutes) : null;
  const eating = !active && last?.endAt != null && lastProto !== null && windowEnd !== null && now < windowEnd;

  // Goal-reached confetti (only on the moment of crossing, or within 3 s of opening).
  useEffect(() => {
    if (!active || !ts) { prevOver.current = null; return; }
    const crossed = over && (prevOver.current === false || (prevOver.current === null && ts.overMs < 3000));
    prevOver.current = over;
    if (crossed) {
      haptic('success');
      if (!reduceMotion) {
        setConfetti((c) => c + 1);
        if (confettiTimer.current) clearTimeout(confettiTimer.current);
        confettiTimer.current = setTimeout(() => setConfetti(0), 1600);
      }
    }
  }, [active, over, ts, reduceMotion]);

  // BR-07: long-fast safety sheets, once per level per fast.
  const level = active && ts ? levelFor(ts.elapsedMs) : 0;
  const activeId = active?.id;
  useEffect(() => {
    if (!activeId || level === 0) return;
    let alive = true;
    getSeenLevel(activeId).then((seen) => { if (alive && seen < level) setSafety(level as SafetyLevel); });
    return () => { alive = false; };
  }, [activeId, level]);

  const ackSafety = () => {
    if (activeId && safety) markSeenLevel(activeId, safety);
    setSafety(null);
  };

  const flash = (msg: string) => {
    setToast(msg);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 3000);
  };

  // Spec 16.11: 5:2 tells you whether today is a planned fasting day.
  const weekdayName = (d: Date) => {
    try { return d.toLocaleDateString(i18n.locale || 'en', { weekday: 'long' }); } catch { return d.toLocaleDateString(); }
  };
  const nowDate = new Date(now);
  let idleHint = t('timer.readyHint', { hours: Math.round(protocol.fastingMinutes / 60) });
  if (protocol.weeklyPattern) {
    if (isPlannedFastingDay(protocol, nowDate)) {
      idleHint = t('timer.fiveTwo.fastDay', { hours: Math.round(protocol.fastingMinutes / 60) });
    } else {
      const next = nextPlannedFastingDay(protocol, nowDate);
      idleHint = next ? t('timer.fiveTwo.eatDay', { day: weekdayName(next) }) : idleHint;
    }
  }

  const ringSize = Math.min(width - layout.screenX * 2, 300);
  const goalAt = active ? active.startAt + active.targetMinutes * MIN : 0;
  const stage = ts ? stageAt(ts.elapsedMs) : null;

  const startEarly = () => {
    if (useFastStore.getState().activeFastId) return;
    useFastStore.getState().startFast(getProtocol(settings.activeProtocolId, settings));
    haptic('success');
    rescheduleNotifications();
  };

  // ---- ring content & accessibility label ----
  let ringProgress = 0;
  let ringColor = colors.fastingRing;
  let a11y = t('timer.ring.idle', { target: spokenDuration(protocol.fastingMinutes * MIN) });
  let centre: React.ReactNode;
  if (active && ts) {
    ringProgress = ts.percent;
    ringColor = over ? colors.success : colors.fastingRing;
    a11y = over
      ? t('timer.ring.over', { elapsed: spokenDuration(ts.elapsedMs), over: spokenDuration(ts.overMs) })
      : t('timer.ring.fasting', { elapsed: spokenDuration(ts.elapsedMs), remaining: spokenDuration(ts.remainingMs) });
    centre = (
      <>
        <RingClock ms={ts.elapsedMs} />
        <Caption>{t('timer.elapsed')}</Caption>
        {over ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs }}>
            <Ionicons name="checkmark-circle" size={icon.md} color={colors.success} />
            <Text style={[type.bodyEmphasis, type.tabular, { color: colors.success }]}>
              {t('timer.overGoal', { time: formatDuration(ts.overMs, false) })}
            </Text>
          </View>
        ) : (
          <Text style={[type.body, type.tabular, { color: colors.textSecondary, marginTop: space.xs }]}>
            {t('timer.remaining', { time: formatHM(ts.remainingMs) })}
          </Text>
        )}
      </>
    );
  } else if (eating && last?.endAt != null && lastProto && windowEnd !== null) {
    const total = lastProto.eatingMinutes * MIN;
    const remaining = Math.max(0, windowEnd - now);
    ringProgress = Math.min(1, Math.max(0, (now - last.endAt) / total));
    ringColor = colors.eatingRing;
    a11y = t('timer.ring.eating', { remaining: spokenDuration(remaining) });
    centre = (
      <>
        <Caption>{t('timer.eatingWindow')}</Caption>
        <RingClock ms={remaining} />
        <Caption>{t('timer.eatingLeft')}</Caption>
      </>
    );
  } else {
    centre = (
      <>
        <Text numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2} style={[type.ring, { color: colors.text }]}>
          {t('timer.ringGoalShort', { h: Math.round(protocol.fastingMinutes / 60) })}
        </Text>
        <Caption>{t('timer.ringReady')}</Caption>
        {protocol.eatingMinutes > 0 ? (
          <Caption>{t('timer.ringThenEating', { h: Math.round(protocol.eatingMinutes / 60) })}</Caption>
        ) : null}
      </>
    );
  }

  // ---- water ----
  const oz = settings.units.volume === 'oz';
  const addMl = oz ? Math.round(8 * ML_PER_OZ) : 250;
  const addLabel = oz ? '8 oz' : '250 ml';
  const todayMl = water
    .filter((w) => new Date(w.at).toDateString() === new Date(now).toDateString())
    .reduce((a, w) => a + w.ml, 0);
  const fmtVol = (ml: number) => (oz ? `${Math.round(ml / ML_PER_OZ)} oz` : `${ml} ml`);

  return (
    <Screen>
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.lg, gap: layout.sectionGap, paddingBottom: layout.scrollBottom }}>
        {/* Header */}
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flexShrink: 1 }}><Title>{t('tabs.timer')}</Title></View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('timer.protocolChip', { name: protocol.name })}
            accessibilityHint={t('timer.changeProtocol')}
            onPress={() => { haptic('light'); router.push('/protocol-picker'); }}
            style={({ pressed }) => ({
              minHeight: hit.min, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg,
              borderRadius: radius.chip, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.controlBorder,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <View style={{ width: 10, height: 10, borderRadius: radius.chip, backgroundColor: protocol.color }} />
            <Text maxFontSizeMultiplier={1.3} numberOfLines={1} style={[type.bodyEmphasis, { color: colors.text, flexShrink: 1 }]}>{protocol.name}</Text>
            <Ionicons name="chevron-down" size={icon.sm} color={colors.textSecondary} />
          </Pressable>
        </View>

        <BillingIssueBanner />

        {ts?.clockSkew ? (
          <View
            accessibilityRole="alert" accessibilityLiveRegion="polite"
            style={{ flexDirection: 'row', gap: space.md, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.accentSoft, alignItems: 'center' }}
          >
            <Ionicons name="time-outline" size={icon.md} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Body style={type.bodyEmphasis}>{t('timer.skewToast')}</Body>
              <Caption>{t('timer.skewDetail')}</Caption>
            </View>
          </View>
        ) : null}

        <NotificationPermissionBanner />
        <VerifyLapsedBanner />

        {/* Ring */}
        <View style={{ alignItems: 'center', gap: space.lg }}>
          <View>
            <ProgressRing
              size={ringSize} progress={ringProgress} color={ringColor} track={colors.track}
              fill={over ? colors.accentSoft : colors.surface} overtime={over} overtimeColor={colors.success}
              replayKey={replayKey} reduceMotion={reduceMotion} accessibilityLabel={a11y}
            >
              {centre}
            </ProgressRing>
            {confetti > 0 ? <Confetti key={confetti} /> : null}
          </View>

          {active && stage ? (
            <Pressable
              accessibilityRole="button" accessibilityLabel={t('timer.stageChip', { stage: stageLabel(stage.id) })}
              onPress={() => { haptic('light'); router.push('/stage-info'); }}
              style={({ pressed }) => ({
                minHeight: hit.min, flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg,
                borderRadius: radius.chip, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1,
              })}
            >
              <Ionicons name="pulse-outline" size={icon.sm} color={colors.accent} />
              <Text style={[type.bodyEmphasis, { color: colors.accent }]}>{stageLabel(stage.id)}</Text>
              <Ionicons name="information-circle-outline" size={icon.sm} color={colors.accent} />
            </Pressable>
          ) : null}

          {eating && windowEnd !== null ? (
            <View style={{ alignItems: 'center', gap: space.xs }}>
              <Body style={type.bodyEmphasis}>{t('timer.nextFastAt', { time: clockLabel(windowEnd) })}</Body>
              {settings.autoStartNextFast ? <Caption>{t('timer.autoStartNote')}</Caption> : null}
            </View>
          ) : null}
          {!active && !eating ? (
            <Body secondary style={{ textAlign: 'center' }}>
              {idleHint}
            </Body>
          ) : null}
        </View>

        {/* The one primary action */}
        {active ? (
          <PrimaryButton label={t('timer.endFast')} onPress={() => setEndOpen(true)} />
        ) : eating ? (
          <PrimaryButton label={t('timer.startEarly')} onPress={startEarly} />
        ) : (
          <PrimaryButton label={t('timer.start')} onPress={() => setStartOpen(true)} />
        )}

        {/* Fast details */}
        {active ? (
          <>
            <Card style={{ padding: 0 }}>
              <Row
                label={t('timer.editStart')} value={clockLabel(active.startAt)}
                onPress={() => router.push({ pathname: '/fast-editor', params: { id: active.id } })}
                left={<Ionicons name="create-outline" size={icon.md} color={colors.textSecondary} />}
                right={<Ionicons name="chevron-forward" size={icon.sm} color={colors.textSecondary} />}
              />
              <Separator />
              <Row
                label={t(over ? 'timer.goalReachedTitle' : 'timer.goalRow')} value={clockLabel(goalAt)}
                left={<Ionicons name={over ? 'checkmark-circle' : 'flag-outline'} size={icon.md} color={over ? colors.success : colors.textSecondary} />}
              />
              {protocol.eatingMinutes > 0 ? (
                <>
                  <Separator />
                  <Row
                    label={t('timer.eatingOpensAt', { time: clockLabel(goalAt) })}
                    left={<Ionicons name="restaurant-outline" size={icon.md} color={colors.textSecondary} />}
                  />
                </>
              ) : null}
            </Card>
            {over ? <Body secondary>{t('timer.goalReachedBody')}</Body> : null}
          </>
        ) : null}

        {/* Quick adds */}
        <Card style={{ gap: space.lg }}>
          <View style={{ gap: space.sm }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' }}>
              <Body style={type.bodyEmphasis}>{t('timer.quick.water')}</Body>
              <Caption>{`${fmtVol(todayMl)} / ${fmtVol(settings.waterGoalMl)}`}</Caption>
            </View>
            <View style={{ flexDirection: 'row', gap: space.sm }}>
              <Pressable
                accessibilityRole="button" accessibilityLabel={t('timer.quick.addWater', { amount: addLabel })}
                onPress={() => { useLogStore.getState().addWater(addMl); haptic('light'); flash(t('timer.quick.waterAdded')); }}
                style={({ pressed }) => ({
                  flex: 1, minHeight: hit.min, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center',
                  flexDirection: 'row', gap: space.sm, backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1,
                })}
              >
                <Ionicons name="water-outline" size={icon.md} color={colors.accent} />
                <Text maxFontSizeMultiplier={1.3} style={[type.bodyEmphasis, { color: colors.accent }]}>+{addLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button" accessibilityLabel={`${t('timer.quick.moreWater')}, ${t('timer.quick.moreWaterLabel')}`}
                onPress={() => { haptic('light'); router.push('/log-water'); }}
                style={({ pressed }) => ({
                  minHeight: hit.min, minWidth: hit.min * 2, paddingHorizontal: space.lg, borderRadius: radius.button, alignItems: 'center',
                  justifyContent: 'center', borderWidth: 1, borderColor: colors.controlBorder, opacity: pressed ? 0.8 : 1,
                })}
              >
                <Text maxFontSizeMultiplier={1.3} style={[type.bodyEmphasis, { color: colors.text }]}>{t('timer.quick.moreWater')}</Text>
              </Pressable>
            </View>
          </View>

          {active ? (
            <View style={{ gap: space.sm }}>
              <Body style={type.bodyEmphasis}>{t('timer.quick.mood')}</Body>
              <MoodPicker
                value={active.mood ?? null}
                onChange={(m) => useFastStore.getState().updateFast(active.id, { mood: m })}
              />
            </View>
          ) : null}
        </Card>
      </ScrollView>

      {toast ? <Toast message={toast} /> : null}

      <StartSheet visible={startOpen} onClose={() => setStartOpen(false)} onStarted={() => {}} />
      <EndSheet
        visible={endOpen} fast={active} now={now} onClose={() => setEndOpen(false)}
        onEnded={(f) => router.push({ pathname: '/fast-summary', params: { id: f.id } })}
      />
      <SafetySheet
        level={safety} onAcknowledge={ackSafety}
        onEndFast={() => { ackSafety(); setEndOpen(true); }}
      />
    </Screen>
  );
}
