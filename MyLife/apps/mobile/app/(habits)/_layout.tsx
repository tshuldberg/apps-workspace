import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import {
  countHabits,
  getSetting,
  HB_ACCENT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
} from '@mylife/habits';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { useDatabase } from '../../components/DatabaseProvider';

export default function HabitsLayout() {
  const db = useDatabase();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [fontsLoaded] = useFonts({
    [HB_FONTS.regular]: PlusJakartaSans_400Regular,
    [HB_FONTS.medium]: PlusJakartaSans_500Medium,
    [HB_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [HB_FONTS.bold]: PlusJakartaSans_700Bold,
    [HB_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    try {
      const onboardingDone = getSetting(db, 'onboarding_complete');
      const habitCount = countHabits(db);
      if (onboardingDone !== 'true' && habitCount === 0) {
        router.replace('/(habits)/onboarding');
      }
    } catch (err) {
      console.error('[MyHabits] onboarding check failed', err);
    } finally {
      setChecked(true);
    }
    // Intentionally exclude `router` from deps so this onboarding check
    // runs exactly once per mount. Including it causes an infinite render
    // loop because router.replace mutates the router instance, which
    // re-fires the effect and re-replaces the route.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db]);

  if (!fontsLoaded || !checked) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={HB_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyHabits">
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: HB_SURFACES.base },
          headerStyle: { backgroundColor: HB_SURFACES.base },
          headerTintColor: HB_TEXT,
          headerTitleStyle: { fontFamily: HB_FONTS.semiBold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen
          name="(tabs)"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="add-habit"
          options={{ headerShown: false, presentation: 'modal' }}
        />
        <Stack.Screen
          name="[id]"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="areas"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="badge-gallery"
          options={{ title: 'Badges' }}
        />
        <Stack.Screen
          name="craving-insights"
          options={{ title: 'Craving Insights' }}
        />
        <Stack.Screen
          name="cycle"
          options={{ title: 'Cycle Tracking' }}
        />
        <Stack.Screen
          name="focus-analytics"
          options={{ title: 'Focus Analytics' }}
        />
        <Stack.Screen
          name="focus-timer"
          options={{ title: 'Focus Timer', headerShown: false }}
        />
        <Stack.Screen
          name="healthkit"
          options={{ title: 'HealthKit' }}
        />
        <Stack.Screen
          name="locations"
          options={{ title: 'Location Reminders' }}
        />
        <Stack.Screen
          name="log-craving"
          options={{ title: 'Log Craving' }}
        />
        <Stack.Screen
          name="onboarding"
          options={{ title: 'Onboarding', headerShown: false }}
        />
        <Stack.Screen
          name="export"
          options={{ title: 'Export Data' }}
        />
        <Stack.Screen
          name="pet-detail"
          options={{ title: 'Pet Companion' }}
        />
        <Stack.Screen
          name="program-detail"
          options={{ title: 'Program' }}
        />
        <Stack.Screen
          name="programs"
          options={{ title: 'Programs' }}
        />
        <Stack.Screen
          name="rpg"
          options={{ title: 'RPG Progression' }}
        />
        <Stack.Screen
          name="sobriety-clock"
          options={{ title: 'Sobriety Clock' }}
        />
        <Stack.Screen
          name="stacking"
          options={{ title: 'Habit Stacking' }}
        />
        <Stack.Screen
          name="siri"
          options={{ title: 'Siri Shortcuts' }}
        />
        <Stack.Screen
          name="time-reports"
          options={{ title: 'Time Reports' }}
        />
        <Stack.Screen
          name="templates"
          options={{ headerShown: false }}
        />
      </Stack>
    </ModuleErrorBoundary>
  );
}

const styles = {
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_SURFACES.base,
  },
} as const;
