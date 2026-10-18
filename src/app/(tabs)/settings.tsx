import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from '../../router';
import { getAppVersion } from '../../platform/deviceInfo';
import { Ionicons } from '../../platform/icons';
import { hit, icon as iconSize, layout, radius, space, type, useTheme } from '../../theme';
import { Body, Caption, Screen, Title, Toast, haptic } from '../../components/ui';
import { SettingsGroup } from '../../components/settings/SettingsGroup';
import {
  LinkRow, ProBadge, StepperRow, TimeRow, ToggleRow,
} from '../../components/settings/SettingsRows';
import { ConfirmSheet, ExportSheet, OptionSheet } from '../../components/settings/Sheets';
import { LegalTextSheet } from '../../components/settings/LegalTextSheet';
import { AppearanceSection } from '../../components/settings/AppearanceSection';
import { LANGUAGES, languageName } from '../../components/settings/languages';
import { deleteAllData } from '../../components/settings/deleteAllData';
import { BillingIssueBanner } from '../../components/banners';
import { i18n, t } from '../../lib/i18n';
import {
  HAS_PRIVACY_URL, HAS_TERMS_URL, PRIVACY_URL, SUPPORT_EMAIL, TERMS_URL,
} from '../../lib/links';
import { PRIVACY_POLICY_TEXT, TERMS_TEXT } from '../../lib/legalText';
import { useProGate } from '../../lib/proGate';
import { getProtocol } from '../../lib/protocols';
import { exportCsv, type ExportKind } from '../../lib/exportData';
import { useSettingsStore } from '../../stores/settingsStore';
import { useIsPro, usePurchaseStore } from '../../stores/purchaseStore';
import { purchases } from '../../services/purchases';

const KG_PER_LB = 0.45359237;
const ML_PER_OZ = 29.5735;
const OFFSET_MIN = 5;
const OFFSET_MAX = 180;

function FooterNote({ title, body }: { title?: string; body: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs / 2 }}>
      {title ? (
        <Text accessibilityRole="header" style={[type.caption, { color: colors.textSecondary, fontWeight: '600' }]}>{title}</Text>
      ) : null}
      <Caption>{body}</Caption>
    </View>
  );
}

type Sheet = null | 'weightUnit' | 'volumeUnit' | 'theme' | 'language' | 'export' | 'delete' | 'privacyText' | 'termsText';

export default function SettingsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const gate = useProGate();
  const isPro = useIsPro();
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const updateReminders = useSettingsStore((s) => s.updateReminders);
  const expiresAt = usePurchaseStore((s) => s.expiresAt);
  const billingIssue = usePurchaseStore((s) => s.billingIssue);
  const source = usePurchaseStore((s) => s.source);
  const mockPro = usePurchaseStore((s) => s.mockPro);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [busy, setBusy] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const toast = useCallback((m: string) => {
    setMessage(m);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), 3000);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const { reminders, units } = settings;
  const protocol = getProtocol(settings.activeProtocolId, settings);
  const version = getAppVersion();
  // Mock-Pro toggle is a developer affordance only; never reachable in release builds.
  const canMockPro = __DEV__;

  const openUrl = async (url: string) => {
    try { await Linking.openURL(url); } catch { toast(t('settings.legal.openFailed')); }
  };

  const onRestore = async () => {
    if (restoring) return;
    setRestoring(true);
    try {
      const state = await purchases.restore();
      toast(state.isPro ? t('settings.restore.found') : t('settings.restore.none'));
    } catch {
      toast(t('settings.restore.failed'));
    } finally {
      setRestoring(false);
    }
  };

  const onManage = async () => {
    try { await Linking.openURL(purchases.manageSubscriptionUrl()); } catch { toast(t('settings.manage.failed')); }
  };

  const onExport = async (kind: ExportKind) => {
    try {
      const r = await exportCsv(kind);
      toast(t(r === 'empty' ? 'settings.export.empty' : r === 'unavailable' ? 'settings.export.unavailable'
        : r === 'saved' ? 'settings.export.saved' : 'settings.export.done'));
    } catch {
      toast(t('settings.export.failed'));
    }
  };

  const onDelete = async () => {
    setBusy(true);
    try {
      await deleteAllData();
      setSheet(null);
      router.replace('/(onboarding)/welcome');
    } catch {
      toast(t('settings.delete.failed'));
    } finally {
      setBusy(false);
    }
  };

  const onVersionLongPress = () => {
    if (!canMockPro) return;
    const next = !usePurchaseStore.getState().mockPro;
    usePurchaseStore.getState().setMockPro(next);
    haptic('success');
    toast(next ? t('settings.about.mockOn') : t('settings.about.mockOff'));
  };

  // Units helpers
  const waterText = units.volume === 'oz'
    ? `${Math.round(settings.waterGoalMl / ML_PER_OZ)} oz` : `${settings.waterGoalMl} ml`;
  const stepWater = (dir: 1 | -1) =>
    update({ waterGoalMl: Math.min(5000, Math.max(500, settings.waterGoalMl + dir * 250)) });

  const goalKg = settings.goalWeightKg;
  const goalDisplay = goalKg === null ? null : units.weight === 'lb' ? goalKg / KG_PER_LB : goalKg;
  const goalText = goalDisplay === null ? t('settings.goalWeight.notSet')
    : `${goalDisplay.toFixed(1)} ${units.weight}`;
  const stepGoal = (dir: 1 | -1) => {
    const step = units.weight === 'lb' ? 1 : 0.5;
    const cur = goalDisplay ?? (units.weight === 'lb' ? 154 : 70);
    const next = Math.round((cur + dir * step) * 10) / 10;
    const kg = units.weight === 'lb' ? next * KG_PER_LB : next;
    update({ goalWeightKg: Math.round(Math.min(250, Math.max(30, kg)) * 100) / 100 });
  };

  const stepOffset = (dir: 1 | -1) => gate('reminder_offset', () =>
    updateReminders({
      windowClosingOffsetMin: Math.min(OFFSET_MAX, Math.max(OFFSET_MIN, reminders.windowClosingOffsetMin + dir * 5)),
    }));

  const fmtDate = (ms: number) => {
    try {
      return new Date(ms).toLocaleDateString(i18n.locale || 'en', { year: 'numeric', month: 'short', day: 'numeric' });
    } catch {
      return new Date(ms).toLocaleDateString();
    }
  };
  const proSubtitle = !isPro
    ? t('settings.pro.upgradeSubtitle')
    : source === 'lifetime' ? t('settings.pro.lifetime')
    : expiresAt && !mockPro
      ? t(
        source === 'trial' ? 'settings.pro.trialEndsOn'
          : billingIssue || expiresAt <= Date.now() ? 'settings.pro.endsOn' : 'settings.pro.renewsOn',
        { date: fmtDate(expiresAt) },
      )
      : t('settings.pro.activeSubtitle');
  const isRtlLang = (settings.language || '').split('-')[0] === 'ar';

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: layout.screenX, paddingTop: space.lg, paddingBottom: layout.scrollBottom }}
        keyboardShouldPersistTaps="handled"
      >
        <Title>{t('settings.title')}</Title>
        <BillingIssueBanner />

        {/* Pro row */}
        <Pressable
          onPress={isPro ? onManage : () => router.push({ pathname: '/paywall', params: { trigger: 'settings' } })}
          accessibilityRole="button"
          style={({ pressed }) => ({
            marginTop: space.lg, minHeight: hit.comfortable + 16, flexDirection: 'row', alignItems: 'center', gap: space.md,
            padding: space.lg, borderRadius: radius.card, borderWidth: 1.5, borderColor: colors.accent,
            backgroundColor: colors.surface, opacity: pressed ? 0.85 : 1,
          })}
        >
          <Ionicons name={isPro ? 'ribbon' : 'ribbon-outline'} size={iconSize.lg + 2} color={colors.accent} accessibilityElementsHidden importantForAccessibility="no" />
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' }}>
              <Text style={[type.bodyEmphasis, { fontWeight: '700', color: colors.text }]}>
                {isPro ? t('settings.pro.activeTitle') : t('settings.pro.upgradeTitle')}
              </Text>
              {isPro ? <ProBadge label={t('settings.pro.activeBadge')} /> : null}
            </View>
            <Caption>{proSubtitle}</Caption>
          </View>
          <Ionicons name="chevron-forward" size={iconSize.md - 2} color={colors.textSecondary} accessibilityElementsHidden importantForAccessibility="no" />
        </Pressable>
        {billingIssue ? (
          <Pressable
            onPress={onManage} accessibilityRole="button" accessibilityLabel={t('settings.pro.billingIssue')}
            style={{ marginTop: space.md, padding: space.lg, borderRadius: radius.card, borderWidth: 1.5,
              borderColor: colors.danger, flexDirection: 'row', gap: space.md, alignItems: 'center', backgroundColor: colors.surface }}
          >
            <Ionicons name="warning" size={iconSize.md} color={colors.danger} />
            <Text style={[type.body, { flex: 1, color: colors.text }]}>{t('settings.pro.billingIssue')}</Text>
          </Pressable>
        ) : null}

        <SettingsGroup title={t('settings.sections.fasting')}>
          <LinkRow
            label={t('settings.protocol.label')} value={protocol.name} hint={t('settings.protocol.hint')}
            onPress={() => router.push('/protocol-picker')}
          />
          <ToggleRow
            label={t('settings.autoStart.label')} hint={t('settings.autoStart.hint')}
            badge={isPro ? undefined : t('common.pro')}
            value={settings.autoStartNextFast}
            onValueChange={(v) => (v ? gate('auto_start', () => update({ autoStartNextFast: true }))
              : update({ autoStartNextFast: false }))}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.sections.preferences')}>
          <LinkRow label={t('settings.units.weight')} value={units.weight} onPress={() => setSheet('weightUnit')} />
          <LinkRow label={t('settings.units.volume')} value={units.volume} onPress={() => setSheet('volumeUnit')} />
          <LinkRow label={t('settings.theme.label')} value={t(`settings.theme.${settings.theme}`)} onPress={() => setSheet('theme')} />
          <ToggleRow label={t('settings.haptics')} value={settings.haptics} onValueChange={(v) => update({ haptics: v })} />
          <LinkRow
            label={t('settings.language.label')}
            value={languageName(settings.language, t('settings.language.device'))}
            hint={isRtlLang ? t('settings.language.rtlNote') : undefined}
            onPress={() => setSheet('language')}
          />
        </SettingsGroup>

        <AppearanceSection onMessage={toast} />

        <SettingsGroup title={t('settings.sections.reminders')}>
          <ToggleRow label={t('settings.reminders.fastStart')} hint={t('settings.reminders.fastStartHint')}
            badge={isPro ? undefined : t('common.pro')}
            value={isPro && reminders.fastStart}
            onValueChange={(v) => (v ? gate('reminder_fast_start', () => updateReminders({ fastStart: true })) : updateReminders({ fastStart: false }))} />
          <ToggleRow label={t('settings.reminders.fastEnd')} hint={t('settings.reminders.fastEndHint')}
            value={reminders.fastEnd} onValueChange={(v) => updateReminders({ fastEnd: v })} />
          <ToggleRow label={t('settings.reminders.halfway')} hint={t('settings.reminders.halfwayHint')}
            badge={isPro ? undefined : t('common.pro')}
            value={isPro && reminders.halfway}
            onValueChange={(v) => (v ? gate('reminder_halfway', () => updateReminders({ halfway: true })) : updateReminders({ halfway: false }))} />
          <ToggleRow label={t('settings.reminders.oneHourLeft')} hint={t('settings.reminders.oneHourLeftHint')}
            badge={isPro ? undefined : t('common.pro')}
            value={isPro && reminders.oneHourLeft}
            onValueChange={(v) => (v ? gate('reminder_one_hour', () => updateReminders({ oneHourLeft: true })) : updateReminders({ oneHourLeft: false }))} />
          <ToggleRow label={t('settings.reminders.windowClosing')} hint={t('settings.reminders.windowClosingHint')}
            badge={isPro ? undefined : t('common.pro')}
            value={isPro && reminders.windowClosing}
            onValueChange={(v) => (v ? gate('reminder_window_closing', () => updateReminders({ windowClosing: true })) : updateReminders({ windowClosing: false }))} />
          {isPro && reminders.windowClosing ? (
            <StepperRow
              label={t('settings.reminders.offset')} badge={isPro ? undefined : t('common.pro')}
              valueText={t('settings.reminders.offsetValue', { minutes: reminders.windowClosingOffsetMin })}
              decreaseLabel={t('settings.reminders.offsetDecrease')} increaseLabel={t('settings.reminders.offsetIncrease')}
              canDecrease={reminders.windowClosingOffsetMin > OFFSET_MIN}
              canIncrease={reminders.windowClosingOffsetMin < OFFSET_MAX}
              onDecrease={() => stepOffset(-1)} onIncrease={() => stepOffset(1)}
            />
          ) : null}
          <ToggleRow label={t('settings.reminders.quietHours')} hint={t('settings.reminders.quietHoursHint')}
            value={reminders.quietHours.enabled}
            onValueChange={(v) => updateReminders({ quietHours: { ...reminders.quietHours, enabled: v } })} />
          {reminders.quietHours.enabled ? (
            <>
              <TimeRow label={t('settings.reminders.quietFrom')} value={reminders.quietHours.from}
                onChange={(v) => updateReminders({ quietHours: { ...reminders.quietHours, from: v } })} />
              <TimeRow label={t('settings.reminders.quietTo')} value={reminders.quietHours.to}
                onChange={(v) => updateReminders({ quietHours: { ...reminders.quietHours, to: v } })} />
            </>
          ) : null}
        </SettingsGroup>

        <SettingsGroup title={t('settings.sections.goals')}>
          <StepperRow
            label={t('settings.water.goal')} valueText={waterText}
            decreaseLabel={t('settings.water.decrease')} increaseLabel={t('settings.water.increase')}
            canDecrease={settings.waterGoalMl > 500} canIncrease={settings.waterGoalMl < 5000}
            onDecrease={() => stepWater(-1)} onIncrease={() => stepWater(1)}
          />
          <StepperRow
            label={t('settings.goalWeight.label')} valueText={goalText}
            decreaseLabel={t('settings.goalWeight.decrease')} increaseLabel={t('settings.goalWeight.increase')}
            onDecrease={() => stepGoal(-1)} onIncrease={() => stepGoal(1)}
          />
          {goalKg !== null ? (
            <LinkRow label={t('settings.goalWeight.clear')} showChevron={false}
              onPress={() => update({ goalWeightKg: null })} icon="close-circle-outline" />
          ) : null}
        </SettingsGroup>

        <SettingsGroup title={t('settings.sections.data')}>
          <LinkRow
            icon="download-outline" label={t('settings.export.label')} hint={t('settings.export.hint')}
            value={isPro ? undefined : t('common.pro')}
            onPress={() => gate('csv_export', () => setSheet('export'))}
          />
        </SettingsGroup>

        <SettingsGroup title={t('settings.sections.subscription')}>
          <LinkRow
            icon="refresh-outline" label={restoring ? t('settings.restore.working') : t('settings.restore.label')}
            showChevron={false} onPress={onRestore}
          />
          <LinkRow icon="card-outline" label={t('settings.manage.label')} onPress={onManage} />
        </SettingsGroup>

        <SettingsGroup
          title={t('settings.sections.about')}
          footer={(
            <>
              <FooterNote title={t('settings.about.accessibility')} body={t('settings.about.accessibilityBody')} />
              <FooterNote title={t('settings.about.medical')} body={t('disclaimer')} />
              <FooterNote body={t('settings.about.privacyNote')} />
            </>
          )}
        >
          <LinkRow icon="shield-checkmark-outline" label={t('settings.legal.privacy')} onPress={() => (HAS_PRIVACY_URL ? openUrl(PRIVACY_URL) : setSheet('privacyText'))} />
          <LinkRow icon="document-text-outline" label={t('settings.legal.terms')} onPress={() => (HAS_TERMS_URL ? openUrl(TERMS_URL) : setSheet('termsText'))} />
          <LinkRow
            icon="mail-outline" label={t('settings.legal.support')} value={SUPPORT_EMAIL}
            onPress={() => openUrl(`mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(t('settings.legal.supportSubject'))}`)}
          />
          <Pressable
            onLongPress={onVersionLongPress} delayLongPress={800}
            role="group" accessibilityLabel={`${t('settings.about.versionLabel')}, ${version}`}
            disabled={!canMockPro}
            style={{ minHeight: hit.comfortable, justifyContent: 'center', paddingHorizontal: space.lg }}
          >
            <Body secondary>{t('settings.about.version', { version })}</Body>
          </Pressable>
        </SettingsGroup>

        <SettingsGroup title={t('settings.sections.danger')} footer={t('settings.delete.hint')}>
          <LinkRow
            icon="trash-outline" destructive showChevron={false}
            label={t('settings.delete.label')} onPress={() => setSheet('delete')}
          />
        </SettingsGroup>
      </ScrollView>

      {message ? <Toast message={message} bottom={space.lg} /> : null}

      <OptionSheet
        visible={sheet === 'weightUnit'} title={t('settings.units.weight')} value={units.weight}
        options={[{ value: 'kg', label: t('settings.units.kg') }, { value: 'lb', label: t('settings.units.lb') }]}
        onSelect={(v) => update({ units: { ...units, weight: v } })} onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'volumeUnit'} title={t('settings.units.volume')} value={units.volume}
        options={[{ value: 'ml', label: t('settings.units.ml') }, { value: 'oz', label: t('settings.units.oz') }]}
        onSelect={(v) => update({ units: { ...units, volume: v } })} onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'theme'} title={t('settings.theme.label')} value={settings.theme}
        options={(['system', 'light', 'dark'] as const).map((v) => ({ value: v, label: t(`settings.theme.${v}`) }))}
        onSelect={(v) => update({ theme: v })} onClose={() => setSheet(null)}
      />
      <OptionSheet
        visible={sheet === 'language'} title={t('settings.language.label')} value={settings.language}
        options={[{ value: '', label: t('settings.language.device') },
          ...LANGUAGES.map((l) => ({ value: l.tag, label: l.native }))]}
        footer={isRtlLang ? `${t('settings.language.note')}

${t('settings.language.rtlNote')}` : t('settings.language.note')}
        onSelect={(v) => update({ language: v })} onClose={() => setSheet(null)}
      />
      <LegalTextSheet
        visible={sheet === 'privacyText'} title={t('settings.legal.privacy')} text={PRIVACY_POLICY_TEXT}
        onClose={() => setSheet(null)}
      />
      <LegalTextSheet
        visible={sheet === 'termsText'} title={t('settings.legal.terms')} text={TERMS_TEXT}
        onClose={() => setSheet(null)}
      />
      <ExportSheet visible={sheet === 'export'} onClose={() => setSheet(null)} onPick={onExport} />
      <ConfirmSheet
        visible={sheet === 'delete'} busy={busy}
        title={t('settings.delete.title')} message={t('settings.delete.message')}
        confirmLabel={t('settings.delete.confirm')} onConfirm={onDelete} onClose={() => setSheet(null)}
      />
    </Screen>
  );
}
