import React, { useEffect, useMemo, useRef } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import {
  ModuleRegistry,
  MODULE_METADATA,
} from '@mylife/module-registry';
import { ModuleRegistryContext } from '@mylife/module-registry';
import { BOOKS_MODULE } from '@mylife/books';
import { FAST_MODULE } from '@mylife/fast';
import { FLASH_MODULE } from '@mylife/flash';
import { FRIENDS_MODULE } from '@mylife/friends';
import { FORUMS_MODULE } from '@mylife/forums';
import { BUDGET_MODULE } from '@mylife/budget';
import { SURF_MODULE } from '@mylife/surf';
import { RECIPES_MODULE } from '@mylife/bestchef';
import { WORKOUTS_MODULE } from '@mylife/workouts';
import { HOMES_MODULE } from '@mylife/homes';
import { CAR_MODULE } from '@mylife/car';
import { CLOSET_MODULE } from '@mylife/closet';
import { CREATE_MODULE } from '@mylife/create';
import { HABITS_MODULE } from '@mylife/habits';
import { MEDS_MODULE } from '@mylife/meds';
import { HEALTH_MODULE } from '@mylife/health';
import { WORDS_MODULE } from '@mylife/words';
import { NUTRITION_MODULE } from '@mylife/nutrition';
import { JOURNAL_MODULE } from '@mylife/journal';
import { PETS_MODULE } from '@mylife/pets';
import { MARKET_MODULE } from '@mylife/market';
import { RSVP_MODULE } from '@mylife/rsvp';
import { TRAILS_MODULE } from '@mylife/trails';
import { TRAVEL_MODULE } from '@mylife/travel';
import { MOOD_MODULE } from '@mylife/mood';
import { NOTES_MODULE } from '@mylife/notes';
import { GARDEN_MODULE } from '@mylife/garden';
import { CYCLE_MODULE } from '@mylife/cycle';
import { STARS_MODULE } from '@mylife/stars';
import { VOICE_MODULE } from '@mylife/voice';
import { MAIL_MODULE } from '@mylife/mail';
import { PAYMENTS_MODULE } from '@mylife/payments';
import { PRESENCE_MODULE } from '@mylife/presence';
import { DINING_MODULE } from '@mylife/dining';
import { SHOP_MODULE } from '@mylife/shop';
import { SLEEP_MODULE } from '@mylife/sleep';
import { CLASSES_MODULE } from '@mylife/classes';
import { SPORTS_MODULE } from '@mylife/sports';
import { colors } from '@mylife/ui';
import { createPaymentService } from '@mylife/subscription';
import type { PaymentService } from '@mylife/subscription';
import {
  AuthProvider,
  AuthService,
  LocalAuthProvider,
  getSupabaseClient,
  type SupabaseClientOptions,
} from '@mylife/auth';
import { resetSocialClient, setSocialClient } from '@mylife/social';
import { getPreference } from '@mylife/db';
import { DatabaseProvider, useDatabase } from '../components/DatabaseProvider';
import { ModuleErrorBoundary } from '../components/ModuleErrorBoundary';
import { EntitlementsProvider } from '../components/EntitlementsProvider';

/**
 * On first mount after DatabaseProvider is ready, read
 * `hub_preferences['onboarding.completed_at']`. If unset, redirect into the
 * goal-based onboarding flow. Runs once per session to avoid fighting user
 * navigation afterwards.
 */
function OnboardingGate({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const router = useRouter();
  const segments = useSegments();
  const didCheckRef = useRef(false);

  useEffect(() => {
    if (didCheckRef.current) return;
    // Skip if already in onboarding (avoids redirect loops).
    if (segments?.[0] === '(onboarding)') {
      didCheckRef.current = true;
      return;
    }
    try {
      const completed = getPreference(db, 'onboarding.completed_at');
      if (!completed) {
        router.replace('/(onboarding)/pledge');
      }
    } catch (err) {
      console.error('[MyLife] OnboardingGate check failed:', err);
    }
    didCheckRef.current = true;
  }, [db, router, segments]);

  return <>{children}</>;
}

/** Bridges the DatabaseContext into LocalAuthProvider. */
function LocalAuthBridge({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  return <LocalAuthProvider db={db}>{children}</LocalAuthProvider>;
}

export const unstable_settings = {
  initialRouteName: '(hub)',
};

const RegistryProvider =
  ModuleRegistryContext.Provider as unknown as React.ComponentType<{
    value: ModuleRegistry | null;
    children?: React.ReactNode;
  }>;

/**
 * Root layout for the MyLife app.
 *
 * Wraps the entire tree with:
 * 1. ModuleErrorBoundary -- catches fatal errors and shows recovery UI
 * 2. ModuleRegistryContext -- provides the module registry to all screens
 * 3. DatabaseProvider -- opens hub SQLite, syncs enabled state, runs migrations
 * 4. AuthProvider -- optional Supabase Auth (null for local/P2P users)
 * 5. EntitlementsProvider -- resolves purchases into entitlement state
 * 6. Stack navigator -- renders (hub) group and per-module groups
 */
/**
 * Safely register a module definition. If the definition is malformed
 * (fails Zod validation), log and skip instead of crashing the app.
 */
function safeRegister(r: ModuleRegistry, def: Parameters<ModuleRegistry['register']>[0], label: string): void {
  try {
    r.register(def);
  } catch (err) {
    console.error(`[MyLife] Failed to register module "${label}":`, err);
  }
}

export default function RootLayout() {
  const supabaseOptions = useMemo<SupabaseClientOptions | null>(() => {
    const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) return null;
    return { url, anonKey };
  }, []);

  const supabaseClient = useMemo(
    () => (supabaseOptions ? getSupabaseClient(supabaseOptions) : null),
    [supabaseOptions],
  );

  const authService = useMemo(
    () => (supabaseClient ? new AuthService(supabaseClient) : null),
    [supabaseClient],
  );

  useEffect(() => {
    if (supabaseClient) {
      setSocialClient(supabaseClient);
      return;
    }

    resetSocialClient();
  }, [supabaseClient]);

  const registry = useMemo(() => {
    const r = new ModuleRegistry();
    for (const [key, def] of Object.entries(MODULE_METADATA)) {
      safeRegister(r, def, key);
    }
    // Override lightweight entries with full module definitions (includes migrations)
    safeRegister(r, BOOKS_MODULE, 'books');
    safeRegister(r, FAST_MODULE, 'fast');
    safeRegister(r, FLASH_MODULE, 'flash');
    safeRegister(r, FRIENDS_MODULE, 'friends');
    safeRegister(r, FORUMS_MODULE, 'forums');
    safeRegister(r, BUDGET_MODULE, 'budget');
    safeRegister(r, SURF_MODULE, 'surf');
    safeRegister(r, RECIPES_MODULE, 'recipes');
    safeRegister(r, WORKOUTS_MODULE, 'workouts');
    safeRegister(r, HOMES_MODULE, 'homes');
    safeRegister(r, CAR_MODULE, 'car');
    safeRegister(r, CLOSET_MODULE, 'closet');
    safeRegister(r, HABITS_MODULE, 'habits');
    safeRegister(r, MEDS_MODULE, 'meds');
    safeRegister(r, HEALTH_MODULE, 'health');
    safeRegister(r, WORDS_MODULE, 'words');
    safeRegister(r, NUTRITION_MODULE, 'nutrition');
    safeRegister(r, JOURNAL_MODULE, 'journal');
    safeRegister(r, PETS_MODULE, 'pets');
    safeRegister(r, MARKET_MODULE, 'market');
    safeRegister(r, RSVP_MODULE, 'rsvp');
    safeRegister(r, TRAILS_MODULE, 'trails');
    safeRegister(r, TRAVEL_MODULE, 'travel');
    safeRegister(r, MOOD_MODULE, 'mood');
    safeRegister(r, NOTES_MODULE, 'notes');
    safeRegister(r, GARDEN_MODULE, 'garden');
    safeRegister(r, CYCLE_MODULE, 'cycle');
    safeRegister(r, CREATE_MODULE, 'create');
    safeRegister(r, STARS_MODULE, 'stars');
    safeRegister(r, VOICE_MODULE, 'voice');
    safeRegister(r, MAIL_MODULE, 'mail');
    safeRegister(r, PAYMENTS_MODULE, 'payments');
    safeRegister(r, PRESENCE_MODULE, 'presence');
    safeRegister(r, DINING_MODULE, 'dining');
    safeRegister(r, SHOP_MODULE, 'shop');
    safeRegister(r, SLEEP_MODULE, 'sleep');
    safeRegister(r, CLASSES_MODULE, 'classes');
    safeRegister(r, SPORTS_MODULE, 'sports');
    return r;
  }, []);

  const paymentService = useMemo<PaymentService | null>(() => {
    // Payment service will be fully configured once RevenueCat API keys
    // are set via environment variables. For now create with mobile platform.
    try {
      return createPaymentService({ platform: 'mobile' });
    } catch {
      return null;
    }
  }, []);

  return (
    <ModuleErrorBoundary moduleName="MyLife">
      <RegistryProvider value={registry}>
        <DatabaseProvider registry={registry}>
          <LocalAuthBridge>
            <AuthProvider service={authService}>
              <EntitlementsProvider paymentService={paymentService}>
              <StatusBar style="light" />
              <OnboardingGate>
              <Stack
                initialRouteName="(hub)"
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: colors.background },
                  animation: 'slide_from_right',
                }}
              >
                <Stack.Screen name="(auth)" />
                <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
                <Stack.Screen name="(hub)" />
                <Stack.Screen name="(books)" />
                <Stack.Screen name="(budget)" />
                <Stack.Screen name="(surf)" />
                <Stack.Screen name="(fast)" />
                <Stack.Screen name="(flash)" />
                <Stack.Screen name="(friends)" />
                <Stack.Screen name="(forums)" />
                <Stack.Screen name="(recipes)" />
                <Stack.Screen name="(workouts)" />
                <Stack.Screen name="(homes)" />
                <Stack.Screen name="(car)" />
                <Stack.Screen name="(closet)" />
                <Stack.Screen name="(habits)" />
                <Stack.Screen name="(meds)" />
                <Stack.Screen name="(health)" />
                <Stack.Screen name="(words)" />
                <Stack.Screen name="(nutrition)" />
                <Stack.Screen name="(journal)" />
                <Stack.Screen name="(pets)" />
                <Stack.Screen name="(market)" />
                <Stack.Screen name="(rsvp)" />
                <Stack.Screen name="(trails)" />
                <Stack.Screen name="(travel)" />
                <Stack.Screen name="(mood)" />
                <Stack.Screen name="(notes)" />
                <Stack.Screen name="(garden)" />
                <Stack.Screen name="(cycle)" />
                <Stack.Screen name="(create)" />
                <Stack.Screen name="(stars)" />
                <Stack.Screen name="(voice)" />
                <Stack.Screen name="(mail)" />
                <Stack.Screen name="(payments)" />
                <Stack.Screen name="(presence)" />
                <Stack.Screen name="(dining)" />
                <Stack.Screen name="(shop)" />
                <Stack.Screen name="(sleep)" />
                <Stack.Screen name="(sports)" options={{ headerShown: false }} />
                <Stack.Screen name="(social)" />
              </Stack>
              </OnboardingGate>
              </EntitlementsProvider>
            </AuthProvider>
          </LocalAuthBridge>
        </DatabaseProvider>
      </RegistryProvider>
    </ModuleErrorBoundary>
  );
}
