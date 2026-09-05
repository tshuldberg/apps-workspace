import type { DatabaseAdapter } from '@mylife/db';
import type { Experiment, ExperimentTemplate, CreateExperimentInput, ExperimentStatus } from '../types';
import { CreateExperimentInputSchema } from '../types';
import { computeDateRanges, type ExperimentAnalysis } from '../engine/experiment';

// ── Row Mappers ───────────────────────────────────────────────────────

function rowToExperiment(row: Record<string, unknown>): Experiment {
  return {
    id: row.id as string,
    hypothesis: row.hypothesis as string,
    interventionDescription: row.intervention_description as string,
    periodDays: row.period_days as number,
    baselineStart: row.baseline_start as string,
    baselineEnd: row.baseline_end as string,
    interventionStart: row.intervention_start as string,
    interventionEnd: row.intervention_end as string,
    status: row.status as Experiment['status'],
    templateId: (row.template_id as string) ?? null,
    baselineAvg: (row.baseline_avg as number) ?? null,
    interventionAvg: (row.intervention_avg as number) ?? null,
    baselineEntryCount: (row.baseline_entry_count as number) ?? null,
    interventionEntryCount: (row.intervention_entry_count as number) ?? null,
    scoreDiff: (row.score_diff as number) ?? null,
    percentChange: (row.percent_change as number) ?? null,
    pearsonR: (row.pearson_r as number) ?? null,
    isSignificant: row.is_significant != null ? (row.is_significant as number) === 1 : null,
    conclusion: (row.conclusion as string) ?? null,
    createdAt: row.created_at as string,
    completedAt: (row.completed_at as string) ?? null,
  };
}

function rowToTemplate(row: Record<string, unknown>): ExperimentTemplate {
  return {
    id: row.id as string,
    name: row.name as string,
    hypothesis: row.hypothesis as string,
    interventionDescription: row.intervention_description as string,
    suggestedDays: row.suggested_days as number,
    category: row.category as ExperimentTemplate['category'],
  };
}

// ── Experiment CRUD ───────────────────────────────────────────────────

export function createExperiment(
  db: DatabaseAdapter,
  id: string,
  rawInput: CreateExperimentInput,
): Experiment {
  const input = CreateExperimentInputSchema.parse(rawInput);
  const { baselineEnd, interventionStart, interventionEnd } = computeDateRanges(
    input.baselineStart,
    input.periodDays,
  );

  const now = new Date().toISOString();
  const today = now.slice(0, 10);
  const initialStatus: ExperimentStatus = today >= input.baselineStart ? 'baseline' : 'draft';

  db.execute(
    `INSERT INTO mo_experiments (id, hypothesis, intervention_description, period_days, baseline_start, baseline_end, intervention_start, intervention_end, status, template_id, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [id, input.hypothesis, input.interventionDescription, input.periodDays, input.baselineStart, baselineEnd, interventionStart, interventionEnd, initialStatus, input.templateId, now],
  );

  return {
    id,
    hypothesis: input.hypothesis,
    interventionDescription: input.interventionDescription,
    periodDays: input.periodDays,
    baselineStart: input.baselineStart,
    baselineEnd,
    interventionStart,
    interventionEnd,
    status: initialStatus,
    templateId: input.templateId ?? null,
    baselineAvg: null,
    interventionAvg: null,
    baselineEntryCount: null,
    interventionEntryCount: null,
    scoreDiff: null,
    percentChange: null,
    pearsonR: null,
    isSignificant: null,
    conclusion: null,
    createdAt: now,
    completedAt: null,
  };
}

export function getExperiment(db: DatabaseAdapter, id: string): Experiment | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_experiments WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToExperiment(rows[0]) : null;
}

export function getActiveExperiment(db: DatabaseAdapter): Experiment | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_experiments WHERE status IN ('draft', 'baseline', 'intervention') ORDER BY created_at DESC LIMIT 1`,
  );
  return rows.length > 0 ? rowToExperiment(rows[0]) : null;
}

export function getExperiments(db: DatabaseAdapter, limit = 50): Experiment[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_experiments ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(rowToExperiment);
}

export function updateExperimentStatus(
  db: DatabaseAdapter,
  id: string,
  status: ExperimentStatus,
): void {
  const updates = status === 'completed'
    ? `status = ?, completed_at = datetime('now')`
    : `status = ?`;
  db.execute(`UPDATE mo_experiments SET ${updates} WHERE id = ?`, [status, id]);
}

export function updateExperimentResults(
  db: DatabaseAdapter,
  id: string,
  analysis: ExperimentAnalysis,
): void {
  db.execute(
    `UPDATE mo_experiments SET
       baseline_avg = ?, intervention_avg = ?,
       baseline_entry_count = ?, intervention_entry_count = ?,
       score_diff = ?, percent_change = ?,
       pearson_r = ?, is_significant = ?,
       conclusion = ?, status = 'completed', completed_at = datetime('now')
     WHERE id = ?`,
    [
      analysis.baselineAvg,
      analysis.interventionAvg,
      analysis.baselineEntryCount,
      analysis.interventionEntryCount,
      analysis.scoreDiff,
      analysis.percentChange,
      analysis.pearsonR,
      analysis.isSignificant ? 1 : 0,
      analysis.conclusion,
      id,
    ],
  );
}

export function abandonExperiment(db: DatabaseAdapter, id: string): void {
  db.execute(
    `UPDATE mo_experiments SET status = 'abandoned' WHERE id = ? AND status IN ('draft', 'baseline', 'intervention')`,
    [id],
  );
}

// ── Template CRUD ─────────────────────────────────────────────────────

export function getTemplates(db: DatabaseAdapter): ExperimentTemplate[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_experiment_templates ORDER BY category, name`,
  );
  return rows.map(rowToTemplate);
}

export function getTemplatesByCategory(
  db: DatabaseAdapter,
  category: string,
): ExperimentTemplate[] {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_experiment_templates WHERE category = ? ORDER BY name`,
    [category],
  );
  return rows.map(rowToTemplate);
}

export function getTemplateById(db: DatabaseAdapter, id: string): ExperimentTemplate | null {
  const rows = db.query<Record<string, unknown>>(
    `SELECT * FROM mo_experiment_templates WHERE id = ?`,
    [id],
  );
  return rows.length > 0 ? rowToTemplate(rows[0]) : null;
}

// ── Helpers for Analysis ──────────────────────────────────────────────

export function getScoresInDateRange(
  db: DatabaseAdapter,
  startDate: string,
  endDate: string,
): number[] {
  const rows = db.query<{ score: number }>(
    `SELECT score FROM mo_entries WHERE date >= ? AND date <= ? ORDER BY date ASC, logged_at ASC`,
    [startDate, endDate],
  );
  return rows.map((r) => r.score);
}
