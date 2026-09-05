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
import { createExpoSecureStorage, getSupabaseClient } from '@mylife/auth';
import { initBestChefClient, resetBestChefClient } from '@mylife/bestchef';
import {
  resetSocialClient,
  setSocialClient,
  SocialClient,
  type SocialProfile,
} from '@mylife/social';
import type { SupabaseClient, User } from '@supabase/supabase-js';
import { completeBestChefAuthLink } from '../data/auth-links';
import {
  getBestChefAuthRedirectUrl,
  getBestChefCloudConfig,
  getBestChefLaunchEnv,
} from '../data/launch-environment';

type BestChefAuthLinkStatus = 'idle' | 'processing' | 'completed' | 'recovery' | 'error';

interface BestChefCloudContextValue {
  isConfigured: boolean;
  isReady: boolean;
  profile: SocialProfile | null;
  user: User | null;
  userId: string | null;
  isAnonymous: boolean;
  authProviders: string[];
  authLinkStatus: BestChefAuthLinkStatus;
  authLinkMessage: string | null;
  error: string | null;
  supabase: SupabaseClient | null;
  refreshProfile: () => Promise<void>;
  requestEmailLink: (email: string) => Promise<void>;
  requestPasswordRecovery: (email: string) => Promise<void>;
  handleAuthUrl: (url: string) => Promise<void>;
}

const BestChefCloudContext = createContext<BestChefCloudContextValue>({
  isConfigured: false,
  isReady: false,
  profile: null,
  user: null,
  userId: null,
  isAnonymous: false,
  authProviders: [],
  authLinkStatus: 'idle',
  authLinkMessage: null,
  error: null,
  supabase: null,
  refreshProfile: async () => {},
  requestEmailLink: async () => {},
  requestPasswordRecovery: async () => {},
  handleAuthUrl: async () => {},
});

function buildProfileHandle(userId: string): string {
  return `chef_${userId.replace(/-/g, '').slice(0, 16).toLowerCase()}`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function assertEmail(email: string): string {
  const normalized = normalizeEmail(email);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    throw new Error('Enter a valid email address.');
  }
  return normalized;
}

function getAuthProviders(user: User | null): string[] {
  if (!user) return [];
  const providers = new Set<string>();
  if (user.is_anonymous) providers.add('anonymous');
  if (user.email) providers.add('email');
  if (user.phone) providers.add('phone');
  for (const identity of user.identities ?? []) {
    if (identity.provider) providers.add(identity.provider);
  }
  return [...providers];
}

function isAnonymousUser(user: User | null): boolean {
  if (!user) return false;
  const providers = getAuthProviders(user);
  return user.is_anonymous === true || providers.every((provider) => provider === 'anonymous');
}

function authRedirectUrl(): string {
  return getBestChefAuthRedirectUrl(getBestChefLaunchEnv(), (path) => ExpoLinking.createURL(path));
}

async function ensureAnonymousSession(supabase: SupabaseClient): Promise<User> {
  const sessionResult = await supabase.auth.getSession();
  const sessionUser = sessionResult.data.session?.user;
  if (sessionUser) return sessionUser;

  const { data, error } = await supabase.auth.signInAnonymously();
  if (error) throw new Error(error.message);
  if (!data.user) throw new Error('Anonymous sign-in did not return a user.');
  return data.user;
}

async function ensureSocialProfile(
  supabase: SupabaseClient,
): Promise<SocialProfile> {
  const social = new SocialClient(supabase);
  const existing = await social.getMyProfile();
  if (existing.ok && existing.data) return existing.data;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Supabase user session is not available.');

  const created = await social.createProfile({
    handle: buildProfileHandle(user.id),
    displayName: 'BestChef Cook',
  });

  if (created.ok) return created.data;

  const retried = await social.getMyProfile();
  if (retried.ok && retried.data) return retried.data;
  throw new Error(created.error);
}

export function BestChefCloudProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const cloudConfigResult = useMemo(() => getBestChefCloudConfig(), []);
  const config = useMemo(() => (
    cloudConfigResult.ok
      ? { url: cloudConfigResult.config.url, anonKey: cloudConfigResult.config.anonKey }
      : null
  ), [cloudConfigResult]);
  const configError = cloudConfigResult.ok ? null : cloudConfigResult.error;
  const [profile, setProfile] = useState<SocialProfile | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [authLinkStatus, setAuthLinkStatus] = useState<BestChefAuthLinkStatus>('idle');
  const [authLinkMessage, setAuthLinkMessage] = useState<string | null>(null);
  const handledAuthUrlsRef = useRef<Set<string>>(new Set());

  const supabase = useMemo(() => {
    if (!config) return null;
    return getSupabaseClient({
      url: config.url,
      anonKey: config.anonKey,
      storage: createExpoSecureStorage(SecureStore),
    });
  }, [config]);

  const refreshProfile = useCallback(async () => {
    if (!supabase) return;
    const nextProfile = await ensureSocialProfile(supabase);
    setProfile(nextProfile);
  }, [supabase]);

  const refreshUser = useCallback(async () => {
    if (!supabase) return null;
    const { data, error: userError } = await supabase.auth.getUser();
    if (userError) throw new Error(userError.message);
    setUser(data.user ?? null);
    return data.user ?? null;
  }, [supabase]);

  const handleAuthUrl = useCallback(async (url: string) => {
    if (!supabase || handledAuthUrlsRef.current.has(url)) return;
    handledAuthUrlsRef.current.add(url);
    setAuthLinkStatus('processing');
    setAuthLinkMessage('Completing BestChef sign-in.');

    try {
      const result = await completeBestChefAuthLink(supabase, url);
      if (!result.handled) {
        setAuthLinkStatus('idle');
        setAuthLinkMessage(null);
        return;
      }

      await refreshUser();
      await refreshProfile();
      setAuthLinkStatus(result.isRecovery ? 'recovery' : 'completed');
      setAuthLinkMessage(
        result.isRecovery
          ? 'Recovery link confirmed. Your BestChef session is active on this device.'
          : 'BestChef account link confirmed. Your cloud profile is active on this device.',
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setAuthLinkStatus('error');
      setAuthLinkMessage(message);
      setError(message);
    }
  }, [refreshProfile, refreshUser, supabase]);

  const requestEmailLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('BestChef cloud is not configured.');
    const normalizedEmail = assertEmail(email);
    const currentUser = await refreshUser();
    const redirectTo = authRedirectUrl();

    if (currentUser?.is_anonymous) {
      const { error: linkError } = await supabase.auth.updateUser(
        { email: normalizedEmail },
        { emailRedirectTo: redirectTo },
      );
      if (linkError) throw new Error(linkError.message);
      return;
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: redirectTo,
        shouldCreateUser: true,
      },
    });
    if (otpError) throw new Error(otpError.message);
  }, [refreshUser, supabase]);

  const requestPasswordRecovery = useCallback(async (email: string) => {
    if (!supabase) throw new Error('BestChef cloud is not configured.');
    const normalizedEmail = assertEmail(email);
    const { error: recoveryError } = await supabase.auth.resetPasswordForEmail(
      normalizedEmail,
      { redirectTo: authRedirectUrl() },
    );
    if (recoveryError) throw new Error(recoveryError.message);
  }, [supabase]);

  useEffect(() => {
    let mounted = true;

    if (!supabase) {
      resetBestChefClient();
      resetSocialClient();
      setProfile(null);
      setUser(null);
      setError(configError);
      setIsReady(false);
      return () => {
        mounted = false;
      };
    }

    initBestChefClient(supabase);
    setSocialClient(supabase);

    void (async () => {
      try {
        const nextUser = await ensureAnonymousSession(supabase);
        const nextProfile = await ensureSocialProfile(supabase);
        if (!mounted) return;
        setUser(nextUser);
        setProfile(nextProfile);
        setError(null);
        setIsReady(true);
      } catch (err) {
        if (!mounted) return;
        setProfile(null);
        setUser(null);
        setError(err instanceof Error ? err.message : String(err));
        setIsReady(false);
      }
    })();

    const authSubscription = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    void ExpoLinking.getInitialURL()
      .then((url) => {
        if (url) return handleAuthUrl(url);
        return undefined;
      })
      .catch((err) => {
        if (__DEV__) console.warn('[BestChefCloudProvider] getInitialURL', err);
      });

    const linkSubscription = ExpoLinking.addEventListener('url', ({ url }) => {
      void handleAuthUrl(url);
    });

    return () => {
      mounted = false;
      authSubscription.data.subscription.unsubscribe();
      linkSubscription.remove();
    };
  }, [configError, handleAuthUrl, supabase]);

  const authProviders = useMemo(() => getAuthProviders(user), [user]);

  const value = useMemo<BestChefCloudContextValue>(() => ({
    isConfigured: supabase !== null,
    isReady,
    profile,
    user,
    userId: user?.id ?? null,
    isAnonymous: isAnonymousUser(user),
    authProviders,
    authLinkStatus,
    authLinkMessage,
    error,
    supabase,
    refreshProfile,
    requestEmailLink,
    requestPasswordRecovery,
    handleAuthUrl,
  }), [
    authProviders,
    authLinkMessage,
    authLinkStatus,
    error,
    handleAuthUrl,
    isReady,
    profile,
    refreshProfile,
    requestEmailLink,
    requestPasswordRecovery,
    supabase,
    user,
  ]);

  return (
    <BestChefCloudContext.Provider value={value}>
      {children}
    </BestChefCloudContext.Provider>
  );
}

export function useBestChefCloud(): BestChefCloudContextValue {
  return useContext(BestChefCloudContext);
}
