import React, { useEffect, useRef } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { motion, ring } from '../../theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/**
 * The one progress ring. 0..1 arc drawn clockwise; children render in the centre slot.
 * - `gapAngle` (deg): opens a gap centred at the bottom (gauge look). 0 = full circle from 12 o'clock.
 * - `replayKey`: change it (e.g. on screen focus) to replay the 600 ms 0 -> target tween.
 * - `overtime`: goal reached treatment. Adds a thin inner arc in `overtimeColor` (no new hue).
 *   Pair with an `accentSoft` `fill` for the centre.
 * Live ticks (small deltas) advance linearly over 1 s so the arc never stutters.
 */
export function ProgressRing({
  size, stroke = ring.stroke, progress, color, track, reduceMotion, accessibilityLabel, children, fill,
  gapAngle = 0, replayKey, overtime = false, overtimeColor, accessibilityValueText,
}: {
  fill?: string; size: number; stroke?: number; progress: number; color: string; track: string;
  reduceMotion?: boolean; accessibilityLabel: string; children?: React.ReactNode;
  gapAngle?: number; replayKey?: number | string; overtime?: boolean; overtimeColor?: string;
  accessibilityValueText?: string;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const sweep = (360 - Math.max(0, gapAngle)) / 360;
  const arc = c * sweep;
  const rotate = gapAngle > 0 ? 90 + gapAngle / 2 : -90;
  const target = Math.max(0, Math.min(1, progress));

  const p = useSharedValue(0);
  const ov = useSharedValue(0);
  const lastKey = useRef(replayKey);

  useEffect(() => {
    if (reduceMotion) { p.value = target; lastKey.current = replayKey; return; }
    if (lastKey.current !== replayKey) {
      lastKey.current = replayKey;
      p.value = 0;
      p.value = withTiming(target, { duration: motion.ring, easing: Easing.out(Easing.cubic) });
    } else if (Math.abs(target - p.value) < 0.02) {
      p.value = withTiming(target, { duration: 1000, easing: Easing.linear });
    } else {
      p.value = withTiming(target, { duration: motion.ring, easing: Easing.out(Easing.cubic) });
    }
  }, [target, reduceMotion, replayKey, p]);

  useEffect(() => {
    const to = overtime ? 1 : 0;
    ov.value = reduceMotion ? to : withTiming(to, { duration: motion.base });
  }, [overtime, reduceMotion, ov]);

  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: arc * (1 - p.value) }));
  const overProps = useAnimatedProps(() => ({ strokeOpacity: ov.value }));

  const cx = size / 2;
  const innerStroke = ring.inner;
  const innerR = r - stroke / 2 - 2 - innerStroke / 2 - 1;
  const innerArc = 2 * Math.PI * innerR * sweep;

  return (
    <View
      accessible accessibilityRole="progressbar" accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(target * 100), text: accessibilityValueText }}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: `${rotate}deg` }] }}>
        {fill ? <Circle cx={cx} cy={cx} r={r - stroke / 2 - 2} fill={fill} /> : null}
        <Circle
          cx={cx} cy={cx} r={r} stroke={track} strokeWidth={stroke} fill="none"
          strokeLinecap={gapAngle > 0 ? 'round' : undefined} strokeDasharray={`${arc} ${c}`}
        />
        <AnimatedCircle
          cx={cx} cy={cx} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeLinecap="round" strokeDasharray={`${arc} ${c}`} animatedProps={animatedProps}
        />
        {overtimeColor || overtime ? (
          <AnimatedCircle
            cx={cx} cy={cx} r={innerR} stroke={overtimeColor ?? color} strokeWidth={innerStroke} fill="none"
            strokeLinecap="round" strokeDasharray={`${innerArc} ${2 * Math.PI * innerR}`} animatedProps={overProps}
          />
        ) : null}
      </Svg>
      <View style={{ width: size - stroke * 3, alignItems: 'center', justifyContent: 'center' }}>{children}</View>
    </View>
  );
}
