/**
 * Push gateway service tests over the file stores (Plan 42 P4).
 *
 * Drives PushGatewayService against the real file-backed registration/attempt stores,
 * an in-memory AES-256-GCM keyring cipher, and a scripted FakeProviderAdapter. Proves:
 * registration-secret enforcement, capability expiry/revocation, per-capability wake
 * rate windows, the attempt lifecycle from enqueue through delivery / retry / poison,
 * NC-42.3 (no device identity, community id, or plaintext in any stored record), and
 * NC-42.4 (status wording is accepted/rejected/unknown, never "delivered").
 */

import { randomBytes, randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  FilePushRegistrationStore,
  FilePushAttemptStore,
} from '../push-store-file';
import { AesGcmPushTokenCipher } from '../push-token-cipher';
import { FakeProviderAdapter, type PushProviderOutcome } from '../push-providers';
import { PushGatewayService, PushGatewayInputError, randomToken } from '../push-gateway';

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

let dir: string;
let registrations: FilePushRegistrationStore;
let attempts: FilePushAttemptStore;

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-gateway-'));
  registrations = new FilePushRegistrationStore(dir);
  attempts = new FilePushAttemptStore(dir);
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

function cipher(): AesGcmPushTokenCipher {
  return new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(32) }], activeVersion: 1 });
}

function makeGateway(options: {
  adapter?: FakeProviderAdapter;
  now?: () => number;
} = {}): { gateway: PushGatewayService; adapter: FakeProviderAdapter } {
  const adapter = options.adapter ?? new FakeProviderAdapter({ provider: 'apns' });
  const gateway = new PushGatewayService({
    registrations,
    attempts,
    cipher: cipher(),
    adapters: { apns: adapter },
    ...(options.now ? { now: options.now } : {}),
  });
  return { gateway, adapter };
}

async function register(gateway: PushGatewayService): Promise<{ registrationId: string; registrationSecret: string }> {
  const registrationId = randomToken();
  const registrationSecret = randomToken();
  const result = await gateway.registerInstallation({
    registrationId,
    registrationSecret,
    provider: 'apns',
    providerToken: 'a'.repeat(64),
    tokenTtlMs: 14 * DAY,
    registrationTtlMs: 30 * DAY,
    idempotencyKey: randomUUID(),
  });
  expect(result.status).toBe('ok');
  return { registrationId, registrationSecret };
}

async function mint(
  gateway: PushGatewayService,
  binding: { registrationId: string; registrationSecret: string },
  ttlMs = 7 * DAY,
): Promise<string> {
  const capability = randomToken();
  const result = await gateway.mintCapability({
    registrationId: binding.registrationId,
    registrationSecret: binding.registrationSecret,
    capability,
    scope: 'sync_wake',
    ttlMs,
    idempotencyKey: randomUUID(),
  });
  expect(result.status).toBe('ok');
  return capability;
}

describe('registration secret enforcement', () => {
  it('rejects a rotate/revoke/mint under the wrong registration secret', async () => {
    const { gateway } = makeGateway();
    const binding = await register(gateway);

    const wrongSecret = randomToken();
    const mintResult = await gateway.mintCapability({
      registrationId: binding.registrationId,
      registrationSecret: wrongSecret,
      capability: randomToken(),
      scope: 'sync_wake',
      ttlMs: DAY,
      idempotencyKey: randomUUID(),
    });
    expect(mintResult.status).toBe('unauthorized');

    const revokeResult = await gateway.revokeRegistration({
      registrationId: binding.registrationId,
      registrationSecret: wrongSecret,
      idempotencyKey: randomUUID(),
    });
    expect(revokeResult.status).toBe('unauthorized');
  });

  it('rejects a malformed capability/registration token before any store call', async () => {
    const { gateway } = makeGateway();
    await expect(gateway.enqueueWake({
      capability: 'not-a-256-bit-token',
      scope: 'sync_wake',
      payload: new Uint8Array([1]),
      urgency: 'high',
      idempotencyKey: randomUUID(),
    })).rejects.toBeInstanceOf(PushGatewayInputError);
  });
});

describe('wake enqueue + attempt lifecycle', () => {
  it('drains a queued wake to succeeded and records provider acceptance (never delivered)', async () => {
    const adapter = new FakeProviderAdapter({ provider: 'apns', outcomes: [{ kind: 'accepted', providerReference: 'apns-xyz' }] });
    const { gateway } = makeGateway({ adapter });
    const binding = await register(gateway);
    const capability = await mint(gateway, binding);

    const payload = new Uint8Array([0xde, 0xad, 0xbe, 0xef]);
    const wake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload, urgency: 'high', idempotencyKey: randomUUID(),
    });
    expect(wake.status).toBe('accepted');
    const attemptId = wake.status === 'accepted' ? wake.attemptId : '';

    const processed = await gateway.drainOnce();
    expect(processed).toBe(1);
    // The adapter received the DECRYPTED token and the opaque payload verbatim.
    expect(adapter.calls).toHaveLength(1);
    expect(adapter.calls[0]?.token).toBe('a'.repeat(64));
    expect([...adapter.calls[0]!.payload]).toEqual([...payload]);

    const status = await gateway.getAttemptStatus({ attemptId, capability });
    expect(status?.providerStatus).toBe('provider_accepted');
    expect(status?.terminal).toBe(true);
    // NC-42.4: the public status vocabulary never includes "delivered".
    expect(JSON.stringify(status)).not.toContain('delivered');
  });

  it('reschedules a retryable outcome then poisons after the attempt cap', async () => {
    const retry: PushProviderOutcome = { kind: 'retryable', reasonClass: 'provider_unavailable' };
    const adapter = new FakeProviderAdapter({ provider: 'apns', outcomes: [retry], fallback: retry });
    let clock = Date.now();
    const { gateway } = makeGateway({ adapter, now: () => clock });
    const binding = await register(gateway);
    const capability = await mint(gateway, binding);
    const wake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload: new Uint8Array([1]), urgency: 'normal', idempotencyKey: randomUUID(),
    });
    const attemptId = wake.status === 'accepted' ? wake.attemptId : '';

    // Drive several drain passes, advancing the clock past each backoff, until poison.
    for (let i = 0; i < 8; i += 1) {
      await gateway.drainOnce();
      clock += 60 * 60 * 1000; // jump an hour so the next retry is due
    }
    const status = await gateway.getAttemptStatus({ attemptId, capability });
    // Terminal, and the provider status is unknown (a retryable-exhaust is not a reject).
    expect(status?.terminal).toBe(true);
    expect(status?.providerStatus).toBe('unknown');
  });

  it('invalidates the provider token when the adapter reports the token unregistered', async () => {
    const adapter = new FakeProviderAdapter({ provider: 'apns', outcomes: [{ kind: 'rejected', reasonClass: 'token_unregistered' }] });
    const { gateway } = makeGateway({ adapter });
    const binding = await register(gateway);
    const capability = await mint(gateway, binding);
    const wake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload: new Uint8Array([2]), urgency: 'high', idempotencyKey: randomUUID(),
    });
    const attemptId = wake.status === 'accepted' ? wake.attemptId : '';
    await gateway.drainOnce();
    const status = await gateway.getAttemptStatus({ attemptId, capability });
    expect(status?.providerStatus).toBe('provider_rejected');
    // A later wake now finds no deliverable token (the generation was invalidated).
    // The store's resolveCapability returns null once no deliverable token remains, so
    // the gateway reports not_found (it cannot distinguish a dead token from an unknown
    // capability without leaking which registration a capability points at).
    const secondWake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload: new Uint8Array([3]), urgency: 'high', idempotencyKey: randomUUID(),
    });
    expect(secondWake.status).toBe('not_found');
  });
});

describe('capability expiry and revocation', () => {
  it('refuses a wake on a revoked capability', async () => {
    const { gateway } = makeGateway();
    const binding = await register(gateway);
    const capability = await mint(gateway, binding);
    const revoke = await gateway.revokeCapability({
      registrationId: binding.registrationId,
      registrationSecret: binding.registrationSecret,
      capability,
      idempotencyKey: randomUUID(),
    });
    expect(revoke.status).toBe('ok');
    const wake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload: new Uint8Array([1]), urgency: 'high', idempotencyKey: randomUUID(),
    });
    expect(wake.status).toBe('not_found');
  });

  it('refuses a wake on an expired capability', async () => {
    let clock = Date.now();
    const { gateway } = makeGateway({ now: () => clock });
    const binding = await register(gateway);
    const capability = await mint(gateway, binding, 2 * HOUR);
    clock += 3 * HOUR;
    const wake = await gateway.enqueueWake({
      capability, scope: 'sync_wake', payload: new Uint8Array([1]), urgency: 'high', idempotencyKey: randomUUID(),
    });
    expect(wake.status).toBe('not_found');
  });
});

describe('per-capability wake rate window', () => {
  it('rate-limits high-urgency wakes on one capability', async () => {
    const { gateway } = makeGateway();
    const binding = await register(gateway);
    const capability = await mint(gateway, binding);
    let limited = 0;
    let accepted = 0;
    for (let i = 0; i < 40; i += 1) {
      const wake = await gateway.enqueueWake({
        capability, scope: 'sync_wake', payload: new Uint8Array([i & 0xff]), urgency: 'high', idempotencyKey: randomUUID(),
      });
      if (wake.status === 'rate_limited') limited += 1;
      if (wake.status === 'accepted') accepted += 1;
    }
    // The high-urgency window caps at 30/min, so at least 10 of 40 are rejected.
    expect(accepted).toBeLessThanOrEqual(30);
    expect(limited).toBeGreaterThanOrEqual(10);
  });
});

describe('NC-42.3: no identity or plaintext in stored records', () => {
  it('keeps device pubkey, community id, and plaintext out of every push record', async () => {
    const adapter = new FakeProviderAdapter({ provider: 'apns', outcomes: [{ kind: 'accepted' }] });
    const { gateway } = makeGateway({ adapter });
    const binding = await register(gateway);
    const capability = await mint(gateway, binding);
    await gateway.enqueueWake({
      capability, scope: 'sync_wake',
      payload: new TextEncoder().encode('SECRET-PLAINTEXT-CONTENT'),
      urgency: 'high', idempotencyKey: randomUUID(),
    });
    await gateway.drainOnce();

    // Inspect the raw persisted state files: neither the capability plaintext, the
    // registration secret, the device provider token, nor the wake plaintext appear.
    const registrationsRaw = await fs.readFile(path.join(dir, 'push-registrations.json'), 'utf8');
    const attemptsRaw = await fs.readFile(path.join(dir, 'push-attempts.json'), 'utf8');
    for (const raw of [registrationsRaw, attemptsRaw]) {
      expect(raw).not.toContain('SECRET-PLAINTEXT-CONTENT');
      expect(raw).not.toContain(capability);
      expect(raw).not.toContain(binding.registrationSecret);
      expect(raw).not.toContain(binding.registrationId);
      expect(raw).not.toContain('a'.repeat(64)); // the raw provider token
    }
  });
});
