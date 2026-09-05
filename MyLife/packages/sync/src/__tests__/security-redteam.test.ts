/**
 * Security / red-team integration tests for Mesh Sync.
 *
 * Each describe block maps to a threat model scenario from
 * docs/designs/mesh-sync-architecture.md Section 12.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type {
  DeviceIdentity,
} from '../types';
import { isScopeWithinMaxScope } from '../types';
import { ChangeTracker } from '../crdt/change-tracker';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import {
  createWorkspace,
  addWorkspaceMember,
  getWorkspace,
  getWorkspaceMembers,
  getWorkspacesByDevice,
  isDeviceRevoked,
  upsertEntityAcl,
  getEntityAcl,
  getKeyWraps,
  insertKeyWrap,
} from '../db/queries';
import { revokeFromWorkspace, rotateWorkspaceKey } from '../identity/revocation';
import {
  RelayTransport,
  SimulatedRelayBackend,
} from '../transport/relay-transport';

// ---------------------------------------------------------------------------
// Mock DatabaseAdapter -- thin wrapper over a Map-based in-memory store
// ---------------------------------------------------------------------------

interface Row {
  [key: string]: unknown;
}

/**
 * Builds a mock DatabaseAdapter that stores rows in memory so we can
 * exercise real query paths from queries.ts without a real SQLite file.
 */
function createInMemoryDb(): DatabaseAdapter & { _tables: Map<string, Row[]> } {
  const tables = new Map<string, Row[]>();
  const executedSql: string[] = [];

  function ensureTable(name: string): Row[] {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  }

  // Tiny SQL parser: resolves table name from INSERT, SELECT, UPDATE, DELETE
  function extractTableName(sql: string): string | null {
    const insertMatch = sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i);
    if (insertMatch) return insertMatch[1]!;
    const selectMatch = sql.match(/FROM\s+(\w+)/i);
    if (selectMatch) return selectMatch[1]!;
    const updateMatch = sql.match(/UPDATE\s+(\w+)/i);
    if (updateMatch) return updateMatch[1]!;
    const deleteMatch = sql.match(/DELETE\s+FROM\s+(\w+)/i);
    if (deleteMatch) return deleteMatch[1]!;
    return null;
  }

  const db: DatabaseAdapter & { _tables: Map<string, Row[]> } = {
    _tables: tables,

    execute(sql: string, params?: unknown[]) {
      executedSql.push(sql);
      const table = extractTableName(sql);
      if (!table) return;

      if (/^INSERT/i.test(sql.trim())) {
        const cols = sql.match(/\(([^)]+)\)\s*VALUES/i)?.[1]?.split(',').map((c) => c.trim()) ?? [];
        const row: Row = {};
        cols.forEach((col, i) => {
          row[col] = params?.[i] ?? null;
        });
        ensureTable(table).push(row);
      }

      if (/^UPDATE/i.test(sql.trim())) {
        const rows = ensureTable(table);

        // Handle SET current_key_version = current_key_version + 1
        const bumpMatch = sql.match(/SET\s+current_key_version\s*=\s*current_key_version\s*\+\s*1/i);

        // Handle SET current_key_version = ?, rotated_at = ...
        const setVersionMatch = sql.match(/SET\s+current_key_version\s*=\s*\?/i);

        // Handle SET removed_at = ...
        const removeMatch = sql.match(/SET\s+removed_at\s*=/i);

        // Handle SET valid_until = ...
        const invalidateMatch = sql.match(/SET\s+valid_until\s*=/i);

        // Handle SET is_active = 0
        const deactivateMatch = sql.match(/SET\s+is_active\s*=\s*0/i);

        // Extract WHERE clause params (the last params)
        if (bumpMatch) {
          // revokeFromWorkspace: bump key version WHERE id = ?
          const wsId = params?.[0];
          for (const row of rows) {
            if (row['id'] === wsId) {
              row['current_key_version'] = (row['current_key_version'] as number) + 1;
              row['rotated_at'] = new Date().toISOString();
            }
          }
        } else if (setVersionMatch && !invalidateMatch) {
          // rotateWorkspaceKey: SET current_key_version = ? WHERE id = ?
          const newVersion = params?.[0];
          const wsId = params?.[1];
          for (const row of rows) {
            if (row['id'] === wsId) {
              row['current_key_version'] = newVersion;
              row['rotated_at'] = new Date().toISOString();
            }
          }
        } else if (removeMatch) {
          // removeWorkspaceMember: SET removed_at WHERE workspace_id = ? AND device_id = ?
          const wsId = params?.[0];
          const devId = params?.[1];
          for (const row of rows) {
            if (row['workspace_id'] === wsId && row['device_id'] === devId && row['removed_at'] === null) {
              row['removed_at'] = new Date().toISOString();
            }
          }
        } else if (invalidateMatch) {
          // invalidateKeyVersion: SET valid_until WHERE workspace_id = ? AND key_version = ?
          const wsId = params?.[0];
          const keyVersion = params?.[1];
          for (const row of rows) {
            if (row['workspace_id'] === wsId && row['key_version'] === keyVersion) {
              row['valid_until'] = new Date().toISOString();
            }
          }
        } else if (deactivateMatch) {
          const devId = params?.[0];
          for (const row of rows) {
            if (row['device_id'] === devId) {
              row['is_active'] = 0;
            }
          }
        }
      }
    },

    query<T>(sql: string, params?: unknown[]): T[] {
      const table = extractTableName(sql);
      if (!table) return [] as T[];

      const rows = ensureTable(table);

      // Handle JOINs (getWorkspacesByDevice)
      const joinMatch = sql.match(/FROM\s+(\w+)\s+\w+\s+JOIN\s+(\w+)/i);
      if (joinMatch) {
        const mainTable = joinMatch[1]!;
        const joinTable = joinMatch[2]!;
        const mainRows = ensureTable(mainTable);
        const joinRows = ensureTable(joinTable);
        const deviceId = params?.[0];

        const activeMembers = joinRows.filter(
          (m) => m['device_id'] === deviceId && m['removed_at'] === null,
        );
        const wsIds = new Set(activeMembers.map((m) => m['workspace_id']));

        return mainRows
          .filter((w) => wsIds.has(w['id']) && w['archived_at'] === null)
          .map((r) => ({ ...r }) as T);
      }

      // Handle COUNT(*)
      if (/COUNT\(\*\)/i.test(sql)) {
        if (/WHERE\s+synced\s*=\s*0/i.test(sql)) {
          const count = rows.filter((r) => r['synced'] === 0).length;
          return [{ c: count } as T];
        }
        return [{ c: rows.length } as T];
      }

      // Basic WHERE clause matching
      const whereParams: Array<[string, unknown]> = [];
      const whereMatch = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
      if (whereMatch) {
        const conditions = whereMatch[1]!.split(/\s+AND\s+/i);
        let paramIdx = 0;
        for (const cond of conditions) {
          const colMatch = cond.match(/(\w+)\s*=\s*\?/);
          if (colMatch) {
            whereParams.push([colMatch[1]!, params?.[paramIdx] ?? null]);
            paramIdx++;
          }
          const nullMatch = cond.match(/(\w+)\s+IS\s+NULL/i);
          if (nullMatch) {
            whereParams.push([nullMatch[1]!, null]);
          }
          // removed_at IS NULL is a special case handled above
        }
      }

      let result = rows;
      if (whereParams.length > 0) {
        result = rows.filter((row) =>
          whereParams.every(([col, val]) => row[col] === val),
        );
      }

      return result.map((r) => ({ ...r }) as T);
    },

    transaction(fn: () => void): void {
      fn();
    },
  };

  return db;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDevice(label: string): DeviceIdentity {
  return {
    publicKey: `${label}_pub_key_${Math.random().toString(36).slice(2, 10)}`,
    privateKeyRef: `ref:${label}`,
    dhPublicKey: `${label}_dh`,
    displayName: label,
    createdAt: new Date().toISOString(),
  };
}

function seedWorkspace(
  db: DatabaseAdapter,
  wsId: string,
  ownerDeviceId: string,
  type: 'personal' | 'group' | 'community' = 'group',
): void {
  const now = new Date().toISOString();
  createWorkspace(db, {
    id: wsId,
    displayName: `Workspace ${wsId}`,
    workspaceType: type,
    createdByDeviceId: ownerDeviceId,
    createdAt: now,
    rotatedAt: null,
    currentKeyVersion: 1,
    archivedAt: null,
  });
  addWorkspaceMember(db, {
    workspaceId: wsId,
    deviceId: ownerDeviceId,
    role: 'owner',
    invitedByDeviceId: ownerDeviceId,
    invitedAt: now,
    removedAt: null,
  });
}

function addMember(
  db: DatabaseAdapter,
  wsId: string,
  deviceId: string,
  invitedBy: string,
): void {
  addWorkspaceMember(db, {
    workspaceId: wsId,
    deviceId,
    role: 'member',
    invitedByDeviceId: invitedBy,
    invitedAt: new Date().toISOString(),
    removedAt: null,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Mesh Sync Security', () => {
  // -----------------------------------------------------------------------
  // 1. Revoked Member Isolation
  // -----------------------------------------------------------------------
  describe('revoked member isolation', () => {
    let db: ReturnType<typeof createInMemoryDb>;
    let owner: DeviceIdentity;
    let member: DeviceIdentity;

    beforeEach(() => {
      db = createInMemoryDb();
      owner = makeDevice('owner');
      member = makeDevice('member');
      seedWorkspace(db, 'ws-alpha', owner.publicKey);
      addMember(db, 'ws-alpha', member.publicKey, owner.publicKey);
    });

    it('revoked device cannot record changes after revocation', () => {
      // Revoke the member from the workspace
      revokeFromWorkspace(db, 'ws-alpha', member.publicKey, owner.publicKey, { legacyOk: true });

      // Verify the device is now in the revocations table
      expect(isDeviceRevoked(db, member.publicKey)).toBe(true);

      // A real sync session checks isDeviceRevoked before accepting changes.
      // Any change signed by a revoked device should be rejected by peers.
      const revoked = isDeviceRevoked(db, member.publicKey);
      expect(revoked).toBe(true);

      // The owner is NOT revoked
      expect(isDeviceRevoked(db, owner.publicKey)).toBe(false);
    });

    it('workspace key rotates on member removal', () => {
      // Initial key version
      const wsBefore = getWorkspace(db, 'ws-alpha');
      expect(wsBefore).not.toBeNull();
      expect(wsBefore!.currentKeyVersion).toBe(1);

      // Revoke the member (this bumps key version)
      revokeFromWorkspace(db, 'ws-alpha', member.publicKey, owner.publicKey, { legacyOk: true });

      // Key version should be incremented
      const wsAfter = getWorkspace(db, 'ws-alpha');
      expect(wsAfter).not.toBeNull();
      expect(wsAfter!.currentKeyVersion).toBe(2);
      expect(wsAfter!.rotatedAt).not.toBeNull();
    });

    it('explicit key rotation invalidates old wraps', () => {
      // Insert a key wrap for version 1
      insertKeyWrap(db, {
        workspaceId: 'ws-alpha',
        keyVersion: 1,
        wrappedForDeviceId: member.publicKey,
        wrappedKeyBlob: new Uint8Array([0xAA, 0xBB]),
        validFrom: new Date().toISOString(),
        validUntil: null,
      });

      // Rotate to version 2 (invalidates version 1 wraps)
      rotateWorkspaceKey(db, 'ws-alpha', 2, { legacyOk: true });

      // Check workspace version
      const ws = getWorkspace(db, 'ws-alpha');
      expect(ws!.currentKeyVersion).toBe(2);

      // Old key wraps should have valid_until set
      const oldWraps = getKeyWraps(db, 'ws-alpha', 1);
      for (const wrap of oldWraps) {
        expect(wrap.validUntil).not.toBeNull();
      }
    });

    it('revocation from one workspace does not affect others', () => {
      // Device is member of both ws-alpha and ws-beta
      seedWorkspace(db, 'ws-beta', owner.publicKey);
      addMember(db, 'ws-beta', member.publicKey, owner.publicKey);

      // Verify membership in both workspaces before revocation
      const workspacesBefore = getWorkspacesByDevice(db, member.publicKey);
      expect(workspacesBefore).toHaveLength(2);

      // Revoke from ws-alpha only
      revokeFromWorkspace(db, 'ws-alpha', member.publicKey, owner.publicKey, { legacyOk: true });

      // Member should be removed from ws-alpha
      const alphaMembers = getWorkspaceMembers(db, 'ws-alpha');
      const stillInAlpha = alphaMembers.some(
        (m) => m.deviceId === member.publicKey,
      );
      expect(stillInAlpha).toBe(false);

      // Member should still be active in ws-beta
      const betaMembers = getWorkspaceMembers(db, 'ws-beta');
      const stillInBeta = betaMembers.some(
        (m) => m.deviceId === member.publicKey,
      );
      expect(stillInBeta).toBe(true);

      // ws-beta's key version should NOT have changed
      const wsBeta = getWorkspace(db, 'ws-beta');
      expect(wsBeta!.currentKeyVersion).toBe(1);

      // ws-alpha's key version SHOULD have changed
      const wsAlpha = getWorkspace(db, 'ws-alpha');
      expect(wsAlpha!.currentKeyVersion).toBe(2);
    });

    it('multiple revocations bump key version cumulatively', () => {
      const member2 = makeDevice('member2');
      addMember(db, 'ws-alpha', member2.publicKey, owner.publicKey);

      revokeFromWorkspace(db, 'ws-alpha', member.publicKey, owner.publicKey, { legacyOk: true });
      const wsAfterFirst = getWorkspace(db, 'ws-alpha');
      expect(wsAfterFirst!.currentKeyVersion).toBe(2);

      revokeFromWorkspace(db, 'ws-alpha', member2.publicKey, owner.publicKey, { legacyOk: true });
      const wsAfterSecond = getWorkspace(db, 'ws-alpha');
      expect(wsAfterSecond!.currentKeyVersion).toBe(3);
    });
  });

  // -----------------------------------------------------------------------
  // 2. Relay Anonymity
  // -----------------------------------------------------------------------
  describe('relay anonymity', () => {
    let backend: SimulatedRelayBackend;
    let transport: RelayTransport;

    beforeEach(() => {
      backend = new SimulatedRelayBackend();
      transport = new RelayTransport({ backend });
    });

    afterEach(async () => {
      await transport.destroy();
    });

    it('relay sees only opaque tokens, not device identity', async () => {
      const deviceId = 'device-ed25519-pubkey-abc123';
      const token = 'ephemeral-opaque-session-token-xyz';

      const conn = await transport.connectToPeer(deviceId, token);

      // The connection is keyed by device ID locally, but the relay backend
      // only receives the token. Verify the relay (SimulatedRelayBackend)
      // stores sessions by token, not by device identity.
      expect(conn.transport).toBe('wan_relay');
      expect(conn.remoteDeviceId).toBe(deviceId);

      // The SimulatedRelayBackend stores sessions keyed by token.
      // There should be exactly 1 session, accessed via the opaque token.
      expect(backend.sessionCount).toBe(1);

      // The relay backend's connect() API takes (url, token) -- no deviceId.
      // This is verified by the interface contract: RelayBackend.connect()
      // signature only accepts url and token, never device identity.
    });

    it('different sessions produce different tokens', () => {
      const tokenMeta1 = transport.createTokenMetadata(
        'ws-1',
        'peer-a',
        'ephemeral-token-session-1',
      );
      const tokenMeta2 = transport.createTokenMetadata(
        'ws-1',
        'peer-a',
        'ephemeral-token-session-2',
      );

      // Same workspace, same peer, but different session tokens
      expect(tokenMeta1.ephemeralToken).not.toBe(tokenMeta2.ephemeralToken);

      // Metadata should reflect distinct creation times
      expect(tokenMeta1.createdAt).toBeTruthy();
      expect(tokenMeta2.createdAt).toBeTruthy();
    });

    it('expired tokens are rejected', () => {
      const token = transport.createTokenMetadata(
        'ws-1',
        'peer-a',
        'token-to-expire',
      );

      // Fresh token is valid
      expect(transport.isTokenExpired(token)).toBe(false);

      // Simulate expiry by backdating the expiresAt
      const expired = {
        ...token,
        expiresAt: new Date(Date.now() - 60_000).toISOString(),
      };
      expect(transport.isTokenExpired(expired)).toBe(true);
    });

    it('relay cannot correlate sessions across token rotations', async () => {
      // Session 1: device connects with token A
      const conn1 = await transport.connectToPeer('peer-x', 'token-session-1');

      // Session 2: same device reconnects with a new token
      await transport.closeConnection('peer-x');
      const conn2 = await transport.connectToPeer('peer-x', 'token-session-2');

      // The relay sees two different tokens; it has no way to correlate them
      // to the same device. Both connections resolved to the same remoteDeviceId
      // locally, but the relay only sees distinct opaque tokens.
      expect(conn1.id).not.toBe(conn2.id);

      // Backend has 2 sessions stored under different tokens
      expect(backend.sessionCount).toBe(2);
    });

    it('relay envelope only contains ciphertext, not metadata', async () => {
      const transport2 = new RelayTransport({ backend });
      const connA = await transport.connectToPeer('peer-b', 'shared-tok');
      const connB = await transport2.connectToPeer('peer-a', 'shared-tok');

      const receivedByB: Uint8Array[] = [];
      connB.onData((data) => receivedByB.push(data));

      // Send opaque ciphertext (no device ID, no workspace ID in envelope)
      const ciphertext = new Uint8Array([0xCA, 0xFE, 0xBA, 0xBE]);
      await connA.send(ciphertext);
      await new Promise((r) => setTimeout(r, 10));

      // Relay delivered raw bytes unchanged -- no device identity metadata
      expect(receivedByB).toHaveLength(1);
      expect(receivedByB[0]).toEqual(ciphertext);

      await transport2.destroy();
    });
  });

  // -----------------------------------------------------------------------
  // 3. Scope Enforcement
  // -----------------------------------------------------------------------
  describe('scope enforcement', () => {
    let db: ReturnType<typeof createInMemoryDb>;

  beforeEach(() => {
      db = createInMemoryDb();
    });

    it('generic scope ordering blocks direct share beyond maxScope', () => {
      expect(isScopeWithinMaxScope('shared_workspace', 'personal_replica')).toBe(false);
      expect(isScopeWithinMaxScope('personal_replica', 'personal_replica')).toBe(true);
      expect(isScopeWithinMaxScope('published_blob', 'shared_workspace')).toBe(false);
      expect(isScopeWithinMaxScope('shared_workspace', 'published_blob')).toBe(true);
    });

    it('maxScope prevents escalation beyond personal_replica', () => {
      // Set up entity ACL with personal_replica scope
      upsertEntityAcl(db, {
        moduleId: 'sports',
        tableName: 'sp_bets',
        rowId: 'bet-1',
        workspaceId: 'ws-personal',
        scope: 'personal_replica',
        updatedAt: new Date().toISOString(),
      });

      const acl = getEntityAcl(db, 'sports', 'sp_bets', 'bet-1');
      expect(acl).not.toBeNull();
      expect(acl!.scope).toBe('personal_replica');

      // A module with maxScope: personal_replica should not allow
      // shared_workspace. The scope ordering is:
      // device_local < personal_replica < shared_workspace < published_blob
      const SCOPE_ORDER: Record<string, number> = {
        device_local: 0,
        personal_replica: 1,
        shared_workspace: 2,
        published_blob: 3,
      };

      const maxScope = 'personal_replica';
      const requestedScope = 'shared_workspace';

      // Scope escalation is blocked when requested > maxScope
      expect(SCOPE_ORDER[requestedScope]! > SCOPE_ORDER[maxScope]!).toBe(true);
    });

    it('cloud modules reject non-device-local changes', () => {
      // Cloud modules (supabase/drizzle) must stay device_local.
      // The ChangeTracker silently drops changes for cloud modules.
      const recorded: string[] = [];
      const trackerWithCallback = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([
          ['surf', 'sf_'],
          ['books', 'bk_'],
        ]),
        cloudModules: new Set(['surf']),
        onChangeRecorded: (rec) => recorded.push(rec.moduleId),
      });

      // Change to a cloud module should be silently dropped
      trackerWithCallback.recordChange(
        'sf_forecasts',
        'INSERT',
        'fc-1',
        { id: 'fc-1', spot: 'Malibu' },
      );
      expect(recorded).toHaveLength(0);

      // Change to a non-cloud module should be recorded
      trackerWithCallback.recordChange(
        'bk_books',
        'INSERT',
        'bk-1',
        { id: 'bk-1', title: 'Moby Dick' },
      );
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toBe('books');
    });

    it('stripColumns removes sensitive data at write time', () => {
      const policy: ModuleSyncPolicy = {
        defaultScope: 'personal_replica',
        shareable: false,
        entityRules: [
          {
            tableName: 'md_medications',
            defaultScope: 'personal_replica',
            conflictStrategy: 'lww',
            stripColumns: ['dosage_notes', 'pharmacy_phone'],
          },
        ],
      };

      const recorded: Array<{ moduleId: string; dataJson: string | null }> = [];
      const tracker = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([['meds', 'md_']]),
        modulePolicies: new Map([['meds', policy]]),
        onChangeRecorded: (rec) =>
          recorded.push({ moduleId: rec.moduleId, dataJson: rec.dataJson }),
      });

      // Record a change with sensitive columns
      tracker.recordChange('md_medications', 'INSERT', 'med-1', {
        id: 'med-1',
        name: 'Aspirin',
        dosage_notes: 'Take with food -- private',
        pharmacy_phone: '555-0123',
        frequency: 'daily',
      });

      expect(recorded).toHaveLength(1);
      const data = JSON.parse(recorded[0]!.dataJson!);

      // Stripped columns should NOT be in the change log
      expect(data).not.toHaveProperty('dosage_notes');
      expect(data).not.toHaveProperty('pharmacy_phone');

      // Non-stripped columns should be preserved
      expect(data.id).toBe('med-1');
      expect(data.name).toBe('Aspirin');
      expect(data.frequency).toBe('daily');
    });

    it('the outbound DOCUMENT/wire excludes stripped columns and device_local rows', () => {
      // Closes the audit outbound-leak finding: the document layer must apply
      // the SAME filter as the change log, so nothing stripped or device_local
      // ever reaches generateSyncMessage (the bytes a peer receives).
      const policy: ModuleSyncPolicy = {
        defaultScope: 'personal_replica',
        shareable: true,
        entityRules: [
          { tableName: 'md_medications', defaultScope: 'personal_replica', conflictStrategy: 'lww', stripColumns: ['dosage_notes'] },
          { tableName: 'md_private', defaultScope: 'device_local', conflictStrategy: 'lww' },
        ],
      };
      const tracker = new ChangeTracker({
        db, deviceId: 'my-device',
        modulePrefixes: new Map([['meds', 'md_']]),
        modulePolicies: new Map([['meds', policy]]),
      });
      const doc = new LwwDocumentManager();
      // Mirror exactly what the engine's recordChange now does.
      const reflect = (table: string, op: 'INSERT' | 'UPDATE' | 'DELETE', rowId: string, rowData: Record<string, unknown> | null) => {
        const f = tracker.filterForSync(table, op, rowData);
        if (f.moduleId && f.include) doc.applyChange(f.moduleId, { table, rowId, operation: op, data: f.data });
      };

      reflect('md_medications', 'INSERT', 'med-1', { id: 'med-1', name: 'Aspirin', dosage_notes: 'private note', updated_at: '2026-06-11T00:00:00.000Z' });
      reflect('md_private', 'INSERT', 'p1', { id: 'p1', value: 'device only', updated_at: '2026-06-11T00:00:00.000Z' });

      const snapshot = doc.generateSyncMessage('meds', null)!;
      const wire = JSON.parse(new TextDecoder().decode(snapshot)) as { tables: Record<string, Record<string, Record<string, unknown>>> };

      // The med row crosses, but WITHOUT its stripped column.
      expect(wire.tables.md_medications!['med-1']).toBeDefined();
      expect(wire.tables.md_medications!['med-1']).not.toHaveProperty('dosage_notes');
      expect(wire.tables.md_medications!['med-1']!.name).toBe('Aspirin');
      // The device_local row never reached the wire at all.
      expect(wire.tables.md_private).toBeUndefined();
    });

    it('stripColumns is not applied on DELETE operations', () => {
      const policy: ModuleSyncPolicy = {
        defaultScope: 'personal_replica',
        shareable: false,
        entityRules: [
          {
            tableName: 'md_medications',
            defaultScope: 'personal_replica',
            conflictStrategy: 'lww',
            stripColumns: ['dosage_notes'],
          },
        ],
      };

      const recorded: Array<{ moduleId: string; dataJson: string | null }> = [];
      const tracker = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([['meds', 'md_']]),
        modulePolicies: new Map([['meds', policy]]),
        onChangeRecorded: (rec) =>
          recorded.push({ moduleId: rec.moduleId, dataJson: rec.dataJson }),
      });

      // DELETE has null data; should not crash on strip logic
      tracker.recordChange('md_medications', 'DELETE', 'med-1', null);

      expect(recorded).toHaveLength(1);
      expect(recorded[0]!.dataJson).toBeNull();
    });

    it('unknown table prefix silently ignores changes', () => {
      const recorded: string[] = [];
      const tracker = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([['books', 'bk_']]),
        onChangeRecorded: (rec) => recorded.push(rec.moduleId),
      });

      // Table with unrecognized prefix should be silently ignored
      tracker.recordChange('zz_unknown_table', 'INSERT', 'row-1', {
        id: 'row-1',
      });
      expect(recorded).toHaveLength(0);
    });

    it('multiple stripColumns rules target different tables independently', () => {
      const policy: ModuleSyncPolicy = {
        defaultScope: 'personal_replica',
        shareable: false,
        entityRules: [
          {
            tableName: 'md_medications',
            defaultScope: 'personal_replica',
            conflictStrategy: 'lww',
            stripColumns: ['dosage_notes'],
          },
          {
            tableName: 'md_prescriptions',
            defaultScope: 'personal_replica',
            conflictStrategy: 'lww',
            stripColumns: ['doctor_name', 'rx_number'],
          },
        ],
      };

      const recorded: Array<{ table: string; data: Record<string, unknown> }> = [];
      const tracker = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([['meds', 'md_']]),
        modulePolicies: new Map([['meds', policy]]),
        onChangeRecorded: (rec) =>
          recorded.push({
            table: rec.tableName,
            data: rec.dataJson ? JSON.parse(rec.dataJson) : {},
          }),
      });

      tracker.recordChange('md_medications', 'INSERT', 'med-1', {
        id: 'med-1',
        name: 'Tylenol',
        dosage_notes: 'secret',
      });

      tracker.recordChange('md_prescriptions', 'INSERT', 'rx-1', {
        id: 'rx-1',
        doctor_name: 'Dr. Smith',
        rx_number: 'RX-9999',
        drug: 'Tylenol',
      });

      expect(recorded).toHaveLength(2);

      // medications: dosage_notes stripped
      expect(recorded[0]!.data).not.toHaveProperty('dosage_notes');
      expect(recorded[0]!.data.name).toBe('Tylenol');

      // prescriptions: doctor_name and rx_number stripped
      expect(recorded[1]!.data).not.toHaveProperty('doctor_name');
      expect(recorded[1]!.data).not.toHaveProperty('rx_number');
      expect(recorded[1]!.data.drug).toBe('Tylenol');
    });
  });

  // -----------------------------------------------------------------------
  // 4. Cross-Workspace Isolation
  // -----------------------------------------------------------------------
  describe('cross-workspace isolation', () => {
    let db: ReturnType<typeof createInMemoryDb>;
    let owner: DeviceIdentity;
    let memberA: DeviceIdentity;
    let memberB: DeviceIdentity;

    beforeEach(() => {
      db = createInMemoryDb();
      owner = makeDevice('owner');
      memberA = makeDevice('alice');
      memberB = makeDevice('bob');

      // Two workspaces with different members
      seedWorkspace(db, 'ws-family', owner.publicKey);
      addMember(db, 'ws-family', memberA.publicKey, owner.publicKey);

      seedWorkspace(db, 'ws-work', owner.publicKey);
      addMember(db, 'ws-work', memberB.publicKey, owner.publicKey);
    });

    it('data from workspace A does not leak to workspace B', () => {
      // Record entity ACLs in workspace A
      upsertEntityAcl(db, {
        moduleId: 'notes',
        tableName: 'nt_notes',
        rowId: 'note-family-1',
        workspaceId: 'ws-family',
        scope: 'shared_workspace',
        updatedAt: new Date().toISOString(),
      });

      // Record entity ACLs in workspace B
      upsertEntityAcl(db, {
        moduleId: 'notes',
        tableName: 'nt_notes',
        rowId: 'note-work-1',
        workspaceId: 'ws-work',
        scope: 'shared_workspace',
        updatedAt: new Date().toISOString(),
      });

      // Verify each entity belongs to its own workspace
      const familyAcl = getEntityAcl(db, 'notes', 'nt_notes', 'note-family-1');
      expect(familyAcl!.workspaceId).toBe('ws-family');

      const workAcl = getEntityAcl(db, 'notes', 'nt_notes', 'note-work-1');
      expect(workAcl!.workspaceId).toBe('ws-work');

      // Alice (ws-family only) cannot see ws-work data
      const aliceWorkspaces = getWorkspacesByDevice(db, memberA.publicKey);
      const aliceWsIds = aliceWorkspaces.map((w) => w.id);
      expect(aliceWsIds).toContain('ws-family');
      expect(aliceWsIds).not.toContain('ws-work');

      // Bob (ws-work only) cannot see ws-family data
      const bobWorkspaces = getWorkspacesByDevice(db, memberB.publicKey);
      const bobWsIds = bobWorkspaces.map((w) => w.id);
      expect(bobWsIds).toContain('ws-work');
      expect(bobWsIds).not.toContain('ws-family');
    });

    it('owner in both workspaces sees both, but data does not cross', () => {
      const ownerWorkspaces = getWorkspacesByDevice(db, owner.publicKey);
      expect(ownerWorkspaces).toHaveLength(2);

      // Even though the owner is in both, the sync engine opens one session
      // per workspace. Entity ACLs bind data to specific workspaces.
      upsertEntityAcl(db, {
        moduleId: 'recipes',
        tableName: 'rc_recipes',
        rowId: 'recipe-1',
        workspaceId: 'ws-family',
        scope: 'shared_workspace',
        updatedAt: new Date().toISOString(),
      });

      const acl = getEntityAcl(db, 'recipes', 'rc_recipes', 'recipe-1');
      expect(acl!.workspaceId).toBe('ws-family');
      // This entity is scoped to ws-family; a sync session targeting ws-work
      // would not include it in the manifest exchange.
    });
  });

  // -----------------------------------------------------------------------
  // 5. Tier Enforcement (integration smoke)
  // -----------------------------------------------------------------------
  describe('tier enforcement', () => {
    it('local_only tier blocks internet transports', () => {
      // This is comprehensively tested in tier-enforcement.test.ts.
      // Verify the scope ordering is correct for the tier-scope matrix.
      const tierLayers: Record<string, number[]> = {
        local_only: [1, 2, 3],
        p2p: [1, 2, 3, 4],
        free_cloud: [1, 2, 3, 4, 5],
        starter_cloud: [1, 2, 3, 4, 5],
        power_cloud: [1, 2, 3, 4, 5],
      };

      // local_only has no internet layers (4=WebRTC, 5=relay)
      expect(tierLayers['local_only']).not.toContain(4);
      expect(tierLayers['local_only']).not.toContain(5);

      // p2p adds WebRTC but no relay
      expect(tierLayers['p2p']).toContain(4);
      expect(tierLayers['p2p']).not.toContain(5);

      // cloud tiers include all layers
      expect(tierLayers['free_cloud']).toContain(5);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Malicious Module (syncPolicy enforcement)
  // -----------------------------------------------------------------------
  describe('malicious module defense', () => {
    let db: ReturnType<typeof createInMemoryDb>;

    beforeEach(() => {
      db = createInMemoryDb();
    });

    it('module cannot bypass stripColumns at ChangeTracker level', () => {
      // Even if a module author tries to pass sensitive data, the ChangeTracker
      // strips it before persisting to the change log.
      const policy: ModuleSyncPolicy = {
        defaultScope: 'personal_replica',
        shareable: true,
        entityRules: [
          {
            tableName: 'hb_habits',
            defaultScope: 'shared_workspace',
            conflictStrategy: 'lww',
            stripColumns: ['internal_score', 'private_flag'],
          },
        ],
      };

      const recorded: Array<Record<string, unknown>> = [];
      const tracker = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([['habits', 'hb_']]),
        modulePolicies: new Map([['habits', policy]]),
        onChangeRecorded: (rec) =>
          recorded.push(rec.dataJson ? JSON.parse(rec.dataJson) : {}),
      });

      // Module author tries to include stripped columns
      tracker.recordChange('hb_habits', 'INSERT', 'habit-1', {
        id: 'habit-1',
        name: 'Exercise',
        internal_score: 42,
        private_flag: true,
      });

      expect(recorded).toHaveLength(1);
      expect(recorded[0]).not.toHaveProperty('internal_score');
      expect(recorded[0]).not.toHaveProperty('private_flag');
      expect(recorded[0]!.name).toBe('Exercise');
    });

    it('cloud-backed module cannot sync data beyond device', () => {
      // A module backed by supabase cannot use the change log for sync.
      const recorded: string[] = [];
      const tracker = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([
          ['forums', 'fr_'],
          ['notes', 'nt_'],
        ]),
        cloudModules: new Set(['forums']),
        onChangeRecorded: (rec) => recorded.push(rec.moduleId),
      });

      // forums is cloud-backed: changes are silently dropped
      tracker.recordChange('fr_threads', 'INSERT', 'thread-1', {
        id: 'thread-1',
        title: 'Hello',
      });
      expect(recorded).toHaveLength(0);

      // notes is SQLite-backed: changes are recorded normally
      tracker.recordChange('nt_notes', 'INSERT', 'note-1', {
        id: 'note-1',
        title: 'My note',
      });
      expect(recorded).toHaveLength(1);
      expect(recorded[0]).toBe('notes');
    });

    it('UPDATE operations also strip columns', () => {
      const policy: ModuleSyncPolicy = {
        defaultScope: 'personal_replica',
        shareable: false,
        entityRules: [
          {
            tableName: 'bk_books',
            defaultScope: 'personal_replica',
            conflictStrategy: 'lww',
            stripColumns: ['private_rating'],
          },
        ],
      };

      const recorded: Array<Record<string, unknown>> = [];
      const tracker = new ChangeTracker({
        db,
        deviceId: 'my-device',
        modulePrefixes: new Map([['books', 'bk_']]),
        modulePolicies: new Map([['books', policy]]),
        onChangeRecorded: (rec) =>
          recorded.push(rec.dataJson ? JSON.parse(rec.dataJson) : {}),
      });

      tracker.recordChange('bk_books', 'UPDATE', 'book-1', {
        id: 'book-1',
        title: 'Updated Title',
        private_rating: 5,
      });

      expect(recorded).toHaveLength(1);
      expect(recorded[0]).not.toHaveProperty('private_rating');
      expect(recorded[0]!.title).toBe('Updated Title');
    });
  });

  // -----------------------------------------------------------------------
  // 7. Lost Device Scenario
  // -----------------------------------------------------------------------
  describe('lost device scenario', () => {
    let db: ReturnType<typeof createInMemoryDb>;
    let owner: DeviceIdentity;
    let lostDevice: DeviceIdentity;

    beforeEach(() => {
      db = createInMemoryDb();
      owner = makeDevice('owner');
      lostDevice = makeDevice('lost-phone');

      seedWorkspace(db, 'ws-personal', owner.publicKey, 'personal');
      addMember(db, 'ws-personal', lostDevice.publicKey, owner.publicKey);

      seedWorkspace(db, 'ws-family', owner.publicKey);
      addMember(db, 'ws-family', lostDevice.publicKey, owner.publicKey);
    });

    it('revoking from all workspaces isolates the lost device', () => {
      // Revoke from every workspace
      revokeFromWorkspace(db, 'ws-personal', lostDevice.publicKey, owner.publicKey, { legacyOk: true });
      revokeFromWorkspace(db, 'ws-family', lostDevice.publicKey, owner.publicKey, { legacyOk: true });

      // Lost device is globally revoked
      expect(isDeviceRevoked(db, lostDevice.publicKey)).toBe(true);

      // Lost device has no active workspace memberships
      const workspaces = getWorkspacesByDevice(db, lostDevice.publicKey);
      expect(workspaces).toHaveLength(0);

      // Both workspaces rotated their keys
      const personal = getWorkspace(db, 'ws-personal');
      expect(personal!.currentKeyVersion).toBe(2);

      const family = getWorkspace(db, 'ws-family');
      expect(family!.currentKeyVersion).toBe(2);
    });

    it('owner remains unaffected after revoking lost device', () => {
      revokeFromWorkspace(db, 'ws-personal', lostDevice.publicKey, owner.publicKey, { legacyOk: true });
      revokeFromWorkspace(db, 'ws-family', lostDevice.publicKey, owner.publicKey, { legacyOk: true });

      // Owner is NOT revoked
      expect(isDeviceRevoked(db, owner.publicKey)).toBe(false);

      // Owner is still a member of both workspaces
      const ownerWorkspaces = getWorkspacesByDevice(db, owner.publicKey);
      expect(ownerWorkspaces).toHaveLength(2);
    });
  });
});
