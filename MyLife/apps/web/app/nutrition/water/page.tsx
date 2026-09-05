'use client';

import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  doCreateWaterEntry,
  doDeleteWaterEntry,
  doSetSetting,
  fetchDailyWaterTotal,
  fetchWaterContainers,
  fetchWaterEntriesForDate,
  fetchWaterGoalMl,
  fetchWaterUnit,
  fetchWeeklyWaterTotals,
} from '../actions';
import { NUTRITION_CHROME, alpha, formatNutritionShortDate, formatNutritionTime } from '../_lib/design';
import {
  MaterialSymbol,
  NutritionButton,
  NutritionEmptyState,
  NutritionPageHeader,
  NutritionPanel,
} from '../_components/NutritionPrimitives';

type WaterEntry = {
  id: string;
  date: string;
  amountMl: number;
  source: string;
  createdAt: string;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function NutritionWaterPage() {
  const [date] = useState(todayIso);
  const [entries, setEntries] = useState<WaterEntry[]>([]);
  const [dailyTotalMl, setDailyTotalMl] = useState(0);
  const [goalMl, setGoalMl] = useState(2500);
  const [containers, setContainers] = useState<number[]>([250, 500, 750]);
  const [unit, setUnit] = useState<'ml' | 'oz'>('ml');
  const [weekly, setWeekly] = useState<Array<{ date: string; totalMl: number; entryCount: number }>>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dayEntries, total, savedGoal, presetContainers, savedUnit, weeklyTotals] = await Promise.all([
        fetchWaterEntriesForDate(date),
        fetchDailyWaterTotal(date),
        fetchWaterGoalMl(),
        fetchWaterContainers(),
        fetchWaterUnit(),
        fetchWeeklyWaterTotals(date),
      ]);
      setEntries(dayEntries as WaterEntry[]);
      setDailyTotalMl(total);
      setGoalMl(savedGoal);
      setContainers(presetContainers);
      setUnit(savedUnit);
      setWeekly((weeklyTotals.days ?? []) as Array<{ date: string; totalMl: number; entryCount: number }>);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to load hydration data.');
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    void load();
  }, [load]);

  const progress = useMemo(() => Math.min(dailyTotalMl / Math.max(goalMl, 1), 1), [dailyTotalMl, goalMl]);

  const handleAdd = useCallback(async (amountMl: number) => {
    try {
      await doCreateWaterEntry(crypto.randomUUID(), { date, amountMl, source: 'quick_add' });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to add water.');
    }
  }, [date, load]);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await doDeleteWaterEntry(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to delete water entry.');
    }
  }, [load]);

  const handleGoalChange = useCallback(async (delta: number) => {
    const nextGoal = Math.max(1000, goalMl + delta);
    setGoalMl(nextGoal);
    try {
      await doSetSetting('waterGoalMl', String(nextGoal));
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save hydration goal.');
    }
  }, [goalMl, load]);

  const handleUnitToggle = useCallback(async (nextUnit: 'ml' | 'oz') => {
    setUnit(nextUnit);
    try {
      await doSetSetting('waterUnit', nextUnit);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Failed to save hydration unit.');
    }
  }, []);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <NutritionPageHeader title="Hydration Log" description="Loading hydration entries and weekly glass metrics." />
        <NutritionPanel style={{ minHeight: 320, opacity: 0.42 }} />
      </div>
    );
  }

  if (error) {
    return (
      <NutritionEmptyState
        title="Hydration log unavailable"
        description={error}
        action={<NutritionButton onClick={() => void load()}>Retry</NutritionButton>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        title="Hydration Log"
        description="Quick-add water, tune the daily goal, and review the last seven days on a single glass-board surface."
        action={(
          <>
            <NutritionButton tone="ghost" onClick={() => handleUnitToggle(unit === 'ml' ? 'oz' : 'ml')}>
              Switch to {unit === 'ml' ? 'oz' : 'ml'}
            </NutritionButton>
            <NutritionButton tone="accent" onClick={() => void handleAdd(containers[0] ?? 250)}>
              Quick Add
            </NutritionButton>
          </>
        )}
      />

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)' }}>
        <NutritionPanel tone="focus" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 18, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <span style={{ fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: NUTRITION_CHROME.water }}>Today</span>
                <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.6 }}>
                  {(dailyTotalMl / 1000).toFixed(1)}L
                </div>
                <span style={{ color: NUTRITION_CHROME.textMuted }}>
                  Goal {(goalMl / 1000).toFixed(1)}L • {Math.round(progress * 100)}% complete
                </span>
              </div>

              <div style={{ width: 240, height: 240, position: 'relative' }}>
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    borderRadius: '50%',
                    background: `conic-gradient(${NUTRITION_CHROME.water} ${Math.max(progress * 360, 8)}deg, ${alpha('#FFFFFF', 0.06)} 0deg)`,
                    padding: 18,
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      height: '100%',
                      borderRadius: '50%',
                      background: `radial-gradient(circle at top, ${alpha(NUTRITION_CHROME.water, 0.24)}, transparent 45%), ${NUTRITION_CHROME.surfaceBase}`,
                      display: 'grid',
                      placeItems: 'center',
                    }}
                  >
                    <div style={{ display: 'grid', gap: 6, textAlign: 'center' }}>
                      <MaterialSymbol name="water_drop" filled size={34} color={NUTRITION_CHROME.water} />
                      <strong style={{ fontSize: 32, letterSpacing: -1 }}>{Math.round(dailyTotalMl)}</strong>
                      <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 12, letterSpacing: 1.6, textTransform: 'uppercase' }}>
                        {unit}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {containers.map((amount) => (
                <button key={amount} type="button" onClick={() => void handleAdd(amount)} style={chipStyle}>
                  +{amount}{unit}
                </button>
              ))}
            </div>

            <div style={{ display: 'grid', gap: 14, gridTemplateColumns: '120px 1fr 120px' }}>
              <button type="button" onClick={() => void handleGoalChange(-250)} style={goalStepButtonStyle}>
                <MaterialSymbol name="remove" size={18} />
              </button>
              <div style={goalCardStyle}>
                <span style={{ color: NUTRITION_CHROME.textDim, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>Daily goal</span>
                <strong style={{ fontSize: 24 }}>{goalMl}{unit}</strong>
              </div>
              <button type="button" onClick={() => void handleGoalChange(250)} style={goalStepButtonStyle}>
                <MaterialSymbol name="add" size={18} />
              </button>
            </div>
          </div>
        </NutritionPanel>

        <NutritionPanel style={{ padding: 22 }}>
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>7-day rhythm</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {weekly.map((day) => (
                <div key={day.date} style={{ display: 'grid', gap: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                    <span>{formatNutritionShortDate(day.date)}</span>
                    <span>{Math.round(day.totalMl)}ml</span>
                  </div>
                  <div style={{ height: 10, borderRadius: 999, background: alpha('#FFFFFF', 0.06), overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${Math.min(day.totalMl / Math.max(goalMl, 1), 1) * 100}%`,
                        borderRadius: 999,
                        background: `linear-gradient(90deg, ${alpha(NUTRITION_CHROME.water, 0.64)}, ${NUTRITION_CHROME.water})`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </NutritionPanel>
      </div>

      {entries.length > 0 ? (
        <section style={{ display: 'grid', gap: 14 }}>
          <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.4 }}>Today&apos;s pours</div>
          <div style={{ display: 'grid', gap: 12 }}>
            {entries.map((entry) => (
              <NutritionPanel key={entry.id} style={{ padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong>{entry.amountMl}ml</strong>
                    <span style={{ color: NUTRITION_CHROME.textMuted, fontSize: 13 }}>
                      {formatNutritionTime(entry.createdAt)} • {entry.source.replace('_', ' ')}
                    </span>
                  </div>
                  <button type="button" onClick={() => void handleDelete(entry.id)} style={deleteButtonStyle}>
                    <MaterialSymbol name="delete" size={18} color={NUTRITION_CHROME.danger} />
                  </button>
                </div>
              </NutritionPanel>
            ))}
          </div>
        </section>
      ) : (
        <NutritionEmptyState
          title="No hydration logged today"
          description={`Tap one of the quick-add chips to start filling ${formatNutritionShortDate(date)}.`}
        />
      )}
    </div>
  );
}

const chipStyle: CSSProperties = {
  minHeight: 42,
  padding: '0 16px',
  borderRadius: 999,
  border: `1.5px solid ${alpha(NUTRITION_CHROME.water, 0.28)}`,
  background: alpha(NUTRITION_CHROME.water, 0.12),
  color: NUTRITION_CHROME.water,
  cursor: 'pointer',
  fontWeight: 700,
};

const goalStepButtonStyle: CSSProperties = {
  minHeight: 64,
  borderRadius: 20,
  border: `1.5px solid ${alpha('#FFFFFF', 0.08)}`,
  background: alpha('#FFFFFF', 0.04),
  color: NUTRITION_CHROME.text,
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};

const goalCardStyle: CSSProperties = {
  minHeight: 64,
  borderRadius: 20,
  background: alpha('#FFFFFF', 0.05),
  display: 'grid',
  placeItems: 'center',
  gap: 4,
};

const deleteButtonStyle: CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: 14,
  border: 'none',
  background: alpha(NUTRITION_CHROME.danger, 0.14),
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
};
