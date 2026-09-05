/**
 * MK-002 inbound policy enforcement -- DB-backed integration of
 * applyReceivedDocumentChanges. Proves that a malicious-but-paired peer's
 * out-of-scope / foreign-module / tombstoned / unauthorized writes are
 * rejected AND audited, while a legitimate write is applied.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import type { SyncSessionOptions } from '../protocol/sync-session';
import { applyReceivedDocumentChanges } from '../protocol/sync-session';
import { ChangeTracker } from '../crdt/change-tracker';
import {
  createWorkspace,
  addWorkspaceMember,
  insertRevocation,
  insertTombstone,
  getTombstone,
  getInboundAudit,
  recordSasVerification,
} from '../db/queries';

// ---------------------------------------------------------------------------
// In-memory DatabaseAdapter (supports INSERT, SELECT, DELETE with simple WHERE)
// ---------------------------------------------------------------------------

interface Row { [k: string]: unknown }

function createInMemoryDb(): DatabaseAdapter & { rows(table: string): Row[] } {
  const tables = new Map<string, Row[]>();
  const ensure = (t: string): Row[] => {
    if (!tables.has(t)) tables.set(t, []);
    return tables.get(t)!;
  };
  const tableOf = (sql: string): string | null => {
    const m =
      sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i)
      ?? sql.match(/DELETE\s+FROM\s+(\w+)/i)
      ?? sql.match(/UPDATE\s+(\w+)/i)
      ?? sql.match(/FROM\s+(\w+)/i);
    return m?.[1] ?? null;
  };
  // Parse "WHERE a = ? AND b IS NULL" into predicates bound to params in order.
  const wherePreds = (sql: string, params: unknown[]): Array<[string, unknown]> => {
    const preds: Array<[string, unknown]> = [];
    const w = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
    if (!w) return preds;
    let i = 0;
    for (const cond of w[1]!.split(/\s+AND\s+/i)) {
      const eq = cond.match(/(\w+)\s*=\s*\?/);
      if (eq) { preds.push([eq[1]!, params[i] ?? null]); i++; continue; }
      const isNull = cond.match(/(\w+)\s+IS\s+NULL/i);
      if (isNull) preds.push([isNull[1]!, null]);
    }
    return preds;
  };

  return {
    rows: ensure,
    execute(sql: string, params: unknown[] = []) {
      const t = tableOf(sql);
      if (!t) return;
      if (/^\s*INSERT/i.test(sql)) {
        const cols = sql.match(/\(([^)]+)\)\s*VALUES/i)?.[1]?.split(',').map((c) => c.trim()) ?? [];
        const row: Row = {};
        cols.forEach((c, idx) => { row[c] = params[idx] ?? null; });
        ensure(t).push(row);
        return;
      }
      if (/^\s*DELETE/i.test(sql)) {
        const preds = wherePreds(sql, params);
        const kept = ensure(t).filter((r) => !preds.every(([c, v]) => r[c] === v));
        tables.set(t, kept);
      }
    },
    query<T>(sql: string, params: unknown[] = []): T[] {
      const t = tableOf(sql);
      if (!t) return [] as T[];
      const preds = wherePreds(sql, params);
      return ensure(t)
        .filter((r) => preds.every(([c, v]) => r[c] === v))
        .map((r) => ({ ...r }) as T);
    },
    transaction(fn: () => void) { fn(); },
  } as DatabaseAdapter & { rows(table: string): Row[] };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const PREFIXES = new Map<string, string>([['notes', 'nt_'], ['sports', 'sp_'], ['health', 'hl_']]);

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};
// Non-shareable, capped at personal_replica -- must never accept a workspace push.
const SPORTS_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: false,
  entityRules: [{ tableName: 'sp_bets', defaultScope: 'personal_replica', maxScope: 'personal_replica', conflictStrategy: 'lww' }],
};
// Sensitive AND shareable to shared_workspace -- gated behind SAS (MK-017).
const HEALTH_POLICY: ModuleSyncPolicy = {
  defaultScope: 'shared_workspace',
  shareable: true,
  isSensitive: true,
  entityRules: [{ tableName: 'hl_vitals', defaultScope: 'shared_workspace', maxScope: 'shared_workspace', conflictStrategy: 'lww' }],
};

const POLICIES = new Map<string, ModuleSyncPolicy>([
  ['notes', NOTES_POLICY], ['sports', SPORTS_POLICY], ['health', HEALTH_POLICY],
]);

const PEER = 'peer_pub_key';
const LOCAL = 'local_pub_key';

function makeOptions(
  db: DatabaseAdapter,
  opts: { workspaceId?: string; pairedDeviceIds?: string[]; enabledModules?: string[]; nowMs?: number },
): SyncSessionOptions {
  const changeTracker = new ChangeTracker({
    db,
    deviceId: LOCAL,
    modulePrefixes: PREFIXES,
    modulePolicies: POLICIES,
  });
  return {
    db,
    identity: { publicKey: LOCAL },
    pairedDevices: (opts.pairedDeviceIds ?? []).map((id) => ({ deviceId: id })),
    changeTracker,
    enabledModules: opts.enabledModules ?? ['notes', 'sports'],
    modulePolicies: POLICIES,
    transport: 'lan_wifi',
    workspaceId: opts.workspaceId,
    documentManager: undefined,
    inboundNowMs: opts.nowMs === undefined ? undefined : () => opts.nowMs!,
  } as unknown as SyncSessionOptions;
}

const ctx = { remoteDeviceId: PEER, sessionId: 'sess-1' };

function note(rowId: string, updatedAt: string) {
  return { table: 'nt_notes', rowId, operation: 'INSERT', data: { id: rowId, title: 'hi', updated_at: updatedAt } };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('applyReceivedDocumentChanges (MK-002 inbound enforcement)', () => {
  let db: ReturnType<typeof createInMemoryDb>;
  beforeEach(() => { db = createInMemoryDb(); });

  it('applies a legitimate change from a paired device with no audit rejection', () => {
    const options = makeOptions(db, { pairedDeviceIds: [PEER] });
    const applied = applyReceivedDocumentChanges(options, 'notes', [note('n1', '2026-06-11T00:00:00.000Z')], ctx);

    expect(applied).toBe(1);
    expect(db.rows('nt_notes')).toHaveLength(1);
    expect(getInboundAudit(db, { outcome: 'rejected' })).toHaveLength(0);
  });

  it('rejects malformed and far-future LWW timestamps before they can pin a row', () => {
    const nowMs = Date.parse('2026-08-24T12:00:00.000Z');
    const options = makeOptions(db, { pairedDeviceIds: [PEER], nowMs });
    const malformed = note('bad-format', 'invalid-1');
    const farFuture = note('far-future', '9999-12-31T23:59:59.999Z');

    const applied = applyReceivedDocumentChanges(options, 'notes', [malformed, farFuture], ctx);

    expect(applied).toBe(0);
    expect(db.rows('nt_notes')).toHaveLength(0);
    expect(getInboundAudit(db, { outcome: 'rejected' }).map((row) => row.reason))
      .toEqual(['invalid_timestamp', 'invalid_timestamp']);
  });

  it('accepts the UTC timestamp format emitted by SQLite datetime()', () => {
    const nowMs = Date.parse('2026-08-24T12:00:00.000Z');
    const options = makeOptions(db, { pairedDeviceIds: [PEER], nowMs });

    const applied = applyReceivedDocumentChanges(
      options,
      'notes',
      [note('sqlite-time', '2026-08-24 11:59:00')],
      ctx,
    );

    expect(applied).toBe(1);
  });

  it('does not let an existing poisoned local timestamp block a valid repair', () => {
    db.execute(
      'INSERT INTO nt_notes (id, title, updated_at) VALUES (?, ?, ?)',
      ['n1', 'poisoned', '9999-12-31T23:59:59.999Z'],
    );
    const nowMs = Date.parse('2026-08-24T12:00:00.000Z');
    const options = makeOptions(db, { pairedDeviceIds: [PEER], nowMs });

    const applied = applyReceivedDocumentChanges(
      options,
      'notes',
      [note('n1', '2026-08-24T11:59:00.000Z')],
      ctx,
    );

    expect(applied).toBe(1);
    expect(db.rows('nt_notes').at(-1)).toMatchObject({ title: 'hi' });
  });

  it('rejects and audits every change from a revoked peer', () => {
    insertRevocation(db, { deviceId: PEER, revokedByDeviceId: LOCAL, reason: 'lost', revokedAt: '2026-06-11T00:00:00.000Z' });
    const options = makeOptions(db, { pairedDeviceIds: [PEER] });

    const applied = applyReceivedDocumentChanges(options, 'notes', [note('n1', '2026-06-11T00:00:00.000Z')], ctx);

    expect(applied).toBe(0);
    expect(db.rows('nt_notes')).toHaveLength(0);
    const audit = getInboundAudit(db, { peerDeviceId: PEER, outcome: 'rejected' });
    expect(audit).toHaveLength(1);
    expect(audit[0]!.reason).toBe('peer_revoked');
  });

  it('rejects and audits a peer that is neither paired nor a member', () => {
    const options = makeOptions(db, { pairedDeviceIds: [] }); // PEER not paired
    const applied = applyReceivedDocumentChanges(options, 'notes', [note('n1', '2026-06-11T00:00:00.000Z')], ctx);

    expect(applied).toBe(0);
    const audit = getInboundAudit(db, { outcome: 'rejected' });
    expect(audit[0]!.reason).toBe('peer_not_authorized');
  });

  it('rejects and audits a foreign-module smuggle (table belongs to another module)', () => {
    const options = makeOptions(db, { pairedDeviceIds: [PEER] });
    // Batch claims "notes" but the table resolves to "sports".
    const change = { table: 'sp_bets', rowId: 'b1', operation: 'INSERT', data: { id: 'b1', updated_at: '2026-06-11T00:00:00.000Z' } };
    const applied = applyReceivedDocumentChanges(options, 'notes', [change], ctx);

    expect(applied).toBe(0);
    expect(db.rows('sp_bets')).toHaveLength(0);
    expect(getInboundAudit(db, { outcome: 'rejected' })[0]!.reason).toBe('module_mismatch');
  });

  it('rejects and audits a shared-workspace push for a module capped at personal_replica', () => {
    createWorkspace(db, {
      id: 'ws1', displayName: 'Fam', workspaceType: 'group', createdByDeviceId: LOCAL,
      createdAt: '2026-06-11T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 1, archivedAt: null,
    });
    addWorkspaceMember(db, { workspaceId: 'ws1', deviceId: PEER, role: 'member', invitedByDeviceId: LOCAL, invitedAt: '2026-06-11T00:00:00.000Z', removedAt: null });
    const options = makeOptions(db, { workspaceId: 'ws1' });

    const change = { table: 'sp_bets', rowId: 'b1', operation: 'INSERT', data: { id: 'b1', updated_at: '2026-06-11T00:00:00.000Z' } };
    const applied = applyReceivedDocumentChanges(options, 'sports', [change], ctx);

    expect(applied).toBe(0);
    expect(db.rows('sp_bets')).toHaveLength(0);
    expect(getInboundAudit(db, { outcome: 'rejected' })[0]!.reason).toBe('scope_exceeds_cap');
  });

  it('rejects and audits resurrecting a tombstoned row with an older write', () => {
    insertTombstone(db, { moduleId: 'notes', tableName: 'nt_notes', rowId: 'n1', deletedByDeviceId: PEER, deletedAt: '2026-06-11T12:00:00.000Z' });
    const options = makeOptions(db, { pairedDeviceIds: [PEER] });

    const applied = applyReceivedDocumentChanges(options, 'notes', [note('n1', '2026-06-11T00:00:00.000Z')], ctx);

    expect(applied).toBe(0);
    expect(db.rows('nt_notes')).toHaveLength(0);
    expect(getInboundAudit(db, { outcome: 'rejected' })[0]!.reason).toBe('tombstoned');
  });

  it('writes a tombstone when a DELETE is applied', () => {
    const options = makeOptions(db, { pairedDeviceIds: [PEER] });
    const del = { table: 'nt_notes', rowId: 'n1', operation: 'DELETE', data: null };

    const applied = applyReceivedDocumentChanges(options, 'notes', [del], ctx);

    expect(applied).toBe(1);
    expect(getTombstone(db, 'notes', 'nt_notes', 'n1')).not.toBeNull();
  });

  it('mixed batch: applies the valid change, rejects+audits the invalid one', () => {
    const options = makeOptions(db, { pairedDeviceIds: [PEER] });
    const valid = note('good', '2026-06-11T00:00:00.000Z');
    const foreign = { table: 'sp_bets', rowId: 'bad', operation: 'INSERT', data: { id: 'bad', updated_at: '2026-06-11T00:00:00.000Z' } };

    const applied = applyReceivedDocumentChanges(options, 'notes', [valid, foreign], ctx);

    expect(applied).toBe(1);
    expect(db.rows('nt_notes')).toHaveLength(1);
    expect(getInboundAudit(db, { outcome: 'rejected' })).toHaveLength(1);
  });

  // --- SAS gate (MK-017) ----------------------------------------------------

  function setupHealthWorkspace() {
    createWorkspace(db, {
      id: 'ws1', displayName: 'Fam', workspaceType: 'group', createdByDeviceId: LOCAL,
      createdAt: '2026-06-11T00:00:00.000Z', rotatedAt: null, currentKeyVersion: 1, archivedAt: null,
    });
    addWorkspaceMember(db, { workspaceId: 'ws1', deviceId: PEER, role: 'member', invitedByDeviceId: LOCAL, invitedAt: '2026-06-11T00:00:00.000Z', removedAt: null });
    return makeOptions(db, { workspaceId: 'ws1', enabledModules: ['health'] });
  }
  const vital = { table: 'hl_vitals', rowId: 'v1', operation: 'INSERT', data: { id: 'v1', updated_at: '2026-06-11T00:00:00.000Z' } };

  it('rejects+audits a sensitive module pushed into a workspace by an un-SAS-verified member', () => {
    const options = setupHealthWorkspace();
    const applied = applyReceivedDocumentChanges(options, 'health', [vital], ctx);

    expect(applied).toBe(0);
    expect(db.rows('hl_vitals')).toHaveLength(0);
    expect(getInboundAudit(db, { outcome: 'rejected' })[0]!.reason).toBe('sas_unverified');
  });

  it('applies the same change once the peer pairing is SAS-verified (global, not per-workspace)', () => {
    const options = setupHealthWorkspace();
    // SAS verification is a global property of the pairing (the 5 emoji derive
    // from the pairwise secret), recorded at the canonical workspaceId ''.
    recordSasVerification(db, { peerDeviceId: PEER, sasIndices: '1-2-3-4-5' });

    const applied = applyReceivedDocumentChanges(options, 'health', [vital], ctx);

    expect(applied).toBe(1);
    expect(db.rows('hl_vitals')).toHaveLength(1);
    expect(getInboundAudit(db, { outcome: 'rejected' })).toHaveLength(0);
  });
});
