import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import { AuthProvider, useAuth } from '../provider';
import { AuthService } from '../service';
import type { AuthResult } from '../types';

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

function makeMockSession() {
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
  };
}

// ---- Tests ----

describe('AuthProvider + useAuth', () => {
  let mockClient: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockClient = createMockSupabaseClient();
  });

  function createWrapper(service: AuthService | null) {
    return function Wrapper({ children }: { children: ReactNode }) {
      return <AuthProvider service={service}>{children}</AuthProvider>;
    };
  }

  describe('without auth service (local-only mode)', () => {
    it('returns unauthenticated state', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(null),
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.isLoading).toBe(false);
      expect(result.current.user).toBeNull();
      expect(result.current.session).toBeNull();
    });

    it('signUp returns descriptive error without throwing', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(null),
      });

      let authResult: AuthResult | undefined;
      await act(async () => {
        authResult = await result.current.signUp('test@example.com', 'password');
      });

      expect(authResult?.success).toBe(false);
      expect(authResult?.error).toContain('not available');
    });

    it('signIn returns descriptive error without throwing', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(null),
      });

      let authResult: AuthResult | undefined;
      await act(async () => {
        authResult = await result.current.signIn('test@example.com', 'password');
      });

      expect(authResult?.success).toBe(false);
      expect(authResult?.error).toContain('not available');
    });

    it('signOut is a no-op', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(null),
      });

      // Should not throw
      await act(async () => {
        await result.current.signOut();
      });
    });

    it('deleteAccount returns descriptive error without throwing', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(null),
      });

      let authResult: AuthResult | undefined;
      await act(async () => {
        authResult = await result.current.deleteAccount();
      });

      expect(authResult?.success).toBe(false);
      expect(authResult?.error).toContain('not available');
    });
  });

  describe('with auth service', () => {
    it('initializes the service on mount', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AuthService(mockClient as any);
      const initSpy = vi.spyOn(service, 'initialize');

      renderHook(() => useAuth(), {
        wrapper: createWrapper(service),
      });

      expect(initSpy).toHaveBeenCalledOnce();
    });

    it('destroys the service on unmount', () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AuthService(mockClient as any);
      const destroySpy = vi.spyOn(service, 'destroy');

      const { unmount } = renderHook(() => useAuth(), {
        wrapper: createWrapper(service),
      });

      unmount();
      expect(destroySpy).toHaveBeenCalledOnce();
    });

    it('reflects authenticated state after sign in event', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AuthService(mockClient as any);
      const session = makeMockSession();

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(service),
      });

      // Simulate Supabase emitting SIGNED_IN
      act(() => {
        mockClient._emitAuthChange('SIGNED_IN', session);
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user?.id).toBe('user-123');
      expect(result.current.isLoading).toBe(false);
    });

    it('calls service.signUp when signUp is invoked', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AuthService(mockClient as any);
      const session = makeMockSession();
      mockClient.auth.signUp.mockResolvedValue({
        data: { user: session.user, session },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(service),
      });

      let authResult: AuthResult | undefined;
      await act(async () => {
        authResult = await result.current.signUp('test@example.com', 'password123');
      });

      expect(authResult?.success).toBe(true);
      expect(mockClient.auth.signUp).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });

    it('calls service.signIn when signIn is invoked', async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const service = new AuthService(mockClient as any);
      const session = makeMockSession();
      mockClient.auth.signInWithPassword.mockResolvedValue({
        data: { user: session.user, session },
        error: null,
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: createWrapper(service),
      });

      let authResult: AuthResult | undefined;
      await act(async () => {
        authResult = await result.current.signIn('test@example.com', 'password123');
      });

      expect(authResult?.success).toBe(true);
      expect(mockClient.auth.signInWithPassword).toHaveBeenCalledWith({
        email: 'test@example.com',
        password: 'password123',
      });
    });
  });
});
