/**
 * MK-004 -- plain-JSON last-write-wins document manager + the native sync data
 * path. Proves two devices converge through generate -> receive without
 * Automerge, and that a change flows generate -> receive -> apply (MK-002) into
 * a peer's database on the native profile.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import type { DatabaseAdapter } from '@mylife/db';
import type { ModuleSyncPolicy } from '@mylife/module-registry/types';
import { LwwDocumentManager } from '../crdt/lww-document-manager';
import { ChangeTracker } from '../crdt/change-tracker';
import { applyReceivedDocumentChanges, type SyncSessionOptions } from '../protocol/sync-session';

function note(rowId: string, title: string, updatedAt: string) {
  return { id: rowId, title, updated_at: updatedAt };
}

describe('LwwDocumentManager (MK-004)', () => {
  let mgr: LwwDocumentManager;
  beforeEach(() => { mgr = new LwwDocumentManager(); });

  it('lazily creates an empty document and tracks active modules', () => {
    expect(mgr.getActiveModules()).toEqual([]);
    const doc = mgr.getDocument('notes');
    expect(doc.tables).toEqual({});
    expect(mgr.getActiveModules()).toEqual(['notes']);
  });

  it('applyChange inserts and deletes rows', () => {
    mgr.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'hi', '2026-06-11T00:00:00.000Z') });
    expect(mgr.getDocument('notes').tables.nt_notes!.n1).toMatchObject({ title: 'hi' });
    mgr.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'DELETE', data: { updated_at: '2026-06-11T01:00:00.000Z' } });
    expect(mgr.getDocument('notes').tables.nt_notes!.n1).toBeUndefined();
  });

  it('generateSyncMessage returns null when empty and a snapshot when populated', () => {
    expect(mgr.generateSyncMessage('notes', null)).toBeNull();
    mgr.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'hi', '2026-06-11T00:00:00.000Z') });
    expect(mgr.generateSyncMessage('notes', null)).toBeInstanceOf(Uint8Array);
  });

  it('receiveSyncMessage merges new rows and reports them as INSERTs', () => {
    const a = new LwwDocumentManager();
    a.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'from-a', '2026-06-11T00:00:00.000Z') });
    const msg = a.generateSyncMessage('notes', null)!;

    const b = new LwwDocumentManager();
    const changes = b.receiveSyncMessage('notes', msg);
    expect(changes).toEqual([{ table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'from-a', '2026-06-11T00:00:00.000Z') }]);
    expect(b.getDocument('notes').tables.nt_notes!.n1).toMatchObject({ title: 'from-a' });
  });

  it('resolves conflicts last-write-wins by updated_at', () => {
    const b = new LwwDocumentManager();
    b.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'local-new', '2026-06-11T12:00:00.000Z') });

    // An OLDER incoming row is ignored.
    const older = new LwwDocumentManager();
    older.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'remote-old', '2026-06-11T06:00:00.000Z') });
    expect(b.receiveSyncMessage('notes', older.generateSyncMessage('notes', null)!)).toEqual([]);
    expect(b.getDocument('notes').tables.nt_notes!.n1!.title).toBe('local-new');

    // A NEWER incoming row wins.
    const newer = new LwwDocumentManager();
    newer.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'remote-new', '2026-06-11T18:00:00.000Z') });
    const changes = b.receiveSyncMessage('notes', newer.generateSyncMessage('notes', null)!);
    expect(changes).toHaveLength(1);
    expect(changes[0]!.operation).toBe('UPDATE');
    expect(b.getDocument('notes').tables.nt_notes!.n1!.title).toBe('remote-new');
  });

  it('two managers converge after a bidirectional exchange', () => {
    const a = new LwwDocumentManager();
    const b = new LwwDocumentManager();
    a.applyChange('notes', { table: 'nt_notes', rowId: 'a1', operation: 'INSERT', data: note('a1', 'a', '2026-06-11T00:00:00.000Z') });
    b.applyChange('notes', { table: 'nt_notes', rowId: 'b1', operation: 'INSERT', data: note('b1', 'b', '2026-06-11T00:00:00.000Z') });

    b.receiveSyncMessage('notes', a.generateSyncMessage('notes', null)!);
    a.receiveSyncMessage('notes', b.generateSyncMessage('notes', null)!);

    expect(Object.keys(a.getDocument('notes').tables.nt_notes!).sort()).toEqual(['a1', 'b1']);
    expect(Object.keys(b.getDocument('notes').tables.nt_notes!).sort()).toEqual(['a1', 'b1']);
  });

  it('save/load round-trips a document snapshot', () => {
    mgr.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'hi', '2026-06-11T00:00:00.000Z') });
    const snapshot = mgr.save('notes');
    const restored = new LwwDocumentManager();
    restored.load('notes', snapshot);
    expect(restored.getDocument('notes').tables.nt_notes!.n1).toMatchObject({ title: 'hi' });
  });
});

// ---------------------------------------------------------------------------
// Delete propagation + resurrection (closes the 2026-06-12 audit finding)
// ---------------------------------------------------------------------------

describe('LwwDocumentManager delete propagation', () => {
  const ins = (rowId: string, t: string, at: string) =>
    ({ table: 'nt_notes', rowId, operation: 'INSERT' as const, data: note(rowId, t, at) });
  const del = (rowId: string, at?: string) =>
    ({ table: 'nt_notes', rowId, operation: 'DELETE' as const, data: at ? { updated_at: at } : null });

  it('a delete on A propagates to B as a DELETE change', () => {
    const a = new LwwDocumentManager();
    const b = new LwwDocumentManager();
    a.applyChange('notes', ins('n1', 'hello', '2026-06-11T00:00:00.000Z'));
    b.receiveSyncMessage('notes', a.generateSyncMessage('notes', null)!);
    expect(b.getDocument('notes').tables.nt_notes!.n1).toBeDefined();

    a.applyChange('notes', del('n1', '2026-06-11T01:00:00.000Z'));
    const changes = b.receiveSyncMessage('notes', a.generateSyncMessage('notes', null)!);
    expect(changes).toEqual([{ table: 'nt_notes', rowId: 'n1', operation: 'DELETE', data: { updated_at: '2026-06-11T01:00:00.000Z' } }]);
    expect(b.getDocument('notes').tables.nt_notes!.n1).toBeUndefined();
  });

  it('a deleted row does NOT resurrect when B back-syncs its stale copy to A', () => {
    // The exact audit sequence: A deletes, then A receives B's older snapshot.
    const a = new LwwDocumentManager();
    const b = new LwwDocumentManager();
    a.applyChange('notes', ins('n1', 'hello', '2026-06-11T00:00:00.000Z'));
    b.receiveSyncMessage('notes', a.generateSyncMessage('notes', null)!); // B has n1

    a.applyChange('notes', del('n1', '2026-06-11T01:00:00.000Z')); // A deletes n1
    // B still holds its stale n1 and syncs it back to A.
    const backToA = a.receiveSyncMessage('notes', b.generateSyncMessage('notes', null)!);
    expect(backToA).toEqual([]); // no resurrection
    expect(a.getDocument('notes').tables.nt_notes!.n1).toBeUndefined();
  });

  it('an update strictly newer than a delete resurrects the row', () => {
    const a = new LwwDocumentManager();
    a.applyChange('notes', ins('n1', 'v1', '2026-06-11T00:00:00.000Z'));
    a.applyChange('notes', del('n1', '2026-06-11T01:00:00.000Z'));

    // A peer edited the row AFTER the delete time.
    const b = new LwwDocumentManager();
    b.applyChange('notes', ins('n1', 'v2-after-delete', '2026-06-11T02:00:00.000Z'));
    const changes = a.receiveSyncMessage('notes', b.generateSyncMessage('notes', null)!);
    expect(changes).toEqual([{ table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'v2-after-delete', '2026-06-11T02:00:00.000Z') }]);
    expect(a.getDocument('notes').tables.nt_notes!.n1!.title).toBe('v2-after-delete');
  });

  it('two devices converge on the delete after a full bidirectional round', () => {
    const a = new LwwDocumentManager();
    const b = new LwwDocumentManager();
    a.applyChange('notes', ins('n1', 'shared', '2026-06-11T00:00:00.000Z'));
    b.receiveSyncMessage('notes', a.generateSyncMessage('notes', null)!);

    a.applyChange('notes', del('n1', '2026-06-11T01:00:00.000Z'));
    // exchange both directions
    b.receiveSyncMessage('notes', a.generateSyncMessage('notes', null)!);
    a.receiveSyncMessage('notes', b.generateSyncMessage('notes', null)!);

    expect(a.getDocument('notes').tables.nt_notes!.n1).toBeUndefined();
    expect(b.getDocument('notes').tables.nt_notes!.n1).toBeUndefined();
    // The tombstone persists across save/load so a later peer cannot resurrect it.
    const reloaded = new LwwDocumentManager();
    reloaded.load('notes', b.save('notes'));
    const late = new LwwDocumentManager();
    late.applyChange('notes', ins('n1', 'stale-from-cold-peer', '2026-06-11T00:30:00.000Z'));
    expect(reloaded.receiveSyncMessage('notes', late.generateSyncMessage('notes', null)!)).toEqual([]);
  });
});

describe('native bundle is Automerge-free (MK-004)', () => {
  it('document-manager.native.ts and lww-document-manager.ts never import @automerge', () => {
    const nativeSrc = readFileSync(new URL('../crdt/document-manager.native.ts', import.meta.url), 'utf8');
    const lwwSrc = readFileSync(new URL('../crdt/lww-document-manager.ts', import.meta.url), 'utf8');
    // Guard against a real import/require of Automerge (not mentions in comments).
    expect(nativeSrc).not.toMatch(/from\s*['"]@automerge/);
    expect(nativeSrc).not.toMatch(/require\(\s*['"]@automerge/);
    expect(lwwSrc).not.toMatch(/from\s*['"]@automerge/);
    expect(lwwSrc).not.toMatch(/require\(\s*['"]@automerge/);
    // The native manager resolves to the LWW implementation.
    expect(nativeSrc).toMatch(/LwwDocumentManager as DocumentManager/);
  });
});

// ---------------------------------------------------------------------------
// Native sync data path: generate -> receive -> apply (with MK-002 enforcement)
// ---------------------------------------------------------------------------

interface Row { [k: string]: unknown }
function createInMemoryDb(): DatabaseAdapter & { rows(t: string): Row[] } {
  const tables = new Map<string, Row[]>();
  const ensure = (t: string) => { if (!tables.has(t)) tables.set(t, []); return tables.get(t)!; };
  const tableOf = (sql: string) =>
    (sql.match(/INSERT\s+(?:OR\s+\w+\s+)?INTO\s+(\w+)/i)
      ?? sql.match(/DELETE\s+FROM\s+(\w+)/i)
      ?? sql.match(/UPDATE\s+(\w+)/i)
      ?? sql.match(/FROM\s+(\w+)/i))?.[1] ?? null;
  const preds = (sql: string, params: unknown[]): Array<[string, unknown]> => {
    const out: Array<[string, unknown]> = [];
    const w = sql.match(/WHERE\s+(.+?)(?:\s+ORDER|\s+LIMIT|\s*$)/i);
    if (!w) return out;
    let i = 0;
    for (const c of w[1]!.split(/\s+AND\s+/i)) {
      const eq = c.match(/(\w+)\s*=\s*\?/);
      if (eq) { out.push([eq[1]!, params[i] ?? null]); i++; continue; }
      const n = c.match(/(\w+)\s+IS\s+NULL/i);
      if (n) out.push([n[1]!, null]);
    }
    return out;
  };
  return {
    rows: ensure,
    execute(sql: string, params: unknown[] = []) {
      const t = tableOf(sql); if (!t) return;
      if (/^\s*INSERT/i.test(sql)) {
        const cols = sql.match(/\(([^)]+)\)\s*VALUES/i)?.[1]?.split(',').map((c) => c.trim()) ?? [];
        const row: Row = {}; cols.forEach((c, idx) => { row[c] = params[idx] ?? null; }); ensure(t).push(row);
      } else if (/^\s*DELETE/i.test(sql)) {
        const p = preds(sql, params); tables.set(t, ensure(t).filter((r) => !p.every(([c, v]) => r[c] === v)));
      }
    },
    query<T>(sql: string, params: unknown[] = []): T[] {
      const t = tableOf(sql); if (!t) return [] as T[];
      const p = preds(sql, params);
      return ensure(t).filter((r) => p.every(([c, v]) => r[c] === v)).map((r) => ({ ...r }) as T);
    },
    transaction(fn: () => void) { fn(); },
  } as DatabaseAdapter & { rows(t: string): Row[] };
}

const NOTES_POLICY: ModuleSyncPolicy = {
  defaultScope: 'personal_replica',
  shareable: true,
  entityRules: [{ tableName: 'nt_notes', defaultScope: 'personal_replica', conflictStrategy: 'lww' }],
};

describe('native sync data path (MK-004 + MK-002)', () => {
  it('a note seeded on device A flows to device B database via LWW snapshot + enforced apply', () => {
    const PEER = 'device_a';
    const policies = new Map([['notes', NOTES_POLICY]]);
    const prefixes = new Map([['notes', 'nt_']]);

    // Device A authors a note in its LWW document.
    const docA = new LwwDocumentManager();
    docA.applyChange('notes', { table: 'nt_notes', rowId: 'n1', operation: 'INSERT', data: note('n1', 'hello from A', '2026-06-11T00:00:00.000Z') });

    // Device B receives A's snapshot and computes the changes to apply.
    const docB = new LwwDocumentManager();
    const changes = docB.receiveSyncMessage('notes', docA.generateSyncMessage('notes', null)!);
    expect(changes).toHaveLength(1);

    // Device B applies those changes through the MK-002 enforced apply path.
    const db = createInMemoryDb();
    const options = {
      db,
      identity: { publicKey: 'device_b' },
      pairedDevices: [{ deviceId: PEER }],
      changeTracker: new ChangeTracker({ db, deviceId: 'device_b', modulePrefixes: prefixes, modulePolicies: policies }),
      enabledModules: ['notes'],
      modulePolicies: policies,
      transport: 'lan_wifi',
      documentManager: undefined,
    } as unknown as SyncSessionOptions;

    const applied = applyReceivedDocumentChanges(options, 'notes', changes, { remoteDeviceId: PEER, sessionId: 's1' });

    expect(applied).toBe(1);
    expect(db.rows('nt_notes')).toHaveLength(1);
    expect(db.rows('nt_notes')[0]).toMatchObject({ id: 'n1', title: 'hello from A' });
  });
});
