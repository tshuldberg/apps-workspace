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
import { MK_ACCENT, MK_FONTS } from '@mylife/market';
import { ModuleErrorBoundary } from '../../components/ModuleErrorBoundary';
import { ModuleLockGuard } from '../../components/ModuleLockGuard';

export default function MarketLayout() {
  const [fontsLoaded] = useFonts({
    [MK_FONTS.regular]: PlusJakartaSans_400Regular,
    [MK_FONTS.medium]: PlusJakartaSans_500Medium,
    [MK_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [MK_FONTS.bold]: PlusJakartaSans_700Bold,
    [MK_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
    [MK_FONTS.black]: PlusJakartaSans_800ExtraBold,
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
        <ActivityIndicator color={MK_ACCENT} />
      </View>
    );
  }

  return (
    <ModuleErrorBoundary moduleName="MyMarket">
      <ModuleLockGuard
        moduleId="market"
        moduleName="MyMarket"
        moduleIcon={'\u{1F3EA}'}
        accentColor={MK_ACCENT}
      >
        <Stack
          screenOptions={{
            contentStyle: { backgroundColor: colors.background },
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            headerTitleStyle: { fontFamily: MK_FONTS.semiBold },
            headerShadowVisible: false,
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="[id]" options={{ headerShown: false }} />
          <Stack.Screen name="checkout" options={{ headerShown: false }} />
          <Stack.Screen
            name="conversation/[id]"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="dispute/[id]" options={{ title: 'Dispute' }} />
          <Stack.Screen name="disputes" options={{ title: 'Disputes' }} />
          <Stack.Screen name="offers" options={{ title: 'Offers' }} />
          <Stack.Screen name="report" options={{ headerShown: false }} />
          <Stack.Screen name="reviews" options={{ headerShown: false }} />
          <Stack.Screen
            name="saved-searches"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="saved" options={{ title: 'Saved' }} />
          <Stack.Screen name="search" options={{ title: 'Search' }} />
          <Stack.Screen
            name="seller-profile"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="services" options={{ headerShown: false }} />
          <Stack.Screen
            name="service-detail"
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="create-service-listing"
            options={{ headerShown: false }}
          />
          <Stack.Screen name="settings" options={{ headerShown: false }} />
          <Stack.Screen name="tracking" options={{ title: 'Tracking' }} />
          <Stack.Screen name="tracking/[id]" options={{ title: 'Tracking' }} />
          <Stack.Screen
            name="verification"
            options={{ title: 'Verification' }}
          />
          <Stack.Screen name="watchlist" options={{ headerShown: false }} />
        </Stack>
      </ModuleLockGuard>
    </ModuleErrorBoundary>
  );
}
