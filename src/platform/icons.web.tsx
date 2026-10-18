// Web icons: renders the Ionicons glyph from the TTF through @font-face (Vite serves the font as an asset).
// web/main.tsx must call ensureIconFont() once before rendering (it injects the @font-face rule); the
// `iconFontCss` string is also exported for build-time injection into index.html if preferred.
import React from 'react';
import { Text, type TextProps } from 'react-native';
import glyphMap from '@react-native-vector-icons/ionicons/glyphmaps/Ionicons.json';
import iconFontUrl from '@react-native-vector-icons/ionicons/fonts/Ionicons.ttf';

export type IconName = keyof typeof glyphMap;

export interface IconProps extends Omit<TextProps, 'children'> {
  name: IconName;
  size?: number;
  color?: string;
}

const FAMILY = 'Ionicons';

export const iconFontCss = `@font-face{font-family:'${FAMILY}';src:url('${iconFontUrl}') format('truetype');font-display:block;}`;

let injected = false;
export function ensureIconFont(): void {
  if (injected || typeof document === 'undefined') return;
  injected = true;
  const style = document.createElement('style');
  style.setAttribute('data-icon-font', FAMILY);
  style.textContent = iconFontCss;
  document.head.appendChild(style);
}

export function Ionicons({ name, size = 24, color, style, ...rest }: IconProps) {
  ensureIconFont();
  const code = (glyphMap as Record<string, number>)[name];
  const glyph = code === undefined ? '?' : String.fromCodePoint(code);
  return (
    <Text
      selectable={false}
      {...rest}
      style={[
        { fontFamily: FAMILY, fontSize: size, color, fontWeight: 'normal', fontStyle: 'normal', lineHeight: size, width: size, textAlign: 'center' },
        style,
      ]}
    >
      {glyph}
    </Text>
  );
}
