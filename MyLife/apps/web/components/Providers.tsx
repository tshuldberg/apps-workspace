'use client';

import { useEffect, useMemo, type ReactNode } from 'react';
import {
  ModuleRegistry,
  MODULE_METADATA,
  MODULE_IDS,
  type ModuleId,
} from '@mylife/module-registry';
import { ModuleRegistryContext } from '@mylife/module-registry/hooks';
import { BOOKS_MODULE } from '../../../modules/books/src/definition';
import { FAST_MODULE } from '../../../modules/fast/src/definition';
import { FLASH_MODULE } from '../../../modules/flash/src/definition';
import { BUDGET_MODULE } from '../../../modules/budget/src/definition';
import { FRIENDS_MODULE } from '../../../modules/friends/src/definition';
import { FORUMS_MODULE } from '../../../modules/forums/src/definition';
import { RECIPES_MODULE } from '../../../modules/bestchef/src/definition';
import { CAR_MODULE } from '../../../modules/car/src/definition';
import { CLASSES_MODULE } from '../../../modules/classes/src/definition';
import { CLOSET_MODULE } from '../../../modules/closet/src/definition';
import { CREATE_MODULE } from '../../../modules/create/src/definition';
import { HABITS_MODULE } from '../../../modules/habits/src/definition';
import { MEDS_MODULE } from '../../../modules/meds/src/definition';
import { MARKET_MODULE } from '../../../modules/market/src/definition';
import { SURF_MODULE } from '../../../modules/surf/src/definition';
import { WORKOUTS_MODULE } from '../../../modules/workouts/src/definition';
import { HOMES_MODULE } from '../../../modules/homes/src/definition';
import { WORDS_MODULE } from '../../../modules/words/src/definition';
import { JOURNAL_MODULE } from '../../../modules/journal/src/definition';
import { PETS_MODULE } from '../../../modules/pets/src/definition';
import { HEALTH_MODULE } from '../../../modules/health/src/definition';
import { PRESENCE_MODULE } from '../../../modules/presence/src/definition';
import { DINING_MODULE } from '../../../modules/dining/src/definition';
import { MANHATTAN_MODULE } from '../../../modules/manhattan/src/definition';
import { RSVP_MODULE } from '../../../modules/rsvp/src/definition';
import { PAYMENTS_MODULE } from '../../../modules/payments/src/definition';
import { SHOP_MODULE } from '../../../modules/shop/src/definition';
import { SLEEP_MODULE } from '../../../modules/sleep/src/definition';
import { SPORTS_MODULE } from '../../../modules/sports/src/definition';
import { TRAVEL_MODULE } from '../../../modules/travel/src/definition';
import {
  AuthProvider,
} from '@mylife/auth/provider';
import { getSupabaseClient, type SupabaseClientOptions } from '@mylife/auth/client';
import { AuthService } from '@mylife/auth/service';
import { resetSocialClient, setSocialClient } from '@mylife/social';
import { createPaymentService } from '@mylife/subscription';
import type { PaymentService } from '@mylife/subscription';
import { EntitlementsProvider } from './EntitlementsProvider';
import { WebLocalAuthProvider } from './WebLocalAuthProvider';
import { HubSyncProvider } from './HubSyncProvider';

const RegistryProvider =
  ModuleRegistryContext.Provider as unknown as React.ComponentType<{
    value: ModuleRegistry | null;
    children?: unknown;
  }>;

interface ProvidersProps {
  children: ReactNode;
  initialEnabledIds: string[];
}

export function Providers({ children, initialEnabledIds }: ProvidersProps) {
  const supabaseOptions = useMemo<SupabaseClientOptions | null>(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    const reg = new ModuleRegistry();
    for (const id of MODULE_IDS) {
      reg.register(MODULE_METADATA[id]);
    }
    // Override with full module definitions (includes migrations)
    reg.register(BOOKS_MODULE);
    reg.register(FAST_MODULE);
    reg.register(FLASH_MODULE);
    reg.register(BUDGET_MODULE);
    reg.register(FRIENDS_MODULE);
    reg.register(FORUMS_MODULE);
    reg.register(RECIPES_MODULE);
    reg.register(CAR_MODULE);
    reg.register(CLASSES_MODULE);
    reg.register(CLOSET_MODULE);
    reg.register(CREATE_MODULE);
    reg.register(HABITS_MODULE);
    reg.register(MEDS_MODULE);
    reg.register(MARKET_MODULE);
    reg.register(SURF_MODULE);
    reg.register(WORKOUTS_MODULE);
    reg.register(HOMES_MODULE);
    reg.register(WORDS_MODULE);
    reg.register(JOURNAL_MODULE);
    reg.register(PETS_MODULE);
    reg.register(HEALTH_MODULE);
    reg.register(PRESENCE_MODULE);
    reg.register(DINING_MODULE);
    reg.register(MANHATTAN_MODULE);
    reg.register(RSVP_MODULE);
    reg.register(PAYMENTS_MODULE);
    reg.register(SHOP_MODULE);
    reg.register(SLEEP_MODULE);
    reg.register(SPORTS_MODULE);
    reg.register(TRAVEL_MODULE);
    // Restore enabled state from SQLite (passed from server layout)
    for (const id of initialEnabledIds) {
      reg.enable(id as ModuleId);
    }
    return reg;
  }, [initialEnabledIds]);

  const paymentService = useMemo<PaymentService | null>(() => {
    try {
      return createPaymentService({ platform: 'web' });
    } catch {
      return null;
    }
  }, []);

  return (
    <RegistryProvider value={registry}>
      <WebLocalAuthProvider>
        <AuthProvider service={authService}>
          <EntitlementsProvider paymentService={paymentService}>
            <HubSyncProvider>
              {children as unknown as React.ReactNode}
            </HubSyncProvider>
          </EntitlementsProvider>
        </AuthProvider>
      </WebLocalAuthProvider>
    </RegistryProvider>
  );
}
