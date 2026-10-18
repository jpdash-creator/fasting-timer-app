import React, { useCallback, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { useRouter } from '../router';
import { Ionicons } from '../platform/icons';
import { format } from 'date-fns';
import { Caption, Card, PrimaryButton, Screen, Separator, haptic } from '../components/ui';
import { ModalHeader } from '../components/timer/ModalHeader';
import { UndoToast, type ToastState } from '../components/logs/UndoToast';
import { WaterQuickAdd, WaterRing, addWaterWithId } from '../components/stats/WaterPanel';
import { hit, icon, layout, radius, space, type, useTheme } from '../theme';
import { t } from '../lib/i18n';
import { displayToMl, fmtVolume, todaysWater, totalMl } from '../lib/statsWater';
import { useLogStore } from '../stores/logStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useIsPro } from '../stores/purchaseStore';
import { useProGate } from '../lib/proGate';
import type { WaterEntry } from '../types';

const FREE_ENTRIES = 7;
const GOAL_STEP = 250;

export default function LogWater() {
  const { colors } = useTheme();
  const router = useRouter();
  const isPro = useIsPro();
  const gate = useProGate();
  const water = useLogStore((s) => s.water);
  const settings = useSettingsStore((s) => s.settings);
  const unit = settings.units.volume;
  const goal = settings.waterGoalMl;
  const [text, setText] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const dismiss = useCallback(() => setToast(null), []);

  const today = useMemo(() => todaysWater(water), [water]);
  const total = totalMl(today);
  const shown = isPro ? today : today.slice(0, FREE_ENTRIES);

  const amount = parseFloat(text.replace(',', '.'));
  const ml = isFinite(amount) && amount > 0 ? Math.round(displayToMl(amount, unit)) : null;
  const invalid = text.length > 0 && (ml === null || ml > 5000);

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  const announce = (addedMl: number, id: string | null) =>
    setToast({
      id: Date.now(), message: t('logs.water.added', { amount: fmtVolume(addedMl, unit), unit }),
      onUndo: () => { if (id) useLogStore.getState().deleteWater(id); },
    });

  const addCustom = () => {
    if (ml === null || ml > 5000) return;
    haptic('success');
    announce(ml, addWaterWithId(ml));
    setText('');
  };

  const remove = (e: WaterEntry) => {
    useLogStore.getState().deleteWater(e.id);
    setToast({ id: Date.now(), message: t('logs.water.deleted'), onUndo: () => useLogStore.getState().addWater(e.ml, e.at) });
  };

  const setGoal = (next: number) =>
    useSettingsStore.getState().update({ waterGoalMl: Math.min(5000, Math.max(500, next)) });

  const goalBtn = (name: 'remove' | 'add', delta: number, label: string, disabled: boolean) => (
    <Pressable accessibilityRole="button" accessibilityLabel={label} aria-disabled={disabled} disabled={disabled}
      onPress={() => { haptic('light'); setGoal(goal + delta); }}
      style={{ width: hit.min, height: hit.min, borderRadius: hit.min / 2, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.accentSoft, opacity: disabled ? 0.4 : 1 }}>
      <Ionicons name={name} size={icon.md} color={colors.accent} />
    </Pressable>
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ModalHeader title={t('logs.water.title')} onClose={close} />
        <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.sm, gap: layout.sectionGap, paddingBottom: layout.scrollBottom }} keyboardShouldPersistTaps="handled">
          <Card style={{ alignItems: 'center', paddingVertical: space.lg }}>
            <WaterRing total={total} goal={goal} unit={unit} size={160} />
          </Card>

          <WaterQuickAdd unit={unit} onAdded={announce} />

          <View style={{ gap: space.sm }}>
            <Caption>{t('logs.water.custom')}</Caption>
            <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <View style={{ flex: 1, minHeight: hit.comfortable, flexDirection: 'row', alignItems: 'center', borderRadius: radius.card,
                backgroundColor: colors.surface, borderWidth: 1, borderColor: invalid ? colors.danger : colors.controlBorder, paddingHorizontal: space.md }}>
                <TextInput value={text} onChangeText={setText} keyboardType="decimal-pad" maxLength={5}
                  accessibilityLabel={t('logs.water.inputLabel', { unit })} placeholder={unit === 'ml' ? '300' : '10'}
                  placeholderTextColor={colors.textSecondary} onSubmitEditing={addCustom}
                  style={[type.body, type.tabular, { flex: 1, color: colors.text, minHeight: 52 }]} />
                <Text style={[type.body, { color: colors.textSecondary }]}>{unit}</Text>
              </View>
              <PrimaryButton label={t('common.add')} onPress={addCustom} disabled={ml === null || invalid} style={{ paddingHorizontal: space.xl }} />
            </View>
            {invalid ? <Text accessibilityRole="alert" style={[type.caption, { color: colors.danger }]}>{t('logs.water.invalid')}</Text> : null}
          </View>

          <Card style={{ gap: space.sm }}>
            <Text style={[type.bodyEmphasis, { color: colors.text }]}>{t('logs.water.goal')}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {goalBtn('remove', -GOAL_STEP, t('logs.water.goalLower'), goal <= 500)}
              <Text accessibilityLiveRegion="polite" style={[type.bodyEmphasis, type.tabular, { color: colors.text }]}>
                {fmtVolume(goal, unit)} {unit}
              </Text>
              {goalBtn('add', GOAL_STEP, t('logs.water.goalRaise'), goal >= 5000)}
            </View>
          </Card>

          <View style={{ gap: space.sm }}>
            <Text accessibilityRole="header" style={[type.bodyEmphasis, { color: colors.text }]}>{t('logs.water.today')}</Text>
            {shown.length === 0 ? (
              <Caption>{t('logs.water.none')}</Caption>
            ) : (
              <Card style={{ paddingVertical: space.xs, paddingHorizontal: 0 }}>
                {shown.map((e, i) => (
                  <View key={e.id}>
                    <View style={{ minHeight: hit.comfortable, flexDirection: 'row', alignItems: 'center', paddingLeft: space.lg, gap: space.md }}>
                      <Text style={[type.body, type.tabular, { flex: 1, color: colors.text }]}>
                        {fmtVolume(e.ml, unit)} {unit} · <Text style={{ color: colors.textSecondary }}>{format(e.at, 'p')}</Text>
                      </Text>
                      <Pressable accessibilityRole="button"
                        accessibilityLabel={t('logs.water.deleteA11y', { amount: fmtVolume(e.ml, unit), unit, time: format(e.at, 'p') })}
                        onPress={() => remove(e)} style={{ width: hit.comfortable, height: hit.comfortable, alignItems: 'center', justifyContent: 'center' }}>
                        <Ionicons name="trash-outline" size={icon.md} color={colors.danger} />
                      </Pressable>
                    </View>
                    {i < shown.length - 1 ? <Separator /> : null}
                  </View>
                ))}
              </Card>
            )}
            {!isPro && today.length > FREE_ENTRIES ? (
              <>
                <Caption>{t('logs.freeLimit', { count: FREE_ENTRIES })}</Caption>
                <PrimaryButton variant="ghost" label={t('common.upgrade')} onPress={() => gate('water_log', () => {})} />
              </>
            ) : null}
          </View>
        </ScrollView>
        <UndoToast toast={toast} onDismiss={dismiss} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
