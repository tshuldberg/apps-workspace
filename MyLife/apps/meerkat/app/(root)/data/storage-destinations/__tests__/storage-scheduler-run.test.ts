import { createInMemoryTestDatabase } from '@mylife/db';
import {
  ensureStorageTables,
  generateDeviceIdentity,
  generateRecoveryKey,
  insertStorageDestination,
  insertStorageHealth,
  insertStoragePolicy,
} from '@mylife/sync';
import { describe, expect, it, vi } from 'vitest';
import { ensureMeerkatTables, saveIdentityRow } from '../../db';
import {
  runBackgroundStorageOnce,
  type MobileStorageScheduleRuntime,
} from '../storage-scheduler-run';

const NOW = '2026-07-15T12:00:00.000Z';

function seedDue(db: ReturnType<typeof createInMemoryTestDatabase>['adapter'], withIdentity = true) {
  ensureMeerkatTables(db);
  ensureStorageTables(db);
  if (withIdentity) {
    const identity = generateDeviceIdentity('Mobile scheduler');
    saveIdentityRow(db, {
      public_key: identity.publicKey,
      dh_public_key: identity.dhPublicKey,
      private_key_ref: identity.privateKeyRef,
      display_name: identity.displayName,
      created_at: identity.createdAt,
    });
  }
  insertStorageDestination(db, {
    id: 'primary', kind: 'local_device', label: 'Primary', account_hint: null,
    credential_ref: null, root_ref: null, state: 'ready', capability_json: '{}',
    created_at: NOW, updated_at: NOW,
  });
  insertStorageHealth(db, {
    destination_id: 'primary', state: 'ok', used_bytes: 0, cap_bytes: 1_000,
    verified_read_write: 1, checked_at: NOW, error_code: null,
  });
  insertStoragePolicy(db, {
    data_class: 'sqlite_snapshot', primary_destination_id: 'primary', mirror_destination_id: null,
    local_cache_bytes: 0,
    retention_json: JSON.stringify({
      keepLast: 7, maxAgeDays: 30,
      schedule: { enabled: true, intervalHours: 24, recoveryKeyRef: 'key-ref' },
    }),
    updated_at: NOW,
  });
}

function runtime(
  db: ReturnType<typeof createInMemoryTestDatabase>['adapter'],
  secret: string | null,
  overrides: Record<string, unknown> = {},
): MobileStorageScheduleRuntime {
  const router = { checkHealth: vi.fn(async () => undefined), getDestination: vi.fn(() => null) };
  return {
    db,
    nowIso: () => NOW,
    randomUUID: () => 'mobile-scheduled-id',
    readSecret: vi.fn(async () => secret),
    createRegistry: () => ({ registry: { resolveRouterDestination: () => null } }),
    createPayloadStore: () => ({}),
    createBlobStore: () => ({}),
    createRouter: () => router,
    runBackup: vi.fn(async () => ({
      complete: true, mirror: null, job: { state: 'succeeded', last_error_code: null },
    })),
    runRetention: vi.fn(async () => ({ deleted: 0 })),
    runRepair: vi.fn(async () => ({ repaired: 0 })),
    ...overrides,
  } as unknown as MobileStorageScheduleRuntime;
}

describe('runBackgroundStorageOnce', () => {
  it('executes a due backup and reports maintenance without exposing signing bytes', async () => {
    const memory = createInMemoryTestDatabase();
    seedDue(memory.adapter);
    const recovery = generateRecoveryKey();
    let signingBytes: Uint8Array | null = null;
    const runBackup = vi.fn(async (input: { encoderInput: { signingIdentity: { secretKey: Uint8Array } } }) => {
      signingBytes = input.encoderInput.signingIdentity.secretKey;
      return { complete: true, mirror: { error: 'mirror_offline' }, job: { state: 'succeeded', last_error_code: null } };
    });
    const configured = runtime(memory.adapter, recovery.key, {
      runBackup,
      runRetention: vi.fn(async () => ({ deleted: 2 })),
      runRepair: vi.fn(async () => ({ repaired: 1 })),
    });

    const result = await runBackgroundStorageOnce(configured);

    expect(result).toMatchObject({
      ran: true, retentionDeleted: 2, repairedObjects: 1,
      backups: [{ status: 'partial', backupId: 'backup-mobile-scheduled-id', reason: 'mirror_offline' }],
    });
    expect(signingBytes).not.toBeNull();
    expect([...signingBytes!].every((byte) => byte === 0)).toBe(true);
    memory.close();
  });

  it('skips a due backup when device identity is absent', async () => {
    const memory = createInMemoryTestDatabase();
    seedDue(memory.adapter, false);
    const configured = runtime(memory.adapter, generateRecoveryKey().key);
    const result = await runBackgroundStorageOnce(configured);
    expect(result.backups).toEqual([expect.objectContaining({
      status: 'skipped', backupId: null, reason: 'No device identity is available.',
    })]);
    expect(configured.runBackup).not.toHaveBeenCalled();
    memory.close();
  });

  it('deduplicates overlapping background task invocations', async () => {
    const memory = createInMemoryTestDatabase();
    ensureMeerkatTables(memory.adapter);
    ensureStorageTables(memory.adapter);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const configured = runtime(memory.adapter, null, {
      runRepair: vi.fn(async () => { await held; return { repaired: 0 }; }),
    });
    const first = runBackgroundStorageOnce(configured);
    expect(runBackgroundStorageOnce(configured)).toBe(first);
    release();
    await first;
    memory.close();
  });
});
