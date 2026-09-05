import { randomBytes as nodeRandomBytes } from 'node:crypto';
import { afterEach, describe, expect, it } from 'vitest';
import {
  humanityServiceKeypairFromSeed,
  issueHumanityTokenBatch,
  serializeHumanityToken,
} from '@mylife/sync';
import { createHumanityRedeemClient } from '../humanity-redeem-client';
import {
  HumanityService,
  humanityRegistrationRedemptionDigest,
} from '../humanity-service';
import {
  startHumanityService,
  type HumanityServiceServer,
} from '../humanity-service-http';

const NOW = Date.parse('2026-07-10T16:00:00.000Z');
const keys = humanityServiceKeypairFromSeed('9'.repeat(64));
let server: HumanityServiceServer | null = null;

afterEach(async () => {
  await server?.close();
  server = null;
});

describe('humanity redemption HTTP client compatibility', () => {
  it('keeps token-only redeem compatible and replays registration attempts', async () => {
    const service = new HumanityService({
      signingKeypair: keys,
      verifiers: [],
      now: () => NOW,
    });
    server = await startHumanityService({ service, host: '127.0.0.1' });
    const redeem = createHumanityRedeemClient(server.url);
    const tokens = issueHumanityTokenBatch({
      servicePrivateKeyHex: keys.privateKeyHex,
      count: 3,
      now: NOW,
      randomBytes: (length) => new Uint8Array(nodeRandomBytes(length)),
    });

    const legacy = serializeHumanityToken(tokens[0]!);
    await expect(redeem(legacy)).resolves.toEqual({ ok: true });
    await expect(redeem(legacy)).resolves.toEqual({ ok: false, reason: 'already_spent' });

    const attemptId = 'a'.repeat(64);
    const registration = {
      attemptId,
      requestDigest: humanityRegistrationRedemptionDigest(attemptId, tokens[1]!.tokenId),
    };
    const wire = serializeHumanityToken(tokens[1]!);
    await expect(redeem(wire, registration)).resolves.toEqual({ ok: true, replayed: false });
    await expect(redeem(wire, registration)).resolves.toEqual({ ok: true, replayed: true });

    const conflictingWire = serializeHumanityToken(tokens[2]!);
    await expect(redeem(conflictingWire, {
      attemptId,
      requestDigest: humanityRegistrationRedemptionDigest(attemptId, tokens[2]!.tokenId),
    })).resolves.toEqual({ ok: false, reason: 'attempt_conflict' });
    // The HTTP 409 conflict did not consume the different token.
    await expect(redeem(conflictingWire)).resolves.toEqual({ ok: true });
  });

  it('rejects a partial idempotency envelope without falling back to legacy redeem', async () => {
    server = await startHumanityService({
      service: new HumanityService({ signingKeypair: keys, verifiers: [], now: () => NOW }),
      host: '127.0.0.1',
    });
    const response = await fetch(`${server.url}/humanity/redeem`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: 'token', attemptId: 'a'.repeat(64) }),
    });
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ ok: false, reason: 'bad_request' });
  });

  it('requires HTTPS or an explicit trusted-network opt-in away from loopback', () => {
    expect(() => createHumanityRedeemClient('http://humanity.internal:8892'))
      .toThrow(/explicit trusted-network opt-in/);
    expect(() => createHumanityRedeemClient('http://humanity.internal:8892', {
      allowInsecureHttp: true,
    })).not.toThrow();
    expect(() => createHumanityRedeemClient('https://humanity.example.test')).not.toThrow();
    expect(() => createHumanityRedeemClient('https://user:secret@humanity.example.test'))
      .toThrow(/cannot contain credentials/);
  });

  it('bounds dependency latency and response bytes', async () => {
    const neverResponds = createHumanityRedeemClient('https://humanity.example.test', {
      timeoutMs: 10,
      fetchImpl: ((_url, init) => new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
      })) as typeof fetch,
    });
    await expect(neverResponds('opaque-token')).resolves.toEqual({
      ok: false,
      reason: 'service_unreachable',
    });

    const oversized = createHumanityRedeemClient('https://humanity.example.test', {
      fetchImpl: (async () => new Response(JSON.stringify({
        ok: true,
        padding: 'x'.repeat(17 * 1024),
      }))) as typeof fetch,
    });
    await expect(oversized('opaque-token')).resolves.toEqual({
      ok: false,
      reason: 'service_unreachable',
    });
  });
});
