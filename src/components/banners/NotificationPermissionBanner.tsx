import React, { useCallback, useEffect, useState } from 'react';
import { AppState, Linking, Pressable, Text, View } from 'react-native';
import { Ionicons } from '../../platform/icons';
import { radius, space, type, useTheme } from '../../theme';
import { t } from '../../lib/i18n';
import { getPermissionStatus, rescheduleAll, type PermissionStatus } from '../../services/notifications';

/** Re-checks permission on mount and every time the app returns to the foreground (AC-10). */
export function useNotificationPermission(): PermissionStatus | null {
  const [status, setStatus] = useState<PermissionStatus | null>(null);
  const check = useCallback(async () => {
    const next = await getPermissionStatus();
    setStatus((prev) => {
      if (prev && prev !== 'granted' && next === 'granted') void rescheduleAll();
      return next;
    });
  }, []);
  useEffect(() => {
    void check();
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void check(); });
    return () => sub.remove();
  }, [check]);
  return status;
}

/** Shown on the Timer when notifications are denied. Disappears by itself once re-enabled. */
export function NotificationPermissionBanner() {
  const { colors } = useTheme();
  const status = useNotificationPermission();
  if (status !== 'denied') return null;
  return (
    <View
      accessible accessibilityRole="alert"
      accessibilityLabel={`${t('notifications.banner.title')}. ${t('notifications.banner.body')}`}
      style={{
        flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.md, padding: space.md,
        borderRadius: radius.card, backgroundColor: colors.accentSoft,
        borderWidth: 1, borderColor: colors.border,
      }}
    >
      <Ionicons name="notifications-off-outline" size={22} color={colors.accent} importantForAccessibility="no" />
      <View style={{ flex: 1, flexBasis: 200 }}>
        <Text style={[type.body, { color: colors.text, fontWeight: '600' }]}>{t('notifications.banner.title')}</Text>
        <Text style={[type.caption, { color: colors.textSecondary }]}>{t('notifications.banner.body')}</Text>
      </View>
      <Pressable
        accessibilityRole="button" accessibilityLabel={t('notifications.banner.open')}
        onPress={() => { Linking.openSettings().catch(() => {}); }}
        style={{ minHeight: 44, minWidth: 44, justifyContent: 'center', paddingHorizontal: space.sm }}
      >
        <Text style={[type.label, { color: colors.accent }]}>{t('notifications.banner.open')}</Text>
      </Pressable>
    </View>
  );
}
