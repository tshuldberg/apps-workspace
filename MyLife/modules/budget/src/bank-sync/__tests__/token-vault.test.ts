import { describe, expect, it } from 'vitest';

import {
  createEncryptedBankTokenVault,
  createInMemoryTokenVaultStore,
  createKmsBackedBankTokenVault,
} from '../token-vault';

describe('EncryptedBankTokenVault', () => {
  it('round-trips encrypted tokens and supports delete', async () => {
    const store = createInMemoryTokenVaultStore();
    const cipher = {
      encrypt: (value: string) => `enc:${value}`,
      decrypt: (value: string) => value.replace(/^enc:/, ''),
    };
    const vault = createEncryptedBankTokenVault({
      store,
      cipher,
      nowIso: () => '2026-02-25T00:00:00.000Z',
    });

    await vault.setTokens({
      provider: 'plaid',
      connectionExternalId: 'item-123',
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    const rawStored = await store.get('plaid', 'item-123');
    expect(rawStored?.accessTokenCiphertext).toBe('enc:access-token');
    expect(rawStored?.refreshTokenCiphertext).toBe('enc:refresh-token');

    const decrypted = await vault.getTokens('plaid', 'item-123');
    expect(decrypted).toEqual({
      accessToken: 'access-token',
      refreshToken: 'refresh-token',
    });

    await vault.deleteTokens('plaid', 'item-123');
    expect(await vault.getTokens('plaid', 'item-123')).toBeNull();
  });

  it('supports KMS-backed encryption contexts for access and refresh tokens', async () => {
    const store = createInMemoryTokenVaultStore();
    const kmsClient = {
      encrypt: (input: {
        plaintext: string;
        encryptionContext: Record<string, string>;
      }) => ({
        ciphertext: `kms:${input.encryptionContext.token_type}:${input.plaintext}`,
      }),
      decrypt: (input: {
        ciphertext: string;
        encryptionContext: Record<string, string>;
      }) => ({
        plaintext: input.ciphertext.replace(
          `kms:${input.encryptionContext.token_type}:`,
          '',
        ),
      }),
    };
    const vault = createKmsBackedBankTokenVault({
      store,
      kmsClient,
      nowIso: () => '2026-02-26T00:00:00.000Z',
      baseEncryptionContext: {
        service: 'mybudget-bank-sync',
      },
    });

    await vault.setTokens({
      provider: 'plaid',
      connectionExternalId: 'item-kms',
      accessToken: 'kms-access',
      refreshToken: 'kms-refresh',
    });

    const rawStored = await store.get('plaid', 'item-kms');
    expect(rawStored?.accessTokenCiphertext).toBe('kms:access:kms-access');
    expect(rawStored?.refreshTokenCiphertext).toBe('kms:refresh:kms-refresh');

    const decrypted = await vault.getTokens('plaid', 'item-kms');
    expect(decrypted).toEqual({
      accessToken: 'kms-access',
      refreshToken: 'kms-refresh',
    });
  });
});
