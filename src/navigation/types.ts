import type { NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
  Timer: undefined;
  History: { date?: string } | undefined;
  Stats: undefined;
  Settings: undefined;
};
export type OnboardingParamList = {
  Welcome: undefined; Goal: undefined; Experience: undefined; Schedule: undefined;
  Safety: undefined; Protocol: undefined; Reminders: undefined; PlanSummary: undefined;
};
export type RootParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  Onboarding: NavigatorScreenParams<OnboardingParamList> | undefined;
  Paywall: { trigger?: string; feature?: string } | undefined;
  ProtocolPicker: undefined;
  FastEditor: { id?: string } | undefined;
  FastSummary: { id?: string } | undefined;
  LogWeight: { step?: string } | undefined;
  LogWater: undefined;
  StageInfo: undefined;
  ShareCard: { fastId?: string } | undefined;
};
