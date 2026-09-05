import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ErrorBoundary } from './(root)/components/ErrorBoundary';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <ErrorBoundary>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(root)" />
        </Stack>
      </ErrorBoundary>
    </>
  );
}
