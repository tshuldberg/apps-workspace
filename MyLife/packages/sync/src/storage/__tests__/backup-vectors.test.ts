import nacl from 'tweetnacl';
import { describe, expect, it } from 'vitest';
import { bytesToHex } from '../../encryption/keys';
import { encodeRecoveryKey } from '../../node/recovery-key';
import {
  canonicalBackupManifest,
  decodeBackup,
  deriveBackupChunkKey,
  deriveBackupRootKey,
  encodeBackup,
  type BackupDecodeErrorCode,
  type EncodedBackup,
  type EncryptedBackupChunk,
} from '../backup-format';
import {
  BACKUP_V1_GOLDEN,
  VECTOR_BACKUP_INPUT,
  VECTOR_DATABASE_CHUNKS,
  VECTOR_OBJECTS,
  VECTOR_RECOVERY_KEY,
  VECTOR_RECOVERY_KEY_BYTES,
  VECTOR_SEALED_RECOVERY_BUNDLE,
} from '../test-vectors';

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

function independentHmacSha512(key: Uint8Array, message: Uint8Array): Uint8Array {
  const blockLength = 128;
  const normalized = key.length > blockLength ? nacl.hash(key) : key;
  const keyBlock = new Uint8Array(blockLength);
  keyBlock.set(normalized);
  const innerPad = new Uint8Array(blockLength);
  const outerPad = new Uint8Array(blockLength);
  for (let index = 0; index < blockLength; index += 1) {
    innerPad[index] = (keyBlock[index] ?? 0) ^ 0x36;
    outerPad[index] = (keyBlock[index] ?? 0) ^ 0x5c;
  }
  return nacl.hash(concat(outerPad, nacl.hash(concat(innerPad, message))));
}

/** RFC 5869 Extract + first Expand block, implemented independently for 32-byte vectors. */
function independentHkdf(ikm: Uint8Array, info: string): Uint8Array {
  const prk = independentHmacSha512(new Uint8Array(64), ikm);
  const firstBlock = independentHmacSha512(
    prk,
    concat(new TextEncoder().encode(info), new Uint8Array([1])),
  );
  return firstBlock.slice(0, 32);
}

function cloneChunk(chunk: EncryptedBackupChunk): EncryptedBackupChunk {
  return { ...chunk, envelope: chunk.envelope.slice() };
}

function cloneBackup(backup: EncodedBackup): EncodedBackup {
  return {
    locatorJson: backup.locatorJson,
    manifest: { ...backup.manifest, envelope: backup.manifest.envelope.slice() },
    databaseChunks: backup.databaseChunks.map(cloneChunk),
    objectChunks: backup.objectChunks.map(cloneChunk),
    identityChunk: backup.identityChunk === null
      ? null
      : { ...backup.identityChunk, envelope: backup.identityChunk.envelope.slice() },
  };
}

function flip(envelope: Uint8Array): Uint8Array {
  const changed = envelope.slice();
  const index = Math.floor(changed.length / 2);
  changed[index] = (changed[index] ?? 0) ^ 0x01;
  return changed;
}

function expectFailure(backup: EncodedBackup, code: BackupDecodeErrorCode, recoveryKey = VECTOR_RECOVERY_KEY): void {
  const result = decodeBackup(backup, recoveryKey);
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('decode unexpectedly succeeded');
  expect(result.error.code).toBe(code);
}

describe('Backup Format v1 golden vectors', () => {
  it('matches independently implemented RFC 5869 root and chunk derivations', () => {
    const independentRoot = independentHkdf(
      VECTOR_RECOVERY_KEY_BYTES,
      'meerkat-storage-backup-v1:vector-backup-0001',
    );
    expect(bytesToHex(independentRoot)).toBe(BACKUP_V1_GOLDEN.backupRootKey);

    const independentDatabaseKey = independentHkdf(
      independentRoot,
      'meerkat-storage-backup-v1/chunk:database:database:0',
    );
    expect(bytesToHex(independentDatabaseKey)).toBe(BACKUP_V1_GOLDEN.chunkKeys.database0);
  });

  it('matches every hardcoded key, ciphertext hash, manifest hash, and signature', () => {
    const root = deriveBackupRootKey(VECTOR_RECOVERY_KEY_BYTES, VECTOR_BACKUP_INPUT.backupId);
    expect(bytesToHex(root)).toBe(BACKUP_V1_GOLDEN.backupRootKey);
    expect(bytesToHex(deriveBackupChunkKey(root, 'manifest', 'manifest', 0)))
      .toBe(BACKUP_V1_GOLDEN.chunkKeys.manifest);
    expect(bytesToHex(deriveBackupChunkKey(root, 'database', 'database', 0)))
      .toBe(BACKUP_V1_GOLDEN.chunkKeys.database0);
    expect(bytesToHex(deriveBackupChunkKey(root, 'database', 'database', 1)))
      .toBe(BACKUP_V1_GOLDEN.chunkKeys.database1);
    expect(bytesToHex(deriveBackupChunkKey(root, 'object', 'cipher-object-0001', 0)))
      .toBe(BACKUP_V1_GOLDEN.chunkKeys.object0001Chunk0);
    expect(bytesToHex(deriveBackupChunkKey(root, 'object', 'cipher-object-0001', 1)))
      .toBe(BACKUP_V1_GOLDEN.chunkKeys.object0001Chunk1);
    expect(bytesToHex(deriveBackupChunkKey(root, 'object', 'cipher-object-0002', 0)))
      .toBe(BACKUP_V1_GOLDEN.chunkKeys.object0002Chunk0);

    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    expect(backup.databaseChunks.map((chunk) => chunk.ciphertextHash))
      .toEqual(BACKUP_V1_GOLDEN.ciphertextHashes.database);
    expect(backup.objectChunks.map((chunk) => chunk.ciphertextHash))
      .toEqual(BACKUP_V1_GOLDEN.ciphertextHashes.objects);
    expect(backup.manifest.ciphertextHash).toBe(BACKUP_V1_GOLDEN.encryptedManifestHash);
    const decoded = decodeBackup(backup, VECTOR_RECOVERY_KEY);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) throw decoded.error;
    expect(decoded.manifestSignature).toBe(BACKUP_V1_GOLDEN.manifestSignature);
  });

  it('separates database and object purposes at identical object ids and indices', () => {
    const root = deriveBackupRootKey(VECTOR_RECOVERY_KEY_BYTES, VECTOR_BACKUP_INPUT.backupId);
    const database = deriveBackupChunkKey(root, 'database', 'database', 0);
    const object = deriveBackupChunkKey(root, 'object', 'database', 0);
    expect(bytesToHex(database)).not.toBe(bytesToHex(object));
  });

  it('uses a distinct deterministic nonce for every encrypted envelope', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const nonceHexes = [
      ...backup.databaseChunks,
      ...backup.objectChunks,
    ].map((chunk) => bytesToHex(chunk.envelope.slice(0, nacl.secretbox.nonceLength)));
    nonceHexes.push(bytesToHex(backup.manifest.envelope.slice(0, nacl.secretbox.nonceLength)));
    expect(new Set(nonceHexes).size).toBe(nonceHexes.length);
  });

  it('canonicalizes map and object construction order to identical bytes', () => {
    const first = encodeBackup(VECTOR_BACKUP_INPUT);
    const reordered = encodeBackup({
      ...VECTOR_BACKUP_INPUT,
      dataClassVersions: { library_object: 2, database: 3, attachment: 7 },
      objects: [...VECTOR_BACKUP_INPUT.objects].reverse(),
    });
    expect(bytesToHex(reordered.manifest.envelope)).toBe(bytesToHex(first.manifest.envelope));

    const decoded = decodeBackup(first, VECTOR_RECOVERY_KEY);
    if (!decoded.ok) throw decoded.error;
    expect(canonicalBackupManifest(decoded.manifest)).toEqual(canonicalBackupManifest({
      ...decoded.manifest,
      objects: [...decoded.manifest.objects].reverse(),
      dataClassVersions: { library_object: 2, database: 3, attachment: 7 },
    }));
  });

  it('keeps locator.json exact and non-secret', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const locator = JSON.parse(backup.locatorJson) as Record<string, unknown>;
    expect(Object.keys(locator).sort()).toEqual([
      'backupId',
      'createdAt',
      'encryptedManifestHash',
      'formatVersion',
    ]);
    expect(backup.locatorJson).not.toContain(VECTOR_RECOVERY_KEY);
    expect(backup.locatorJson).not.toContain(VECTOR_SEALED_RECOVERY_BUNDLE);
    expect(backup.locatorJson).not.toContain('attachment');
    expect(backup.locatorJson).not.toContain('vector-device');
  });
});

describe('Backup Format v1 decode', () => {
  it('round-trips exact bounded plaintext chunks and the existing sealed recovery bundle', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const result = decodeBackup(backup, VECTOR_RECOVERY_KEY);
    expect(result.ok).toBe(true);
    if (!result.ok) throw result.error;
    expect(result.databaseChunks).toEqual(VECTOR_DATABASE_CHUNKS);
    expect(result.objects).toEqual(VECTOR_OBJECTS);
    expect(result.sealedRecoveryBundle).toBe(VECTOR_SEALED_RECOVERY_BUNDLE);
    expect(result.manifest.backupId).toBe('vector-backup-0001');
  });

  it('fails with wrong_key for a different valid MKR1 recovery key', () => {
    const wrongKey = encodeRecoveryKey(new Uint8Array(32).fill(0xff));
    expectFailure(encodeBackup(VECTOR_BACKUP_INPUT), 'wrong_key', wrongKey);
  });

  it('fails bad_signature when the signer does not match the restore trust anchor', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const result = decodeBackup(backup, VECTOR_RECOVERY_KEY, {
      expectedDevicePublicKey: '00'.repeat(32),
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('decode unexpectedly accepted the wrong signer');
    expect(result.error.code).toBe('bad_signature');
  });

  it('fails tampered_chunk when one bit flips in any stored chunk type', () => {
    const original = encodeBackup(VECTOR_BACKUP_INPUT);
    const mutations: Array<(backup: EncodedBackup) => EncodedBackup> = [
      (backup) => ({
        ...backup,
        manifest: { ...backup.manifest, envelope: flip(backup.manifest.envelope) },
      }),
      ...original.databaseChunks.map((_, target) => (backup: EncodedBackup): EncodedBackup => ({
        ...backup,
        databaseChunks: backup.databaseChunks.map((chunk, index) => (
          index === target ? { ...chunk, envelope: flip(chunk.envelope) } : chunk
        )),
      })),
      ...original.objectChunks.map((_, target) => (backup: EncodedBackup): EncodedBackup => ({
        ...backup,
        objectChunks: backup.objectChunks.map((chunk, index) => (
          index === target ? { ...chunk, envelope: flip(chunk.envelope) } : chunk
        )),
      })),
      (backup) => {
        if (backup.identityChunk === null) throw new Error('vector identity chunk is missing');
        return {
          ...backup,
          identityChunk: { ...backup.identityChunk, envelope: flip(backup.identityChunk.envelope) },
        };
      },
    ];
    for (const mutate of mutations) expectFailure(mutate(cloneBackup(original)), 'tampered_chunk');
  });

  it('fails missing_chunk when a required chunk is dropped', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    expectFailure({ ...backup, objectChunks: backup.objectChunks.slice(0, -1) }, 'missing_chunk');
  });

  it('fails chunk_order when chunks are swapped', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const first = backup.databaseChunks[0];
    const second = backup.databaseChunks[1];
    if (first === undefined || second === undefined) throw new Error('vector requires two database chunks');
    expectFailure({ ...backup, databaseChunks: [second, first] }, 'chunk_order');
  });

  it('fails truncated when the final chunk is shorter than its signed length', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const final = backup.objectChunks[backup.objectChunks.length - 1];
    if (final === undefined) throw new Error('vector requires an object chunk');
    const objectChunks = backup.objectChunks.slice(0, -1);
    objectChunks.push({ ...final, envelope: final.envelope.slice(0, -1) });
    expectFailure({ ...backup, objectChunks }, 'truncated');
  });

  it('rejects unsupported locators, extra locator fields, and locator/manifest mismatches', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const locator = JSON.parse(backup.locatorJson) as Record<string, unknown>;
    expectFailure({ ...backup, locatorJson: JSON.stringify({ ...locator, formatVersion: 2 }) }, 'unsupported_version');
    expectFailure({ ...backup, locatorJson: JSON.stringify({ ...locator, account: 'secret@example.com' }) }, 'locator_mismatch');
    expectFailure({
      ...backup,
      locatorJson: JSON.stringify({ ...locator, createdAt: '2026-07-14T12:00:01.000Z' }),
    }, 'locator_mismatch');
  });
});
