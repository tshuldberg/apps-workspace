import type http from 'node:http';
import { deriveClientAddress } from './client-address';

export interface HostedRouteRateLimit {
  max: number;
  windowMs: number;
}

export interface HostedRequestLimiterOptions {
  /** Exact number of reverse-proxy hops controlled by this deployment. */
  trustedProxyHops?: number;
  now?: () => number;
  limits?: Partial<Record<string, HostedRouteRateLimit>>;
}

export interface HostedRateLimitVerdict {
  allowed: boolean;
  retryAfterSeconds: number;
}

const DEFAULT_LIMITS: Record<string, HostedRouteRateLimit> = {
  '/api/billing/checkout': { max: 10, windowMs: 60 * 60_000 },
  '/api/billing/app-checkout': { max: 10, windowMs: 60 * 60_000 },
  '/api/billing/portal': { max: 30, windowMs: 60 * 60_000 },
  '/api/link/meerkat-app': { max: 30, windowMs: 60 * 60_000 },
  '/api/entitlements/meerkat': { max: 120, windowMs: 60_000 },
  '/api/entitlements/meerkat-app': { max: 120, windowMs: 60_000 },
  '/api/entitlements/meerkat-app-token': { max: 60, windowMs: 60_000 },
  '/api/usage/meerkat': { max: 120, windowMs: 60_000 },
  '/api/storage/upload': { max: 600, windowMs: 60_000 },
  '/api/storage/v1/objects': { max: 600, windowMs: 60_000 },
  '/api/storage/v1/objects/:id': { max: 600, windowMs: 60_000 },
  '/api/storage/v1/objects/:id/complete': { max: 120, windowMs: 60_000 },
  '/api/storage/v1/quota': { max: 120, windowMs: 60_000 },
  '/api/storage/v1/health': { max: 120, windowMs: 60_000 },
  '/api/storage/v1/descriptor': { max: 120, windowMs: 60_000 },
  '/api/storage/v1/challenge': { max: 120, windowMs: 60_000 },
  '/api/storage/v1/backups': { max: 120, windowMs: 60_000 },
  '/api/storage/v1/backups/:id/manifest': { max: 120, windowMs: 60_000 },
  '/api/storage/v1/account/delete': { max: 10, windowMs: 60 * 60_000 },
  '/api/storage/v1/*': { max: 120, windowMs: 60_000 },
  '/api/oauth/v1/connect/start': { max: 30, windowMs: 60 * 60_000 },
  '/api/oauth/v1/connect/complete': { max: 30, windowMs: 60 * 60_000 },
  '/api/oauth/v1/session': { max: 120, windowMs: 60_000 },
  '/api/oauth/v1/revoke': { max: 30, windowMs: 60 * 60_000 },
  '/api/oauth/v1/account/delete': { max: 10, windowMs: 60 * 60_000 },
  '/api/oauth/v1/storage-credential/put': { max: 30, windowMs: 60 * 60_000 },
  '/api/oauth/v1/storage-credential/session': { max: 120, windowMs: 60_000 },
  '/api/oauth/v1/storage-credential/revoke': { max: 30, windowMs: 60 * 60_000 },
  'POST /api/archive/jobs': { max: 30, windowMs: 60_000 },
  'PUT /api/archive/jobs/:id/objects/:index': { max: 600, windowMs: 60_000 },
  'POST /api/archive/jobs/:id/complete': { max: 60, windowMs: 60_000 },
  'GET /api/archive/jobs/:id': { max: 120, windowMs: 60_000 },
  'DELETE /api/archive/jobs/:id': { max: 30, windowMs: 60 * 60_000 },
  'GET /api/archive/publications/:id/hosts': { max: 120, windowMs: 60_000 },
  'GET /api/archive/*': { max: 60, windowMs: 60_000 },
};

export class HostedRequestLimiter {
  private readonly trustedProxyHops: number;
  private readonly now: () => number;
  private readonly limits: Record<string, HostedRouteRateLimit>;
  private readonly windows = new Map<string, { count: number; resetsAt: number }>();

  constructor(options: HostedRequestLimiterOptions = {}) {
    this.trustedProxyHops = Math.max(0, Math.floor(options.trustedProxyHops ?? 0));
    this.now = options.now ?? (() => Date.now());
    this.limits = { ...DEFAULT_LIMITS };
    for (const [route, limit] of Object.entries(options.limits ?? {})) {
      if (limit) this.limits[route] = limit;
    }
  }

  check(req: http.IncomingMessage, pathname: string): HostedRateLimitVerdict {
    const policy = this.limits[pathname];
    if (!policy) return { allowed: true, retryAfterSeconds: 0 };
    const client = deriveClientAddress(req, this.trustedProxyHops);
    const key = `${pathname}:${client}`;
    const now = this.now();
    const existing = this.windows.get(key);
    const window = !existing || existing.resetsAt <= now
      ? { count: 0, resetsAt: now + policy.windowMs }
      : existing;
    window.count += 1;
    this.windows.set(key, window);

    // Opportunistic bounded cleanup prevents attackers from growing the map
    // forever with spoofed addresses when a trusted proxy is enabled.
    if (this.windows.size > 10_000) {
      for (const [candidate, value] of this.windows) {
        if (value.resetsAt <= now) this.windows.delete(candidate);
      }
      while (this.windows.size > 10_000) {
        const oldest = this.windows.keys().next().value as string | undefined;
        if (!oldest) break;
        this.windows.delete(oldest);
      }
    }
    return {
      allowed: window.count <= policy.max,
      retryAfterSeconds: Math.max(1, Math.ceil((window.resetsAt - now) / 1000)),
    };
  }
}
