// Safety-net replacement for react-native-linear-gradient on web: CSS linear-gradient via a View.
import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

export interface LinearGradientProps extends ViewProps {
  colors: readonly string[];
  start?: { x: number; y: number } | [number, number];
  end?: { x: number; y: number } | [number, number];
  locations?: readonly number[];
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

const pt = (p: LinearGradientProps['start'], d: [number, number]): [number, number] =>
  !p ? d : Array.isArray(p) ? [p[0], p[1]] : [p.x, p.y];

export default function LinearGradient({ colors, start, end, locations, style, children, ...rest }: LinearGradientProps) {
  const [sx, sy] = pt(start, [0.5, 0]);
  const [ex, ey] = pt(end, [0.5, 1]);
  const angle = (Math.atan2(ey - sy, ex - sx) * 180) / Math.PI + 90;
  const stops = colors.map((c, i) => (locations?.[i] != null ? `${c} ${locations[i]! * 100}%` : c)).join(', ');
  const bg = { backgroundImage: `linear-gradient(${angle}deg, ${stops})` } as unknown as ViewStyle;
  return (
    <View {...rest} style={[style, bg]}>
      {children}
    </View>
  );
}
export { LinearGradient };
