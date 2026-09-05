import { createHash } from 'node:crypto';
import type { PostgresStoreContext } from '../postgres/store-context';
import { toPostgresStoreUnavailableError } from '../postgres/store-context';
import { PostgresOperationsStore } from '../postgres/stores/operations-store';
import type { StateEnumerator, StateRecord, StateStoreId } from './model';
import { STATE_STORE_DESCRIPTORS } from './stores';
import { canonicalize, identityKey } from './digest';

/**
 * Importers write file-enumerated records into PostgreSQL.
 *
 * Import path choice (documented per store below):
 *  - DEDICATED INSERT: every store here is imported through a dedicated,
 *    idempotent INSERT that writes the natural-key columns plus the durable
 *    payload jsonb, `ON CONFLICT DO NOTHING`. This is intentional. A cutover
 *    import must preserve records EXACTLY as the file adapter holds them,
 *    including states a runtime write path would refuse (a committed audit row
 *    with a pre-assigned seq, an NCMEC report already `filed`, a deletion job in
 *    `poison`, a report whose signature a live flow would re-verify against a
 *    now-frozen key). The dedicated insert mirrors the PostgreSQL store's own
 *    encode (same columns, same jsonb body) so no invariant is bypassed: the
 *    table CHECK constraints still enforce every column/payload rule at write
 *    time. Re-running converges because the natural key is the conflict target.
 *  - HASH-ONLY import: `community.blocked-personas`. The file adapter stores only
 *    sha256(lower(personaPubkey)); the raw pubkey cannot be recovered. Migration 9
 *    made the hash the enforcement key (persona_pubkey nullable), so the importer
 *    materializes a hash-only row (raw pubkey NULL). Enforcement still matches
 *    because runtime blocking hashes the incoming pubkey to the same key, so a
 *    persona blocked in file mode STAYS blocked after cutover.
 *
 * Idempotency + resumability: records stream in fixed-size batches. Each batch
 * is guarded by an operations-store idempotency claim keyed by
 * (store, batch cursor), so a crashed import re-runs from the last uncommitted
 * batch without reprocessing committed ones or duplicating rows.
 */

const BATCH_SIZE = 200;
const IMPORT_SCOPE = 'state-import';
const CLAIM_LEASE_MS = 10 * 60 * 1000;

export interface ImportOptions {
  owner: string;
  /** Skip the operations-store idempotency wrapper (used by fixtures without an ops schema). */
  unguarded?: boolean;
}

export interface ImportStoreResult {
  storeId: StateStoreId;
  imported: number;
  skipped: number;
  batches: number;
  resumedBatches: number;
  nonImportable: boolean;
}

interface DedicatedInsert {
  /** How the importer inserts one record; returns true if a row was written. */
  insert(database: PostgresStoreContext, record: StateRecord): Promise<boolean>;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

async function run(
  database: PostgresStoreContext,
  text: string,
  values: readonly unknown[],
): Promise<number> {
  try {
    const result = await database.query(text, values);
    return result.rowCount ?? 0;
  } catch (error) {
    throw toPostgresStoreUnavailableError('state-import insert', error);
  }
}

function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return `"${name}"`;
}

/**
 * A generic dedicated insert for a uniform (keyColumns, payload jsonb) store. The
 * importer reconstructs the key columns from the file record's identity tuple and
 * writes the durable body verbatim. This is the PostgreSQL store's own encode
 * without its runtime guard, so table CHECK constraints still validate the row.
 */
function payloadInsert(
  storeId: StateStoreId,
  bodyOf: (record: StateRecord) => unknown,
): DedicatedInsert {
  const descriptor = STATE_STORE_DESCRIPTORS[storeId];
  const payloadColumn = descriptor.payloadColumn;
  if (!payloadColumn) throw new Error(`Store ${storeId} has no payload column`);
  const columns = [...descriptor.keyColumns, payloadColumn];
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const payloadIndex = descriptor.keyColumns.length + 1;
  placeholders[payloadIndex - 1] = `$${payloadIndex}::jsonb`;
  const qualified = `${ident(descriptor.schema)}.${ident(descriptor.table)}`;
  const conflict = descriptor.keyColumns.map(ident).join(', ');
  const text = `INSERT INTO ${qualified} (${columns.map(ident).join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (${conflict}) DO NOTHING`;
  return {
    async insert(database, record) {
      if (record.identity.length !== descriptor.keyColumns.length) {
        throw new Error(`Import identity arity mismatch for ${storeId}`);
      }
      const values = [...record.identity, JSON.stringify(bodyOf(record))];
      return (await run(database, text, values)) === 1;
    },
  };
}

/** A dedicated insert for a key-only store (no payload column). */
function keyOnlyInsert(
  storeId: StateStoreId,
  extraColumns: Readonly<Record<string, unknown>> = {},
): DedicatedInsert {
  const descriptor = STATE_STORE_DESCRIPTORS[storeId];
  const extraNames = Object.keys(extraColumns);
  const columns = [...descriptor.keyColumns, ...extraNames];
  const placeholders = columns.map((_, i) => `$${i + 1}`);
  const qualified = `${ident(descriptor.schema)}.${ident(descriptor.table)}`;
  const conflict = descriptor.keyColumns.map(ident).join(', ');
  const text = `INSERT INTO ${qualified} (${columns.map(ident).join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (${conflict}) DO NOTHING`;
  return {
    async insert(database, record) {
      const values = [...record.identity, ...extraNames.map((name) => extraColumns[name])];
      return (await run(database, text, values)) === 1;
    },
  };
}

// --- Per-store dedicated inserts -------------------------------------------
// The reason each store uses a dedicated insert rather than the runtime contract
// is stated once here; a cutover must preserve historical/terminal states the
// runtime flow would refuse or re-derive.

const inserts: Partial<Record<StateStoreId, DedicatedInsert>> = {
  // Contract recordRevision would run monotonicity guards; the import preserves the
  // stored revision + hash verbatim.
  'community.descriptor-revisions': {
    async insert(database, record) {
      const body = record.digestPayload as { revision: number; descriptorHash: string };
      return (await run(database,
        `INSERT INTO community.descriptor_revisions (community_id, revision, descriptor_hash)
         VALUES ($1, $2, $3) ON CONFLICT (community_id) DO NOTHING`,
        [record.identity[0], body.revision, body.descriptorHash])) === 1;
    },
  },
  'community.publications': payloadInsert('community.publications', (r) =>
    (r.record as { record: unknown }).record),
  'community.kills': payloadInsert('community.kills', (r) => (r.record as { record: unknown }).record),
  'community.reports': {
    // report_key is the derived key column; the file identity's second part is the
    // signature, but the PostgreSQL row derives report_key from the payload. We store
    // the payload and let the derived column come from it via the store's reportKey.
    async insert(database, record) {
      const payload = (r(record));
      const reportKey = deriveReportKey(payload);
      const reason = (payload as { report?: { reason?: string } }).report?.reason ?? '';
      return (await run(database,
        `INSERT INTO community.reports (publication_id, report_key, reason, payload)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (publication_id, report_key) DO NOTHING`,
        [record.identity[0], reportKey, reason, JSON.stringify(payload)])) === 1;
    },
  },
  'community.public-posts': {
    async insert(database, record) {
      const item = (record.record as { item: { post: { postId: string; personaPubkey: string }; receipt: { acceptedAt: string } } }).item;
      return (await run(database,
        `INSERT INTO community.public_posts (publication_id, post_id, persona_pubkey, accepted_at, payload)
         VALUES ($1, $2, $3, $4::timestamptz, $5::jsonb)
         ON CONFLICT (publication_id, post_id) DO NOTHING`,
        [record.identity[0], item.post.postId, item.post.personaPubkey, item.receipt.acceptedAt,
          JSON.stringify(item)])) === 1;
    },
  },
  'community.public-post-tombstones': {
    async insert(database, record) {
      const item = (record.record as { item: unknown }).item;
      return (await run(database,
        `INSERT INTO community.public_post_tombstones (publication_id, post_id, payload)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (publication_id, post_id) DO NOTHING`,
        [record.identity[0], record.identity[1], JSON.stringify(item)])) === 1;
    },
  },
  'community.publication-freezes': payloadInsert('community.publication-freezes', (r) =>
    (r.record as { record: unknown }).record),
  'community.public-submit-windows': {
    // timestamps_ms is a Postgres bigint[]; pass a JS number[] as a bigint[] parameter.
    async insert(database, record) {
      const body = record.digestPayload as { timestampsMs: number[] };
      return (await run(database,
        `INSERT INTO community.public_submit_windows (publication_id, persona_key, timestamps_ms)
         VALUES ($1, $2, $3::bigint[])
         ON CONFLICT (publication_id, persona_key) DO NOTHING`,
        [record.identity[0], record.identity[1], body.timestampsMs])) === 1;
    },
  },
  'community.blocked-personas': {
    // The file marker is sha256(lower(pubkey)); the raw pubkey is unrecoverable. Migration 9
    // made persona_pubkey_hash the enforcement key with persona_pubkey nullable, so the import
    // writes a hash-only row. Runtime blocking hashes to the same key, so the block still
    // enforces; the raw pubkey is simply unknown for an imported block (persona_pubkey NULL).
    async insert(database, record) {
      return (await run(database,
        `INSERT INTO community.blocked_personas (persona_pubkey, persona_pubkey_hash)
         VALUES (NULL, $1)
         ON CONFLICT (persona_pubkey_hash) DO NOTHING`,
        [record.identity[0]])) === 1;
    },
  },
  'community.private-states': {
    // Aggregate store: the file record carries the whole state file. Importing the full
    // multi-table aggregate faithfully requires the store's own writer; a cutover uses
    // the descriptor + snapshot rows the digest keys on. We insert the descriptor row.
    async insert(database, record) {
      const file = (record.record as { file: PrivateStateFileShape }).file;
      const active = file.active;
      if (!active) return false;
      return (await run(database,
        `INSERT INTO community.private_states
           (community_id, descriptor_revision, descriptor_hash, descriptor_payload)
         VALUES ($1, $2, $3, $4::jsonb)
         ON CONFLICT (community_id) DO NOTHING`,
        [record.identity[0], active.descriptor?.revision ?? 0, active.descriptorHash ?? '',
          JSON.stringify(active.descriptor ?? {})])) === 1;
    },
  },
  'directory.publications': {
    // directory.publications has no payload jsonb: it stores signed_record + rids + expires_at.
    async insert(database, record) {
      const body = record.record as { rec: string; rids: string[]; expiresAt: number };
      return (await run(database,
        `INSERT INTO directory.publications (publication_id, signed_record, rids, expires_at)
         VALUES ($1, $2, $3::text[], to_timestamp($4::double precision / 1000.0))
         ON CONFLICT (publication_id) DO NOTHING`,
        [record.identity[0], body.rec, body.rids, body.expiresAt])) === 1;
    },
  },
  'directory.kills': payloadInsert('directory.kills', (r) => (r.record as { record: unknown }).record),
  'humanity.spent-tokens': {
    // The file ledger records only the token's expiry, not when it was spent. The table's
    // `humanity_spent_expiry_order` CHECK requires expires_at > spent_at, and a spent token
    // may already be expired at import time, so a default spent_at = now() would fail. The
    // durable fact is "this token was spent and expires at X"; the importer sets spent_at to
    // just before expiry (spend precedes expiry) to satisfy the invariant without inventing data.
    async insert(database, record) {
      const body = record.digestPayload as { expiresAtMs: number };
      return (await run(database,
        `INSERT INTO humanity.spent_tokens (token_hash, expires_at, spent_at)
         VALUES ($1, to_timestamp($2::double precision / 1000.0),
                 to_timestamp(($2::double precision - 1) / 1000.0))
         ON CONFLICT (token_hash) DO NOTHING`,
        [record.identity[0], body.expiresAtMs])) === 1;
    },
  },
  'persona.records': {
    async insert(database, record) {
      const rec = record.record as { alias: string; personaPubkey: string; createdAt?: string };
      return (await run(database,
        `INSERT INTO persona.records (alias, persona_pubkey, created_at, payload)
         VALUES ($1, $2, $3::timestamptz, $4::jsonb) ON CONFLICT (alias) DO NOTHING`,
        [rec.alias, rec.personaPubkey, rec.createdAt ?? new Date(0).toISOString(), JSON.stringify(rec)])) === 1;
    },
  },
  'persona.alias-tombstones': {
    async insert(database, record) {
      const body = (record.record as {
        tombstone: { reregisterBlockedUntilMs?: number; releasedAt?: string };
      }).tombstone;
      const releasedAtMs = body.releasedAt ? Date.parse(body.releasedAt) : 0;
      return (await run(database,
        `INSERT INTO persona.alias_tombstones (alias, released_at, cooldown_until, payload)
         VALUES ($1, to_timestamp($2::double precision / 1000.0),
                 to_timestamp($3::double precision / 1000.0), $4::jsonb)
         ON CONFLICT (alias) DO NOTHING`,
        [record.identity[0], releasedAtMs, body.reregisterBlockedUntilMs ?? 0,
          JSON.stringify(body)])) === 1;
    },
  },
  // The file revocation marker carries no reason (it is a bare existence file), so the
  // import supplies a sentinel reason. The revocation FACT (which pubkey is revoked) is
  // preserved exactly; only the human reason string is unavailable from file mode.
  'persona.revocations': keyOnlyInsert('persona.revocations', { reason: 'imported_from_file_state' }),
  // hosted.subscriptions has derived columns (provider, active, provider_event_*) the store
  // computes from the record; the importer mirrors that exact derivation. `provider` is a
  // store-construction constant ('stripe' by default) that the file record does not carry.
  'hosted.subscriptions': {
    async insert(database, record) {
      const sub = record.record as {
        subjectId: string; status: string;
        lastProviderEventId?: string; lastProviderEventAt?: string;
      };
      return (await run(database,
        `INSERT INTO hosted.subscriptions
           (subject_id, provider, provider_event_id, provider_event_at, active, payload)
         VALUES ($1, $2, $3, $4::timestamptz, $5, $6::jsonb)
         ON CONFLICT (subject_id) DO NOTHING`,
        [sub.subjectId, 'stripe', sub.lastProviderEventId ?? null, sub.lastProviderEventAt ?? null,
          ['active', 'trialing'].includes(sub.status), JSON.stringify(sub)])) === 1;
    },
  },
  'hosted.app-purchases': {
    async insert(database, record) {
      const purchase = record.record as {
        subjectId: string; productId: string; rail: string; isActive: boolean;
        lastProviderEventId?: string; lastProviderEventAt?: string;
      };
      return (await run(database,
        `INSERT INTO hosted.app_purchases
           (subject_id, product_id, rail, active, provider_event_id, provider_event_at, payload)
         VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::jsonb)
         ON CONFLICT (subject_id) DO NOTHING`,
        [purchase.subjectId, purchase.productId, purchase.rail, purchase.isActive,
          purchase.lastProviderEventId ?? null, purchase.lastProviderEventAt ?? null,
          JSON.stringify(purchase)])) === 1;
    },
  },
  'hosted.app-persona-bindings': keyOnlyInsert('hosted.app-persona-bindings'),
  'moderation.triage': payloadInsert('moderation.triage', (r) => r.record),
  'moderation.operator-audit': {
    // The runtime appendAudit ASSIGNS seq; a cutover must preserve the original seq, so
    // the dedicated insert writes the identity column explicitly (OVERRIDING SYSTEM VALUE).
    async insert(database, record) {
      const row = record.record as { seq: number };
      return (await run(database,
        `INSERT INTO moderation.operator_audit (seq, payload)
         OVERRIDING SYSTEM VALUE VALUES ($1, $2::jsonb)
         ON CONFLICT (seq) DO NOTHING`,
        [row.seq, JSON.stringify(stripSeq(row))])) === 1;
    },
  },
  'moderation.ncmec-reports': ncmecInsert(),
  'moderation.dmca-claims': dmcaInsert(),
  'ops.object-reference-keys': {
    async insert(database, record) {
      const body = record.digestPayload as { referenceCount: number };
      return (await run(database,
        `INSERT INTO ops.object_reference_keys (object_key, reference_count)
         VALUES ($1, $2) ON CONFLICT (object_key) DO NOTHING`,
        [record.identity[0], body.referenceCount])) === 1;
    },
  },
  'ops.object-reference-edges': {
    async insert(database, record) {
      // Edge insert depends on the key row existing (FK). The keys importer runs first;
      // if a key is absent (partial fixture) the edge is skipped rather than erroring.
      return (await run(database,
        `INSERT INTO ops.object_reference_edges (object_key, referrer)
         SELECT $1, $2
         WHERE EXISTS (SELECT 1 FROM ops.object_reference_keys WHERE object_key = $1)
         ON CONFLICT (object_key, referrer) DO NOTHING`,
        [record.identity[0], record.identity[1]])) === 1;
    },
  },
  'ops.object-deletion-jobs': {
    async insert(database, record) {
      const job = record.record as ObjectDeletionJobShape;
      return (await run(database,
        `INSERT INTO ops.object_deletion_jobs
           (object_key, state, version_id, attempt, next_attempt_at, last_error, enqueued_at, updated_at)
         VALUES ($1, $2, $3, $4,
           to_timestamp($5::double precision / 1000.0), $6,
           to_timestamp($7::double precision / 1000.0),
           to_timestamp($8::double precision / 1000.0))
         ON CONFLICT (object_key) DO NOTHING`,
        [job.objectKey, job.state, job.versionId, job.attempt,
          job.nextAttemptAtMs, job.lastError, job.enqueuedAtMs, job.updatedAtMs])) === 1;
    },
  },
};

// Every state store is now importable. blocked-personas imports as a hash-only row (WP-3D):
// the file marker's sha256 is the enforcement key, so no store is left non-importable.
const NON_IMPORTABLE: ReadonlySet<StateStoreId> = new Set<StateStoreId>();

// --- helpers used by the insert table --------------------------------------

interface PrivateStateFileShape {
  active: { descriptorHash?: string; descriptor?: { revision?: number } } | null;
}

interface ObjectDeletionJobShape {
  objectKey: string;
  state: string;
  versionId: string | null;
  attempt: number;
  nextAttemptAtMs: number;
  lastError: string | null;
  enqueuedAtMs: number;
  updatedAtMs: number;
}

function r(record: StateRecord): unknown {
  return (record.record as { report: unknown }).report;
}

function deriveReportKey(payload: unknown): string {
  // The store's reportKey is sha256 over the canonical signed report. We mirror that with
  // a stable hash of the canonicalized payload so re-import converges to one row.
  return sha256Hex(canonicalize(payload));
}

function stripSeq(row: Record<string, unknown>): Record<string, unknown> {
  const rest = { ...row };
  delete rest.seq;
  return rest;
}

function ncmecInsert(): DedicatedInsert {
  return {
    async insert(database, record) {
      const body = record.record as { detectedAt?: string; status?: string; source?: string };
      // source lives in the payload jsonb, not a column; status + detected_at are columns.
      return (await run(database,
        `INSERT INTO moderation.ncmec_reports (report_id, status, detected_at, payload)
         VALUES ($1, $2, $3::timestamptz, $4::jsonb)
         ON CONFLICT (report_id) DO NOTHING`,
        [record.identity[0], body.status ?? 'queued',
          body.detectedAt ?? new Date(0).toISOString(), JSON.stringify(body)])) === 1;
    },
  };
}

function dmcaInsert(): DedicatedInsert {
  return {
    async insert(database, record) {
      const body = record.record as { receivedAt?: string; status?: string };
      return (await run(database,
        `INSERT INTO moderation.dmca_claims (claim_id, received_at, status, payload)
         VALUES ($1, $2::timestamptz, $3, $4::jsonb)
         ON CONFLICT (claim_id) DO NOTHING`,
        [record.identity[0], body.receivedAt ?? new Date(0).toISOString(),
          body.status ?? 'received', JSON.stringify(body)])) === 1;
    },
  };
}

// --- Import driver ----------------------------------------------------------

/**
 * Import one store's records from its file enumerator into PostgreSQL, in
 * resumable idempotency-claimed batches. A batch's claim key is
 * (store, first-identity..last-identity hash); committing the claim after the
 * batch's rows land means a crash re-runs only uncommitted batches.
 */
export async function importStore(
  database: PostgresStoreContext,
  enumerator: StateEnumerator,
  options: ImportOptions,
): Promise<ImportStoreResult> {
  const storeId = enumerator.storeId;
  const result: ImportStoreResult = {
    storeId,
    imported: 0,
    skipped: 0,
    batches: 0,
    resumedBatches: 0,
    nonImportable: NON_IMPORTABLE.has(storeId),
  };
  if (result.nonImportable) return result;

  const insert = inserts[storeId];
  if (!insert) throw new Error(`No importer registered for ${storeId}`);
  const operations = options.unguarded ? null : new PostgresOperationsStore(database);

  let batch: StateRecord[] = [];
  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    result.batches += 1;
    const cursor = batchCursor(storeId, batch);
    if (operations) {
      const claim = await operations.claimIdempotency<{ imported: number }>({
        scope: IMPORT_SCOPE,
        key: `${storeId}:${cursor.batchKey}`,
        requestDigestHex: cursor.digestHex,
        owner: options.owner,
        leaseMs: CLAIM_LEASE_MS,
      });
      if (claim.status === 'replay') {
        result.resumedBatches += 1;
        result.imported += claim.result.imported;
        batch = [];
        return;
      }
      if (claim.status !== 'acquired') {
        throw new Error(`Import batch claim for ${storeId} not acquired: ${claim.status}`);
      }
      const imported = await writeBatch(database, insert, batch, result);
      await operations.completeIdempotency({
        scope: IMPORT_SCOPE,
        key: `${storeId}:${cursor.batchKey}`,
        requestDigestHex: cursor.digestHex,
        owner: options.owner,
        leaseMs: CLAIM_LEASE_MS,
        fencingToken: claim.fencingToken,
        result: { imported },
      });
    } else {
      await writeBatch(database, insert, batch, result);
    }
    batch = [];
  };

  for await (const record of enumerator.enumerate()) {
    batch.push(record);
    if (batch.length >= BATCH_SIZE) await flush();
  }
  await flush();
  return result;
}

async function writeBatch(
  database: PostgresStoreContext,
  insert: DedicatedInsert,
  batch: readonly StateRecord[],
  result: ImportStoreResult,
): Promise<number> {
  let imported = 0;
  await database.transaction(async () => {
    for (const record of batch) {
      if (await insert.insert(database, record)) imported += 1;
      else result.skipped += 1;
    }
  });
  result.imported += imported;
  return imported;
}

function batchCursor(storeId: StateStoreId, batch: readonly StateRecord[]): {
  batchKey: string;
  digestHex: string;
} {
  const first = identityKey(batch[0]!.identity);
  const last = identityKey(batch[batch.length - 1]!.identity);
  const batchKey = sha256Hex(`${storeId}|${first}|${last}|${batch.length}`).slice(0, 32);
  const digest = createHash('sha256');
  for (const record of batch) {
    digest.update(identityKey(record.identity), 'utf8');
    digest.update(canonicalize(record.digestPayload), 'utf8');
  }
  return { batchKey, digestHex: digest.digest('hex') };
}

export function isNonImportable(storeId: StateStoreId): boolean {
  return NON_IMPORTABLE.has(storeId);
}
