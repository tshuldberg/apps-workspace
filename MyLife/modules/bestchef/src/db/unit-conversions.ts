import type { DatabaseAdapter } from '@mylife/db';
import {
  normalizeUnit,
  type UnitConversionCorrection,
} from '../grocery/units';

export type UnitConversionCorrectionSource =
  | 'manual'
  | 'recipe_review'
  | 'nutrition_review'
  | 'migration';

export interface UnitConversionCorrectionRecord extends UnitConversionCorrection {
  id: string;
  normalizedIngredientName: string;
  source: UnitConversionCorrectionSource;
  isUserConfirmed: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateUnitConversionCorrectionInput extends UnitConversionCorrection {
  source?: UnitConversionCorrectionSource;
  isUserConfirmed?: boolean;
}

interface UnitConversionCorrectionRow {
  id: string;
  ingredient_name: string;
  normalized_ingredient_name: string;
  from_unit: string;
  to_unit: string;
  factor: number;
  confidence: number | null;
  note: string | null;
  source: UnitConversionCorrectionSource;
  is_user_confirmed: number;
  created_at: string;
  updated_at: string;
}

function normalizeIngredientName(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase();
}

function normalizedCorrection(input: CreateUnitConversionCorrectionInput): {
  ingredientName: string;
  normalizedIngredientName: string;
  fromUnit: string;
  toUnit: string;
  factor: number;
  confidence: number | null;
  note: string | null;
  source: UnitConversionCorrectionSource;
  isUserConfirmed: number;
} {
  const ingredientName = input.ingredientName.trim().replace(/\s+/g, ' ');
  const fromUnit = normalizeUnit(input.fromUnit);
  const toUnit = normalizeUnit(input.toUnit);
  if (!ingredientName) throw new Error('Ingredient name is required.');
  if (!fromUnit) throw new Error(`Unknown source unit "${input.fromUnit}".`);
  if (!toUnit) throw new Error(`Unknown target unit "${input.toUnit}".`);
  if (!Number.isFinite(input.factor) || input.factor <= 0) {
    throw new Error('Conversion factor must be greater than 0.');
  }
  const confidence = input.confidence === undefined || input.confidence === null
    ? null
    : Math.max(0, Math.min(1, input.confidence));

  return {
    ingredientName,
    normalizedIngredientName: normalizeIngredientName(ingredientName),
    fromUnit,
    toUnit,
    factor: input.factor,
    confidence,
    note: input.note?.trim() || null,
    source: input.source ?? 'manual',
    isUserConfirmed: input.isUserConfirmed === false ? 0 : 1,
  };
}

function rowToRecord(row: UnitConversionCorrectionRow): UnitConversionCorrectionRecord {
  return {
    id: row.id,
    ingredientName: row.ingredient_name,
    normalizedIngredientName: row.normalized_ingredient_name,
    fromUnit: row.from_unit,
    toUnit: row.to_unit,
    factor: row.factor,
    confidence: row.confidence ?? undefined,
    note: row.note ?? undefined,
    source: row.source,
    isUserConfirmed: row.is_user_confirmed === 1,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function createUnitConversionCorrection(
  db: DatabaseAdapter,
  id: string,
  input: CreateUnitConversionCorrectionInput,
): UnitConversionCorrectionRecord {
  const correction = normalizedCorrection(input);
  db.execute(
    `INSERT INTO rc_unit_conversion_corrections (
      id,
      ingredient_name,
      normalized_ingredient_name,
      from_unit,
      to_unit,
      factor,
      confidence,
      note,
      source,
      is_user_confirmed
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      correction.ingredientName,
      correction.normalizedIngredientName,
      correction.fromUnit,
      correction.toUnit,
      correction.factor,
      correction.confidence,
      correction.note,
      correction.source,
      correction.isUserConfirmed,
    ],
  );
  const created = getUnitConversionCorrectionById(db, id);
  if (!created) throw new Error('Unable to create unit conversion correction.');
  return created;
}

export function upsertUnitConversionCorrection(
  db: DatabaseAdapter,
  id: string,
  input: CreateUnitConversionCorrectionInput,
): UnitConversionCorrectionRecord {
  const correction = normalizedCorrection(input);
  const existing = db.query<UnitConversionCorrectionRow>(
    `SELECT * FROM rc_unit_conversion_corrections
     WHERE normalized_ingredient_name = ? AND from_unit = ? AND to_unit = ?
     LIMIT 1`,
    [correction.normalizedIngredientName, correction.fromUnit, correction.toUnit],
  )[0];

  if (!existing) return createUnitConversionCorrection(db, id, input);

  db.execute(
    `UPDATE rc_unit_conversion_corrections
     SET ingredient_name = ?,
         factor = ?,
         confidence = ?,
         note = ?,
         source = ?,
         is_user_confirmed = ?,
         updated_at = datetime('now')
     WHERE id = ?`,
    [
      correction.ingredientName,
      correction.factor,
      correction.confidence,
      correction.note,
      correction.source,
      correction.isUserConfirmed,
      existing.id,
    ],
  );
  return getUnitConversionCorrectionById(db, existing.id)!;
}

export function getUnitConversionCorrectionById(
  db: DatabaseAdapter,
  id: string,
): UnitConversionCorrectionRecord | null {
  const row = db.query<UnitConversionCorrectionRow>(
    `SELECT * FROM rc_unit_conversion_corrections WHERE id = ? LIMIT 1`,
    [id],
  )[0];
  return row ? rowToRecord(row) : null;
}

export function getUnitConversionCorrections(
  db: DatabaseAdapter,
  ingredientName?: string | null,
): UnitConversionCorrectionRecord[] {
  if (ingredientName && ingredientName.trim()) {
    const normalized = normalizeIngredientName(ingredientName);
    return db.query<UnitConversionCorrectionRow>(
      `SELECT * FROM rc_unit_conversion_corrections
       WHERE normalized_ingredient_name = ?
          OR ? LIKE '%' || normalized_ingredient_name || '%'
          OR normalized_ingredient_name LIKE '%' || ? || '%'
       ORDER BY length(normalized_ingredient_name) DESC, updated_at DESC
       LIMIT 100`,
      [normalized, normalized, normalized],
    ).map(rowToRecord);
  }

  return db.query<UnitConversionCorrectionRow>(
    `SELECT * FROM rc_unit_conversion_corrections
     ORDER BY updated_at DESC, created_at DESC
     LIMIT 500`,
  ).map(rowToRecord);
}

export function getReusableUnitConversionCorrections(db: DatabaseAdapter): UnitConversionCorrection[] {
  return getUnitConversionCorrections(db).map((correction) => ({
    ingredientName: correction.ingredientName,
    fromUnit: correction.fromUnit,
    toUnit: correction.toUnit,
    factor: correction.factor,
    confidence: correction.confidence,
    note: correction.note,
  }));
}

export function deleteUnitConversionCorrection(db: DatabaseAdapter, id: string): void {
  db.execute(`DELETE FROM rc_unit_conversion_corrections WHERE id = ?`, [id]);
}
