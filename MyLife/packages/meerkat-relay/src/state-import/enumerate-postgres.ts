import type { PostgresStoreContext } from '../postgres/store-context';
import { toPostgresStoreUnavailableError } from '../postgres/store-context';
import type { StateEnumerator, StateRecord, StateStoreId } from './model';
import { STATE_STORE_DESCRIPTORS } from './stores';

/**
 * PostgreSQL-backend enumerators. Because most PostgreSQL stores expose no full
 * enumeration method (only get-by-id or a filtered/paginated list), these read
 * the store's OWN table directly with a bounded keyset scan. That is read-only
 * and adds no store or contract change; it is the only way to enumerate every
 * PostgreSQL record for the digest, and it emits the SAME normalized digest
 * payload the file enumerator emits so an identical record hashes identically.
 */

const PAGE = 1_000;

async function query<Row extends Record<string, unknown>>(
  database: PostgresStoreContext,
  text: string,
  values: readonly unknown[],
): Promise<Row[]> {
  try {
    const result = await database.query<Row>(text, values);
    return result.rows;
  } catch (error) {
    throw toPostgresStoreUnavailableError('state-import enumeration', error);
  }
}

/** Quote a schema/table/column identifier that we control (from the descriptor, never user input). */
function ident(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) throw new Error(`Unsafe SQL identifier: ${name}`);
  return `"${name}"`;
}

/**
 * A keyset-paginated scan over one table by its ordered key columns. Yields raw
 * rows so each per-store enumerator can shape the digest payload. Ordering by the
 * full key makes the scan resumable and duplicate-free without OFFSET.
 */
async function* scanTable(
  database: PostgresStoreContext,
  schema: string,
  table: string,
  keyColumns: readonly string[],
  selectColumns: readonly string[],
): AsyncIterable<Record<string, unknown>> {
  const qualified = `${ident(schema)}.${ident(table)}`;
  const keys = keyColumns.map(ident);
  const selected = [...new Set([...keyColumns, ...selectColumns])].map(ident).join(', ');
  const orderBy = keys.join(', ');

  let after: unknown[] | null = null;
  for (;;) {
    let text: string;
    let values: unknown[];
    if (after === null) {
      text = `SELECT ${selected} FROM ${qualified} ORDER BY ${orderBy} LIMIT ${PAGE}`;
      values = [];
    } else {
      const lhs = `(${keys.join(', ')})`;
      const rhs = `(${after.map((_, i) => `$${i + 1}`).join(', ')})`;
      text = `SELECT ${selected} FROM ${qualified} WHERE ${lhs} > ${rhs} ORDER BY ${orderBy} LIMIT ${PAGE}`;
      values = after;
    }
    const rows = await query(database, text, values);
    if (rows.length === 0) return;
    for (const row of rows) yield row;
    if (rows.length < PAGE) return;
    const last = rows[rows.length - 1]!;
    after = keyColumns.map((col) => last[col]);
  }
}

function identityOf(row: Record<string, unknown>, keyColumns: readonly string[]): string[] {
  return keyColumns.map((col) => {
    const value = row[col];
    if (value === null || value === undefined) throw new Error(`Null key column ${col} in enumeration`);
    return String(value);
  });
}

type PgEnumerate = (database: PostgresStoreContext) => AsyncIterable<StateRecord>;

/**
 * The default enumerator for a uniform (keyColumns, payload jsonb) store: the
 * identity tuple is the key columns and the digest payload is the payload jsonb
 * verbatim. This matches the file side, which persists the identical body.
 */
function payloadStore(storeId: StateStoreId): PgEnumerate {
  const descriptor = STATE_STORE_DESCRIPTORS[storeId];
  const payloadColumn = descriptor.payloadColumn;
  if (!payloadColumn) throw new Error(`Store ${storeId} has no payload column`);
  return async function* (database) {
    for await (const row of scanTable(
      database,
      descriptor.schema,
      descriptor.table,
      descriptor.keyColumns,
      [payloadColumn],
    )) {
      yield {
        identity: identityOf(row, descriptor.keyColumns),
        digestPayload: row[payloadColumn],
        record: { row },
      };
    }
  };
}

/** Store whose entire record is its key columns (no payload); digest is a constant marker. */
function keyOnlyStore(storeId: StateStoreId, marker: Record<string, unknown>): PgEnumerate {
  const descriptor = STATE_STORE_DESCRIPTORS[storeId];
  return async function* (database) {
    for await (const row of scanTable(
      database,
      descriptor.schema,
      descriptor.table,
      descriptor.keyColumns,
      descriptor.keyColumns,
    )) {
      yield { identity: identityOf(row, descriptor.keyColumns), digestPayload: marker, record: { row } };
    }
  };
}

const enumerators: Record<StateStoreId, PgEnumerate> = {
  'community.descriptor-revisions': async function* (database) {
    for await (const row of scanTable(database, 'community', 'descriptor_revisions',
      ['community_id'], ['revision', 'descriptor_hash'])) {
      yield {
        identity: [String(row.community_id)],
        digestPayload: { revision: Number(row.revision), descriptorHash: String(row.descriptor_hash) },
        record: { row },
      };
    }
  },
  'community.publications': payloadStore('community.publications'),
  'community.kills': payloadStore('community.kills'),
  'community.reports': reportsEnumerator(),
  'community.public-posts': payloadStore('community.public-posts'),
  'community.public-post-tombstones': payloadStore('community.public-post-tombstones'),
  'community.publication-freezes': payloadStore('community.publication-freezes'),
  'community.public-submit-windows': async function* (database) {
    for await (const row of scanTable(database, 'community', 'public_submit_windows',
      ['publication_id', 'persona_key'], ['timestamps_ms'])) {
      const timestamps = Array.isArray(row.timestamps_ms) ? row.timestamps_ms as number[] : [];
      const sorted = [...timestamps].sort((a, b) => a - b);
      yield {
        identity: [String(row.publication_id), String(row.persona_key)],
        digestPayload: { timestampsMs: sorted },
        record: { row },
      };
    }
  },
  'community.blocked-personas': async function* (database) {
    // Enforcement keys on persona_pubkey_hash (Plan 44 WP-3D), which equals the file
    // marker's sha256(lower(pubkey)). Enumerating the hash column matches the file
    // identity directly, so an imported hash-only block digest-compares identical.
    for await (const row of scanTable(database, 'community', 'blocked_personas',
      ['persona_pubkey_hash'], ['persona_pubkey_hash'])) {
      yield {
        identity: [String(row.persona_pubkey_hash)],
        digestPayload: { blocked: true },
        record: { row },
      };
    }
  },
  'community.private-states': async function* (database) {
    for await (const row of scanTable(database, 'community', 'private_states',
      ['community_id'], ['descriptor_revision', 'descriptor_hash'])) {
      yield {
        identity: [String(row.community_id)],
        digestPayload: {
          descriptorHash: String(row.descriptor_hash),
          revision: Number(row.descriptor_revision),
        },
        record: { row },
      };
    }
  },
  'directory.publications': async function* (database) {
    // directory.publications stores signed_record + rids[] + expires_at (no payload jsonb).
    // The file side digests {rec, rids} only; expires_at is a TTL that the two backends
    // express differently (ms vs timestamptz), so it is excluded from the digest payload.
    for await (const row of scanTable(database, 'directory', 'publications',
      ['publication_id'], ['signed_record', 'rids'])) {
      const rids = Array.isArray(row.rids) ? [...(row.rids as string[])].sort() : [];
      yield {
        identity: [String(row.publication_id)],
        digestPayload: { rec: String(row.signed_record), rids },
        record: { row },
      };
    }
  },
  'directory.kills': payloadStore('directory.kills'),
  'humanity.spent-tokens': async function* (database) {
    for await (const row of scanTable(database, 'humanity', 'spent_tokens',
      ['token_hash'], ['expires_at'])) {
      yield {
        identity: [String(row.token_hash)],
        digestPayload: { expiresAtMs: toEpochMs(row.expires_at) },
        record: { row },
      };
    }
  },
  'persona.records': payloadStore('persona.records'),
  'persona.alias-tombstones': payloadStore('persona.alias-tombstones'),
  'persona.revocations': keyOnlyStore('persona.revocations', { revoked: true }),
  'hosted.subscriptions': payloadStore('hosted.subscriptions'),
  'hosted.app-purchases': payloadStore('hosted.app-purchases'),
  'hosted.app-persona-bindings': async function* (database) {
    for await (const row of scanTable(database, 'hosted', 'app_persona_bindings',
      ['subject_id', 'persona_hash'], ['persona_hash'])) {
      yield {
        identity: [String(row.subject_id), String(row.persona_hash)],
        digestPayload: { personaHash: String(row.persona_hash) },
        record: { row },
      };
    }
  },
  // triage/ncmec/dmca project status (and detected_at/received_at) into DEDICATED columns,
  // NOT the payload jsonb. The digest must read those columns so a status-only change is
  // caught; the file side digests the same status field from its whole-record blob.
  'moderation.triage': async function* (database) {
    for await (const row of scanTable(database, 'moderation', 'triage',
      ['report_key'], ['status'])) {
      yield {
        identity: [String(row.report_key)],
        digestPayload: { status: String(row.status) },
        record: { row },
      };
    }
  },
  'moderation.operator-audit': async function* (database) {
    for await (const row of scanTable(database, 'moderation', 'operator_audit',
      ['seq'], ['payload'])) {
      yield {
        identity: [String(row.seq)],
        digestPayload: withSeq(row.payload, Number(row.seq)),
        record: { row },
      };
    }
  },
  'moderation.ncmec-reports': async function* (database) {
    for await (const row of scanTable(database, 'moderation', 'ncmec_reports',
      ['report_id'], ['status', 'detected_at'])) {
      yield {
        identity: [String(row.report_id)],
        digestPayload: { status: String(row.status), detectedAt: toIso(row.detected_at) },
        record: { row },
      };
    }
  },
  'moderation.dmca-claims': async function* (database) {
    for await (const row of scanTable(database, 'moderation', 'dmca_claims',
      ['claim_id'], ['status', 'received_at'])) {
      yield {
        identity: [String(row.claim_id)],
        digestPayload: { status: String(row.status), receivedAt: toIso(row.received_at) },
        record: { row },
      };
    }
  },
  'ops.object-reference-keys': async function* (database) {
    for await (const row of scanTable(database, 'ops', 'object_reference_keys',
      ['object_key'], ['reference_count'])) {
      yield {
        identity: [String(row.object_key)],
        digestPayload: { referenceCount: Number(row.reference_count) },
        record: { row },
      };
    }
  },
  'ops.object-reference-edges': keyOnlyStore('ops.object-reference-edges', { edge: true }),
  'ops.object-deletion-jobs': async function* (database) {
    for await (const row of scanTable(database, 'ops', 'object_deletion_jobs',
      ['object_key'], ['state', 'attempt', 'version_id'])) {
      yield {
        identity: [String(row.object_key)],
        digestPayload: {
          state: String(row.state),
          attempt: Number(row.attempt),
          versionId: row.version_id === null || row.version_id === undefined ? null : String(row.version_id),
        },
        record: { row },
      };
    }
  },
};

function reportsEnumerator(): PgEnumerate {
  return async function* (database) {
    for await (const row of scanTable(database, 'community', 'reports',
      ['publication_id', 'report_key'], ['payload'])) {
      const payload = row.payload as { signature?: string } | null;
      // The file side keys a report on its signature; align by using the signed payload's
      // signature as the second identity part so both backends produce the same tuple.
      const signature = typeof payload?.signature === 'string' ? payload.signature : String(row.report_key);
      yield {
        identity: [String(row.publication_id), signature],
        digestPayload: payload,
        record: { row },
      };
    }
  };
}

// --- Cross-backend normalization helpers -----------------------------------

/** Normalize a PostgreSQL timestamptz to a millisecond-precision ISO string for digest parity. */
function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (Number.isFinite(parsed.getTime())) return parsed.toISOString();
  }
  throw new Error('Invalid PostgreSQL timestamp in moderation enumeration');
}

function toEpochMs(value: unknown): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  if (typeof value === 'number') return value;
  throw new Error('Invalid PostgreSQL timestamp in spent-token enumeration');
}

function withSeq(payload: unknown, seq: number): unknown {
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    return { ...(payload as Record<string, unknown>), seq };
  }
  return { payload, seq };
}

export function postgresEnumerator(storeId: StateStoreId, database: PostgresStoreContext): StateEnumerator {
  const descriptor = STATE_STORE_DESCRIPTORS[storeId];
  const run = enumerators[storeId];
  return {
    storeId,
    completeness: 'complete',
    guarantee: `Keyset scan of ${descriptor.schema}.${descriptor.table} by (${descriptor.keyColumns.join(', ')}).`,
    enumerate: () => run(database),
  };
}

export function postgresEnumerators(database: PostgresStoreContext): Record<StateStoreId, StateEnumerator> {
  const out = {} as Record<StateStoreId, StateEnumerator>;
  for (const storeId of Object.keys(enumerators) as StateStoreId[]) {
    out[storeId] = postgresEnumerator(storeId, database);
  }
  return out;
}
