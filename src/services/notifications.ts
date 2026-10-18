import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useFastStore } from '../stores/fastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { isProNow } from '../stores/purchaseStore';
import { planNotifications, type NotifId, type PlannedNotification } from '../lib/notificationPlan';
import { t } from '../lib/i18n';
import { track } from '../lib/analytics';
import { maybeAutoStartNextFast } from '../lib/timerAutoStart';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const isWeb = Platform.OS === 'web';
export const CHANNEL_FASTING = 'fasting';
export const CHANNEL_TIPS = 'tips';

export type { NotifId };

/* ---------- permission ---------- */

export async function ensureChannels(): Promise<void> {
  if (isWeb || Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(CHANNEL_FASTING, {
      name: t('notifications.channels.fasting'),
      importance: Notifications.AndroidImportance.HIGH,
    });
    await Notifications.setNotificationChannelAsync(CHANNEL_TIPS, {
      name: t('notifications.channels.tips'),
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  } catch {}
}

export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (isWeb) return 'unavailable';
  try {
    const res = await Notifications.getPermissionsAsync();
    if (res.granted) return 'granted';
    return res.status === 'undetermined' ? 'undetermined' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** Shows the system prompt (if not yet decided). Reschedules when granted. */
export async function requestPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'unavailable';
  try {
    await ensureChannels(); // Android 13+: channel must exist before the prompt
    const res = await Notifications.requestPermissionsAsync();
    const status: PermissionStatus = res.granted ? 'granted' : res.status === 'undetermined' ? 'undetermined' : 'denied';
    track('reminder_permission', { granted: status === 'granted' });
    if (status === 'granted') void rescheduleAll();
    return status;
  } catch {
    return 'unavailable';
  }
}

/* ---------- scheduling ---------- */

/** Reads the live stores and runs the pure planner (lib/notificationPlan.ts). */
export function planNow(now = Date.now()): PlannedNotification[] {
  return planNotifications({
    now,
    settings: useSettingsStore.getState().settings,
    fasts: useFastStore.getState().fasts,
    activeFastId: useFastStore.getState().activeFastId,
    pro: isProNow(now),
  });
}

async function run(): Promise<void> {
  if (isWeb) return;
  try {
    if ((await getPermissionStatus()) !== 'granted') return;
    await ensureChannels();
    await Notifications.cancelAllScheduledNotificationsAsync();
    for (const n of planNow()) {
      await Notifications.scheduleNotificationAsync({
        identifier: `${n.id}_${n.at}`,
        content: {
          title: t('notifications.title'),
          body: t(n.key, n.params),
          sound: true,
          data: { id: n.id, route: '/' },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(n.at),
          channelId: CHANNEL_FASTING,
        },
      });
    }
  } catch (e) {
    if (__DEV__) console.warn('[notifications] reschedule failed', e);
  }
}

let chain: Promise<void> = Promise.resolve();
/** Cancels everything and schedules only what still applies. Serialized; safe to spam. */
export function rescheduleAll(): Promise<void> {
  chain = chain.then(run, run);
  return chain;
}

export async function cancelAll(): Promise<void> {
  if (isWeb) return;
  try { await Notifications.cancelAllScheduledNotificationsAsync(); } catch {}
}

/* ---------- handlers (mounted once from _layout) ---------- */

let handlerSet = false;
export function initNotifications(): void {
  if (isWeb || handlerSet) return;
  handlerSet = true;
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
    }),
  });
  void ensureChannels();
  // BR-08: create the auto-started fast on launch and whenever the app returns to the foreground.
  maybeAutoStartNextFast();
  AppState.addEventListener('change', (st) => { if (st === 'active') maybeAutoStartNextFast(); });
}

const handledResponses = new Set<string>();
function handleResponse(res: Notifications.NotificationResponse | null) {
  if (!res) return;
  const key = res.notification.request.identifier + ':' + res.notification.date;
  if (handledResponses.has(key)) return;
  handledResponses.add(key);
  const data = res.notification.request.content.data as { id?: string } | undefined;
  track('notification_opened', { id: data?.id });
  try { router.navigate('/'); } catch {}
}

/** Subscribe to taps on notifications (warm + cold start). Returns an unsubscribe fn. */
export function subscribeToNotificationResponses(): () => void {
  if (isWeb) return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
  Notifications.getLastNotificationResponseAsync().then(handleResponse).catch(() => {});
  return () => sub.remove();
}
