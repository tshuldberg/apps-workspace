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
import {
  runWebStorageScheduleOnce,
  type WebStorageScheduleRuntime,
} from '../web-storage-scheduler-run';

const NOW = '2026-07-15T12:00:00.000Z';

function seedDue(db: ReturnType<typeof createInMemoryTestDatabase>['adapter'], recoveryKeyRef = 'key-ref') {
  ensureStorageTables(db);
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
      schedule: { enabled: true, intervalHours: 24, recoveryKeyRef },
    }),
    updated_at: NOW,
  });
}

function runtime(overrides: Record<string, unknown> = {}): WebStorageScheduleRuntime {
  const router = {
    checkHealth: vi.fn(async () => undefined),
    getDestination: vi.fn(() => null),
  };
  return {
    nowIso: () => NOW,
    randomUUID: () => 'scheduled-id',
    createRegistry: () => ({ resolveRouterDestination: () => null }),
    createPayloadStore: () => ({}),
    createBlobStore: () => ({}),
    createRouter: () => router,
    runBackup: vi.fn(async () => ({
      complete: true,
      mirror: null,
      job: { state: 'succeeded', last_error_code: null },
    })),
    runRetention: vi.fn(async () => ({ deleted: 0 })),
    runRepair: vi.fn(async () => ({ repaired: 0 })),
    ...overrides,
  } as unknown as WebStorageScheduleRuntime;
}

function secretAccess(value: string | null) {
  return {
    get: vi.fn(() => value), set: vi.fn(), delete: vi.fn(), flush: vi.fn(async () => undefined),
  };
}

describe('runWebStorageScheduleOnce', () => {
  it('runs a due backup, reports retention and repair work, and clears signing bytes', async () => {
    const memory = createInMemoryTestDatabase();
    seedDue(memory.adapter);
    const recovery = generateRecoveryKey();
    let signingBytes: Uint8Array | null = null;
    const runBackup = vi.fn(async (input: { encoderInput: { signingIdentity: { secretKey: Uint8Array } } }) => {
      signingBytes = input.encoderInput.signingIdentity.secretKey;
      return { complete: true, mirror: null, job: { state: 'succeeded', last_error_code: null } };
    });
    const configured = runtime({
      runBackup,
      runRetention: vi.fn(async () => ({ deleted: 2 })),
      runRepair: vi.fn(async () => ({ repaired: 3 })),
    });

    const result = await runWebStorageScheduleOnce({
      db: memory.adapter as never,
      identity: generateDeviceIdentity('Scheduler'),
      secrets: secretAccess(recovery.key),
      runtime: configured,
    });

    expect(result).toMatchObject({
      ran: true, succeeded: 1, partial: 0, failed: 0, skipped: 0,
      retentionDeleted: 2, repairedObjects: 3,
    });
    expect(runBackup).toHaveBeenCalledOnce();
    expect(signingBytes).not.toBeNull();
    expect([...signingBytes!].every((byte) => byte === 0)).toBe(true);
    memory.close();
  });

  it('skips a due backup with no recovery key without fabricating a run', async () => {
    const memory = createInMemoryTestDatabase();
    seedDue(memory.adapter);
    const configured = runtime();
    const result = await runWebStorageScheduleOnce({
      db: memory.adapter as never,
      identity: generateDeviceIdentity('Scheduler'),
      secrets: secretAccess(null),
      runtime: configured,
    });
    expect(result).toMatchObject({ ran: false, skipped: 1, succeeded: 0, failed: 0 });
    expect(configured.runBackup).not.toHaveBeenCalled();
    memory.close();
  });

  it('deduplicates one database run without coupling independent databases', async () => {
    const first = createInMemoryTestDatabase();
    const second = createInMemoryTestDatabase();
    ensureStorageTables(first.adapter);
    ensureStorageTables(second.adapter);
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    const firstRuntime = runtime({ runRepair: vi.fn(async () => { await held; return { repaired: 0 }; }) });
    const input = {
      db: first.adapter as never,
      identity: generateDeviceIdentity('First'),
      secrets: secretAccess(null),
      runtime: firstRuntime,
    };
    const firstRun = runWebStorageScheduleOnce(input);
    expect(runWebStorageScheduleOnce(input)).toBe(firstRun);
    const independent = runWebStorageScheduleOnce({
      db: second.adapter as never,
      identity: generateDeviceIdentity('Second'),
      secrets: secretAccess(null),
      runtime: runtime(),
    });
    expect(independent).not.toBe(firstRun);
    await independent;
    release();
    await firstRun;
    first.close();
    second.close();
  });
});
