import React, { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useRouter } from '../../router';
import { Card, PrimaryButton, haptic } from '../ui';
import { ProgressRing } from '../timer/ProgressRing';
import { hit, radius, space, type, useTheme } from '../../theme';
import { useReduceMotion } from '../../lib/timerHooks';
import { t } from '../../lib/i18n';
import { displayToMl, fmtVolume, QUICK_ML, QUICK_OZ, todaysWater, totalMl } from '../../lib/statsWater';
import { useLogStore } from '../../stores/logStore';
import { useSettingsStore } from '../../stores/settingsStore';

export function WaterRing({ total, goal, unit, size = 200 }: { total: number; goal: number; unit: 'ml' | 'oz'; size?: number }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const pct = Math.min(1, goal > 0 ? total / goal : 0);
  const reached = goal > 0 && total >= goal;
  const label = t('stats.water.ringA11y', { total: fmtVolume(total, unit), goal: fmtVolume(goal, unit), unit, pct: Math.round(pct * 100) });
  return (
    <ProgressRing
      size={size} progress={pct} color={reached ? colors.success : colors.accent} track={colors.track}
      fill={reached ? colors.accentSoft : undefined} overtime={reached} overtimeColor={colors.success}
      reduceMotion={reduceMotion} accessibilityLabel={label}
    >
      <Text
        numberOfLines={1} adjustsFontSizeToFit maxFontSizeMultiplier={1.2}
        style={[type.stat, { color: colors.text }]}
      >
        {fmtVolume(total, unit)}
      </Text>
      <Text maxFontSizeMultiplier={1.2} style={[type.caption, { color: colors.textSecondary, textAlign: 'center' }]}>
        {t('stats.water.ofGoal', { goal: fmtVolume(goal, unit), unit })}
      </Text>
      {reached ? (
        <Text maxFontSizeMultiplier={1.2} style={[type.caption, { color: colors.success, fontWeight: '700' }]}>{t('stats.water.reached')}</Text>
      ) : null}
    </ProgressRing>
  );
}

/** Adds water and returns the created entry id so the caller can offer Undo. */
export function addWaterWithId(ml: number): string | null {
  const at = Date.now();
  useLogStore.getState().addWater(ml, at);
  const found = useLogStore.getState().water.filter((w) => w.at === at && w.ml === ml);
  return found[found.length - 1]?.id ?? null;
}

export function WaterQuickAdd({ unit, onAdded }: { unit: 'ml' | 'oz'; onAdded: (ml: number, id: string | null) => void }) {
  const { colors } = useTheme();
  const amounts = unit === 'ml' ? QUICK_ML : QUICK_OZ;
  return (
    <View style={{ flexDirection: 'row', gap: space.md }}>
      {amounts.map((a) => (
        <Pressable key={a} accessibilityRole="button" accessibilityLabel={t('stats.water.addA11y', { amount: a, unit })}
          onPress={() => { haptic('light'); const ml = Math.round(displayToMl(a, unit)); onAdded(ml, addWaterWithId(ml)); }}
          style={({ pressed }) => ({
            flex: 1, minHeight: hit.comfortable, borderRadius: radius.button, alignItems: 'center', justifyContent: 'center',
            backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1,
          })}>
          <Text maxFontSizeMultiplier={1.3} style={[type.bodyEmphasis, { color: colors.accent }]}>+{a} {unit}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function WaterPanel({ onToast }: { onToast: (message: string, undo: () => void) => void }) {
  const router = useRouter();
  const water = useLogStore((s) => s.water);
  const settings = useSettingsStore((s) => s.settings);
  const unit = settings.units.volume;
  const today = useMemo(() => todaysWater(water), [water]);
  const total = totalMl(today);

  return (
    <View style={{ gap: space.lg }}>
      <Card style={{ alignItems: 'center', paddingVertical: space.xl }}>
        <WaterRing total={total} goal={settings.waterGoalMl} unit={unit} />
      </Card>
      <WaterQuickAdd unit={unit} onAdded={(ml, id) =>
        onToast(t('stats.water.added', { amount: fmtVolume(ml, unit), unit }), () => { if (id) useLogStore.getState().deleteWater(id); })} />
      <PrimaryButton label={t('stats.water.custom')} variant="secondary" onPress={() => router.push('/log-water')} />
    </View>
  );
}
