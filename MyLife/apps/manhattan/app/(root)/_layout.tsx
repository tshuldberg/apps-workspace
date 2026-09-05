import { useEffect } from 'react';
import { Redirect, Stack } from 'expo-router';
import { useSegments, useRouter } from 'expo-router';
import { useShareIntentContext } from 'expo-share-intent';
import { ModuleThemeProvider } from '@mylife/ui';
import { DatabaseProvider, useManhattanDatabase } from './providers/DatabaseProvider';
import { AppThemeProvider } from './providers/AppThemeProvider';
import { ManhattanCloudProvider } from './providers/ManhattanCloudProvider';
import { ManhattanEntitlementsProvider } from './providers/ManhattanEntitlementsProvider';
import { ManhattanLockGuard } from './components/ManhattanLockGuard';
import { UnlockGate } from './components/UnlockGate';
import { getSetting } from '@mylife/manhattan';

const BACKGROUND = '#131318';

// Routes an incoming OS share (link or text) to the confirm screen.
function ShareIntentWatcher() {
  const router = useRouter();
  const { hasShareIntent, shareIntent, resetShareIntent } = useShareIntentContext();

  useEffect(() => {
    if (!hasShareIntent) return;
    const text = shareIntent.text ?? '';
    const url = shareIntent.webUrl ?? '';
    if (text || url) {
      router.push({ pathname: '/(root)/share/confirm', params: { text, url } });
    }
    resetShareIntent();
  }, [hasShareIntent, shareIntent, resetShareIntent, router]);

  return null;
}

function OnboardingGate({ children }: { children: React.ReactNode }) {
  const db = useManhattanDatabase();
  const segments = useSegments();

  // Never redirect when already on the pledge screen.
  const onPledgeRoute = segments.includes('onboarding');

  if (!onPledgeRoute && getSetting(db, 'onboardingComplete') !== 'true') {
    return <Redirect href="/(root)/onboarding/pledge" />;
  }

  return <>{children}</>;
}

export default function AppLayout() {
  return (
    <DatabaseProvider>
      {/* Shared @mylife/ui primitives (Button, Card) read their accent from
          this context; without it they fall back to the generic blue
          colors.accent. Production eval, cross-cutting UI finding. */}
      <ModuleThemeProvider module="manhattan">
      <AppThemeProvider>
        <ManhattanCloudProvider>
          <ManhattanEntitlementsProvider>
            <ShareIntentWatcher />
            <UnlockGate>
              <ManhattanLockGuard>
                <OnboardingGate>
                  <Stack
                    screenOptions={{
                      headerShown: false,
                      contentStyle: { backgroundColor: BACKGROUND },
                      animation: 'slide_from_right',
                    }}
                  >
                    <Stack.Screen name="(tabs)" />
                    <Stack.Screen name="onboarding/pledge" />
                    <Stack.Screen name="pin/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="pin/[id]" />
                    <Stack.Screen name="plan/new" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="plan/[id]" />
                    <Stack.Screen name="share/confirm" options={{ presentation: 'modal' }} />
                    <Stack.Screen name="settings/data-sync" options={{ presentation: 'modal' }} />
                  </Stack>
                </OnboardingGate>
              </ManhattanLockGuard>
            </UnlockGate>
          </ManhattanEntitlementsProvider>
        </ManhattanCloudProvider>
      </AppThemeProvider>
      </ModuleThemeProvider>
    </DatabaseProvider>
  );
}
