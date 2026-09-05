/**
 * MyFitnessPal CSV import adapter.
 *
 * Handles MFP's Food Diary Export format and maps entries to the
 * MyNutrition nu_ tables. Creates food definitions, food log entries
 * (grouped by date + meal), and food log items.
 *
 * MFP Food Diary CSV headers:
 *   Date, Meal, Food Name, Calories, Fat (g), Saturated Fat, Polyunsaturated Fat,
 *   Monounsaturated Fat, Trans Fat, Cholesterol, Sodium (mg), Potassium,
 *   Carbohydrates (g), Fiber, Sugar, Protein (g), Vitamin A, Vitamin C,
 *   Calcium, Iron, Note
 *
 * MFP date format: YYYY-MM-DD (ISO)
 * MFP meal values: Breakfast, Lunch, Dinner, Snacks
 * MFP quantities: plain numbers (no currency formatting), may include commas
 * MFP Totals rows: lines starting with "Totals" should be skipped
 */

import type {
  ImportAdapter,
  FormatDetection,
  ParsedRecord,
  ImportValidationError,
  ImportResult,
  ImportProgress,
} from '../types';

// ── Source record shape (after CSV parsing) ──────────────────────────

export interface MfpFoodRecord {
  date: string;
  meal: string;
  foodName: string;
  calories: string;
  fatG: string;
  saturatedFat: string;
  polyunsaturatedFat: string;
  monounsaturatedFat: string;
  transFat: string;
  cholesterol: string;
  sodiumMg: string;
  potassium: string;
  carbsG: string;
  fiber: string;
  sugar: string;
  proteinG: string;
  vitaminA: string;
  vitaminC: string;
  calcium: string;
  iron: string;
  note: string;
}

// ── Target record shape (ready for nu_ insertion) ────────────────────

export interface NutritionImportRecord {
  date: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodName: string;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  sugarG: number;
  sodiumMg: number;
  note: string | null;
}

// ── CSV parsing helpers ──────────────────────────────────────────────

const MFP_REQUIRED_HEADERS = [
  'date', 'meal', 'calories', 'protein (g)',
];

const MFP_INDICATOR_HEADERS = [
  'fat (g)', 'carbohydrates (g)', 'sodium (mg)', 'sugar',
];

function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/^"|"$/g, '').trim();
}

/**
 * Parse a numeric string from MFP. Handles commas and returns 0 for empty/invalid.
 */
export function parseMfpNumber(raw: string): number {
  if (!raw || raw.trim() === '' || raw.trim() === '--') return 0;
  const cleaned = raw.replace(/,/g, '').trim();
  const value = parseFloat(cleaned);
  return isNaN(value) ? 0 : value;
}

/**
 * Map MFP meal name to MyNutrition MealType.
 */
export function normalizeMealType(mfpMeal: string): 'breakfast' | 'lunch' | 'dinner' | 'snack' {
  const lower = mfpMeal.toLowerCase().trim();
  if (lower === 'breakfast') return 'breakfast';
  if (lower === 'lunch') return 'lunch';
  if (lower === 'dinner') return 'dinner';
  // MFP uses "Snacks" (plural)
  return 'snack';
}

/**
 * Validate ISO date format (YYYY-MM-DD).
 */
export function isValidDate(raw: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(raw.trim());
}

// ── The adapter ──────────────────────────────────────────────────────

function detectFormat(content: string, _fileName?: string): FormatDetection {
  const firstLine = content.split('\n')[0] ?? '';
  const headers = parseCSVLine(firstLine).map(normalizeHeader);

  const hasRequired = MFP_REQUIRED_HEADERS.every((h) => headers.includes(h));
  if (!hasRequired) {
    return { detected: false, confidence: 0, reason: 'Missing required MFP headers (Date, Meal, Calories, Protein)' };
  }

  // Check for MFP-specific indicator headers to distinguish from generic CSVs
  const indicatorCount = MFP_INDICATOR_HEADERS.filter((h) => headers.includes(h)).length;
  if (indicatorCount >= 2) {
    return { detected: true, confidence: 0.95, reason: 'MyFitnessPal Food Diary CSV headers detected' };
  }

  // Has required but fewer indicators -- might be a simplified export
  return { detected: true, confidence: 0.75, reason: 'Possible MFP CSV (has core headers but missing some nutrition columns)' };
}

function parse(content: string): ParsedRecord<MfpFoodRecord>[] {
  const lines = content.split('\n');
  if (lines.length < 2) return [];

  const headerLine = lines[0];
  const headers = parseCSVLine(headerLine).map(normalizeHeader);

  const colIndex = (name: string): number => headers.indexOf(name);
  const dateIdx = colIndex('date');
  const mealIdx = colIndex('meal');
  // MFP sometimes uses "Food Name" or just the third column
  let foodIdx = colIndex('food name');
  if (foodIdx < 0) foodIdx = colIndex('foods');
  if (foodIdx < 0 && headers.length > 2) foodIdx = 2; // fallback: third column

  const calIdx = colIndex('calories');
  const fatIdx = colIndex('fat (g)');
  const satFatIdx = colIndex('saturated fat');
  const polyFatIdx = colIndex('polyunsaturated fat');
  const monoFatIdx = colIndex('monounsaturated fat');
  const transFatIdx = colIndex('trans fat');
  const cholIdx = colIndex('cholesterol');
  const sodiumIdx = colIndex('sodium (mg)');
  const potassiumIdx = colIndex('potassium');
  const carbsIdx = colIndex('carbohydrates (g)');
  const fiberIdx = colIndex('fiber');
  const sugarIdx = colIndex('sugar');
  const proteinIdx = colIndex('protein (g)');
  const vitAIdx = colIndex('vitamin a');
  const vitCIdx = colIndex('vitamin c');
  const calciumIdx = colIndex('calcium');
  const ironIdx = colIndex('iron');
  const noteIdx = colIndex('note');

  const records: ParsedRecord<MfpFoodRecord>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const fields = parseCSVLine(line);

    // Skip "Totals" summary rows
    const dateField = dateIdx >= 0 ? (fields[dateIdx] ?? '') : '';
    const mealField = mealIdx >= 0 ? (fields[mealIdx] ?? '') : '';
    if (dateField.toLowerCase() === 'totals' || mealField.toLowerCase() === 'totals') continue;

    const warnings: string[] = [];
    if (!dateField) warnings.push('Missing date');

    const record: MfpFoodRecord = {
      date: dateField,
      meal: mealField,
      foodName: foodIdx >= 0 ? (fields[foodIdx] ?? '') : '',
      calories: calIdx >= 0 ? (fields[calIdx] ?? '') : '',
      fatG: fatIdx >= 0 ? (fields[fatIdx] ?? '') : '',
      saturatedFat: satFatIdx >= 0 ? (fields[satFatIdx] ?? '') : '',
      polyunsaturatedFat: polyFatIdx >= 0 ? (fields[polyFatIdx] ?? '') : '',
      monounsaturatedFat: monoFatIdx >= 0 ? (fields[monoFatIdx] ?? '') : '',
      transFat: transFatIdx >= 0 ? (fields[transFatIdx] ?? '') : '',
      cholesterol: cholIdx >= 0 ? (fields[cholIdx] ?? '') : '',
      sodiumMg: sodiumIdx >= 0 ? (fields[sodiumIdx] ?? '') : '',
      potassium: potassiumIdx >= 0 ? (fields[potassiumIdx] ?? '') : '',
      carbsG: carbsIdx >= 0 ? (fields[carbsIdx] ?? '') : '',
      fiber: fiberIdx >= 0 ? (fields[fiberIdx] ?? '') : '',
      sugar: sugarIdx >= 0 ? (fields[sugarIdx] ?? '') : '',
      proteinG: proteinIdx >= 0 ? (fields[proteinIdx] ?? '') : '',
      vitaminA: vitAIdx >= 0 ? (fields[vitAIdx] ?? '') : '',
      vitaminC: vitCIdx >= 0 ? (fields[vitCIdx] ?? '') : '',
      calcium: calciumIdx >= 0 ? (fields[calciumIdx] ?? '') : '',
      iron: ironIdx >= 0 ? (fields[ironIdx] ?? '') : '',
      note: noteIdx >= 0 ? (fields[noteIdx] ?? '') : '',
    };

    records.push({ rowNumber: i + 1, data: record, warnings });
  }

  return records;
}

function validate(
  records: ParsedRecord<MfpFoodRecord>[],
): { valid: ParsedRecord<MfpFoodRecord>[]; errors: ImportValidationError[] } {
  const valid: ParsedRecord<MfpFoodRecord>[] = [];
  const errors: ImportValidationError[] = [];

  for (const record of records) {
    const { data, rowNumber } = record;

    if (!isValidDate(data.date)) {
      errors.push({ row: rowNumber, field: 'date', message: `Invalid date: "${data.date}"`, value: data.date });
      continue;
    }

    if (!data.foodName.trim()) {
      errors.push({ row: rowNumber, field: 'foodName', message: 'Missing food name' });
      continue;
    }

    const calories = parseMfpNumber(data.calories);
    if (calories < 0) {
      errors.push({ row: rowNumber, field: 'calories', message: `Invalid calories: "${data.calories}"`, value: data.calories });
      continue;
    }

    valid.push(record);
  }

  return { valid, errors };
}

function transform(
  records: ParsedRecord<MfpFoodRecord>[],
): ParsedRecord<NutritionImportRecord>[] {
  return records.map((record) => {
    const { data } = record;

    return {
      rowNumber: record.rowNumber,
      warnings: record.warnings,
      data: {
        date: data.date.trim(),
        mealType: normalizeMealType(data.meal),
        foodName: data.foodName.trim(),
        calories: parseMfpNumber(data.calories),
        proteinG: parseMfpNumber(data.proteinG),
        carbsG: parseMfpNumber(data.carbsG),
        fatG: parseMfpNumber(data.fatG),
        fiberG: parseMfpNumber(data.fiber),
        sugarG: parseMfpNumber(data.sugar),
        sodiumMg: parseMfpNumber(data.sodiumMg),
        note: data.note.trim() || null,
      },
    };
  });
}

function importRecords(
  db: unknown,
  records: ParsedRecord<NutritionImportRecord>[],
  onProgress?: (progress: ImportProgress) => void,
): ImportResult {
  const startTime = Date.now();
  const adapter = db as {
    execute(sql: string, params?: unknown[]): void;
    query<T>(sql: string, params?: unknown[]): T[];
  };

  onProgress?.({ phase: 'importing', current: 0, total: records.length, message: 'Creating food entries...' });

  // Track created foods by name (case-insensitive) for dedup
  const foodIdMap = new Map<string, string>();

  // Load existing foods
  const existingFoods = adapter.query<{ id: string; name: string }>('SELECT id, name FROM nu_foods');
  for (const f of existingFoods) {
    foodIdMap.set(f.name.toLowerCase(), f.id);
  }

  // Track created log entries by date+meal composite key
  const logIdMap = new Map<string, string>();
  const existingLogs = adapter.query<{ id: string; date: string; meal_type: string }>('SELECT id, date, meal_type FROM nu_food_log');
  for (const log of existingLogs) {
    logIdMap.set(`${log.date}:${log.meal_type}`, log.id);
  }

  let imported = 0;
  let skipped = 0;
  const errors: ImportValidationError[] = [];

  adapter.execute('BEGIN');
  try {
    for (let i = 0; i < records.length; i++) {
      const { data, rowNumber } = records[i];

      try {
        // Ensure food exists
        const foodKey = data.foodName.toLowerCase();
        let foodId = foodIdMap.get(foodKey);
        if (!foodId) {
          foodId = crypto.randomUUID();
          const now = new Date().toISOString();
          adapter.execute(
            `INSERT INTO nu_foods (id, name, brand, serving_size, serving_unit, calories, protein_g, carbs_g, fat_g, fiber_g, sugar_g, sodium_mg, source, barcode, usda_ndb_number, created_at, updated_at)
             VALUES (?, ?, NULL, 1, 'serving', ?, ?, ?, ?, ?, ?, ?, 'custom', NULL, NULL, ?, ?)`,
            [foodId, data.foodName, data.calories, data.proteinG, data.carbsG, data.fatG, data.fiberG, data.sugarG, data.sodiumMg, now, now],
          );
          foodIdMap.set(foodKey, foodId);
        }

        // Ensure food log entry exists for this date+meal
        const logKey = `${data.date}:${data.mealType}`;
        let logId = logIdMap.get(logKey);
        if (!logId) {
          logId = crypto.randomUUID();
          const now = new Date().toISOString();
          adapter.execute(
            `INSERT INTO nu_food_log (id, date, meal_type, notes, created_at) VALUES (?, ?, ?, NULL, ?)`,
            [logId, data.date, data.mealType, now],
          );
          logIdMap.set(logKey, logId);
        }

        // Insert food log item
        const itemId = crypto.randomUUID();
        adapter.execute(
          `INSERT INTO nu_food_log_items (id, log_id, food_id, serving_count, calories, protein_g, carbs_g, fat_g)
           VALUES (?, ?, ?, 1, ?, ?, ?, ?)`,
          [itemId, logId, foodId, data.calories, data.proteinG, data.carbsG, data.fatG],
        );

        imported++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('UNIQUE')) {
          skipped++;
        } else {
          errors.push({ row: rowNumber, field: 'insert', message: msg });
        }
      }

      if (onProgress && (i % 100 === 0 || i === records.length - 1)) {
        onProgress({
          phase: 'importing',
          current: i + 1,
          total: records.length,
          message: `Imported ${imported} food entries...`,
        });
      }
    }
    adapter.execute('COMMIT');
  } catch {
    adapter.execute('ROLLBACK');
    throw new Error('Import failed during database insertion');
  }

  onProgress?.({ phase: 'complete', current: records.length, total: records.length, message: 'Import complete' });

  return {
    adapterName: 'myfitnesspal-csv',
    targetModule: 'nutrition',
    totalRows: records.length,
    imported,
    skipped,
    failed: errors.length,
    errors,
    durationMs: Date.now() - startTime,
  };
}

export const myFitnessPalAdapter: ImportAdapter<MfpFoodRecord, NutritionImportRecord> = {
  name: 'myfitnesspal-csv',
  sourceApp: 'MyFitnessPal',
  targetModule: 'nutrition',
  supportedExtensions: ['.csv'],
  detectFormat,
  parse,
  validate,
  transform,
  import: importRecords,
};
