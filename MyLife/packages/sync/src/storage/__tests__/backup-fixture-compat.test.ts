import { expect, it } from 'vitest';
import naclUtil from 'tweetnacl-util';
import { hexToBytes } from '../../encryption/keys';
import {
  isRecoverableIdentityConsistent,
  openRecovery,
  parseRecoveryKey,
} from '../../node/recovery-key';
import { decodeBackup, type EncodedBackup } from '../backup-format';
import { BACKUP_V1_FIXTURE } from './fixtures/backup-v1-fixture';

const utf8 = (value: string): Uint8Array => new TextEncoder().encode(value);
const { encodeUTF8 } = naclUtil;

function loadFixture(): EncodedBackup {
  return {
    locatorJson: encodeUTF8(hexToBytes(BACKUP_V1_FIXTURE.locatorHex)),
    manifest: {
      path: BACKUP_V1_FIXTURE.manifest.path,
      envelope: hexToBytes(BACKUP_V1_FIXTURE.manifest.envelopeHex),
      encryptedBytes: BACKUP_V1_FIXTURE.manifest.encryptedBytes,
      ciphertextHash: BACKUP_V1_FIXTURE.manifest.ciphertextHash,
    },
    databaseChunks: BACKUP_V1_FIXTURE.databaseChunks.map((chunk) => ({
      path: chunk.path,
      purpose: chunk.purpose,
      objectId: chunk.objectId,
      index: chunk.index,
      envelope: hexToBytes(chunk.envelopeHex),
      encryptedBytes: chunk.encryptedBytes,
      ciphertextHash: chunk.ciphertextHash,
    })),
    objectChunks: BACKUP_V1_FIXTURE.objectChunks.map((chunk) => ({
      path: chunk.path,
      purpose: chunk.purpose,
      objectId: chunk.objectId,
      index: chunk.index,
      envelope: hexToBytes(chunk.envelopeHex),
      encryptedBytes: chunk.encryptedBytes,
      ciphertextHash: chunk.ciphertextHash,
    })),
    identityChunk: {
      path: BACKUP_V1_FIXTURE.identityChunk.path,
      envelope: hexToBytes(BACKUP_V1_FIXTURE.identityChunk.envelopeHex),
      encryptedBytes: BACKUP_V1_FIXTURE.identityChunk.encryptedBytes,
      ciphertextHash: BACKUP_V1_FIXTURE.identityChunk.ciphertextHash,
    },
  };
}

it('decodes the immutable Backup Format v1 fixture and restores all bounded content', () => {
  expect(encodeUTF8(hexToBytes(BACKUP_V1_FIXTURE.locatorHex))).toBe(BACKUP_V1_FIXTURE.locatorJson);
  const result = decodeBackup(loadFixture(), BACKUP_V1_FIXTURE.recoveryKey);
  expect(result.ok).toBe(true);
  if (!result.ok) throw result.error;
  expect(result.databaseChunks).toEqual([
    utf8('vector sqlite snapshot chunk zero'),
    utf8('vector sqlite snapshot chunk one'),
  ]);
  expect(result.objects).toEqual([
    {
      objectId: 'cipher-object-0001',
      dataClass: 'attachment',
      chunks: [utf8('vector attachment chunk zero'), utf8('vector attachment chunk one')],
    },
    {
      objectId: 'cipher-object-0002',
      dataClass: 'library_object',
      chunks: [utf8('vector library object chunk zero')],
    },
  ]);
  expect(result.manifest).toMatchObject({
    formatVersion: 1,
    backupId: 'vector-backup-0001',
    schemaVersion: 41,
    migrationVersion: 12,
    appVersion: '1.0.0-vector',
    deviceId: 'vector-device-0001',
  });

  const recoveryBytes = parseRecoveryKey(BACKUP_V1_FIXTURE.recoveryKey);
  expect(recoveryBytes).not.toBeNull();
  expect(result.sealedRecoveryBundle).not.toBeNull();
  if (recoveryBytes === null || result.sealedRecoveryBundle === null) {
    throw new Error('fixture recovery component is missing');
  }
  const identity = openRecovery(result.sealedRecoveryBundle, recoveryBytes);
  expect(identity).not.toBeNull();
  if (identity === null) throw new Error('fixture recovery component did not open');
  expect(isRecoverableIdentityConsistent(identity)).toBe(true);
  expect(identity.publicKey).toBe(result.manifest.devicePublicKey);
});
