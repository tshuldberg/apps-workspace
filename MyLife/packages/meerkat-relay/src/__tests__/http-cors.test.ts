import http from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { CommunityNode } from '../community-node';
import { startCommunityNodeHttp } from '../community-node-http';
import {
  createMeerkatHostedApiHandler,
  type MeerkatHostedBillingClient,
  type MeerkatHostedBillingStore,
} from '../hosted-api';
import type { SeederHttpServer } from '../seeder-http';
import { parseCorsAllowedOrigins } from '../http-cors';

const ALLOWED_ORIGIN = 'https://app.meerkat.example';
const BLOCKED_ORIGIN = 'https://attacker.example';

interface TestServer {
  url: string;
  close(): Promise<void>;
}

const servers: TestServer[] = [];

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

async function startHosted(): Promise<TestServer> {
  const store: MeerkatHostedBillingStore = {
    getSubscription: async () => null,
    upsertSubscription: async () => undefined,
    applySubscriptionEvent: async () => 'applied',
  };
  const billing: MeerkatHostedBillingClient = {
    createCheckoutSession: async () => ({ url: 'https://billing.example/checkout' }),
    createPortalSession: async () => ({ url: 'https://billing.example/portal' }),
    parseWebhook: async () => { throw new Error('not used'); },
  };
  const server = http.createServer(createMeerkatHostedApiHandler({
    entitlementSecret: 'test-entitlement-secret',
    webhookSecret: 'test-webhook-secret',
    store,
    billing,
    authorize: () => null,
    corsAllowedOrigins: [ALLOWED_ORIGIN],
  }));
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  if (!address || typeof address !== 'object') throw new Error('Hosted test server did not bind.');
  const running: TestServer = {
    url: `http://127.0.0.1:${address.port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
  servers.push(running);
  return running;
}

function remember(server: SeederHttpServer): TestServer {
  servers.push(server);
  return server;
}

async function assertStrictCors(server: TestServer, path: string, expectedHeaders: string): Promise<void> {
  const preflight = await fetch(`${server.url}${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: ALLOWED_ORIGIN,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': expectedHeaders,
    },
  });
  expect(preflight.status).toBe(204);
  expect(preflight.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
  expect(preflight.headers.get('access-control-allow-origin')).not.toBe('*');
  expect(preflight.headers.get('vary')).toContain('Origin');
  expect(preflight.headers.get('access-control-allow-headers')?.toLowerCase()).toContain(expectedHeaders.toLowerCase());

  const blocked = await fetch(`${server.url}${path}`, {
    method: 'OPTIONS',
    headers: { Origin: BLOCKED_ORIGIN, 'Access-Control-Request-Method': 'POST' },
  });
  expect(blocked.status).toBe(403);
  expect(blocked.headers.get('access-control-allow-origin')).toBeNull();

  const errorWithCors = await fetch(`${server.url}/not-found`, { headers: { Origin: ALLOWED_ORIGIN } });
  expect(errorWithCors.status).toBe(404);
  expect(errorWithCors.headers.get('access-control-allow-origin')).toBe(ALLOWED_ORIGIN);
}

describe('strict browser CORS', () => {
  it('accepts only canonical HTTP origins from deployment configuration', () => {
    expect(parseCorsAllowedOrigins([
      'https://app.meerkat.example',
      'https://app.meerkat.example/',
      'http://localhost:5173',
      'https://app.meerkat.example/path',
      'javascript:alert(1)',
      'https://user:secret@app.meerkat.example',
    ].join(','))).toEqual(['https://app.meerkat.example', 'http://localhost:5173']);
  });

  it('protects hosted billing routes with an exact origin allowlist', async () => {
    await assertStrictCors(await startHosted(), '/api/billing/checkout', 'authorization');
  });

  it('protects community-node routes and permits signed browser headers', async () => {
    const server = remember(await startCommunityNodeHttp({
      node: new CommunityNode(),
      host: '127.0.0.1',
      corsAllowedOrigins: [ALLOWED_ORIGIN],
    }));
    await assertStrictCors(server, '/public/example/register', 'x-mk-humanity');
  });
});
