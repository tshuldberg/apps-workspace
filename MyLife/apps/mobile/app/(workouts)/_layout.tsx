import { Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { useFonts } from 'expo-font';
import { WK_ACCENT, WK_FONTS } from '@mylife/workouts';
import { colors } from '@mylife/ui';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';

export default function WorkoutsLayout() {
  const [fontsLoaded] = useFonts({
    [WK_FONTS.regular]: PlusJakartaSans_400Regular,
    [WK_FONTS.medium]: PlusJakartaSans_500Medium,
    [WK_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [WK_FONTS.bold]: PlusJakartaSans_700Bold,
    [WK_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.background,
        }}
      >
        <ActivityIndicator color={WK_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyWorkouts">
      <ModuleLockGuard
        moduleId="workouts"
        moduleName="MyWorkouts"
        moduleIcon={'\u{1F4AA}'}
        accentColor={WK_ACCENT}
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: WK_FONTS.semiBold },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="exercises" options={{ title: 'Exercises' }} />
          <Stack.Screen name="exercise/[id]" options={{ title: 'Exercise Detail' }} />
          <Stack.Screen name="builder" options={{ title: 'Workout Builder' }} />
          <Stack.Screen name="session" options={{ title: 'Workout Session' }} />
          <Stack.Screen name="history" options={{ title: 'History' }} />
          <Stack.Screen name="programs" options={{ title: 'Programs' }} />
          <Stack.Screen name="program/[id]" options={{ title: 'Program' }} />
          <Stack.Screen name="program/create" options={{ title: 'Create Program' }} />
          <Stack.Screen name="body-map" options={{ title: 'Recovery Map' }} />
          <Stack.Screen name="measurements" options={{ title: 'Measurements' }} />
          <Stack.Screen name="photos" options={{ title: 'Progress Photos' }} />
          <Stack.Screen name="one-rm" options={{ title: '1RM Calculator' }} />
          <Stack.Screen name="warmup" options={{ title: 'Warmup Calculator' }} />
          <Stack.Screen name="plate-loader" options={{ title: 'Plate Loader' }} />
          <Stack.Screen name="ai-workout" options={{ title: 'Generate Workout' }} />
          <Stack.Screen name="overload" options={{ title: 'Progressive Overload' }} />
          <Stack.Screen name="timer" options={{ title: 'Rest Timer' }} />
          <Stack.Screen name="superset" options={{ title: 'Superset Builder' }} />
          <Stack.Screen name="gps" options={{ title: 'Run' }} />
          <Stack.Screen name="watch" options={{ title: 'Apple Watch' }} />
          <Stack.Screen name="social" options={{ title: 'Feed' }} />
          <Stack.Screen name="share" options={{ title: 'Share Workout' }} />
          <Stack.Screen name="recovery" options={{ title: 'Recovery' }} />
          <Stack.Screen name="insights" options={{ title: 'Insights' }} />
          <Stack.Screen name="plans" options={{ title: 'Workout Plans' }} />
          <Stack.Screen name="recordings" options={{ title: 'Form Recordings' }} />
          <Stack.Screen name="upload-video" options={{ title: 'Upload Demo' }} />
          <Stack.Screen name="generate" options={{ title: 'Generate Workout' }} />
          <Stack.Screen name="monthly-report" options={{ title: 'Monthly Report' }} />
          <Stack.Screen name="onboarding" options={{ title: 'Setup' }} />
          <Stack.Screen name="main-exercises" options={{ title: 'Main Exercises' }} />
          <Stack.Screen name="save-workout" options={{ title: 'Save Workout' }} />
          <Stack.Screen name="social-feed" options={{ title: 'Social Feed' }} />
          <Stack.Screen name="share-workout" options={{ title: 'Share Workout' }} />
        </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
