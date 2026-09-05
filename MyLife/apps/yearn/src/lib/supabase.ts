import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import {
  getYearnCloudConfig,
  type YearnCloudEnvironment,
  type YearnLaunchEnv,
} from './launchEnvironment';

export type AnySupabaseClient = SupabaseClient<any, any, any, any, any>;

export interface YearnSupabaseClientState {
  client: AnySupabaseClient | null;
  environment: YearnCloudEnvironment;
  error: string | null;
  projectRef: string | null;
}

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'com.mylife.yearn.auth',
};

export const yearnSecureStorage = {
  getItem(key: string): Promise<string | null> {
    return Promise.resolve(SecureStore.getItem(key, SECURE_STORE_OPTIONS));
  },
  setItem(key: string, value: string): Promise<void> {
    SecureStore.setItem(key, value, SECURE_STORE_OPTIONS);
    return Promise.resolve();
  },
  removeItem(key: string): Promise<void> {
    return SecureStore.deleteItemAsync(key, SECURE_STORE_OPTIONS);
  },
};

export function createYearnSupabaseClient(
  env: YearnLaunchEnv = process.env,
): YearnSupabaseClientState {
  const cloudConfig = getYearnCloudConfig(env);

  if (!cloudConfig.ok) {
    return {
      client: null,
      environment: 'unknown',
      error: cloudConfig.error,
      projectRef: null,
    };
  }

  return {
    client: createClient(cloudConfig.config.url, cloudConfig.config.anonKey, {
      db: {
        schema: 'yearn',
      },
      auth: {
        storage: yearnSecureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // PKCE is required: authLinks.ts completes sign-in via
        // exchangeCodeForSession(code), which needs a stored code verifier.
        // Without this, supabase-js defaults to the implicit flow and every
        // OAuth / magic-link (?code=) exchange fails.
        flowType: 'pkce',
      },
    }),
    environment: cloudConfig.config.environment,
    error: null,
    projectRef: cloudConfig.config.projectRef,
  };
}
