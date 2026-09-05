/**
 * @mylife/auth -- Platform-specific secure token storage.
 *
 * Mobile: expo-secure-store wraps iOS Keychain / Android Keystore.
 * Web: localStorage with Supabase's built-in session handling.
 *
 * Both adapters implement the TokenStorage interface so the Supabase
 * client can persist refresh tokens across app restarts.
 */

import type { TokenStorage } from './types';

// ── Storage key prefix ───────────────────────────────────────────────

const KEY_PREFIX = 'mylife.auth.';

function prefixedKey(key: string): string {
  return `${KEY_PREFIX}${key}`;
}

// ── Expo Secure Store adapter (mobile) ───────────────────────────────

/**
 * Secure storage adapter for React Native (Expo).
 *
 * Uses expo-secure-store which persists to:
 * - iOS: Keychain Services (hardware-backed on devices with Secure Enclave)
 * - Android: Android Keystore system
 *
 * Values are encrypted at rest and survive app restarts, device reboots,
 * and app updates. They are NOT included in iCloud/Google backups by default.
 *
 * The caller must pass the `SecureStore` module to avoid a hard dependency
 * on expo-secure-store at the package level (it's only available in Expo
 * runtime, not in web or test environments).
 */
export function createExpoSecureStorage(secureStore: {
  getItemAsync: (key: string) => Promise<string | null>;
  setItemAsync: (key: string, value: string) => Promise<void>;
  deleteItemAsync: (key: string) => Promise<void>;
}): TokenStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        return await secureStore.getItemAsync(prefixedKey(key));
      } catch {
        // Secure store can throw on first access after fresh install
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      await secureStore.setItemAsync(prefixedKey(key), value);
    },
    async removeItem(key: string): Promise<void> {
      try {
        await secureStore.deleteItemAsync(prefixedKey(key));
      } catch {
        // Deletion of a non-existent key is not an error
      }
    },
  };
}

// ── Web storage adapter ──────────────────────────────────────────────

/**
 * Storage adapter for web environments.
 *
 * Uses localStorage as the persistence layer. Supabase's JS client
 * defaults to localStorage when no custom storage is provided, but
 * this adapter adds the MyLife key prefix for namespace isolation and
 * provides a consistent interface for the auth package.
 *
 * For production web deployments, session tokens should also be secured
 * via httpOnly cookies set by the Supabase SSR helpers in the Next.js
 * middleware layer. This adapter handles the client-side persistence
 * that Supabase needs for SPA-style session management.
 */
export function createWebStorage(): TokenStorage {
  return {
    async getItem(key: string): Promise<string | null> {
      try {
        return globalThis.localStorage?.getItem(prefixedKey(key)) ?? null;
      } catch {
        // localStorage may throw in private browsing or when storage is full
        return null;
      }
    },
    async setItem(key: string, value: string): Promise<void> {
      try {
        globalThis.localStorage?.setItem(prefixedKey(key), value);
      } catch {
        // Silently fail -- session won't persist but app still works
      }
    },
    async removeItem(key: string): Promise<void> {
      try {
        globalThis.localStorage?.removeItem(prefixedKey(key));
      } catch {
        // Removal failure is not critical
      }
    },
  };
}

// ── In-memory storage (tests / SSR) ─────────────────────────────────

/**
 * In-memory storage for test environments and server-side rendering
 * where neither Keychain nor localStorage is available.
 */
export function createMemoryStorage(): TokenStorage {
  const store = new Map<string, string>();

  return {
    async getItem(key: string): Promise<string | null> {
      return store.get(prefixedKey(key)) ?? null;
    },
    async setItem(key: string, value: string): Promise<void> {
      store.set(prefixedKey(key), value);
    },
    async removeItem(key: string): Promise<void> {
      store.delete(prefixedKey(key));
    },
  };
}
