import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Body, Caption, PrimaryButton, Screen, Title, haptic } from '../components/ui';
import { ModalHeader } from '../components/timer/ModalHeader';
import { Sheet } from '../components/timer/Sheet';
import { hit, icon, layout, protocolSwatches, radius, space, type, useTheme } from '../theme';
import { t } from '../lib/i18n';
import { formatHM, MIN } from '../lib/fastMath';
import { PRESET_PROTOCOLS, getProtocol } from '../lib/protocols';
import { useProGate } from '../lib/proGate';
import { rescheduleNotifications } from '../lib/timerNotify';
import { selectActiveFast, useFastStore } from '../stores/fastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useIsPro } from '../stores/purchaseStore';
import { uid } from '../stores/storage';
import type { Protocol } from '../types';

const SWATCHES = protocolSwatches;

function subtitle(p: Protocol): string {
  if (p.weeklyPattern) return t('timer.picker.fiveTwoNote');
  return p.eatingMinutes > 0
    ? t('timer.picker.fastEat', { fast: Math.round(p.fastingMinutes / 60), eat: Math.round(p.eatingMinutes / 60) })
    : t('timer.picker.fastOnly', { fast: Math.round(p.fastingMinutes / 60) });
}

export default function ProtocolPickerScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const gate = useProGate();
  const isPro = useIsPro();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const active = useFastStore(selectActiveFast);

  const [pending, setPending] = useState<Protocol | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [hours, setHours] = useState(18);
  const [colour, setColour] = useState(SWATCHES[0]);

  const selectedId = active?.protocolId ?? settings.activeProtocolId;

  const apply = (p: Protocol) => {
    update({ activeProtocolId: p.id });
    if (active) useFastStore.getState().setActiveTarget(p);
    haptic('success');
    rescheduleNotifications();
    router.back();
  };

  const choose = (p: Protocol) => {
    if (p.id === selectedId) { router.back(); return; }
    const go = () => {
      // FR-03: switching mid-fast keeps the fast, changes the target, asks first.
      if (active) setPending(p);
      else apply(p);
    };
    if (p.proOnly) gate('protocol', go);
    else go();
  };

  const saveCustom = () => {
    const h = Math.min(72, Math.max(1, Math.round(hours)));
    const proto: Protocol = {
      id: `custom_${uid()}`,
      name: name.trim() || t('timer.custom.defaultName', { h }),
      fastingMinutes: h * 60,
      eatingMinutes: Math.max(0, (24 - h) * 60),
      isCustom: true,
      color: colour,
    };
    update({ customProtocols: [...settings.customProtocols, proto] });
    setCreating(false);
    setName('');
    choose(proto);
  };

  const removeCustom = (p: Protocol) => {
    haptic('warning');
    update({
      customProtocols: settings.customProtocols.filter((c) => c.id !== p.id),
      activeProtocolId: settings.activeProtocolId === p.id ? '16_8' : settings.activeProtocolId,
    });
  };

  const renderRow = (p: Protocol) => {
    const locked = !!p.proOnly && !isPro;
    const selected = p.id === selectedId;
    return (
      <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Pressable
          accessibilityRole="radio"
          aria-checked={selected}
          accessibilityLabel={locked ? t('timer.picker.lockedLabel', { name: p.name }) : `${p.name}, ${subtitle(p)}`}
          onPress={() => choose(p)}
          style={({ pressed }) => ({
            flex: 1, minHeight: hit.comfortable + space.sm, flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg,
            paddingVertical: space.md, borderRadius: radius.card, backgroundColor: selected ? colors.accentSoft : colors.surface,
            borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.controlBorder, opacity: pressed ? 0.85 : 1,
          })}
        >
          <View style={{ width: 14, height: 14, borderRadius: radius.chip, backgroundColor: p.color }} />
          <View style={{ flex: 1 }}>
            <Text style={[type.bodyEmphasis, { color: colors.text }]}>{p.name}</Text>
            <Caption>{subtitle(p)}</Caption>
          </View>
          {locked ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Ionicons name="lock-closed" size={icon.sm} color={colors.textSecondary} />
              <Caption>{t('timer.picker.locked')}</Caption>
            </View>
          ) : selected ? (
            <Ionicons name="checkmark-circle" size={icon.lg} color={colors.accent} />
          ) : null}
        </Pressable>
        {p.isCustom ? (
          <Pressable
            accessibilityRole="button" accessibilityLabel={t('timer.picker.delete', { name: p.name })}
            onPress={() => removeCustom(p)}
            style={{ width: hit.min, height: hit.min, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="trash-outline" size={icon.md} color={colors.danger} />
          </Pressable>
        ) : null}
      </View>
    );
  };

  const stepper = (delta: number, icon_: 'remove' | 'add', label: string) => (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label}
      onPress={() => { haptic('light'); setHours((h) => Math.min(72, Math.max(1, h + delta))); }}
      style={({ pressed }) => ({
        width: hit.min + 4, height: hit.min + 4, borderRadius: radius.chip, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.accentSoft, opacity: pressed ? 0.8 : 1,
      })}
    >
      <Ionicons name={icon_} size={icon.lg} color={colors.accent} />
    </Pressable>
  );

  const current = getProtocol(selectedId, settings);

  return (
    <Screen>
      <ModalHeader title={t('timer.picker.title')} />
      <ScrollView contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.sm, gap: space.md, paddingBottom: space.xxl }}>
        <Caption>{t('timer.picker.presets')}</Caption>
        <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {PRESET_PROTOCOLS.map(renderRow)}
        </View>

        {settings.customProtocols.length > 0 ? (
          <>
            <Caption style={{ marginTop: space.md }}>{t('timer.picker.customHeader')}</Caption>
            <View accessibilityRole="radiogroup" style={{ gap: space.sm }}>
              {settings.customProtocols.map(renderRow)}
            </View>
          </>
        ) : null}

        <PrimaryButton
          variant="secondary" label={t('timer.picker.createCustom')}
          style={{ marginTop: space.lg }}
          onPress={() => gate('custom_protocol', () => setCreating(true))}
        />
      </ScrollView>

      {/* FR-03 confirmation */}
      <Sheet visible={pending !== null} onClose={() => setPending(null)} title={t('timer.picker.switchTitle')}>
        <Title>{t('timer.picker.switchTitle')}</Title>
        <Body secondary>
          {t('timer.picker.switchBody', {
            from: formatHM(current.fastingMinutes * MIN), to: formatHM((pending?.fastingMinutes ?? 0) * MIN),
          })}
        </Body>
        <PrimaryButton label={t('timer.picker.switchConfirm')} onPress={() => { const p = pending; setPending(null); if (p) apply(p); }} />
        <PrimaryButton label={t('timer.picker.switchCancel')} variant="ghost" onPress={() => setPending(null)} />
      </Sheet>

      {/* FR-02 custom creator */}
      <Sheet visible={creating} onClose={() => setCreating(false)} title={t('timer.custom.title')}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: space.lg }}>
          <Title>{t('timer.custom.title')}</Title>
          <View style={{ gap: space.sm }}>
            <Body style={type.bodyEmphasis}>{t('timer.custom.name')}</Body>
            <TextInput
              value={name} onChangeText={setName} maxLength={24}
              placeholder={t('timer.custom.namePlaceholder')} placeholderTextColor={colors.textSecondary}
              accessibilityLabel={t('timer.custom.name')}
              style={{
                minHeight: hit.comfortable, paddingHorizontal: space.lg, borderRadius: radius.card, ...type.body,
                backgroundColor: colors.bg, borderWidth: 1, borderColor: colors.controlBorder, color: colors.text,
              }}
            />
          </View>
          <View style={{ gap: space.sm }}>
            <Body style={type.bodyEmphasis}>{t('timer.custom.hours')}</Body>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              {stepper(-1, 'remove', t('timer.custom.decrease'))}
              <View accessible role="status" accessibilityLiveRegion="polite" accessibilityLabel={t('timer.custom.hoursValue', { h: hours })} style={{ alignItems: 'center' }}>
                <Text style={[type.title, type.tabular, { color: colors.text }]}>{t('timer.custom.hoursValue', { h: hours })}</Text>
                <Caption>{t('timer.custom.eatingDerived', { h: Math.max(0, 24 - hours) })}</Caption>
              </View>
              {stepper(1, 'add', t('timer.custom.increase'))}
            </View>
          </View>
          <View style={{ gap: space.sm }}>
            <Body style={type.bodyEmphasis}>{t('timer.custom.colour')}</Body>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {SWATCHES.map((c, i) => (
                <Pressable
                  key={c} accessibilityRole="button" aria-pressed={colour === c}
                  accessibilityLabel={t('timer.custom.colourOption', { n: i + 1 })}
                  onPress={() => { haptic('light'); setColour(c); }}
                  style={{
                    width: hit.min, height: hit.min, borderRadius: radius.chip, backgroundColor: c, alignItems: 'center', justifyContent: 'center',
                    borderWidth: colour === c ? 3 : 0, borderColor: colors.text,
                  }}
                >
                  {colour === c ? <Ionicons name="checkmark" size={icon.md} color="#FFFFFF" /> : null}
                </Pressable>
              ))}
            </View>
          </View>
          <PrimaryButton label={t('timer.custom.save')} onPress={saveCustom} />
        </KeyboardAvoidingView>
      </Sheet>
    </Screen>
  );
}
