import { Stack } from 'expo-router';
import { colors } from '@mylife/ui';

/**
 * Onboarding stack. Ordered flow: pledge -> goal -> kit -> first-action.
 * Each screen uses router.replace to advance so the stack stays at depth 1
 * and the user cannot swipe back into onboarding once past a step.
 */
export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="pledge" />
      <Stack.Screen name="goal" />
      <Stack.Screen name="kit" />
    </Stack>
  );
}
