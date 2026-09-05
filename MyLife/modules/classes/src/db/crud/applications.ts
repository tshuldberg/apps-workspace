import type { DatabaseAdapter } from '@mylife/db';
import {
  ApplicationInputSchema,
  ApplicationRowSchema,
  ApplicationUpdateSchema,
  type ApplicationInput,
  type ApplicationRow,
  type ApplicationStatus,
  type ApplicationType,
  type ApplicationUpdate,
} from '../../models/schemas';

const DEFAULT_STATUS: ApplicationStatus = 'considering';

function serializeStringArray(
  value: string[] | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (value.length === 0) return null;
  return JSON.stringify(value);
}

function toBool(input: boolean | undefined): number {
  return input ? 1 : 0;
}

export function createApplication(
  db: DatabaseAdapter,
  id: string,
  input: ApplicationInput,
): ApplicationRow {
  const parsed = ApplicationInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: ApplicationRow = {
    id,
    name: parsed.name,
    institution: parsed.institution ?? null,
    type: parsed.type,
    program: parsed.program ?? null,
    deadline: parsed.deadline ?? null,
    early_deadline: parsed.early_deadline ?? null,
    decision_date: parsed.decision_date ?? null,
    status: parsed.status ?? DEFAULT_STATUS,
    application_url: parsed.application_url ?? null,
    portal_url: parsed.portal_url ?? null,
    application_fee: parsed.application_fee ?? null,
    fee_waiver_status: parsed.fee_waiver_status ?? null,
    required_test_score_ids: serializeStringArray(parsed.required_test_score_ids),
    required_essays_count: parsed.required_essays_count ?? 0,
    essays_drafted: parsed.essays_drafted ?? 0,
    essays_finalized: parsed.essays_finalized ?? 0,
    recommenders_required: parsed.recommenders_required ?? 0,
    recommenders_confirmed: parsed.recommenders_confirmed ?? 0,
    transcripts_requested: toBool(parsed.transcripts_requested),
    transcripts_sent: toBool(parsed.transcripts_sent),
    notes_md: parsed.notes_md ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO cs_applications
      (id, name, institution, type, program, deadline, early_deadline, decision_date,
       status, application_url, portal_url, application_fee, fee_waiver_status,
       required_test_score_ids, required_essays_count, essays_drafted, essays_finalized,
       recommenders_required, recommenders_confirmed, transcripts_requested,
       transcripts_sent, notes_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.institution,
      row.type,
      row.program,
      row.deadline,
      row.early_deadline,
      row.decision_date,
      row.status,
      row.application_url,
      row.portal_url,
      row.application_fee,
      row.fee_waiver_status,
      row.required_test_score_ids,
      row.required_essays_count,
      row.essays_drafted,
      row.essays_finalized,
      row.recommenders_required,
      row.recommenders_confirmed,
      row.transcripts_requested,
      row.transcripts_sent,
      row.notes_md,
      row.created_at,
      row.updated_at,
    ],
  );

  return ApplicationRowSchema.parse(row);
}

export function getApplication(
  db: DatabaseAdapter,
  id: string,
): ApplicationRow | null {
  const rows = db.query<ApplicationRow>(
    `SELECT * FROM cs_applications WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? ApplicationRowSchema.parse(rows[0]) : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'name',
  'institution',
  'type',
  'program',
  'deadline',
  'early_deadline',
  'decision_date',
  'status',
  'application_url',
  'portal_url',
  'application_fee',
  'fee_waiver_status',
  'required_essays_count',
  'essays_drafted',
  'essays_finalized',
  'recommenders_required',
  'recommenders_confirmed',
  'notes_md',
]);

export function updateApplication(
  db: DatabaseAdapter,
  id: string,
  updates: ApplicationUpdate,
): void {
  const parsed = ApplicationUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'required_test_score_ids') {
      fields.push('required_test_score_ids = ?');
      values.push(serializeStringArray(value as string[] | null | undefined));
      continue;
    }
    if (key === 'transcripts_requested' || key === 'transcripts_sent') {
      fields.push(`${key} = ?`);
      values.push(toBool(value as boolean | undefined));
      continue;
    }
    if (!SCALAR_UPDATABLE_COLUMNS.has(key)) continue;
    fields.push(`${key} = ?`);
    values.push(value ?? null);
  }

  if (fields.length === 0) return;

  fields.push('updated_at = ?');
  values.push(new Date().toISOString());

  db.execute(
    `UPDATE cs_applications SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteApplication(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM cs_applications WHERE id = ?`, [id]);
}

export interface ApplicationFilter {
  status?: ApplicationStatus;
  type?: ApplicationType;
}

export function listApplications(
  db: DatabaseAdapter,
  filter?: ApplicationFilter,
): ApplicationRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter?.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  if (filter?.type) {
    where.push('type = ?');
    params.push(filter.type);
  }
  const sql = `SELECT * FROM cs_applications${
    where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
  } ORDER BY COALESCE(deadline, created_at) ASC`;
  return db
    .query<ApplicationRow>(sql, params)
    .map((row) => ApplicationRowSchema.parse(row));
}

export function listUpcomingDeadlines(
  db: DatabaseAdapter,
  daysAhead: number,
  now?: Date,
): ApplicationRow[] {
  const start = (now ?? new Date()).toISOString();
  const end = new Date(
    (now ?? new Date()).getTime() + daysAhead * 86_400_000,
  ).toISOString();
  return db
    .query<ApplicationRow>(
      `SELECT * FROM cs_applications
       WHERE deadline IS NOT NULL
         AND deadline >= ?
         AND deadline <= ?
         AND status NOT IN ('submitted','accepted','rejected','withdrawn')
       ORDER BY deadline ASC`,
      [start, end],
    )
    .map((row) => ApplicationRowSchema.parse(row));
}

/**
 * getApplicationCompletionPercent: weighted average across present components.
 *  - tasks: done / total (skipped tasks count as done)
 *  - essays: essays_finalized / required_essays_count
 *  - recommenders: recommenders_confirmed / recommenders_required
 *  - transcripts: transcripts_sent (treated as 0 or 1 of transcripts_requested)
 *
 * A component is skipped when its denominator is 0.
 * Returns 100 when no components apply.
 */
export function getApplicationCompletionPercent(
  db: DatabaseAdapter,
  id: string,
): number {
  const app = getApplication(db, id);
  if (!app) return 0;

  const taskRow = db.query<{ total: number; done: number }>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status IN ('done','skipped') THEN 1 ELSE 0 END) AS done
     FROM cs_application_tasks
     WHERE application_id = ?`,
    [id],
  )[0];

  const components: number[] = [];
  if (taskRow && taskRow.total > 0) {
    components.push(taskRow.done / taskRow.total);
  }
  if (app.required_essays_count > 0) {
    components.push(
      Math.min(1, app.essays_finalized / app.required_essays_count),
    );
  }
  if (app.recommenders_required > 0) {
    components.push(
      Math.min(1, app.recommenders_confirmed / app.recommenders_required),
    );
  }
  if (app.transcripts_requested === 1) {
    components.push(app.transcripts_sent === 1 ? 1 : 0);
  }
  if (components.length === 0) return 100;
  const avg = components.reduce((s, v) => s + v, 0) / components.length;
  return Math.round(avg * 100);
}
