/**
 * Push token envelope cipher tests (Plan 42 P4).
 *
 * Proves the three rotation/validation pins: encrypt-under-active / decrypt-by-version
 * so a rotation never orphans old tokens, an unknown version is a TYPED failure (never a
 * silent null), fail-closed key validation (wrong length, duplicate version, missing
 * active, unreadable dir), and readiness reporting the active version.
 */

import { randomBytes } from 'node:crypto';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  AesGcmPushTokenCipher,
  PushTokenCipherError,
  loadAesGcmPushTokenCipherFromDir,
} from '../push-token-cipher';
import type { PushTokenCipherContext } from '../push-store';

const dirs: string[] = [];
afterEach(async () => {
  while (dirs.length) {
    const dir = dirs.pop();
    if (dir) await fs.rm(dir, { recursive: true, force: true });
  }
});

async function keyDir(entries: Record<number, Buffer>): Promise<string> {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-keys-'));
  dirs.push(dir);
  for (const [version, key] of Object.entries(entries)) {
    await fs.writeFile(path.join(dir, `${version}.key`), key.toString('hex'));
  }
  return dir;
}

const context: PushTokenCipherContext = {
  registrationIdHash: 'a'.repeat(64),
  provider: 'apns',
  tokenGeneration: 1,
};

describe('AesGcmPushTokenCipher rotation', () => {
  it('encrypts under the active version and round-trips', async () => {
    const cipher = new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(32) }], activeVersion: 1 });
    const sealed = await cipher.encryptProviderToken('apns-device-token', context);
    expect(sealed.keyVersion).toBe(1);
    expect(await cipher.decryptProviderToken(sealed, context)).toBe('apns-device-token');
  });

  it('keeps decrypting a v1 token after rotating the active version to v2', async () => {
    const v1 = randomBytes(32);
    const v2 = randomBytes(32);
    const before = new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: v1 }], activeVersion: 1 });
    const oldToken = await before.encryptProviderToken('old-token', context);
    expect(oldToken.keyVersion).toBe(1);

    // Rotate: the keyring now holds both versions, active is v2.
    const after = new AesGcmPushTokenCipher({
      keyring: [{ version: 1, key: v1 }, { version: 2, key: v2 }],
      activeVersion: 2,
    });
    // The old token still decrypts (by its embedded version), and new tokens carry v2.
    expect(await after.decryptProviderToken(oldToken, context)).toBe('old-token');
    const newToken = await after.encryptProviderToken('new-token', context);
    expect(newToken.keyVersion).toBe(2);
    expect(await after.decryptProviderToken(newToken, context)).toBe('new-token');
  });

  it('fails typed on an unknown key version (never a silent null)', async () => {
    const v1 = randomBytes(32);
    const cipher = new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: v1 }], activeVersion: 1 });
    const sealed = await cipher.encryptProviderToken('token', context);
    // Forge the envelope version to v9 (which is not in the keyring).
    const forged = Buffer.from(sealed.ciphertext);
    forged.writeUInt32BE(9, 0);
    await expect(
      cipher.decryptProviderToken({ ciphertext: new Uint8Array(forged), keyVersion: 9 }, context),
    ).rejects.toBeInstanceOf(PushTokenCipherError);
  });

  it('fails typed when the context does not match (AAD binding)', async () => {
    const cipher = new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(32) }], activeVersion: 1 });
    const sealed = await cipher.encryptProviderToken('token', context);
    await expect(
      cipher.decryptProviderToken(sealed, { ...context, tokenGeneration: 2 }),
    ).rejects.toBeInstanceOf(PushTokenCipherError);
  });

  it('rejects a wrong-length key, a duplicate version, and a missing active version', () => {
    expect(() => new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(16) }], activeVersion: 1 }))
      .toThrow(PushTokenCipherError);
    expect(() => new AesGcmPushTokenCipher({
      keyring: [{ version: 1, key: randomBytes(32) }, { version: 1, key: randomBytes(32) }],
      activeVersion: 1,
    })).toThrow(PushTokenCipherError);
    expect(() => new AesGcmPushTokenCipher({ keyring: [{ version: 1, key: randomBytes(32) }], activeVersion: 5 }))
      .toThrow(PushTokenCipherError);
  });

  it('reports readiness for the active version', async () => {
    const cipher = new AesGcmPushTokenCipher({
      keyring: [{ version: 1, key: randomBytes(32) }, { version: 2, key: randomBytes(32) }],
      activeVersion: 2,
    });
    expect(await cipher.readiness()).toEqual({ ready: true, keyVersion: 2 });
    expect(cipher.loadedVersionCount()).toBe(2);
  });
});

describe('loadAesGcmPushTokenCipherFromDir', () => {
  it('loads a keyring from <version>.key files and round-trips across the rotation window', async () => {
    const v1 = randomBytes(32);
    const dir = await keyDir({ 1: v1 });
    const before = await loadAesGcmPushTokenCipherFromDir({ directory: dir, activeVersion: 1 });
    const oldToken = await before.encryptProviderToken('legacy', context);

    // Add v2 to the same directory and load with active v2.
    await fs.writeFile(path.join(dir, '2.key'), randomBytes(32).toString('hex'));
    const after = await loadAesGcmPushTokenCipherFromDir({ directory: dir, activeVersion: 2 });
    expect(await after.decryptProviderToken(oldToken, context)).toBe('legacy');
    expect((await after.encryptProviderToken('fresh', context)).keyVersion).toBe(2);
  });

  it('fails closed on an unreadable directory', async () => {
    await expect(
      loadAesGcmPushTokenCipherFromDir({ directory: '/definitely/missing/push-keys', activeVersion: 1 }),
    ).rejects.toBeInstanceOf(PushTokenCipherError);
  });

  it('fails closed when the active version has no key file', async () => {
    const dir = await keyDir({ 1: randomBytes(32) });
    await expect(
      loadAesGcmPushTokenCipherFromDir({ directory: dir, activeVersion: 3 }),
    ).rejects.toBeInstanceOf(PushTokenCipherError);
  });

  it('fails closed on a wrong-length key file', async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'push-keys-'));
    dirs.push(dir);
    await fs.writeFile(path.join(dir, '1.key'), 'too-short');
    await expect(
      loadAesGcmPushTokenCipherFromDir({ directory: dir, activeVersion: 1 }),
    ).rejects.toBeInstanceOf(PushTokenCipherError);
  });
});
