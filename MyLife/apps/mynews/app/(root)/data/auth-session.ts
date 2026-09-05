// C1 auth session logic, pure and DI-testable. All Supabase interaction goes
// through the injected SupabaseAuthLike surface; AuthProvider wraps this with
// React state and the expo-linking callback listener. Reading needs no account:
// sessions are created lazily by ensureSession when a flow actually needs one.

export type MyNewsAuthStatus = 'unconfigured' | 'loading' | 'signed-out' | 'anonymous' | 'linked';

export interface AuthUserLike {
  id: string;
  email?: string | null;
  is_anonymous?: boolean;
}

export interface AuthSessionLike {
  access_token: string;
  user: AuthUserLike;
}

export interface AuthErrorLike {
  message: string;
}

export type AuthOtpType = 'signup' | 'invite' | 'magiclink' | 'recovery' | 'email_change' | 'email';

/**
 * Structural slice of supabase-js's GoTrue client. The real client (via
 * @mylife/auth/client) satisfies this; tests inject a fake. Declared as
 * method shorthand so the real client's richer signatures stay assignable.
 */
export interface SupabaseAuthLike {
  getSession(): Promise<{ data: { session: AuthSessionLike | null }; error: AuthErrorLike | null }>;
  signInAnonymously(): Promise<{
    data: { user: AuthUserLike | null; session: AuthSessionLike | null };
    error: AuthErrorLike | null;
  }>;
  updateUser(
    attributes: { email: string },
    options?: { emailRedirectTo?: string },
  ): Promise<{ error: AuthErrorLike | null }>;
  signInWithOtp(credentials: {
    email: string;
    options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
  }): Promise<{ error: AuthErrorLike | null }>;
  signOut(): Promise<{ error: AuthErrorLike | null }>;
  setSession(tokens: {
    access_token: string;
    refresh_token: string;
  }): Promise<{ error: AuthErrorLike | null }>;
  verifyOtp(params: { token_hash: string; type: AuthOtpType }): Promise<{ error: AuthErrorLike | null }>;
  exchangeCodeForSession(code: string): Promise<{ error: AuthErrorLike | null }>;
}

export interface AuthSnapshot {
  status: MyNewsAuthStatus;
  userId: string | null;
  email: string | null;
}

export interface MyNewsAuthSessionConfig {
  /** Deep-link target for magic links, e.g. Linking.createURL('auth-callback'). */
  redirectUrl: string;
}

export interface MyNewsAuthSession {
  readonly isConfigured: boolean;
  ensureSession(): Promise<{ ok: true; userId: string } | { ok: false; error: string }>;
  linkEmail(email: string): Promise<{ ok: boolean; error?: string }>;
  signInWithEmail(email: string): Promise<{ ok: boolean; error?: string }>;
  signOut(): Promise<void>;
  getAccessToken(): Promise<string | null>;
  getSnapshot(): Promise<AuthSnapshot>;
  handleAuthUrl(url: string): Promise<{ handled: boolean; error?: string }>;
}

/** C1 status mapping: no session -> signed-out, is_anonymous -> anonymous, else linked. */
export function snapshotFromSession(session: AuthSessionLike | null): AuthSnapshot {
  if (!session) return { status: 'signed-out', userId: null, email: null };
  if (session.user.is_anonymous === true) {
    return { status: 'anonymous', userId: session.user.id, email: null };
  }
  return { status: 'linked', userId: session.user.id, email: session.user.email ?? null };
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeEmail(email: string): string | null {
  const normalized = email.trim().toLowerCase();
  return EMAIL_RE.test(normalized) ? normalized : null;
}

function errorText(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// ── Auth callback URL parsing ────────────────────────────────────────────────
// Magic links land as mynews://auth-callback with tokens in the URL fragment
// (implicit flow) or as token_hash/code query params. Parsed manually because
// React Native's URL support is partial; params may sit after '?' or '#'.

const OTP_TYPES: ReadonlySet<string> = new Set([
  'signup',
  'invite',
  'magiclink',
  'recovery',
  'email_change',
  'email',
]);

export interface ParsedAuthCallback {
  code: string | null;
  accessToken: string | null;
  refreshToken: string | null;
  tokenHash: string | null;
  type: AuthOtpType | null;
  error: string | null;
}

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '));
  } catch {
    return value;
  }
}

function collectParams(url: string): Map<string, string> {
  const params = new Map<string, string>();
  const hashIndex = url.indexOf('#');
  const queryIndex = url.indexOf('?');
  const segments: Array<[number, number]> = [];
  if (queryIndex !== -1 && (hashIndex === -1 || queryIndex < hashIndex)) {
    segments.push([queryIndex + 1, hashIndex === -1 ? url.length : hashIndex]);
  }
  if (hashIndex !== -1 && hashIndex + 1 < url.length) {
    const nestedQuery = url.indexOf('?', hashIndex + 1);
    segments.push([nestedQuery === -1 ? hashIndex + 1 : nestedQuery + 1, url.length]);
  }
  for (const [start, end] of segments) {
    for (const pair of url.slice(start, end).split('&')) {
      if (!pair) continue;
      const eq = pair.indexOf('=');
      const key = eq === -1 ? pair : pair.slice(0, eq);
      const raw = eq === -1 ? '' : pair.slice(eq + 1);
      if (key && !params.has(key)) params.set(key, safeDecode(raw));
    }
  }
  return params;
}

/**
 * Fold a handleAuthUrl result into the provider's last-auth-error state:
 * a handled failure surfaces its reason, a handled success clears any prior
 * failure, and non-auth URLs leave the state untouched.
 */
export function nextAuthError(
  previous: string | null,
  result: { handled: boolean; error?: string },
): string | null {
  if (!result.handled) return previous;
  return result.error ?? null;
}

/** Returns null when the URL carries no auth signal (ordinary deep link). */
export function parseAuthCallbackUrl(url: string): ParsedAuthCallback | null {
  const params = collectParams(url);
  const rawType = params.get('type')?.trim().toLowerCase() ?? null;
  const parsed: ParsedAuthCallback = {
    code: params.get('code') ?? null,
    accessToken: params.get('access_token') ?? null,
    refreshToken: params.get('refresh_token') ?? null,
    tokenHash: params.get('token_hash') ?? null,
    type: rawType && OTP_TYPES.has(rawType) ? (rawType as AuthOtpType) : null,
    error: params.get('error_description') ?? params.get('error') ?? null,
  };
  const hasSignal = Boolean(
    parsed.code || (parsed.accessToken && parsed.refreshToken) || parsed.tokenHash || parsed.error,
  );
  return hasSignal ? parsed : null;
}

// ── Configured session ───────────────────────────────────────────────────────

export function createAuthSession(
  client: SupabaseAuthLike,
  config: MyNewsAuthSessionConfig,
): MyNewsAuthSession {
  // Concurrent ensureSession calls share one flight so a burst of gated
  // actions never mints more than one anonymous session.
  let ensureInFlight: Promise<{ ok: true; userId: string } | { ok: false; error: string }> | null =
    null;

  async function ensureOnce(): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
    try {
      const existing = await client.getSession();
      const session = existing.data.session;
      if (session) return { ok: true, userId: session.user.id };
      const anon = await client.signInAnonymously();
      if (anon.error) return { ok: false, error: anon.error.message };
      const user = anon.data.session?.user ?? anon.data.user;
      if (!user) return { ok: false, error: 'Anonymous sign-in did not return a user.' };
      return { ok: true, userId: user.id };
    } catch (err) {
      return { ok: false, error: errorText(err) };
    }
  }

  return {
    isConfigured: true,

    ensureSession() {
      if (!ensureInFlight) {
        ensureInFlight = ensureOnce().finally(() => {
          ensureInFlight = null;
        });
      }
      return ensureInFlight;
    },

    async linkEmail(email: string) {
      const normalized = normalizeEmail(email);
      if (!normalized) return { ok: false, error: 'Enter a valid email address.' };
      try {
        const { data } = await client.getSession();
        if (!data.session) {
          return { ok: false, error: 'No account on this device yet. Tap Create account first.' };
        }
        const { error } = await client.updateUser(
          { email: normalized },
          { emailRedirectTo: config.redirectUrl },
        );
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorText(err) };
      }
    },

    async signInWithEmail(email: string) {
      const normalized = normalizeEmail(email);
      if (!normalized) return { ok: false, error: 'Enter a valid email address.' };
      try {
        const { error } = await client.signInWithOtp({
          email: normalized,
          options: { emailRedirectTo: config.redirectUrl, shouldCreateUser: true },
        });
        if (error) return { ok: false, error: error.message };
        return { ok: true };
      } catch (err) {
        return { ok: false, error: errorText(err) };
      }
    },

    async signOut() {
      try {
        await client.signOut();
      } catch {
        // Local session teardown failing leaves the next getSnapshot honest.
      }
    },

    async getAccessToken() {
      try {
        const { data } = await client.getSession();
        return data.session?.access_token ?? null;
      } catch {
        return null;
      }
    },

    async getSnapshot() {
      try {
        const { data } = await client.getSession();
        return snapshotFromSession(data.session);
      } catch {
        return { status: 'signed-out', userId: null, email: null };
      }
    },

    async handleAuthUrl(url: string) {
      const parsed = parseAuthCallbackUrl(url);
      if (!parsed) return { handled: false };
      if (parsed.error) return { handled: true, error: parsed.error };
      try {
        if (parsed.accessToken && parsed.refreshToken) {
          const { error } = await client.setSession({
            access_token: parsed.accessToken,
            refresh_token: parsed.refreshToken,
          });
          return error ? { handled: true, error: error.message } : { handled: true };
        }
        if (parsed.code) {
          const { error } = await client.exchangeCodeForSession(parsed.code);
          return error ? { handled: true, error: error.message } : { handled: true };
        }
        if (parsed.tokenHash) {
          if (!parsed.type) {
            return { handled: true, error: 'The sign-in link is missing its verification type.' };
          }
          const { error } = await client.verifyOtp({
            token_hash: parsed.tokenHash,
            type: parsed.type,
          });
          return error ? { handled: true, error: error.message } : { handled: true };
        }
        return { handled: false };
      } catch (err) {
        return { handled: true, error: errorText(err) };
      }
    },
  };
}

// ── Unconfigured session (honesty boundary) ──────────────────────────────────

/** No server, no client, no fake sessions: every method names the real reason. */
export function createUnconfiguredAuthSession(reason: string): MyNewsAuthSession {
  return {
    isConfigured: false,
    async ensureSession() {
      return { ok: false, error: reason };
    },
    async linkEmail() {
      return { ok: false, error: reason };
    },
    async signInWithEmail() {
      return { ok: false, error: reason };
    },
    async signOut() {},
    async getAccessToken() {
      return null;
    },
    async getSnapshot() {
      return { status: 'unconfigured', userId: null, email: null };
    },
    async handleAuthUrl() {
      return { handled: false };
    },
  };
}
