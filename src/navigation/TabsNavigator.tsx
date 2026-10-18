import { Platform, View } from 'react-native';
import { BottomTabBar, createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons, type IconName } from '../platform/icons';
import { icon as iconSize, space, useTheme } from '../theme';
import { t } from '../lib/i18n';
import TimerScreen from '../app/(tabs)/index';
import HistoryScreen from '../app/(tabs)/history';
import StatsScreen from '../app/(tabs)/stats';
import SettingsScreen from '../app/(tabs)/settings';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

const icon = (name: IconName, focusedName: IconName) =>
  ({ color, focused }: { color: string; focused: boolean }) => (
    <Ionicons name={focused ? focusedName : name} size={iconSize.lg} color={color} />
  );

export default function TabsNavigator() {
  const { colors } = useTheme();
  return (
    <Tab.Navigator
      initialRouteName="Timer"
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
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tab.Screen name="Timer" component={TimerScreen} options={{ title: t('tabs.timer'), tabBarIcon: icon('timer-outline', 'timer') }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: t('tabs.history'), tabBarIcon: icon('calendar-outline', 'calendar') }} />
      <Tab.Screen name="Stats" component={StatsScreen} options={{ title: t('tabs.stats'), tabBarIcon: icon('stats-chart-outline', 'stats-chart') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('tabs.settings'), tabBarIcon: icon('settings-outline', 'settings') }} />
    </Tab.Navigator>
  );
}
