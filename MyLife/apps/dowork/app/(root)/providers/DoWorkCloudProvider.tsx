import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';
import * as ExpoLinking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js';
import {
  getDoWorkAuthRedirectUrl,
  getDoWorkCloudConfig,
  type DoWorkCloudEnvironment,
} from '../data/launch-environment';
import {
  ensureAnonymousSession,
  requestEmailMagicLink,
  requestPasswordReset,
  signInWithEmailPassword,
  signOut,
} from '../data/account';
import { isAnonymousUser } from '../data/auth-session';
import { isTimeoutError, withTimeout } from '../data/async-timeout';
import { ensureUserProfile, type CloudUserProfile } from '../data/cloud-profiles';
import { getMyTrainerProfile, type CloudTrainerProfile } from '../data/cloud-trainers';
import { hasPushTokens, refreshPushTokenIfEnabled, removePushTokens } from '../data/push';
import {
  clearAllPendingQueues,
  flushAllPendingQueues,
  hydratePendingQueues,
  persistPendingQueues,
} from '../data/pending-queues';
import { useDatabase } from './DatabaseProvider';

const CLOUD_INIT_TIMEOUT_MS = 12_000;
const CLOUD_UNREACHABLE_MESSAGE = "Can't reach the server right now.";

export type DoWorkCloudStatus =
  | 'unconfigured'
  | 'initializing'
  | 'ready'
  | 'unreachable'
  | 'error';

export interface DoWorkCloudContextValue {
  isConfigured: boolean;
  isReady: boolean;
  status: DoWorkCloudStatus;
  user: User | null;
  userId: string | null;
  isAnonymous: boolean;
  authProviders: string[];
  environment: DoWorkCloudEnvironment;
  error: string | null;
  supabase: SupabaseClient | null;
  profile: CloudUserProfile | null;
  trainerProfile: CloudTrainerProfile | null;
  refreshIdentity: () => Promise<void>;
  requestEmailLink: (email: string) => Promise<void>;
  requestPasswordRecovery: (email: string) => Promise<void>;
  signInWithPassword: (email: string, password: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  retryConnection: () => Promise<void>;
}

const defaultValue: DoWorkCloudContextValue = {
  isConfigured: false,
  isReady: false,
  status: 'unconfigured',
  user: null,
  userId: null,
  isAnonymous: false,
  authProviders: [],
  environment: 'unknown',
  error: null,
  supabase: null,
  profile: null,
  trainerProfile: null,
  refreshIdentity: async () => {},
  requestEmailLink: async () => {},
  requestPasswordRecovery: async () => {},
  signInWithPassword: async () => {},
  signOutUser: async () => {},
  retryConnection: async () => {},
};

const DoWorkCloudContext = createContext<DoWorkCloudContextValue>(defaultValue);

export function useDoWorkCloud(): DoWorkCloudContextValue {
  return useContext(DoWorkCloudContext);
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

const SECURE_STORE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  keychainService: 'com.dowork.dowork.auth',
};

const expoSecureStorage = {
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

export function DoWorkCloudProvider({ children }: { children: React.ReactNode }) {
  const db = useDatabase();
  const [supabase, setSupabase] = useState<SupabaseClient | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CloudUserProfile | null>(null);
  const [trainerProfile, setTrainerProfile] = useState<CloudTrainerProfile | null>(null);
  const [environment, setEnvironment] = useState<DoWorkCloudEnvironment>('unknown');
  const [error, setError] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<DoWorkCloudStatus>('initializing');
  const mountedRef = useRef(true);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const initializeCloudSession = useCallback(
    async (client: SupabaseClient) => {
      setIsReady(false);
      setStatus('initializing');
      setError(null);
      try {
        const sessionUser = await withTimeout(
          (async () => {
            const nextUser = await ensureAnonymousSession(client);
            await flushAllPendingQueues(client, db);
            return nextUser;
          })(),
          CLOUD_INIT_TIMEOUT_MS,
          CLOUD_UNREACHABLE_MESSAGE,
        );
        if (!mountedRef.current) return;
        setUser(sessionUser);
        setStatus('ready');
      } catch (err) {
        if (!mountedRef.current) return;
        const unreachable = isTimeoutError(err);
        setStatus(unreachable ? 'unreachable' : 'error');
        setError(unreachable ? CLOUD_UNREACHABLE_MESSAGE : err instanceof Error ? err.message : String(err));
      } finally {
        if (mountedRef.current) setIsReady(true);
      }
    },
    [db],
  );

  useEffect(() => {
    // Restore offline queues before anything can enqueue or flush.
    try {
      hydratePendingQueues(db);
    } catch {
      // hub_settings may not exist on a fresh install mid-migration; the
      // queues just start empty in that case.
    }

    const cloudResult = getDoWorkCloudConfig();
    if (!cloudResult.ok) {
      setError(cloudResult.error);
      setStatus('unconfigured');
      setIsReady(true);
      return;
    }

    const client = createClient(cloudResult.config.url, cloudResult.config.anonKey, {
      auth: {
        storage: expoSecureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
        // PKCE: email links carry ?code=, exchanged in auth-callback.tsx via
        // exchangeCodeForSession against the verifier persisted in this store.
        flowType: 'pkce',
      },
    });

    setSupabase(client);
    setEnvironment(cloudResult.config.environment);
    setStatus('initializing');

    let mounted = true;

    // Identity transition guard: when the auth uid CHANGES (anonymous user
    // signs into an email account without an explicit sign-out), queued cloud
    // ops composed under the old identity must not survive into the new one.
    // Explicit sign-out already clears queues in signOutUser; this covers the
    // in-place identity swap path.
    let lastUid: string | null = null;
    const subscription = client.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      const nextUid = session?.user?.id ?? null;
      if (lastUid !== null && nextUid !== null && nextUid !== lastUid) {
        try {
          clearAllPendingQueues(db);
        } catch {
          // hub_settings may be unavailable mid-migration; in-memory queues
          // are cleared regardless inside clearAllPendingQueues.
        }
      }
      lastUid = nextUid ?? lastUid;
      setUser(session?.user ?? null);
    });

    void initializeCloudSession(client);

    return () => {
      mounted = false;
      subscription.data.subscription.unsubscribe();
    };
    // db is stable for the app lifetime (DatabaseProvider gates rendering).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initializeCloudSession]);

  // Identity: every session (anonymous included) gets a dw_user_profiles
  // row with a generated handle, so cloud content is never authorless.
  // Trainer status is the cloud dw_trainers row, not a local mode.
  const refreshIdentity = useCallback(async () => {
    if (!supabase || !user?.id) {
      setProfile(null);
      setTrainerProfile(null);
      return;
    }
    const [profileResult, trainerResult] = await Promise.all([
      ensureUserProfile(supabase, user.id),
      getMyTrainerProfile(supabase, user.id),
    ]);
    setProfile(profileResult.ok ? profileResult.profile : null);
    setTrainerProfile(trainerResult.ok ? trainerResult.trainer : null);
  }, [supabase, user?.id]);

  useEffect(() => {
    void refreshIdentity();
  }, [refreshIdentity]);

  // On sign-in, keep an existing push registration current (Expo tokens rotate)
  // without prompting and without resurrecting a subscription the user turned
  // off: only refresh when a token row already exists. Opting in for the first
  // time happens explicitly from the notification-preferences screen.
  useEffect(() => {
    if (!supabase || !user?.id) return;
    const uid = user.id;
    let active = true;
    void (async () => {
      try {
        const existing = await hasPushTokens(supabase, uid);
        if (!active || !existing.ok || !existing.exists) return;
        await refreshPushTokenIfEnabled(supabase, uid);
      } catch {
        // Token refresh is best-effort; a stale token self-heals via the
        // DeviceNotRegistered prune in dowork-notify.
      }
    })();
    return () => {
      active = false;
    };
  }, [supabase, user?.id]);

  // Foreground: retry queued cloud ops. Background: persist them.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && supabase) {
        void flushAllPendingQueues(supabase, db);
      } else if (state === 'background' || state === 'inactive') {
        try {
          persistPendingQueues(db);
        } catch {
          // Persisting queues is best-effort on the way out.
        }
      }
    });
    return () => subscription.remove();
  }, [supabase, db]);

  const requestEmailLink = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error('Cloud is not configured.');
      const redirectUrl = getDoWorkAuthRedirectUrl(process.env, (path) =>
        ExpoLinking.createURL(path),
      );
      const result = await requestEmailMagicLink(supabase, { email, redirectUrl });
      if (!result.ok) throw new Error(result.error ?? 'Could not send email link.');
    },
    [supabase],
  );

  const requestPasswordRecovery = useCallback(
    async (email: string) => {
      if (!supabase) throw new Error('Cloud is not configured.');
      const redirectUrl = getDoWorkAuthRedirectUrl(process.env, (path) =>
        ExpoLinking.createURL(path),
      );
      const result = await requestPasswordReset(supabase, { email, redirectUrl });
      if (!result.ok) throw new Error(result.error ?? 'Could not send recovery email.');
    },
    [supabase],
  );

  const signInWithPasswordCredentials = useCallback(
    async (email: string, password: string) => {
      if (!supabase) throw new Error('Cloud is not configured.');
      const result = await signInWithEmailPassword(supabase, { email, password });
      if (!result.ok) throw new Error(result.error ?? 'Sign-in failed.');
    },
    [supabase],
  );

  const signOutUser = useCallback(async () => {
    if (!supabase) return;
    // Drop queued cloud ops (memory + persisted KV) while still signed in, so a
    // share/comment/like parked under this identity can never flush under the
    // next anonymous session. These are local wipes; being authenticated is fine.
    try {
      clearAllPendingQueues(db);
    } catch {
      // hub_settings may be unavailable mid-migration; the in-memory arrays are
      // cleared inside clearAllPendingQueues regardless.
    }
    // Drop this device's push tokens while still authenticated (owner RLS needs
    // the session) so a signed-out device stops receiving notifications.
    try {
      await removePushTokens(supabase, user?.id ?? null);
    } catch {
      // Best-effort: dowork-notify also prunes tokens on DeviceNotRegistered.
    }
    const result = await signOut(supabase);
    if (!result.ok) throw new Error(result.error ?? 'Sign-out failed.');
  }, [supabase, user?.id, db]);

  const retryConnection = useCallback(async () => {
    if (!supabase) return;
    await initializeCloudSession(supabase);
  }, [initializeCloudSession, supabase]);

  const value = useMemo<DoWorkCloudContextValue>(
    () => ({
      isConfigured: supabase !== null,
      isReady,
      status,
      user,
      userId: user?.id ?? null,
      isAnonymous: user ? isAnonymousUser(user) : false,
      authProviders: getAuthProviders(user),
      environment,
      error,
      supabase,
      profile,
      trainerProfile,
      refreshIdentity,
      requestEmailLink,
      requestPasswordRecovery,
      signInWithPassword: signInWithPasswordCredentials,
      signOutUser,
      retryConnection,
    }),
    [
      supabase,
      isReady,
      status,
      user,
      environment,
      error,
      profile,
      trainerProfile,
      refreshIdentity,
      requestEmailLink,
      requestPasswordRecovery,
      signInWithPasswordCredentials,
      signOutUser,
      retryConnection,
    ],
  );

  return (
    <DoWorkCloudContext.Provider value={value}>
      {children}
    </DoWorkCloudContext.Provider>
  );
}
