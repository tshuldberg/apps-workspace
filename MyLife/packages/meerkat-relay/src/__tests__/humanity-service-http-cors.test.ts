import { afterEach, describe, expect, it } from 'vitest';
import { HumanityService, type HumanityVerifier } from '../humanity-service';
import { startHumanityService, type HumanityServiceServer } from '../humanity-service-http';
import { humanityServiceKeypairFromSeed } from '@mylife/sync';

// Web CORS on the verification service (Wave 2, Plan 22 item 4): the browser
// (meerkat-web) must be able to call issue/redeem cross-origin. Access is gated by
// the token in the body, never the Origin, so a permissive `*` is safe.

const serviceKeys = humanityServiceKeypairFromSeed('b'.repeat(64));

function verifier(): HumanityVerifier {
  return { kind: 'turnstile', isProductionSafe: true, verify: async () => ({ ok: true, attestationKeyId: 'k' }) };
}

let server: HumanityServiceServer | null = null;
afterEach(async () => { await server?.close(); server = null; });

describe('humanity service CORS', () => {
  it('answers an OPTIONS preflight with 204 + permissive CORS headers', async () => {
    server = await startHumanityService({
      service: new HumanityService({ signingKeypair: serviceKeys, verifiers: [verifier()] }),
      host: '127.0.0.1',
    });
    const res = await fetch(`${server.url}/humanity/issue`, {
      method: 'OPTIONS',
      headers: { Origin: 'https://meerkat.web', 'Access-Control-Request-Method': 'POST' },
    });
    expect(res.status).toBe(204);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(res.headers.get('access-control-allow-methods')).toContain('POST');
    expect(res.headers.get('access-control-allow-headers')).toContain('Content-Type');
  });

  it('carries the CORS header on a real POST response (redeem)', async () => {
    server = await startHumanityService({
      service: new HumanityService({ signingKeypair: serviceKeys, verifiers: [verifier()] }),
      host: '127.0.0.1',
    });
    const res = await fetch(`${server.url}/humanity/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://meerkat.web' },
      body: JSON.stringify({ token: 'not-a-real-token' }),
    });
    // Fail-closed on the bogus token, but still cross-origin readable.
    expect(res.status).toBe(200);
    expect(res.headers.get('access-control-allow-origin')).toBe('*');
    expect(await res.json()).toMatchObject({ ok: false });
  });
});
