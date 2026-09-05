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
import { ST_ACCENT, ST_FONTS, ST_SURFACES } from '@mylife/stars';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';

export default function StarsLayout() {
  const [fontsLoaded] = useFonts({
    [ST_FONTS.regular]: PlusJakartaSans_400Regular,
    [ST_FONTS.medium]: PlusJakartaSans_500Medium,
    [ST_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [ST_FONTS.bold]: PlusJakartaSans_700Bold,
    [ST_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: ST_SURFACES.base,
        }}
      >
        <ActivityIndicator color={ST_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyStars">
      <ModuleLockGuard
        moduleId="stars"
        moduleName="MyStars"
        moduleIcon={'⭐'}
        accentColor={colors.modules.stars}
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: ST_SURFACES.base },
            headerStyle: { backgroundColor: ST_SURFACES.base },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: ST_FONTS.semiBold },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-profile" options={{ title: 'Add Profile' }} />
          <Stack.Screen name="birth-chart" options={{ title: 'Birth Chart' }} />
          <Stack.Screen
            name="compatibility-history"
            options={{ title: 'Past Comparisons' }}
          />
          <Stack.Screen name="compatibility" options={{ title: 'Compatibility' }} />
          <Stack.Screen name="daily-reading" options={{ title: 'Daily Reading' }} />
          <Stack.Screen name="friends" options={{ title: 'Friends' }} />
          <Stack.Screen name="journal-compose" options={{ title: 'New Entry' }} />
          <Stack.Screen
            name="journal-entry/[id]"
            options={{ title: 'Journal Entry' }}
          />
          <Stack.Screen name="moon-calendar" options={{ title: 'Moon Calendar' }} />
          <Stack.Screen name="profile/[id]" options={{ title: 'Profile' }} />
          <Stack.Screen name="progressions" options={{ title: 'Progressions' }} />
          <Stack.Screen
            name="readings-history"
            options={{ title: 'Past Readings' }}
          />
          <Stack.Screen
            name="retrograde-dashboard"
            options={{ title: 'Retrogrades' }}
          />
          <Stack.Screen name="solar-return" options={{ title: 'Solar Return' }} />
          <Stack.Screen name="tarot-card" options={{ title: 'Card of the Day' }} />
          <Stack.Screen name="tarot-reading" options={{ title: 'Reading' }} />
          <Stack.Screen
            name="transit-calendar"
            options={{ title: 'Transit Calendar' }}
          />
          <Stack.Screen
            name="transit-history"
            options={{ title: 'Transit History' }}
          />
          <Stack.Screen
            name="transit-timeline"
            options={{ title: 'Transit Timeline' }}
          />
          <Stack.Screen
            name="zodiac-events"
            options={{ title: 'Zodiac Events' }}
          />
        </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
