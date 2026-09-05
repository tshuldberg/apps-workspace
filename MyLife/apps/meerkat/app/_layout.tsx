import { Stack } from 'expo-router';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ErrorBoundary } from './(root)/components/ErrorBoundary';
import { ShareIntakeProvider } from './(root)/providers/ShareIntakeWatcher';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* OS-share provider (Plan 20, Phase 9). A no-op in Expo Go (the native
          module is absent); in a dev/EAS build it feeds shared items to the
          ShareIntakeWatcher mounted inside (root). */}
      <ShareIntakeProvider>
        <ErrorBoundary>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(root)" />
          </Stack>
        </ErrorBoundary>
      </ShareIntakeProvider>
    </GestureHandlerRootView>
  );
}
