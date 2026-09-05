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
import { colors } from '@mylife/ui';
import { CYCLE_ACCENT, CYCLE_FONTS } from '@mylife/cycle';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';

export default function CycleLayout() {
  const [fontsLoaded] = useFonts({
    [CYCLE_FONTS.regular]: PlusJakartaSans_400Regular,
    [CYCLE_FONTS.medium]: PlusJakartaSans_500Medium,
    [CYCLE_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [CYCLE_FONTS.bold]: PlusJakartaSans_700Bold,
    [CYCLE_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
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
        <ActivityIndicator color={CYCLE_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyCycle">
      <ModuleLockGuard
        moduleId="cycle"
        moduleName="MyCycle"
        moduleIcon={'\uD83C\uDF19'}
        accentColor={CYCLE_ACCENT}
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: CYCLE_FONTS.semiBold },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen
            name="log-day"
            options={{ headerShown: false, presentation: 'modal' }}
          />
          <Stack.Screen name="community" options={{ title: 'Community' }} />
          <Stack.Screen name="pregnancy" options={{ title: 'Pregnancy' }} />
          <Stack.Screen
            name="pregnancy-log"
            options={{ title: 'Pregnancy Log', presentation: 'modal' }}
          />
          <Stack.Screen name="temperature" options={{ title: 'Temperature' }} />
          <Stack.Screen name="sharing" options={{ title: 'Sharing' }} />
          <Stack.Screen
            name="predictions-detail"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="symptom-analysis"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="cycle-analytics"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="insights-detail"
            options={{ title: 'Cycle Insights' }}
          />
          <Stack.Screen name="compare" options={{ title: 'Compare Cycles' }} />
        </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
