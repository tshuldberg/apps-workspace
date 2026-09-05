import { describe, expect, it } from 'vitest';
import {
  loadMountedSecretKmsFromFile,
  MountedSecretKms,
  OAuthKmsError,
  type KmsContext,
} from '../oauth-kms';

const CONTEXT: KmsContext = {
  purpose: 'oauth_refresh_token',
  vaultId: 'vault-1',
  provider: 'google',
  subjectId: 'subject-1',
};

describe('MountedSecretKms', () => {
  it('wraps and unwraps a 256-bit data key without persisting plaintext in the envelope', async () => {
    let calls = 0;
    const kms = new MountedSecretKms(new Uint8Array(32).fill(0x33), (size) => {
      calls += 1;
      return Buffer.alloc(size, calls === 1 ? 0x11 : 0x22);
    });

    const generated = await kms.generateDataKey(CONTEXT);
    expect([...generated.plaintextKey]).toEqual([...new Uint8Array(32).fill(0x11)]);
    expect(generated.wrappedKey).toHaveLength(60);
    expect(generated.wrappedKey.slice(28)).not.toEqual(generated.plaintextKey);
    expect([...(await kms.decryptDataKey(generated.wrappedKey, CONTEXT))])
      .toEqual([...generated.plaintextKey]);
  });

  it('authenticates the vault, provider, and subject context', async () => {
    const kms = new MountedSecretKms(new Uint8Array(32).fill(0x44));
    const generated = await kms.generateDataKey(CONTEXT);

    await expect(kms.decryptDataKey(generated.wrappedKey, {
      ...CONTEXT,
      subjectId: 'different-subject',
    })).rejects.toBeInstanceOf(OAuthKmsError);
  });

  it('loads a mounted hex key and zeroizes the source file buffer', async () => {
    const mountedBytes = Buffer.from(`${'55'.repeat(32)}\n`, 'utf8');
    const kms = await loadMountedSecretKmsFromFile('/run/secrets/oauth-kms', async () => mountedBytes);
    expect([...mountedBytes].every((byte) => byte === 0)).toBe(true);

    const generated = await kms.generateDataKey(CONTEXT);
    expect([...(await kms.decryptDataKey(generated.wrappedKey, CONTEXT))])
      .toEqual([...generated.plaintextKey]);
  });

  it('rejects malformed mounted key material', async () => {
    await expect(loadMountedSecretKmsFromFile('/run/secrets/oauth-kms', async () => Buffer.from('short')))
      .rejects.toBeInstanceOf(OAuthKmsError);
  });
});
