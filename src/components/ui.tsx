import React from 'react';
import { Platform, Pressable, StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SafeAreaView } from 'react-native-safe-area-context';
import { hit, radius, space, type, useTheme } from '../theme';
import { useSettingsStore } from '../stores/settingsStore';

export function haptic(kind: 'light' | 'success' | 'warning' = 'light') {
  if (!useSettingsStore.getState().settings.haptics) return;
  // Web: navigator.vibrate is blocked (console error) until the user has interacted with the page.
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && !(navigator as { userActivation?: { hasBeenActive?: boolean } }).userActivation?.hasBeenActive) return;
  try {
    if (kind === 'light') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    else Haptics.notificationAsync(
      kind === 'success' ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
    );
  } catch {}
}

export function Screen({ children, style, edges }: {
  children: React.ReactNode; style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
}) {
  const { colors } = useTheme();
  return (
    <SafeAreaView role="main" edges={edges ?? ['top']} style={[{ flex: 1, backgroundColor: colors.bg }, style]}>
      {children}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text accessibilityRole="header" style={[type.title, { color: colors.text }, style]}>{children}</Text>;
}

export function Body({ children, style, secondary, numberOfLines }: {
  children: React.ReactNode; style?: StyleProp<TextStyle>; secondary?: boolean; numberOfLines?: number;
}) {
  const { colors } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[type.body, { color: secondary ? colors.textSecondary : colors.text }, style]}>
      {children}
    </Text>
  );
}

export function Caption({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { colors } = useTheme();
  return <Text style={[type.caption, { color: colors.textSecondary }, style]}>{children}</Text>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return (
    <View style={[{ backgroundColor: colors.surface, borderRadius: radius.card, padding: space.lg,
      borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border }, style]}>
      {children}
    </View>
  );
}

/** 56pt tall, 28pt radius primary button. One per screen. */
export function PrimaryButton({ label, onPress, disabled, variant = 'primary', style, accessibilityHint }: {
  label: string; onPress: () => void; disabled?: boolean;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; style?: StyleProp<ViewStyle>; accessibilityHint?: string;
}) {
  const { colors } = useTheme();
  // Disabled: neutral track fill + secondary label (no opacity hack, keeps the label legible).
  const bg = disabled ? (variant === 'ghost' ? 'transparent' : colors.track)
    : variant === 'primary' ? colors.accent : variant === 'danger' ? colors.danger
    : variant === 'secondary' ? colors.accentSoft : 'transparent';
  const fg = disabled ? colors.textSecondary
    : variant === 'primary' || variant === 'danger' ? colors.onAccent
    : variant === 'secondary' ? colors.accent : colors.textSecondary;
  return (
    <Pressable
      accessibilityRole="button" accessibilityLabel={label} accessibilityHint={accessibilityHint}
      aria-disabled={!!disabled} disabled={disabled}
      onPress={() => { haptic('light'); onPress(); }}
      style={({ pressed }) => [{
        height: hit.comfortable, minHeight: hit.comfortable, borderRadius: radius.button, backgroundColor: bg,
        alignItems: 'center', justifyContent: 'center', paddingHorizontal: space.xl,
        opacity: !disabled && pressed ? 0.88 : 1,
        transform: [{ scale: pressed && !disabled ? 0.98 : 1 }],
      }, style]}
    >
      <Text style={[type.bodyEmphasis, { color: fg }]} maxFontSizeMultiplier={1.3}>{label}</Text>
    </Pressable>
  );
}

export function Row({ label, value, onPress, left, right, destructive }: {
  label: string; value?: string; onPress?: () => void; left?: React.ReactNode; right?: React.ReactNode;
  destructive?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      disabled={!onPress} onPress={onPress} accessibilityRole={onPress ? 'button' : undefined}
      style={({ pressed }) => ({
        minHeight: hit.comfortable, flexDirection: 'row', alignItems: 'center', gap: space.md,
        paddingHorizontal: space.lg, opacity: pressed ? 0.7 : 1,
      })}
    >
      {left}
      <Text style={[type.body, { flex: 1, color: destructive ? colors.danger : colors.text }]}>{label}</Text>
      {value ? <Text style={[type.body, { color: colors.textSecondary }]}>{value}</Text> : null}
      {right}
    </Pressable>
  );
}

export const Separator = () => {
  const { colors } = useTheme();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: space.lg }} />;
};

/** The single toast. Polite live region only (no nested alert role). */
export function Toast({ message, actionLabel, onAction, bottom = space.xl }: {
  message: string; actionLabel?: string; onAction?: () => void; bottom?: number;
}) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute', left: space.lg, right: space.lg, bottom, minHeight: 48,
        borderRadius: radius.card, backgroundColor: colors.toastBg, paddingHorizontal: space.lg,
        paddingVertical: space.md, flexDirection: 'row', alignItems: 'center', gap: space.md,
      }}
    >
      <Text style={[type.body, { flex: 1, color: colors.toastFg }]}>{message}</Text>
      {actionLabel && onAction ? (
        <Pressable
          accessibilityRole="button" accessibilityLabel={actionLabel} onPress={onAction} hitSlop={8}
          style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', alignItems: 'center' }}
        >
          <Text style={[type.bodyEmphasis, { color: colors.toastFg, textDecorationLine: 'underline' }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
