import { Redirect } from 'expo-router';

/**
 * Cycle tracking has moved to the dedicated Cycle module.
 * Redirect any navigation to the cycle tab.
 */
export default function HabitsCycleRedirect() {
  return <Redirect href="/(cycle)" />;
}
