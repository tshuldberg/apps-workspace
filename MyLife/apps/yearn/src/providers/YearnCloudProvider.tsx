import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import * as ExpoLinking from 'expo-linking';
import { Linking } from 'react-native';
import type { Session, User } from '@supabase/supabase-js';
import {
  getYearnAuthProviders,
  isYearnAnonymousUser,
  restoreYearnSession,
  signOutYearnSession,
  type YearnSessionSnapshot,
} from '../lib/authSession';
import {
  isYearnAppleSignInAvailable,
  isYearnAppleSignInCanceled,
  signInWithYearnApple,
} from '../lib/appleSignIn';
import {
  completeYearnAuthLink,
  type YearnAuthLinkResult,
} from '../lib/authLinks';
import {
  requestYearnEmailMagicLink,
  requestYearnPhoneOtp,
  startYearnGoogleAuth,
  verifyYearnPhoneOtp,
  type YearnOAuthStartResult,
} from '../lib/secondaryAuth';
import {
  createYearnSupabaseClient,
  type AnySupabaseClient,
} from '../lib/supabase';
import {
  getYearnAuthRedirectUrl,
  type YearnCloudEnvironment,
} from '../lib/launchEnvironment';

export type YearnAuthLinkStatus =
  | 'idle'
  | 'processing'
  | 'completed'
  | 'recovery'
  | 'error';

export interface YearnCloudContextValue {
  isConfigured: boolean;
  isReady: boolean;
  isAuthenticated: boolean;
  isAnonymous: boolean;
  environment: YearnCloudEnvironment;
  projectRef: string | null;
  error: string | null;
  session: Session | null;
  user: User | null;
  userId: string | null;
  authProviders: string[];
  authLinkStatus: YearnAuthLinkStatus;
  authLinkMessage: string | null;
  supabase: AnySupabaseClient | null;
  isAppleSignInAvailable: boolean;
  refreshSession: () => Promise<YearnSessionSnapshot | null>;
  signInWithApple: () => Promise<YearnSessionSnapshot | null>;
  signInWithGoogle: () => Promise<YearnOAuthStartResult | null>;
  requestEmailMagicLink: (email: string) => Promise<string | null>;
  requestPhoneOtp: (phone: string) => Promise<string | null>;
  verifyPhoneOtp: (phone: string, token: string) => Promise<YearnSessionSnapshot | null>;
  handleAuthUrl: (url: string) => Promise<YearnAuthLinkResult | null>;
  signOut: () => Promise<void>;
}

const defaultValue: YearnCloudContextValue = {
  isConfigured: false,
  isReady: true,
  isAuthenticated: false,
  isAnonymous: false,
  environment: 'unknown',
  projectRef: null,
  error: null,
  session: null,
  user: null,
  userId: null,
  authProviders: [],
  authLinkStatus: 'idle',
  authLinkMessage: null,
  supabase: null,
  isAppleSignInAvailable: false,
  refreshSession: async () => null,
  signInWithApple: async () => null,
  signInWithGoogle: async () => null,
  requestEmailMagicLink: async () => null,
  requestPhoneOtp: async () => null,
  verifyPhoneOtp: async () => null,
  handleAuthUrl: async () => null,
  signOut: async () => {},
};

const YearnCloudContext = createContext<YearnCloudContextValue>(defaultValue);

function authRedirectUrl(): string {
  return getYearnAuthRedirectUrl(process.env, (path) => ExpoLinking.createURL(path));
}

export function YearnCloudProvider({ children }: { children: React.ReactNode }) {
  const cloudState = useMemo(() => createYearnSupabaseClient(), []);
  const supabase = cloudState.client;
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(cloudState.error);
  const [isReady, setIsReady] = useState(!supabase);
  const [isAppleSignInAvailableState, setIsAppleSignInAvailableState] = useState(false);
  const [authLinkStatus, setAuthLinkStatus] = useState<YearnAuthLinkStatus>('idle');
  const [authLinkMessage, setAuthLinkMessage] = useState<string | null>(null);

  const applySnapshot = useCallback((snapshot: YearnSessionSnapshot) => {
    setSession(snapshot.session);
    setUser(snapshot.user);
  }, []);

  const refreshSession = useCallback(async () => {
    if (!supabase) return null;
    const snapshot = await restoreYearnSession(supabase);
    applySnapshot(snapshot);
    setError(null);
    return snapshot;
  }, [applySnapshot, supabase]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await signOutYearnSession(supabase);
    applySnapshot({ session: null, user: null });
  }, [applySnapshot, supabase]);

  const signInWithApple = useCallback(async () => {
    if (!supabase) {
      throw new Error('Yearn Supabase environment is not configured.');
    }

    try {
      const snapshot = await signInWithYearnApple(supabase);
      applySnapshot(snapshot);
      setError(null);
      return snapshot;
    } catch (err) {
      if (isYearnAppleSignInCanceled(err)) {
        return null;
      }
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
      throw err;
    }
  }, [applySnapshot, supabase]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) {
      throw new Error('Yearn Supabase environment is not configured.');
    }

    try {
      setAuthLinkStatus('processing');
      setAuthLinkMessage('Opening Google sign-in.');
      setError(null);
      return await startYearnGoogleAuth(
        supabase,
        authRedirectUrl(),
        (url) => Linking.openURL(url),
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthLinkStatus('error');
      setAuthLinkMessage(message);
      setError(message);
      throw err;
    }
  }, [supabase]);

  const requestEmailMagicLink = useCallback(async (email: string) => {
    if (!supabase) {
      throw new Error('Yearn Supabase environment is not configured.');
    }

    try {
      const normalizedEmail = await requestYearnEmailMagicLink(
        supabase,
        email,
        authRedirectUrl(),
      );
      setAuthLinkStatus('idle');
      setAuthLinkMessage(`Magic link sent to ${normalizedEmail}.`);
      setError(null);
      return normalizedEmail;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthLinkStatus('error');
      setAuthLinkMessage(message);
      setError(message);
      throw err;
    }
  }, [supabase]);

  const requestPhoneOtp = useCallback(async (phone: string) => {
    if (!supabase) {
      throw new Error('Yearn Supabase environment is not configured.');
    }

    try {
      const normalizedPhone = await requestYearnPhoneOtp(supabase, phone);
      setAuthLinkStatus('idle');
      setAuthLinkMessage(`SMS code sent to ${normalizedPhone}.`);
      setError(null);
      return normalizedPhone;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthLinkStatus('error');
      setAuthLinkMessage(message);
      setError(message);
      throw err;
    }
  }, [supabase]);

  const verifyPhoneOtp = useCallback(async (phone: string, token: string) => {
    if (!supabase) {
      throw new Error('Yearn Supabase environment is not configured.');
    }

    try {
      const snapshot = await verifyYearnPhoneOtp(supabase, phone, token);
      applySnapshot(snapshot);
      setAuthLinkStatus('completed');
      setAuthLinkMessage('Phone sign-in confirmed.');
      setError(null);
      return snapshot;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthLinkStatus('error');
      setAuthLinkMessage(message);
      setError(message);
      throw err;
    }
  }, [applySnapshot, supabase]);

  const handleAuthUrl = useCallback(async (url: string) => {
    if (!supabase) return null;

    try {
      setAuthLinkStatus('processing');
      setAuthLinkMessage('Confirming account link.');
      const result = await completeYearnAuthLink(supabase, url);
      if (!result.handled) {
        setAuthLinkStatus('idle');
        setAuthLinkMessage(null);
        return result;
      }

      await refreshSession();
      setAuthLinkStatus(result.isRecovery ? 'recovery' : 'completed');
      setAuthLinkMessage(
        result.isRecovery
          ? 'Recovery link confirmed. Your Yearn session is active on this device.'
          : 'Account link confirmed. Your Yearn session is active on this device.',
      );
      setError(null);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthLinkStatus('error');
      setAuthLinkMessage(message);
      setError(message);
      throw err;
    }
  }, [refreshSession, supabase]);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setError(cloudState.error);
      setIsReady(true);
      return () => {
        mounted = false;
      };
    }

    setIsReady(false);

    void restoreYearnSession(supabase)
      .then((snapshot) => {
        if (!mounted) return;
        applySnapshot(snapshot);
        setError(null);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (mounted) setIsReady(true);
      });

    const subscription = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      applySnapshot({
        session: nextSession ?? null,
        user: nextSession?.user ?? null,
      });
      setError(null);
      setIsReady(true);
    });

    return () => {
      mounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [applySnapshot, cloudState.error, supabase]);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      return () => {
        mounted = false;
      };
    }

    void Linking.getInitialURL()
      .then((url) => {
        if (mounted && url) {
          void handleAuthUrl(url);
        }
      })
      .catch(() => {});

    const subscription = Linking.addEventListener('url', ({ url }) => {
      if (mounted) {
        void handleAuthUrl(url);
      }
    });

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, [handleAuthUrl, supabase]);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      setIsAppleSignInAvailableState(false);
      return () => {
        mounted = false;
      };
    }

    void isYearnAppleSignInAvailable()
      .then((available) => {
        if (mounted) setIsAppleSignInAvailableState(available);
      })
      .catch(() => {
        if (mounted) setIsAppleSignInAvailableState(false);
      });

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const authProviders = useMemo(() => getYearnAuthProviders(user), [user]);
  const isAnonymous = useMemo(() => isYearnAnonymousUser(user), [user]);

  const value = useMemo<YearnCloudContextValue>(
    () => ({
      isConfigured: supabase !== null,
      isReady,
      isAuthenticated: user !== null && !isAnonymous,
      isAnonymous,
      environment: cloudState.environment,
      projectRef: cloudState.projectRef,
      error,
      session,
      user,
      userId: user?.id ?? null,
      authProviders,
      authLinkStatus,
      authLinkMessage,
      supabase,
      isAppleSignInAvailable: isAppleSignInAvailableState,
      refreshSession,
      signInWithApple,
      signInWithGoogle,
      requestEmailMagicLink,
      requestPhoneOtp,
      verifyPhoneOtp,
      handleAuthUrl,
      signOut,
    }),
    [
      authLinkMessage,
      authLinkStatus,
      authProviders,
      cloudState.environment,
      cloudState.projectRef,
      error,
      handleAuthUrl,
      isAnonymous,
      isAppleSignInAvailableState,
      isReady,
      requestEmailMagicLink,
      requestPhoneOtp,
      refreshSession,
      session,
      signInWithApple,
      signInWithGoogle,
      signOut,
      supabase,
      user,
      verifyPhoneOtp,
    ],
  );

  return (
    <YearnCloudContext.Provider value={value}>
      {children}
    </YearnCloudContext.Provider>
  );
}

export function useYearnCloud(): YearnCloudContextValue {
  return useContext(YearnCloudContext);
}
