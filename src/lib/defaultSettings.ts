import type { Settings } from '../types';
import { isAccentTheme } from './themePalettes';

/**
 * Spec 4.1 PAYWALL_MODE. Default 'soft'. Override per build with EXPO_PUBLIC_PAYWALL_MODE=hard|soft
 * (EAS env). It is a build/remote flag, not a user setting, so it is re-applied on every launch
 * instead of being read back from storage.
 */
export const PAYWALL_MODE: Settings['paywallMode'] =
  process.env.EXPO_PUBLIC_PAYWALL_MODE === 'hard' ? 'hard' : 'soft';

export const defaultSettings: Settings = {
  onboardingDone: false,
  safetyAcknowledged: false,
  goal: 'routine',
  experience: 'new',
  activeProtocolId: '16_8',
  customProtocols: [],
  units: { weight: 'kg', volume: 'ml' },
  theme: 'system',
  accentTheme: 'teal',
  haptics: true,
  language: '',
  reminders: {
    fastStart: true, fastEnd: true, halfway: true, oneHourLeft: true, windowClosing: true,
    windowClosingOffsetMin: 30,
    quietHours: { enabled: false, from: '22:00', to: '07:00' },
  },
  firstMeal: '12:00',
  lastMeal: '20:00',
  waterGoalMl: 2000,
  goalWeightKg: null,
  autoStartNextFast: false,
  paywallMode: PAYWALL_MODE,
  firstLaunchAt: Date.now(),
};

export function mergeSettings(saved: Partial<Settings> | undefined): Settings {
  const d = defaultSettings;
  const m: Partial<Settings> = saved ?? {};
  return {
    ...d,
    ...m,
    units: { ...d.units, ...m.units },
    reminders: {
      ...d.reminders,
      ...m.reminders,
      quietHours: { ...d.reminders.quietHours, ...m.reminders?.quietHours },
    },
    customProtocols: Array.isArray(m.customProtocols) ? m.customProtocols : d.customProtocols,
    accentTheme: isAccentTheme(m.accentTheme) ? m.accentTheme : d.accentTheme,
    paywallMode: PAYWALL_MODE,
  };
}
