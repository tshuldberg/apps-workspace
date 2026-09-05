import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { BackupEncoderInput, EncryptedBackupChunk } from '@mylife/sync';
import { VECTOR_BACKUP_INPUT } from '@mylife/sync/src/storage/test-vectors';
import {
  WEB_EXPLICIT_BACKUP_COPY,
  createExplicitBackupDownload,
  createWebLocalSnapshot,
  readExplicitBackupUpload,
  webBackupFallbackStatus,
} from '../local-snapshot';

function encoderInput(backupId: string): BackupEncoderInput {
  return {
    recoveryKey: VECTOR_BACKUP_INPUT.recoveryKey,
    backupId,
    createdAt: VECTOR_BACKUP_INPUT.createdAt,
    schemaVersion: VECTOR_BACKUP_INPUT.schemaVersion,
    migrationVersion: VECTOR_BACKUP_INPUT.migrationVersion,
    appVersion: VECTOR_BACKUP_INPUT.appVersion,
    dataClassVersions: VECTOR_BACKUP_INPUT.dataClassVersions,
    sealedRecoveryBundle: VECTOR_BACKUP_INPUT.sealedRecoveryBundle,
    signingIdentity: VECTOR_BACKUP_INPUT.signingIdentity,
    nonceSource: VECTOR_BACKUP_INPUT.nonceSource,
  };
}

describe('web SQLite snapshot streaming', () => {
  it('chunks the export seam into the configured encoder bound', async () => {
    const exported = new Uint8Array(1_025);
    exported.fill(0x41);
    const chunks: EncryptedBackupChunk[] = [];
    const result = await createWebLocalSnapshot({
      database: {
        flush: async () => {},
        export: async () => exported,
      },
      encoderInput: encoderInput('web-bounded-snapshot'),
      integrityChecker: { check: async () => ({ passed: true, report: 'ok' }) },
      chunkBytes: 256,
      writeEncryptedChunk: async (chunk) => { chunks.push(chunk); },
    });

    expect(result.databaseChunkCount).toBe(5);
    expect(result.maximumPlaintextChunkBytes).toBe(256);
    expect(chunks).toHaveLength(5);
    expect(exported.every((value) => value === 0)).toBe(true);
  });

  it('fails closed without writing a chunk when integrity_check fails', async () => {
    let writes = 0;
    await expect(createWebLocalSnapshot({
      database: {
        flush: async () => {},
        export: async () => new Uint8Array([1, 2, 3]),
      },
      encoderInput: encoderInput('web-integrity-failure'),
      integrityChecker: { check: async () => ({ passed: false, report: 'page 4 malformed' }) },
      writeEncryptedChunk: async () => { writes += 1; },
    })).rejects.toMatchObject({
      name: 'WebLocalSnapshotError',
      code: 'integrity_failed',
      report: 'page 4 malformed',
    });
    expect(writes).toBe(0);
  });

  it('rejects a path-escaping backup id before exporting the database', async () => {
    let exported = false;
    await expect(createWebLocalSnapshot({
      database: {
        flush: async () => {},
        export: async () => { exported = true; return new Uint8Array([1]); },
      },
      encoderInput: encoderInput('../escape'),
      integrityChecker: { check: async () => ({ passed: true, report: 'ok' }) },
      writeEncryptedChunk: async () => {},
    })).rejects.toMatchObject({ name: 'WebLocalSnapshotError', code: 'encode_failed' });
    expect(exported).toBe(false);
  });
});

describe('explicit browser backup transfer fallback', () => {
  it('round-trips multiple encrypted artifacts without claiming persistence', async () => {
    const artifacts = [
      { path: 'manifest.v1.enc', bytes: new Uint8Array([1, 2, 3]) },
      { path: 'db/00000000.chunk', bytes: new Uint8Array([5, 8, 13, 21]) },
    ];
    const download = createExplicitBackupDownload(artifacts);
    const uploaded = await readExplicitBackupUpload(download);
    expect(uploaded).toEqual(artifacts);
    expect(webBackupFallbackStatus(false)).toEqual({
      mode: 'explicit_download_upload',
      persistent: false,
      message: WEB_EXPLICIT_BACKUP_COPY,
    });
    expect(webBackupFallbackStatus(true)).toEqual({
      mode: 'persistent_destination',
      persistent: true,
      message: null,
    });
  });

  it('rejects trailing bytes and unsafe artifact paths', async () => {
    expect(() => createExplicitBackupDownload([
      { path: '../manifest', bytes: new Uint8Array([1]) },
    ])).toThrowError(/unique and safe/u);
    const valid = new Uint8Array(await createExplicitBackupDownload([
      { path: 'manifest.enc', bytes: new Uint8Array([1]) },
    ]).arrayBuffer());
    const trailing = new Uint8Array(valid.length + 1);
    trailing.set(valid);
    await expect(readExplicitBackupUpload({ arrayBuffer: async () => trailing.buffer }))
      .rejects.toMatchObject({ code: 'fallback_invalid' });
  });
});

describe('mobile and web pure storage core parity', () => {
  for (const [webFile, mobileFile] of [
    ['snapshot-encoder-core.ts', 'snapshot-encoder-core.ts'],
    ['local-destination-core.ts', 'storage-destinations/local-destination-core.ts'],
    ['restore-orchestrator-core.ts', 'storage-destinations/restore-orchestrator-core.ts'],
  ] as const) {
    it(`${webFile} is byte-identical`, () => {
      const web = readFileSync(resolve(process.cwd(), 'src/lib/storage', webFile), 'utf8');
      const mobile = readFileSync(resolve(process.cwd(), '../meerkat/app/(root)/data', mobileFile), 'utf8');
      expect(web).toBe(mobile);
    });
  }
});
