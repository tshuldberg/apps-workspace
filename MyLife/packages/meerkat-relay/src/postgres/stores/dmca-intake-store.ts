import type { QueryResultRow } from 'pg';
import {
  DmcaClaimSchema,
  type DmcaClaimLifecycleState,
  type DmcaClaimRecord,
  type DmcaClaimStatus,
  type DmcaClaimTransitionInput,
  type DmcaClaimTransitionResult,
  type DmcaCounterNotice,
  type DmcaIntakeStore,
} from '../../dmca-intake';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

const CLAIM_ID = /^[a-f0-9]{64}$/u;
const CLAIM_STATUSES = new Set<DmcaClaimStatus>([
  'received',
  'actioned',
  'counter_noticed',
  'rejected',
]);

interface DmcaDatabaseRow extends QueryResultRow {
  claim_id: unknown;
  status: unknown;
  payload: unknown;
  lifecycle: unknown;
  received_at: Date | string;
  lifecycle_version: string | number;
}

function safeInteger(value: string | number, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`Invalid PostgreSQL ${label}`);
  }
  return parsed;
}

function timestamp(value: Date | string, label: string): string {
  const parsed = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error(`Invalid PostgreSQL ${label}`);
  return parsed.toISOString();
}

function jsonObject(value: unknown, label: string): Record<string, unknown> {
  let parsed = value;
  if (typeof value === 'string') {
    try {
      parsed = JSON.parse(value) as unknown;
    } catch {
      throw new Error(`Invalid PostgreSQL ${label}`);
    }
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`Invalid PostgreSQL ${label}`);
  }
  return parsed as Record<string, unknown>;
}

function validateCounterNotice(value: unknown): DmcaCounterNotice {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Invalid PostgreSQL DMCA counter notice');
  }
  const counter = value as Record<string, unknown>;
  if (typeof counter.statement !== 'string' || typeof counter.signature !== 'string'
    || typeof counter.submittedAt !== 'string'
    || !Number.isFinite(Date.parse(counter.submittedAt))) {
    throw new Error('Invalid PostgreSQL DMCA counter notice');
  }
  return {
    statement: counter.statement,
    signature: counter.signature,
    submittedAt: new Date(counter.submittedAt).toISOString(),
  };
}

function decodeLifecycle(value: unknown, status: DmcaClaimStatus): DmcaClaimLifecycleState {
  const lifecycle = jsonObject(value, 'DMCA lifecycle');
  if ((lifecycle.actionedPostIds !== undefined
      && (!Array.isArray(lifecycle.actionedPostIds)
        || lifecycle.actionedPostIds.some((id) => typeof id !== 'string')))
    || (lifecycle.unresolvedItems !== undefined
      && (!Array.isArray(lifecycle.unresolvedItems)
        || lifecycle.unresolvedItems.some((item) => typeof item !== 'string')))) {
    throw new Error('Invalid PostgreSQL DMCA lifecycle');
  }
  return {
    status,
    ...(Array.isArray(lifecycle.actionedPostIds)
      ? { actionedPostIds: [...lifecycle.actionedPostIds] as string[] }
      : {}),
    ...(Array.isArray(lifecycle.unresolvedItems)
      ? { unresolvedItems: [...lifecycle.unresolvedItems] as string[] }
      : {}),
    ...(lifecycle.counterNotice !== undefined
      ? { counterNotice: validateCounterNotice(lifecycle.counterNotice) }
      : {}),
  };
}

function decodeRecord(row: DmcaDatabaseRow): DmcaClaimRecord {
  if (typeof row.claim_id !== 'string' || !CLAIM_ID.test(row.claim_id)
    || typeof row.status !== 'string'
    || !CLAIM_STATUSES.has(row.status as DmcaClaimStatus)) {
    throw new Error('Invalid PostgreSQL DMCA columns');
  }
  const payload = DmcaClaimSchema.safeParse(jsonObject(row.payload, 'DMCA payload'));
  if (!payload.success) throw new Error('Invalid PostgreSQL DMCA claim payload');
  const lifecycle = decodeLifecycle(row.lifecycle, row.status as DmcaClaimStatus);
  return {
    ...payload.data,
    id: row.claim_id,
    receivedAt: timestamp(row.received_at, 'DMCA received_at'),
    ...lifecycle,
    lifecycleVersion: safeInteger(row.lifecycle_version, 'DMCA lifecycle version'),
  };
}

function lifecyclePayload(lifecycle: DmcaClaimLifecycleState): Record<string, unknown> {
  return {
    ...(lifecycle.actionedPostIds
      ? { actionedPostIds: [...lifecycle.actionedPostIds] }
      : {}),
    ...(lifecycle.unresolvedItems
      ? { unresolvedItems: [...lifecycle.unresolvedItems] }
      : {}),
    ...(lifecycle.counterNotice
      ? { counterNotice: { ...lifecycle.counterNotice } }
      : {}),
  };
}

function validateLifecycle(lifecycle: DmcaClaimLifecycleState): void {
  if (!CLAIM_STATUSES.has(lifecycle.status)) throw new TypeError('DMCA status is invalid');
  if (lifecycle.actionedPostIds?.some((id) => !id || id.length > 256)
    || lifecycle.unresolvedItems?.some((item) => !item || item.length > 256)) {
    throw new TypeError('DMCA lifecycle item is invalid');
  }
  if (lifecycle.actionedPostIds && lifecycle.actionedPostIds.length > 100) {
    throw new TypeError('DMCA lifecycle has too many actioned posts');
  }
  if (lifecycle.unresolvedItems && lifecycle.unresolvedItems.length > 200) {
    throw new TypeError('DMCA lifecycle has too many unresolved items');
  }
  if (lifecycle.counterNotice
    && (!lifecycle.counterNotice.statement
      || lifecycle.counterNotice.statement.length > 4096
      || !lifecycle.counterNotice.signature
      || lifecycle.counterNotice.signature.length > 512
      || !Number.isFinite(Date.parse(lifecycle.counterNotice.submittedAt)))) {
    throw new TypeError('DMCA counter notice is invalid');
  }
}

/** PostgreSQL-backed immutable DMCA notices and versioned lifecycle state. */
export class PostgresDmcaIntakeStore implements DmcaIntakeStore {
  constructor(private readonly context: PostgresStoreContext) {}

  private async run<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  create(record: DmcaClaimRecord): Promise<DmcaClaimRecord> {
    if (!CLAIM_ID.test(record.id)) throw new TypeError('DMCA claim id is invalid');
    const parsed = DmcaClaimSchema.safeParse(record);
    if (!parsed.success) throw new TypeError('DMCA claim payload is invalid');
    if (record.status !== 'received' || record.lifecycleVersion !== 1) {
      throw new TypeError('A new DMCA claim must start received at lifecycle version 1');
    }
    return this.run('create DMCA claim', async () => {
      const inserted = await this.context.query<DmcaDatabaseRow>(`
        INSERT INTO moderation.dmca_claims (
          claim_id, status, payload, lifecycle, received_at,
          updated_at, lifecycle_version
        ) VALUES (
          $1, 'received', $2::jsonb, '{}'::jsonb,
          clock_timestamp(), clock_timestamp(), 1
        )
        ON CONFLICT (claim_id) DO NOTHING
        RETURNING claim_id, status, payload, lifecycle, received_at, lifecycle_version
      `, [record.id, JSON.stringify(parsed.data)]);
      const insertedRow = inserted.rows[0];
      if (insertedRow) return decodeRecord(insertedRow);
      const existing = await this.context.query<DmcaDatabaseRow>(`
        SELECT claim_id, status, payload, lifecycle, received_at, lifecycle_version
        FROM moderation.dmca_claims
        WHERE claim_id = $1
      `, [record.id]);
      const row = existing.rows[0];
      if (!row) throw new Error('PostgreSQL DMCA claim disappeared after conflict');
      return decodeRecord(row);
    });
  }

  get(id: string): Promise<DmcaClaimRecord | null> {
    if (!CLAIM_ID.test(id)) return Promise.resolve(null);
    return this.run('get DMCA claim', async () => {
      const result = await this.context.query<DmcaDatabaseRow>(`
        SELECT claim_id, status, payload, lifecycle, received_at, lifecycle_version
        FROM moderation.dmca_claims
        WHERE claim_id = $1
      `, [id]);
      const row = result.rows[0];
      return row ? decodeRecord(row) : null;
    });
  }

  list(filter: { status?: DmcaClaimStatus; limit?: number } = {}): Promise<DmcaClaimRecord[]> {
    if (filter.status !== undefined && !CLAIM_STATUSES.has(filter.status)) {
      throw new TypeError('DMCA status is invalid');
    }
    const limit = filter.limit ?? 100;
    if (!Number.isSafeInteger(limit) || limit <= 0 || limit > 500) {
      throw new TypeError('DMCA list limit must be between 1 and 500');
    }
    return this.run('list DMCA claims', async () => {
      const result = await this.context.query<DmcaDatabaseRow>(`
        SELECT claim_id, status, payload, lifecycle, received_at, lifecycle_version
        FROM moderation.dmca_claims
        WHERE ($1::text IS NULL OR status = $1)
        ORDER BY received_at DESC, claim_id DESC
        LIMIT $2
      `, [filter.status ?? null, limit]);
      return result.rows.map(decodeRecord);
    });
  }

  compareAndSetLifecycle(
    input: DmcaClaimTransitionInput,
  ): Promise<DmcaClaimTransitionResult> {
    if (!CLAIM_ID.test(input.id)) throw new TypeError('DMCA claim id is invalid');
    if (!Number.isSafeInteger(input.expectedVersion) || input.expectedVersion <= 0) {
      throw new TypeError('DMCA expected lifecycle version is invalid');
    }
    validateLifecycle(input.lifecycle);
    return this.run('transition DMCA lifecycle', async () => {
      const updated = await this.context.query<DmcaDatabaseRow>(`
        UPDATE moderation.dmca_claims
        SET status = $3,
            lifecycle = lifecycle || $4::jsonb,
            updated_at = clock_timestamp(),
            lifecycle_version = lifecycle_version + 1
        WHERE claim_id = $1
          AND lifecycle_version = $2
        RETURNING claim_id, status, payload, lifecycle, received_at, lifecycle_version
      `, [
        input.id,
        input.expectedVersion,
        input.lifecycle.status,
        JSON.stringify(lifecyclePayload(input.lifecycle)),
      ]);
      const updatedRow = updated.rows[0];
      if (updatedRow) return { status: 'applied', record: decodeRecord(updatedRow) };

      const current = await this.context.query<DmcaDatabaseRow>(`
        SELECT claim_id, status, payload, lifecycle, received_at, lifecycle_version
        FROM moderation.dmca_claims
        WHERE claim_id = $1
      `, [input.id]);
      const currentRow = current.rows[0];
      return currentRow
        ? { status: 'conflict', record: decodeRecord(currentRow) }
        : { status: 'not_found' };
    });
  }
}
