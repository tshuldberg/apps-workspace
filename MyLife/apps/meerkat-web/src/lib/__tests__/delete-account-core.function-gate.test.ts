import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase } from '@mylife/db';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../../../../test/vitest/function-quality';
import { runDeleteMyData, type DeleteMyDataDependencies } from '../delete-account-core';

function dependencies(secretCount: number, remoteOk = true): DeleteMyDataDependencies & { close(): void } {
  const memory = createInMemoryTestDatabase();
  const db = memory.adapter;
  db.execute('CREATE TABLE sync_paired_devices (shared_secret_ref TEXT)');
  for (let index = 0; index < secretCount; index += 1) {
    db.execute('INSERT INTO sync_paired_devices (shared_secret_ref) VALUES (?)', [`secret-${index}`]);
  }
  return {
    db, identityPrivateKeyRef: 'identity-secret', hasPublicPersona: true,
    deleteRemotePersona: async () => remoteOk ? { ok: true } : { ok: false, reason: 'unreachable' },
    deleteStorageData: async () => ({ complete: true, failures: [] }),
    clearNodeBytes: async () => undefined, clearBlobBytes: async () => undefined,
    deleteSecret: () => undefined, createFreshIdentity: () => undefined,
    close: () => memory.close(),
  };
}

describe('web runDeleteMyData function quality gate', () => {
  it('fails closed before local destruction on remote failure', async () => {
    const deps = dependencies(1, false);
    await expect(runDeleteMyData(deps)).resolves.toEqual({ ok: false, reason: 'public_account_delete_failed:unreachable' });
    deps.close();
  });

  it('passes deterministic secret-count fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'web runDeleteMyData fuzz', iterations: 50, seed: 42,
      makeCase: (rng) => randomInt(rng, 0, 25),
      assertCase: async (count) => {
        const deps = dependencies(count);
        await expect(runDeleteMyData(deps)).resolves.toEqual({ ok: true });
        deps.close();
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'web runDeleteMyData', sizes: [50, 100, 200], expected: 'linear', setup: dependencies,
      run: async (deps) => { await runDeleteMyData(deps); deps.close(); },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'web runDeleteMyData', repeats: 20, maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => dependencies(25), run: async (deps) => { await runDeleteMyData(deps); deps.close(); },
    });
  });
});
