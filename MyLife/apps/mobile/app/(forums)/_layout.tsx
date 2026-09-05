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
import { FR_ACCENT, FR_FONTS } from '@mylife/forums';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';

export default function ForumsLayout() {
  const [fontsLoaded] = useFonts({
    [FR_FONTS.regular]: PlusJakartaSans_400Regular,
    [FR_FONTS.medium]: PlusJakartaSans_500Medium,
    [FR_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [FR_FONTS.bold]: PlusJakartaSans_700Bold,
    [FR_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
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
        <ActivityIndicator color={FR_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyForums">
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerStyle: { backgroundColor: colors.background },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: FR_FONTS.semiBold },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="user-profile" options={{ title: 'Profile' }} />
        <Stack.Screen name="edit-profile" options={{ title: 'Edit Profile' }} />
        <Stack.Screen name="activity-feed" options={{ title: 'Activity' }} />
        <Stack.Screen name="messages" options={{ headerShown: false }} />
        <Stack.Screen name="conversation" options={{ headerShown: false }} />
        <Stack.Screen name="new-message" options={{ headerShown: false }} />
        <Stack.Screen name="thread-detail" options={{ title: 'Thread' }} />
        <Stack.Screen name="create-thread" options={{ title: 'Create Thread' }} />
        <Stack.Screen name="create-community" options={{ title: 'Create Community' }} />
        <Stack.Screen name="community-detail" options={{ title: 'Community' }} />
        <Stack.Screen name="community-settings" options={{ title: 'Community Settings' }} />
        <Stack.Screen name="community-health" options={{ title: 'Community Health' }} />
        <Stack.Screen name="mod-log" options={{ title: 'Moderation Log' }} />
      </Stack>
    </ModuleErrorBoundary>
  );
}
