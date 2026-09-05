import { describe, expect, it } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import {
  assertComplexitySlope,
  assertMemoryBudget,
  runDeterministicFuzz,
} from '../../test/function-quality';
import { ChangeTracker } from '../../crdt/change-tracker';
import { createSyncTables } from '../../db/schema';
import { applyReceivedDocumentChanges, type SyncSessionOptions } from '../sync-session';

const NOW = Date.parse('2026-08-24T12:00:00.000Z');
const PEER = 'peer-device';
const CONTEXT = { remoteDeviceId: PEER, sessionId: 'function-gate-session' };
const PREFIXES = new Map([['notes', 'nt_']]);
const POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{
    tableName: 'nt_notes',
    defaultScope: 'personal_replica',
    conflictStrategy: 'lww',
  }],
};

interface Harness {
  db: InMemoryTestDatabase;
  options: SyncSessionOptions;
  changes: Array<{
    table: string;
    rowId: string;
    operation: 'INSERT';
    data: { id: string; title: string; updated_at: string };
  }>;
}

function harness(count: number, updatedAt: string): Harness {
  const db = createInMemoryTestDatabase();
  createSyncTables(db.adapter);
  db.adapter.execute('CREATE TABLE nt_notes (id TEXT PRIMARY KEY, title TEXT, updated_at TEXT)');
  const policies = new Map([['notes', POLICY]]);
  const changeTracker = new ChangeTracker({
    db: db.adapter,
    deviceId: 'local-device',
    modulePrefixes: PREFIXES,
    modulePolicies: policies,
  });
  return {
    db,
    options: {
      db: db.adapter,
      identity: { publicKey: 'local-device' },
      pairedDevices: [{ deviceId: PEER }],
      changeTracker,
      enabledModules: ['notes'],
      modulePolicies: policies,
      transport: 'lan_wifi',
      documentManager: undefined,
      inboundNowMs: () => NOW,
    } as unknown as SyncSessionOptions,
    changes: Array.from({ length: count }, (_, index) => ({
      table: 'nt_notes',
      rowId: `note-${index}`,
      operation: 'INSERT' as const,
      data: { id: `note-${index}`, title: 'safe', updated_at: updatedAt },
    })),
  };
}

function applyAndClose(input: Harness): number {
  try {
    return applyReceivedDocumentChanges(input.options, 'notes', input.changes, CONTEXT);
  } finally {
    input.db.close();
  }
}

describe('applyReceivedDocumentChanges function quality gate', () => {
  it('accepts valid rows and rejects malformed or far-future LWW timestamps', () => {
    expect(applyAndClose(harness(1, '2026-08-24T11:59:00.000Z'))).toBe(1);
    expect(applyAndClose(harness(1, 'not-a-date'))).toBe(0);
    expect(applyAndClose(harness(1, '9999-12-31T23:59:59.999Z'))).toBe(0);
  });

  it('passes deterministic valid/invalid timestamp invariants', async () => {
    await runDeterministicFuzz({
      label: 'applyReceivedDocumentChanges timestamp fuzz',
      iterations: 200,
      seed: 42,
      makeCase: (rng, index) => ({ valid: rng() >= 0.5, index }),
      assertCase: ({ valid, index }) => {
        const timestamp = valid
          ? new Date(NOW - index * 1000).toISOString()
          : `invalid-${index}`;
        expect(applyAndClose(harness(1, timestamp))).toBe(valid ? 1 : 0);
      },
    });
  });

  it('stays within linear complexity slope budget', async () => {
    await assertComplexitySlope({
      label: 'applyReceivedDocumentChanges',
      sizes: [25, 50, 100],
      expected: 'linear',
      setup: (size) => harness(size, '9999-12-31T23:59:59.999Z'),
      run: (input) => {
        applyAndClose(input);
      },
    });
  });

  it('stays within memory budget under repeated calls', async () => {
    await assertMemoryBudget({
      label: 'applyReceivedDocumentChanges',
      repeats: 40,
      maxHeapDeltaBytes: 16 * 1024 * 1024,
      setup: () => harness(100, '9999-12-31T23:59:59.999Z'),
      run: (input) => {
        applyAndClose(input);
      },
    });
  });
});
