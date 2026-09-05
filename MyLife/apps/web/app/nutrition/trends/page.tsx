'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchActiveGoals,
  fetchCalorieHistory,
  fetchNutritionInsights,
} from '../actions';
import { NUTRITION_CHROME, alpha, formatNutritionShortDate } from '../_lib/design';
import { NutritionEmptyState, NutritionPageHeader, NutritionPanel } from '../_components/NutritionPrimitives';

type TrendDay = Awaited<ReturnType<typeof fetchCalorieHistory>>[number];
type Goal = Awaited<ReturnType<typeof fetchActiveGoals>>;
type Insight = Awaited<ReturnType<typeof fetchNutritionInsights>>[number];
type Range = '7d' | '30d' | '90d';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function linePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return '';
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  return values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * height;
      return `${x},${y}`;
    })
    .join(' ');
}

export default function NutritionTrendsPage() {
  const [range, setRange] = useState<Range>('30d');
  const [days, setDays] = useState<TrendDay[]>([]);
  const [goal, setGoal] = useState<Goal>(null);
  const [insights, setInsights] = useState<Insight[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const dayCount = range === '7d' ? 7 : range === '30d' ? 30 : 90;
    try {
      const [history, activeGoal, smartInsights] = await Promise.all([
        fetchCalorieHistory(dayCount),
        fetchActiveGoals(todayIso()),
        fetchNutritionInsights(Math.max(dayCount, 30)),
      ]);
      setDays(history as TrendDay[]);
      setGoal(activeGoal);
      setInsights((smartInsights as Insight[]).slice(0, 6));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load trends.');
    }
  }, [range]);

  useEffect(() => {
    void load();
  }, [load]);

  const stats = useMemo(() => {
    const logged = days.filter((day) => day.calories > 0);
    if (logged.length === 0) {
      return { avgCalories: 0, adherence: 0, avgProtein: 0, avgCarbs: 0, avgFat: 0 };
    }
    const calorieGoal = goal?.calories ?? 2000;
    const low = calorieGoal * 0.85;
    const high = calorieGoal * 1.15;
    return {
      avgCalories: Math.round(logged.reduce((sum, day) => sum + day.calories, 0) / logged.length),
      adherence: Math.round((logged.filter((day) => day.calories >= low && day.calories <= high).length / logged.length) * 100),
      avgProtein: Math.round(logged.reduce((sum, day) => sum + day.proteinG, 0) / logged.length),
      avgCarbs: Math.round(logged.reduce((sum, day) => sum + day.carbsG, 0) / logged.length),
      avgFat: Math.round(logged.reduce((sum, day) => sum + day.fatG, 0) / logged.length),
    };
  }, [days, goal]);

  const calorieValues = days.map((day) => day.calories);
  const goalLine = goal?.calories ?? 2000;

  if (error) {
    return (
      <NutritionEmptyState
        title="Trends unavailable"
        description={error}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title="Trend Studio"
        description="Switch between short and long horizons, then compare daily intake with macro mix and the cross-module nutrition insight engine."
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {(['7d', '30d', '90d'] as Range[]).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setRange(value)}
            style={{
              minHeight: 38,
              padding: '0 16px',
              borderRadius: 999,
              border: 'none',
              cursor: 'pointer',
              background: range === value ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.04),
              color: range === value ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
              boxShadow: range === value ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accent, 0.24)}` : 'none',
              fontWeight: 700,
            }}
          >
            {value.toUpperCase()}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <TrendMetric label="Avg Calories" value={`${stats.avgCalories}`} detail={`Goal ${goalLine}`} color={NUTRITION_CHROME.calorie} />
        <TrendMetric label="Adherence" value={`${stats.adherence}%`} detail="Within calorie target range" color={NUTRITION_CHROME.accentLight} />
        <TrendMetric label="Avg Protein" value={`${stats.avgProtein}g`} detail="Across logged days" color={NUTRITION_CHROME.protein} />
        <TrendMetric label="Avg Carbs" value={`${stats.avgCarbs}g`} detail="Across logged days" color={NUTRITION_CHROME.carbs} />
      </div>

      <NutritionPanel tone="focus" style={{ padding: 22 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <strong style={{ fontSize: 20 }}>Calories over time</strong>
            <span style={{ color: NUTRITION_CHROME.textMuted }}>Goal line {goalLine} kcal</span>
          </div>
          {days.length > 0 ? (
            <svg viewBox="0 0 960 240" style={{ width: '100%', height: 240 }}>
              {[0.25, 0.5, 0.75, 1].map((step) => (
                <line key={step} x1="0" y1={240 - step * 200} x2="960" y2={240 - step * 200} stroke={alpha('#FFFFFF', 0.06)} strokeWidth="2" />
              ))}
              <line
                x1="0"
                y1={240 - (goalLine / Math.max(...calorieValues, goalLine, 1)) * 200}
                x2="960"
                y2={240 - (goalLine / Math.max(...calorieValues, goalLine, 1)) * 200}
                stroke={alpha(NUTRITION_CHROME.textMuted, 0.72)}
                strokeDasharray="10 10"
                strokeWidth="2"
              />
              <polyline
                fill="none"
                stroke={NUTRITION_CHROME.calorie}
                strokeWidth="4"
                strokeLinecap="round"
                strokeLinejoin="round"
                points={linePoints(calorieValues, 960, 200)}
              />
            </svg>
          ) : (
            <div style={{ color: NUTRITION_CHROME.textMuted }}>Log meals to unlock the trend graph.</div>
          )}
        </div>
      </NutritionPanel>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' }}>
        <NutritionPanel style={{ padding: 22 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <strong style={{ fontSize: 20 }}>Daily macro mix</strong>
            <div style={{ display: 'grid', gap: 10 }}>
              {days.slice(-10).map((day) => {
                const total = day.proteinG * 4 + day.carbsG * 4 + day.fatG * 9;
                const protein = total > 0 ? ((day.proteinG * 4) / total) * 100 : 0;
                const carbs = total > 0 ? ((day.carbsG * 4) / total) * 100 : 0;
                const fat = total > 0 ? ((day.fatG * 9) / total) * 100 : 0;
                return (
                  <div key={day.date} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: NUTRITION_CHROME.textMuted }}>
                      <span>{formatNutritionShortDate(day.date)}</span>
                      <span>{Math.round(day.calories)} kcal</span>
                    </div>
                    <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: alpha('#FFFFFF', 0.06) }}>
                      <div style={{ width: `${protein}%`, background: NUTRITION_CHROME.protein }} />
                      <div style={{ width: `${carbs}%`, background: NUTRITION_CHROME.carbs }} />
                      <div style={{ width: `${fat}%`, background: NUTRITION_CHROME.fat }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </NutritionPanel>

        <NutritionPanel style={{ padding: 22 }}>
          <div style={{ display: 'grid', gap: 16 }}>
            <strong style={{ fontSize: 20 }}>Smart insights</strong>
            {insights.length > 0 ? insights.map((insight) => (
              <div key={insight.id} style={{ display: 'grid', gap: 6, padding: 16, borderRadius: 18, background: alpha('#FFFFFF', 0.04) }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <strong>{insight.title}</strong>
                  <span style={{ color: NUTRITION_CHROME.accentLight }}>{insight.metric}</span>
                </div>
                <span style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>{insight.body}</span>
              </div>
            )) : (
              <div style={{ color: NUTRITION_CHROME.textMuted }}>Log at least a few weeks of meals to unlock the six detector insights.</div>
            )}
          </div>
        </NutritionPanel>
      </div>

      <NutritionPanel style={{ padding: 22 }}>
        <div style={{ display: 'grid', gap: 10 }}>
          <strong style={{ fontSize: 20 }}>Goal compliance</strong>
          {days.slice(-8).map((day) => {
            const compliance = goalLine > 0 ? Math.min(day.calories / goalLine, 1.25) : 0;
            return (
              <div key={day.date} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 12, color: NUTRITION_CHROME.textMuted }}>
                  <span>{formatNutritionShortDate(day.date)}</span>
                  <span>{Math.round(compliance * 100)}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 999, background: alpha('#FFFFFF', 0.06), overflow: 'hidden' }}>
                  <div
                    style={{
                      height: '100%',
                      width: `${Math.min(compliance, 1) * 100}%`,
                      background: `linear-gradient(90deg, ${NUTRITION_CHROME.accentLight}, ${NUTRITION_CHROME.accent})`,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </NutritionPanel>
    </div>
  );
}

function TrendMetric({
  label,
  value,
  detail,
  color,
}: {
  label: string;
  value: string;
  detail: string;
  color: string;
}) {
  return (
    <NutritionPanel style={{ padding: 18 }}>
      <div style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontSize: 11, letterSpacing: 1.8, textTransform: 'uppercase', color }}>{label}</span>
        <strong style={{ fontSize: 26 }}>{value}</strong>
        <span style={{ color: NUTRITION_CHROME.textMuted }}>{detail}</span>
      </div>
    </NutritionPanel>
  );
}
