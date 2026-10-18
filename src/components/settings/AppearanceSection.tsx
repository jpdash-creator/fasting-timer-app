import React, { useCallback, useEffect, useState } from 'react';
import { Image, Pressable, Text, View, type ImageSourcePropType } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { Ionicons } from '../../platform/icons';
import { hit, icon as iconSize, radius, space, type, useTheme } from '../../theme';
import { haptic } from '../ui';
import { SettingsGroup } from './SettingsGroup';
import { ProBadge } from './SettingsRows';
import { t } from '../../lib/i18n';
import { useProGate } from '../../lib/proGate';
import { ACCENT_THEMES, getPalette, type AccentTheme } from '../../lib/themePalettes';
import { getCurrentIconTheme, setAppIconTheme } from '../../lib/appIcon';
import { useSettingsStore } from '../../stores/settingsStore';
import { useIsPro } from '../../stores/purchaseStore';
import tealIcon from '../../../assets/icons/teal-icon.png';
import oceanIcon from '../../../assets/icons/ocean-icon.png';
import duskIcon from '../../../assets/icons/dusk-icon.png';
import sunriseIcon from '../../../assets/icons/sunrise-icon.png';

const ICON_IMAGES: Record<AccentTheme, ImageSourcePropType> = {
  teal: tealIcon,
  ocean: oceanIcon,
  dusk: duskIcon,
  sunrise: sunriseIcon,
};
const ICON_SIZE = 60;

/** "Appearance" group: accent theme chips, live preview card and the app-icon picker. */
export function AppearanceSection({ onMessage }: { onMessage?: (message: string) => void }) {
  const { colors, scheme, accentTheme } = useTheme();
  const gate = useProGate();
  const isPro = useIsPro();
  const update = useSettingsStore((s) => s.update);
  const [iconTheme, setIconTheme] = useState<AccentTheme>('teal');
  const [inline, setInline] = useState<string | null>(null);
  const say = onMessage ?? setInline;
  const mode = scheme === 'dark' ? 'dark' : 'light';

  useEffect(() => {
    let alive = true;
    getCurrentIconTheme().then((th) => { if (alive) setIconTheme(th); });
    return () => { alive = false; };
  }, []);

  const pickTheme = (th: AccentTheme) => {
    const apply = () => { haptic('light'); update({ accentTheme: th }); };
    if (th === 'teal') apply(); else gate('themes', apply);
  };

  const pickIcon = useCallback((th: AccentTheme) => {
    const apply = async () => {
      haptic('light');
      const r = await setAppIconTheme(th);
      if (r === 'ok') {
        setIconTheme(th);
        say(t('appearance.icon.changed', { name: t(`appearance.themes.${th}`) }));
      } else {
        say(t(`appearance.icon.${r}`));
      }
    };
    if (th === 'teal') void apply(); else gate('themes', () => { void apply(); });
  }, [gate, say]);

  return (
    <SettingsGroup
      title={t('appearance.title')}
      footer={(
        <View style={{ gap: space.xs }}>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{t('appearance.accent.footer')}</Text>
          <Text style={[type.caption, { color: colors.textSecondary }]}>{t('appearance.icon.footer')}</Text>
          {inline ? (
            <Text accessibilityLiveRegion="polite" style={[type.caption, { color: colors.text, fontWeight: '600' }]}>{inline}</Text>
          ) : null}
        </View>
      )}
    >
      <View
        accessibilityRole="radiogroup"
        aria-label={t('appearance.accent.label')}
        style={{ padding: space.lg, gap: space.md }}
      >
        <Text style={[type.label, { color: colors.text }]}>{t('appearance.accent.label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {ACCENT_THEMES.map((th) => {
            const selected = th === accentTheme;
            const locked = th !== 'teal' && !isPro;
            const swatch = getPalette(th, mode);
            return (
              <Pressable
                key={th}
                onPress={() => pickTheme(th)}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t('appearance.a11y.themeOption', { name: t(`appearance.themes.${th}`) })}
                accessibilityHint={locked ? t('appearance.a11y.locked') : undefined}
                style={({ pressed }) => ({
                  minHeight: hit.min, flexDirection: 'row', alignItems: 'center', gap: space.sm,
                  paddingLeft: space.sm, paddingRight: space.md, borderRadius: radius.chip,
                  borderWidth: selected ? 2 : 1, borderColor: selected ? colors.accent : colors.controlBorder,
                  backgroundColor: selected ? colors.accentSoft : colors.surface, opacity: pressed ? 0.8 : 1,
                })}
              >
                <View style={{
                  width: 28, height: 28, borderRadius: 14, backgroundColor: swatch.accent,
                  alignItems: 'center', justifyContent: 'center',
                }}>
                  {selected ? <Ionicons name="checkmark" size={iconSize.sm} color={swatch.onAccent} /> : null}
                </View>
                <Text style={[type.label, { color: colors.text }]}>{t(`appearance.themes.${th}`)}</Text>
                {locked ? <ProBadge label={t('common.pro')} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      <PreviewCard theme={accentTheme} mode={mode} />

      <View
        accessibilityRole="radiogroup"
        aria-label={t('appearance.icon.label')}
        style={{ padding: space.lg, gap: space.md }}
      >
        <Text style={[type.label, { color: colors.text }]}>{t('appearance.icon.label')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.lg }}>
          {ACCENT_THEMES.map((th) => {
            const selected = th === iconTheme;
            const locked = th !== 'teal' && !isPro;
            return (
              <Pressable
                key={th}
                onPress={() => pickIcon(th)}
                accessibilityRole="radio"
                aria-checked={selected}
                accessibilityState={{ checked: selected }}
                accessibilityLabel={t('appearance.a11y.iconOption', { name: t(`appearance.themes.${th}`) })}
                accessibilityHint={locked ? t('appearance.a11y.locked') : undefined}
                style={({ pressed }) => ({ alignItems: 'center', gap: space.xs, minWidth: hit.min, opacity: pressed ? 0.8 : 1 })}
              >
                <View style={{
                  padding: 3, borderRadius: radius.card, borderWidth: selected ? 2 : 1,
                  borderColor: selected ? colors.accent : colors.controlBorder,
                }}>
                  <Image
                    source={ICON_IMAGES[th]} accessibilityIgnoresInvertColors
                    style={{ width: ICON_SIZE, height: ICON_SIZE, borderRadius: Math.round(ICON_SIZE * 0.22) }}
                  />
                  {selected ? (
                    <View style={{
                      position: 'absolute', right: -6, top: -6, width: 22, height: 22, borderRadius: 11,
                      backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Ionicons name="checkmark" size={iconSize.sm - 4} color={colors.onAccent} />
                    </View>
                  ) : null}
                </View>
                <Text style={[type.caption, { color: colors.text }]}>{t(`appearance.themes.${th}`)}</Text>
                {locked ? <ProBadge label={t('common.pro')} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>
    </SettingsGroup>
  );
}

/** Mini card drawn entirely with the selected palette (independent of the surrounding screen). */
function PreviewCard({ theme, mode }: { theme: AccentTheme; mode: 'light' | 'dark' }) {
  const p = getPalette(theme, mode);
  const R = 30;
  const C = 2 * Math.PI * R;
  return (
    <View
      accessible
      role="img"
      accessibilityLabel={`${t('appearance.preview.title')}: ${t(`appearance.themes.${theme}`)}`}
      style={{ padding: space.lg }}
    >
      <View style={{
        backgroundColor: p.bg, borderRadius: radius.card, padding: space.lg, gap: space.md,
        borderWidth: 1, borderColor: p.border,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.lg }}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" aria-hidden>
          <Svg width={76} height={76} viewBox="0 0 76 76">
            <Circle cx={38} cy={38} r={R} stroke={p.track} strokeWidth={9} fill="none" />
            <Circle
              cx={38} cy={38} r={R} stroke={p.fastingRing} strokeWidth={9} fill="none" strokeLinecap="round"
              strokeDasharray={`${C * 0.72} ${C}`} transform="rotate(-90 38 38)"
            />
          </Svg>
          </View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text style={[type.caption, { color: p.textSecondary }]}>{t('appearance.preview.fasting')}</Text>
            <Text style={[type.subtitle, type.tabular, { color: p.text }]}>{t('appearance.preview.elapsed')}</Text>
            <View style={{ alignSelf: 'flex-start', backgroundColor: p.accentSoft, borderRadius: radius.chip, paddingHorizontal: space.md, paddingVertical: space.xs }}>
              <Text style={[type.micro, { color: p.accent, fontWeight: '700' }]}>{t('appearance.preview.chip')}</Text>
            </View>
          </View>
        </View>
        <View style={{ height: 40, borderRadius: radius.button, backgroundColor: p.accent, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={[type.label, { color: p.onAccent }]}>{t('appearance.preview.button')}</Text>
        </View>
      </View>
    </View>
  );
}
