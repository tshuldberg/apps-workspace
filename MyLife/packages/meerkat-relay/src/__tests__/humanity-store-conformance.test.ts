import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { FileHumanityStore } from '../humanity-store-file';
import {
  InMemoryHumanityStore,
  type HumanityStore,
  type StoredChallenge,
} from '../humanity-service';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');
const tempDirs: string[] = [];

interface StoreCase {
  name: string;
  create(): HumanityStore | Promise<HumanityStore>;
}

const storeCases: StoreCase[] = [
  { name: 'memory', create: () => new InMemoryHumanityStore() },
  {
    name: 'file',
    create: async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'humanity-conformance-'));
      tempDirs.push(dir);
      return new FileHumanityStore(dir);
    },
  },
];

const challenge: StoredChallenge = {
  kind: 'turnstile',
  nonce: 'nonce',
  issuedAt: new Date(NOW).toISOString(),
  expiresAtMs: NOW + 60_000,
};

afterAll(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

for (const storeCase of storeCases) {
  describe(`HumanityStore atomic conformance (${storeCase.name})`, () => {
    it('lets exactly one concurrent caller consume a challenge', async () => {
      const store = await storeCase.create();
      await store.putChallenge('challenge-race', challenge);

      const results = await Promise.all(Array.from(
        { length: 20 },
        () => store.consumeChallenge('challenge-race', NOW),
      ));

      expect(results.filter((result) => result !== null)).toHaveLength(1);
      expect(results.find((result) => result !== null)).toEqual({ challenge, expired: false });
      expect(await store.getChallenge('challenge-race')).toBeNull();
    });

    it('consumes and reports an expired challenge instead of losing the reason', async () => {
      const store = await storeCase.create();
      const expired = { ...challenge, expiresAtMs: NOW - 1 };
      await store.putChallenge('challenge-expired', expired);

      expect(await store.consumeChallenge('challenge-expired', NOW)).toEqual({
        challenge: expired,
        expired: true,
      });
      expect(await store.consumeChallenge('challenge-expired', NOW)).toBeNull();
    });

    it('lets exactly one caller consume the final daily issuance allowance', async () => {
      const store = await storeCase.create();
      const keyHash = 'a'.repeat(64);
      const dayBucket = Math.floor(NOW / 86_400_000);
      expect(await store.tryIncrementIssuanceCount(keyHash, dayBucket, 2)).toBe(true);

      const results = await Promise.all(Array.from(
        { length: 20 },
        () => store.tryIncrementIssuanceCount(keyHash, dayBucket, 2),
      ));

      expect(results.filter(Boolean)).toHaveLength(1);
      expect(await store.getIssuanceCount(keyHash, dayBucket)).toBe(2);
    });

    it('atomically spends and replays one registration request', async () => {
      const store = await storeCase.create();
      const input = {
        attemptId: 'a'.repeat(64),
        requestDigest: 'b'.repeat(64),
        tokenHash: 'c'.repeat(64),
        expiresAtMs: NOW + 60_000,
        allowCreate: true,
      };
      const outcomes = await Promise.all(Array.from(
        { length: 20 },
        () => store.redeemRegistrationAttempt(input),
      ));
      expect(outcomes.filter((outcome) => outcome === 'spent')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome === 'replayed')).toHaveLength(19);

      expect(await store.redeemRegistrationAttempt({
        ...input,
        requestDigest: 'd'.repeat(64),
        tokenHash: 'e'.repeat(64),
      })).toBe('attempt_conflict');
      expect(await store.isSpent('e'.repeat(64))).toBe(false);
    });
  });
}
