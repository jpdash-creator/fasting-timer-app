// Native: react-native-linear-gradient with a readonly-friendly colors prop. Web variant: LinearGradient.web.tsx.
import React from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import NativeLinearGradient from 'react-native-linear-gradient';

export interface LinearGradientProps {
  colors: readonly string[];
  start?: { x: number; y: number };
  end?: { x: number; y: number };
  locations?: readonly number[];
  style?: StyleProp<ViewStyle>;
  children?: React.ReactNode;
}

export function LinearGradient({ colors, locations, children, ...rest }: LinearGradientProps) {
  return (
    <NativeLinearGradient colors={[...colors]} locations={locations ? [...locations] : undefined} {...rest}>
      {children}
    </NativeLinearGradient>
  );
}
