// Web: a View whose background is a CSS linear-gradient, with the angle derived from start/end the way
// react-native-linear-gradient interprets them (fractions of the box, so non-square boxes skew the angle).
import React, { useState } from 'react';
import { View, type LayoutChangeEvent, type StyleProp, type ViewStyle } from 'react-native';

export interface LinearGradientProps {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: readonly number[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function LinearGradient({
  colors, start = { x: 0.5, y: 0 }, end = { x: 0.5, y: 1 }, locations, style, children,
}: LinearGradientProps) {
  const [size, setSize] = useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width !== size.w || height !== size.h) setSize({ w: width || 1, h: height || 1 });
  };
  const dx = (end.x - start.x) * size.w;
  const dy = (end.y - start.y) * size.h;
  // CSS angle: 0deg points up, increasing clockwise.
  const angle = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  const stops = colors
    .map((c, i) => (locations && locations[i] !== undefined ? `${c} ${Math.round(locations[i] * 100)}%` : c))
    .join(', ');
  const backgroundImage = `linear-gradient(${angle.toFixed(2)}deg, ${stops})`;
  return (
    <View onLayout={onLayout} style={[style, { backgroundImage } as unknown as ViewStyle]}>
      {children}
    </View>
  );
}
