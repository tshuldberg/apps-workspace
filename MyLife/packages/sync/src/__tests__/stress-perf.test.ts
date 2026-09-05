import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createInMemoryTestDatabase, type InMemoryTestDatabase } from '@mylife/db';
import { createSyncTables } from '../db/schema';
import * as dbQueries from '../db/queries';
import {
  negotiateTransportPreference,
  type TransportPreferenceEntry,
} from '../protocol/sync-session';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

let testDb: InMemoryTestDatabase;

function db() {
  return testDb.adapter;
}

/** Shorthand for creating a transport preference entry. */
function pref(layerId: number, rank: number, enabled = true): TransportPreferenceEntry {
  return { layerId, rank, enabled };
}

/** Generate a unique ID with a prefix and index. */
function uid(prefix: string, i: number): string {
  return `${prefix}_${String(i).padStart(5, '0')}`;
}

/** Measure elapsed time of a synchronous function in milliseconds. */
function measureMs(fn: () => void): number {
  const start = performance.now();
  fn();
  return performance.now() - start;
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  testDb = createInMemoryTestDatabase();
  createSyncTables(testDb.adapter);
});

afterEach(() => {
  testDb.close();
});

// ---------------------------------------------------------------------------
// Multi-Workspace Stress
// ---------------------------------------------------------------------------

describe('Mesh Sync Stress & Performance', () => {
  describe('multi-workspace stress', () => {
    it('handles 5+ workspaces concurrently', () => {
      const now = new Date().toISOString();
      const deviceId = 'device-stress-01';
      const workspaceIds: string[] = [];

      // Create 5 workspaces with different members
      for (let w = 0; w < 5; w++) {
        const wsId = `ws_stress_${w}`;
        workspaceIds.push(wsId);

        dbQueries.createWorkspace(db(), {
          id: wsId,
          displayName: `Workspace ${w}`,
          workspaceType: w === 0 ? 'personal' : 'group',
          createdByDeviceId: deviceId,
          createdAt: now,
          rotatedAt: null,
          currentKeyVersion: 1,
          archivedAt: null,
        });

        // Add the owner
        dbQueries.addWorkspaceMember(db(), {
          workspaceId: wsId,
          deviceId,
          role: 'owner',
          invitedByDeviceId: deviceId,
          invitedAt: now,
          removedAt: null,
        });

        // Add 2 extra members per workspace
        for (let m = 0; m < 2; m++) {
          const memberId = `member_ws${w}_${m}`;
          dbQueries.addWorkspaceMember(db(), {
            workspaceId: wsId,
            deviceId: memberId,
            role: 'member',
            invitedByDeviceId: deviceId,
            invitedAt: now,
            removedAt: null,
          });
        }
      }

      // Verify workspace isolation: each workspace has exactly 3 members
      for (const wsId of workspaceIds) {
        const members = dbQueries.getWorkspaceMembers(db(), wsId);
        expect(members).toHaveLength(3);
        // Verify no cross-leak: each member's workspaceId matches
        for (const m of members) {
          expect(m.workspaceId).toBe(wsId);
        }
      }

      // Verify key rotation independence: rotate one workspace
      const wrappedKey = new Uint8Array([1, 2, 3, 4]);
      dbQueries.insertKeyWrap(db(), {
        workspaceId: workspaceIds[0]!,
        keyVersion: 2,
        wrappedForDeviceId: deviceId,
        wrappedKeyBlob: wrappedKey,
        validFrom: now,
        validUntil: null,
      });

      const wraps0 = dbQueries.getKeyWraps(db(), workspaceIds[0]!, 2);
      expect(wraps0).toHaveLength(1);

      // Other workspaces should not see this key version
      const wraps1 = dbQueries.getKeyWraps(db(), workspaceIds[1]!, 2);
      expect(wraps1).toHaveLength(0);

      // All 5 workspaces should be retrievable
      const allWs = dbQueries.getWorkspaces(db());
      expect(allWs).toHaveLength(5);
    });

    it('storage accounting aggregates across workspaces', () => {
      const now = new Date().toISOString();

      // Create two sessions in different workspace contexts
      dbQueries.insertSyncSession(db(), {
        id: 'sess_ws1_a',
        peerDeviceId: 'peer-01',
        transport: 'lan',
        direction: 'bidirectional',
        modulesSynced: ['books'],
        changesSent: 10,
        changesReceived: 5,
        bytesSent: 2048,
        bytesReceived: 1024,
        blobsSent: 0,
        blobsReceived: 0,
        durationMs: 100,
        status: 'completed',
        error: null,
        startedAt: now,
        completedAt: now,
      });

      // Record module stats for session 1
      dbQueries.insertModuleStats(db(), {
        sessionId: 'sess_ws1_a',
        moduleId: 'books',
        changesSent: 10,
        changesReceived: 5,
        bytesSent: 2048,
        bytesReceived: 1024,
      });

      // Record module stats for session 2 (same module, different session)
      dbQueries.insertSyncSession(db(), {
        id: 'sess_ws2_b',
        peerDeviceId: 'peer-02',
        transport: 'lan',
        direction: 'push',
        modulesSynced: ['books'],
        changesSent: 20,
        changesReceived: 0,
        bytesSent: 4096,
        bytesReceived: 0,
        blobsSent: 0,
        blobsReceived: 0,
        durationMs: 50,
        status: 'completed',
        error: null,
        startedAt: now,
        completedAt: now,
      });

      dbQueries.insertModuleStats(db(), {
        sessionId: 'sess_ws2_b',
        moduleId: 'books',
        changesSent: 20,
        changesReceived: 0,
        bytesSent: 4096,
        bytesReceived: 0,
      });

      // Verify aggregation
      const agg = dbQueries.getAggregateModuleStats(db(), 'books');
      expect(agg.totalBytesSent).toBe(2048 + 4096);
      expect(agg.totalBytesReceived).toBe(1024 + 0);
    });
  });

  // ---------------------------------------------------------------------------
  // Delta Throughput
  // ---------------------------------------------------------------------------

  describe('delta throughput', () => {
    it('processes 1000 change records without error', () => {
      const now = new Date().toISOString();

      const elapsed = measureMs(() => {
        for (let i = 0; i < 1000; i++) {
          dbQueries.insertChangeRecord(db(), {
            id: uid('cr', i),
            moduleId: 'books',
            tableName: 'bk_books',
            operation: 'INSERT',
            rowId: uid('row', i),
            dataJson: JSON.stringify({ title: `Book ${i}`, idx: i }),
            deviceId: 'dev-stress',
            timestamp: 1000 + i,
            synced: false,
            createdAt: now,
          });
        }
      });

      // Verify all 1000 are retrievable
      const rows = db().query<{ c: number }>(
        'SELECT COUNT(*) as c FROM sync_change_log',
      );
      expect(rows[0]!.c).toBe(1000);

      // Performance gate: should complete in under 500ms in memory
      expect(elapsed).toBeLessThan(500);
    });

    it('1000 records via getUnsyncedChanges completes quickly', () => {
      const now = new Date().toISOString();

      // Insert 1000 unsynced changes
      for (let i = 0; i < 1000; i++) {
        dbQueries.insertChangeRecord(db(), {
          id: uid('cr', i),
          moduleId: 'budget',
          tableName: 'bg_entries',
          operation: 'INSERT',
          rowId: uid('row', i),
          dataJson: JSON.stringify({ amount: i * 100 }),
          deviceId: 'dev-stress',
          timestamp: 2000 + i,
          synced: false,
          createdAt: now,
        });
      }

      let results: ReturnType<typeof dbQueries.getUnsyncedChanges> = [];
      const elapsed = measureMs(() => {
        results = dbQueries.getUnsyncedChanges(db(), 1000);
      });

      expect(results).toHaveLength(1000);
      // All should be unsynced
      for (const r of results) {
        expect(r.synced).toBe(false);
      }

      // Performance gate: should complete in under 200ms
      expect(elapsed).toBeLessThan(200);
    });
  });

  // ---------------------------------------------------------------------------
  // Query Performance
  // ---------------------------------------------------------------------------

  describe('query performance', () => {
    it('workspace CRUD scales with member count', () => {
      const now = new Date().toISOString();
      const wsId = 'ws_scale_20';

      dbQueries.createWorkspace(db(), {
        id: wsId,
        displayName: 'Big Workspace',
        workspaceType: 'group',
        createdByDeviceId: 'owner-dev',
        createdAt: now,
        rotatedAt: null,
        currentKeyVersion: 1,
        archivedAt: null,
      });

      // Add 20 members
      for (let i = 0; i < 20; i++) {
        dbQueries.addWorkspaceMember(db(), {
          workspaceId: wsId,
          deviceId: `member_${String(i).padStart(3, '0')}`,
          role: i === 0 ? 'owner' : 'member',
          invitedByDeviceId: 'owner-dev',
          invitedAt: now,
          removedAt: null,
        });
      }

      let members: ReturnType<typeof dbQueries.getWorkspaceMembers> = [];
      const elapsed = measureMs(() => {
        members = dbQueries.getWorkspaceMembers(db(), wsId);
      });

      expect(members).toHaveLength(20);
      // Performance gate: should complete in under 50ms
      expect(elapsed).toBeLessThan(50);
    });

    it('conflict queue scales with pending count', () => {
      const now = new Date().toISOString();
      const wsId = 'ws_conflict';

      // Insert 100 unresolved conflicts
      for (let i = 0; i < 100; i++) {
        dbQueries.insertConflict(db(), {
          id: uid('conflict', i),
          workspaceId: wsId,
          moduleId: 'notes',
          tableName: 'nt_notes',
          rowId: uid('row', i),
          localVersionJson: JSON.stringify({ text: `local_${i}` }),
          remoteVersionJson: JSON.stringify({ text: `remote_${i}` }),
          remoteDeviceId: 'remote-dev',
          createdAt: now,
          resolvedAt: null,
          resolution: null,
        });
      }

      let conflicts: ReturnType<typeof dbQueries.getUnresolvedConflicts> = [];
      const elapsed = measureMs(() => {
        conflicts = dbQueries.getUnresolvedConflicts(db(), wsId);
      });

      expect(conflicts).toHaveLength(100);
      // Performance gate: should complete in under 100ms
      expect(elapsed).toBeLessThan(100);
    });

    it('transport preference negotiation is O(n*m)', () => {
      // Create preference lists of size 5
      const initiatorPrefs: TransportPreferenceEntry[] = [
        pref(1, 1), pref(2, 2), pref(3, 3), pref(4, 4), pref(5, 5),
      ];
      const responderPrefs: TransportPreferenceEntry[] = [
        pref(5, 1), pref(4, 2), pref(3, 3), pref(2, 4), pref(1, 5),
      ];

      let result: number | null = null;
      const elapsed = measureMs(() => {
        for (let i = 0; i < 1000; i++) {
          result = negotiateTransportPreference(initiatorPrefs, responderPrefs);
        }
      });

      // Initiator walks rank order: rank 1 = layer 1 (LAN).
      // Responder has layer 1 enabled (rank 5). Match on layer 1.
      expect(result).toBe(1);

      // Performance gate: 1000 negotiations in under 50ms
      expect(elapsed).toBeLessThan(50);
    });
  });

  // ---------------------------------------------------------------------------
  // Preference Negotiation Edge Cases
  // ---------------------------------------------------------------------------

  describe('preference negotiation edge cases', () => {
    it('two users with identical orders agree on first choice', () => {
      const prefs: TransportPreferenceEntry[] = [
        pref(1, 1), pref(2, 2), pref(3, 3), pref(4, 4), pref(5, 5),
      ];
      const result = negotiateTransportPreference(prefs, prefs);
      expect(result).toBe(1); // LAN, the top-ranked choice for both
    });

    it('two users with reversed orders agree on initiator top that responder has enabled', () => {
      const initiator: TransportPreferenceEntry[] = [
        pref(1, 1), pref(2, 2), pref(3, 3), pref(4, 4), pref(5, 5),
      ];
      const responder: TransportPreferenceEntry[] = [
        pref(5, 1), pref(4, 2), pref(3, 3), pref(2, 4), pref(1, 5),
      ];

      // Initiator walks top to bottom: rank 1 = layer 1.
      // Responder has layer 1 enabled. Match.
      const result = negotiateTransportPreference(initiator, responder);
      expect(result).toBe(1);
    });

    it('no mutual match when one user has all disabled', () => {
      const enabledAll: TransportPreferenceEntry[] = [
        pref(1, 1), pref(2, 2), pref(3, 3), pref(4, 4), pref(5, 5),
      ];
      const allDisabled: TransportPreferenceEntry[] = [
        pref(1, 1, false),
        pref(2, 2, false),
        pref(3, 3, false),
        pref(4, 4, false),
        pref(5, 5, false),
      ];

      const result = negotiateTransportPreference(enabledAll, allDisabled);
      expect(result).toBeNull();
    });
  });

  // ---------------------------------------------------------------------------
  // Batch markChangesSynced
  // ---------------------------------------------------------------------------

  describe('batch operations', () => {
    it('markChangesSynced handles 1000 IDs in a single call', () => {
      const now = new Date().toISOString();
      const ids: string[] = [];

      // Insert 1000 changes
      for (let i = 0; i < 1000; i++) {
        const id = uid('cr', i);
        ids.push(id);
        dbQueries.insertChangeRecord(db(), {
          id,
          moduleId: 'mood',
          tableName: 'md_entries',
          operation: 'INSERT',
          rowId: uid('row', i),
          dataJson: null,
          deviceId: 'dev-batch',
          timestamp: 3000 + i,
          synced: false,
          createdAt: now,
        });
      }

      // Mark all as synced
      const elapsed = measureMs(() => {
        dbQueries.markChangesSynced(db(), ids);
      });

      // Verify all are now synced
      const unsynced = dbQueries.getUnsyncedChanges(db(), 1000);
      expect(unsynced).toHaveLength(0);

      // Performance gate: batch mark under 200ms
      expect(elapsed).toBeLessThan(200);
    });
  });
});
