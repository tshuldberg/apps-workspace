'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import type { EntitlementState, Purchase } from '@mylife/entitlements';
import { resolveEntitlements, isTestMode } from '@mylife/entitlements';
import type { PaymentService } from '@mylife/subscription';

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
}

/**
 * Provides entitlement state derived from purchases to the component tree.
 *
 * On mount, queries the PaymentService for active purchases, resolves
 * entitlements, and subscribes to purchase updates for live changes.
 */
export function EntitlementsProvider({ children, paymentService }: EntitlementsProviderProps) {
  const stateRef = useRef<EntitlementState>(DEFAULT_ENTITLEMENTS);
  const listenersRef = useRef(new Set<() => void>());

  const notify = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const updateFromPurchases = useCallback((purchases: Purchase[]) => {
    if (isTestMode() && purchases.length === 0) return;
    stateRef.current = resolveEntitlements(purchases);
    notify();
  }, [notify]);

  const refresh = useCallback(async () => {
    if (!paymentService) return;
    const purchases = await paymentService.getActivePurchases();
    updateFromPurchases(purchases);
  }, [paymentService, updateFromPurchases]);

  useEffect(() => {
    if (!paymentService) return;

    void refresh();

    const unsub = paymentService.onPurchaseUpdated((purchases) => {
      updateFromPurchases(purchases);
    });

    return unsub;
  }, [paymentService, refresh, updateFromPurchases]);

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

export function useEntitlements(): EntitlementState {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error('useEntitlements must be used within an EntitlementsProvider');
  }

  return useSyncExternalStore(ctx.subscribe, ctx.getState, ctx.getState);
}

export function usePayment(): { paymentService: PaymentService | null; refreshEntitlements: () => Promise<void> } {
  const ctx = useContext(EntitlementsContext);
  if (!ctx) {
    throw new Error('usePayment must be used within an EntitlementsProvider');
  }

  return { paymentService: ctx.paymentService, refreshEntitlements: ctx.refresh };
}
