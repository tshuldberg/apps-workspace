import type { DatabaseAdapter } from '@mylife/db';
import {
  StandardizedTestInputSchema,
  StandardizedTestRowSchema,
  StandardizedTestUpdateSchema,
  type SectionScores,
  type StandardizedTestCategory,
  type StandardizedTestInput,
  type StandardizedTestRow,
  type StandardizedTestStatus,
  type StandardizedTestUpdate,
} from '../../models/schemas';

const DEFAULT_STATUS: StandardizedTestStatus = 'planned';

function serializeSectionScores(
  value: SectionScores | null | undefined,
): string | null {
  if (value === undefined || value === null) return null;
  if (Object.keys(value).length === 0) return null;
  return JSON.stringify(value);
}

function parseSectionScores(raw: string | null): SectionScores | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
    const out: SectionScores = {};
    for (const [k, v] of Object.entries(parsed)) {
      if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    }
    return out;
  } catch {
    return null;
  }
}

function toBool(input: boolean | undefined): number {
  return input ? 1 : 0;
}

export function createStandardizedTest(
  db: DatabaseAdapter,
  id: string,
  input: StandardizedTestInput,
): StandardizedTestRow {
  const parsed = StandardizedTestInputSchema.parse(input);
  const now = new Date().toISOString();

  const row: StandardizedTestRow = {
    id,
    name: parsed.name,
    category: parsed.category,
    test_date: parsed.test_date ?? null,
    registration_deadline: parsed.registration_deadline ?? null,
    location: parsed.location ?? null,
    score: parsed.score ?? null,
    max_score: parsed.max_score ?? null,
    percentile: parsed.percentile ?? null,
    section_scores: serializeSectionScores(parsed.section_scores),
    status: parsed.status ?? DEFAULT_STATUS,
    superscore_eligible: toBool(parsed.superscore_eligible),
    notes_md: parsed.notes_md ?? null,
    created_at: now,
    updated_at: now,
  };

  db.execute(
    `INSERT INTO cs_standardized_tests
      (id, name, category, test_date, registration_deadline, location, score,
       max_score, percentile, section_scores, status, superscore_eligible,
       notes_md, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.name,
      row.category,
      row.test_date,
      row.registration_deadline,
      row.location,
      row.score,
      row.max_score,
      row.percentile,
      row.section_scores,
      row.status,
      row.superscore_eligible,
      row.notes_md,
      row.created_at,
      row.updated_at,
    ],
  );

  return StandardizedTestRowSchema.parse(row);
}

export function getStandardizedTest(
  db: DatabaseAdapter,
  id: string,
): StandardizedTestRow | null {
  const rows = db.query<StandardizedTestRow>(
    `SELECT * FROM cs_standardized_tests WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? StandardizedTestRowSchema.parse(rows[0]) : null;
}

const SCALAR_UPDATABLE_COLUMNS = new Set([
  'name',
  'category',
  'test_date',
  'registration_deadline',
  'location',
  'score',
  'max_score',
  'percentile',
  'status',
  'notes_md',
]);

export function updateStandardizedTest(
  db: DatabaseAdapter,
  id: string,
  updates: StandardizedTestUpdate,
): void {
  const parsed = StandardizedTestUpdateSchema.parse(updates);
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(parsed)) {
    if (key === 'section_scores') {
      fields.push('section_scores = ?');
      values.push(serializeSectionScores(value as SectionScores | null | undefined));
      continue;
    }
    if (key === 'superscore_eligible') {
      fields.push('superscore_eligible = ?');
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
    `UPDATE cs_standardized_tests SET ${fields.join(', ')} WHERE id = ?`,
    [...values, id],
  );
}

export function deleteStandardizedTest(
  db: DatabaseAdapter,
  id: string,
): void {
  db.execute(`DELETE FROM cs_standardized_tests WHERE id = ?`, [id]);
}

export interface StandardizedTestFilter {
  category?: StandardizedTestCategory;
  status?: StandardizedTestStatus;
}

export function listStandardizedTests(
  db: DatabaseAdapter,
  filter?: StandardizedTestFilter,
): StandardizedTestRow[] {
  const where: string[] = [];
  const params: unknown[] = [];
  if (filter?.category) {
    where.push('category = ?');
    params.push(filter.category);
  }
  if (filter?.status) {
    where.push('status = ?');
    params.push(filter.status);
  }
  const sql = `SELECT * FROM cs_standardized_tests${
    where.length > 0 ? ` WHERE ${where.join(' AND ')}` : ''
  } ORDER BY COALESCE(test_date, registration_deadline, created_at) DESC`;
  return db
    .query<StandardizedTestRow>(sql, params)
    .map((row) => StandardizedTestRowSchema.parse(row));
}

/**
 * getUpcomingTests: registered or planned tests with a test_date inside
 * [now, now + daysAhead]. Sorted ascending by test_date.
 */
export function getUpcomingTests(
  db: DatabaseAdapter,
  daysAhead: number,
  now?: Date,
): StandardizedTestRow[] {
  const start = (now ?? new Date()).toISOString();
  const end = new Date(
    (now ?? new Date()).getTime() + daysAhead * 86_400_000,
  ).toISOString();
  return db
    .query<StandardizedTestRow>(
      `SELECT * FROM cs_standardized_tests
       WHERE status IN ('planned','registered')
         AND test_date IS NOT NULL
         AND test_date >= ?
         AND test_date <= ?
       ORDER BY test_date ASC`,
      [start, end],
    )
    .map((row) => StandardizedTestRowSchema.parse(row));
}

/**
 * getBestScoreByName: highest non-null score for a given test name.
 * When superscore_eligible=1 across multiple completed sittings, returns
 * the sum of the per-section bests (superscore). Otherwise returns the
 * single highest overall `score`. Returns null when no completed test
 * with a score is found.
 */
export function getBestScoreByName(
  db: DatabaseAdapter,
  name: string,
): number | null {
  const rows = db
    .query<StandardizedTestRow>(
      `SELECT * FROM cs_standardized_tests
       WHERE name = ? AND status = 'completed'`,
      [name],
    )
    .map((row) => StandardizedTestRowSchema.parse(row));

  if (rows.length === 0) return null;

  const eligible = rows.filter((r) => r.superscore_eligible === 1);
  if (eligible.length > 0) {
    const sectionBests = new Map<string, number>();
    for (const r of eligible) {
      const sections = parseSectionScores(r.section_scores);
      if (!sections) continue;
      for (const [k, v] of Object.entries(sections)) {
        const cur = sectionBests.get(k);
        if (cur === undefined || v > cur) sectionBests.set(k, v);
      }
    }
    if (sectionBests.size > 0) {
      let sum = 0;
      for (const v of sectionBests.values()) sum += v;
      return sum;
    }
  }

  let best: number | null = null;
  for (const r of rows) {
    if (r.score === null || !Number.isFinite(r.score)) continue;
    if (best === null || r.score > best) best = r.score;
  }
  return best;
}
