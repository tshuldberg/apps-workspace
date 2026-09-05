import type { QueryResultRow } from 'pg';
import type {
  NcmecExportClaim,
  NcmecExportClaimInput,
  NcmecExportCompletionInput,
  NcmecFilingClaim,
  NcmecFilingClaimInput,
  NcmecFilingCompletionInput,
  NcmecFilingCompletionResult,
  NcmecQueueCounts,
  NcmecReportQueueStore,
  NcmecReportRecord,
  NcmecReportSource,
  NcmecReportStatus,
} from '../../ncmec-queue';
import { validateFilingCompletionInput, validateNcmecReportRecord } from '../../ncmec-queue';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

const REPORT_ID = /^[a-f0-9]{64}$/u;
const SAFE_OWNER = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const REPORT_SOURCES = new Set<NcmecReportSource>(['submit_scan', 'operator_report']);
const REPORT_STATUSES = new Set<NcmecReportStatus>(['queued', 'exported', 'filed', 'escalated']);
const MAX_LEASE_MS = 24 * 60 * 60 * 1000;
const PROVIDER_REF = /^[A-Za-z0-9_.:@/-]{1,256}$/u;
const ERROR_CODE = /^[A-Za-z0-9_.:-]{1,128}$/u;

interface NcmecDatabaseRow extends QueryResultRow {
  report_id: unknown;
  status: unknown;
  payload: unknown;
  detected_at: Date | string;
  fencing_token: string | number;
  provider_ref?: string | null;
  filed_at?: Date | string | null;
  filing_attempt_count?: string | number | null;
  last_filing_error_code?: string | null;
}

interface ClaimedDatabaseRow extends NcmecDatabaseRow {
  claim_owner: unknown;
  claim_active: unknown;
}

interface CountDatabaseRow extends QueryResultRow {
  status: unknown;
  count: string | number;
}

function positiveInteger(label: string, value: number, maximum: number): number {
  if (!Number.isSafeInteger(value) || value <= 0 || value > maximum) {
    throw new TypeError(`${label} must be an integer between 1 and ${maximum}`);
  }
  return value;
}

function safeInteger(value: string | number, label: string): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 0) {
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

function evidencePayload(record: NcmecReportRecord): Record<string, unknown> {
  return {
    source: record.source,
    publicationId: record.publicationId,
    reason: record.reason,
    ...(record.channelId ? { channelId: record.channelId } : {}),
    ...(record.postId ? { postId: record.postId } : {}),
    ...(record.personaPubkey ? { personaPubkey: record.personaPubkey } : {}),
    ...(record.matchedBlobHashes
      ? { matchedBlobHashes: [...record.matchedBlobHashes] }
      : {}),
    ...(record.reportKey ? { reportKey: record.reportKey } : {}),
  };
}

function decodeRecord(row: NcmecDatabaseRow): NcmecReportRecord {
  if (typeof row.report_id !== 'string' || !REPORT_ID.test(row.report_id)
    || typeof row.status !== 'string'
    || !REPORT_STATUSES.has(row.status as NcmecReportStatus)) {
    throw new Error('Invalid PostgreSQL NCMEC report columns');
  }
  const payload = jsonObject(row.payload, 'NCMEC report payload');
  if (typeof payload.source !== 'string'
    || !REPORT_SOURCES.has(payload.source as NcmecReportSource)
    || typeof payload.publicationId !== 'string'
    || typeof payload.reason !== 'string'
    || (payload.channelId !== undefined && typeof payload.channelId !== 'string')
    || (payload.postId !== undefined && typeof payload.postId !== 'string')
    || (payload.personaPubkey !== undefined && typeof payload.personaPubkey !== 'string')
    || (payload.reportKey !== undefined && typeof payload.reportKey !== 'string')
    || (payload.matchedBlobHashes !== undefined
      && (!Array.isArray(payload.matchedBlobHashes)
        || payload.matchedBlobHashes.some((hash) => typeof hash !== 'string')))) {
    throw new Error('Invalid PostgreSQL NCMEC report payload');
  }
  const status = row.status as NcmecReportStatus;
  const providerRef = typeof row.provider_ref === 'string' ? row.provider_ref : undefined;
  const filedAt = row.filed_at != null ? timestamp(row.filed_at, 'NCMEC filed_at') : undefined;
  if (status === 'filed' && (!providerRef || !filedAt)) {
    throw new Error('Invalid PostgreSQL NCMEC filed columns');
  }
  if (status !== 'filed' && (providerRef || filedAt)) {
    throw new Error('Invalid PostgreSQL NCMEC provider columns on non-filed report');
  }
  if (providerRef !== undefined && !PROVIDER_REF.test(providerRef)) {
    throw new Error('Invalid PostgreSQL NCMEC provider reference');
  }
  const lastFilingErrorCode = typeof row.last_filing_error_code === 'string'
    ? row.last_filing_error_code
    : undefined;
  if (lastFilingErrorCode !== undefined && !ERROR_CODE.test(lastFilingErrorCode)) {
    throw new Error('Invalid PostgreSQL NCMEC filing error code');
  }
  const filingAttemptCount = row.filing_attempt_count != null
    ? safeInteger(row.filing_attempt_count, 'NCMEC filing attempt count')
    : undefined;
  return {
    id: row.report_id,
    source: payload.source as NcmecReportSource,
    detectedAt: timestamp(row.detected_at, 'NCMEC detected_at'),
    publicationId: payload.publicationId,
    ...(typeof payload.channelId === 'string' ? { channelId: payload.channelId } : {}),
    ...(typeof payload.postId === 'string' ? { postId: payload.postId } : {}),
    ...(typeof payload.personaPubkey === 'string'
      ? { personaPubkey: payload.personaPubkey }
      : {}),
    ...(Array.isArray(payload.matchedBlobHashes)
      ? { matchedBlobHashes: [...payload.matchedBlobHashes] as string[] }
      : {}),
    ...(typeof payload.reportKey === 'string' ? { reportKey: payload.reportKey } : {}),
    reason: payload.reason,
    status,
    ...(providerRef !== undefined ? { providerRef } : {}),
    ...(filedAt !== undefined ? { filedAt } : {}),
    ...(filingAttemptCount !== undefined ? { filingAttemptCount } : {}),
    ...(lastFilingErrorCode !== undefined ? { lastFilingErrorCode } : {}),
  };
}

/** PostgreSQL-backed NCMEC evidence queue with lease-fenced export claims. */
export class PostgresNcmecReportQueueStore implements NcmecReportQueueStore {
  constructor(private readonly context: PostgresStoreContext) {}

  private async run<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  enqueue(record: NcmecReportRecord): Promise<NcmecReportRecord> {
    validateNcmecReportRecord(record);
    return this.run('enqueue NCMEC report', async () => {
      const inserted = await this.context.query<NcmecDatabaseRow>(`
        INSERT INTO moderation.ncmec_reports (
          report_id, status, payload, detected_at, updated_at,
          next_attempt_at, lifecycle_version
        ) VALUES (
          $1, 'queued', $2::jsonb, clock_timestamp(), clock_timestamp(),
          clock_timestamp(), 1
        )
        ON CONFLICT (report_id) DO NOTHING
        RETURNING report_id, status, payload, detected_at, fencing_token,
          provider_ref, filed_at, filing_attempt_count, last_filing_error_code
      `, [record.id, JSON.stringify(evidencePayload(record))]);
      const insertedRow = inserted.rows[0];
      if (insertedRow) return decodeRecord(insertedRow);
      const existing = await this.context.query<NcmecDatabaseRow>(`
        SELECT report_id, status, payload, detected_at, fencing_token,
          provider_ref, filed_at, filing_attempt_count, last_filing_error_code
        FROM moderation.ncmec_reports
        WHERE report_id = $1
      `, [record.id]);
      const row = existing.rows[0];
      if (!row) throw new Error('PostgreSQL NCMEC report disappeared after conflict');
      return decodeRecord(row);
    });
  }

  get(id: string): Promise<NcmecReportRecord | null> {
    if (!REPORT_ID.test(id)) return Promise.resolve(null);
    return this.run('get NCMEC report', async () => {
      const result = await this.context.query<NcmecDatabaseRow>(`
        SELECT report_id, status, payload, detected_at, fencing_token,
          provider_ref, filed_at, filing_attempt_count, last_filing_error_code
        FROM moderation.ncmec_reports
        WHERE report_id = $1
      `, [id]);
      const row = result.rows[0];
      return row ? decodeRecord(row) : null;
    });
  }

  list(filter: { status?: NcmecReportStatus; limit?: number } = {}): Promise<NcmecReportRecord[]> {
    if (filter.status !== undefined && !REPORT_STATUSES.has(filter.status)) {
      throw new TypeError('NCMEC report status is invalid');
    }
    const limit = positiveInteger('NCMEC list limit', filter.limit ?? 200, 1000);
    return this.run('list NCMEC reports', async () => {
      const result = await this.context.query<NcmecDatabaseRow>(`
        SELECT report_id, status, payload, detected_at, fencing_token,
          provider_ref, filed_at, filing_attempt_count, last_filing_error_code
        FROM moderation.ncmec_reports
        WHERE ($1::text IS NULL OR status = $1)
        ORDER BY detected_at DESC, report_id DESC
        LIMIT $2
      `, [filter.status ?? null, limit]);
      return result.rows.map(decodeRecord);
    });
  }

  claimQueuedForExport(input: NcmecExportClaimInput): Promise<NcmecExportClaim[]> {
    if (!SAFE_OWNER.test(input.owner)) throw new TypeError('NCMEC export owner is invalid');
    const limit = positiveInteger('NCMEC export limit', input.limit, 1000);
    const leaseMs = positiveInteger('NCMEC export leaseMs', input.leaseMs, MAX_LEASE_MS);
    return this.run('claim NCMEC export batch', async () => {
      const result = await this.context.transaction(async () => this.context.query<NcmecDatabaseRow>(`
        WITH candidates AS (
          SELECT report_id
          FROM moderation.ncmec_reports
          WHERE status = 'queued'
            AND next_attempt_at <= clock_timestamp()
            AND (claim_owner IS NULL OR claim_expires_at <= clock_timestamp())
          ORDER BY detected_at ASC, report_id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE moderation.ncmec_reports AS reports
        SET claim_owner = $2,
            claim_expires_at = clock_timestamp() + ($3::bigint * interval '1 millisecond'),
            fencing_token = reports.fencing_token + 1,
            attempt_count = reports.attempt_count + 1,
            updated_at = clock_timestamp(),
            lifecycle_version = reports.lifecycle_version + 1
        FROM candidates
        WHERE reports.report_id = candidates.report_id
        RETURNING reports.report_id, reports.status, reports.payload,
          reports.detected_at, reports.fencing_token,
          reports.provider_ref, reports.filed_at, reports.filing_attempt_count,
          reports.last_filing_error_code
      `, [limit, input.owner, leaseMs]));
      return result.rows
        .map((row) => ({
          record: decodeRecord(row),
          fencingToken: safeInteger(row.fencing_token, 'NCMEC fencing token'),
        }))
        .sort((left, right) => {
          if (left.record.detectedAt !== right.record.detectedAt) {
            return left.record.detectedAt < right.record.detectedAt ? -1 : 1;
          }
          return left.record.id.localeCompare(right.record.id);
        });
    });
  }

  completeExportClaims(input: NcmecExportCompletionInput): Promise<boolean> {
    if (!SAFE_OWNER.test(input.owner)) throw new TypeError('NCMEC export owner is invalid');
    if (!Number.isSafeInteger(input.nowMs) || input.nowMs < 0) {
      throw new TypeError('NCMEC export completion clock is invalid');
    }
    if (input.status !== 'exported' && input.status !== 'filed') {
      throw new TypeError('NCMEC export completion status is invalid');
    }
    const ids = input.claims.map((claim) => {
      if (!REPORT_ID.test(claim.id)) throw new TypeError('NCMEC report id is invalid');
      positiveInteger('NCMEC fencing token', claim.fencingToken, Number.MAX_SAFE_INTEGER);
      return claim.id;
    });
    if (new Set(ids).size !== ids.length) throw new TypeError('NCMEC export claims must be unique');
    if (ids.length === 0) return Promise.resolve(true);
    if (ids.length > 1000) throw new TypeError('NCMEC export completion exceeds 1000 claims');
    const fencingTokens = input.claims.map((claim) => claim.fencingToken);

    return this.run('complete NCMEC export batch', () => this.context.transaction(async () => {
      const selected = await this.context.query<ClaimedDatabaseRow>(`
        SELECT report_id, status, payload, detected_at, fencing_token,
          provider_ref, filed_at, filing_attempt_count, last_filing_error_code,
          claim_owner, claim_expires_at > clock_timestamp() AS claim_active
        FROM moderation.ncmec_reports
        WHERE report_id = ANY($1::text[])
        ORDER BY report_id
        FOR UPDATE
      `, [ids]);
      if (selected.rows.length !== ids.length) return false;
      const expected = new Map(input.claims.map((claim) => [claim.id, claim.fencingToken]));
      for (const row of selected.rows) {
        if (typeof row.report_id !== 'string' || row.status !== 'queued'
          || row.claim_owner !== input.owner || row.claim_active !== true
          || safeInteger(row.fencing_token, 'NCMEC fencing token') !== expected.get(row.report_id)) {
          return false;
        }
      }

      const updated = await this.context.query<QueryResultRow>(`
        UPDATE moderation.ncmec_reports AS reports
        SET status = $4,
            claim_owner = NULL,
            claim_expires_at = NULL,
            last_error_code = NULL,
            updated_at = clock_timestamp(),
            lifecycle_version = reports.lifecycle_version + 1
        FROM unnest($1::text[], $2::bigint[]) AS claims(report_id, fencing_token)
        WHERE reports.report_id = claims.report_id
          AND reports.status = 'queued'
          AND reports.claim_owner = $3
          AND reports.fencing_token = claims.fencing_token
          AND reports.claim_expires_at > clock_timestamp()
        RETURNING reports.report_id
      `, [ids, fencingTokens, input.owner, input.status]);
      if (updated.rowCount !== ids.length) {
        throw new Error('PostgreSQL NCMEC claims changed while locked');
      }
      return true;
    }));
  }

  claimQueuedForFiling(input: NcmecFilingClaimInput): Promise<NcmecFilingClaim[]> {
    if (!SAFE_OWNER.test(input.owner)) throw new TypeError('NCMEC filing owner is invalid');
    const limit = positiveInteger('NCMEC filing limit', input.limit, 1000);
    const leaseMs = positiveInteger('NCMEC filing leaseMs', input.leaseMs, MAX_LEASE_MS);
    return this.run('claim NCMEC filing batch', async () => {
      const result = await this.context.transaction(async () => this.context.query<NcmecDatabaseRow>(`
        WITH candidates AS (
          SELECT report_id
          FROM moderation.ncmec_reports
          WHERE status = 'queued'
            AND next_filing_attempt_at <= clock_timestamp()
            AND (claim_owner IS NULL OR claim_expires_at <= clock_timestamp())
          ORDER BY next_filing_attempt_at ASC, detected_at ASC, report_id ASC
          FOR UPDATE SKIP LOCKED
          LIMIT $1
        )
        UPDATE moderation.ncmec_reports AS reports
        SET claim_owner = $2,
            claim_expires_at = clock_timestamp() + ($3::bigint * interval '1 millisecond'),
            fencing_token = reports.fencing_token + 1,
            filing_attempt_count = reports.filing_attempt_count + 1,
            updated_at = clock_timestamp(),
            lifecycle_version = reports.lifecycle_version + 1
        FROM candidates
        WHERE reports.report_id = candidates.report_id
        RETURNING reports.report_id, reports.status, reports.payload,
          reports.detected_at, reports.fencing_token,
          reports.provider_ref, reports.filed_at, reports.filing_attempt_count,
          reports.last_filing_error_code
      `, [limit, input.owner, leaseMs]));
      return result.rows
        .map((row) => ({
          record: decodeRecord(row),
          fencingToken: safeInteger(row.fencing_token, 'NCMEC fencing token'),
          filingAttemptCount: safeInteger(
            row.filing_attempt_count ?? 0,
            'NCMEC filing attempt count',
          ),
        }))
        .sort((left, right) => {
          if (left.record.detectedAt !== right.record.detectedAt) {
            return left.record.detectedAt < right.record.detectedAt ? -1 : 1;
          }
          return left.record.id.localeCompare(right.record.id);
        });
    });
  }

  completeFiling(input: NcmecFilingCompletionInput): Promise<NcmecFilingCompletionResult> {
    validateFilingCompletionInput(input);
    const { resolution } = input;
    return this.run('complete NCMEC filing', () => this.context.transaction(async () => {
      // Fenced terminal update. The predicate binds owner + fencing token + live lease, so a stale
      // worker whose lease was reclaimed affects zero rows and can never mark filed.
      let updated;
      if (resolution.kind === 'filed') {
        updated = await this.context.query(`
          UPDATE moderation.ncmec_reports AS reports
          SET status = 'filed',
              provider_ref = $4,
              filed_at = clock_timestamp(),
              claim_owner = NULL,
              claim_expires_at = NULL,
              last_filing_error_code = NULL,
              updated_at = clock_timestamp(),
              lifecycle_version = reports.lifecycle_version + 1
          WHERE reports.report_id = $1
            AND reports.status = 'queued'
            AND reports.claim_owner = $2
            AND reports.fencing_token = $3
            AND reports.claim_expires_at > clock_timestamp()
        `, [input.id, input.owner, input.fencingToken, resolution.providerRef]);
      } else if (resolution.kind === 'escalated') {
        updated = await this.context.query(`
          UPDATE moderation.ncmec_reports AS reports
          SET status = 'escalated',
              claim_owner = NULL,
              claim_expires_at = NULL,
              last_filing_error_code = $4,
              updated_at = clock_timestamp(),
              lifecycle_version = reports.lifecycle_version + 1
          WHERE reports.report_id = $1
            AND reports.status = 'queued'
            AND reports.claim_owner = $2
            AND reports.fencing_token = $3
            AND reports.claim_expires_at > clock_timestamp()
        `, [input.id, input.owner, input.fencingToken, resolution.errorCode]);
      } else {
        updated = await this.context.query(`
          UPDATE moderation.ncmec_reports AS reports
          SET claim_owner = NULL,
              claim_expires_at = NULL,
              last_filing_error_code = $4,
              next_filing_attempt_at = clock_timestamp() + ($5::bigint * interval '1 millisecond'),
              updated_at = clock_timestamp(),
              lifecycle_version = reports.lifecycle_version + 1
          WHERE reports.report_id = $1
            AND reports.status = 'queued'
            AND reports.claim_owner = $2
            AND reports.fencing_token = $3
            AND reports.claim_expires_at > clock_timestamp()
        `, [
          input.id,
          input.owner,
          input.fencingToken,
          resolution.errorCode,
          Math.max(0, resolution.nextAttemptAtMs - input.nowMs),
        ]);
      }
      return updated.rowCount === 1 ? 'committed' : 'lease_lost';
    }));
  }

  counts(): Promise<NcmecQueueCounts> {
    return this.run('count NCMEC reports', async () => {
      const result = await this.context.query<CountDatabaseRow>(`
        SELECT status, count(*) AS count
        FROM moderation.ncmec_reports
        GROUP BY status
      `);
      const counts: NcmecQueueCounts = { queued: 0, exported: 0, filed: 0, escalated: 0, total: 0 };
      for (const row of result.rows) {
        if (typeof row.status !== 'string'
          || !REPORT_STATUSES.has(row.status as NcmecReportStatus)) {
          throw new Error('Invalid PostgreSQL NCMEC count status');
        }
        const count = safeInteger(row.count, 'NCMEC count');
        counts[row.status as NcmecReportStatus] = count;
        counts.total += count;
      }
      return counts;
    });
  }
}
