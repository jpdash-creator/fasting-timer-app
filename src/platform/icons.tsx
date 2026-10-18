// Icon component. Native: Ionicons v8 from @react-native-vector-icons/ionicons. The /static entry is used
// because the default entry loads fonts dynamically through expo-font (not present in bare RN); the font file
// is embedded by the library's Gradle task (Android) and UIAppFonts (iOS). Web variant: icons.web.tsx.
import React from 'react';
import type { TextProps } from 'react-native';
import IoniconsFont, { type IoniconsIconName } from '@react-native-vector-icons/ionicons/static';

export type IconName = IoniconsIconName;

export interface IconProps extends Omit<TextProps, 'children'> {
  name: IconName;
  size?: number;
  color?: string;
}

export function Ionicons({ name, size = 24, color, ...rest }: IconProps) {
  return <IoniconsFont name={name} size={size} color={color} {...rest} />;
}

/** No-op on native (fonts are bundled); the web variant injects the @font-face rule. */
export function ensureIconFont(): void {}
