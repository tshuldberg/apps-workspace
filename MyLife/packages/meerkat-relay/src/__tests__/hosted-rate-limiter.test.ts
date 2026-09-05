import { describe, expect, it } from 'vitest';
import type http from 'node:http';
import { HostedRequestLimiter } from '../hosted-rate-limiter';

function request(ip: string, forwarded?: string): http.IncomingMessage {
  return {
    headers: forwarded ? { 'x-forwarded-for': forwarded } : {},
    socket: { remoteAddress: ip },
  } as unknown as http.IncomingMessage;
}

describe('HostedRequestLimiter', () => {
  it('limits costly routes by direct address and resets its window', () => {
    let now = 1_000;
    const limiter = new HostedRequestLimiter({
      now: () => now,
      limits: { '/api/billing/checkout': { max: 2, windowMs: 1_000 } },
    });
    expect(limiter.check(request('127.0.0.1'), '/api/billing/checkout').allowed).toBe(true);
    expect(limiter.check(request('127.0.0.1'), '/api/billing/checkout').allowed).toBe(true);
    expect(limiter.check(request('127.0.0.1'), '/api/billing/checkout')).toMatchObject({
      allowed: false,
      retryAfterSeconds: 1,
    });
    now += 1_000;
    expect(limiter.check(request('127.0.0.1'), '/api/billing/checkout').allowed).toBe(true);
  });

  it('trusts forwarded addresses only when explicitly configured', () => {
    const direct = request('10.0.0.1', '203.0.113.1');
    const untrusted = new HostedRequestLimiter({
      limits: { '/api/billing/checkout': { max: 1, windowMs: 1_000 } },
    });
    expect(untrusted.check(direct, '/api/billing/checkout').allowed).toBe(true);
    expect(untrusted.check(request('10.0.0.1', '203.0.113.2'), '/api/billing/checkout').allowed).toBe(false);

    const trusted = new HostedRequestLimiter({
      trustedProxyHops: 1,
      limits: { '/api/billing/checkout': { max: 1, windowMs: 1_000 } },
    });
    expect(trusted.check(request('10.0.0.1', '203.0.113.1'), '/api/billing/checkout').allowed).toBe(true);
    expect(trusted.check(request('10.0.0.1', '203.0.113.2'), '/api/billing/checkout').allowed).toBe(true);
    // One trusted Caddy hop means the address immediately to its left wins. A
    // caller-controlled prefix cannot rotate the rate-limit identity.
    expect(trusted.check(request('10.0.0.1', '198.51.100.99, 203.0.113.2'), '/api/billing/checkout').allowed).toBe(false);
  });

  it('falls back to the direct peer when the declared proxy chain is incomplete', () => {
    const limiter = new HostedRequestLimiter({
      trustedProxyHops: 2,
      limits: { '/api/billing/checkout': { max: 1, windowMs: 1_000 } },
    });
    expect(limiter.check(request('10.0.0.1', '203.0.113.1'), '/api/billing/checkout').allowed).toBe(true);
    expect(limiter.check(request('10.0.0.1', '203.0.113.2'), '/api/billing/checkout').allowed).toBe(false);
  });
});
