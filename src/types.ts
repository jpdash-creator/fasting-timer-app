export type ProtocolId =
  | '12_12' | '14_10' | '16_8' | '18_6' | '20_4' | 'OMAD' | '5_2' | '36H'
  | `custom_${string}`;

export interface Protocol {
  id: ProtocolId;
  name: string;
  fastingMinutes: number;
  eatingMinutes: number;
  isCustom: boolean;
  color: string;
  weeklyPattern?: { fastingDays: number[] }; // ISO weekday numbers (1=Mon)
  proOnly?: boolean;
}

export interface Fast {
  id: string;
  protocolId: ProtocolId;
  startAt: number;
  endAt: number | null;
  targetMinutes: number;
  goalMet: boolean | null;
  mood: 1 | 2 | 3 | 4 | 5 | null;
  note: string;
  stagesReached: string[];
  createdAt: number;
  updatedAt: number;
}

export interface WeightEntry { id: string; at: number; kg: number; note?: string }
export interface WaterEntry { id: string; at: number; ml: number }

export interface Settings {
  onboardingDone: boolean;
  safetyAcknowledged: boolean;
  goal: 'lose' | 'maintain' | 'focus' | 'routine';
  experience: 'new' | 'some' | 'experienced';
  activeProtocolId: ProtocolId;
  customProtocols: Protocol[];
  units: { weight: 'kg' | 'lb'; volume: 'ml' | 'oz' };
  theme: 'system' | 'light' | 'dark';
  /** Accent palette. Pro-only: non-Pro always renders 'teal' but the saved value is kept. */
  accentTheme: 'teal' | 'ocean' | 'dusk' | 'sunrise';
  haptics: boolean;
  language: string;
  reminders: {
    fastStart: boolean;
    fastEnd: boolean;
    halfway: boolean;
    oneHourLeft: boolean;
    windowClosing: boolean;
    windowClosingOffsetMin: number;
    quietHours: { enabled: boolean; from: string; to: string };
  };
  firstMeal: string; // "12:00" from onboarding
  lastMeal: string; // "20:00"
  waterGoalMl: number;
  goalWeightKg: number | null;
  autoStartNextFast: boolean;
  paywallMode: 'hard' | 'soft';
  firstLaunchAt: number;
}

export interface PurchaseState {
  isPro: boolean;
  source: 'subscription' | 'lifetime' | 'trial' | 'none';
  expiresAt: number | null;
  billingIssue: boolean;
  lastCheckedAt: number;
}

export interface StageDef {
  id: 'fed' | 'early' | 'fatburn' | 'ketosis' | 'deep';
  startHour: number;
}
