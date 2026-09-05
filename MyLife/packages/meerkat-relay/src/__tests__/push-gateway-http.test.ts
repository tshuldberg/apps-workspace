/**
 * Push gateway HTTP surface tests (Plan 42 P4).
 *
 * Boots the /v1/push/* handler on a real local http server over the file stores + fake
 * provider, and exercises it with fetch: the registration-secret bearer authorizes
 * mutations, the capability bearer authorizes wakes, a wrong secret is rejected, and the
 * status route reports provider_accepted/rejected/unknown only (NC-42.4), never delivered.
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FilePushRegistrationStore, FilePushAttemptStore } from '../push-store-file';
import { AesGcmPushTokenCipher } from '../push-token-cipher';
import { FakeProviderAdapter } from '../push-providers';
import { PushGatewayService, randomToken } from '../push-gateway';
import { createPushGatewayHttpHandler, isPushGatewayPath } from '../push-gateway-http';

let dir: string;
let server: http.Server;
let baseUrl: string;
let gateway: PushGatewayService;
let adapter: FakeProviderAdapter;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-http-'));
  adapter = new FakeProviderAdapter({ provider: 'apns', outcomes: [{ kind: 'accepted', providerReference: 'ref-1' }] });
  gateway = new PushGatewayService({
    registrations: new FilePushRegistrationStore(dir),
    attempts: new FilePushAttemptStore(dir),
    cipher: new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(32) }], activeVersion: 1 }),
    adapters: { apns: adapter },
  });
  const handler = createPushGatewayHttpHandler({ service: gateway, corsAllowedOrigins: ['https://app.example.test'] });
  server = http.createServer((req, res) => {
    const pathname = (req.url ?? '/').split('?')[0];
    if (isPushGatewayPath(pathname)) return handler(req, res);
    res.writeHead(404).end();
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await fs.rm(dir, { recursive: true, force: true });
});

async function call(method: string, route: string, bearer: string, body?: unknown): Promise<{ status: number; json: Record<string, unknown> }> {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: { authorization: `Bearer ${bearer}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  return { status: response.status, json: text ? JSON.parse(text) : {} };
}

describe('push gateway HTTP', () => {
  it('registers, mints, wakes, and reports acceptance without ever saying delivered', async () => {
    const registrationId = randomToken();
    const registrationSecret = randomToken();
    const register = await call('POST', '/v1/push/registrations', registrationSecret, {
      registrationId, provider: 'apns', providerToken: 'a'.repeat(64),
      tokenTtlMs: 14 * 24 * 3600_000, registrationTtlMs: 30 * 24 * 3600_000, idempotencyKey: randomUUID(),
    });
    expect(register.status).toBe(200);

    const capability = randomToken();
    const mint = await call('POST', '/v1/push/capabilities', registrationSecret, {
      registrationId, capability, scope: 'sync_wake', ttlMs: 7 * 24 * 3600_000, idempotencyKey: randomUUID(),
    });
    expect(mint.status).toBe(200);

    const wake = await call('POST', '/v1/push/wakes', capability, {
      scope: 'sync_wake', payload: Buffer.from([1, 2, 3]).toString('base64url'), urgency: 'high', idempotencyKey: randomUUID(),
    });
    expect(wake.status).toBe(202);
    const attemptId = String(wake.json.attemptId);

    await gateway.drainOnce();
    const status = await call('GET', `/v1/push/status/${attemptId}`, capability);
    expect(status.status).toBe(200);
    expect(status.json.providerStatus).toBe('provider_accepted');
    expect(JSON.stringify(status.json)).not.toContain('delivered');
  });

  it('rejects a mutation under the wrong registration secret', async () => {
    const registrationId = randomToken();
    const registrationSecret = randomToken();
    await call('POST', '/v1/push/registrations', registrationSecret, {
      registrationId, provider: 'apns', providerToken: 'a'.repeat(64),
      tokenTtlMs: 14 * 24 * 3600_000, registrationTtlMs: 30 * 24 * 3600_000, idempotencyKey: randomUUID(),
    });
    const mint = await call('POST', '/v1/push/capabilities', randomToken(), {
      registrationId, capability: randomToken(), scope: 'sync_wake', ttlMs: 3600_000, idempotencyKey: randomUUID(),
    });
    expect(mint.status).toBe(403);
  });

  it('rejects a wake with no bearer capability', async () => {
    const response = await fetch(`${baseUrl}/v1/push/wakes`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'sync_wake', payload: 'AQ', urgency: 'high', idempotencyKey: randomUUID() }),
    });
    expect(response.status).toBe(401);
  });

  it('returns 404 for a wake on an unknown capability', async () => {
    const wake = await call('POST', '/v1/push/wakes', randomToken(), {
      scope: 'sync_wake', payload: 'AQID', urgency: 'high', idempotencyKey: randomUUID(),
    });
    expect(wake.status).toBe(404);
  });

  it('enforces the CORS allowlist for browser origins', async () => {
    const response = await fetch(`${baseUrl}/v1/push/wakes`, {
      method: 'POST',
      headers: { origin: 'https://evil.example', authorization: `Bearer ${randomToken()}`, 'content-type': 'application/json' },
      body: JSON.stringify({ scope: 'sync_wake', payload: 'AQID', urgency: 'high', idempotencyKey: randomUUID() }),
    });
    expect(response.status).toBe(403);
  });
});
