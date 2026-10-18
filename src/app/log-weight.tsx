import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { Caption, Card, PrimaryButton, Screen, Separator, haptic } from '../components/ui';
import { ModalHeader } from '../components/timer/ModalHeader';
import { DateTimeField } from '../components/logs/DateTimeField';
import { UndoToast, type ToastState } from '../components/logs/UndoToast';
import { hit, icon, layout, radius, space, type, useTheme } from '../theme';
import { t } from '../lib/i18n';
import { fmtWeight, kgToDisplay, parseWeightInput } from '../lib/statsWeight';
import { useLogStore } from '../stores/logStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useIsPro } from '../stores/purchaseStore';
import { useProGate } from '../lib/proGate';
import type { WeightEntry } from '../types';

const FREE_ENTRIES = 7;

export default function LogWeight() {
  const { colors } = useTheme();
  const router = useRouter();
  const isPro = useIsPro();
  const gate = useProGate();
  const { step } = useLocalSearchParams<{ step?: string }>();
  const weights = useLogStore((s) => s.weights);
  const unit = useSettingsStore((s) => s.settings.units.weight);
  const latest = weights[weights.length - 1] ?? null;

  const [text, setText] = useState(() => {
    if (!latest) return '';
    const base = Number(kgToDisplay(latest.kg, unit).toFixed(1));
    const s = Number(step);
    return (isFinite(s) && s !== 0 ? Math.round((base + s * 0.1) * 10) / 10 : base).toFixed(1);
  });
  const [at, setAt] = useState(Date.now());
  const [note, setNote] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  const kg = parseWeightInput(text, unit);
  const invalid = text.length > 0 && kg === null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const save = () => {
    if (kg === null) return;
    useLogStore.getState().addWeight(kg, Math.min(at, Date.now()), note.trim() || undefined);
    haptic('success');
    close();
  };

  const recent = useMemo(() => {
    const desc = [...weights].sort((a, b) => b.at - a.at);
    return isPro ? desc.slice(0, 30) : desc.slice(0, FREE_ENTRIES);
  }, [weights, isPro]);

  const remove = (e: WeightEntry) => {
    useLogStore.getState().deleteWeight(e.id);
    setToast({ id: Date.now(), message: t('logs.weight.deleted'), onUndo: () => useLogStore.getState().addWeight(e.kg, e.at, e.note) });
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ModalHeader title={t('logs.weight.title')} onClose={close} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.sm, gap: layout.sectionGap, paddingBottom: layout.scrollBottom }} keyboardShouldPersistTaps="handled">
          <Card style={{ alignItems: 'center', gap: space.xs, paddingVertical: space.xl }}>
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
              <TextInput
                value={text} onChangeText={setText} keyboardType="decimal-pad" autoFocus selectTextOnFocus
                accessibilityLabel={t('logs.weight.inputLabel', { unit })} maxLength={6} placeholder="0.0"
                placeholderTextColor={colors.textSecondary}
                style={[type.tabular, { fontSize: 48, fontWeight: '700', width: 140, minHeight: 64, textAlign: 'center',
                  color: invalid ? colors.danger : colors.text },
                  Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]}
              />
              <Text style={[type.body, { color: colors.textSecondary }]}>{unit}</Text>
            </View>
            {invalid ? (
              <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('logs.weight.invalid', { unit })}</Text>
            ) : (
              <Caption>{t('logs.weight.hint')}</Caption>
            )}
          </Card>

          <Card style={{ paddingVertical: space.xs }}>
            <DateTimeField label={t('logs.when')} value={at} onChange={setAt} maximumDate={new Date()} />
          </Card>

          <View style={{ gap: space.sm }}>
            <Caption>{t('logs.weight.note')}</Caption>
            <TextInput
              value={note} onChangeText={setNote} maxLength={200}
              placeholder={t('logs.weight.notePlaceholder')} placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('logs.weight.note')}
              style={[type.body, { minHeight: hit.comfortable, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.card,
                borderWidth: 1, borderColor: colors.controlBorder, paddingHorizontal: space.md }]}
            />
          </View>

          <PrimaryButton label={t('common.save')} onPress={save} disabled={kg === null} />

          {recent.length ? (
            <View style={{ gap: space.sm }}>
              <Text accessibilityRole="header" style={[type.bodyEmphasis, { color: colors.text }]}>{t('logs.weight.recent')}</Text>
              <Card style={{ paddingVertical: space.xs, paddingHorizontal: 0 }}>
                {recent.map((e, i) => (
                  <View key={e.id}>
                    <View style={{ minHeight: hit.comfortable, flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, gap: space.md }}>
                      <View style={{ flex: 1 }}>
                        <Text style={[type.bodyEmphasis, type.tabular, { color: colors.text }]}>{fmtWeight(e.kg, unit)} {unit}</Text>
                        <Caption>{format(e.at, 'EEE, MMM d · p')}{e.note ? ` · ${e.note}` : ''}</Caption>
                      </View>
                      <Pressable accessibilityRole="button" accessibilityLabel={t('logs.weight.deleteA11y', { value: fmtWeight(e.kg, unit), unit })}
                        onPress={() => remove(e)} style={{ width: hit.comfortable, height: hit.comfortable, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="trash-outline" size={icon.md} color={colors.danger} />
                      </Pressable>
                    </View>
                    {i < recent.length - 1 ? <Separator /> : null}
                  </View>
                ))}
              </Card>
              {!isPro && weights.length > FREE_ENTRIES ? (
              <>
                <Caption>{t('logs.freeLimit', { count: FREE_ENTRIES })}</Caption>
                <PrimaryButton variant="ghost" label={t('common.upgrade')} onPress={() => gate('weight_log', () => {})} />
              </>
            ) : null}
            </View>
          ) : null}
        </ScrollView>
        <UndoToast toast={toast} onDismiss={dismiss} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
