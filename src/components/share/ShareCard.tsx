import React, { forwardRef } from 'react';
import { Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { t } from '../../lib/i18n';
import { lightColors, radius } from '../../theme';

export const CARD_W = 1080;
export const CARD_H = 1920;

export interface ShareCardProps {
  /** Rendered width in points; height follows the 9:16 ratio. All sizes scale from the 1080 design. */
  width: number;
  durationText: string;
  protocolName: string;
  streak: number;
  dateText: string;
  percent: number; // 0..1
  goalMet: boolean;
  showWatermark: boolean;
}

// Gap (eating window) at upper right, matching the app icon.
const GAP_CENTER = (-50 * Math.PI) / 180;
const GAP_HALF = (32 * Math.PI) / 180;
const polar = (cx: number, cy: number, r: number, a: number) => ({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
function arcPath(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  const large = to - from > Math.PI ? 1 : 0;
  return `M ${a.x} ${a.y} A ${r} ${r} 0 ${large} 1 ${b.x} ${b.y}`;
}

/** Mix a #RRGGBB colour toward black/white by `amt` (0..1). */
function mix(hex: string, to: 0 | 255, amt: number) {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * amt));
  return `#${ch.map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

// The card is a fixed brand image (same in light and dark app themes), so it reads the light palette.
const BRAND = lightColors.accent;
// Last stop lightened only 10 percent so white 40pt text stays >= 4.5:1.
const GRADIENT = [mix(BRAND, 0, 0.25), BRAND, mix(BRAND, 255, 0.1)] as const;
const WHITE = lightColors.onAccent;
const WHITE_SOFT = 'rgba(255,255,255,0.96)';
const WHITE_TRACK = 'rgba(255,255,255,0.22)';
const WHITE_CHIP = 'rgba(255,255,255,0.18)';

export const ShareCard = forwardRef<React.ComponentRef<typeof View>, ShareCardProps>(function ShareCard(
  { width, durationText, protocolName, streak, dateText, percent, goalMet, showWatermark }, ref,
) {
  const s = width / CARD_W;
  const height = CARD_H * s;
  const ringSize = 640 * s;
  const stroke = 56 * s;
  const R = (ringSize - stroke) / 2;
  const c = ringSize / 2;
  // Track spans the full circle minus the gap; progress fills the track proportionally.
  const start = GAP_CENTER + GAP_HALF;
  const end = GAP_CENTER - GAP_HALF + Math.PI * 2;
  const prog = start + (end - start) * Math.min(1, Math.max(0, percent));
  const streakText = streak > 0 ? t('share.streakCount', { count: streak }) : t('share.streakNone');
  const label = t('share.cardLabel', { duration: durationText, protocol: protocolName, streak: streakText });

  return (
    <View
      ref={ref} collapsable={false}
      accessible accessibilityRole="image" accessibilityLabel={label}
      style={{ width, height, overflow: 'hidden' }}
    >
      <LinearGradient
        colors={GRADIENT} start={{ x: 0.1, y: 0 }} end={{ x: 0.9, y: 1 }}
        style={{ flex: 1, paddingHorizontal: 90 * s, paddingTop: 150 * s, paddingBottom: 130 * s, alignItems: 'center' }}
      >
        {/* Brand */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 24 * s }}>
          <Svg width={72 * s} height={72 * s} viewBox="0 0 72 72">
            <Path d={arcPath(36, 36, 27, start, end)} stroke={WHITE} strokeWidth={9} strokeLinecap="round" fill="none" />
          </Svg>
          <Text style={{ color: WHITE, fontSize: 56 * s, fontWeight: '700', letterSpacing: 1 }}>{t('share.brand')}</Text>
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', width: '100%' }}>
          <Text style={{ color: WHITE_SOFT, fontSize: 48 * s, fontWeight: '600', marginBottom: 56 * s }}>
            {t('share.headline')}
          </Text>

          <View style={{ width: ringSize, height: ringSize, alignItems: 'center', justifyContent: 'center' }}>
            <Svg width={ringSize} height={ringSize} style={{ position: 'absolute' }}>
              <Path d={arcPath(c, c, R, start, end)} stroke={WHITE_TRACK} strokeWidth={stroke}
                strokeLinecap="round" fill="none" />
              {percent > 0.001 ? (
                <Path d={arcPath(c, c, R, start, prog)} stroke={WHITE} strokeWidth={stroke}
                  strokeLinecap="round" fill="none" />
              ) : null}
            </Svg>
            <Text style={{ color: WHITE, fontSize: 104 * s, fontWeight: '700', fontVariant: ['tabular-nums'], maxWidth: ringSize - 2 * stroke - 40 * s, textAlign: 'center' }}
              adjustsFontSizeToFit minimumFontScale={0.6} numberOfLines={1}>
              {durationText}
            </Text>
            <Text style={{ color: WHITE_SOFT, fontSize: 44 * s, fontWeight: '600', marginTop: 8 * s }}>
              {goalMet ? t('share.goalMet') : t('share.goalNotMet', { percent: Math.round(percent * 100) })}
            </Text>
          </View>

          <View style={{ marginTop: 90 * s, alignItems: 'center', gap: 28 * s }}>
            <View style={{ paddingHorizontal: 44 * s, paddingVertical: 20 * s, borderRadius: radius.chip,
              backgroundColor: WHITE_CHIP }}>
              <Text style={{ color: WHITE, fontSize: 52 * s, fontWeight: '700' }}>{protocolName}</Text>
            </View>
            <Text style={{ color: WHITE, fontSize: 60 * s, fontWeight: '700' }}>{streakText}</Text>
            <Text style={{ color: WHITE_SOFT, fontSize: 40 * s }}>{dateText}</Text>
          </View>
        </View>

        <Text style={{ color: WHITE_SOFT, fontSize: 40 * s, fontWeight: '600' }}>
          {showWatermark ? t('share.watermark') : t('share.tagline')}
        </Text>
      </LinearGradient>
    </View>
  );
});
