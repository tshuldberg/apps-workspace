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
import { MD_ACCENT, MD_FONTS, MD_SURFACES } from '@mylife/meds/ui';
import { colors } from '@mylife/ui';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';

export default function MedsLayout() {
  const [fontsLoaded] = useFonts({
    [MD_FONTS.regular]: PlusJakartaSans_400Regular,
    [MD_FONTS.medium]: PlusJakartaSans_500Medium,
    [MD_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [MD_FONTS.bold]: PlusJakartaSans_700Bold,
    [MD_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  if (!fontsLoaded) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: MD_SURFACES.base,
        }}
      >
        <ActivityIndicator color={MD_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyMeds">
      <ModuleLockGuard
        moduleId="meds"
        moduleName="MyMeds"
        moduleIcon={'💊'}
        accentColor={MD_ACCENT}
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: MD_SURFACES.base },
            headerStyle: { backgroundColor: MD_SURFACES.base },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: MD_FONTS.semiBold },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="add-med" options={{ title: 'Add Medication' }} />
          <Stack.Screen name="history" options={{ title: 'Dose History' }} />
          <Stack.Screen name="mood" options={{ title: 'Mood Trends' }} />
          <Stack.Screen name="mood-check-in" options={{ title: 'Mood Check-In' }} />
          <Stack.Screen name="log-bp" options={{ title: 'Log Blood Pressure' }} />
          <Stack.Screen name="bp-history" options={{ title: 'BP History' }} />
          <Stack.Screen name="bp-trends" options={{ title: 'BP Trends' }} />
          <Stack.Screen name="log-glucose" options={{ title: 'Log Glucose' }} />
          <Stack.Screen name="glucose-history" options={{ title: 'Glucose History' }} />
          <Stack.Screen name="log-insulin" options={{ title: 'Log Insulin' }} />
          <Stack.Screen name="insulin-history" options={{ title: 'Insulin History' }} />
          <Stack.Screen name="interactions" options={{ title: 'Interactions' }} />
          <Stack.Screen name="refills" options={{ title: 'Refills' }} />
          <Stack.Screen name="adherence" options={{ title: 'Adherence' }} />
          <Stack.Screen name="wellness" options={{ title: 'Wellness' }} />
          <Stack.Screen name="reports" options={{ title: 'Clinical Reports' }} />
          <Stack.Screen name="caregivers" options={{ title: 'Caregivers' }} />
          <Stack.Screen name="fodmap" options={{ title: 'FODMAP Tracker' }} />
          <Stack.Screen name="pain-map" options={{ title: 'Pain Map' }} />
          <Stack.Screen name="cgm" options={{ title: 'CGM Dashboard' }} />
          <Stack.Screen name="weather" options={{ title: 'Weather Correlation' }} />
          <Stack.Screen name="a1c" options={{ title: 'A1c Dashboard' }} />
          <Stack.Screen name="export" options={{ title: 'Export Data' }} />
          <Stack.Screen name="appointments" options={{ title: 'Appointments' }} />
          <Stack.Screen name="contacts" options={{ title: 'Healthcare Contacts' }} />
          <Stack.Screen name="diary" options={{ title: 'Medication Diary' }} />
          <Stack.Screen
            name="notification-setup"
            options={{ title: 'Notification Setup' }}
          />
          <Stack.Screen
            name="notification-settings"
            options={{ title: 'Notification Settings' }}
          />
          <Stack.Screen name="home-style" options={{ title: 'Customize Dashboard' }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="passcode-lock" options={{ headerShown: false }} />
        </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
