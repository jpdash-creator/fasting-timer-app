import React, { useRef, useState } from 'react';
import { Platform, Pressable, Text, View, useWindowDimensions } from 'react-native';
import { useLocalSearchParams, useRouter } from '../router';
import { captureRef } from 'react-native-view-shot';
import { canShareFiles, sharePng } from '../platform/shareImage';
import { format } from 'date-fns';
import { Body, Caption, PrimaryButton, Screen, haptic } from '../components/ui';
import { ShareCard, CARD_H, CARD_W } from '../components/share/ShareCard';
import { hit, layout, radius, space, type, useTheme } from '../theme';
import { ModalHeader } from '../components/timer/ModalHeader';
import { t } from '../lib/i18n';
import { computeStreaks, formatHM } from '../lib/fastMath';
import { getProtocol } from '../lib/protocols';
import { useFastStore } from '../stores/fastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useIsPro } from '../stores/purchaseStore';

export default function ShareCardScreen() {
  const { fastId } = useLocalSearchParams<{ fastId?: string }>();
  const router = useRouter();
  const { colors, scheme } = useTheme();
  const { width, height } = useWindowDimensions();
  const isPro = useIsPro();
  const fasts = useFastStore((s) => s.fasts);
  const settings = useSettingsStore((s) => s.settings);
  const cardRef = useRef<React.ComponentRef<typeof View>>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fast = fasts.find((f) => f.id === fastId) ?? null;

  // Preview scaled to fit between the header and the action area, keeping 9:16.
  const maxH = Math.max(240, height - 280);
  const previewW = Math.max(160, Math.min(width - layout.screenX * 2, (maxH * CARD_W) / CARD_H));

  const close = () => router.back();

  const onShare = async () => {
    if (!cardRef.current || busy) return;
    setBusy(true);
    setError(null);
    try {
      if (Platform.OS === 'web' || !(await canShareFiles())) {
        setError(t('share.unavailable'));
        return;
      }
      const uri = await captureRef(cardRef, {
        format: 'png', quality: 1, result: 'tmpfile', width: CARD_W, height: CARD_H,
      });
      haptic('success');
      await sharePng(uri, t('share.title'));
    } catch {
      setError(t('share.failed'));
    } finally {
      setBusy(false);
    }
  };

  const header = <ModalHeader title={t('share.title')} onClose={close} />;

  if (!fast) {
    return (
      <Screen edges={['top', 'bottom']}>
        {header}
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: layout.screenX, gap: space.lg }}>
          <Body secondary style={{ textAlign: 'center' }}>{t('share.notFound')}</Body>
          <PrimaryButton label={t('common.close')} variant="secondary" onPress={close} />
        </View>
      </Screen>
    );
  }

  const end = fast.endAt ?? Date.now();
  const elapsed = Math.max(0, end - fast.startAt);
  const target = fast.targetMinutes * 60_000;
  const percent = target > 0 ? Math.min(1, elapsed / target) : 0;
  const protocol = getProtocol(fast.protocolId, settings);
  const streak = computeStreaks(fasts, isPro).current;

  return (
    <Screen edges={['top', 'bottom']}>
      {header}
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: layout.screenX }}>
        <View style={{
          borderRadius: radius.sheet, overflow: 'hidden',
          // Light: soft shadow tinted with the text colour. Dark: a hairline instead (shadows vanish).
          ...(scheme === 'dark'
            ? { borderWidth: 1, borderColor: colors.border }
            : { elevation: 6, shadowColor: colors.text, shadowOpacity: 0.14, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } }),
        }}>
          <ShareCard
            ref={cardRef}
            width={previewW}
            durationText={formatHM(elapsed)}
            protocolName={protocol.name}
            streak={streak}
            dateText={format(new Date(end), 'MMMM d, yyyy')}
            percent={percent}
            goalMet={fast.goalMet === true}
            showWatermark={!isPro}
          />
        </View>
      </View>
      <View style={{ paddingHorizontal: layout.screenX, paddingVertical: space.lg, gap: space.md }}>
        {error ? (
          <Text accessibilityRole="alert" accessibilityLiveRegion="polite"
            style={[type.body, { color: colors.danger, textAlign: 'center' }]}>{error}</Text>
        ) : null}
        <PrimaryButton label={busy ? t('share.sharing') : t('share.button')} onPress={onShare} disabled={busy} />
        {!isPro ? (
          <Pressable
            onPress={() => router.push({ pathname: '/paywall', params: { trigger: 'share' } })}
            accessibilityRole="button" accessibilityLabel={t('share.removeWatermark')}
            style={{ minHeight: hit.min + 4, alignItems: 'center', justifyContent: 'center' }}
          >
            <Caption style={[type.label, { color: colors.accent }]}>{t('share.removeWatermark')}</Caption>
          </Pressable>
        ) : null}
      </View>
    </Screen>
  );
}
