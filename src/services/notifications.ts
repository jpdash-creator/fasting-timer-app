import { AppState, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, {
  AlarmType, AndroidImportance, AndroidNotificationSetting, AuthorizationStatus, TriggerType,
  type TimestampTrigger,
} from '@notifee/react-native';
import { useFastStore } from '../stores/fastStore';
import { useSettingsStore } from '../stores/settingsStore';
import { isProNow } from '../stores/purchaseStore';
import { MAX_SCHEDULED, planNotifications, type NotifId, type PlannedNotification } from '../lib/notificationPlan';
import { t } from '../lib/i18n';
import { track } from '../lib/analytics';
import { maybeAutoStartNextFast } from '../lib/timerAutoStart';
import { handleNotificationEvent, handleNotificationPress } from './notificationEvents';

export type PermissionStatus = 'granted' | 'denied' | 'undetermined' | 'unavailable';

const isWeb = Platform.OS === 'web'; // native file; defensive (the web build resolves notifications.web.ts)
export const CHANNEL_FASTING = 'fasting';
export const CHANNEL_TIPS = 'tips';
const SMALL_ICON = 'ic_stat_notification';
const ACCENT = '#2E7D6B';
/** Notifee documents a 50 timestamp-trigger ceiling on Android; iOS keeps 64 (MAX_SCHEDULED). */
const MAX_ANDROID = 50;
/** Android cannot tell "never asked" from "denied"; remember that we have prompted. */
const ASKED_KEY = 'fastline.notifications.asked';

export type { NotifId };

/* ---------- permission ---------- */

export async function ensureChannels(): Promise<void> {
  if (isWeb || Platform.OS !== 'android') return;
  try {
    await notifee.createChannel({
      id: CHANNEL_FASTING,
      name: t('notifications.channels.fasting'),
      importance: AndroidImportance.HIGH,
    });
    await notifee.createChannel({
      id: CHANNEL_TIPS,
      name: t('notifications.channels.tips'),
      importance: AndroidImportance.DEFAULT,
    });
  } catch {}
}

async function wasAsked(): Promise<boolean> {
  try { return (await AsyncStorage.getItem(ASKED_KEY)) === '1'; } catch { return false; }
}

function mapStatus(s: AuthorizationStatus, asked: boolean): PermissionStatus {
  if (s === AuthorizationStatus.AUTHORIZED || s === AuthorizationStatus.PROVISIONAL) return 'granted';
  if (s === AuthorizationStatus.NOT_DETERMINED) return 'undetermined';
  // DENIED. On Android 13+ that is also the state before the first prompt.
  return Platform.OS === 'android' && !asked ? 'undetermined' : 'denied';
}

export async function getPermissionStatus(): Promise<PermissionStatus> {
  if (isWeb) return 'unavailable';
  try {
    const settings = await notifee.getNotificationSettings();
    return mapStatus(settings.authorizationStatus, await wasAsked());
  } catch {
    return 'unavailable';
  }
}

/**
 * Android 12+: exact alarms are a special access the user grants in system settings. Without it notifee
 * still schedules, but the trigger may fire late. Opens that screen (once per request) when it is off.
 */
async function offerExactAlarmAccess(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const s = await notifee.getNotificationSettings();
    if (s.android.alarm === AndroidNotificationSetting.DISABLED) await notifee.openAlarmPermissionSettings();
  } catch {}
}

/** Shows the system prompt (if not yet decided). Reschedules when granted. */
export async function requestPermission(): Promise<PermissionStatus> {
  if (isWeb) return 'unavailable';
  try {
    await ensureChannels(); // Android 13+: channel must exist before the prompt
    const res = await notifee.requestPermission();
    try { await AsyncStorage.setItem(ASKED_KEY, '1'); } catch {}
    const status = mapStatus(res.authorizationStatus, true);
    track('reminder_permission', { granted: status === 'granted' });
    if (status === 'granted') {
      void rescheduleAll();
      await offerExactAlarmAccess();
    }
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
    await notifee.cancelTriggerNotifications();
    const cap = Platform.OS === 'android' ? MAX_ANDROID : MAX_SCHEDULED;
    const now = Date.now();
    const planned = planNow(now).filter((n) => n.at > now + 1000).slice(0, cap);
    for (const n of planned) {
      const trigger: TimestampTrigger = {
        type: TriggerType.TIMESTAMP,
        timestamp: n.at,
        alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
      };
      await notifee.createTriggerNotification(
        {
          id: `${n.id}_${n.at}`,
          title: t('notifications.title'),
          body: t(n.key, n.params),
          data: { id: n.id, route: '/' },
          android: {
            channelId: CHANNEL_FASTING,
            smallIcon: SMALL_ICON,
            color: ACCENT,
            pressAction: { id: 'default' },
          },
          ios: { sound: 'default' },
        },
        trigger,
      );
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
  try { await notifee.cancelTriggerNotifications(); } catch {}
}

/* ---------- handlers (mounted once from the app root) ---------- */

let handlerSet = false;
export function initNotifications(): void {
  if (isWeb || handlerSet) return;
  handlerSet = true;
  // Foreground display needs no handler: notifee shows trigger notifications itself.
  void ensureChannels();
  // BR-08: create the auto-started fast on launch and whenever the app returns to the foreground.
  maybeAutoStartNextFast();
  AppState.addEventListener('change', (st) => { if (st === 'active') maybeAutoStartNextFast(); });
}

/** Subscribe to taps on notifications (warm + cold start). Returns an unsubscribe fn. */
export function subscribeToNotificationResponses(): () => void {
  if (isWeb) return () => {};
  const unsub = notifee.onForegroundEvent((event) => { void handleNotificationEvent(event); });
  notifee.getInitialNotification()
    .then((initial) => { if (initial) handleNotificationPress(initial.notification); })
    .catch(() => {});
  return unsub;
}
