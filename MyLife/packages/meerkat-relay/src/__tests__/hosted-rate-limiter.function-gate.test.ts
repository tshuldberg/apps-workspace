import { describe, expect, it } from 'vitest';
import type http from 'node:http';
import { HostedRequestLimiter } from '../hosted-rate-limiter';

describe('hosted limiter function gate', () => {
  it('fails closed after the configured provider-call budget', () => {
    const limiter = new HostedRequestLimiter({
      limits: { '/api/billing/app-checkout': { max: 1, windowMs: 60_000 } },
    });
    const req = { headers: {}, socket: { remoteAddress: '127.0.0.1' } } as http.IncomingMessage;
    expect(limiter.check(req, '/api/billing/app-checkout').allowed).toBe(true);
    expect(limiter.check(req, '/api/billing/app-checkout').allowed).toBe(false);
  });
});
