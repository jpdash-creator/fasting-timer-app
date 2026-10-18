import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import TabsNavigator from './TabsNavigator';
import OnboardingNavigator from './OnboardingNavigator';
import Paywall from '../app/paywall';
import ProtocolPicker from '../app/protocol-picker';
import FastEditor from '../app/fast-editor';
import FastSummary from '../app/fast-summary';
import LogWeight from '../app/log-weight';
import LogWater from '../app/log-water';
import StageInfo from '../app/stage-info';
import ShareCard from '../app/share-card';
import type { RootParamList } from './types';

const Stack = createNativeStackNavigator<RootParamList>();

export interface RootNavigatorProps {
  initialRouteName: 'Tabs' | 'Onboarding' | 'Paywall';
  /** Params for the initial Paywall route (hard paywall re-shown on launch). */
  initialPaywallParams?: RootParamList['Paywall'];
}

export default function RootNavigator({ initialRouteName, initialPaywallParams }: RootNavigatorProps) {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}
    >
      <Stack.Screen name="Tabs" component={TabsNavigator} />
      <Stack.Screen name="Onboarding" component={OnboardingNavigator} options={{ gestureEnabled: false }} />
      <Stack.Screen
        name="Paywall" component={Paywall} initialParams={initialPaywallParams}
        options={{ presentation: 'modal', gestureEnabled: false }}
      />
      <Stack.Screen name="ProtocolPicker" component={ProtocolPicker} options={{ presentation: 'modal' }} />
      <Stack.Screen name="FastEditor" component={FastEditor} options={{ presentation: 'modal' }} />
      <Stack.Screen name="FastSummary" component={FastSummary} options={{ presentation: 'modal' }} />
      <Stack.Screen name="LogWeight" component={LogWeight} options={{ presentation: 'modal' }} />
      <Stack.Screen name="LogWater" component={LogWater} options={{ presentation: 'modal' }} />
      <Stack.Screen name="StageInfo" component={StageInfo} options={{ presentation: 'modal' }} />
      <Stack.Screen name="ShareCard" component={ShareCard} options={{ presentation: 'modal' }} />
    </Stack.Navigator>
  );
}
