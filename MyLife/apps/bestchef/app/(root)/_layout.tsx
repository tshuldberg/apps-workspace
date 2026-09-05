import { Stack } from 'expo-router';
import { AddedToastHost } from '@mylife/bestchef/ui';
import { DatabaseProvider } from './providers/DatabaseProvider';
import { BestChefProvider } from './providers/BestChefProvider';
import { BestChefCloudProvider } from './providers/BestChefCloudProvider';
import { AppThemeProvider } from './providers/AppThemeProvider';
import { I18nProvider } from './i18n/I18nProvider';
import { LanguageOnboardingGate } from './i18n/LanguageOnboardingGate';
import { PushNotificationRouter } from './components/PushNotificationRouter';

const BACKGROUND = '#131318';

export default function AppLayout() {
  return (
    <DatabaseProvider>
      <I18nProvider>
        <BestChefCloudProvider>
          <BestChefProvider>
            <AppThemeProvider>
              <LanguageOnboardingGate>
                <Stack
                  screenOptions={{
                    headerShown: false,
                    contentStyle: { backgroundColor: BACKGROUND },
                    animation: 'slide_from_right',
                  }}
                >
                  <Stack.Screen name="(tabs)" />
                  <Stack.Screen name="dish/[id]" />
                  <Stack.Screen name="recipe/[id]" />
                  <Stack.Screen name="recipe/[id]/reviews" />
                  <Stack.Screen name="cook-mode/[id]" />
                  <Stack.Screen name="video/[id]" />
                  <Stack.Screen
                    name="submission/[id]/vote"
                    options={{
                      presentation: 'fullScreenModal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen
                    name="reviewed-vote/[submissionId]"
                    options={{
                      presentation: 'modal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                  <Stack.Screen name="recipes/new" />
                  <Stack.Screen name="saved-recipe/[id]" />
                  <Stack.Screen name="grocery" />
                  <Stack.Screen name="pantry" />
                  <Stack.Screen name="kitchen-receipt" />
                  <Stack.Screen name="kitchen-receipt-review" />
                  <Stack.Screen name="kitchen-photo" />
                  <Stack.Screen name="kitchen-photo-review" />
                  <Stack.Screen name="expiration-photo" />
                  <Stack.Screen name="auth-callback" />
                  <Stack.Screen name="soon" />
                  <Stack.Screen name="submit" options={{ presentation: 'modal' }} />
                  <Stack.Screen name="notifications" options={{ presentation: 'modal', animation: 'slide_from_bottom' }} />
                  <Stack.Screen name="saved" />
                  <Stack.Screen name="chef/[id]" />
                  <Stack.Screen name="profile/following" />
                  <Stack.Screen name="profile/followers" />
                  <Stack.Screen name="comments/[submissionId]" />
                  <Stack.Screen name="creator-program" />
                  <Stack.Screen name="edit-profile" />
                  <Stack.Screen name="challenges" />
                  <Stack.Screen name="challenge/[id]" />
                  <Stack.Screen name="theme-browser" />
                  <Stack.Screen name="theme-editor" />
                  <Stack.Screen name="pinwheel-mission-control" />
                  <Stack.Screen
                    name="discover"
                    options={{ presentation: 'modal' }}
                  />
                  <Stack.Screen
                    name="feed"
                    options={{
                      presentation: 'fullScreenModal',
                      animation: 'slide_from_bottom',
                    }}
                  />
                </Stack>
                <PushNotificationRouter />
                <AddedToastHost />
              </LanguageOnboardingGate>
            </AppThemeProvider>
          </BestChefProvider>
        </BestChefCloudProvider>
      </I18nProvider>
    </DatabaseProvider>
  );
}
