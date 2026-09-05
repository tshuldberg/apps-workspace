import { describe, expect, it } from 'vitest';
import {
  buildRetentionBackupCopies,
  parseRetentionPolicy,
  planRetentionJob,
  type RetentionBackupCopy,
} from '../retention';
import type { StorageBackupRow, StorageObjectRow } from '../schema';
import { remoteBackupObjectId } from '../remote-backups';

const NOW = '2026-07-14T12:00:00.000Z';

function copy(
  backupId: string,
  destinationId: string,
  completedAt: string,
  overrides: Partial<RetentionBackupCopy> = {},
): RetentionBackupCopy {
  return {
    backupId,
    destinationId,
    dataClass: 'sqlite_snapshot',
    role: 'primary',
    state: 'complete',
    completedAt,
    ...overrides,
  };
}

describe('storage retention', () => {
  it('bounds keep-last and max-age while failing closed on malformed policy', () => {
    expect(parseRetentionPolicy('{"keepLast":0,"maxAgeDays":99999}')).toEqual({
      keepLast: 1,
      maxAgeDays: 3_650,
    });
    expect(parseRetentionPolicy('{')).toBeNull();
    expect(parseRetentionPolicy('{"keepLast":"3","maxAgeDays":30}')).toBeNull();
  });

  it('never deletes the last verified complete backup in an all-corrupt-except-one matrix', () => {
    const backups: RetentionBackupCopy[] = [
      copy('only-good', 'primary', '2025-01-01T00:00:00.000Z'),
      copy('new-corrupt', 'primary', '2026-07-13T00:00:00.000Z', { state: 'corrupt' }),
      copy('new-writing', 'primary', '2026-07-14T00:00:00.000Z', { state: 'writing' }),
      copy('old-corrupt', 'mirror', '2024-01-01T00:00:00.000Z', {
        role: 'mirror',
        state: 'corrupt',
      }),
    ];

    const plan = planRetentionJob({
      dataClass: 'sqlite_snapshot',
      retentionJson: '{"keepLast":1,"maxAgeDays":1}',
      backups,
      now: NOW,
    });

    expect(plan.deleteCopies).toEqual([]);
    expect(plan.protectedCopies).toContainEqual(expect.objectContaining({
      backupId: 'only-good',
      reason: 'last_verified_complete',
    }));
  });

  it('deletes only logical backups beyond both policy windows', () => {
    const plan = planRetentionJob({
      dataClass: 'sqlite_snapshot',
      retentionJson: '{"keepLast":2,"maxAgeDays":30}',
      now: NOW,
      backups: [
        copy('newest', 'primary', '2026-07-13T00:00:00.000Z'),
        copy('second', 'primary', '2026-07-01T00:00:00.000Z'),
        copy('old', 'primary', '2026-01-01T00:00:00.000Z'),
      ],
    });

    expect(plan.deleteCopies.map((item) => item.backupId)).toEqual(['old']);
    expect(plan.policy).toEqual({ keepLast: 2, maxAgeDays: 30 });
  });

  it('does not delete a mirror when its primary copy failed', () => {
    const plan = planRetentionJob({
      dataClass: 'sqlite_snapshot',
      retentionJson: '{"keepLast":1,"maxAgeDays":1}',
      now: NOW,
      backups: [
        copy('newest', 'primary', '2026-07-13T00:00:00.000Z'),
        copy('old', 'primary', '2026-01-01T00:00:00.000Z', { state: 'corrupt' }),
        copy('old', 'mirror', '2026-01-01T00:00:00.000Z', { role: 'mirror' }),
      ],
    });

    expect(plan.deleteCopies).toEqual([]);
    expect(plan.protectedCopies).toContainEqual(expect.objectContaining({
      backupId: 'old',
      destinationId: 'mirror',
      reason: 'primary_not_verified',
    }));
  });

  it('classifies tracked backups by their real object data class', () => {
    const backups: StorageBackupRow[] = ['sqlite', 'library'].map((backupId) => ({
      backup_id: backupId,
      destination_id: 'primary',
      manifest_ref: `manifest-${backupId}`,
      manifest_ciphertext_hash: 'a'.repeat(128),
      schema_version: 1,
      object_count: 1,
      encrypted_bytes: 10,
      state: 'complete',
      completed_at: NOW,
    }));
    const objects: StorageObjectRow[] = [
      trackedObject('sqlite', 'sqlite_snapshot'),
      trackedObject('library', 'library_object'),
    ];

    const copies = buildRetentionBackupCopies({
      dataClass: 'sqlite_snapshot',
      mirrorDestinationId: null,
      backups,
      objects,
    });

    expect(copies.map((candidate) => candidate.backupId)).toEqual(['sqlite']);
  });
});

function trackedObject(backupId: string, dataClass: string): StorageObjectRow {
  return {
    object_id: remoteBackupObjectId(backupId, `${dataClass}/chunk`),
    destination_id: 'primary',
    data_class: dataClass,
    ciphertext_hash: 'b'.repeat(128),
    plaintext_hash_encrypted: null,
    encrypted_bytes: 10,
    remote_ref: `memory://${backupId}`,
    remote_version: 'v1',
    state: 'verified',
    last_verified_at: NOW,
  };
}
