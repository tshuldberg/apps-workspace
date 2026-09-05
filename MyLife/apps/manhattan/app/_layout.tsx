import { Stack } from 'expo-router';
import { ShareIntentProvider } from 'expo-share-intent';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './(root)/components/ErrorBoundary';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Without this provider, useShareIntentContext falls back to the
          library default (hasShareIntent always false) and OS shares never
          reach the confirm screen. Production eval finding F8. */}
      <ShareIntentProvider>
        <StatusBar style="auto" />
        <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(root)" />
          </Stack>
        </ErrorBoundary>
      </ShareIntentProvider>
    </GestureHandlerRootView>
  );
}
