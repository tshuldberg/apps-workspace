import { describe, it, expect } from 'vitest';
import {
  myFitnessPalAdapter,
  parseMfpNumber,
  normalizeMealType,
  isValidDate,
} from '../adapters/myfitnesspal';
import type { MfpFoodRecord } from '../adapters/myfitnesspal';
import type { ParsedRecord } from '../types';

// ── Sample MFP Food Diary CSV fixtures ────────────────────────────────

const MFP_FULL_HEADER = [
  'Date', 'Meal', 'Food Name', 'Calories', 'Fat (g)', 'Saturated Fat',
  'Polyunsaturated Fat', 'Monounsaturated Fat', 'Trans Fat', 'Cholesterol',
  'Sodium (mg)', 'Potassium', 'Carbohydrates (g)', 'Fiber', 'Sugar',
  'Protein (g)', 'Vitamin A', 'Vitamin C', 'Calcium', 'Iron', 'Note',
].join(',');

const MFP_FULL_CSV = [
  MFP_FULL_HEADER,
  '2024-01-15,Breakfast,"Greek Yogurt, Plain",150,4,2.5,0,1,0,15,80,200,12,0,8,15,2,0,20,0,',
  '2024-01-15,Lunch,Grilled Chicken Breast,165,3.6,1,0.8,1.2,0,85,74,256,0,0,0,31,0,0,1,1,',
  '2024-01-15,Dinner,"Salmon, Baked",208,9.3,1.4,3.8,3,0,63,59,384,0,0,0,28,1,0,1,1,Post-workout meal',
  '2024-01-15,Snacks,Almonds (1 oz),164,14.2,1.1,3.5,8.9,0,0,1,208,6,3.5,1.2,6,0,0,8,1,',
].join('\n');

const MFP_SIMPLE_HEADER = 'Date,Meal,Food Name,Calories,Fat (g),Carbohydrates (g),Protein (g)';

const MFP_SIMPLE_CSV = [
  MFP_SIMPLE_HEADER,
  '2024-01-15,Breakfast,Oatmeal,150,3,27,5',
  '2024-01-15,Lunch,Turkey Sandwich,350,12,35,25',
].join('\n');

const MFP_CSV_WITH_TOTALS = [
  MFP_FULL_HEADER,
  '2024-01-15,Breakfast,Oatmeal,150,3,1,0.5,1,0,0,5,100,27,4,1,5,0,0,2,1,',
  'Totals,,Total Daily Intake,687,31.1,6,5.1,14.1,0,163,214,1048,18,3.5,9.2,80,3,0,30,3,',
].join('\n');

const NON_MFP_CSV = 'Title,Author,ISBN\nThe Hobbit,Tolkien,123456';

// ── parseMfpNumber tests ────────────────────────────────────────────

describe('parseMfpNumber', () => {
  it('parses a standard number', () => {
    expect(parseMfpNumber('150')).toBe(150);
  });

  it('parses a decimal number', () => {
    expect(parseMfpNumber('3.6')).toBe(3.6);
  });

  it('parses with commas', () => {
    expect(parseMfpNumber('1,234')).toBe(1234);
  });

  it('returns 0 for empty string', () => {
    expect(parseMfpNumber('')).toBe(0);
  });

  it('returns 0 for dashes (MFP empty value)', () => {
    expect(parseMfpNumber('--')).toBe(0);
  });

  it('returns 0 for whitespace-only', () => {
    expect(parseMfpNumber('   ')).toBe(0);
  });

  it('returns 0 for non-numeric text', () => {
    expect(parseMfpNumber('abc')).toBe(0);
  });
});

// ── normalizeMealType tests ─────────────────────────────────────────

describe('normalizeMealType', () => {
  it('maps Breakfast to breakfast', () => {
    expect(normalizeMealType('Breakfast')).toBe('breakfast');
  });

  it('maps Lunch to lunch', () => {
    expect(normalizeMealType('Lunch')).toBe('lunch');
  });

  it('maps Dinner to dinner', () => {
    expect(normalizeMealType('Dinner')).toBe('dinner');
  });

  it('maps Snacks (plural) to snack', () => {
    expect(normalizeMealType('Snacks')).toBe('snack');
  });

  it('maps unknown meal to snack', () => {
    expect(normalizeMealType('Midnight Snack')).toBe('snack');
  });

  it('handles whitespace', () => {
    expect(normalizeMealType('  Breakfast  ')).toBe('breakfast');
  });
});

// ── isValidDate tests ───────────────────────────────────────────────

describe('isValidDate', () => {
  it('accepts ISO date', () => {
    expect(isValidDate('2024-01-15')).toBe(true);
  });

  it('rejects invalid format', () => {
    expect(isValidDate('01/15/2024')).toBe(false);
  });

  it('rejects empty string', () => {
    expect(isValidDate('')).toBe(false);
  });

  it('handles leading/trailing whitespace', () => {
    expect(isValidDate(' 2024-01-15 ')).toBe(true);
  });
});

// ── detectFormat tests ──────────────────────────────────────────────

describe('detectFormat', () => {
  it('detects full MFP CSV format with high confidence', () => {
    const result = myFitnessPalAdapter.detectFormat(MFP_FULL_CSV);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.95);
  });

  it('detects simple MFP CSV with indicator headers present', () => {
    const result = myFitnessPalAdapter.detectFormat(MFP_SIMPLE_CSV);
    expect(result.detected).toBe(true);
    // Simple CSV still has Fat (g) and Carbohydrates (g) which match 2+ indicators
    expect(result.confidence).toBe(0.95);
  });

  it('detects minimal MFP CSV with lower confidence', () => {
    const minimalCsv = 'Date,Meal,Food Name,Calories,Protein (g)\n2024-01-15,Breakfast,Oatmeal,150,5';
    const result = myFitnessPalAdapter.detectFormat(minimalCsv);
    expect(result.detected).toBe(true);
    expect(result.confidence).toBe(0.75);
  });

  it('rejects non-MFP CSV', () => {
    const result = myFitnessPalAdapter.detectFormat(NON_MFP_CSV);
    expect(result.detected).toBe(false);
    expect(result.confidence).toBe(0);
  });

  it('rejects empty content', () => {
    const result = myFitnessPalAdapter.detectFormat('');
    expect(result.detected).toBe(false);
  });
});

// ── parse tests ─────────────────────────────────────────────────────

describe('parse', () => {
  it('parses full MFP CSV into records', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    expect(records).toHaveLength(4);
    expect(records[0].data.date).toBe('2024-01-15');
    expect(records[0].data.meal).toBe('Breakfast');
    expect(records[0].data.foodName).toBe('Greek Yogurt, Plain');
    expect(records[0].data.calories).toBe('150');
    expect(records[0].data.proteinG).toBe('15');
    expect(records[0].data.fatG).toBe('4');
    expect(records[0].data.carbsG).toBe('12');
    expect(records[0].data.sodiumMg).toBe('80');
  });

  it('parses simple MFP CSV', () => {
    const records = myFitnessPalAdapter.parse(MFP_SIMPLE_CSV);
    expect(records).toHaveLength(2);
    expect(records[0].data.foodName).toBe('Oatmeal');
    expect(records[0].data.calories).toBe('150');
  });

  it('skips Totals rows', () => {
    const records = myFitnessPalAdapter.parse(MFP_CSV_WITH_TOTALS);
    expect(records).toHaveLength(1);
    expect(records[0].data.foodName).toBe('Oatmeal');
  });

  it('assigns correct row numbers', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    expect(records[0].rowNumber).toBe(2);
    expect(records[1].rowNumber).toBe(3);
    expect(records[2].rowNumber).toBe(4);
    expect(records[3].rowNumber).toBe(5);
  });

  it('handles empty lines', () => {
    const csv = MFP_FULL_HEADER + '\n\n2024-01-15,Breakfast,Eggs,78,5,2,0,2,0,186,62,0,1,0,0,6,6,0,3,1,\n';
    const records = myFitnessPalAdapter.parse(csv);
    expect(records).toHaveLength(1);
    expect(records[0].data.foodName).toBe('Eggs');
  });

  it('returns empty for header-only CSV', () => {
    expect(myFitnessPalAdapter.parse(MFP_FULL_HEADER)).toEqual([]);
  });

  it('captures note field', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    // Row 3 (Salmon) has a note
    expect(records[2].data.note).toBe('Post-workout meal');
    // Row 0 (Yogurt) has empty note
    expect(records[0].data.note).toBe('');
  });
});

// ── validate tests ──────────────────────────────────────────────────

describe('validate', () => {
  it('passes valid records', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid, errors } = myFitnessPalAdapter.validate(records);
    expect(valid).toHaveLength(4);
    expect(errors).toHaveLength(0);
  });

  it('rejects records with invalid dates', () => {
    const records: ParsedRecord<MfpFoodRecord>[] = [
      {
        rowNumber: 2,
        data: {
          date: '01/15/2024',
          meal: 'Breakfast',
          foodName: 'Oatmeal',
          calories: '150',
          fatG: '3', saturatedFat: '', polyunsaturatedFat: '', monounsaturatedFat: '',
          transFat: '', cholesterol: '', sodiumMg: '', potassium: '', carbsG: '27',
          fiber: '', sugar: '', proteinG: '5', vitaminA: '', vitaminC: '',
          calcium: '', iron: '', note: '',
        },
        warnings: [],
      },
    ];
    const { valid, errors } = myFitnessPalAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('date');
  });

  it('rejects records with missing food name', () => {
    const records: ParsedRecord<MfpFoodRecord>[] = [
      {
        rowNumber: 2,
        data: {
          date: '2024-01-15',
          meal: 'Breakfast',
          foodName: '',
          calories: '150',
          fatG: '3', saturatedFat: '', polyunsaturatedFat: '', monounsaturatedFat: '',
          transFat: '', cholesterol: '', sodiumMg: '', potassium: '', carbsG: '27',
          fiber: '', sugar: '', proteinG: '5', vitaminA: '', vitaminC: '',
          calcium: '', iron: '', note: '',
        },
        warnings: [],
      },
    ];
    const { valid, errors } = myFitnessPalAdapter.validate(records);
    expect(valid).toHaveLength(0);
    expect(errors).toHaveLength(1);
    expect(errors[0].field).toBe('foodName');
  });
});

// ── transform tests ─────────────────────────────────────────────────

describe('transform', () => {
  it('transforms MFP records to nutrition import records', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);

    expect(transformed).toHaveLength(4);

    const yogurt = transformed[0].data;
    expect(yogurt.date).toBe('2024-01-15');
    expect(yogurt.mealType).toBe('breakfast');
    expect(yogurt.foodName).toBe('Greek Yogurt, Plain');
    expect(yogurt.calories).toBe(150);
    expect(yogurt.proteinG).toBe(15);
    expect(yogurt.carbsG).toBe(12);
    expect(yogurt.fatG).toBe(4);
    expect(yogurt.note).toBeNull();
  });

  it('normalizes Snacks to snack', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);

    const almonds = transformed[3].data;
    expect(almonds.mealType).toBe('snack');
  });

  it('preserves notes when present', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);

    const salmon = transformed[2].data;
    expect(salmon.note).toBe('Post-workout meal');
  });

  it('converts numeric strings to numbers', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);

    const chicken = transformed[1].data;
    expect(typeof chicken.calories).toBe('number');
    expect(typeof chicken.proteinG).toBe('number');
    expect(typeof chicken.carbsG).toBe('number');
    expect(typeof chicken.fatG).toBe('number');
    expect(chicken.calories).toBe(165);
    expect(chicken.proteinG).toBe(31);
  });

  it('parses fiber, sugar, and sodium', () => {
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);

    const almonds = transformed[3].data;
    expect(almonds.fiberG).toBe(3.5);
    expect(almonds.sugarG).toBe(1.2);
    expect(almonds.sodiumMg).toBe(1);
  });
});

// ── import tests ────────────────────────────────────────────────────

describe('import', () => {
  function makeMockDb() {
    const tables: Record<string, Record<string, unknown>[]> = {
      nu_foods: [],
      nu_food_log: [],
      nu_food_log_items: [],
    };

    return {
      execute(sql: string, params?: unknown[]) {
        if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK') return;
        if (sql.includes('INSERT INTO nu_foods')) {
          tables.nu_foods.push({
            id: params?.[0],
            name: params?.[1],
            calories: params?.[2],
            protein_g: params?.[3],
            carbs_g: params?.[4],
            fat_g: params?.[5],
          });
        }
        if (sql.includes('INSERT INTO nu_food_log (')) {
          tables.nu_food_log.push({
            id: params?.[0],
            date: params?.[1],
            meal_type: params?.[2],
          });
        }
        if (sql.includes('INSERT INTO nu_food_log_items')) {
          tables.nu_food_log_items.push({
            id: params?.[0],
            log_id: params?.[1],
            food_id: params?.[2],
            calories: params?.[4],
            protein_g: params?.[5],
          });
        }
      },
      query<T>(sql: string): T[] {
        if (sql.includes('FROM nu_foods')) return tables.nu_foods as T[];
        if (sql.includes('FROM nu_food_log')) return tables.nu_food_log as T[];
        return [] as T[];
      },
      tables,
    };
  }

  it('imports full MFP CSV into food tables', () => {
    const db = makeMockDb();
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);
    const result = myFitnessPalAdapter.import(db, transformed);

    expect(result.adapterName).toBe('myfitnesspal-csv');
    expect(result.targetModule).toBe('nutrition');
    expect(result.imported).toBe(4);
    expect(result.failed).toBe(0);
    expect(result.skipped).toBe(0);
  });

  it('creates food entries with dedup', () => {
    const db = makeMockDb();
    // CSV with same food name twice
    const csv = [
      MFP_FULL_HEADER,
      '2024-01-15,Breakfast,Oatmeal,150,3,1,0.5,1,0,0,5,100,27,4,1,5,0,0,2,1,',
      '2024-01-16,Breakfast,Oatmeal,150,3,1,0.5,1,0,0,5,100,27,4,1,5,0,0,2,1,',
    ].join('\n');

    const records = myFitnessPalAdapter.parse(csv);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);
    myFitnessPalAdapter.import(db, transformed);

    // Should create only 1 food entry (deduped by name)
    expect(db.tables.nu_foods).toHaveLength(1);
    // But 2 food log items
    expect(db.tables.nu_food_log_items).toHaveLength(2);
  });

  it('creates log entries grouped by date+meal', () => {
    const db = makeMockDb();
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);
    myFitnessPalAdapter.import(db, transformed);

    // 4 items: breakfast, lunch, dinner, snacks -- each unique date+meal
    expect(db.tables.nu_food_log).toHaveLength(4);
  });

  it('groups multiple items under same log entry', () => {
    const db = makeMockDb();
    const csv = [
      MFP_FULL_HEADER,
      '2024-01-15,Breakfast,Oatmeal,150,3,1,0.5,1,0,0,5,100,27,4,1,5,0,0,2,1,',
      '2024-01-15,Breakfast,Banana,105,0.4,0.1,0.1,0.1,0,0,1,422,27,3.1,14.4,1.3,1,15,1,0,',
    ].join('\n');

    const records = myFitnessPalAdapter.parse(csv);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);
    myFitnessPalAdapter.import(db, transformed);

    // 1 log entry (same date+meal)
    expect(db.tables.nu_food_log).toHaveLength(1);
    // But 2 food log items under that log
    expect(db.tables.nu_food_log_items).toHaveLength(2);
  });

  it('reports progress via callback', () => {
    const db = makeMockDb();
    const records = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    const { valid } = myFitnessPalAdapter.validate(records);
    const transformed = myFitnessPalAdapter.transform(valid);

    const progressEvents: string[] = [];
    myFitnessPalAdapter.import(db, transformed, (p) => {
      progressEvents.push(p.phase);
    });

    expect(progressEvents.includes('importing')).toBe(true);
    expect(progressEvents[progressEvents.length - 1]).toBe('complete');
  });
});

// ── Full pipeline integration test ──────────────────────────────────

describe('full pipeline', () => {
  it('detect -> parse -> validate -> transform -> verify data', () => {
    // Detection
    const detection = myFitnessPalAdapter.detectFormat(MFP_FULL_CSV);
    expect(detection.detected).toBe(true);

    // Parse
    const parsed = myFitnessPalAdapter.parse(MFP_FULL_CSV);
    expect(parsed).toHaveLength(4);

    // Validate
    const { valid, errors } = myFitnessPalAdapter.validate(parsed);
    expect(valid).toHaveLength(4);
    expect(errors).toHaveLength(0);

    // Transform
    const transformed = myFitnessPalAdapter.transform(valid);
    expect(transformed).toHaveLength(4);

    // Verify macro totals
    const totalCalories = transformed.reduce((sum, r) => sum + r.data.calories, 0);
    const totalProtein = transformed.reduce((sum, r) => sum + r.data.proteinG, 0);
    expect(totalCalories).toBe(150 + 165 + 208 + 164); // 687
    expect(totalProtein).toBe(15 + 31 + 28 + 6); // 80
  });

  it('adapter metadata is correct', () => {
    expect(myFitnessPalAdapter.name).toBe('myfitnesspal-csv');
    expect(myFitnessPalAdapter.sourceApp).toBe('MyFitnessPal');
    expect(myFitnessPalAdapter.targetModule).toBe('nutrition');
    expect(myFitnessPalAdapter.supportedExtensions).toEqual(['.csv']);
  });
});
