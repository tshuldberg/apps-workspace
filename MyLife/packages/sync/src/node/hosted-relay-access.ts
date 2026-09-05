import type { RelayBackend, RelaySession } from '../transport/relay-transport';

function endpoint(value: string, kind: 'relay' | 'api'): string | null {
  try {
    const url = new URL(value.trim());
    const secure = kind === 'relay' ? 'wss:' : 'https:';
    const local = kind === 'relay' ? 'ws:' : 'http:';
    const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((kind === 'api' && url.search) || url.username || url.password || url.hash || (url.protocol !== secure && !(loopback && url.protocol === local))) return null;
    return kind === 'api' ? url.toString().replace(/\/+$/u, '') : url.toString();
  } catch { return null; }
}

/** Exact configured endpoint, including path/query; never an origin-wide bearer grant. */
export function isHostedRelayTarget(target: string, configured: string): boolean {
  const trusted = endpoint(configured, 'relay');
  return trusted !== null && endpoint(target, 'relay') === trusted;
}

export interface HostedRelayAccessOptions {
  relayUrl: string;
  apiUrl: string;
  createAuthorization: () => string;
  fetchFn?: typeof fetch;
  now?: () => number;
}

export interface HostedRelayAccess {
  tokenFor: (target: string) => Promise<string | undefined>;
  /** Explicit retry clears the bounded failure cooldown; never grants access. */
  reset: () => void;
}

/** Device-scoped, memory-only access cache. The relay remains the token verifier. */
export function createHostedRelayAccess(options: HostedRelayAccessOptions): HostedRelayAccess {
  const now = options.now ?? Date.now;
  let cached: { token: string; until: number } | null = null;
  let pending: Promise<string> | null = null;
  let failure: { error: Error; until: number } | null = null;
  let generation = 0;

  const acquire = async (): Promise<string> => {
    const api = endpoint(options.apiUrl, 'api');
    if (!api) throw new Error('Hosted access is not configured securely. Use your own connection server or check the build configuration.');
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new Error('Hosted access check timed out. Try again later.'));
      }, 10_000);
    });
    try {
      const request = async (): Promise<{ token: string; until: number }> => {
        const response = await (options.fetchFn ?? fetch)(`${api}/api/entitlements/meerkat`, {
          headers: { Authorization: `Bearer ${options.createAuthorization()}` },
          redirect: 'error',
          signal: controller.signal,
        });
        if (response.status === 402) throw new Error('This connection server requires an active hosted plan. The app unlock is a separate purchase.');
        if (!response.ok) throw new Error(`Hosted access could not be checked (${response.status}). Try again later or use your own connection server.`);
        const body = await response.json() as { token?: unknown; entitlements?: { expiresAt?: unknown } } | null;
        const expiry = typeof body?.entitlements?.expiresAt === 'string' ? Date.parse(body.entitlements.expiresAt) : NaN;
        if (typeof body?.token !== 'string' || !body.token.trim() || body.token.length > 16_384 || !Number.isFinite(expiry) || expiry <= now()) {
          throw new Error('Hosted access returned no current entitlement. Try checking access again.');
        }
        // Refresh at least once a minute and before the token expires. No disk cache.
        return { token: body.token, until: Math.min(expiry - 5_000, now() + 60_000) };
      };
      cached = await Promise.race([request(), deadline]);
      return cached.token;
    } finally { clearTimeout(timer); }
  };

  return {
    tokenFor(target) {
      // Do not contact billing or attach caller-supplied tokens for self-hosted URLs.
      if (!isHostedRelayTarget(target, options.relayUrl)) return Promise.resolve(undefined);
      if (cached && cached.until > now()) return Promise.resolve(cached.token);
      if (pending) return pending;
      if (failure && failure.until > now()) return Promise.reject(failure.error);
      const started = generation;
      const request = acquire().catch((error: unknown) => {
        const cause = error instanceof Error ? error : new Error('Hosted access could not be checked.');
        if (started === generation) failure = { error: cause, until: now() + 30_000 };
        throw cause;
      });
      pending = request;
      void request.then(() => {
        if (started === generation) { pending = null; failure = null; }
        else cached = null;
      }, () => { if (started === generation) pending = null; });
      return request;
    },
    reset() {
      // An in-flight acquisition still settles for its callers; a new explicit
      // request starts after it settles, avoiding a burst of parallel fetches.
      cached = null;
      failure = null;
      generation += 1;
      if (pending) {
        const active = pending;
        void active.then(() => { if (pending === active) { pending = null; cached = null; } },
          () => { if (pending === active) pending = null; });
      }
    },
  };
}

/** Reuses the existing transport; only access acquisition and scoping live here. */
export function withHostedRelayAccess(backend: RelayBackend, access: HostedRelayAccess): RelayBackend {
  let destroyed = false;
  return {
    async connect(url, token): Promise<RelaySession> {
      if (destroyed) throw new Error('Backend is destroyed.');
      const entitlementToken = await access.tokenFor(url);
      if (destroyed) throw new Error('Backend is destroyed.');
      return backend.connect(url, token, entitlementToken ? { entitlementToken } : undefined);
    },
    destroy() { destroyed = true; backend.destroy(); },
  };
}
