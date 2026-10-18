// Web: no local notification scheduling. Same API as notifications.ts so call sites need no branching.
export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';
export type NotifId =
  | 'fast_start' | 'window_closing' | 'halfway' | 'one_hour' | 'goal'
  | 'long_fast_check' | 'streak_risk';

export const CHANNEL_FASTING = 'fasting';
export const CHANNEL_TIPS = 'tips';

export async function ensureChannels(): Promise<void> {}
export async function getPermissionStatus(): Promise<PermissionStatus> { return 'unavailable'; }
export async function requestPermission(): Promise<PermissionStatus> { return 'unavailable'; }
export function planNow(): never[] { return []; }
export async function rescheduleAll(): Promise<void> {}
export async function cancelAll(): Promise<void> {}
export function initNotifications(): void {}
export function subscribeToNotificationResponses(): () => void { return () => {}; }
