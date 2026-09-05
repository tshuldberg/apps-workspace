import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { TokenStorage } from './types';

export interface SupabaseClientOptions {
  url: string;
  anonKey: string;
  /**
   * Platform-specific token storage adapter.
   *
   * Use `createExpoSecureStorage()` for mobile (iOS Keychain / Android Keystore)
   * or `createWebStorage()` for web (localStorage with namespace isolation).
   * When omitted, Supabase falls back to its built-in localStorage adapter.
   */
  storage?: TokenStorage;
}

let sharedClient: SupabaseClient | null = null;

/**
 * Create or return the shared Supabase client.
 *
 * The optional `storage` adapter controls where session tokens are persisted.
 * On mobile, pass the result of `createExpoSecureStorage(SecureStore)` to
 * store tokens in the platform keychain. On web, pass `createWebStorage()`
 * for namespaced localStorage persistence.
 */
export function getSupabaseClient(options: SupabaseClientOptions): SupabaseClient {
  if (sharedClient) return sharedClient;

  sharedClient = createClient(options.url, options.anonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: typeof window !== 'undefined',
      ...(options.storage
        ? {
            storage: {
              getItem: (key: string) => options.storage!.getItem(key),
              setItem: (key: string, value: string) => options.storage!.setItem(key, value),
              removeItem: (key: string) => options.storage!.removeItem(key),
            },
          }
        : {}),
    },
  });

  return sharedClient;
}

/** Reset the shared client (useful for tests). */
export function resetSupabaseClient(): void {
  sharedClient = null;
}
