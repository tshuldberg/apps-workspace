import type { IncomingMessage } from 'node:http';

function forwardedAddresses(value: string | string[] | undefined): string[] {
  const raw = Array.isArray(value) ? value.join(',') : value;
  return (raw ?? '').split(',').map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Resolve a rate-limit key without trusting caller-controlled forwarding headers
 * by default. When a deployment declares trusted reverse-proxy hops, select the
 * address immediately to the left of those proxies in the forwarding chain.
 */
export function deriveClientAddress(
  req: IncomingMessage,
  trustedProxyHops = 0,
  fallback = 'unknown',
): string {
  const direct = req.socket.remoteAddress?.trim() || fallback;
  const hops = Number.isFinite(trustedProxyHops)
    ? Math.max(0, Math.floor(trustedProxyHops))
    : 0;
  if (hops === 0) return direct;

  const forwarded = forwardedAddresses(req.headers['x-forwarded-for']);
  // A shorter-than-declared chain cannot prove that all trusted proxies
  // participated, so fail closed to the direct peer instead of trusting input.
  if (forwarded.length < hops) return direct;
  return forwarded[forwarded.length - hops] ?? direct;
}
