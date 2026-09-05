import { describe, expect, it } from 'vitest';
import { bytesToHex } from '../../encryption/keys';
import { encodeRecoveryKey } from '../../node/recovery-key';
import {
  canonicalBackupManifest,
  createBackupEncoder,
  encodeBackup,
  openBackupManifest,
  verifyAndDecryptBackupChunk,
  verifyBackupIdentityChunk,
  type BackupChunkTarget,
  type BackupDecodeError,
  type BackupDecodeErrorCode,
  type BackupEncoderInput,
  type EncodeBackupInput,
  type EncodedBackup,
  type EncryptedBackupChunk,
  type OpenBackupManifestResult,
} from '../backup-format';
import {
  VECTOR_BACKUP_INPUT,
  VECTOR_DATABASE_CHUNKS,
  VECTOR_OBJECTS,
  VECTOR_RECOVERY_KEY,
  VECTOR_SEALED_RECOVERY_BUNDLE,
  vectorNonceSource,
} from '../test-vectors';

type OpenedBackup = Extract<OpenBackupManifestResult, { ok: true }>;
type FallibleResult = { ok: true } | { ok: false; error: BackupDecodeError };

function encoderInputFrom(input: EncodeBackupInput): BackupEncoderInput {
  return {
    recoveryKey: input.recoveryKey,
    backupId: input.backupId,
    createdAt: input.createdAt,
    schemaVersion: input.schemaVersion,
    migrationVersion: input.migrationVersion,
    appVersion: input.appVersion,
    dataClassVersions: input.dataClassVersions,
    sealedRecoveryBundle: input.sealedRecoveryBundle,
    signingIdentity: input.signingIdentity,
    nonceSource: input.nonceSource,
  };
}

function flip(envelope: Uint8Array): Uint8Array {
  const changed = envelope.slice();
  const index = Math.floor(changed.length / 2);
  changed[index] = (changed[index] ?? 0) ^ 0x01;
  return changed;
}

function appendByte(envelope: Uint8Array): Uint8Array {
  const changed = new Uint8Array(envelope.length + 1);
  changed.set(envelope);
  changed[changed.length - 1] = 0x01;
  return changed;
}

function expectFailure(result: FallibleResult, code: BackupDecodeErrorCode): void {
  expect(result.ok).toBe(false);
  if (result.ok) throw new Error('operation unexpectedly succeeded');
  expect(result.error.code).toBe(code);
}

function openVectorBackup(backup: EncodedBackup): OpenedBackup {
  const result = openBackupManifest(
    backup.locatorJson,
    backup.manifest.envelope,
    VECTOR_RECOVERY_KEY,
  );
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  return result;
}

describe('Backup Format v1 incremental encoder', () => {
  it('produces byte-identical batch envelopes for the canonical envelope sequence', () => {
    const batch = encodeBackup(VECTOR_BACKUP_INPUT);
    const incremental = createBackupEncoder(encoderInputFrom(VECTOR_BACKUP_INPUT));
    const databaseChunks = VECTOR_DATABASE_CHUNKS.map((plaintext) => (
      incremental.addDatabaseChunk(plaintext)
    ));
    const objectChunks: EncryptedBackupChunk[] = [];
    for (const object of [...VECTOR_OBJECTS].sort((left, right) => (
      left.objectId.localeCompare(right.objectId)
    ))) {
      for (const plaintext of object.chunks) {
        objectChunks.push(incremental.addObjectChunk(object.objectId, object.dataClass, plaintext));
      }
    }
    const finalized = incremental.finalize();

    expect(finalized.locatorJson).toBe(batch.locatorJson);
    expect(bytesToHex(finalized.manifest.envelope)).toBe(bytesToHex(batch.manifest.envelope));
    expect(databaseChunks.map((chunk) => bytesToHex(chunk.envelope)))
      .toEqual(batch.databaseChunks.map((chunk) => bytesToHex(chunk.envelope)));
    expect(objectChunks.map((chunk) => bytesToHex(chunk.envelope)))
      .toEqual(batch.objectChunks.map((chunk) => bytesToHex(chunk.envelope)));
    expect(finalized.manifestDescriptor).toEqual(
      batch.identityChunk === null
        ? null
        : {
          encryptedBytes: batch.identityChunk.encryptedBytes,
          ciphertextHash: batch.identityChunk.ciphertextHash,
        },
    );
  });

  it('increments indices per object when object ids interleave', () => {
    const nonceIndices: number[] = [];
    const incremental = createBackupEncoder({
      ...encoderInputFrom(VECTOR_BACKUP_INPUT),
      nonceSource: (index) => {
        nonceIndices.push(index);
        return vectorNonceSource(index);
      },
    });
    incremental.addDatabaseChunk(VECTOR_DATABASE_CHUNKS[0]);
    const alphaZero = incremental.addObjectChunk('alpha-object', 'attachment', new Uint8Array([1]));
    const betaZero = incremental.addObjectChunk('beta-object', 'library_object', new Uint8Array([2]));
    const alphaOne = incremental.addObjectChunk('alpha-object', 'attachment', new Uint8Array([3]));
    const finalized = incremental.finalize();

    expect([alphaZero.index, betaZero.index, alphaOne.index]).toEqual([0, 0, 1]);
    expect(nonceIndices).toEqual([0, 1, 2, 3, 4]);
    const opened = openBackupManifest(
      finalized.locatorJson,
      finalized.manifest.envelope,
      VECTOR_RECOVERY_KEY,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw opened.error;
    expect(opened.manifest.objects.map((object) => ({
      objectId: object.objectId,
      indices: object.chunks.map((chunk) => chunk.index),
    }))).toEqual([
      { objectId: 'alpha-object', indices: [0, 1] },
      { objectId: 'beta-object', indices: [0] },
    ]);
    opened.backupRootKey.fill(0);
  });

  it('exposes only methods while retaining compact descriptors instead of chunk bytes', () => {
    const chunkBytes = 256 * 1024;
    const incremental = createBackupEncoder(encoderInputFrom(VECTOR_BACKUP_INPUT));
    const uploadedMetadata: Array<{ path: string; encryptedBytes: number; ciphertextHash: string }> = [];
    const uploadAndDrop = (chunk: EncryptedBackupChunk): void => {
      uploadedMetadata.push({
        path: chunk.path,
        encryptedBytes: chunk.encryptedBytes,
        ciphertextHash: chunk.ciphertextHash,
      });
    };

    uploadAndDrop(incremental.addDatabaseChunk(new Uint8Array(chunkBytes).fill(0x11)));
    uploadAndDrop(incremental.addObjectChunk(
      'large-object',
      'attachment',
      new Uint8Array(chunkBytes).fill(0x22),
    ));
    uploadAndDrop(incremental.addObjectChunk(
      'large-object',
      'attachment',
      new Uint8Array(chunkBytes).fill(0x33),
    ));

    expect(Reflect.ownKeys(incremental).sort()).toEqual([
      'addDatabaseChunk',
      'addObjectChunk',
      'finalize',
    ]);
    expect(Object.values(incremental).every((value) => typeof value === 'function')).toBe(true);
    expect(JSON.stringify(incremental)).toBe('{}');
    expect(uploadedMetadata).toHaveLength(3);

    const finalized = incremental.finalize();
    const opened = openBackupManifest(
      finalized.locatorJson,
      finalized.manifest.envelope,
      VECTOR_RECOVERY_KEY,
    );
    expect(opened.ok).toBe(true);
    if (!opened.ok) throw opened.error;
    const retainedPlaintextByteCount = opened.manifest.databaseChunks
      .reduce((sum, descriptor) => sum + descriptor.plaintextBytes, 0)
      + opened.manifest.objects.reduce((objectSum, object) => (
        objectSum + object.chunks.reduce((sum, descriptor) => sum + descriptor.plaintextBytes, 0)
      ), 0);
    expect(retainedPlaintextByteCount).toBe(chunkBytes * 3);
    expect(canonicalBackupManifest(opened.manifest).byteLength).toBeLessThan(4_096);
    expect(finalized.manifest.encryptedBytes).toBeLessThan(4_096);
    opened.backupRootKey.fill(0);
  });

  it('rejects both add methods after finalization', () => {
    const incremental = createBackupEncoder(encoderInputFrom(VECTOR_BACKUP_INPUT));
    incremental.addDatabaseChunk(VECTOR_DATABASE_CHUNKS[0]);
    incremental.finalize();

    expect(() => incremental.addDatabaseChunk(VECTOR_DATABASE_CHUNKS[1]))
      .toThrow('already finalized');
    expect(() => incremental.addObjectChunk('late-object', 'attachment', new Uint8Array([1])))
      .toThrow('already finalized');
  });

  it('rejects a second finalization', () => {
    const incremental = createBackupEncoder(encoderInputFrom(VECTOR_BACKUP_INPUT));
    incremental.addDatabaseChunk(VECTOR_DATABASE_CHUNKS[0]);
    incremental.finalize();
    expect(() => incremental.finalize()).toThrow('already finalized');
  });

  it('rejects a data class change for a known object id', () => {
    const incremental = createBackupEncoder(encoderInputFrom(VECTOR_BACKUP_INPUT));
    incremental.addDatabaseChunk(VECTOR_DATABASE_CHUNKS[0]);
    incremental.addObjectChunk('stable-object', 'attachment', new Uint8Array([1]));
    expect(() => incremental.addObjectChunk('stable-object', 'library_object', new Uint8Array([2])))
      .toThrow('dataClass cannot change');
  });

  it('rejects finalization without a database chunk', () => {
    const incremental = createBackupEncoder(encoderInputFrom(VECTOR_BACKUP_INPUT));
    incremental.addObjectChunk('object-only', 'attachment', new Uint8Array([1]));
    expect(() => incremental.finalize()).toThrow('at least one database chunk');
  });

  it('rejects a nonce reused across chunk and manifest envelopes', () => {
    const incremental = createBackupEncoder({
      ...encoderInputFrom(VECTOR_BACKUP_INPUT),
      nonceSource: () => vectorNonceSource(0),
    });
    incremental.addDatabaseChunk(VECTOR_DATABASE_CHUNKS[0]);
    expect(() => incremental.finalize()).toThrow('reused a nonce');
  });
});

describe('Backup Format v1 streaming decode', () => {
  it('restores exact plaintext when chunks arrive in shuffled order', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const opened = openVectorBackup(backup);
    const downloads = [
      ...backup.databaseChunks.map((chunk): {
        target: BackupChunkTarget;
        envelope: Uint8Array;
      } => ({ target: { kind: 'database', index: chunk.index }, envelope: chunk.envelope })),
      ...backup.objectChunks.map((chunk): {
        target: BackupChunkTarget;
        envelope: Uint8Array;
      } => ({
        target: { kind: 'object', objectId: chunk.objectId, index: chunk.index },
        envelope: chunk.envelope,
      })),
    ];
    const shuffledIndices = [4, 1, 3, 0, 2] as const;
    const databaseChunks: Uint8Array[] = [];
    const objectChunks = new Map<string, Uint8Array[]>();

    for (const downloadIndex of shuffledIndices) {
      const download = downloads[downloadIndex];
      if (download === undefined) throw new Error('vector download is missing');
      const verified = verifyAndDecryptBackupChunk(
        opened.backupRootKey,
        opened.manifest,
        download.target,
        download.envelope,
      );
      expect(verified.ok).toBe(true);
      if (!verified.ok) throw verified.error;
      if (download.target.kind === 'database') {
        databaseChunks[download.target.index] = verified.plaintext;
      } else {
        const chunks = objectChunks.get(download.target.objectId) ?? [];
        chunks[download.target.index] = verified.plaintext;
        objectChunks.set(download.target.objectId, chunks);
      }
    }

    expect(databaseChunks).toEqual(VECTOR_DATABASE_CHUNKS);
    expect(VECTOR_OBJECTS.map((object) => ({
      objectId: object.objectId,
      dataClass: object.dataClass,
      chunks: objectChunks.get(object.objectId),
    }))).toEqual(VECTOR_OBJECTS);
    if (backup.identityChunk === null) throw new Error('vector identity chunk is missing');
    const identity = verifyBackupIdentityChunk(opened.manifest, backup.identityChunk.envelope);
    expect(identity.ok).toBe(true);
    if (!identity.ok) throw identity.error;
    expect(identity.sealedRecoveryBundle).toBe(VECTOR_SEALED_RECOVERY_BUNDLE);
    opened.backupRootKey.fill(0);
  });

  it('rejects a different valid recovery key while opening the manifest', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const wrongKey = encodeRecoveryKey(new Uint8Array(32).fill(0xff));
    expectFailure(openBackupManifest(
      backup.locatorJson,
      backup.manifest.envelope,
      wrongKey,
    ), 'wrong_key');
  });

  it('rejects a bit-flipped manifest envelope', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    expectFailure(openBackupManifest(
      backup.locatorJson,
      flip(backup.manifest.envelope),
      VECTOR_RECOVERY_KEY,
    ), 'tampered_chunk');
  });

  it('rejects a manifest signer that differs from the restore trust anchor', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    expectFailure(openBackupManifest(
      backup.locatorJson,
      backup.manifest.envelope,
      VECTOR_RECOVERY_KEY,
      { expectedDevicePublicKey: '00'.repeat(32) },
    ), 'bad_signature');
  });

  it('rejects a locator that identifies a different backup timestamp', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const locator = JSON.parse(backup.locatorJson) as Record<string, unknown>;
    expectFailure(openBackupManifest(
      JSON.stringify({ ...locator, createdAt: '2026-07-14T12:00:01.000Z' }),
      backup.manifest.envelope,
      VECTOR_RECOVERY_KEY,
    ), 'locator_mismatch');
  });

  it('rejects a bit-flipped content envelope', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const opened = openVectorBackup(backup);
    const chunk = backup.databaseChunks[0];
    if (chunk === undefined) throw new Error('vector database chunk is missing');
    expectFailure(verifyAndDecryptBackupChunk(
      opened.backupRootKey,
      opened.manifest,
      { kind: 'database', index: 0 },
      flip(chunk.envelope),
    ), 'tampered_chunk');
    opened.backupRootKey.fill(0);
  });

  it('classifies a shorter content envelope as truncated', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const opened = openVectorBackup(backup);
    const chunk = backup.objectChunks[0];
    if (chunk === undefined) throw new Error('vector object chunk is missing');
    expectFailure(verifyAndDecryptBackupChunk(
      opened.backupRootKey,
      opened.manifest,
      { kind: 'object', objectId: chunk.objectId, index: chunk.index },
      chunk.envelope.slice(0, -1),
    ), 'truncated');
    opened.backupRootKey.fill(0);
  });

  it('classifies a longer content envelope as tampered', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const opened = openVectorBackup(backup);
    const chunk = backup.objectChunks[0];
    if (chunk === undefined) throw new Error('vector object chunk is missing');
    expectFailure(verifyAndDecryptBackupChunk(
      opened.backupRootKey,
      opened.manifest,
      { kind: 'object', objectId: chunk.objectId, index: chunk.index },
      appendByte(chunk.envelope),
    ), 'tampered_chunk');
    opened.backupRootKey.fill(0);
  });

  it('rejects an unknown chunk index as missing', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const opened = openVectorBackup(backup);
    const chunk = backup.databaseChunks[0];
    if (chunk === undefined) throw new Error('vector database chunk is missing');
    expectFailure(verifyAndDecryptBackupChunk(
      opened.backupRootKey,
      opened.manifest,
      { kind: 'database', index: 999 },
      chunk.envelope,
    ), 'missing_chunk');
    opened.backupRootKey.fill(0);
  });

  it('rejects an unknown object id as missing', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const opened = openVectorBackup(backup);
    const chunk = backup.objectChunks[0];
    if (chunk === undefined) throw new Error('vector object chunk is missing');
    expectFailure(verifyAndDecryptBackupChunk(
      opened.backupRootKey,
      opened.manifest,
      { kind: 'object', objectId: 'unknown-object', index: 0 },
      chunk.envelope,
    ), 'missing_chunk');
    opened.backupRootKey.fill(0);
  });

  it('rejects a bit-flipped identity recovery chunk', () => {
    const backup = encodeBackup(VECTOR_BACKUP_INPUT);
    const opened = openVectorBackup(backup);
    if (backup.identityChunk === null) throw new Error('vector identity chunk is missing');
    expectFailure(verifyBackupIdentityChunk(
      opened.manifest,
      flip(backup.identityChunk.envelope),
    ), 'tampered_chunk');
    opened.backupRootKey.fill(0);
  });
});
