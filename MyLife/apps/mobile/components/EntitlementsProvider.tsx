import React, { createContext, useCallback, useContext, useEffect, useRef, useSyncExternalStore } from 'react';
import type { ReactNode } from 'react';
import type { EntitlementState, Purchase } from '@mylife/entitlements';
import { resolveEntitlements, isModuleUnlocked, isTestMode } from '@mylife/entitlements';
import type { ModuleId } from '@mylife/module-registry';
import { MODULE_IDS } from '@mylife/module-registry';
import type { PaymentService, EntitlementSource } from '@mylife/subscription';
import { EntitlementCache } from '@mylife/subscription';

// ---------------------------------------------------------------------------
// Default state (no purchases)
// ---------------------------------------------------------------------------

const DEFAULT_ENTITLEMENTS: EntitlementState = {
  hubUnlocked: isTestMode(),
  unlockedModules: new Set(),
  storageTier: 'free',
  updateEntitled: false,
  purchaseDate: null,
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface EntitlementsContextValue {
  getState: () => EntitlementState;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  paymentService: PaymentService | null;
}

const EntitlementsContext = createContext<EntitlementsContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

interface EntitlementsProviderProps {
  children: ReactNode;
  paymentService: PaymentService | null;
  /** Optional entitlement cache for offline fallback (R2.5, R2.9). */
  entitlementCache?: EntitlementCache | null;
  /** Source label for cache entries ('revenuecat' on mobile, 'stripe' on web). */
  entitlementSource?: EntitlementSource;
}

/**
 * Provides entitlement state derived from purchases to the component tree.
 *
 * On mount, queries the PaymentService for active purchases, resolves
 * entitlements, and subscribes to purchase updates for live changes.
 * If an EntitlementCache is provided, persists resolved state for offline
 * fallback and loads from cache when the purchase provider is unreachable.
 */
export function EntitlementsProvider({
  children,
  paymentService,
  entitlementCache,
  entitlementSource = 'revenuecat',
}: EntitlementsProviderProps) {
  const stateRef = useRef<EntitlementState>(DEFAULT_ENTITLEMENTS);
  const listenersRef = useRef(new Set<() => void>());
  const cacheRef = useRef(entitlementCache ?? null);

  const notify = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const updateFromPurchases = useCallback((purchases: Purchase[]) => {
    if (isTestMode() && purchases.length === 0) return;
    const resolved = resolveEntitlements(purchases);
    stateRef.current = resolved;

    // Persist to cache for offline fallback (R2.5)
    if (cacheRef.current) {
      try {
        cacheRef.current.persistState(MODULE_IDS, resolved, entitlementSource);
      } catch {
        // Cache write failures are non-fatal
      }
    }

    notify();
  }, [notify, entitlementSource]);

  const refresh = useCallback(async () => {
    if (!paymentService) return;
    try {
      const purchases = await paymentService.getActivePurchases();
      updateFromPurchases(purchases);
    } catch {
      // Network failure: fall back to cached state (R2.9)
      if (cacheRef.current) {
        const cached = cacheRef.current.buildStateFromCache();
        // Only use cache if it has actual data
        if (cached.unlockedModules.size > 0 || cached.hubUnlocked) {
          stateRef.current = cached;
          notify();
        }
      }
    }
  }, [paymentService, updateFromPurchases, notify]);

  useEffect(() => {
    // On mount: try loading from cache first for instant UI
    if (cacheRef.current) {
      const cached = cacheRef.current.buildStateFromCache();
      if (cached.unlockedModules.size > 0 || cached.hubUnlocked) {
        stateRef.current = cached;
        notify();
      }
    }

    if (!paymentService) return;

    // Then fetch fresh state from provider
    void refresh();

    // Subscribe to purchase updates
    const unsub = paymentService.onPurchaseUpdated((purchases: Purchase[]) => {
      updateFromPurchases(purchases);
    });

    return unsub;
  }, [paymentService, refresh, updateFromPurchases, notify]);

  const getState = useCallback(() => stateRef.current, []);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = React.useMemo<EntitlementsContextValue>(
    () => ({ getState, subscribe, refresh, paymentService }),
    [getState, subscribe, refresh, paymentService],
  );

  return (
    <EntitlementsContext.Provider value={value}>
      {children}
    </EntitlementsContext.Provider>
  );
}

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Returns the current EntitlementState. Subscribes to changes and
 * re-renders when purchases are updated.
 */
export function useEntitlements(): EntitlementState {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }

  return useSyncExternalStore(ctx.subscribe, ctx.getState, ctx.getState);
}

/**
 * Returns whether a specific module is unlocked for the current user.
 *
 * Scoped to a single boolean — React will bail out of re-render for this
 * component if the boolean didn't change, even if other entitlement state did.
 * Use this in ModuleCard and PurchaseGate instead of useEntitlements() to
 * prevent the full hub list from re-rendering on every purchase event.
 */
export function useModuleUnlocked(moduleId: ModuleId): boolean {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error('useModuleUnlocked must be used within an EntitlementsProvider');
  }
  return useSyncExternalStore(
    ctx.subscribe,
    () => isModuleUnlocked(moduleId, ctx.getState()),
    () => isModuleUnlocked(moduleId, ctx.getState()),
  );
}

/**
 * Returns the PaymentService instance (or null) and a refresh function.
 */
export function usePayment(): { paymentService: PaymentService | null; refreshEntitlements: () => Promise<void> } {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error('usePayment must be used within an EntitlementsProvider');
  }

  return { paymentService: ctx.paymentService, refreshEntitlements: ctx.refresh };
}
