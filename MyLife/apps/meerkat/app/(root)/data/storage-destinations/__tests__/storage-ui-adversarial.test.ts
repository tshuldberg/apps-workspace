import { describe, expect, it } from 'vitest';
import {
  buildStorageDiagnostics,
  type StorageDiagnosticsRows,
} from '@mylife/sync/src/storage/diagnostics';
import type {
  StorageBackupRow,
  StorageBackupState,
  StorageDestinationRow,
  StorageHealthRow,
  StorageJobRow,
} from '@mylife/sync/src/storage/schema';
import {
  buildBackupLine,
  buildDestinationChip,
  buildJobLine,
  buildStorageHubViewModel,
} from '../storage-ui-core';

const NOW = '2026-07-14T12:00:00.000Z';

function destinationRow(overrides: Partial<StorageDestinationRow> = {}): StorageDestinationRow {
  return {
    id: 'adversarial-destination',
    kind: 'google_drive',
    label: 'Adversarial destination',
    account_hint: null,
    credential_ref: 'broker://oauth/adversarial',
    root_ref: null,
    state: 'ready',
    capability_json: '{}',
    created_at: NOW,
    updated_at: NOW,
    ...overrides,
  };
}

function healthRow(overrides: Partial<StorageHealthRow> = {}): StorageHealthRow {
  return {
    destination_id: 'adversarial-destination',
    state: 'ok',
    used_bytes: 10,
    cap_bytes: 100,
    verified_read_write: 1,
    checked_at: NOW,
    error_code: null,
    ...overrides,
  };
}

function backupRow(state: StorageBackupState): StorageBackupRow {
  return {
    backup_id: `adversarial-${state}`,
    destination_id: 'adversarial-destination',
    manifest_ref: 'manifest.mkmanifest',
    manifest_ciphertext_hash: 'a'.repeat(128),
    schema_version: 41,
    object_count: 3,
    encrypted_bytes: 300,
    state,
    completed_at: state === 'complete' ? NOW : null,
  };
}

function jobRow(state: StorageJobRow['state'], errorCode: string | null): StorageJobRow {
  return {
    id: `adversarial-${state}-${errorCode ?? 'none'}`,
    kind: 'backup',
    destination_id: 'adversarial-destination',
    state,
    cursor_json: null,
    total_objects: 4,
    completed_objects: state === 'succeeded' ? 4 : 1,
    total_bytes: 400,
    completed_bytes: state === 'succeeded' ? 400 : 100,
    attempts: 1,
    last_error_code: errorCode,
    created_at: NOW,
    updated_at: NOW,
  };
}

function diagnostics(rows: Partial<StorageDiagnosticsRows>) {
  return buildStorageDiagnostics({
    destinations: rows.destinations ?? [],
    policies: rows.policies ?? [],
    objects: rows.objects ?? [],
    jobs: rows.jobs ?? [],
    health: rows.health ?? [],
    backups: rows.backups ?? [],
  });
}

describe('mobile storage UI adversarial diagnostics', () => {
  it.each([
    ['authorization pending', destinationRow({ state: 'authorizing' }), null, 'Connecting'],
    ['authorization required', destinationRow({ state: 'degraded' }), healthRow({ state: 'auth_required', verified_read_write: 0, error_code: 'auth_required' }), 'Sign-in needed'],
    ['revoked authorization', destinationRow({ state: 'revoked' }), healthRow({ state: 'revoked', verified_read_write: 0, error_code: 'revoked' }), 'Reconnect needed'],
    ['provider outage', destinationRow({ state: 'error' }), healthRow({ state: 'unreachable', verified_read_write: 0, error_code: 'unreachable' }), 'Not reachable'],
    ['unsafe redirect', destinationRow({ state: 'error' }), healthRow({ state: 'degraded', verified_read_write: 0, error_code: 'unsafe_redirect' }), 'Not reachable'],
    ['quota exhausted', destinationRow({ state: 'degraded' }), healthRow({ state: 'degraded', used_bytes: 100, cap_bytes: 100, verified_read_write: 0, error_code: 'quota_exceeded' }), 'Storage full'],
    ['unverified native destination', destinationRow({ kind: 'icloud_drive', state: 'ready' }), null, 'Not verified yet'],
  ] as const)('renders %s with honest copy', (_name, destination, health, expectedLabel) => {
    // Arrange
    const readModel = diagnostics({
      destinations: [destination],
      health: health === null ? [] : [health],
    });
    const recorded = readModel.destinations[0];
    if (recorded === undefined) throw new Error('destination diagnostic is missing');

    // Act
    const chip = buildDestinationChip(recorded);

    // Assert
    expect(chip.label).toBe(expectedLabel);
    expect(chip.label).not.toBe('Backed up');
  });

  it.each([
    ['writing', 'Writing', false],
    ['verifying', 'Waiting for verification', false],
    ['corrupt', 'Corrupt', false],
    ['deleted', 'Deleted', false],
    ['complete', 'Backed up', true],
  ] as const)('renders %s backup state as %s', (state, expectedLabel, restorable) => {
    // Arrange
    const readModel = diagnostics({
      destinations: [destinationRow()],
      backups: [backupRow(state)],
    });
    const backup = readModel.backups[0];
    if (backup === undefined) throw new Error('backup diagnostic is missing');

    // Act
    const line = buildBackupLine(backup);

    // Assert
    expect(line.stateLabel).toBe(expectedLabel);
    expect(line.complete).toBe(restorable);
    expect(line.restorable).toBe(restorable);
  });

  it.each([
    ['queued', null, 'Queued'],
    ['paused', 'auth_required', 'Paused'],
    ['paused', 'quota_exceeded', 'Paused'],
    ['partial', 'provider_error', 'Partly done'],
    ['failed', 'corrupt_ciphertext', 'Failed'],
  ] as const)('renders %s job with %s as an honest non-success state', (state, errorCode, expectedLabel) => {
    // Arrange
    const readModel = diagnostics({
      destinations: [destinationRow()],
      jobs: [jobRow(state, errorCode)],
    });
    const job = readModel.activeJobs[0] ?? readModel.runningJobs[0]
      ?? readModel.destinations[0]?.activeJobs[0];
    const recorded = job ?? {
      id: `terminal-${state}`,
      kind: 'backup' as const,
      destinationId: 'adversarial-destination',
      state,
      completedObjects: 1,
      totalObjects: 4,
      completedBytes: 100,
      totalBytes: 400,
      attempts: 1,
      errorCode,
      updatedAt: NOW,
    };

    // Act
    const line = buildJobLine(recorded);

    // Assert
    expect(line.stateLabel).toBe(expectedLabel);
    expect(line.errorCode).toBe(errorCode);
    expect(line.stateLabel).not.toBe('Backed up');
  });

  it('never derives a backed-up claim from successful jobs, verified objects, or non-complete backup rows', () => {
    // Arrange
    const nonCompleteStates: StorageBackupState[] = ['writing', 'verifying', 'corrupt', 'deleted'];
    const readModel = diagnostics({
      destinations: [destinationRow()],
      health: [healthRow()],
      jobs: [jobRow('succeeded', null)],
      backups: nonCompleteStates.map(backupRow),
    });

    // Act
    const backupLines = readModel.backups.map(buildBackupLine);
    const hub = buildStorageHubViewModel(readModel);

    // Assert
    expect(backupLines.some((line) => line.stateLabel === 'Backed up')).toBe(false);
    expect(backupLines.every((line) => !line.complete && !line.restorable)).toBe(true);
    expect(hub.backedUpDestinationCount).toBe(0);
  });
});
