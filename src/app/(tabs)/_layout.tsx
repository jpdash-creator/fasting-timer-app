import { Platform, View } from 'react-native';
import { Tabs } from 'expo-router';
import { BottomTabBar } from 'expo-router/build/layouts/Tabs';
import { Ionicons } from '@expo/vector-icons';
import { icon as iconSize, space, useTheme } from '../../theme';
import { t } from '../../lib/i18n';

type IconName = React.ComponentProps<typeof Ionicons>['name'];
const icon = (name: IconName, focused: IconName) =>
  ({ color, focused: f }: { color: any; focused: boolean }) => (
    <Ionicons name={f ? focused : name} size={iconSize.lg} color={color} />
  );

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      // Wrap the tab bar in a navigation landmark (axe `region`).
      tabBar={(props) => (
        <View role="navigation" aria-label={t('tabs.a11yLabel')}>
          <BottomTabBar {...props} />
        </View>
      )}
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface, borderTopColor: colors.border,
          // Web default bar is a fixed 49px: icon + 16px label line clip. Give it room.
          ...(Platform.OS === 'web' ? { height: 68, paddingBottom: 8 } : null),
        },
        // Avoid clipped label descenders on web (default label line box is ~10px tall).
        tabBarLabelStyle: { fontSize: 12, lineHeight: 16, fontWeight: '600' },
        tabBarItemStyle: { paddingTop: space.xs },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: t('tabs.timer'), tabBarIcon: icon('timer-outline', 'timer') }} />
      <Tabs.Screen name="history" options={{ title: t('tabs.history'), tabBarIcon: icon('calendar-outline', 'calendar') }} />
      <Tabs.Screen name="stats" options={{ title: t('tabs.stats'), tabBarIcon: icon('stats-chart-outline', 'stats-chart') }} />
      <Tabs.Screen name="settings" options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tabs>
  );
}


