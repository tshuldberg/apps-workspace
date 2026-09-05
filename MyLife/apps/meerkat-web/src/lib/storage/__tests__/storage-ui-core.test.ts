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
} from '@mylife/sync/src/storage/schema';
import {
  buildAddDestinationRows,
  buildBackupLine,
  buildDestinationChip,
  buildStorageHubViewModel,
  STORAGE_UI_COPY,
} from '../storage-ui-core';

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

const destination: StorageDestinationRow = {
  id: 'dest-web', kind: 'local_device', label: 'This browser', account_hint: null,
  credential_ref: 'local:idb', root_ref: null, state: 'ready', capability_json: '{}',
  created_at: '2026-07-14T00:00:00.000Z', updated_at: '2026-07-14T00:00:00.000Z',
};
const health: StorageHealthRow = {
  destination_id: 'dest-web', state: 'ok', used_bytes: 10, cap_bytes: 100,
  verified_read_write: 1, checked_at: '2026-07-14T01:00:00.000Z', error_code: null,
};
const runningJob: StorageJobRow = {
  id: 'j1', kind: 'backup', destination_id: 'dest-web', state: 'running', cursor_json: null,
  total_objects: 2, completed_objects: 1, total_bytes: 20, completed_bytes: 10, attempts: 1,
  last_error_code: null, created_at: '2026-07-14T02:00:00.000Z', updated_at: '2026-07-14T02:01:00.000Z',
};
const corruptBackup: StorageBackupRow = {
  backup_id: 'b1', destination_id: 'dest-web', manifest_ref: 'manifest.mkmanifest',
  manifest_ciphertext_hash: 'a'.repeat(128), schema_version: 1, object_count: 1,
  encrypted_bytes: 10, state: 'corrupt', completed_at: null,
};

describe('web storage-ui-core', () => {
  it('folds the hub read model', () => {
    const vm = buildStorageHubViewModel(diagnostics({
      destinations: [destination], health: [health], jobs: [runningJob], backups: [corruptBackup],
    }));
    expect(vm.hasAnyDestination).toBe(true);
    expect(vm.destinations[0]!.chip.state).toBe('ready');
    expect(vm.runningJobs).toHaveLength(1);
  });

  it('never shows a corrupt backup as done', () => {
    const line = buildBackupLine(
      diagnostics({ destinations: [destination], backups: [corruptBackup] }).backups[0]!,
    );
    expect(line.restorable).toBe(false);
    expect(line.stateLabel).toBe('Corrupt');
  });

  it('marks unsupported kinds honestly on web', () => {
    const rows = buildAddDestinationRows({ supports: (k) => k === 'local_device', platform: 'web' });
    expect(rows.find((r) => r.kind === 'icloud_drive')?.unavailableReason).toContain('Apple');
    expect(rows.find((r) => r.kind === 'local_device')?.supported).toBe(true);
  });

  it('surfaces a revoked destination as reconnect', () => {
    const revoked = { ...destination, state: 'revoked' as const };
    const d = diagnostics({ destinations: [revoked] }).destinations[0]!;
    expect(buildDestinationChip(d).state).toBe('revoked');
  });

  it('carries the not-a-default and encrypt-before-leaving copy', () => {
    expect(STORAGE_UI_COPY.hostedNotDefault).toContain('never a silent default');
    expect(STORAGE_UI_COPY.encryptBeforeLeaving).toContain('encrypted on this device');
  });
});

describe('web and mobile storage-ui-core are logic twins', () => {
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
    const web = readFileSync(resolve(__dirname, '../storage-ui-core.ts'), 'utf8');
    const mobile = readFileSync(
      resolve(__dirname, '../../../../../meerkat/app/(root)/data/storage-destinations/storage-ui-core.ts'),
      'utf8',
    );
    expect(logicLines(web)).toBe(logicLines(mobile));
  });
});
