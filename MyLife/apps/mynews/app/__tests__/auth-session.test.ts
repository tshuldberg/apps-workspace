import { describe, expect, it } from 'vitest';
import {
  createAuthSession,
  createUnconfiguredAuthSession,
  nextAuthError,
  parseAuthCallbackUrl,
  snapshotFromSession,
  type AuthSessionLike,
  type AuthErrorLike,
  type AuthOtpType,
  type SupabaseAuthLike,
} from '../(root)/data/auth-session';

const REDIRECT = 'mynews://auth-callback';

class FakeSupabaseAuth implements SupabaseAuthLike {
  session: AuthSessionLike | null = null;
  anonCalls = 0;
  anonError: string | null = null;
  updateUserCalls: Array<{ attrs: { email: string }; options?: { emailRedirectTo?: string } }> = [];
  otpCalls: Array<{
    email: string;
    options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
  }> = [];
  setSessionCalls: Array<{ access_token: string; refresh_token: string }> = [];
  verifyOtpCalls: Array<{ token_hash: string; type: AuthOtpType }> = [];
  exchangeCalls: string[] = [];
  signOutCalls = 0;

  async getSession() {
    return { data: { session: this.session }, error: null as AuthErrorLike | null };
  }

  async signInAnonymously() {
    this.anonCalls += 1;
    if (this.anonError) {
      return { data: { user: null, session: null }, error: { message: this.anonError } };
    }
    this.session = {
      access_token: 'anon-token',
      user: { id: 'anon-user-1', is_anonymous: true },
    };
    return { data: { user: this.session.user, session: this.session }, error: null };
  }

  async updateUser(attrs: { email: string }, options?: { emailRedirectTo?: string }) {
    this.updateUserCalls.push({ attrs, options });
    return { error: null };
  }

  async signInWithOtp(credentials: {
    email: string;
    options?: { emailRedirectTo?: string; shouldCreateUser?: boolean };
  }) {
    this.otpCalls.push(credentials);
    return { error: null };
  }

  async signOut() {
    this.signOutCalls += 1;
    this.session = null;
    return { error: null };
  }

  async setSession(tokens: { access_token: string; refresh_token: string }) {
    this.setSessionCalls.push(tokens);
    this.session = {
      access_token: tokens.access_token,
      user: { id: 'linked-user-1', email: 'reader@example.com', is_anonymous: false },
    };
    return { error: null };
  }

  async verifyOtp(params: { token_hash: string; type: AuthOtpType }) {
    this.verifyOtpCalls.push(params);
    return { error: null };
  }

  async exchangeCodeForSession(code: string) {
    this.exchangeCalls.push(code);
    return { error: null };
  }
}

function makeSession(fake: FakeSupabaseAuth) {
  return createAuthSession(fake, { redirectUrl: REDIRECT });
}

describe('snapshotFromSession', () => {
  it('maps no session to signed-out', () => {
    expect(snapshotFromSession(null)).toEqual({ status: 'signed-out', userId: null, email: null });
  });

  it('maps is_anonymous to anonymous', () => {
    const snap = snapshotFromSession({
      access_token: 't',
      user: { id: 'u1', is_anonymous: true },
    });
    expect(snap).toEqual({ status: 'anonymous', userId: 'u1', email: null });
  });

  it('maps a non-anonymous user to linked with its email', () => {
    const snap = snapshotFromSession({
      access_token: 't',
      user: { id: 'u2', email: 'a@b.co', is_anonymous: false },
    });
    expect(snap).toEqual({ status: 'linked', userId: 'u2', email: 'a@b.co' });
  });
});

describe('ensureSession', () => {
  it('reuses an existing session without creating an anonymous one', async () => {
    const fake = new FakeSupabaseAuth();
    fake.session = { access_token: 't', user: { id: 'existing', is_anonymous: false } };
    const result = await makeSession(fake).ensureSession();
    expect(result).toEqual({ ok: true, userId: 'existing' });
    expect(fake.anonCalls).toBe(0);
  });

  it('creates the anonymous session exactly once across sequential calls', async () => {
    const fake = new FakeSupabaseAuth();
    const session = makeSession(fake);
    const first = await session.ensureSession();
    const second = await session.ensureSession();
    expect(first).toEqual({ ok: true, userId: 'anon-user-1' });
    expect(second).toEqual({ ok: true, userId: 'anon-user-1' });
    expect(fake.anonCalls).toBe(1);
  });

  it('creates the anonymous session exactly once across concurrent calls', async () => {
    const fake = new FakeSupabaseAuth();
    const session = makeSession(fake);
    const [a, b] = await Promise.all([session.ensureSession(), session.ensureSession()]);
    expect(a.ok).toBe(true);
    expect(b.ok).toBe(true);
    expect(fake.anonCalls).toBe(1);
  });

  it('returns the honest error when anonymous sign-in fails', async () => {
    const fake = new FakeSupabaseAuth();
    fake.anonError = 'Anonymous sign-ins are disabled';
    const result = await makeSession(fake).ensureSession();
    expect(result).toEqual({ ok: false, error: 'Anonymous sign-ins are disabled' });
  });
});

describe('getSnapshot status mapping', () => {
  it('is signed-out with no session, anonymous for is_anonymous, linked otherwise', async () => {
    const fake = new FakeSupabaseAuth();
    const session = makeSession(fake);
    expect((await session.getSnapshot()).status).toBe('signed-out');
    await session.ensureSession();
    expect((await session.getSnapshot()).status).toBe('anonymous');
    fake.session = {
      access_token: 't',
      user: { id: 'u2', email: 'a@b.co', is_anonymous: false },
    };
    const linked = await session.getSnapshot();
    expect(linked.status).toBe('linked');
    expect(linked.email).toBe('a@b.co');
  });
});

describe('linkEmail', () => {
  it('calls updateUser with an emailRedirectTo containing auth-callback', async () => {
    const fake = new FakeSupabaseAuth();
    fake.session = { access_token: 't', user: { id: 'anon', is_anonymous: true } };
    const result = await makeSession(fake).linkEmail(' Reader@Example.com ');
    expect(result.ok).toBe(true);
    expect(fake.updateUserCalls).toHaveLength(1);
    expect(fake.updateUserCalls[0]?.attrs.email).toBe('reader@example.com');
    expect(fake.updateUserCalls[0]?.options?.emailRedirectTo).toContain('auth-callback');
  });

  it('rejects an invalid email without touching the client', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).linkEmail('not-an-email');
    expect(result.ok).toBe(false);
    expect(fake.updateUserCalls).toHaveLength(0);
  });

  it('is honest when there is no session yet', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).linkEmail('reader@example.com');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Create account');
    expect(fake.updateUserCalls).toHaveLength(0);
  });
});

describe('signInWithEmail', () => {
  it('calls signInWithOtp with the redirect and shouldCreateUser', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).signInWithEmail('Returning@Device.co');
    expect(result.ok).toBe(true);
    expect(fake.otpCalls).toHaveLength(1);
    expect(fake.otpCalls[0]?.email).toBe('returning@device.co');
    expect(fake.otpCalls[0]?.options?.emailRedirectTo).toContain('auth-callback');
    expect(fake.otpCalls[0]?.options?.shouldCreateUser).toBe(true);
  });
});

describe('getAccessToken', () => {
  it('passes the session access token through', async () => {
    const fake = new FakeSupabaseAuth();
    fake.session = { access_token: 'live-token', user: { id: 'u', is_anonymous: true } };
    expect(await makeSession(fake).getAccessToken()).toBe('live-token');
  });

  it('is null with no session', async () => {
    const fake = new FakeSupabaseAuth();
    expect(await makeSession(fake).getAccessToken()).toBeNull();
  });
});

describe('signOut', () => {
  it('delegates to the client', async () => {
    const fake = new FakeSupabaseAuth();
    fake.session = { access_token: 't', user: { id: 'u', is_anonymous: true } };
    await makeSession(fake).signOut();
    expect(fake.signOutCalls).toBe(1);
    expect(fake.session).toBeNull();
  });
});

describe('handleAuthUrl', () => {
  it('sets the session from fragment tokens', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).handleAuthUrl(
      'mynews://auth-callback#access_token=at1&refresh_token=rt1&type=magiclink',
    );
    expect(result).toEqual({ handled: true });
    expect(fake.setSessionCalls).toEqual([{ access_token: 'at1', refresh_token: 'rt1' }]);
  });

  it('verifies token_hash links with their type', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).handleAuthUrl(
      'mynews://auth-callback?token_hash=th1&type=email',
    );
    expect(result).toEqual({ handled: true });
    expect(fake.verifyOtpCalls).toEqual([{ token_hash: 'th1', type: 'email' }]);
  });

  it('exchanges PKCE codes', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).handleAuthUrl('mynews://auth-callback?code=abc123');
    expect(result).toEqual({ handled: true });
    expect(fake.exchangeCalls).toEqual(['abc123']);
  });

  it('surfaces link errors honestly', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).handleAuthUrl(
      'mynews://auth-callback#error=access_denied&error_description=Link+expired',
    );
    expect(result).toEqual({ handled: true, error: 'Link expired' });
    expect(fake.setSessionCalls).toHaveLength(0);
  });

  it('ignores ordinary deep links', async () => {
    const fake = new FakeSupabaseAuth();
    const result = await makeSession(fake).handleAuthUrl('mynews://article/some-slug');
    expect(result).toEqual({ handled: false });
  });
});

describe('nextAuthError', () => {
  it('surfaces a handled failure reason', () => {
    expect(nextAuthError(null, { handled: true, error: 'Link expired' })).toBe('Link expired');
    expect(nextAuthError('older failure', { handled: true, error: 'Link expired' })).toBe(
      'Link expired',
    );
  });

  it('clears the previous failure on a handled success', () => {
    expect(nextAuthError('Link expired', { handled: true })).toBeNull();
  });

  it('leaves the state untouched for non-auth URLs', () => {
    expect(nextAuthError('Link expired', { handled: false })).toBe('Link expired');
    expect(nextAuthError(null, { handled: false })).toBeNull();
  });

  it('folds real handleAuthUrl results: failure surfaces, next success clears', async () => {
    const fake = new FakeSupabaseAuth();
    const session = makeSession(fake);
    const failed = await session.handleAuthUrl(
      'mynews://auth-callback#error=access_denied&error_description=Link+expired',
    );
    const afterFailure = nextAuthError(null, failed);
    expect(afterFailure).toBe('Link expired');
    const succeeded = await session.handleAuthUrl(
      'mynews://auth-callback#access_token=at1&refresh_token=rt1&type=magiclink',
    );
    expect(nextAuthError(afterFailure, succeeded)).toBeNull();
  });
});

describe('parseAuthCallbackUrl', () => {
  it('returns null when there is no auth signal', () => {
    expect(parseAuthCallbackUrl('mynews://journalist/jane')).toBeNull();
  });

  it('reads params from query and fragment segments', () => {
    const parsed = parseAuthCallbackUrl(
      'mynews://auth-callback?foo=bar#access_token=at&refresh_token=rt&type=recovery',
    );
    expect(parsed?.accessToken).toBe('at');
    expect(parsed?.refreshToken).toBe('rt');
    expect(parsed?.type).toBe('recovery');
  });
});

describe('unconfigured session honesty', () => {
  const reason = 'Not connected to a MyNews server yet.';
  const session = createUnconfiguredAuthSession(reason);

  it('never fabricates a session', async () => {
    expect(await session.ensureSession()).toEqual({ ok: false, error: reason });
    expect(await session.linkEmail('a@b.co')).toEqual({ ok: false, error: reason });
    expect(await session.signInWithEmail('a@b.co')).toEqual({ ok: false, error: reason });
    expect(await session.getAccessToken()).toBeNull();
    expect(await session.getSnapshot()).toEqual({
      status: 'unconfigured',
      userId: null,
      email: null,
    });
    expect(await session.handleAuthUrl('mynews://auth-callback?code=x')).toEqual({
      handled: false,
    });
  });
});
