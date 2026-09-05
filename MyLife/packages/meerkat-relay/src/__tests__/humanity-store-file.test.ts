import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { randomUUID, createHash } from 'node:crypto';
import { FileHumanityStore } from '../humanity-store-file';
import { HumanityService, type HumanityVerifier } from '../humanity-service';
import { humanityServiceKeypairFromSeed, serializeHumanityToken } from '@mylife/sync';

const NOW = Date.parse('2026-07-06T00:00:00.000Z');
const serviceKeys = humanityServiceKeypairFromSeed('b'.repeat(64));

function hash(input: string): string {
  return createHash('sha256').update(input, 'utf8').digest('hex');
}

let baseDir: string;

beforeEach(async () => {
  baseDir = path.join(os.tmpdir(), `humanity-store-${randomUUID()}`);
  await fs.mkdir(baseDir, { recursive: true });
});

afterEach(async () => {
  await fs.rm(baseDir, { recursive: true, force: true });
});

describe('FileHumanityStore atomic + durable spend', () => {
  it('trySpend records once and reports the winner', async () => {
    const store = new FileHumanityStore(baseDir);
    const h = hash('token-1');
    expect(await store.trySpend(h, NOW + 1000)).toBe(true);
    expect(await store.trySpend(h, NOW + 1000)).toBe(false);
    expect(await store.isSpent(h)).toBe(true);
    expect(await store.isSpent(hash('other'))).toBe(false);
  });

  it('is atomic under concurrent trySpend of the same hash', async () => {
    const store = new FileHumanityStore(baseDir);
    const h = hash('token-race');
    const results = await Promise.all(
      Array.from({ length: 25 }, () => store.trySpend(h, NOW + 1000)),
    );
    expect(results.filter((won) => won)).toHaveLength(1);
  });

  it('a spent token stays spent across a restart (new store, same dir)', async () => {
    const first = new FileHumanityStore(baseDir);
    const h = hash('token-durable');
    expect(await first.trySpend(h, NOW + 1000)).toBe(true);

    // Simulate a process restart: a fresh store over the same DATA_DIR.
    const restarted = new FileHumanityStore(baseDir);
    expect(await restarted.isSpent(h)).toBe(true);
    expect(await restarted.trySpend(h, NOW + 1000)).toBe(false);
  });

  it('atomically persists and replays a registration receipt across store instances', async () => {
    const first = new FileHumanityStore(baseDir);
    const second = new FileHumanityStore(baseDir);
    const input = {
      attemptId: 'a'.repeat(64),
      requestDigest: 'b'.repeat(64),
      tokenHash: hash('registration-token'),
      expiresAtMs: NOW + 60_000,
      allowCreate: true,
    };
    const outcomes = await Promise.all([
      first.redeemRegistrationAttempt(input),
      second.redeemRegistrationAttempt(input),
    ]);
    expect(outcomes.sort()).toEqual(['replayed', 'spent']);
    await expect(new FileHumanityStore(baseDir).redeemRegistrationAttempt(input))
      .resolves.toBe('replayed');
    await expect(second.redeemRegistrationAttempt({
      ...input,
      requestDigest: 'c'.repeat(64),
      tokenHash: hash('different-token'),
    })).resolves.toBe('attempt_conflict');
    await expect(second.isSpent(hash('different-token'))).resolves.toBe(false);

    const ledger = JSON.parse(
      await fs.readFile(path.join(baseDir, 'humanity-spend-ledger.json'), 'utf8'),
    ) as { tokens: Record<string, unknown>; registrationAttempts: Record<string, unknown> };
    expect(Object.keys(ledger.tokens)).toEqual([input.tokenHash]);
    expect(Object.keys(ledger.registrationAttempts)).toEqual([input.attemptId]);
  });

  it('prune deletes ONLY provably-expired markers and keeps a corrupt one (fail closed)', async () => {
    const store = new FileHumanityStore(baseDir);
    const expired = hash('expired');
    const live = hash('live');
    await store.trySpend(expired, NOW - 1000); // already past
    await store.trySpend(live, NOW + 60_000); // still valid
    // A torn/partial file with an unparseable expiry.
    await fs.writeFile(path.join(baseDir, 'spent', `${hash('corrupt')}.spent`), 'not-a-number', 'utf8');

    await store.prune(NOW);

    expect(await store.isSpent(expired)).toBe(false); // pruned
    expect(await store.isSpent(live)).toBe(true); // kept
    expect(await store.isSpent(hash('corrupt'))).toBe(true); // kept (fail closed)
  });

  it('rejects a hash that is not safe hex (path-traversal guard)', async () => {
    const store = new FileHumanityStore(baseDir);
    await expect(store.trySpend('../escape', NOW + 1000)).rejects.toThrow(/Invalid spent-token hash/u);
  });
});

describe('HumanityService with a durable store', () => {
  function verifier(): HumanityVerifier {
    return { kind: 'turnstile', isProductionSafe: true, verify: async () => ({ ok: true, attestationKeyId: 'k' }) };
  }
  function deterministicBytes(): (length: number) => Uint8Array {
    let counter = 1;
    return (length: number) => {
      const out = new Uint8Array(length);
      for (let i = 0; i < length; i += 1) out[i] = counter++ & 0xff;
      return out;
    };
  }

  it('rejects a replayed token even after a service restart (durable spent set)', async () => {
    const store1 = new FileHumanityStore(baseDir);
    const svc1 = new HumanityService({
      signingKeypair: serviceKeys,
      verifiers: [verifier()],
      store: store1,
      now: () => NOW,
      randomBytes: deterministicBytes(),
      limits: { batchSize: 1 },
    });
    const challenge = await svc1.challenge('turnstile');
    if (!challenge.ok) throw new Error('challenge failed');
    const issued = await svc1.issue({ challengeId: challenge.challengeId, attestation: {} });
    if (!issued.ok) throw new Error('issue failed');
    const wire = serializeHumanityToken(issued.tokens[0]!);

    expect(await svc1.redeem(wire)).toEqual({ ok: true });

    // Restart: a new service instance over the SAME durable store must still refuse.
    const svc2 = new HumanityService({
      signingKeypair: serviceKeys,
      verifiers: [verifier()],
      store: new FileHumanityStore(baseDir),
      now: () => NOW,
      randomBytes: deterministicBytes(),
    });
    expect(await svc2.redeem(wire)).toEqual({ ok: false, reason: 'already_spent' });
  });
});
