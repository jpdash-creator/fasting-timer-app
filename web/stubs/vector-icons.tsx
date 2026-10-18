// Safety-net replacement for @react-native-vector-icons/* on web. The real component is
// src/platform/icons.web.tsx (@font-face). This renders an empty glyph box so layout still works.
import { Text, type TextProps } from 'react-native';

type Props = TextProps & { name?: string; size?: number; color?: string };
function Icon({ size = 12, color, style, ...rest }: Props) {
  return <Text {...rest} aria-hidden style={[{ width: size, height: size, fontSize: size, color }, style]} />;
}
Icon.glyphMap = {} as Record<string, number>;
export default Icon;
export const Ionicons = Icon;
