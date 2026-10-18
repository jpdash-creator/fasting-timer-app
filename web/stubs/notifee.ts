// Safety net: native-only. src/platform/notifications.web.ts is the real web implementation.
const noop = async () => undefined;
const notifee = {
  requestPermission: async () => ({ authorizationStatus: 0, android: {} }),
  getNotificationSettings: async () => ({ authorizationStatus: 0, android: {} }),
  createChannel: async () => 'web',
  createTriggerNotification: noop,
  displayNotification: noop,
  cancelTriggerNotifications: noop,
  cancelNotification: noop,
  cancelAllNotifications: noop,
  getTriggerNotificationIds: async () => [] as string[],
  getInitialNotification: async () => null,
  openAlarmPermissionSettings: noop,
  onForegroundEvent: () => () => undefined,
  onBackgroundEvent: () => undefined,
};
export default notifee;
export const TriggerType = { TIMESTAMP: 0, INTERVAL: 1 } as const;
export const AndroidImportance = { DEFAULT: 3, HIGH: 4, LOW: 2, MIN: 1, NONE: 0 } as const;
export const AndroidNotificationSetting = { NOT_SUPPORTED: 0, DISABLED: 1, ENABLED: 2 } as const;
export const AuthorizationStatus = { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2 } as const;
export const EventType = { UNKNOWN: -1, DISMISSED: 0, PRESS: 1, ACTION_PRESS: 2 } as const;
