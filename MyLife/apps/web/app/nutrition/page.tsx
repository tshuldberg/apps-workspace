'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDailySummary,
  fetchGoalProgress,
  fetchMealBreakdown,
  fetchDailyWaterTotal,
  fetchWaterGoalMl,
  fetchEatingWindow,
  fetchFoodLogEntries,
} from './actions';
import {
  NUTRITION_CHROME,
  NUTRITION_MEALS,
  formatNutritionShortDate,
  formatNutritionTime,
} from './_lib/design';
import {
  CalorieRing,
  MacroMeter,
  MaterialSymbol,
  NutritionButton,
  NutritionEmptyState,
  NutritionKicker,
  NutritionPageHeader,
  NutritionPanel,
} from './_components/NutritionPrimitives';

type DailySummary = Awaited<ReturnType<typeof fetchDailySummary>>;
type GoalProgress = Awaited<ReturnType<typeof fetchGoalProgress>>;
type MealBreakdownList = Awaited<ReturnType<typeof fetchMealBreakdown>>;
type EatingWindow = Awaited<ReturnType<typeof fetchEatingWindow>>;

type Entry = {
  id: string;
  date: string;
  mealType: string;
  notes: string | null;
  createdAt: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionHomePage() {
  const [date] = useState(todayIso);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [meals, setMeals] = useState<MealBreakdownList>([]);
  const [waterMl, setWaterMl] = useState(0);
  const [waterGoalMl, setWaterGoalMl] = useState(2500);
  const [eatingWindow, setEatingWindow] = useState<EatingWindow>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dailySummary, goalProgress, mealBreakdown, totalWater, goalWater, currentWindow, logEntries] = await Promise.all([
        fetchDailySummary(date),
        fetchGoalProgress(date),
        fetchMealBreakdown(date),
        fetchDailyWaterTotal(date),
        fetchWaterGoalMl(),
        fetchEatingWindow(),
        fetchFoodLogEntries(date),
      ]);

      setSummary(dailySummary);
      setProgress(goalProgress);
      setMeals(mealBreakdown);
      setWaterMl(totalWater);
      setWaterGoalMl(goalWater);
      setEatingWindow(currentWindow);
      setEntries(logEntries as Entry[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load nutrition home.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const mealCards = useMemo(() => {
    return NUTRITION_MEALS.map((meal) => {
      const mealStats = meals.find((item) => item.mealType === meal.key);
      const mealEntries = entries.filter((entry) => entry.mealType === meal.key);
      const latest = mealEntries
        .slice()
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

      return {
        ...meal,
        calories: Math.round(mealStats?.calories ?? 0),
        itemCount: mealStats?.itemCount ?? 0,
        proteinG: Math.round(mealStats?.proteinG ?? 0),
        lastLogged: latest?.createdAt ?? null,
      };
    });
  }, [entries, meals]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <NutritionPageHeader
          kicker={<NutritionKicker color={NUTRITION_CHROME.calorie}>Phase 5 Web Parity</NutritionKicker>}
          title="Daily Mission Control"
          description="Loading your daily calorie ring, macro board, hydration, and meal deck."
        />
        <div style={{ display: 'grid', gap: 18, gridTemplateColumns: '1.75fr 1fr' }}>
          <NutritionPanel style={{ minHeight: 520, opacity: 0.52 }} />
          <NutritionPanel style={{ minHeight: 520, opacity: 0.42 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <NutritionEmptyState
        title="The nutrition dashboard is temporarily unavailable"
        description={error}
        action={<NutritionButton onClick={() => void load()}>Retry</NutritionButton>}
      />
    );
  }

  const macroGoals = {
    protein: progress?.proteinG?.goal ?? Math.max(Math.round((summary?.proteinG ?? 0) * 1.25), 100),
    carbs: progress?.carbsG?.goal ?? Math.max(Math.round((summary?.carbsG ?? 0) * 1.25), 150),
    fat: progress?.fatG?.goal ?? Math.max(Math.round((summary?.fatG ?? 0) * 1.25), 55),
  };
  const hasEntries = entries.length > 0;

  return (
    <div style={{ display: 'grid', gap: 28 }}>
      <NutritionPageHeader
        kicker={<NutritionKicker color={NUTRITION_CHROME.calorie}>Daily Pulse</NutritionKicker>}
        title="Daily Mission Control"
        description={(
          <>
            {formatNutritionShortDate(date)}. The gold chrome moves navigation and the orange ring stays reserved for energy intake.
            {eatingWindow?.eatingWindowStart && eatingWindow?.eatingWindowEnd
              ? ` Your current eating window runs ${formatNutritionTime(eatingWindow.eatingWindowStart)} to ${formatNutritionTime(eatingWindow.eatingWindowEnd)}.`
              : ''}
          </>
        )}
        action={(
          <>
            <Link href="/nutrition/diary">
              <NutritionButton tone="ghost">Open Diary</NutritionButton>
            </Link>
            <Link href="/nutrition/log">
              <NutritionButton tone="calorie">Add Food</NutritionButton>
            </Link>
          </>
        )}
      />

      {!hasEntries ? (
        <NutritionEmptyState
          title="Log your first meal"
          description="Your calorie ring, meal cadence, and macro targets come alive as soon as you log the first bite of the day."
          action={
            <Link href="/nutrition/log">
              <NutritionButton tone="calorie">Log Food</NutritionButton>
            </Link>
          }
        />
      ) : null}

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)' }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <NutritionPanel tone="focus" style={{ padding: 28 }}>
            <div style={{ display: 'grid', gap: 22 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <NutritionKicker color={NUTRITION_CHROME.calorie}>Calories</NutritionKicker>
                  <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                    Track intake against your daily target, then use the meal deck to drill into each moment.
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <div style={pillStyle}>
                    <MaterialSymbol name="water_drop" size={16} color={NUTRITION_CHROME.water} />
                    {Math.round((waterMl / Math.max(waterGoalMl, 1)) * 100)}% hydrated
                  </div>
                  <div style={pillStyle}>
                    <MaterialSymbol name="flag" size={16} color={NUTRITION_CHROME.accentLight} />
                    {Math.round(progress?.calories?.percentage ?? 0)}% of goal
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)', alignItems: 'center' }}>
                <CalorieRing
                  consumed={Math.round(summary?.calories ?? 0)}
                  goal={progress?.calories?.goal ?? 2200}
                />
                <div style={{ display: 'grid', gap: 18 }}>
                  <MacroMeter
                    label="Protein"
                    consumed={summary?.proteinG ?? 0}
                    goal={macroGoals.protein}
                    color={NUTRITION_CHROME.protein}
                  />
                  <MacroMeter
                    label="Carbs"
                    consumed={summary?.carbsG ?? 0}
                    goal={macroGoals.carbs}
                    color={NUTRITION_CHROME.carbs}
                  />
                  <MacroMeter
                    label="Fat"
                    consumed={summary?.fatG ?? 0}
                    goal={macroGoals.fat}
                    color={NUTRITION_CHROME.fat}
                  />
                </div>
              </div>
            </div>
          </NutritionPanel>

          <NutritionPanel style={{ padding: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', marginBottom: 18 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <NutritionKicker color={NUTRITION_CHROME.water}>Hydration</NutritionKicker>
                <div style={{ fontSize: 26, fontWeight: 700, letterSpacing: -0.8 }}>
                  {(waterMl / 1000).toFixed(1)}L / {(waterGoalMl / 1000).toFixed(1)}L
                </div>
              </div>
              <Link href="/nutrition/water">
                <NutritionButton tone="ghost">Open Hydration</NutritionButton>
              </Link>
            </div>
            <div style={{ height: 14, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
              <div
                style={{
                  height: '100%',
                  width: `${Math.min((waterMl / Math.max(waterGoalMl, 1)) * 100, 100)}%`,
                  borderRadius: 999,
                  background: `linear-gradient(90deg, ${NUTRITION_CHROME.water}, ${NUTRITION_CHROME.carbs})`,
                }}
              />
            </div>
            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', marginTop: 18 }}>
              <div style={statCardStyle}>
                <span style={statLabelStyle}>Entries</span>
                <strong style={statValueStyle}>{entries.length}</strong>
              </div>
              <div style={statCardStyle}>
                <span style={statLabelStyle}>Meals</span>
                <strong style={statValueStyle}>{mealCards.filter((meal) => meal.itemCount > 0).length}</strong>
              </div>
              <div style={statCardStyle}>
                <span style={statLabelStyle}>Window</span>
                <strong style={statValueStyle}>
                  {eatingWindow?.eatingWindowStart ? formatNutritionTime(eatingWindow.eatingWindowStart) : 'Open'}
                </strong>
              </div>
            </div>
          </NutritionPanel>
        </div>

        <div style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <NutritionPanel style={{ padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div>
                <NutritionKicker color={NUTRITION_CHROME.accentLight}>Today&apos;s Meals</NutritionKicker>
                <div style={{ marginTop: 8, fontSize: 24, fontWeight: 700, letterSpacing: -0.8 }}>Meal Deck</div>
              </div>
              <Link href="/nutrition/diary" style={{ color: NUTRITION_CHROME.accentLight, fontWeight: 700 }}>
                Diary
              </Link>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              {mealCards.map((meal) => (
                <Link key={meal.key} href={`/nutrition/diary?meal=${meal.key}`}>
                  <div style={mealCardStyle}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <MaterialSymbol name={meal.icon} size={18} color={NUTRITION_CHROME.accentLight} />
                        <span style={{ fontSize: 16, fontWeight: 700 }}>{meal.label}</span>
                      </div>
                      <div style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                        {meal.itemCount > 0
                          ? `${meal.itemCount} items${meal.lastLogged ? ` • ${formatNutritionTime(meal.lastLogged)}` : ''}`
                          : 'No items logged yet'}
                      </div>
                      <div style={{ color: NUTRITION_CHROME.textDim, fontSize: 12 }}>
                        {meal.itemCount > 0 ? `${meal.proteinG}g protein captured` : 'Tap to add the first entry'}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: 24, fontWeight: 800, color: NUTRITION_CHROME.calorie }}>
                        {meal.calories}
                      </div>
                      <div style={{ color: NUTRITION_CHROME.textDim, fontSize: 11, letterSpacing: 1.4, textTransform: 'uppercase' }}>
                        kcal
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </NutritionPanel>
        </div>
      </div>
    </div>
  );
}

const pillStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minHeight: 34,
  padding: '0 12px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
  color: 'rgba(228,225,233,0.78)',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: 1,
  textTransform: 'uppercase',
};

const statCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.04)',
};

const statLabelStyle: CSSProperties = {
  fontSize: 10,
  letterSpacing: 1.8,
  textTransform: 'uppercase',
  color: NUTRITION_CHROME.textDim,
};

const statValueStyle: CSSProperties = {
  fontSize: 20,
  color: NUTRITION_CHROME.text,
};

const mealCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 16,
  padding: 18,
  borderRadius: 22,
  background: 'rgba(255,255,255,0.04)',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.04)',
};
