import { Stack } from 'expo-router';
import { tokens } from './theme/tokens';
import { DatabaseProvider } from './providers/DatabaseProvider';
import { AuthProvider } from './providers/AuthProvider';
import { CloudProvider } from './providers/CloudProvider';
import { IdentityProvider } from './providers/IdentityProvider';
import { TermsGateProvider } from './providers/TermsGateProvider';
import { SubscriptionProvider } from './providers/SubscriptionProvider';
import { PremiumGate } from './components/PremiumGate';

export default function RootGroupLayout() {
  return (
    <DatabaseProvider>
      <AuthProvider>
        <SubscriptionProvider>
          <CloudProvider>
            <IdentityProvider>
              <TermsGateProvider>
              <PremiumGate>
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: tokens.bg },
              }}
            >
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="article/[slug]" />
              <Stack.Screen name="journalist/[handle]" />
              <Stack.Screen name="compose" />
              <Stack.Screen name="register" />
              <Stack.Screen name="credibility/[handle]" />
              <Stack.Screen name="suggest/[slug]" />
              <Stack.Screen name="suggestion/[id]" />
              <Stack.Screen name="review-batch/[articleId]" />
              <Stack.Screen name="newsrooms" />
              <Stack.Screen name="newsroom/[id]" />
              <Stack.Screen name="blocked" />
              <Stack.Screen name="legal" />
              <Stack.Screen name="legal/terms" />
              <Stack.Screen name="legal/privacy" />
              <Stack.Screen name="legal/guidelines" />
              <Stack.Screen name="legal/dmca" />
              <Stack.Screen name="legal/dmca-counter" />
              <Stack.Screen name="notices" />
              <Stack.Screen name="earnings" />
              <Stack.Screen name="account-delete" />
              <Stack.Screen name="account-export" />
            </Stack>
              </PremiumGate>
              </TermsGateProvider>
            </IdentityProvider>
          </CloudProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </DatabaseProvider>
  );
}
