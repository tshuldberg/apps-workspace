/**
 * Cross-module interface implementation for MyNutrition.
 *
 * Surfaces the day's food-log state on the hub Today view: a prompt to log
 * the first meal, or live calorie/protein progress against the daily goal.
 * All reads are pure queries over nu_ tables via the injected adapter.
 */

import type { DatabaseAdapter } from '@mylife/db';
import type {
  CrossModuleInterface,
  CorrelationDataset,
  CorrelationDataPoint,
  TodayCard,
  TodayCardContext,
} from '@mylife/module-registry';
import { getDailySummary, getDailyGoalProgress } from './stats/daily-summary';

const MODULE_ID = 'nutrition';

/** Trailing window for correlation series. */
const CORRELATION_DAYS = 90;

function isoDay(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function endOfUtcDay(now: Date): string {
  return new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
}

function getTodayCards(db: DatabaseAdapter, context: TodayCardContext): TodayCard[] {
  const date = isoDay(context.now);
  const summary = getDailySummary(db, date);
  const progress = getDailyGoalProgress(db, date);
  const expiresAt = endOfUtcDay(context.now);

  if (summary.mealCount === 0) {
    return [
      {
        id: `nutrition.log-first-meal.${date}`,
        moduleId: MODULE_ID,
        kind: 'action',
        priority: 65,
        title: 'Log your first meal today',
        subtitle: progress
          ? `Goal: ${Math.round(progress.calories.goal)} kcal`
          : undefined,
        cta: { label: 'Open diary', route: '/nutrition/log' },
        dismissible: true,
        expiresAt,
      },
    ];
  }

  if (progress) {
    return [
      {
        id: `nutrition.goal-progress.${date}`,
        moduleId: MODULE_ID,
        kind: 'progress',
        priority: 60,
        title: `${Math.round(progress.calories.consumed)} / ${Math.round(progress.calories.goal)} kcal`,
        subtitle: `Protein ${Math.round(progress.proteinG.consumed)} / ${Math.round(progress.proteinG.goal)} g · ${summary.mealCount} meal${summary.mealCount === 1 ? '' : 's'}`,
        cta: { label: 'View diary', route: '/nutrition/diary' },
        dismissible: true,
        expiresAt,
      },
    ];
  }

  return [
    {
      id: `nutrition.day-summary.${date}`,
      moduleId: MODULE_ID,
      kind: 'progress',
      priority: 55,
      title: `${Math.round(summary.calories)} kcal logged`,
      subtitle: `${summary.mealCount} meal${summary.mealCount === 1 ? '' : 's'} · ${Math.round(summary.proteinG)} g protein`,
      cta: { label: 'View diary', route: '/nutrition/diary' },
      dismissible: true,
      expiresAt,
    },
  ];
}

function getCorrelationData(db: DatabaseAdapter): CorrelationDataset {
  const rows = db.query<{ date: string; calories: number; protein: number }>(
    `SELECT l.date as date,
            COALESCE(SUM(i.calories), 0) as calories,
            COALESCE(SUM(i.protein_g), 0) as protein
     FROM nu_food_log l
     JOIN nu_food_log_items i ON i.log_id = l.id
     WHERE l.date >= date('now', '-' || ? || ' days')
     GROUP BY l.date
     ORDER BY l.date ASC`,
    [CORRELATION_DAYS],
  );

  const calories: CorrelationDataPoint[] = rows.map((r) => ({
    date: r.date,
    value: Math.round(r.calories),
  }));
  const protein: CorrelationDataPoint[] = rows.map((r) => ({
    date: r.date,
    value: Math.round(r.protein * 10) / 10,
  }));

  return {
    moduleId: MODULE_ID,
    series: [
      { metric: 'calories', label: 'Calories', unit: 'kcal', data: calories },
      { metric: 'protein', label: 'Protein', unit: 'g', data: protein },
    ],
  };
}

export const nutritionCrossModule: CrossModuleInterface = {
  getTodayCards: (db, context) => getTodayCards(db as DatabaseAdapter, context),
  getCorrelationData: (db) => getCorrelationData(db as DatabaseAdapter),
};
