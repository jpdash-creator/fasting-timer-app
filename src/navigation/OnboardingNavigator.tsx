import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useTheme } from '../theme';
import Welcome from '../app/(onboarding)/welcome';
import GoalStep from '../app/(onboarding)/goal';
import ExperienceStep from '../app/(onboarding)/experience';
import ScheduleStep from '../app/(onboarding)/schedule';
import SafetyStep from '../app/(onboarding)/safety';
import ProtocolStep from '../app/(onboarding)/protocol';
import RemindersStep from '../app/(onboarding)/reminders';
import PlanSummary from '../app/(onboarding)/plan-summary';
import type { OnboardingParamList } from './types';

const Stack = createNativeStackNavigator<OnboardingParamList>();

export default function OnboardingNavigator() {
  const { colors } = useTheme();
  return (
    <Stack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false, contentStyle: { backgroundColor: colors.bg }, animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Welcome" component={Welcome} />
      <Stack.Screen name="Goal" component={GoalStep} />
      <Stack.Screen name="Experience" component={ExperienceStep} />
      <Stack.Screen name="Schedule" component={ScheduleStep} />
      <Stack.Screen name="Safety" component={SafetyStep} />
      <Stack.Screen name="Protocol" component={ProtocolStep} />
      <Stack.Screen name="Reminders" component={RemindersStep} />
      <Stack.Screen name="PlanSummary" component={PlanSummary} />
    </Stack.Navigator>
  );
}
