import type { DatabaseAdapter } from '@mylife/db';
import type { Prediction, PredictionCategory } from '../../types';

// ---------------------------------------------------------------------------
// Row shape
// ---------------------------------------------------------------------------

interface PredictionRow {
  id: string;
  category: PredictionCategory;
  sport: string | null;
  league: string | null;
  season: string;
  prediction_text: string;
  reasoning_md: string | null;
  confidence: number | null;
  predicted_at: number;
  locks_at: number | null;
  settled_at: number | null;
  was_correct: 0 | 1 | null;
  result_text: string | null;
  notes_md: string | null;
  created_at: number;
  updated_at: number;
}

function rowToPrediction(row: PredictionRow): Prediction {
  return {
    id: row.id,
    category: row.category,
    sport: row.sport ?? null,
    league: row.league ?? null,
    season: row.season,
    prediction_text: row.prediction_text,
    reasoning_md: row.reasoning_md ?? null,
    confidence: row.confidence ?? null,
    predicted_at: row.predicted_at,
    locks_at: row.locks_at ?? null,
    settled_at: row.settled_at ?? null,
    was_correct:
      row.was_correct === null ? null : row.was_correct === 1,
    result_text: row.result_text ?? null,
    notes_md: row.notes_md ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function now(): number {
  return Date.now();
}

function makeId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export interface CreatePredictionInput {
  id?: string;
  category: PredictionCategory;
  sport?: string | null;
  league?: string | null;
  season: string;
  prediction_text: string;
  reasoning_md?: string | null;
  confidence?: number | null;
  predicted_at?: number;
  locks_at?: number | null;
  notes_md?: string | null;
}

/**
 * Insert a new prediction row. `predicted_at` defaults to now.
 * `was_correct`, `settled_at`, and `result_text` are always null on
 * create -- settlement happens via `settlePrediction`.
 */
export function createPrediction(
  db: DatabaseAdapter,
  input: CreatePredictionInput,
): Prediction {
  const ts = now();
  const id = input.id ?? makeId('pd');
  const predictedAt = input.predicted_at ?? ts;

  db.execute(
    `INSERT INTO sp_predictions (
      id, category, sport, league, season, prediction_text, reasoning_md,
      confidence, predicted_at, locks_at, settled_at, was_correct,
      result_text, notes_md, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.category,
      input.sport ?? null,
      input.league ?? null,
      input.season,
      input.prediction_text,
      input.reasoning_md ?? null,
      input.confidence ?? null,
      predictedAt,
      input.locks_at ?? null,
      null,
      null,
      null,
      input.notes_md ?? null,
      ts,
      ts,
    ],
  );

  const row = getPrediction(db, id);
  if (!row) throw new Error(`failed to insert prediction ${id}`);
  return row;
}

export interface UpdatePredictionInput {
  category?: PredictionCategory;
  sport?: string | null;
  league?: string | null;
  season?: string;
  prediction_text?: string;
  reasoning_md?: string | null;
  confidence?: number | null;
  predicted_at?: number;
  locks_at?: number | null;
  notes_md?: string | null;
}

/**
 * Partial update to a prediction row. Enforces the lock-edit rule:
 *   * If the prediction is settled (`settled_at` is non-null), ONLY
 *     `notes_md` may be changed. Use `settlePrediction` / `unsettlePrediction`
 *     for the outcome columns.
 *   * If `locks_at` has passed and the prediction is still unsettled,
 *     ONLY `notes_md` may be changed.
 *   * Otherwise all fields in `UpdatePredictionInput` are mutable.
 *
 * Returns the refreshed row, or null if the id doesn't exist.
 */
export function updatePrediction(
  db: DatabaseAdapter,
  id: string,
  patch: UpdatePredictionInput,
): Prediction | null {
  const existing = getPrediction(db, id);
  if (!existing) return null;

  const settled = existing.settled_at !== null;
  const locked =
    existing.locks_at !== null &&
    now() > existing.locks_at &&
    existing.settled_at === null;

  if (settled || locked) {
    const frozen = Object.keys(patch).filter((k) => k !== 'notes_md');
    if (frozen.length > 0) {
      throw new Error(
        settled
          ? `prediction ${id} is settled; only notes_md may be edited`
          : `prediction ${id} is locked; only notes_md may be edited`,
      );
    }
  }

  const sets: string[] = [];
  const params: unknown[] = [];

  if (patch.category !== undefined) {
    sets.push('category = ?');
    params.push(patch.category);
  }
  if (patch.sport !== undefined) {
    sets.push('sport = ?');
    params.push(patch.sport);
  }
  if (patch.league !== undefined) {
    sets.push('league = ?');
    params.push(patch.league);
  }
  if (patch.season !== undefined) {
    sets.push('season = ?');
    params.push(patch.season);
  }
  if (patch.prediction_text !== undefined) {
    sets.push('prediction_text = ?');
    params.push(patch.prediction_text);
  }
  if (patch.reasoning_md !== undefined) {
    sets.push('reasoning_md = ?');
    params.push(patch.reasoning_md);
  }
  if (patch.confidence !== undefined) {
    sets.push('confidence = ?');
    params.push(patch.confidence);
  }
  if (patch.predicted_at !== undefined) {
    sets.push('predicted_at = ?');
    params.push(patch.predicted_at);
  }
  if (patch.locks_at !== undefined) {
    sets.push('locks_at = ?');
    params.push(patch.locks_at);
  }
  if (patch.notes_md !== undefined) {
    sets.push('notes_md = ?');
    params.push(patch.notes_md);
  }

  if (sets.length === 0) {
    return existing;
  }

  sets.push('updated_at = ?');
  params.push(now());
  params.push(id);

  db.execute(
    `UPDATE sp_predictions SET ${sets.join(', ')} WHERE id = ?`,
    params,
  );
  return getPrediction(db, id);
}

export interface SettlePredictionInput {
  wasCorrect: boolean;
  resultText?: string;
  settledAtMs?: number;
}

/**
 * Settle (or re-settle) a prediction. Sets `was_correct`, `settled_at`,
 * and optionally `result_text`. Idempotent: calling it again with the
 * same arguments overwrites the stored outcome in place.
 */
export function settlePrediction(
  db: DatabaseAdapter,
  id: string,
  input: SettlePredictionInput,
): Prediction | null {
  const existing = getPrediction(db, id);
  if (!existing) return null;

  const ts = now();
  db.execute(
    `UPDATE sp_predictions
       SET was_correct = ?, settled_at = ?, result_text = ?, updated_at = ?
       WHERE id = ?`,
    [
      input.wasCorrect ? 1 : 0,
      input.settledAtMs ?? ts,
      input.resultText ?? existing.result_text ?? null,
      ts,
      id,
    ],
  );
  return getPrediction(db, id);
}

/**
 * Clear a prior settlement. Nulls `was_correct`, `settled_at`, and
 * `result_text`. Useful when a mis-settle happens.
 */
export function unsettlePrediction(
  db: DatabaseAdapter,
  id: string,
): Prediction | null {
  const existing = getPrediction(db, id);
  if (!existing) return null;

  const ts = now();
  db.execute(
    `UPDATE sp_predictions
       SET was_correct = NULL, settled_at = NULL, result_text = NULL, updated_at = ?
       WHERE id = ?`,
    [ts, id],
  );
  return getPrediction(db, id);
}

/** Delete a prediction row. Returns true iff a row was removed. */
export function deletePrediction(db: DatabaseAdapter, id: string): boolean {
  const existing = getPrediction(db, id);
  if (!existing) return false;
  db.execute('DELETE FROM sp_predictions WHERE id = ?', [id]);
  return true;
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export function getPrediction(
  db: DatabaseAdapter,
  id: string,
): Prediction | null {
  const rows = db.query<PredictionRow>(
    'SELECT * FROM sp_predictions WHERE id = ?',
    [id],
  );
  return rows.length > 0 ? rowToPrediction(rows[0]) : null;
}

export interface ListPredictionsFilters {
  category?: PredictionCategory;
  sport?: string;
  season?: string;
  /**
   * When `true`, only returns settled rows (`was_correct IS NOT NULL`).
   * When `false`, only unsettled rows. When `undefined`, returns both.
   */
  settled?: boolean;
  limit?: number;
}

/**
 * List predictions ordered by `predicted_at DESC`. All filters compose
 * with AND semantics.
 */
export function listPredictions(
  db: DatabaseAdapter,
  filters: ListPredictionsFilters = {},
): Prediction[] {
  const where: string[] = [];
  const params: unknown[] = [];

  if (filters.category !== undefined) {
    where.push('category = ?');
    params.push(filters.category);
  }
  if (filters.sport !== undefined) {
    where.push('sport = ?');
    params.push(filters.sport);
  }
  if (filters.season !== undefined) {
    where.push('season = ?');
    params.push(filters.season);
  }
  if (filters.settled === true) {
    where.push('was_correct IS NOT NULL');
  } else if (filters.settled === false) {
    where.push('was_correct IS NULL');
  }

  const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
  let sql = `SELECT * FROM sp_predictions ${whereClause} ORDER BY predicted_at DESC`;

  if (filters.limit !== undefined) {
    sql += ` LIMIT ${Math.max(0, Math.floor(filters.limit))}`;
  }

  return db.query<PredictionRow>(sql, params).map(rowToPrediction);
}
