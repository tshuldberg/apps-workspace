import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import type { DatabaseAdapter } from '@mylife/db';
import { createModuleTestDatabase } from '@mylife/db';
import { NUTRITION_MODULE } from '../definition';
import { nutritionCrossModule } from '../cross-module';

const NOW = new Date('2026-07-04T15:00:00.000Z');
const TODAY = '2026-07-04';

function seedMeal(db: DatabaseAdapter, calories: number, proteinG: number): void {
  db.execute(
    `INSERT INTO nu_foods (id, name, serving_size, serving_unit, calories, protein_g)
     VALUES ('f1', 'Chicken bowl', 1, 'bowl', ?, ?)
     ON CONFLICT (id) DO NOTHING`,
    [calories, proteinG],
  );
  db.execute(
    `INSERT INTO nu_food_log (id, date, meal_type) VALUES ('l1', ?, 'lunch')`,
    [TODAY],
  );
  db.execute(
    `INSERT INTO nu_food_log_items (id, log_id, food_id, calories, protein_g)
     VALUES ('i1', 'l1', 'f1', ?, ?)`,
    [calories, proteinG],
  );
}

function seedGoal(db: DatabaseAdapter, calories: number, proteinG: number): void {
  db.execute(
    `INSERT INTO nu_daily_goals (id, calories, protein_g, effective_date)
     VALUES ('g1', ?, ?, ?)`,
    [calories, proteinG, TODAY],
  );
}

describe('nutrition getTodayCards', () => {
  let adapter: DatabaseAdapter;
  let closeDb: () => void;

  beforeEach(() => {
    const testDb = createModuleTestDatabase('nutrition', NUTRITION_MODULE.migrations!);
    adapter = testDb.adapter;
    closeDb = testDb.close;
  });

  afterEach(() => {
    closeDb();
  });

  it('prompts to log the first meal when the diary is empty', () => {
    const cards = nutritionCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe('action');
    expect(cards[0]!.title).toBe('Log your first meal today');
    expect(cards[0]!.cta?.route).toBe('/nutrition/log');
  });

  it('shows goal progress once meals are logged against a goal', () => {
    seedGoal(adapter, 2600, 180);
    seedMeal(adapter, 650, 45);
    const cards = nutritionCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.kind).toBe('progress');
    expect(cards[0]!.title).toBe('650 / 2600 kcal');
    expect(cards[0]!.subtitle).toContain('Protein 45 / 180 g');
  });

  it('falls back to a raw day summary when no goal exists', () => {
    seedMeal(adapter, 650, 45);
    const cards = nutritionCrossModule.getTodayCards!(adapter, { now: NOW });
    expect(cards).toHaveLength(1);
    expect(cards[0]!.title).toBe('650 kcal logged');
    expect(cards[0]!.subtitle).toContain('1 meal');
  });

  it('exposes calories + protein correlation series for Insights', () => {
    seedMeal(adapter, 650, 45);
    const dataset = nutritionCrossModule.getCorrelationData!(adapter);
    expect(dataset.moduleId).toBe('nutrition');
    const metrics = dataset.series.map((s) => s.metric);
    expect(metrics).toEqual(['calories', 'protein']);
    const calories = dataset.series[0]!;
    expect(calories.data).toHaveLength(1);
    expect(calories.data[0]).toEqual({ date: TODAY, value: 650 });
    const protein = dataset.series[1]!;
    expect(protein.data[0]).toEqual({ date: TODAY, value: 45 });
  });
});
