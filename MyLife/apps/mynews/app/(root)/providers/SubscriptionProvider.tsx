import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { PRODUCTS } from '@mylife/billing-config';
import {
  isModuleUnlocked,
  resolveEntitlements,
  type ProductId,
  type Purchase,
} from '@mylife/entitlements';
import { createPaymentService, type PaymentService } from '@mylife/subscription';
import {
  getMyNewsSubscriptionConfig,
  MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY,
} from '../data/launch-environment';
import { createMyNewsRevenueCatAdapter } from '../data/revenuecat-adapter';

export type MyNewsSubscriptionStatus =
  | 'loading'
  | 'entitled'
  | 'locked'
  | 'unavailable'
  | 'error';

interface MyNewsSubscriptionContextValue {
  status: MyNewsSubscriptionStatus;
  isConfigured: boolean;
  isEntitled: boolean;
  lastError: string | null;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  refresh: () => Promise<boolean>;
}

const MyNewsSubscriptionContext = createContext<MyNewsSubscriptionContextValue | null>(null);

function isMyNewsEntitled(purchases: Purchase[]): boolean {
  return isModuleUnlocked('mynews', resolveEntitlements(purchases));
}

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const config = useMemo(
    () =>
      getMyNewsSubscriptionConfig(
        process.env,
        Platform.OS === 'android' ? 'android' : 'ios',
      ),
    [],
  );
  const service = useMemo<PaymentService | null>(() => {
    if (!config.ok) return null;
    return createPaymentService({
      platform: 'mobile',
      revenueCatApiKey: config.config.revenueCatApiKey,
      revenueCatSdk: createMyNewsRevenueCatAdapter(),
    });
  }, [config]);
  const [status, setStatus] = useState<MyNewsSubscriptionStatus>(
    service ? 'loading' : 'unavailable',
  );
  const [lastError, setLastError] = useState<string | null>(
    config.ok ? null : config.reason,
  );

  const updateFromPurchases = useCallback((purchases: Purchase[]): boolean => {
    const entitled = isMyNewsEntitled(purchases);
    setStatus(entitled ? 'entitled' : 'locked');
    setLastError(null);
    return entitled;
  }, []);

  const refresh = useCallback(async (): Promise<boolean> => {
    if (!service) {
      setStatus('unavailable');
      setLastError(MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY);
      return false;
    }
    try {
      return updateFromPurchases(await service.getActivePurchases());
    } catch (error) {
      setStatus('error');
      setLastError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, [service, updateFromPurchases]);

  const purchase = useCallback(async (): Promise<boolean> => {
    if (!service) {
      setStatus('unavailable');
      setLastError(MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY);
      return false;
    }
    setLastError(null);
    const result = await service.purchase(PRODUCTS.standaloneModules.mynews.id as ProductId);
    if (!result.success) {
      setLastError(result.error ?? 'The purchase did not complete.');
      return false;
    }
    return refresh();
  }, [refresh, service]);

  const restore = useCallback(async (): Promise<boolean> => {
    if (!service) {
      setStatus('unavailable');
      setLastError(MYNEWS_SUBSCRIPTIONS_UNAVAILABLE_COPY);
      return false;
    }
    setLastError(null);
    try {
      return updateFromPurchases(await service.restore());
    } catch (error) {
      setLastError(error instanceof Error ? error.message : String(error));
      return false;
    }
  }, [service, updateFromPurchases]);

  useEffect(() => {
    if (!service) return undefined;
    void refresh();
    return service.onPurchaseUpdated(updateFromPurchases);
  }, [refresh, service, updateFromPurchases]);

  const value = useMemo<MyNewsSubscriptionContextValue>(
    () => ({
      status,
      isConfigured: service !== null,
      isEntitled: status === 'entitled',
      lastError,
      purchase,
      restore,
      refresh,
    }),
    [lastError, purchase, refresh, restore, service, status],
  );
  return (
    <MyNewsSubscriptionContext.Provider value={value}>
      {children}
    </MyNewsSubscriptionContext.Provider>
  );
}

export function useMyNewsSubscription(): MyNewsSubscriptionContextValue {
  const context = useContext(MyNewsSubscriptionContext);
  if (!context) throw new Error('useMyNewsSubscription must be used within SubscriptionProvider');
  return context;
}
