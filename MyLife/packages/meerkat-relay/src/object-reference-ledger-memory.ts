/**
 * Reference in-memory ObjectReferenceLedger, a pure state machine over a serializable
 * ledger so the file adapter (object-reference-ledger-file.ts) can reuse the exact
 * refcount logic under an exclusive lock and atomic ledger rename, exactly as
 * ObjectStoreStateMachine backs FileObjectStore.
 *
 * Invariants the machine enforces (not the caller):
 *  - a reference is a (objectKey, referrer) edge; the same edge added twice is one
 *    reference, so a metadata replay never double-counts;
 *  - removing an absent edge is an idempotent no-op success, so a delete replay never
 *    under-counts a still-live key;
 *  - a key with >=1 referrer is `referenced`; a key that has dropped to zero referrers
 *    is retained in the unreferenced index with the instant it dropped, so the sweep
 *    can grace-window it, and is pruned from that index only when a reference returns.
 */

import {
  assertReferenceKey,
  assertReferrerId,
  assertUnreferencedLimit,
  type AddReferenceResult,
  type ObjectReference,
  type ObjectReferenceLedger,
  type RemoveReferenceResult,
  type UnreferencedCursor,
  type UnreferencedObject,
  type UnreferencedPage,
} from './object-reference-ledger';

/** The per-key state: its live referrers and, when empty, when it went empty. */
interface ReferenceRecord {
  objectKey: string;
  referrers: Set<string>;
  /** ISO instant the key last dropped to zero referrers; null while referenced. */
  unreferencedAt: string | null;
}

export interface ObjectReferenceLedgerSnapshot {
  version: 1;
  /** key -> its sorted referrer list plus the instant it last went to zero (or null). */
  records: Record<string, {
    objectKey: string;
    referrers: string[];
    unreferencedAt: string | null;
  }>;
}

export function emptyObjectReferenceLedger(): ObjectReferenceLedgerSnapshot {
  return { version: 1, records: {} };
}

/** Pure reference-accounting state machine. */
export class ObjectReferenceLedgerStateMachine implements ObjectReferenceLedger {
  private readonly records = new Map<string, ReferenceRecord>();

  constructor(
    snapshot: ObjectReferenceLedgerSnapshot = emptyObjectReferenceLedger(),
    private readonly now: () => number = () => Date.now(),
  ) {
    for (const record of Object.values(snapshot.records)) {
      this.records.set(record.objectKey, {
        objectKey: record.objectKey,
        referrers: new Set(record.referrers),
        unreferencedAt: record.referrers.length === 0 ? record.unreferencedAt : null,
      });
    }
  }

  /** A JSON-durable snapshot. Referrers are emitted sorted for stable serialization. */
  snapshot(): ObjectReferenceLedgerSnapshot {
    const records: ObjectReferenceLedgerSnapshot['records'] = {};
    for (const [key, record] of this.records) {
      records[key] = {
        objectKey: record.objectKey,
        referrers: [...record.referrers].sort(),
        unreferencedAt: record.referrers.size === 0 ? record.unreferencedAt : null,
      };
    }
    return { version: 1, records };
  }

  private iso(): string {
    return new Date(this.now()).toISOString();
  }

  async addReference(reference: ObjectReference): Promise<AddReferenceResult> {
    assertReferenceKey('object key', reference.objectKey);
    assertReferrerId('referrer', reference.referrer);
    const record = this.records.get(reference.objectKey) ?? {
      objectKey: reference.objectKey,
      referrers: new Set<string>(),
      unreferencedAt: null,
    };
    this.records.set(reference.objectKey, record);
    if (record.referrers.has(reference.referrer)) {
      return { status: 'already_referenced', referenceCount: record.referrers.size };
    }
    record.referrers.add(reference.referrer);
    // A returning reference clears the unreferenced marker so the key leaves the sweep set.
    record.unreferencedAt = null;
    return { status: 'added', referenceCount: record.referrers.size };
  }

  async removeReference(reference: ObjectReference): Promise<RemoveReferenceResult> {
    assertReferenceKey('object key', reference.objectKey);
    assertReferrerId('referrer', reference.referrer);
    const record = this.records.get(reference.objectKey);
    if (!record || !record.referrers.has(reference.referrer)) {
      return { status: 'not_referenced', referenceCount: record?.referrers.size ?? 0 };
    }
    record.referrers.delete(reference.referrer);
    if (record.referrers.size === 0) record.unreferencedAt = this.iso();
    return { status: 'removed', referenceCount: record.referrers.size };
  }

  async isReferenced(objectKey: string): Promise<boolean> {
    assertReferenceKey('object key', objectKey);
    return (this.records.get(objectKey)?.referrers.size ?? 0) > 0;
  }

  async referenceCount(objectKey: string): Promise<number> {
    assertReferenceKey('object key', objectKey);
    return this.records.get(objectKey)?.referrers.size ?? 0;
  }

  async listReferrers(objectKey: string): Promise<string[]> {
    assertReferenceKey('object key', objectKey);
    return [...(this.records.get(objectKey)?.referrers ?? [])].sort();
  }

  async listUnreferenced(input: {
    after?: UnreferencedCursor;
    limit: number;
  }): Promise<UnreferencedPage> {
    assertUnreferencedLimit(input.limit);
    if (input.after) assertReferenceKey('unreferenced cursor key', input.after.objectKey);
    const rows: UnreferencedObject[] = [...this.records.values()]
      .filter((record) => record.referrers.size === 0 && record.unreferencedAt !== null)
      .map((record) => ({ objectKey: record.objectKey, unreferencedAt: record.unreferencedAt! }))
      .sort((a, b) => a.unreferencedAt.localeCompare(b.unreferencedAt)
        || a.objectKey.localeCompare(b.objectKey))
      .filter((row) => !input.after
        || row.unreferencedAt > input.after.unreferencedAt
        || (row.unreferencedAt === input.after.unreferencedAt
          && row.objectKey > input.after.objectKey));
    const page = rows.slice(0, input.limit);
    const last = page.at(-1);
    return {
      entries: page,
      nextCursor: rows.length > page.length && last
        ? { unreferencedAt: last.unreferencedAt, objectKey: last.objectKey }
        : null,
    };
  }
}

/** In-memory reference ledger (tests, ephemeral nodes). */
export class InMemoryObjectReferenceLedger extends ObjectReferenceLedgerStateMachine {}
