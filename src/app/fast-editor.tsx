import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Body, Caption, Card, PrimaryButton, Screen, Separator, haptic } from '../components/ui';
import { ModalHeader } from '../components/timer/ModalHeader';
import { DateTimeField } from '../components/logs/DateTimeField';
import { MOOD_EMOJI } from '../components/history/moods';
import { hit, icon, layout, radius, space, type, useTheme } from '../theme';
import { t } from '../lib/i18n';
import { formatHM, HOUR, validateFastTimes } from '../lib/fastMath';
import { allProtocols, getProtocol } from '../lib/protocols';
import { useFastStore } from '../stores/fastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useIsPro } from '../stores/purchaseStore';
import { useProGate } from '../lib/proGate';
import type { Fast, ProtocolId } from '../types';

const floorMinute = (ms: number) => Math.floor(ms / 60000) * 60000;

export default function FastEditor() {
  const { colors } = useTheme();
  const router = useRouter();
  const gate = useProGate();
  const isPro = useIsPro();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const fasts = useFastStore((s) => s.fasts);
  const settings = useSettingsStore((s) => s.settings);
  const existing = useMemo(() => fasts.find((f) => f.id === id) ?? null, [fasts, id]);
  const isNew = !existing;
  const running = !!existing && existing.endAt === null;

  const [now] = useState(() => floorMinute(Date.now()));
  const [protocolId, setProtocolId] = useState<ProtocolId>(existing?.protocolId ?? settings.activeProtocolId);
  const [startAt, setStartAt] = useState<number>(() => {
    if (existing) return existing.startAt;
    return now - getProtocol(settings.activeProtocolId, settings).fastingMinutes * 60000;
  });
  const [endAt, setEndAt] = useState<number>(existing?.endAt ?? now);
  const [note, setNote] = useState(existing?.note ?? '');
  const [mood, setMood] = useState<Fast['mood']>(existing?.mood ?? null);

  const protocols = allProtocols(settings);
  const error = validateFastTimes(startAt, running ? null : endAt, fasts, existing?.id, Date.now());
  const durationMs = (running ? Date.now() : endAt) - startAt;
  const longFast = durationMs > 48 * HOUR;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const save = () => {
    if (error) return;
    const target = getProtocol(protocolId, settings).fastingMinutes;
    if (existing) {
      useFastStore.getState().updateFast(existing.id, {
        startAt, protocolId, note: note.trim(), mood,
        targetMinutes: protocolId !== existing.protocolId ? target : existing.targetMinutes,
        ...(running ? {} : { endAt }),
      });
    } else {
      useFastStore.getState().addFast({
        protocolId, startAt, endAt, targetMinutes: target, goalMet: null, mood, note: note.trim(), stagesReached: [],
      });
    }
    haptic('success');
    close();
  };

  const confirmDelete = () => {
    if (!existing) return;
    haptic('warning');
    Alert.alert(t('history.editor.deleteTitle'), t('history.editor.deleteBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'), style: 'destructive',
        onPress: () => { useFastStore.getState().deleteFast(existing.id); close(); },
      },
    ]);
  };

  const errorText = error ? t(error.key, error.params) : null;

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ModalHeader
          title={isNew ? t('history.editor.titleNew') : running ? t('history.editor.titleRunning') : t('history.editor.titleEdit')}
          onClose={close}
        />

        <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.sm, paddingBottom: space.xxl, gap: layout.sectionGap }} keyboardShouldPersistTaps="handled">
          <Card style={{ paddingVertical: space.xs }}>
            <DateTimeField label={t('history.editor.start')} value={startAt} onChange={setStartAt} maximumDate={new Date()} />
            {!running ? (
              <>
                <Separator />
                <DateTimeField label={t('history.editor.end')} value={endAt} onChange={setEndAt} maximumDate={new Date()} />
              </>
            ) : null}
            <Separator />
            <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Body secondary>{t('history.editor.duration')}</Body>
              <Text style={[type.bodyEmphasis, type.tabular, { color: colors.text }]}>{formatHM(Math.max(0, durationMs))}</Text>
            </View>
          </Card>

          {errorText ? (
            <View accessibilityRole="alert" accessibilityLiveRegion="polite"
              style={{ flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' }}>
              <Ionicons name="alert-circle" size={icon.md} color={colors.danger} />
              <Text style={[type.body, { flex: 1, color: colors.danger }]}>{errorText}</Text>
            </View>
          ) : null}

          {longFast && !error ? (
            <Card style={{ backgroundColor: colors.accentSoft, flexDirection: 'row', gap: space.md }}>
              <Ionicons name="information-circle" size={icon.md} color={colors.accent} />
              <Text style={[type.body, { flex: 1, color: colors.text }]}>{t('history.editor.safetyNote')}</Text>
            </Card>
          ) : null}

          <View style={{ gap: space.sm }}>
            <Caption>{t('history.editor.protocol')}</Caption>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}
              accessibilityRole="radiogroup">
              {protocols.map((p) => {
                const active = p.id === protocolId;
                return (
                  <Pressable key={p.id} accessibilityRole="radio" aria-checked={active}
                    accessibilityLabel={p.proOnly && !isPro ? `${p.name}, ${t('common.pro')}` : p.name}
                    onPress={() => (p.proOnly && !isPro && !active ? gate('protocol', () => setProtocolId(p.id)) : setProtocolId(p.id))}
                    style={{ minHeight: hit.min, paddingHorizontal: space.lg, justifyContent: 'center', borderRadius: radius.chip,
                      backgroundColor: active ? colors.accent : colors.surface, borderWidth: 1,
                      borderColor: active ? colors.accent : colors.controlBorder }}>
                    <Text style={[type.label, { color: active ? colors.onAccent : colors.text }]}>
                      {p.proOnly && !isPro && !active ? `${p.name} · ${t('common.pro')}` : p.name}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>

          <View style={{ gap: space.sm }}>
            <Caption>{t('history.editor.mood')}</Caption>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }} accessibilityRole="radiogroup">
              {MOOD_EMOJI.map((e, i) => {
                const v = (i + 1) as 1 | 2 | 3 | 4 | 5;
                const active = mood === v;
                return (
                  <Pressable key={v} accessibilityRole="radio" aria-checked={active}
                    accessibilityLabel={t(`history.editor.moods.${v}`)}
                    onPress={() => setMood(active ? null : v)}
                    style={{ width: hit.comfortable, height: hit.comfortable, borderRadius: hit.comfortable / 2, alignItems: 'center', justifyContent: 'center',
                      backgroundColor: active ? colors.accentSoft : colors.surface, borderWidth: active ? 2 : 1,
                      borderColor: active ? colors.accent : colors.controlBorder }}>
                    <Text style={{ fontSize: 26 }}>{e}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={{ gap: space.sm }}>
            <Caption>{t('history.editor.note')}</Caption>
            <TextInput
              value={note} onChangeText={setNote} multiline maxLength={500}
              placeholder={t('history.editor.notePlaceholder')} placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('history.editor.note')}
              style={[type.body, { minHeight: 88, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.card,
                borderWidth: 1, borderColor: colors.controlBorder, padding: space.md, textAlignVertical: 'top' }]}
            />
          </View>

          <PrimaryButton label={t('common.save')} onPress={save} disabled={!!error} />
          {existing ? (
            <PrimaryButton label={t('history.editor.delete')} variant="ghost" onPress={confirmDelete}
              style={{ minHeight: 56 }} />
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
