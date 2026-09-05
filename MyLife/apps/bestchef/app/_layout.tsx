// Intl polyfills must load before any i18n code runs (plan 33 Phase 3.5).
import './(root)/i18n/intl-polyfills';
// Crash reporting initializes at module load so failures during the provider
// tree mount are captured. Fully inert unless EXPO_PUBLIC_BESTCHEF_SENTRY_DSN
// is set (audit H14, privacy posture documented in observability/sentry.ts).
import { initSentry } from './(root)/observability/sentry';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { JAKARTA_FONTS, RECIPES_ACCENT } from '@mylife/bestchef';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './(root)/components/ErrorBoundary';

initSentry();

export default function RootLayout() {
  // Screens reference the JAKARTA_FONTS family names throughout; without this
  // registration iOS silently falls back to the system font (the hub twin
  // loads the same weights in apps/mobile/app/(recipes)/_layout.tsx).
  //
  // Plus Jakarta Sans is Latin-only and intentionally the only font bundled
  // here (audit L4). Non-Latin scripts (ja/zh/ko/hi/th/ar/he) are not loaded
  // as assets; they resolve to iOS system faces (Hiragino Sans, PingFang,
  // Apple SD Gothic Neo, Kohinoor Devanagari, Thonburi, Geeza Pro, Arial
  // Hebrew) via app/(root)/i18n/typography.ts, exposed to screens through
  // useI18n().fontFamily()/fontStyle() rather than a bundled asset.
  const [fontsLoaded, fontError] = useFonts({
    [JAKARTA_FONTS.regular]: PlusJakartaSans_400Regular,
    [JAKARTA_FONTS.medium]: PlusJakartaSans_500Medium,
    [JAKARTA_FONTS.semiBold]: PlusJakartaSans_600SemiBold,
    [JAKARTA_FONTS.bold]: PlusJakartaSans_700Bold,
    [JAKARTA_FONTS.extraBold]: PlusJakartaSans_800ExtraBold,
  });

  // Fonts are bundled assets (disk load, near-instant). If loading errors,
  // render anyway with system-font fallback rather than blocking startup.
  if (!fontsLoaded && !fontError) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#131318' }}>
        <ActivityIndicator color={RECIPES_ACCENT} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(root)" />
        </Stack>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
