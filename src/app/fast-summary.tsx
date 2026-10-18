import React, { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '../platform/icons';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from '../router';
import { usePostFastPaywall } from '../lib/paywallTriggers';
import { Body, Caption, Card, PrimaryButton, Screen, haptic } from '../components/ui';
import { ModalHeader, MoodPicker, type Mood } from '../components/timer/ModalHeader';
import { ProgressRing } from '../components/timer/ProgressRing';
import { Confetti } from '../components/timer/Confetti';
import { hit, icon, layout, radius, space, type, useTheme } from '../theme';
import { t } from '../lib/i18n';
import { MIN, computeStreaks, formatHM } from '../lib/fastMath';
import { getProtocol } from '../lib/protocols';
import { stageLabel } from '../lib/stages';
import { useReduceMotion } from '../lib/timerHooks';
import { rescheduleNotifications } from '../lib/timerNotify';
import { useFastStore } from '../stores/fastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useIsPro } from '../stores/purchaseStore';
import type { StageDef } from '../types';

export default function FastSummaryScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const reduceMotion = useReduceMotion();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fasts = useFastStore((s) => s.fasts);
  const fast = fasts.find((f) => f.id === id) ?? null;
  const settings = useSettingsStore((s) => s.settings);
  const isPro = useIsPro();
  const [mood, setMood] = useState<Mood | null>(fast?.mood ?? null);
  const [note, setNote] = useState(fast?.note ?? '');
  const streak = useMemo(() => computeStreaks(fasts, isPro).current, [fasts, isPro]);
  // All hooks live above the early return (the fast can vanish and reappear between renders).
  const maybePaywall = usePostFastPaywall();

  // Fast-end settle: the hero fades up from 0.9 scale in 300 ms (skipped under reduce motion).
  const settle = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    settle.value = reduceMotion ? 1 : withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
  }, [reduceMotion, settle]);
  const settleStyle = useAnimatedStyle(() => ({
    opacity: settle.value,
    transform: [{ scale: 0.9 + 0.1 * settle.value }],
  }));

  if (!fast || fast.endAt === null) {
    return (
      <Screen>
        <ModalHeader title={t('timer.summary.title')} />
        <View style={{ padding: layout.screenX }}><Body secondary>{t('timer.summary.notFound')}</Body></View>
      </Screen>
    );
  }

  const protocol = getProtocol(fast.protocolId, settings);
  const met = fast.goalMet === true;
  const heldMs = fast.endAt - fast.startAt;
  const ringProgress = fast.targetMinutes > 0 ? Math.min(1, heldMs / (fast.targetMinutes * MIN)) : 1;
  const stagesBeyondFed = fast.stagesReached.filter((sid) => sid !== 'fed');

  const persist = () => {
    useFastStore.getState().updateFast(fast.id, { mood, note: note.trim() });
    rescheduleNotifications();
  };

  return (
    <Screen>
      <ModalHeader title={t('timer.summary.title')} onClose={() => { persist(); router.back(); }} />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.sm, paddingBottom: space.xxl, gap: layout.sectionGap }}>
          <View style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
            <Caption>{t('timer.summary.protocolLine', { name: protocol.name })}</Caption>
            <Animated.View style={settleStyle}>
              <ProgressRing
                size={220} progress={ringProgress} track={colors.track}
                color={met ? colors.success : colors.fastingRing}
                fill={met ? colors.accentSoft : colors.surface} overtime={met} overtimeColor={colors.success}
                reduceMotion={reduceMotion}
                accessibilityLabel={`${t('timer.summary.duration')}, ${formatHM(heldMs)}`}
              >
                <Text
                  numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}
                  style={[type.stat, { color: colors.text }]}
                >
                  {formatHM(heldMs)}
                </Text>
              </ProgressRing>
            </Animated.View>
            <View
              accessible role="group"
              style={{
                flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, minHeight: hit.min,
                borderRadius: radius.chip, backgroundColor: met ? colors.accentSoft : colors.surface,
                borderWidth: met ? 0 : 1, borderColor: colors.border,
              }}
            >
              <Ionicons name={met ? 'checkmark-circle' : 'leaf-outline'} size={icon.md} color={met ? colors.success : colors.textSecondary} />
              <Text style={[type.bodyEmphasis, { color: met ? colors.accent : colors.text }]}>
                {met ? t('timer.summary.goalMet') : t('timer.summary.goalNotMet')}
              </Text>
            </View>
            <Body secondary style={{ textAlign: 'center' }}>
              {met ? t('timer.summary.goalMetBody') : t('timer.summary.goalNotMetBody')}
            </Body>
            {streak > 0 && met ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Ionicons name="flame-outline" size={icon.sm} color={colors.eatingText} />
                <Caption>{t('timer.summary.streak', { n: streak })}</Caption>
              </View>
            ) : null}
            {met && !reduceMotion ? <Confetti count={18} /> : null}
          </View>

          {stagesBeyondFed.length > 0 ? (
            <Card style={{ gap: space.sm }}>
              <Body style={type.bodyEmphasis}>{t('timer.summary.stagesReached')}</Body>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
                {fast.stagesReached.map((sid) => (
                  <View
                    key={sid}
                    style={{ minHeight: 36, justifyContent: 'center', paddingHorizontal: space.md, borderRadius: radius.chip, backgroundColor: colors.accentSoft }}
                  >
                    <Text maxFontSizeMultiplier={1.3} style={[type.label, { color: colors.accent }]}>{stageLabel(sid as StageDef['id'])}</Text>
                  </View>
                ))}
              </View>
            </Card>
          ) : null}

          <View style={{ gap: space.sm }}>
            <Body style={type.bodyEmphasis}>{t('timer.summary.mood')}</Body>
            <MoodPicker value={mood} onChange={setMood} size={56} filled />
          </View>

          <View style={{ gap: space.sm }}>
            <Body style={type.bodyEmphasis}>{t('timer.summary.note')}</Body>
            <TextInput
              value={note} onChangeText={setNote} multiline maxLength={500}
              placeholder={t('timer.summary.notePlaceholder')} placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('timer.summary.note')}
              style={{
                minHeight: 96, padding: space.lg, borderRadius: radius.card, textAlignVertical: 'top',
                backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.controlBorder,
                color: colors.text, ...type.body,
              }}
            />
          </View>

          <PrimaryButton label={t('timer.summary.save')} onPress={() => { persist(); haptic('success'); router.back(); setTimeout(() => maybePaywall(), 350); }} />
          <PrimaryButton
            label={t('timer.summary.share')} variant="secondary"
            onPress={() => { persist(); router.push({ pathname: '/share-card', params: { fastId: fast.id } }); }}
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
