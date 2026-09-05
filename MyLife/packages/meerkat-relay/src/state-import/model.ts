/**
 * Shared model for the Plan 44 Phase 3 file-to-PostgreSQL state import engine.
 *
 * The import engine treats every first-party mutable state store as a stream of
 * records with a semantic IDENTITY TUPLE (its natural key) and a canonical
 * DIGEST PAYLOAD (the durable body the store persists). Both backends are read
 * through the SAME enumerator interface so the semantic digest compares
 * identity tuples and payloads, never byte serialization or storage layout.
 *
 * Scope (Plan 44 Phase 3 contract): STATE only. The object-store byte path
 * (seeder pieces, hosted tenant bytes, archive object bytes) is NOT imported
 * here; those bytes belong to the object store, not the durable state graph.
 */

/**
 * Every importable first-party mutable state store. Each id maps to one table
 * family in one PostgreSQL schema and one File* adapter. The set deliberately
 * EXCLUDES:
 *   - `hosted.seeder-pieces`         object-store BYTES, not state (contract exclusion).
 *   - `hosted.storage-metadata`      PostgreSQL-only; no File adapter exists to import from.
 *   - `hosted.seeder-manifests`      PostgreSQL-only; no File adapter exists to import from.
 *   - `directory.host-freshness`     in-memory, TTL-ephemeral; never persisted to a file.
 *   - `ops.release-recovery`         operational records created in PostgreSQL, never file state.
 *   - `humanity.issuance-counts`     the File HumanityStore keeps issuance counts (and
 *                                    challenges) in a volatile in-memory map; there is NO
 *                                    durable file record to import, so it is not a state store.
 *   - `humanity.registration-redemptions` / `persona.registration-attempts`  provisional
 *                                    saga state. Per the store inventory these are "not
 *                                    resolvable records": a writer-frozen cutover carries no
 *                                    in-flight saga, and a committed saga already appears as a
 *                                    durable `persona.records` / spent-token record. Importing
 *                                    provisional rows would fabricate authority, so they are
 *                                    intentionally excluded. (The file store persists redemption
 *                                    RECEIPTS, which are covered under the spent-token spend
 *                                    ledger's own idempotency, not re-materialized here.)
 */
export const STATE_STORE_IDS = [
  'community.descriptor-revisions',
  'community.publications',
  'community.kills',
  'community.reports',
  'community.public-posts',
  'community.public-post-tombstones',
  'community.publication-freezes',
  'community.public-submit-windows',
  'community.blocked-personas',
  'community.private-states',
  'directory.publications',
  'directory.kills',
  'humanity.spent-tokens',
  'persona.records',
  'persona.alias-tombstones',
  'persona.revocations',
  'hosted.subscriptions',
  'hosted.app-purchases',
  'hosted.app-persona-bindings',
  'moderation.triage',
  'moderation.operator-audit',
  'moderation.ncmec-reports',
  'moderation.dmca-claims',
  'ops.object-reference-keys',
  'ops.object-reference-edges',
  'ops.object-deletion-jobs',
] as const;

export type StateStoreId = (typeof STATE_STORE_IDS)[number];

export function isStateStoreId(value: string): value is StateStoreId {
  return (STATE_STORE_IDS as readonly string[]).includes(value);
}

/**
 * How complete an enumerator's coverage of its backend is. `complete` means the
 * enumerator is guaranteed to yield every durable record (a full directory scan
 * or full table scan). No importer store is allowed to ship as anything weaker;
 * the value is recorded so a reviewer can audit the guarantee per store.
 */
export type EnumerationCompleteness = 'complete';

/**
 * One durable record surfaced from either backend through a uniform shape.
 *
 * - `identity` is the SEMANTIC identity tuple (the store's natural key), as an
 *   ordered list of string parts. Two records from different backends are "the
 *   same record" iff their identity tuples are equal. The tuple never encodes
 *   storage layout (no file paths, no row ids).
 * - `digestPayload` is the canonical durable body used for the content hash in
 *   the semantic digest. It is normalized so the file and PostgreSQL backends
 *   produce an identical hash for an identical record (see `canonicalize`).
 * - `record` is the full typed record handed to the importer. For most stores it
 *   equals the store's own record type; the importer decides how to write it.
 */
export interface StateRecord {
  readonly identity: readonly string[];
  readonly digestPayload: unknown;
  readonly record: unknown;
}

/**
 * A uniform, backend-agnostic enumerator over one state store. The same
 * interface is implemented once against the File adapter and once against the
 * PostgreSQL adapter so the digest and the round-trip verifier read both sides
 * identically.
 */
export interface StateEnumerator {
  readonly storeId: StateStoreId;
  /** Human-readable statement of HOW this enumerator achieves completeness. */
  readonly completeness: EnumerationCompleteness;
  readonly guarantee: string;
  enumerate(): AsyncIterable<StateRecord>;
}

/** The backend an enumerator or importer reads from / writes to. */
export type StateBackend = 'file' | 'postgres';
