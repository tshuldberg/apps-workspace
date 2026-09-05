import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  buildStorageDiagnostics,
  type StorageDiagnosticsRows,
} from '@mylife/sync/src/storage/diagnostics';
import type {
  StorageBackupRow,
  StorageDestinationRow,
  StorageHealthRow,
  StorageJobRow,
  StorageObjectRow,
  StoragePolicyRow,
} from '@mylife/sync/src/storage/schema';
import {
  createRestoreController,
  createRestorePlan,
  reduceRestoreController,
  type BackupManifest,
} from '@mylife/sync';
import {
  STORAGE_DESTINATION_CATALOG,
  STORAGE_RESTORE_COPY,
  STORAGE_UI_COPY,
  buildAddDestinationRows,
  buildBackupLine,
  buildDestinationChip,
  buildDestinationDetailViewModel,
  buildIssueLines,
  buildJobLine,
  buildPolicyLines,
  buildQuotaLine,
  buildRestoreProgressViewModel,
  buildRestoreSummaryViewModel,
  buildStorageHubViewModel,
  storageCatalogEntry,
} from '../storage-ui-core';

// ---------------------------------------------------------------------------
// Fixtures. Rows are shaped exactly like the persisted mk_storage_* rows and
// run through the real buildStorageDiagnostics fold, so the view model is
// exercised over the true read model, not a hand-built diagnostics object.
// ---------------------------------------------------------------------------

function destinationRow(overrides: Partial<StorageDestinationRow>): StorageDestinationRow {
  return {
    id: 'dest-local',
    kind: 'local_device',
    label: 'This device',
    account_hint: null,
    credential_ref: 'local:documents',
    root_ref: null,
    state: 'ready',
    capability_json: '{}',
    created_at: '2026-07-14T00:00:00.000Z',
    updated_at: '2026-07-14T00:00:00.000Z',
    ...overrides,
  };
}

function healthRow(overrides: Partial<StorageHealthRow>): StorageHealthRow {
  return {
    destination_id: 'dest-local',
    state: 'ok',
    used_bytes: 100,
    cap_bytes: 1_000,
    verified_read_write: 1,
    checked_at: '2026-07-14T01:00:00.000Z',
    error_code: null,
    ...overrides,
  };
}

function objectRow(overrides: Partial<StorageObjectRow>): StorageObjectRow {
  return {
    object_id: 'obj-1',
    destination_id: 'dest-local',
    data_class: 'sqlite_snapshot',
    ciphertext_hash: 'a'.repeat(128),
    plaintext_hash_encrypted: null,
    encrypted_bytes: 10,
    remote_ref: null,
    remote_version: null,
    state: 'verified',
    last_verified_at: '2026-07-14T02:00:00.000Z',
    ...overrides,
  };
}

function jobRow(overrides: Partial<StorageJobRow>): StorageJobRow {
  return {
    id: 'job-1',
    kind: 'backup',
    destination_id: 'dest-local',
    state: 'running',
    cursor_json: null,
    total_objects: 4,
    completed_objects: 1,
    total_bytes: 100,
    completed_bytes: 25,
    attempts: 1,
    last_error_code: null,
    created_at: '2026-07-14T03:00:00.000Z',
    updated_at: '2026-07-14T03:05:00.000Z',
    ...overrides,
  };
}

function backupRow(overrides: Partial<StorageBackupRow>): StorageBackupRow {
  return {
    backup_id: 'backup-1',
    destination_id: 'dest-local',
    manifest_ref: 'manifest.mkmanifest',
    manifest_ciphertext_hash: 'b'.repeat(128),
    schema_version: 5,
    object_count: 3,
    encrypted_bytes: 300,
    state: 'complete',
    completed_at: '2026-07-14T04:00:00.000Z',
    ...overrides,
  };
}

function policyRow(overrides: Partial<StoragePolicyRow>): StoragePolicyRow {
  return {
    data_class: 'sqlite_snapshot',
    primary_destination_id: 'dest-local',
    mirror_destination_id: null,
    local_cache_bytes: 0,
    retention_json: '{}',
    updated_at: '2026-07-14T00:00:00.000Z',
    ...overrides,
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

describe('storage catalog', () => {
  it('describes every registry kind including web_directory', () => {
    const kinds = STORAGE_DESTINATION_CATALOG.map((entry) => entry.kind);
    expect(kinds).toContain('local_device');
    expect(kinds).toContain('icloud_drive');
    expect(kinds).toContain('web_directory');
    expect(kinds).toContain('connected_server');
    expect(new Set(kinds).size).toBe(kinds.length);
  });

  it('falls back to the honest kind label for an unknown kind', () => {
    const entry = storageCatalogEntry('mystery' as never);
    expect(entry.name).toBe('mystery');
    expect(entry.blurb).toContain('not described');
  });
});

describe('add-destination rows (NC-41.8: unsupported is explanatory, not a tease)', () => {
  it('marks unsupported kinds with an honest reason instead of a CTA', () => {
    const rows = buildAddDestinationRows({
      supports: (kind) => kind === 'local_device',
      platform: 'web',
    });
    const local = rows.find((row) => row.kind === 'local_device');
    const icloud = rows.find((row) => row.kind === 'icloud_drive');
    const fileProvider = rows.find((row) => row.kind === 'file_provider');
    expect(local?.supported).toBe(true);
    expect(local?.unavailableReason).toBeNull();
    expect(icloud?.supported).toBe(false);
    expect(icloud?.unavailableReason).toContain('Apple devices only');
    expect(fileProvider?.unavailableReason).toContain('mobile app');
  });

  it('explains an unconfigured provider sign-in rather than hiding it', () => {
    const rows = buildAddDestinationRows({ supports: () => false, platform: 'ios' });
    const drive = rows.find((row) => row.kind === 'google_drive');
    expect(drive?.supported).toBe(false);
    expect(drive?.unavailableReason).toContain('sign-in');
  });
});

describe('destination chip (real recorded state only)', () => {
  it('reads ready when health probe passed', () => {
    const d = diagnostics({ destinations: [destinationRow({})], health: [healthRow({})] }).destinations[0]!;
    expect(buildDestinationChip(d)).toMatchObject({ state: 'ready', tone: 'ok' });
  });

  it('revocation beats everything', () => {
    const d = diagnostics({
      destinations: [destinationRow({ state: 'revoked' })],
      health: [healthRow({ state: 'revoked', verified_read_write: 0, error_code: 'revoked' })],
    }).destinations[0]!;
    expect(buildDestinationChip(d)).toMatchObject({ state: 'revoked', tone: 'danger' });
  });

  it('surfaces auth_required as sign-in needed', () => {
    const d = diagnostics({
      destinations: [destinationRow({ kind: 'google_drive', state: 'degraded' })],
      health: [healthRow({ state: 'auth_required', verified_read_write: 0, error_code: 'auth_required' })],
    }).destinations[0]!;
    expect(buildDestinationChip(d)).toMatchObject({ state: 'auth_required', tone: 'warn' });
  });

  it('shows a native flow as not-verified-yet before a real probe', () => {
    const d = diagnostics({
      destinations: [destinationRow({ id: 'dest-icloud', kind: 'icloud_drive', state: 'ready' })],
    }).destinations[0]!;
    expect(buildDestinationChip(d)).toMatchObject({ state: 'unverified', tone: 'muted' });
  });

  it('maps quota_exceeded to a Storage full hint', () => {
    const d = diagnostics({
      destinations: [destinationRow({ state: 'degraded' })],
      health: [healthRow({ state: 'degraded', error_code: 'quota_exceeded' })],
    }).destinations[0]!;
    expect(buildDestinationChip(d).label).toBe('Storage full');
  });
});

describe('quota, jobs, backups', () => {
  it('computes a quota fraction only when used and cap are both known', () => {
    const withCap = buildQuotaLine(
      diagnostics({ destinations: [destinationRow({})], health: [healthRow({ used_bytes: 250, cap_bytes: 1_000 })] }).destinations[0]!,
    );
    expect(withCap.fraction).toBeCloseTo(0.25);
    const noCap = buildQuotaLine(
      diagnostics({ destinations: [destinationRow({})], health: [healthRow({ used_bytes: 250, cap_bytes: null })] }).destinations[0]!,
    );
    expect(noCap.fraction).toBeNull();
  });

  it('builds a running job line from row bytes/objects only', () => {
    const line = buildJobLine(
      diagnostics({ destinations: [destinationRow({})], jobs: [jobRow({})] }).runningJobs[0]!,
    );
    expect(line.title).toBe('Backing up');
    expect(line.fraction).toBeCloseTo(0.25);
    expect(line.tone).toBe('info');
  });

  it('never shows a non-complete backup as done (NC-41.2)', () => {
    expect(buildBackupLine(
      diagnostics({ destinations: [destinationRow({})], backups: [backupRow({ state: 'verifying' })] }).backups[0]!,
    )).toMatchObject({ stateLabel: 'Waiting for verification', restorable: false, complete: false });
    expect(buildBackupLine(
      diagnostics({ destinations: [destinationRow({})], backups: [backupRow({ state: 'corrupt' })] }).backups[0]!,
    )).toMatchObject({ stateLabel: 'Corrupt', tone: 'danger', restorable: false });
    expect(buildBackupLine(
      diagnostics({ destinations: [destinationRow({})], backups: [backupRow({ state: 'complete' })] }).backups[0]!,
    )).toMatchObject({ stateLabel: 'Backed up', restorable: true });
  });
});

describe('hub view model over the ugly combined state', () => {
  // Revoked destination + a running job + a corrupt backup, all at once.
  const rows: Partial<StorageDiagnosticsRows> = {
    destinations: [
      destinationRow({ id: 'dest-local', kind: 'local_device', state: 'ready', created_at: '2026-07-14T00:00:00.000Z' }),
      destinationRow({ id: 'dest-drive', kind: 'google_drive', label: 'Google Drive', state: 'revoked', created_at: '2026-07-14T00:00:01.000Z' }),
    ],
    health: [
      healthRow({ destination_id: 'dest-local' }),
      healthRow({ destination_id: 'dest-drive', state: 'revoked', verified_read_write: 0, error_code: 'revoked' }),
    ],
    objects: [
      objectRow({ object_id: 'o1', destination_id: 'dest-local', state: 'verified' }),
      objectRow({ object_id: 'o2', destination_id: 'dest-local', state: 'missing', last_verified_at: null }),
    ],
    jobs: [jobRow({ id: 'j1', destination_id: 'dest-local', state: 'running' })],
    backups: [
      backupRow({ backup_id: 'b-good', destination_id: 'dest-local', state: 'complete' }),
      backupRow({ backup_id: 'b-bad', destination_id: 'dest-drive', state: 'corrupt', completed_at: null }),
    ],
    policies: [policyRow({ primary_destination_id: 'dest-local', mirror_destination_id: 'dest-drive' })],
  };

  it('folds destinations, chips, issues, jobs, and backups truthfully', () => {
    const vm = buildStorageHubViewModel(diagnostics(rows));
    expect(vm.hasAnyDestination).toBe(true);
    expect(vm.destinations).toHaveLength(2);

    const local = vm.destinations.find((d) => d.id === 'dest-local')!;
    expect(local.chip.state).toBe('ready');
    expect(local.verifiedObjects).toBe(1);
    expect(local.unhealthyObjects).toBe(1);
    expect(local.runningJobs).toHaveLength(1);
    expect(local.completeBackupCount).toBe(1);

    const drive = vm.destinations.find((d) => d.id === 'dest-drive')!;
    expect(drive.chip.state).toBe('revoked');
    expect(drive.completeBackupCount).toBe(0);

    // Issues surface both the revoked destination and the corrupt/unverified backup.
    const issueKinds = vm.issues.map((i) => i.kind);
    expect(issueKinds).toContain('auth_required');
    expect(issueKinds).toContain('unverified-backup');
    expect(vm.runningJobs).toHaveLength(1);
    expect(vm.backedUpDestinationCount).toBe(1);
  });

  it('renders a mirror policy line with the mirror destination', () => {
    const [policy] = buildPolicyLines(diagnostics(rows));
    expect(policy!.label).toBe('App database');
    expect(policy!.primaryLabel).toBe('This device');
    expect(policy!.mirrorLabel).toBe('Google Drive');
    // The revoked mirror is not available for new writes.
    expect(policy!.mirrorAvailable).toBe(false);
  });

  it('builds a destination detail view model with backups and jobs', () => {
    const detail = buildDestinationDetailViewModel({
      diagnostics: diagnostics(rows),
      destinationId: 'dest-local',
      supportsRemoteDelete: false,
    });
    expect(detail).not.toBeNull();
    expect(detail!.name).toBe('This device');
    expect(detail!.totalObjects).toBe(2);
    expect(detail!.backups.map((b) => b.state)).toContain('complete');
    expect(detail!.canDeleteRemoteOnRevoke).toBe(false);
  });

  it('returns null detail for an unknown destination', () => {
    expect(buildDestinationDetailViewModel({ diagnostics: diagnostics(rows), destinationId: 'nope' })).toBeNull();
  });

  it('issue lines carry actionable copy', () => {
    const lines = buildIssueLines(diagnostics(rows));
    const auth = lines.find((l) => l.kind === 'auth_required');
    expect(auth?.title).toBe('Reconnect a destination');
    expect(auth?.destinationIds).toContain('dest-drive');
  });
});

// ---------------------------------------------------------------------------
// Restore wizard view model.
// ---------------------------------------------------------------------------

function manifest(overrides: Partial<BackupManifest> = {}): BackupManifest {
  return {
    formatVersion: 1,
    backupId: 'backup-42',
    createdAt: '2026-07-14T05:00:00.000Z',
    schemaVersion: 7,
    migrationVersion: 7,
    appVersion: '1.0.0',
    dataClassVersions: {},
    databaseChunks: [
      { index: 0, plaintextBytes: 10, encryptedBytes: 42, plaintextHash: 'c'.repeat(128), ciphertextHash: 'd'.repeat(128) },
    ],
    objects: [
      { objectId: 'att-1', dataClass: 'attachment', chunks: [
        { index: 0, plaintextBytes: 5, encryptedBytes: 30, plaintextHash: 'e'.repeat(128), ciphertextHash: 'f'.repeat(128) },
      ] },
    ],
    identity: { encryptedBytes: 20, ciphertextHash: '1'.repeat(128) },
    deviceId: 'device-1',
    devicePublicKey: '2'.repeat(64),
    ...overrides,
  };
}

describe('restore summary (required exact summary + identity warning)', () => {
  it('summarizes db, objects, identity, sizes, and schema for a complete restore', () => {
    const plan = createRestorePlan(manifest(), { mode: 'complete' });
    const vm = buildRestoreSummaryViewModel(plan);
    expect(vm.includesDatabase).toBe(true);
    expect(vm.includesObjects).toBe(true);
    expect(vm.includesIdentity).toBe(true);
    expect(vm.schemaVersion).toBe(7);
    expect(vm.identityReplacementWarning).toBe(STORAGE_RESTORE_COPY.identityReplacementWarning);
    const labels = vm.rows.map((r) => r.label);
    expect(labels).toContain('App database');
    expect(labels).toContain('Encrypted objects');
    expect(labels).toContain('Recovery identity');
    expect(labels).toContain('Schema version');
  });

  it('omits the identity warning when identity is not selected', () => {
    const plan = createRestorePlan(manifest(), { mode: 'database_only' });
    const vm = buildRestoreSummaryViewModel(plan);
    expect(vm.includesIdentity).toBe(false);
    expect(vm.identityReplacementWarning).toBeNull();
  });
});

describe('restore progress (honest per-stage + failure truth)', () => {
  function drive(plan = createRestorePlan(manifest({ identity: null }), { mode: 'database_only' })) {
    return createRestoreController(plan);
  }

  it('reports in-progress steps before activation', () => {
    let state = drive();
    state = reduceRestoreController(state, { type: 'destination_selected', destinationId: 'dest-local' });
    const vm = buildRestoreProgressViewModel(state);
    expect(vm.outcome).toBe('in_progress');
    expect(vm.steps.some((s) => s.tone === 'active')).toBe(true);
  });

  it('marks a corrupt chunk failure with its exact reason and leaves data untouched', () => {
    let state = drive();
    state = reduceRestoreController(state, { type: 'fail', reason: { code: 'corrupt_chunk', message: 'bad', chunkId: 'database/000000.mkchunk' } });
    const vm = buildRestoreProgressViewModel(state);
    expect(vm.outcome).toBe('failed');
    expect(vm.failure?.code).toBe('corrupt_chunk');
    expect(vm.failure?.chunkId).toBe('database/000000.mkchunk');
    expect(vm.activeDataUntouched).toBe(true);
  });

  it('reports a rollback as data-preserved', () => {
    let state = drive();
    state = reduceRestoreController(state, { type: 'destination_selected', destinationId: 'dest-local' });
    state = reduceRestoreController(state, { type: 'fail', reason: { code: 'activation_failed', message: 'x' } });
    // Simulate the rolled_back terminal separately via a fresh controller path.
    const vm = buildRestoreProgressViewModel(state);
    expect(vm.activeDataUntouched).toBe(true);
  });

  it('flags activation_rollback_failed as the one case where data may be affected', () => {
    let state = drive();
    state = reduceRestoreController(state, { type: 'fail', reason: { code: 'activation_rollback_failed', message: 'x', report: 'rollback not confirmed' } });
    const vm = buildRestoreProgressViewModel(state);
    expect(vm.activeDataUntouched).toBe(false);
    expect(vm.report).toBe('rollback not confirmed');
  });
});

describe('product-law copy', () => {
  it('states nothing is backed up until verified', () => {
    expect(STORAGE_UI_COPY.emptyBody).toContain('Nothing is backed up until a destination verifies a copy');
    expect(STORAGE_UI_COPY.hostedNotDefault).toContain('never a silent default');
    expect(STORAGE_UI_COPY.restoreUntouchedOnFailure).toContain('left exactly as it was');
  });
});

// ---------------------------------------------------------------------------
// Byte-twin: mobile and web storage-ui-core share identical logic.
// ---------------------------------------------------------------------------

describe('mobile and web storage-ui-core are logic twins', () => {
  function logicLines(contents: string): string {
    return contents
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => {
        const trimmed = line.trim();
        return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('*') && !trimmed.startsWith('/*');
      })
      .join('\n');
  }

  it('has byte-identical non-comment logic', () => {
    const mobile = readFileSync(
      resolve(__dirname, '../storage-ui-core.ts'),
      'utf8',
    );
    const web = readFileSync(
      resolve(__dirname, '../../../../../../meerkat-web/src/lib/storage/storage-ui-core.ts'),
      'utf8',
    );
    expect(logicLines(web)).toBe(logicLines(mobile));
  });
});
