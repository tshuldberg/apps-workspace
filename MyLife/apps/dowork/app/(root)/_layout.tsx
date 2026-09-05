import { Stack } from 'expo-router';
import { DatabaseProvider } from './providers/DatabaseProvider';
import { DoWorkCloudProvider } from './providers/DoWorkCloudProvider';
import { AppThemeProvider } from './providers/AppThemeProvider';
import { NotificationRouter } from './components/NotificationRouter';
import { DW_SURFACES } from './theme/tokens';

const BACKGROUND = DW_SURFACES.base;

export default function AppLayout() {
  return (
    <DatabaseProvider>
      <DoWorkCloudProvider>
        <AppThemeProvider>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: BACKGROUND },
                animation: 'slide_from_right',
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="auth-callback" />
              {/* Batch A: Workout flow */}
              <Stack.Screen name="builder" />
              <Stack.Screen name="session" />
              <Stack.Screen name="exercises" />
              <Stack.Screen name="exercise/[id]" />
              <Stack.Screen name="save-workout" />
              <Stack.Screen name="superset" />
              <Stack.Screen name="timer" />
              <Stack.Screen name="warmup" />
              {/* Batch B: Programs/plans */}
              <Stack.Screen name="programs" />
              <Stack.Screen name="program/[id]" />
              <Stack.Screen name="program/create" />
              <Stack.Screen name="plans" />
              <Stack.Screen name="onboarding" />
              {/* Batch C: Tools/calculators */}
              <Stack.Screen name="one-rm" />
              <Stack.Screen name="plate-loader" />
              <Stack.Screen name="main-exercises" />
              {/* Batch D: Tracking/analytics */}
              <Stack.Screen name="history" />
              <Stack.Screen name="photos" />
              <Stack.Screen name="measurements" />
              <Stack.Screen name="recordings" />
              <Stack.Screen name="monthly-report" />
              {/* Batch E: AI/recovery */}
              <Stack.Screen name="generate" />
              <Stack.Screen name="recovery" />
              <Stack.Screen name="body-map" />
              <Stack.Screen name="overload" />
              {/* Batch F: GPS */}
              <Stack.Screen
                name="gps"
                options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
              />
              {/* Batch G: Insights */}
              <Stack.Screen name="insights" />
              {/* Batch H: Social/Share */}
              <Stack.Screen name="social" />
              <Stack.Screen name="social-feed" />
              <Stack.Screen name="share-workout" />
              {/* P8: community thread + compliance */}
              <Stack.Screen name="post/[id]" />
              <Stack.Screen name="blocked-users" />
              {/* Plan 36 Phase 7: email + password sign-in (App Review demo accounts) */}
              <Stack.Screen name="account" />
              <Stack.Screen name="reset-password" />
              {/* Plan 36 Phase 2: voice-controlled signed playback */}
              <Stack.Screen
                name="player"
                options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
              />
              {/* Plan 36 Phase 3: trainer platform UI */}
              <Stack.Screen name="trainer/[handle]" />
              <Stack.Screen name="studio" />
              <Stack.Screen name="redeem-invite" />
              {/* Plan 36 Phase 4: coaching loop */}
              <Stack.Screen name="clients" />
              <Stack.Screen name="client-invite/index" />
              <Stack.Screen name="client-invite/[code]" />
              <Stack.Screen name="my-trainer" />
              <Stack.Screen name="form-check/[id]" />
              {/* Plan 36 Phase 5: monetization */}
              <Stack.Screen name="earnings" />
              {/* Plan 36 Phase 6: push prefs + deep-link video redirect */}
              <Stack.Screen name="notification-preferences" />
              <Stack.Screen
                name="video/[id]"
                options={{ presentation: 'transparentModal', animation: 'none' }}
              />
            </Stack>
            <NotificationRouter />
        </AppThemeProvider>
      </DoWorkCloudProvider>
    </DatabaseProvider>
  );
}
