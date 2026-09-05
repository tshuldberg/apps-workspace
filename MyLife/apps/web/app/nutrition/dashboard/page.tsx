'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  fetchDailySummary,
  fetchEnergyBalance,
  fetchGoalProgress,
  fetchMacroRatios,
  fetchMicronutrientSummary,
  fetchWeeklyEnergyBalance,
} from '../actions';
import { NUTRITION_CHROME, alpha, formatNutritionShortDate } from '../_lib/design';
import { NutritionEmptyState, NutritionPageHeader, NutritionPanel } from '../_components/NutritionPrimitives';

type Summary = Awaited<ReturnType<typeof fetchDailySummary>>;
type GoalProgress = Awaited<ReturnType<typeof fetchGoalProgress>>;
type MacroRatios = Awaited<ReturnType<typeof fetchMacroRatios>>;
type NutrientSummary = Awaited<ReturnType<typeof fetchMicronutrientSummary>>;
type EnergyBalance = Awaited<ReturnType<typeof fetchEnergyBalance>>;
type EnergyDay = Awaited<ReturnType<typeof fetchWeeklyEnergyBalance>>[number];

const MINERAL_NAMES = new Set([
  'Calcium',
  'Iron',
  'Magnesium',
  'Phosphorus',
  'Potassium',
  'Sodium',
  'Zinc',
  'Copper',
  'Manganese',
  'Selenium',
  'Chloride',
]);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionDashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [progress, setProgress] = useState<GoalProgress | null>(null);
  const [ratios, setRatios] = useState<MacroRatios>(null);
  const [nutrients, setNutrients] = useState<NutrientSummary>([]);
  const [energy, setEnergy] = useState<EnergyBalance>(null);
  const [weekly, setWeekly] = useState<EnergyDay[]>([]);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const date = todayIso();
    try {
      const [dailySummary, goalProgress, macroRatios, nutrientSummary, energyBalance, weeklyBalance] = await Promise.all([
        fetchDailySummary(date),
        fetchGoalProgress(date),
        fetchMacroRatios(date, date),
        fetchMicronutrientSummary(date),
        fetchEnergyBalance(date),
        fetchWeeklyEnergyBalance(date),
      ]);
      setSummary(dailySummary);
      setProgress(goalProgress);
      setRatios(macroRatios);
      setNutrients(nutrientSummary);
      setEnergy(energyBalance);
      setWeekly(weeklyBalance as EnergyDay[]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load dashboard.');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const [vitamins, minerals] = useMemo(() => {
    const vitaminsList = nutrients.filter((item) => !MINERAL_NAMES.has(item.nutrientName)).slice(0, 12);
    const mineralsList = nutrients.filter((item) => MINERAL_NAMES.has(item.nutrientName)).slice(0, 12);
    return [vitaminsList, mineralsList];
  }, [nutrients]);

  const ratioSlices = useMemo(() => {
    if (!ratios || ratios.totalCalories <= 0) return 'transparent 0deg 360deg';
    const proteinEnd = ratios.proteinPct * 3.6;
    const carbsEnd = proteinEnd + ratios.carbsPct * 3.6;
    return `${NUTRITION_CHROME.protein} 0deg ${proteinEnd}deg, ${NUTRITION_CHROME.carbs} ${proteinEnd}deg ${carbsEnd}deg, ${NUTRITION_CHROME.fat} ${carbsEnd}deg 360deg`;
  }, [ratios]);

  if (error) {
    return (
      <NutritionEmptyState
        title="Dashboard unavailable"
        description={error}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title="Micronutrient Dashboard"
        description="Energy balance, macro share, and essential micronutrients all mapped onto the same desktop surface."
      />

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.2fr) minmax(300px, 0.8fr)' }}>
        <NutritionPanel tone="focus" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <span style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: NUTRITION_CHROME.calorie }}>Energy balance</span>
                <strong style={{ fontSize: 32, letterSpacing: -1 }}>{energy?.net ?? 0} kcal</strong>
                <span style={{ color: NUTRITION_CHROME.textMuted }}>
                  {energy?.caloriesIn ?? 0} in • {energy?.caloriesOut ?? 0} out
                </span>
              </div>

              <div style={{ display: 'grid', gap: 12, width: 320 }}>
                {weekly.map((day) => (
                  <div key={day.date} style={{ display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: NUTRITION_CHROME.textMuted, fontSize: 12 }}>
                      <span>{formatNutritionShortDate(day.date)}</span>
                      <span>{Math.round(day.caloriesIn)} / {Math.round(day.totalExpenditure)}</span>
                    </div>
                    <div style={{ position: 'relative', height: 10, borderRadius: 999, background: alpha('#FFFFFF', 0.06), overflow: 'hidden' }}>
                      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(day.totalExpenditure / 3000, 1) * 100}%`, background: alpha(NUTRITION_CHROME.textMuted, 0.32) }} />
                      <div style={{ position: 'absolute', inset: 0, width: `${Math.min(day.caloriesIn / 3000, 1) * 100}%`, background: `linear-gradient(90deg, ${NUTRITION_CHROME.calorie}, ${NUTRITION_CHROME.warning})` }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </NutritionPanel>

        <NutritionPanel style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 18, justifyItems: 'center' }}>
            <div style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: NUTRITION_CHROME.accentLight }}>Macro distribution</div>
            <div style={{ width: 220, height: 220, borderRadius: '50%', background: `conic-gradient(${ratioSlices})`, padding: 22 }}>
              <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: NUTRITION_CHROME.surfaceBase, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ fontSize: 30, letterSpacing: -1 }}>{Math.round(summary?.calories ?? 0)}</strong>
                  <span style={{ color: NUTRITION_CHROME.textMuted }}>kcal today</span>
                </div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8, width: '100%' }}>
              <LegendRow color={NUTRITION_CHROME.protein} label="Protein" value={`${ratios?.proteinPct ?? 0}%`} />
              <LegendRow color={NUTRITION_CHROME.carbs} label="Carbs" value={`${ratios?.carbsPct ?? 0}%`} />
              <LegendRow color={NUTRITION_CHROME.fat} label="Fat" value={`${ratios?.fatPct ?? 0}%`} />
            </div>
          </div>
        </NutritionPanel>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <NutrientGrid title="Vitamins" items={vitamins} />
        <NutrientGrid title="Minerals" items={minerals} />
      </div>

      <div style={{ display: 'grid', gap: 14, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <MetricCard label="Calories" value={`${Math.round(summary?.calories ?? 0)}`} detail={`Goal ${Math.round(progress?.calories?.goal ?? 0)}`} color={NUTRITION_CHROME.calorie} />
        <MetricCard label="Protein" value={`${Math.round(summary?.proteinG ?? 0)}g`} detail={`Goal ${Math.round(progress?.proteinG?.goal ?? 0)}g`} color={NUTRITION_CHROME.protein} />
        <MetricCard label="Carbs" value={`${Math.round(summary?.carbsG ?? 0)}g`} detail={`Goal ${Math.round(progress?.carbsG?.goal ?? 0)}g`} color={NUTRITION_CHROME.carbs} />
        <MetricCard label="Fat" value={`${Math.round(summary?.fatG ?? 0)}g`} detail={`Goal ${Math.round(progress?.fatG?.goal ?? 0)}g`} color={NUTRITION_CHROME.fat} />
      </div>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ width: 12, height: 12, borderRadius: 999, background: color }} />
        <span>{label}</span>
      </div>
      <strong style={{ color }}>{value}</strong>
    </div>
  );
}

function NutrientGrid({
  title,
  items,
}: {
  title: string;
  items: NutrientSummary;
}) {
  return (
    <NutritionPanel style={{ padding: 22 }}>
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>{title}</div>
        <div style={{ display: 'grid', gap: 10 }}>
          {items.map((item) => (
            <div key={item.nutrientId} style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 13 }}>
                <span>{item.nutrientName}</span>
                <span style={{ color: NUTRITION_CHROME.textMuted }}>
                  {item.consumed.toFixed(1)} {item.unit}
                </span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: alpha('#FFFFFF', 0.06), overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${Math.min(item.percentage ?? 0, 100)}%`, background: pickStatusColor(item.status) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </NutritionPanel>
  );
}

function MetricCard({
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

function pickStatusColor(status: string): string {
  if (status === 'deficient') return NUTRITION_CHROME.danger;
  if (status === 'low') return NUTRITION_CHROME.warning;
  if (status === 'excess') return NUTRITION_CHROME.calorie;
  return NUTRITION_CHROME.success;
}
