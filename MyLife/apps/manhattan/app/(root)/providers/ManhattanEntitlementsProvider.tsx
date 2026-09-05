import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import type { ReactNode } from 'react';
import { Platform } from 'react-native';
import { isModuleUnlocked, resolveEntitlements, setTestMode, type EntitlementState, type Purchase } from '@mylife/entitlements';
import { MODULE_IDS } from '@mylife/module-registry';
import type { PaymentService } from '@mylife/subscription';
import { createPaymentService, EntitlementCache } from '@mylife/subscription';
import { useManhattanDatabase } from './DatabaseProvider';
import {
  getManhattanBillingConfig,
  shouldEnableManhattanEntitlementsTestMode,
} from '../data/launch-environment';
import { createNativeRevenueCatAdapter } from '../lib/revenuecat-adapter';

const MODULE_ID = 'manhattan';

const ENTITLEMENTS_TEST_MODE = shouldEnableManhattanEntitlementsTestMode();
setTestMode(ENTITLEMENTS_TEST_MODE);

function buildDefaultEntitlementState(): EntitlementState {
  return {
    hubUnlocked: ENTITLEMENTS_TEST_MODE,
    unlockedModules: new Set(),
    storageTier: 'free',
    updateEntitled: false,
    purchaseDate: null,
  };
}

interface ManhattanEntitlementsContextValue {
  getState: () => EntitlementState;
  subscribe: (listener: () => void) => () => void;
  refresh: () => Promise<void>;
  purchaseManhattan: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  isConfigured: boolean;
  isTestMode: boolean;
  lastError: string | null;
}

const ManhattanEntitlementsContext = createContext<ManhattanEntitlementsContextValue | null>(null);

export function ManhattanEntitlementsProvider({ children }: { children: ReactNode }) {
  const db = useManhattanDatabase();
  const stateRef = useRef<EntitlementState>(buildDefaultEntitlementState());
  const listenersRef = useRef(new Set<() => void>());
  const entitlementCache = useMemo(() => new EntitlementCache(db), [db]);
  const billingConfig = useMemo(
    () => getManhattanBillingConfig(
      process.env,
      Platform.OS === 'android' ? 'android' : 'ios',
    ),
    [],
  );
  const [lastError, setLastError] = useState<string | null>(
    billingConfig.ok ? null : billingConfig.error,
  );

  const paymentService = useMemo<PaymentService | null>(() => {
    if (!billingConfig.ok) {
      return null;
    }

    return createPaymentService({
      platform: 'mobile',
      revenueCatApiKey: billingConfig.config.revenueCatApiKey,
      revenueCatSdk: createNativeRevenueCatAdapter(),
    });
  }, [billingConfig]);

  const notify = useCallback(() => {
    for (const listener of listenersRef.current) {
      listener();
    }
  }, []);

  const updateFromPurchases = useCallback((purchases: Purchase[]) => {
    if (ENTITLEMENTS_TEST_MODE && purchases.length === 0) return;
    const resolved = resolveEntitlements(purchases);
    stateRef.current = resolved;
    entitlementCache.persistState(MODULE_IDS, resolved, 'revenuecat');
    setLastError(null);
    notify();
  }, [entitlementCache, notify]);

  const loadCachedState = useCallback(() => {
    const cached = entitlementCache.buildStateFromCache();
    if (cached.unlockedModules.size > 0 || cached.hubUnlocked) {
      stateRef.current = cached;
      notify();
      return true;
    }
    return false;
  }, [entitlementCache, notify]);

  const refresh = useCallback(async () => {
    if (!paymentService) {
      loadCachedState();
      return;
    }

    try {
      const purchases = await paymentService.getActivePurchases();
      updateFromPurchases(purchases);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
      loadCachedState();
      notify();
    }
  }, [loadCachedState, notify, paymentService, updateFromPurchases]);

  const purchaseManhattan = useCallback(async (): Promise<boolean> => {
    if (!paymentService) {
      setLastError('Purchases are not configured on this build.');
      notify();
      return false;
    }

    const result = await paymentService.purchase('mylife_manhattan_unlock');
    if (!result.success) {
      setLastError(result.error ?? 'Purchase did not complete.');
      notify();
      return false;
    }

    await refresh();
    return isModuleUnlocked(MODULE_ID, stateRef.current);
  }, [notify, paymentService, refresh]);

  const restorePurchases = useCallback(async (): Promise<boolean> => {
    if (!paymentService) {
      setLastError('Purchases are not configured on this build.');
      notify();
      return false;
    }

    try {
      const purchases = await paymentService.restore();
      updateFromPurchases(purchases);
      return isModuleUnlocked(MODULE_ID, stateRef.current);
    } catch (err) {
      setLastError(err instanceof Error ? err.message : String(err));
      loadCachedState();
      notify();
      return false;
    }
  }, [loadCachedState, notify, paymentService, updateFromPurchases]);

  useEffect(() => {
    loadCachedState();
    void refresh();

    if (!paymentService) return undefined;
    return paymentService.onPurchaseUpdated((purchases) => {
      updateFromPurchases(purchases);
    });
  }, [loadCachedState, paymentService, refresh, updateFromPurchases]);

  const getState = useCallback(() => stateRef.current, []);

  const subscribe = useCallback((listener: () => void) => {
    listenersRef.current.add(listener);
    return () => {
      listenersRef.current.delete(listener);
    };
  }, []);

  const value = useMemo<ManhattanEntitlementsContextValue>(
    () => ({
      getState,
      subscribe,
      refresh,
      purchaseManhattan,
      restorePurchases,
      isConfigured: paymentService !== null,
      isTestMode: ENTITLEMENTS_TEST_MODE,
      lastError,
    }),
    [getState, lastError, paymentService, purchaseManhattan, refresh, restorePurchases, subscribe],
  );

  return (
    <ManhattanEntitlementsContext.Provider value={value}>
      {children}
    </ManhattanEntitlementsContext.Provider>
  );
}

export function useManhattanUnlocked(): boolean {
  const ctx = useManhattanEntitlementsContext();
  return useSyncExternalStore(
    ctx.subscribe,
    () => isModuleUnlocked(MODULE_ID, ctx.getState()),
    () => isModuleUnlocked(MODULE_ID, ctx.getState()),
  );
}

export function useManhattanBilling(): {
  purchaseManhattan: () => Promise<boolean>;
  restorePurchases: () => Promise<boolean>;
  refreshEntitlements: () => Promise<void>;
  isConfigured: boolean;
  isTestMode: boolean;
  lastError: string | null;
} {
  const ctx = useManhattanEntitlementsContext();
  return {
    purchaseManhattan: ctx.purchaseManhattan,
    restorePurchases: ctx.restorePurchases,
    refreshEntitlements: ctx.refresh,
    isConfigured: ctx.isConfigured,
    isTestMode: ctx.isTestMode,
    lastError: ctx.lastError,
  };
}

function useManhattanEntitlementsContext(): ManhattanEntitlementsContextValue {
  const ctx = useContext(ManhattanEntitlementsContext);
  if (!ctx) {
    throw new Error('Manhattan entitlements hooks must be used within ManhattanEntitlementsProvider');
  }
  return ctx;
}
