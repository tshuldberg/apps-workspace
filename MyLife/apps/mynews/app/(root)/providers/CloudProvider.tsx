import React, { createContext, useContext, useMemo } from 'react';
import { createMyNewsCloudAdapter, type MyNewsCloudPort } from '@mylife/mynews';
import { getMyNewsCloudConfig } from '../data/launch-environment';
import { useMyNewsAuth } from './AuthProvider';

interface MyNewsCloudContextValue {
  isConfigured: boolean;
  port: MyNewsCloudPort | null;
  /** Present when config parsing failed or is absent; drives honest copy. */
  reason: string | null;
}

const MyNewsCloudContext = createContext<MyNewsCloudContextValue>({
  isConfigured: false,
  port: null,
  reason: 'Not connected to a MyNews server yet.',
});

export function useMyNewsCloud(): MyNewsCloudContextValue {
  return useContext(MyNewsCloudContext);
}

export function CloudProvider({ children }: { children: React.ReactNode }) {
  // Stable across renders: AuthProvider memoizes its method surface once.
  const { getAccessToken } = useMyNewsAuth();

  const value = useMemo<MyNewsCloudContextValue>(() => {
    const result = getMyNewsCloudConfig();
    if (!result.ok) {
      return { isConfigured: false, port: null, reason: result.reason };
    }
    return {
      isConfigured: true,
      port: createMyNewsCloudAdapter({ ...result.config, getAccessToken }),
      reason: null,
    };
  }, [getAccessToken]);

  return <MyNewsCloudContext.Provider value={value}>{children}</MyNewsCloudContext.Provider>;
}
