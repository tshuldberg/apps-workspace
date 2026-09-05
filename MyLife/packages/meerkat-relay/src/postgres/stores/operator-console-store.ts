import { createHash } from 'node:crypto';
import type { QueryResultRow } from 'pg';
import type {
  OperatorAuditRow,
  OperatorConsoleStore,
  OperatorTriageDecisionInput,
  OperatorTriageDecisionResult,
  ReportTriageRow,
} from '../../operator-console';
import {
  PostgresStoreContext,
  toPostgresStoreUnavailableError,
} from '../store-context';

const ACTOR_KEY = /^[a-f0-9]{64}$/u;
const AUDIT_ACTIONS = new Set<OperatorAuditRow['action']>([
  'report_reviewed',
  'report_dismissed',
  'post_tombstoned',
  'posting_freeze_set',
  'publication_killed',
  'persona_suspended',
  'persona_unsuspended',
  'dmca_takedown',
  'dmca_counter_notice',
  'dmca_rejected',
]);
const TRIAGE_STATUSES = new Set<ReportTriageRow['status']>([
  'reviewed',
  'dismissed',
  'actioned',
]);

interface AuditDatabaseRow extends QueryResultRow {
  seq: string | number;
  action: unknown;
  payload: unknown;
  created_at: Date | string;
}

interface TriageDatabaseRow extends QueryResultRow {
  report_key: unknown;
  status: unknown;
  payload: unknown;
  updated_at: Date | string;
}

interface CountDatabaseRow extends QueryResultRow {
  count: string | number;
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

function assertBoundedText(label: string, value: string, maximum: number): void {
  if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
    throw new TypeError(`${label} must be between 1 and ${maximum} characters`);
  }
}

function validateAudit(row: Omit<OperatorAuditRow, 'seq'>): void {
  if (!ACTOR_KEY.test(row.actorKeyHex)) throw new TypeError('Operator actor key is invalid');
  if (!AUDIT_ACTIONS.has(row.action)) throw new TypeError('Operator audit action is invalid');
  assertBoundedText('Operator audit outcome', row.outcome, 256);
  if (row.reason.length > 4096) throw new TypeError('Operator audit reason is too long');
  if (!row.target || typeof row.target !== 'object') {
    throw new TypeError('Operator audit target must be an object');
  }
}

function validateTriage(row: Omit<ReportTriageRow, 'auditSeq'> | ReportTriageRow): void {
  assertBoundedText('Report key', row.reportKey, 512);
  if (!TRIAGE_STATUSES.has(row.status)) throw new TypeError('Report triage status is invalid');
  if (row.note !== undefined && row.note.length > 4096) {
    throw new TypeError('Report triage note is too long');
  }
}

function auditPayload(row: Omit<OperatorAuditRow, 'seq'>): Record<string, unknown> {
  return {
    actorKeyHex: row.actorKeyHex,
    target: { ...row.target },
    reason: row.reason,
    outcome: row.outcome,
    ...(row.actionSignature ? { actionSignature: row.actionSignature } : {}),
  };
}

function decodeAudit(row: AuditDatabaseRow): OperatorAuditRow {
  if (typeof row.action !== 'string' || !AUDIT_ACTIONS.has(row.action as OperatorAuditRow['action'])) {
    throw new Error('Invalid PostgreSQL operator audit action');
  }
  const payload = jsonObject(row.payload, 'operator audit payload');
  if (typeof payload.actorKeyHex !== 'string' || !ACTOR_KEY.test(payload.actorKeyHex)
    || typeof payload.reason !== 'string' || typeof payload.outcome !== 'string'
    || !payload.target || typeof payload.target !== 'object' || Array.isArray(payload.target)
    || (payload.actionSignature !== undefined && typeof payload.actionSignature !== 'string')) {
    throw new Error('Invalid PostgreSQL operator audit payload');
  }
  return {
    seq: safeInteger(row.seq, 'operator audit sequence'),
    at: timestamp(row.created_at, 'operator audit created_at'),
    actorKeyHex: payload.actorKeyHex,
    action: row.action as OperatorAuditRow['action'],
    target: { ...payload.target } as OperatorAuditRow['target'],
    reason: payload.reason,
    outcome: payload.outcome,
    ...(typeof payload.actionSignature === 'string'
      ? { actionSignature: payload.actionSignature }
      : {}),
  };
}

function triagePayload(row: ReportTriageRow): Record<string, unknown> {
  return {
    auditSeq: row.auditSeq,
    ...(row.note ? { note: row.note } : {}),
  };
}

function decodeTriage(row: TriageDatabaseRow): ReportTriageRow {
  if (typeof row.report_key !== 'string'
    || typeof row.status !== 'string'
    || !TRIAGE_STATUSES.has(row.status as ReportTriageRow['status'])) {
    throw new Error('Invalid PostgreSQL report triage columns');
  }
  const payload = jsonObject(row.payload, 'report triage payload');
  if ((payload.note !== undefined && typeof payload.note !== 'string')
    || (typeof payload.auditSeq !== 'string' && typeof payload.auditSeq !== 'number')) {
    throw new Error('Invalid PostgreSQL report triage payload');
  }
  return {
    reportKey: row.report_key,
    status: row.status as ReportTriageRow['status'],
    decidedAt: timestamp(row.updated_at, 'report triage updated_at'),
    ...(typeof payload.note === 'string' ? { note: payload.note } : {}),
    auditSeq: safeInteger(payload.auditSeq, 'report triage audit sequence'),
  };
}

/** PostgreSQL-backed immutable moderation audit and mutable report triage. */
export class PostgresOperatorConsoleStore implements OperatorConsoleStore {
  constructor(private readonly context: PostgresStoreContext) {}

  private async run<T>(operation: string, callback: () => Promise<T>): Promise<T> {
    try {
      return await callback();
    } catch (error) {
      throw toPostgresStoreUnavailableError(operation, error);
    }
  }

  private async insertAudit(row: Omit<OperatorAuditRow, 'seq'>): Promise<OperatorAuditRow> {
    validateAudit(row);
    const actorHash = createHash('sha256').update(row.actorKeyHex, 'utf8').digest('hex');
    const inserted = await this.context.query<AuditDatabaseRow>(`
      INSERT INTO moderation.operator_audit (
        action, actor_hash, payload, created_at
      ) VALUES ($1, $2, $3::jsonb, clock_timestamp())
      RETURNING seq, action, payload, created_at
    `, [row.action, actorHash, JSON.stringify(auditPayload(row))]);
    const stored = inserted.rows[0];
    if (!stored) throw new Error('PostgreSQL operator audit insert returned no row');
    return decodeAudit(stored);
  }

  appendAudit(row: Omit<OperatorAuditRow, 'seq'>): Promise<OperatorAuditRow> {
    return this.run('append operator audit', () => this.insertAudit(row));
  }

  recordTriageDecision(
    input: OperatorTriageDecisionInput,
  ): Promise<OperatorTriageDecisionResult> {
    validateAudit(input.audit);
    validateTriage(input.triage);
    return this.run('record operator triage decision', () =>
      this.context.withAdvisoryTransactionLock(
        'moderation.triage',
        input.triage.reportKey,
        async () => {
          const audit = await this.insertAudit(input.audit);
          const triageInput: ReportTriageRow = {
            ...input.triage,
            auditSeq: audit.seq,
          };
          const stored = await this.context.query<TriageDatabaseRow>(`
            INSERT INTO moderation.triage (
              report_key, status, payload, updated_at, lifecycle_version
            ) VALUES ($1, $2, $3::jsonb, clock_timestamp(), 1)
            ON CONFLICT (report_key) DO UPDATE SET
              status = EXCLUDED.status,
              payload = EXCLUDED.payload,
              updated_at = clock_timestamp(),
              lifecycle_version = moderation.triage.lifecycle_version + 1
            RETURNING report_key, status, payload, updated_at
          `, [
            triageInput.reportKey,
            triageInput.status,
            JSON.stringify(triagePayload(triageInput)),
          ]);
          const row = stored.rows[0];
          if (!row) throw new Error('PostgreSQL report triage upsert returned no row');
          return { audit, triage: decodeTriage(row) };
        },
      ));
  }

  listAudit(limit: number, beforeSeq?: number): Promise<OperatorAuditRow[]> {
    const bound = Math.max(1, Math.min(200, Math.floor(limit)));
    if (beforeSeq !== undefined && (!Number.isSafeInteger(beforeSeq) || beforeSeq <= 0)) {
      throw new TypeError('Operator audit cursor must be a positive safe integer');
    }
    return this.run('list operator audit', async () => {
      const result = await this.context.query<AuditDatabaseRow>(`
        SELECT seq, action, payload, created_at
        FROM moderation.operator_audit
        WHERE ($2::bigint IS NULL OR seq < $2)
        ORDER BY seq DESC
        LIMIT $1
      `, [bound, beforeSeq ?? null]);
      return result.rows.map(decodeAudit);
    });
  }

  auditCount(): Promise<number> {
    return this.run('count operator audit', async () => {
      const result = await this.context.query<CountDatabaseRow>(
        'SELECT count(*) AS count FROM moderation.operator_audit',
      );
      const row = result.rows[0];
      if (!row) throw new Error('PostgreSQL operator audit count returned no row');
      return safeInteger(row.count, 'operator audit count');
    });
  }

  getTriage(reportKey: string): Promise<ReportTriageRow | null> {
    assertBoundedText('Report key', reportKey, 512);
    return this.run('get report triage', async () => {
      const result = await this.context.query<TriageDatabaseRow>(`
        SELECT report_key, status, payload, updated_at
        FROM moderation.triage
        WHERE report_key = $1
      `, [reportKey]);
      const row = result.rows[0];
      return row ? decodeTriage(row) : null;
    });
  }

  putTriage(row: ReportTriageRow): Promise<void> {
    validateTriage(row);
    if (!Number.isSafeInteger(row.auditSeq) || row.auditSeq <= 0) {
      throw new TypeError('Report triage audit sequence must be a positive safe integer');
    }
    return this.run('put report triage', () =>
      this.context.withAdvisoryTransactionLock('moderation.triage', row.reportKey, async () => {
        await this.context.query(`
          INSERT INTO moderation.triage (
            report_key, status, payload, updated_at, lifecycle_version
          ) VALUES ($1, $2, $3::jsonb, clock_timestamp(), 1)
          ON CONFLICT (report_key) DO UPDATE SET
            status = EXCLUDED.status,
            payload = EXCLUDED.payload,
            updated_at = clock_timestamp(),
            lifecycle_version = moderation.triage.lifecycle_version + 1
        `, [row.reportKey, row.status, JSON.stringify(triagePayload(row))]);
      }));
  }

  listTriage(): Promise<ReportTriageRow[]> {
    return this.run('list report triage', async () => {
      const result = await this.context.query<TriageDatabaseRow>(`
        SELECT report_key, status, payload, updated_at
        FROM moderation.triage
        ORDER BY updated_at DESC, report_key DESC
      `);
      return result.rows.map(decodeTriage);
    });
  }

  deleteTriage(reportKey: string): Promise<void> {
    assertBoundedText('Report key', reportKey, 512);
    return this.run('delete report triage', () =>
      this.context.withAdvisoryTransactionLock('moderation.triage', reportKey, async () => {
        await this.context.query(
          'DELETE FROM moderation.triage WHERE report_key = $1',
          [reportKey],
        );
      }));
  }
}
