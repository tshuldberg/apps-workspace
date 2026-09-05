import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import {
  getSetting,
  NU_ACCENT,
  NU_FONT_BOLD,
  NU_FONT_EXTRABOLD,
  NU_FONT_MEDIUM,
  NU_FONT_REGULAR,
  NU_FONT_SEMIBOLD,
  NU_SURFACES,
} from '@mylife/nutrition';
import { colors } from '@mylife/ui';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';
import { useDatabase } from '../../components/DatabaseProvider';

export default function NutritionLayout() {
  const db = useDatabase();
  const router = useRouter();
  const segments = useSegments();
  const [checkedOnboarding, setCheckedOnboarding] = useState(false);
  const [fontsLoaded] = useFonts({
    [NU_FONT_REGULAR]: PlusJakartaSans_400Regular,
    [NU_FONT_MEDIUM]: PlusJakartaSans_500Medium,
    [NU_FONT_SEMIBOLD]: PlusJakartaSans_600SemiBold,
    [NU_FONT_BOLD]: PlusJakartaSans_700Bold,
    [NU_FONT_EXTRABOLD]: PlusJakartaSans_800ExtraBold,
  });

  useEffect(() => {
    const onboardingCompleted = getSetting(db, 'onboarding_completed') === '1';
    const isOnboardingRoute = segments[segments.length - 1] === 'onboarding';

    if (!onboardingCompleted && !isOnboardingRoute) {
      router.replace('/(nutrition)/onboarding' as never);
    }

    setCheckedOnboarding(true);
  }, [db, router, segments]);

  if (!fontsLoaded || !checkedOnboarding) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: NU_SURFACES.base,
        }}
      >
        <ActivityIndicator color={NU_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyNutrition">
      <ModuleLockGuard
        moduleId="nutrition"
        moduleName="MyNutrition"
        moduleIcon={'\u{1F96C}'}
        accentColor={NU_ACCENT}
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: NU_SURFACES.base },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: NU_FONT_SEMIBOLD },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="barcode" options={{ title: 'Scan Barcode' }} />
          <Stack.Screen name="dashboard" options={{ title: 'Dashboard' }} />
          <Stack.Screen name="export" options={{ title: 'Export' }} />
          <Stack.Screen name="food/[id]" options={{ title: 'Food Details' }} />
          <Stack.Screen name="goals" options={{ title: 'Goals' }} />
          <Stack.Screen name="log" options={{ title: 'Log Food' }} />
          <Stack.Screen name="notes" options={{ title: 'Food Notes' }} />
          <Stack.Screen name="onboarding" options={{ title: 'Setup', headerShown: false }} />
          <Stack.Screen name="photo" options={{ title: 'Photo Log' }} />
          <Stack.Screen name="report" options={{ title: 'Daily Report' }} />
          <Stack.Screen name="restaurant" options={{ title: 'Restaurants' }} />
          <Stack.Screen name="scan" options={{ title: 'Scan Barcode' }} />
          <Stack.Screen name="water" options={{ title: 'Water' }} />
        </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
