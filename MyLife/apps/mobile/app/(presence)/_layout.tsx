import React from 'react';
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
import { PR_ACCENT, PR_FONTS } from '@mylife/presence';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';

export default function PresenceLayout() {
  const [fontsLoaded] = useFonts({
    [PR_FONTS.regular]: PlusJakartaSans_400Regular,
    [PR_FONTS.medium]: PlusJakartaSans_500Medium,
    [PR_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [PR_FONTS.bold]: PlusJakartaSans_700Bold,
    [PR_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
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
        <ActivityIndicator color={PR_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyPresence">
      <ModuleLockGuard
        moduleId="presence"
        moduleName="MyPresence"
        moduleIcon={'\u{1F9D8}'}
        accentColor={PR_ACCENT}
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: PR_FONTS.semiBold },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="hub" options={{ title: 'Discover', headerShown: false }} />
          <Stack.Screen name="intentions" options={{ title: 'App Intentions' }} />
          <Stack.Screen name="intention-prompt" options={{ title: 'Intention Prompt' }} />
          <Stack.Screen name="session-active" options={{ title: 'Focus Session', headerShown: false }} />
          <Stack.Screen name="session-complete" options={{ title: 'Session Complete', headerShown: false }} />
          <Stack.Screen name="scheduled" options={{ title: 'Scheduled Sessions' }} />
          <Stack.Screen name="accountability" options={{ title: 'Accountability' }} />
          <Stack.Screen name="rewards" options={{ title: 'Rewards' }} />
          <Stack.Screen name="commitment" options={{ title: 'Commitment' }} />
          <Stack.Screen name="breathing-pause" options={{ title: 'Breathing Pause', headerShown: false }} />
          <Stack.Screen name="reflection" options={{ title: 'Quick Check-In' }} />
          <Stack.Screen name="badges" options={{ title: 'Badges', headerShown: false }} />
          <Stack.Screen name="insights" options={{ title: 'Insights', headerShown: false }} />
          <Stack.Screen name="report" options={{ title: 'Daily Report' }} />
        </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
