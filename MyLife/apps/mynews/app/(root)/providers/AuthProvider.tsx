import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as SecureStore from 'expo-secure-store';
import * as ExpoLinking from 'expo-linking';
import { getSupabaseClient } from '@mylife/auth/client';
import { createExpoSecureStorage } from '@mylife/auth/secure-storage';
import { getMyNewsCloudConfig } from '../data/launch-environment';
import {
  createAuthSession,
  createUnconfiguredAuthSession,
  nextAuthError,
  type AuthSnapshot,
  type MyNewsAuthSession,
  type MyNewsAuthStatus,
} from '../data/auth-session';

// C1 contract. Session logic lives in data/auth-session.ts; this provider only
// holds React state, the context, and the expo-linking magic-link listener.
export interface MyNewsAuth {
  status: MyNewsAuthStatus;
  userId: string | null;
  email: string | null;
  /** Reason the last magic-link callback failed; null after success or dismissal. */
  lastAuthError: string | null;
  clearAuthError(): void;
  ensureSession(): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
  linkEmail(email: string): Promise<{ ok: boolean; error?: string }>;
  signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
}

const UNCONFIGURED_REASON = 'Not connected to a MyNews server yet.';

const MyNewsAuthContext = createContext<MyNewsAuth>({
  status: 'unconfigured',
  userId: null,
  email: null,
  lastAuthError: null,
  clearAuthError: () => {},
  ensureSession: async () => ({ ok: false, error: UNCONFIGURED_REASON }),
  linkEmail: async () => ({ ok: false, error: UNCONFIGURED_REASON }),
  signInWithEmail: async () => ({ ok: false, error: UNCONFIGURED_REASON }),
  signOut: async () => {},
  getAccessToken: async () => null,
});

export function useMyNewsAuth(): MyNewsAuth {
  return useContext(MyNewsAuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const session = useMemo<MyNewsAuthSession>(() => {
    const result = getMyNewsCloudConfig();
    if (!result.ok) return createUnconfiguredAuthSession(result.reason);
    const client = getSupabaseClient({
      url: result.config.baseUrl,
      anonKey: result.config.anonKey,
      storage: createExpoSecureStorage(SecureStore),
    });
    return createAuthSession(client.auth, {
      redirectUrl: ExpoLinking.createURL('auth-callback'),
    });
  }, []);

  const [snapshot, setSnapshot] = useState<AuthSnapshot>(() =>
    session.isConfigured
      ? { status: 'loading', userId: null, email: null }
      : { status: 'unconfigured', userId: null, email: null },
  );
  const [lastAuthError, setLastAuthError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  const handledUrlsRef = useRef<Set<string>>(new Set());

  const refresh = useCallback(async () => {
    const next = await session.getSnapshot();
    if (mountedRef.current) setSnapshot(next);
  }, [session]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();
    if (!session.isConfigured) {
      return () => {
        mountedRef.current = false;
      };
    }

    const onUrl = async (url: string) => {
      if (handledUrlsRef.current.has(url)) return;
      handledUrlsRef.current.add(url);
      const result = await session.handleAuthUrl(url);
      // A handled failure surfaces its reason; a handled success clears it.
      if (mountedRef.current) setLastAuthError((prev) => nextAuthError(prev, result));
      if (result.handled) await refresh();
    };

    void ExpoLinking.getInitialURL()
      .then((url) => (url ? onUrl(url) : undefined))
      .catch((err) => {
        console.warn('[AuthProvider] getInitialURL failed', err);
      });
    const subscription = ExpoLinking.addEventListener('url', ({ url }) => {
      void onUrl(url);
    });

    return () => {
      mountedRef.current = false;
      subscription.remove();
    };
  }, [refresh, session]);

  const ensureSession = useCallback(async () => {
    const result = await session.ensureSession();
    await refresh();
    return result;
  }, [refresh, session]);

  const signOut = useCallback(async () => {
    await session.signOut();
    await refresh();
  }, [refresh, session]);

  const linkEmail = useCallback((email: string) => session.linkEmail(email), [session]);
  const signInWithEmail = useCallback(
    (email: string) => session.signInWithEmail(email),
    [session],
  );
  const getAccessToken = useCallback(() => session.getAccessToken(), [session]);
  const clearAuthError = useCallback(() => setLastAuthError(null), []);

  const value = useMemo<MyNewsAuth>(
    () => ({
      status: snapshot.status,
      userId: snapshot.userId,
      email: snapshot.email,
      lastAuthError,
      clearAuthError,
      ensureSession,
      linkEmail,
      signInWithEmail,
      signOut,
      getAccessToken,
    }),
    [
      clearAuthError,
      ensureSession,
      getAccessToken,
      lastAuthError,
      linkEmail,
      signInWithEmail,
      signOut,
      snapshot,
    ],
  );

  return <MyNewsAuthContext.Provider value={value}>{children}</MyNewsAuthContext.Provider>;
}
