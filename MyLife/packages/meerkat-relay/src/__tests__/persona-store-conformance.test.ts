import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import {
  configureSyncSecretStore,
  createInMemorySyncSecretStore,
  createPersonaClaim,
  generatePublicPersona,
} from '@mylife/sync';
import { FilePersonaRegistryStore } from '../persona-registry-store-file';
import {
  InMemoryPersonaRegistryStore,
  PERSONA_REGISTRATION_RESERVATION_TTL_MS,
  type PersonaRecord,
  type PersonaRegistrationAttempt,
  type PersonaRegistryStore,
} from '../persona-registry';

const NOW = Date.parse('2026-07-10T12:00:00.000Z');
const tempDirs: string[] = [];

interface StoreCase {
  name: string;
  createPair(): Promise<readonly [PersonaRegistryStore, PersonaRegistryStore]>;
}

const storeCases: StoreCase[] = [
  {
    name: 'memory',
    createPair: async () => {
      const store = new InMemoryPersonaRegistryStore();
      return [store, store];
    },
  },
  {
    name: 'file',
    createPair: async () => {
      const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'persona-conformance-'));
      tempDirs.push(dir);
      return [new FilePersonaRegistryStore(dir), new FilePersonaRegistryStore(dir)];
    },
  },
];

function makeRecord(alias: string): PersonaRecord {
  const persona = generatePublicPersona(alias);
  const humanityBinding = 'a'.repeat(128);
  return {
    version: 1,
    alias,
    personaPubkey: persona.personaPubkey,
    humanityBinding,
    claim: createPersonaClaim({ persona, humanityBinding }),
    createdAt: new Date(NOW).toISOString(),
  };
}

beforeEach(() => {
  configureSyncSecretStore(createInMemorySyncSecretStore());
});

afterAll(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => fs.rm(dir, { recursive: true, force: true })));
});

for (const storeCase of storeCases) {
  describe(`PersonaRegistryStore atomic conformance (${storeCase.name})`, () => {
    it('lets exactly one store instance reserve a shared alias', async () => {
      const [first, second] = await storeCase.createPair();
      const a = makeRecord('rivals');
      const b = makeRecord('rivals');

      const outcomes = await Promise.all([
        first.tryRegister(a, NOW),
        second.tryRegister(b, NOW),
      ]);

      expect(outcomes.filter((outcome) => outcome === 'ok')).toHaveLength(1);
      expect(outcomes.filter((outcome) => outcome === 'alias_taken')).toHaveLength(1);
    });

    it('decides cooldown and revocation in the registration critical section', async () => {
      const [first, second] = await storeCase.createPair();
      const original = makeRecord('cooldown');
      expect(await first.tryRegister(original, NOW)).toBe('ok');
      await first.release(original.alias, {
        alias: original.alias,
        personaPubkey: original.personaPubkey,
        releasedAt: new Date(NOW).toISOString(),
        reregisterBlockedUntilMs: NOW + 60_000,
      });

      const replacement = makeRecord('cooldown');
      expect(await second.tryRegister(replacement, NOW + 1)).toBe('alias_cooldown');
      expect(await second.tryRegister(replacement, NOW + 60_000)).toBe('ok');

      const revoked = makeRecord('revokedone');
      await first.revoke(revoked.personaPubkey, 'conformance_test');
      expect(await second.tryRegister(revoked, NOW)).toBe('persona_revoked');
    });

    it('serializes lifecycle callbacks across store instances', async () => {
      const [first, second] = await storeCase.createPair();
      const record = makeRecord('serialize');
      let releaseFirst!: () => void;
      let firstEntered!: () => void;
      const entered = new Promise<void>((resolve) => { firstEntered = resolve; });
      const hold = new Promise<void>((resolve) => { releaseFirst = resolve; });
      const order: string[] = [];

      const firstRun = first.withPersonaWriteLock!(record.personaPubkey, async () => {
        order.push('first-enter');
        firstEntered();
        await hold;
        order.push('first-exit');
      });
      await entered;
      const secondRun = second.withPersonaWriteLock!(record.personaPubkey, async () => {
        order.push('second-enter');
      });
      await new Promise((resolve) => setTimeout(resolve, 40));
      expect(order).toEqual(['first-enter']);
      releaseFirst();
      await Promise.all([firstRun, secondRun]);
      expect(order).toEqual(['first-enter', 'first-exit', 'second-enter']);
    });

    it('supports bounded reverse lookup without changing record semantics', async () => {
      const [store] = await storeCase.createPair();
      const first = makeRecord('batchone');
      const second = makeRecord('batchtwo');
      await store.tryRegister(first, NOW);
      await store.tryRegister(second, NOW);

      const records = await store.getByPubkeys!([
        first.personaPubkey,
        second.personaPubkey,
        'f'.repeat(64),
      ]);
      expect(records.map((record) => record.alias).sort()).toEqual(['batchone', 'batchtwo']);
    });

    it('keeps saga reservations invisible and commits them idempotently', async () => {
      const [first, second] = await storeCase.createPair();
      const record = makeRecord('sagareg');
      const attempt: PersonaRegistrationAttempt = {
        version: 1,
        attemptId: '1'.repeat(64),
        requestDigest: '2'.repeat(64),
        state: 'reserved',
        record,
        createdAt: new Date(NOW).toISOString(),
        updatedAt: new Date(NOW).toISOString(),
      };
      expect(await first.beginRegistrationAttempt!(attempt, NOW)).toBe('reserved');
      expect(await second.getByAlias(record.alias)).toBeNull();
      expect(await second.beginRegistrationAttempt!(attempt, NOW)).toBe('resume_reserved');
      expect(await second.beginRegistrationAttempt!({
        ...attempt,
        requestDigest: '3'.repeat(64),
      }, NOW)).toBe('attempt_conflict');

      const rival = makeRecord('sagareg');
      expect(await second.beginRegistrationAttempt!({
        ...attempt,
        attemptId: '4'.repeat(64),
        requestDigest: '5'.repeat(64),
        record: rival,
      }, NOW)).toBe('alias_taken');
      expect(await first.markRegistrationHumanityVerified!(
        attempt.attemptId,
        attempt.requestDigest,
      )).toBe('ok');
      expect(await second.commitRegistrationAttempt!(
        attempt.attemptId,
        attempt.requestDigest,
        NOW,
      )).toEqual({ outcome: 'ok', record });
      expect(await first.getByAlias(record.alias)).toEqual(record);
      expect(await second.beginRegistrationAttempt!(attempt, NOW)).toBe('committed');
    });

    it('releases abandoned reservations and recovers verified commits during prune', async () => {
      const [first, second] = await storeCase.createPair();
      const abandoned = makeRecord('sagaexpiry');
      const abandonedAttempt: PersonaRegistrationAttempt = {
        version: 1,
        attemptId: '8'.repeat(64),
        requestDigest: '9'.repeat(64),
        state: 'reserved',
        record: abandoned,
        createdAt: new Date(NOW).toISOString(),
        updatedAt: new Date(NOW).toISOString(),
      };
      expect(await first.beginRegistrationAttempt!(abandonedAttempt, NOW)).toBe('reserved');
      const afterExpiry = NOW + PERSONA_REGISTRATION_RESERVATION_TTL_MS + 1;
      await first.prune(afterExpiry);

      const replacement = makeRecord('sagaexpiry');
      const replacementAttempt: PersonaRegistrationAttempt = {
        ...abandonedAttempt,
        attemptId: 'a'.repeat(64),
        requestDigest: 'b'.repeat(64),
        record: replacement,
        createdAt: new Date(afterExpiry).toISOString(),
        updatedAt: new Date(afterExpiry).toISOString(),
      };
      expect(await second.beginRegistrationAttempt!(replacementAttempt, afterExpiry)).toBe('reserved');
      await second.cancelRegistrationAttempt!(
        replacementAttempt.attemptId,
        replacementAttempt.requestDigest,
      );

      const recoverable = makeRecord('sagarecover');
      const recoverableAttempt: PersonaRegistrationAttempt = {
        ...abandonedAttempt,
        attemptId: 'c'.repeat(64),
        requestDigest: 'd'.repeat(64),
        record: recoverable,
        createdAt: new Date(afterExpiry).toISOString(),
        updatedAt: new Date(afterExpiry).toISOString(),
      };
      expect(await first.beginRegistrationAttempt!(recoverableAttempt, afterExpiry)).toBe('reserved');
      expect(await first.markRegistrationHumanityVerified!(
        recoverableAttempt.attemptId,
        recoverableAttempt.requestDigest,
      )).toBe('ok');
      await second.prune(afterExpiry + 1);
      expect(await first.getByAlias(recoverable.alias)).toEqual(recoverable);
    });
  });
}

describe('FilePersonaRegistryStore revocation audit marker', () => {
  it('persists the explicit revocation reason while accepting legacy marker reads', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'persona-revocation-'));
    tempDirs.push(dir);
    const store = new FilePersonaRegistryStore(dir);
    const record = makeRecord('auditmark');

    await store.revoke(record.personaPubkey, 'operator_suspend');
    const marker = JSON.parse(
      await fs.readFile(path.join(dir, 'revoked', record.personaPubkey), 'utf8'),
    ) as { reason: string; revokedAt: string };
    expect(marker.reason).toBe('operator_suspend');
    expect(Number.isNaN(Date.parse(marker.revokedAt))).toBe(false);

    await fs.writeFile(path.join(dir, 'revoked', record.personaPubkey), '1', 'utf8');
    await expect(store.isRevoked(record.personaPubkey)).resolves.toBe(true);
  });

  it('treats a corrupt tombstone as a typed cooldown instead of failing open', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'persona-corrupt-tombstone-'));
    tempDirs.push(dir);
    await fs.mkdir(path.join(dir, 'tombstones'), { recursive: true });
    await fs.writeFile(path.join(dir, 'tombstones', 'blocked.json'), '{', 'utf8');
    const store = new FilePersonaRegistryStore(dir);

    await expect(store.tryRegister(makeRecord('blocked'), NOW)).resolves.toBe('alias_cooldown');
  });

  it('repairs a verified commit interrupted between alias and pubkey writes', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'persona-saga-repair-'));
    tempDirs.push(dir);
    const record = makeRecord('repairable');
    const attempt: PersonaRegistrationAttempt = {
      version: 1,
      attemptId: '6'.repeat(64),
      requestDigest: '7'.repeat(64),
      state: 'reserved',
      record,
      createdAt: new Date(NOW).toISOString(),
      updatedAt: new Date(NOW).toISOString(),
    };
    const first = new FilePersonaRegistryStore(dir);
    expect(await first.beginRegistrationAttempt(attempt, NOW)).toBe('reserved');
    expect(await first.markRegistrationHumanityVerified(
      attempt.attemptId,
      attempt.requestDigest,
    )).toBe('ok');

    // Exact crash image: humanity is durable and the active alias write landed, but the
    // pubkey pointer and committed saga transition did not.
    await fs.mkdir(path.join(dir, 'personas'), { recursive: true });
    await fs.writeFile(
      path.join(dir, 'personas', `${record.alias}.json`),
      JSON.stringify(record),
      'utf8',
    );
    const restarted = new FilePersonaRegistryStore(dir);
    expect(await restarted.commitRegistrationAttempt(
      attempt.attemptId,
      attempt.requestDigest,
      NOW,
    )).toEqual({ outcome: 'ok', record });
    expect(await restarted.getByPubkey(record.personaPubkey)).toEqual(record);
    expect(await restarted.beginRegistrationAttempt(attempt, NOW)).toBe('committed');
  });
});
