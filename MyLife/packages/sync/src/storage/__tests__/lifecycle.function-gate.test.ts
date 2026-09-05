import { describe, expect, it } from 'vitest';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  randomInt,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { brokerVaultCredentialRef, parseBrokerVaultCredentialRef } from '../lifecycle';

const VAULT_CHARACTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789._:-';

describe('brokerVaultCredentialRef function quality gate', () => {
  it('round-trips a valid vault id and rejects invalid ids', () => {
    expect(brokerVaultCredentialRef('vault_41:rotated')).toBe('broker://oauth/vault_41:rotated');
    expect(parseBrokerVaultCredentialRef('broker://oauth/vault_41:rotated')).toBe('vault_41:rotated');
    expect(parseBrokerVaultCredentialRef('https://vault.invalid')).toBeNull();
    expect(() => brokerVaultCredentialRef('bad/vault')).toThrow('broker vault id is invalid');
  });

  it('passes deterministic vault-id fuzz invariants', async () => {
    await runDeterministicFuzz({
      label: 'brokerVaultCredentialRef fuzz',
      iterations: 200,
      seed: 41,
      makeCase: (rng) => Array.from(
        { length: randomInt(rng, 1, 200) },
        () => VAULT_CHARACTERS[randomInt(rng, 0, VAULT_CHARACTERS.length - 1)]!,
      ).join(''),
      assertCase: async (vaultId) => {
        const reference = brokerVaultCredentialRef(vaultId);
        expect(parseBrokerVaultCredentialRef(reference)).toBe(vaultId);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'brokerVaultCredentialRef',
      sizes: [50, 100, 200],
      expected: 'linear',
      setup: (size) => 'v'.repeat(size),
      run: async (vaultId) => {
        for (let iteration = 0; iteration < 100; iteration += 1) brokerVaultCredentialRef(vaultId);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'brokerVaultCredentialRef',
      repeats: 100,
      maxHeapDeltaBytes: 8 * 1024 * 1024,
      setup: () => 'v'.repeat(200),
      run: async (vaultId) => brokerVaultCredentialRef(vaultId),
    });
  });
});
