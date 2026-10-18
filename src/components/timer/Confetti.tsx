import React, { useEffect, useMemo } from 'react';
import { View } from 'react-native';
import { motion, radius, useTheme } from '../../theme';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

function Particle({ dx, dy, rot, color, size }: { dx: number; dy: number; rot: number; color: string; size: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: motion.celebrate, easing: Easing.out(Easing.quad) });
  }, [p]);
  const style = useAnimatedStyle(() => ({
    opacity: 1 - p.value * p.value,
    transform: [
      { translateX: dx * p.value },
      { translateY: dy * p.value + 220 * p.value * p.value },
      { rotate: `${rot * p.value}deg` },
    ],
  }));
  return (
    <Animated.View
      style={[{ position: 'absolute', width: size, height: size * 0.5, backgroundColor: color, borderRadius: radius.bar / 2 }, style]}
    />
  );
}

/** One-shot celebratory burst (<=1.5s). Mount to play. Decorative only; callers skip it under reduce motion. */
export function Confetti({ count = 26 }: { count?: number }) {
  const { colors } = useTheme();
  const palette = [colors.accent, colors.eatingRing, colors.accentSoft, colors.success];
  const parts = useMemo(
    () => Array.from({ length: count }, (_, i) => {
      const a = (Math.PI * 2 * i) / count + Math.random() * 0.4;
      const v = 90 + Math.random() * 110;
      return {
        key: i, dx: Math.cos(a) * v, dy: Math.sin(a) * v - 120, rot: (Math.random() - 0.5) * 720,
        color: palette[i % palette.length], size: 8 + Math.random() * 6,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [count, colors],
  );
  return (
    <View
      pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}
    >
      {parts.map(({ key, ...p }) => <Particle key={key} {...p} />)}
    </View>
  );
}
