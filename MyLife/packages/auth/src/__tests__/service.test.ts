import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService, requiresAuth, INITIAL_AUTH_STATE, UNAUTHENTICATED_STATE } from '../service';
import type { PlanMode } from '../types';

// ---- Mock Supabase client ----

function createMockSupabaseClient() {
  const listeners: Array<(event: string, session: unknown) => void> = [];

  return {
    auth: {
      onAuthStateChange: vi.fn((callback: (event: string, session: unknown) => void) => {
        listeners.push(callback);
        return {
          data: {
            subscription: {
              unsubscribe: vi.fn(),
            },
          },
        };
      }),
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn().mockResolvedValue({ error: null }),
    },
    _listeners: listeners,
    _emitAuthChange(event: string, session: unknown) {
      for (const listener of listeners) {
        listener(event, session);
      }
    },
  };
}

type MockClient = ReturnType<typeof createMockSupabaseClient>;

function makeMockSession(overrides: Record<string, unknown> = {}) {
  return {
    access_token: 'test-token',
    refresh_token: 'test-refresh',
    expires_in: 3600,
    token_type: 'bearer',
    user: {
      id: 'user-123',
      email: 'test@example.com',
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '2024-01-01T00:00:00Z',
    },
    ...overrides,
  };
}

// ---- Tests ----

describe('requiresAuth', () => {
  it('returns true for hosted mode', () => {
    expect(requiresAuth('hosted')).toBe(true);
  });

  it('returns false for self_host mode', () => {
    expect(requiresAuth('self_host')).toBe(false);
  });

  it('returns false for local_only mode', () => {
    expect(requiresAuth('local_only')).toBe(false);
  });

  it('returns correct values for all PlanMode values', () => {
    const modes: PlanMode[] = ['hosted', 'self_host', 'local_only'];
    const expected = [true, false, false];
    expect(modes.map(requiresAuth)).toEqual(expected);
  });
});

describe('AuthService', () => {
  let mockClient: MockClient;
  let service: AuthService;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    service = new AuthService(mockClient as any);
  });

  describe('initial state', () => {
    it('starts with INITIAL_AUTH_STATE', () => {
      expect(service.getState()).toEqual(INITIAL_AUTH_STATE);
    });

    it('INITIAL_AUTH_STATE has isLoading true', () => {
      expect(INITIAL_AUTH_STATE.isLoading).toBe(true);
      expect(INITIAL_AUTH_STATE.isAuthenticated).toBe(false);
      expect(INITIAL_AUTH_STATE.user).toBeNull();
      expect(INITIAL_AUTH_STATE.session).toBeNull();
    });

    it('UNAUTHENTICATED_STATE has isLoading false', () => {
      expect(UNAUTHENTICATED_STATE.isLoading).toBe(false);
      expect(UNAUTHENTICATED_STATE.isAuthenticated).toBe(false);
    });
  });

  describe('initialize', () => {
    it('registers an auth state change listener', () => {
      service.initialize();
      expect(mockClient.auth.onAuthStateChange).toHaveBeenCalledOnce();
    });

    it('checks for existing session', async () => {
      service.initialize();
      // Let the async session recovery complete
      await vi.waitFor(() => {
        expect(mockClient.auth.getSession).toHaveBeenCalledOnce();
      });
    });

    it('transitions to unauthenticated when no session exists', async () => {
      mockClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
      service.initialize();
      await vi.waitFor(() => {
        expect(service.getState().isLoading).toBe(false);
      });
      expect(service.getState().isAuthenticated).toBe(false);
    });

    it('recovers an existing session', async () => {
      const session = makeMockSession();
      mockClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });
      service.initialize();
      await vi.waitFor(() => {
        expect(service.getState().isLoading).toBe(false);
      });
      expect(service.getState().isAuthenticated).toBe(true);
      expect(service.getState().user?.id).toBe('user-123');
    });
  });

  describe('signUp', () => {
    it('returns success result on successful sign up', async () => {
      const session = makeMockSession();
      mockClient.auth.signUp.mockResolvedValue({
        data: { user: session.user, session },
        error: null,
      });

      const result = await service.signUp('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
      expect(result.session).toBeDefined();
      expect(result.error).toBeNull();
    });

    it('returns error result on sign up failure', async () => {
      mockClient.auth.signUp.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'User already registered' },
      });

      const result = await service.signUp('test@example.com', 'password123');

      expect(result.success).toBe(false);
      expect(result.user).toBeNull();
      expect(result.error).toBe('User already registered');
    });
  });

  describe('signIn', () => {
    it('returns success result on successful sign in', async () => {
      const session = makeMockSession();
      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: session.user, session },
        error: null,
      });

      const result = await service.signIn('test@example.com', 'password123');

      expect(result.success).toBe(true);
      expect(result.user?.email).toBe('test@example.com');
      expect(result.error).toBeNull();
    });

    it('returns error result on invalid credentials', async () => {
      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: null, session: null },
        error: { message: 'Invalid login credentials' },
      });

      const result = await service.signIn('test@example.com', 'wrong');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid login credentials');
    });
  });

  describe('signOut', () => {
    it('calls supabase signOut and resets state', async () => {
      // First, set up an authenticated state
      const session = makeMockSession();
      mockClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });
      service.initialize();
      await vi.waitFor(() => {
        expect(service.getState().isAuthenticated).toBe(true);
      });

      // Now sign out
      await service.signOut();

      expect(mockClient.auth.signOut).toHaveBeenCalledOnce();
      expect(service.getState().isAuthenticated).toBe(false);
      expect(service.getState().user).toBeNull();
      expect(service.getState().isLoading).toBe(false);
    });
  });

  describe('getSession', () => {
    it('returns the current session', async () => {
      const session = makeMockSession();
      mockClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });

      const result = await service.getSession();
      expect(result).toBe(session);
    });

    it('returns null when not authenticated', async () => {
      mockClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });

      const result = await service.getSession();
      expect(result).toBeNull();
    });
  });

  describe('subscribe', () => {
    it('notifies listeners on state change', async () => {
      const listener = vi.fn();
      service.subscribe(listener);
      service.initialize();

      // Let session recovery complete (transitions from loading to not loading)
      await vi.waitFor(() => {
        expect(listener).toHaveBeenCalled();
      });

      const lastCall = listener.mock.calls[listener.mock.calls.length - 1][0];
      expect(lastCall.isLoading).toBe(false);
    });

    it('returns an unsubscribe function', async () => {
      const listener = vi.fn();
      const unsubscribe = service.subscribe(listener);
      unsubscribe();

      service.initialize();
      // Wait a tick for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe('deleteAccount', () => {
    it('returns error when not authenticated', async () => {
      mockClient.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
      const result = await service.deleteAccount();

      expect(result.success).toBe(false);
      expect(result.error).toContain('signed in');
    });

    it('calls rpc delete_user and signs out on success', async () => {
      const session = makeMockSession();
      mockClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockClient as any).rpc = vi.fn().mockResolvedValue({ data: null, error: null });

      service.initialize();
      await vi.waitFor(() => {
        expect(service.getState().isAuthenticated).toBe(true);
      });

      const result = await service.deleteAccount();

      expect(result.success).toBe(true);
      expect(result.error).toBeNull();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((mockClient as any).rpc).toHaveBeenCalledWith('delete_user');
      expect(mockClient.auth.signOut).toHaveBeenCalled();
      expect(service.getState().isAuthenticated).toBe(false);
    });

    it('returns user-friendly error when rpc function does not exist', async () => {
      const session = makeMockSession();
      mockClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockClient as any).rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'function "delete_user" does not exist', code: '42883' },
      });

      const result = await service.deleteAccount();

      expect(result.success).toBe(false);
      expect(result.error).toContain('not available');
    });

    it('returns server error message for other rpc failures', async () => {
      const session = makeMockSession();
      mockClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (mockClient as any).rpc = vi.fn().mockResolvedValue({
        data: null,
        error: { message: 'Internal server error' },
      });

      const result = await service.deleteAccount();

      expect(result.success).toBe(false);
      expect(result.error).toBe('Internal server error');
    });
  });

  describe('onAuthStateChange', () => {
    it('subscribes to raw Supabase auth events', () => {
      service.initialize();
      const callback = vi.fn();
      service.onAuthStateChange(callback);

      // onAuthStateChange should register an additional listener
      expect(mockClient.auth.onAuthStateChange).toHaveBeenCalledTimes(2);
    });

    it('returns an unsubscribe function', () => {
      service.initialize();
      const callback = vi.fn();
      const unsub = service.onAuthStateChange(callback);

      expect(typeof unsub).toBe('function');
      unsub(); // should not throw
    });
  });

  describe('auth state change events', () => {
    it('updates state when Supabase emits SIGNED_IN', () => {
      service.initialize();
      const session = makeMockSession();

      mockClient._emitAuthChange('SIGNED_IN', session);

      expect(service.getState().isAuthenticated).toBe(true);
      expect(service.getState().user?.id).toBe('user-123');
    });

    it('updates state when Supabase emits SIGNED_OUT', async () => {
      // Start authenticated
      const session = makeMockSession();
      mockClient.auth.getSession.mockResolvedValue({ data: { session }, error: null });
      service.initialize();
      await vi.waitFor(() => {
        expect(service.getState().isAuthenticated).toBe(true);
      });

      // Emit SIGNED_OUT
      mockClient._emitAuthChange('SIGNED_OUT', null);

      expect(service.getState().isAuthenticated).toBe(false);
      expect(service.getState().user).toBeNull();
    });
  });

  describe('destroy', () => {
    it('unsubscribes from Supabase auth changes', () => {
      service.initialize();
      const { subscription } = mockClient.auth.onAuthStateChange.mock.results[0].value.data;

      service.destroy();

      expect(subscription.unsubscribe).toHaveBeenCalledOnce();
    });

    it('clears all listeners', async () => {
      const listener = vi.fn();
      service.subscribe(listener);
      service.destroy();

      // Initializing after destroy should not notify the old listener
      // because listeners were cleared
      service.initialize();
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(listener).not.toHaveBeenCalled();
    });
  });
});
