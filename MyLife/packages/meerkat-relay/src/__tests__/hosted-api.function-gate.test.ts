import http from 'node:http';
import nacl from 'tweetnacl';
import { afterEach, describe, expect, it } from 'vitest';
import { appUnlockBindingMessage } from '@mylife/entitlements/server';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../test/function-quality';
import {
  AppUnlockPersonaInUseError,
  createMeerkatHostedApiHandler,
  type MeerkatAppBillingClient,
  type MeerkatAppBillingStore,
  type MeerkatAppLink,
  type MeerkatAppPurchase,
  type MeerkatHostedBillingClient,
  type MeerkatHostedBillingStore,
  type MeerkatHostedSubscription,
} from '../index';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');
const TOKEN_SECRET = 'hosted-function-gate-secret';
const servers: http.Server[] = [];

class HostedStore implements MeerkatHostedBillingStore {
  async getSubscription(): Promise<MeerkatHostedSubscription | null> { return null; }
  async upsertSubscription(): Promise<void> {}
  async applySubscriptionEvent(): Promise<'applied'> { return 'applied'; }
}

class ConflictAppStore implements MeerkatAppBillingStore {
  async getAppPurchase(subjectId: string): Promise<MeerkatAppPurchase | null> {
    return {
      subjectId,
      productId: 'meerkat_app_unlock',
      rail: 'stripe',
      purchaseDate: new Date(NOW).toISOString(),
      isActive: true,
    };
  }
  async upsertAppPurchase(): Promise<void> {}
  async applyAppPurchaseEvent(): Promise<'applied'> { return 'applied'; }
  async createLink(_link: MeerkatAppLink): Promise<void> {}
  async redeemLink(): Promise<{ subjectId: string }> { return { subjectId: 'subject-1' }; }
  async getAppUnlockPersona(): Promise<string | null> { return null; }
  async bindAppUnlockPersona(): Promise<string> { throw new AppUnlockPersonaInUseError(); }
  async getSubjectByAppUnlockPersona(): Promise<string | null> { return null; }
  async releaseAppUnlockPersona(): Promise<{ released: boolean; personaHash: string | null }> {
    return { released: false, personaHash: null };
  }
}

const billing: MeerkatHostedBillingClient & MeerkatAppBillingClient = {
  async createCheckoutSession() { return { url: 'https://billing.example.test/checkout' }; },
  async createPortalSession() { return { url: 'https://billing.example.test/portal' }; },
  async createAppCheckoutSession() { return { url: 'https://billing.example.test/app' }; },
  async parseWebhook() { return { kind: 'ignored', eventId: 'event-1' }; },
};

function handler(appStore: MeerkatAppBillingStore = new ConflictAppStore()) {
  return createMeerkatHostedApiHandler({
    entitlementSecret: 'entitlement-secret',
    webhookSecret: 'webhook-secret',
    billing,
    store: new HostedStore(),
    authorize: () => null,
    appUnlock: { billing, store: appStore },
    appUnlockTokenSecret: TOKEN_SECRET,
    now: () => NOW,
  });
}

async function start(): Promise<string> {
  const server = http.createServer(handler());
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Hosted test server failed to bind');
  return `http://127.0.0.1:${address.port}`;
}

async function post(url: string, body: Record<string, unknown>): Promise<Response> {
  return fetch(`${url}/api/entitlements/meerkat-app-token`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve) => {
    server.close(() => resolve());
  })));
});

describe('hosted app-unlock token function quality gate', () => {
  it('maps a cross-purchase persona collision to a stable 409 response', async () => {
    const url = await start();
    const keypair = nacl.sign.keyPair();
    const personaPubkey = Buffer.from(keypair.publicKey).toString('hex');
    const ts = new Date(NOW).toISOString();
    const personaSig = Buffer.from(nacl.sign.detached(
      new TextEncoder().encode(appUnlockBindingMessage(personaPubkey, ts)),
      keypair.secretKey,
    )).toString('hex');
    const response = await post(url, {
      link: 'one-time-link', personaPubkey, personaSig, ts,
    });
    expect(response.status).toBe(409);
    await expect(response.json()).resolves.toEqual({ error: 'persona_already_bound' });
  });

  it('rejects fuzzed malformed persona proofs without reaching the binding store', async () => {
    const url = await start();
    await runDeterministicFuzz({
      label: 'hosted app-unlock malformed proof fuzz',
      iterations: 40,
      seed: 44,
      makeCase: (rng) => ({
        personaPubkey: 'x'.repeat(randomInt(rng, 0, 80)),
        personaSig: 'y'.repeat(randomInt(rng, 0, 130)),
      }),
      assertCase: async (input) => {
        const response = await post(url, {
          link: 'one-time-link',
          ts: new Date(NOW).toISOString(),
          ...input,
        });
        expect([400, 401]).toContain(response.status);
      },
    });
  });

  it('keeps handler construction constant and within the memory budget', async () => {
    await assertComplexitySlope({
      label: 'createMeerkatHostedApiHandler',
      sizes: [100, 500, 1000],
      expected: 'constant',
      setup: () => new ConflictAppStore(),
      run: (store) => handler(store),
    });
    await assertMemoryBudget({
      label: 'createMeerkatHostedApiHandler',
      repeats: 200,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => new ConflictAppStore(),
      run: (store) => handler(store),
    });
  });
});
