// react-native-haptic-feedback wrapper. Callers (components/ui.tsx haptic()) check settings.haptics first.
import { trigger } from 'react-native-haptic-feedback';

export type HapticKind = 'light' | 'success' | 'warning';

const TYPE = {
  light: 'impactLight',
  success: 'notificationSuccess',
  warning: 'notificationWarning',
} as const;

export function triggerHaptic(kind: HapticKind = 'light'): void {
  try {
    trigger(TYPE[kind], { enableVibrateFallback: true, ignoreAndroidSystemSettings: false });
  } catch {}
}
