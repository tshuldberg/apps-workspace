import type { SupabaseClient, User, Session, AuthChangeEvent } from '@supabase/supabase-js';
import type { AuthState, AuthResult, PlanMode } from './types';

/** Initial auth state before any session check. */
export const INITIAL_AUTH_STATE: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: true,
};

/** Unauthenticated state (after session check completes with no user). */
export const UNAUTHENTICATED_STATE: AuthState = {
  user: null,
  session: null,
  isAuthenticated: false,
  isLoading: false,
};

/**
 * Returns true when the given plan mode requires Supabase authentication.
 *
 * Only `hosted` mode requires auth. `self_host` and `local_only` users
 * never need an account.
 */
export function requiresAuth(mode: PlanMode): boolean {
  return mode === 'hosted';
}

function toAuthState(user: User | null, session: Session | null, isLoading: boolean): AuthState {
  return {
    user,
    session,
    isAuthenticated: user !== null && session !== null,
    isLoading,
  };
}

function toAuthResult(
  user: User | null,
  session: Session | null,
  error: string | null,
): AuthResult {
  return {
    success: error === null && user !== null,
    user,
    session,
    error,
  };
}

export type AuthStateListener = (state: AuthState) => void;

/**
 * Core auth service that wraps Supabase Auth.
 *
 * Consumers create an instance with a Supabase client, then subscribe to
 * state changes. The service is intentionally decoupled from React so it
 * can be used in non-React contexts (e.g. background sync workers).
 */
export class AuthService {
  private client: SupabaseClient;
  private state: AuthState = INITIAL_AUTH_STATE;
  private listeners = new Set<AuthStateListener>();
  private unsubscribeSupabase: (() => void) | null = null;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /** Current auth state snapshot. */
  getState(): AuthState {
    return this.state;
  }

  /**
   * Start listening to Supabase auth state changes and perform an
   * initial session recovery. Call this once during app initialization.
   *
   * This method is non-blocking: it will not prevent the app from
   * rendering while it checks for an existing session.
   */
  initialize(): void {
    const { data: { subscription } } = this.client.auth.onAuthStateChange(
      (_event: AuthChangeEvent, session: Session | null) => {
        this.setState(toAuthState(session?.user ?? null, session, false));
      },
    );
    this.unsubscribeSupabase = () => subscription.unsubscribe();

    // Recover existing session in the background
    void this.recoverSession();
  }

  /** Clean up the Supabase listener. */
  destroy(): void {
    this.unsubscribeSupabase?.();
    this.unsubscribeSupabase = null;
    this.listeners.clear();
  }

  /** Subscribe to auth state changes. Returns an unsubscribe function. */
  subscribe(listener: AuthStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /** Sign up with email and password. */
  async signUp(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signUp({ email, password });
    if (error) return toAuthResult(null, null, error.message);
    return toAuthResult(data.user, data.session, null);
  }

  /** Sign in with email and password. */
  async signIn(email: string, password: string): Promise<AuthResult> {
    const { data, error } = await this.client.auth.signInWithPassword({ email, password });
    if (error) return toAuthResult(null, null, error.message);
    return toAuthResult(data.user, data.session, null);
  }

  /** Sign out and clear session. */
  async signOut(): Promise<void> {
    await this.client.auth.signOut();
    this.setState(UNAUTHENTICATED_STATE);
  }

  /** Get the current session, or null if not authenticated. */
  async getSession(): Promise<Session | null> {
    const { data } = await this.client.auth.getSession();
    return data.session;
  }

  /**
   * Subscribe to raw Supabase auth state change events.
   *
   * This exposes the underlying `onAuthStateChange` for consumers that
   * need event-level granularity (e.g. TOKEN_REFRESHED, PASSWORD_RECOVERY).
   * Most consumers should use `subscribe()` instead.
   */
  onAuthStateChange(
    callback: (event: AuthChangeEvent, session: Session | null) => void,
  ): () => void {
    const { data: { subscription } } = this.client.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  }

  /**
   * Delete the currently authenticated user's account.
   *
   * Calls Supabase Auth to remove the user. On success, clears the local
   * session state. Server-side data deletion completes within 30 days per
   * Supabase's retention policy.
   *
   * The caller must confirm the user's intent before calling this method
   * (e.g. via a two-step confirmation dialog).
   */
  async deleteAccount(): Promise<AuthResult> {
    const { data: { session } } = await this.client.auth.getSession();
    if (!session) {
      return toAuthResult(null, null, 'You must be signed in to delete your account.');
    }

    // Supabase client-side deleteUser() requires the user to be authenticated.
    // The JS client v2 exposes this via auth.admin or via an RPC call.
    // For client-side deletion, we use the user's own session to call the
    // Supabase management API endpoint directly.
    const { error } = await this.client.rpc('delete_user');

    if (error) {
      // Fall back to signing out if the RPC is not set up
      if (error.message.includes('function') || error.code === '42883') {
        return toAuthResult(null, null, 'Account deletion is not available. Contact support.');
      }
      return toAuthResult(null, null, error.message);
    }

    // Clear local session state after successful server deletion
    await this.client.auth.signOut();
    this.setState(UNAUTHENTICATED_STATE);

    return { success: true, user: null, session: null, error: null };
  }

  private async recoverSession(): Promise<void> {
    const { data } = await this.client.auth.getSession();
    const session = data.session;
    this.setState(toAuthState(session?.user ?? null, session, false));
  }

  private setState(newState: AuthState): void {
    this.state = newState;
    for (const listener of this.listeners) {
      listener(newState);
    }
  }
}
