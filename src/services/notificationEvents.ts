// Notification tap handling shared by the foreground subscription (services/notifications.ts) and the
// background handler registered at the top level of index.js (notifee.onBackgroundEvent).
// Kept free of heavy imports so the headless background task stays cheap.
import { EventType, type Event } from '@notifee/react-native';
import { router } from '../router';
import { track } from '../lib/analytics';

const handled = new Set<string>();

/** Where a tap on a reminder lands. Tiny on purpose so the navigation target is changed in one place. */
function openTimer(): void {
  try { router.navigate('/'); } catch {}
}

export function handleNotificationPress(notification: { id?: string; data?: { [key: string]: string | object | number } } | undefined): void {
  if (!notification) return;
  const key = notification.id ?? '';
  if (key && handled.has(key)) return;
  if (key) handled.add(key);
  const id = typeof notification.data?.id === 'string' ? notification.data.id : undefined;
  track('notification_opened', { id });
  openTimer();
}

/** Single entry for notifee foreground and background events. */
export async function handleNotificationEvent(event: Event): Promise<void> {
  if (event.type === EventType.PRESS) handleNotificationPress(event.detail.notification);
}
