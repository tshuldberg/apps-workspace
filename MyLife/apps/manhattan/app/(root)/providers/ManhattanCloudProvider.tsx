import React, { createContext, useContext, useEffect, useMemo } from 'react';
import * as SecureStore from 'expo-secure-store';
import { createExpoSecureStorage, getSupabaseClient, resetSupabaseClient } from '@mylife/auth';
import { initManhattanClient, resetManhattanClient } from '@mylife/manhattan';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getManhattanCloudConfig } from '../data/launch-environment';

interface ManhattanCloudContextValue {
  isConfigured: boolean;
  supabase: SupabaseClient | null;
}

const ManhattanCloudContext = createContext<ManhattanCloudContextValue>({
  isConfigured: false,
  supabase: null,
});

export function useManhattanCloud(): ManhattanCloudContextValue {
  return useContext(ManhattanCloudContext);
}

export function ManhattanCloudProvider({ children }: { children: React.ReactNode }) {
  const config = useMemo(() => {
    const result = getManhattanCloudConfig();
    return result.ok ? result.config : null;
  }, []);

  const supabase = useMemo(() => {
    if (!config) return null;
    return getSupabaseClient({
      url: config.url,
      anonKey: config.anonKey,
      storage: createExpoSecureStorage(SecureStore),
    });
  }, [config]);

  useEffect(() => {
    if (supabase) {
      initManhattanClient(supabase);
    } else {
      resetManhattanClient();
      resetSupabaseClient();
    }
  }, [supabase]);

  const value = useMemo<ManhattanCloudContextValue>(
    () => ({ isConfigured: supabase !== null, supabase }),
    [supabase],
  );

  return (
    <ManhattanCloudContext.Provider value={value}>
      {children}
    </ManhattanCloudContext.Provider>
  );
}
