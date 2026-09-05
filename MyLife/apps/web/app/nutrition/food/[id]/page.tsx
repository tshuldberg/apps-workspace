'use client';

import type { CSSProperties } from 'react';
import Link from 'next/link';
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import {
  doAddFoodLogItem,
  doCreateFoodLogEntry,
  doDeleteFood,
  fetchActiveGoals,
  fetchFoodById,
  fetchFoodLogEntries,
  fetchFoodNutrients,
} from '../../actions';
import {
  NUTRITION_CHROME,
  NUTRITION_MEALS,
  alpha,
  formatNutritionDate,
  formatNutritionNumber,
  getSourceBadge,
} from '../../_lib/design';
import {
  CalorieRing,
  MacroMeter,
  MaterialSymbol,
  NutritionBadge,
  NutritionButton,
  NutritionEmptyState,
  NutritionKicker,
  NutritionModal,
  NutritionPageHeader,
  NutritionPanel,
  NutritionSourceBadge,
} from '../../_components/NutritionPrimitives';

type Food = Awaited<ReturnType<typeof fetchFoodById>>;
type NutrientDetail = Awaited<ReturnType<typeof fetchFoodNutrients>>[number];
type Goal = Awaited<ReturnType<typeof fetchActiveGoals>>;
type LogEntry = Awaited<ReturnType<typeof fetchFoodLogEntries>>[number];
type MealKey = (typeof NUTRITION_MEALS)[number]['key'];
type ServingMode = 'serving' | 'per100g';

const MINERAL_NAMES = new Set([
  'Calcium',
  'Chloride',
  'Chromium',
  'Copper',
  'Fluoride',
  'Iodine',
  'Iron',
  'Magnesium',
  'Manganese',
  'Molybdenum',
  'Phosphorus',
  'Potassium',
  'Selenium',
  'Sodium',
  'Zinc',
]);

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function scaleMetric(value: number, multiplier: number): number {
  return Math.round(value * multiplier * 10) / 10;
}

function sourceGradient(source: string | null | undefined): string {
  const badge = getSourceBadge(source);
  return `linear-gradient(135deg, ${alpha(badge.color, 0.34)}, ${alpha(NUTRITION_CHROME.surfaceHigh, 0.98)})`;
}

function NutritionFoodDetailPageContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [food, setFood] = useState<Food>(null);
  const [nutrients, setNutrients] = useState<NutrientDetail[]>([]);
  const [goal, setGoal] = useState<Goal>(null);
  const [servingMode, setServingMode] = useState<ServingMode>('serving');
  const [portionCount, setPortionCount] = useState(1);
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [selectedMeal, setSelectedMeal] = useState<MealKey>(() => {
    const mealParam = searchParams.get('meal');
    return NUTRITION_MEALS.some((meal) => meal.key === mealParam)
      ? (mealParam as MealKey)
      : 'breakfast';
  });
  const [modalOpen, setModalOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!params.id) return;

    setLoading(true);
    setError(null);

    try {
      const [nextFood, nextNutrients, nextGoal] = await Promise.all([
        fetchFoodById(params.id),
        fetchFoodNutrients(params.id),
        fetchActiveGoals(todayIso()),
      ]);

      setFood(nextFood);
      setNutrients(nextNutrients);
      setGoal(nextGoal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load this food detail.');
    } finally {
      setLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const displayMultiplier = useMemo(() => {
    if (!food) return 1;
    if (servingMode === 'per100g' && food.servingSize > 0) {
      return 100 / food.servingSize;
    }
    return 1;
  }, [food, servingMode]);

  const effectiveServingCount = useMemo(
    () => portionCount * displayMultiplier,
    [displayMultiplier, portionCount],
  );

  const scaled = useMemo(() => {
    if (!food) return null;

    return {
      calories: scaleMetric(food.calories, effectiveServingCount),
      proteinG: scaleMetric(food.proteinG, effectiveServingCount),
      carbsG: scaleMetric(food.carbsG, effectiveServingCount),
      fatG: scaleMetric(food.fatG, effectiveServingCount),
      fiberG: scaleMetric(food.fiberG, effectiveServingCount),
      sugarG: scaleMetric(food.sugarG, effectiveServingCount),
      sodiumMg: scaleMetric(food.sodiumMg, effectiveServingCount),
    };
  }, [effectiveServingCount, food]);

  const [vitamins, minerals] = useMemo(() => {
    const scaledNutrients = nutrients.map((nutrient) => ({
      ...nutrient,
      scaledAmount: scaleMetric(nutrient.amount, effectiveServingCount),
    }));

    return [
      scaledNutrients.filter((nutrient) => !MINERAL_NAMES.has(nutrient.name)),
      scaledNutrients.filter((nutrient) => MINERAL_NAMES.has(nutrient.name)),
    ];
  }, [effectiveServingCount, nutrients]);

  const handleDelete = useCallback(async () => {
    if (!food) return;
    if (!window.confirm('Delete this food entry? This cannot be undone.')) return;

    setBusy(true);

    try {
      await doDeleteFood(food.id);
      router.push('/nutrition/search');
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to delete this food.');
      setBusy(false);
    }
  }, [food, router]);

  const handleAddToMeal = useCallback(async () => {
    if (!food || !scaled) return;

    setBusy(true);
    setNotice(null);

    try {
      const entries = await fetchFoodLogEntries(selectedDate);
      const existingEntry = (entries as LogEntry[]).find((entry) => entry.mealType === selectedMeal);
      const logId = existingEntry?.id ?? crypto.randomUUID();

      if (!existingEntry) {
        await doCreateFoodLogEntry(logId, {
          date: selectedDate,
          mealType: selectedMeal,
        });
      }

      await doAddFoodLogItem(crypto.randomUUID(), {
        logId,
        foodId: food.id,
        servingCount: effectiveServingCount,
        calories: scaled.calories,
        proteinG: scaled.proteinG,
        carbsG: scaled.carbsG,
        fatG: scaled.fatG,
      });

      setNotice(`Added to ${selectedMeal} on ${formatNutritionDate(selectedDate)}.`);
      setModalOpen(false);
    } catch (reason) {
      setNotice(reason instanceof Error ? reason.message : 'Unable to log this food.');
    } finally {
      setBusy(false);
    }
  }, [effectiveServingCount, food, scaled, selectedDate, selectedMeal]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <NutritionPanel tone="focus" style={{ minHeight: 320, opacity: 0.42 }} />
        <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' }}>
          <NutritionPanel style={{ minHeight: 420, opacity: 0.36 }} />
          <NutritionPanel style={{ minHeight: 420, opacity: 0.28 }} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <NutritionEmptyState
        title="Food detail unavailable"
        description={error}
        action={<NutritionButton onClick={() => void load()}>Retry</NutritionButton>}
      />
    );
  }

  if (!food || !scaled) {
    return (
      <NutritionEmptyState
        title="Food not found"
        description="This item is no longer available in your nutrition database."
        action={
          <Link href="/nutrition/search">
            <NutritionButton>Back To Search</NutritionButton>
          </Link>
        }
      />
    );
  }

  const sourceBadge = getSourceBadge(food.source);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <NutritionPageHeader
        kicker={<NutritionKicker color={sourceBadge.color}>Food Detail</NutritionKicker>}
        title={food.name}
        description={
          food.brand
            ? `${food.brand}. Use the serving picker to flip between base serving mode and per-100g analysis.`
            : 'Use the serving picker to flip between base serving mode and per-100g analysis.'
        }
        action={
          <>
            <Link href="/nutrition/search">
              <NutritionButton tone="ghost">Back To Search</NutritionButton>
            </Link>
            <NutritionButton tone="calorie" onClick={() => setModalOpen(true)}>
              Add To Meal
            </NutritionButton>
          </>
        }
      />

      {notice ? (
        <div style={noticeStyle}>
          <MaterialSymbol name="info" size={16} color={NUTRITION_CHROME.accentLight} />
          {notice}
        </div>
      ) : null}

      <NutritionPanel tone="focus" style={{ overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 0.95fr) minmax(0, 1.05fr)' }}>
          <div
            style={{
              minHeight: 320,
              display: 'grid',
              alignItems: 'end',
              padding: 28,
              background: sourceGradient(food.source),
            }}
          >
            <div style={{ display: 'grid', gap: 14 }}>
              <NutritionSourceBadge source={food.source} />
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: -1.4 }}>{food.name}</div>
                {food.brand ? (
                  <NutritionBadge color={NUTRITION_CHROME.text} background={alpha('#FFFFFF', 0.08)}>
                    {food.brand}
                  </NutritionBadge>
                ) : null}
              </div>
              <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                {food.servingSize} {food.servingUnit} base serving. Source attribution is preserved so you can trace USDA, OFF, FatSecret, AI, and custom entries without leaving the diary flow.
              </div>
            </div>
          </div>

          <div style={{ padding: 28, display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gap: 10 }}>
              <NutritionKicker color={NUTRITION_CHROME.accentLight}>Serving Picker</NutritionKicker>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {([
                  { key: 'serving' as const, label: `Per ${food.servingSize}${food.servingUnit}` },
                  { key: 'per100g' as const, label: 'Per 100g' },
                ]).map((option) => {
                  const active = servingMode === option.key;
                  return (
                    <button
                      key={option.key}
                      type="button"
                      onClick={() => setServingMode(option.key)}
                      style={{
                        ...chipStyle,
                        background: active ? alpha(NUTRITION_CHROME.accent, 0.18) : alpha('#FFFFFF', 0.05),
                        color: active ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                        boxShadow: active
                          ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accentLight, 0.34)}`
                          : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
                      }}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => setPortionCount((current) => Math.max(0.25, current - 0.25))}
                style={stepperStyle}
              >
                <MaterialSymbol name="remove" size={18} color={NUTRITION_CHROME.text} />
              </button>
              <div style={portionCardStyle}>
                <strong style={{ fontSize: 26, letterSpacing: -0.8 }}>{portionCount.toFixed(2)}x</strong>
                <span style={{ color: NUTRITION_CHROME.textMuted }}>
                  {servingMode === 'per100g'
                    ? `${formatNutritionNumber(portionCount * 100)}g total`
                    : `${food.servingSize} ${food.servingUnit} each`}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPortionCount((current) => Math.min(8, current + 0.25))}
                style={stepperStyle}
              >
                <MaterialSymbol name="add" size={18} color={NUTRITION_CHROME.text} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
              <MetricCard
                label="Calories"
                value={`${formatNutritionNumber(scaled.calories)}`}
                detail="Current serving"
                color={NUTRITION_CHROME.calorie}
              />
              <MetricCard
                label="Fiber"
                value={`${formatNutritionNumber(scaled.fiberG, 1)}g`}
                detail="Dietary fiber"
                color={NUTRITION_CHROME.fiber}
              />
              <MetricCard
                label="Sodium"
                value={`${formatNutritionNumber(scaled.sodiumMg)}mg`}
                detail="Current serving"
                color={NUTRITION_CHROME.water}
              />
            </div>
          </div>
        </div>
      </NutritionPanel>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.1fr) minmax(320px, 0.9fr)' }}>
        <NutritionPanel style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 22 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <NutritionKicker color={NUTRITION_CHROME.calorie}>Macro Board</NutritionKicker>
              <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
                Calories and macros scale with the current portion multiplier. Goal references use today&apos;s active target when available.
              </div>
            </div>

            <div style={{ display: 'grid', gap: 24, gridTemplateColumns: 'minmax(240px, 320px) minmax(0, 1fr)', alignItems: 'center' }}>
              <CalorieRing
                consumed={Math.round(scaled.calories)}
                goal={goal?.calories ?? Math.max(Math.round(scaled.calories * 1.5), 200)}
              />
              <div style={{ display: 'grid', gap: 16 }}>
                <MacroMeter
                  label="Protein"
                  consumed={scaled.proteinG}
                  goal={goal?.proteinG ?? Math.max(Math.round(scaled.proteinG * 1.5), 20)}
                  color={NUTRITION_CHROME.protein}
                />
                <MacroMeter
                  label="Carbs"
                  consumed={scaled.carbsG}
                  goal={goal?.carbsG ?? Math.max(Math.round(scaled.carbsG * 1.5), 20)}
                  color={NUTRITION_CHROME.carbs}
                />
                <MacroMeter
                  label="Fat"
                  consumed={scaled.fatG}
                  goal={goal?.fatG ?? Math.max(Math.round(scaled.fatG * 1.5), 10)}
                  color={NUTRITION_CHROME.fat}
                />
                <MacroMeter
                  label="Fiber"
                  consumed={scaled.fiberG}
                  goal={28}
                  color={NUTRITION_CHROME.fiber}
                />
              </div>
            </div>
          </div>
        </NutritionPanel>

        <NutritionPanel tone="focus" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <NutritionKicker color={NUTRITION_CHROME.accentLight}>Source & Details</NutritionKicker>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <NutritionSourceBadge source={food.source} />
                {food.barcode ? <NutritionBadge color={NUTRITION_CHROME.water}>Barcode</NutritionBadge> : null}
              </div>
            </div>

            <DetailRow label="Serving" value={`${food.servingSize} ${food.servingUnit}`} />
            <DetailRow label="Created" value={formatNutritionDate(food.createdAt)} />
            <DetailRow label="Updated" value={formatNutritionDate(food.updatedAt)} />
            {food.barcode ? <DetailRow label="Barcode" value={food.barcode} /> : null}
            {food.usdaNdbNumber ? <DetailRow label="USDA NDB" value={food.usdaNdbNumber} /> : null}
            <div style={{ color: NUTRITION_CHROME.textMuted, lineHeight: 1.7 }}>
              {sourceBadge.label} attribution remains attached to this food so search, diary, and export surfaces can show where the nutrition data originated.
            </div>

            {(food.source === 'custom' || food.source === 'ai_photo') ? (
              <NutritionButton tone="danger" onClick={() => void handleDelete()} disabled={busy}>
                Delete Food
              </NutritionButton>
            ) : null}
          </div>
        </NutritionPanel>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(2, minmax(0, 1fr))' }}>
        <NutrientGrid title="Vitamins" items={vitamins} tone={NUTRITION_CHROME.accentLight} />
        <NutrientGrid title="Minerals" items={minerals} tone={NUTRITION_CHROME.water} />
      </div>

      <NutritionModal
        open={modalOpen}
        title="Add To Meal"
        onClose={() => setModalOpen(false)}
        footer={
          <>
            <NutritionButton tone="ghost" onClick={() => setModalOpen(false)}>
              Cancel
            </NutritionButton>
            <NutritionButton tone="calorie" onClick={() => void handleAddToMeal()} disabled={busy}>
              {busy ? 'Adding...' : 'Log Food'}
            </NutritionButton>
          </>
        }
      >
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <label style={fieldLabelStyle}>Meal</label>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {NUTRITION_MEALS.map((meal) => {
                const active = selectedMeal === meal.key;
                return (
                  <button
                    key={meal.key}
                    type="button"
                    onClick={() => setSelectedMeal(meal.key)}
                    style={{
                      ...chipStyle,
                      background: active ? alpha(NUTRITION_CHROME.calorie, 0.18) : alpha('#FFFFFF', 0.05),
                      color: active ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                      boxShadow: active
                        ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.calorie, 0.38)}`
                        : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
                    }}
                  >
                    <MaterialSymbol name={meal.icon} size={16} color={active ? NUTRITION_CHROME.calorie : NUTRITION_CHROME.textMuted} />
                    {meal.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 8 }}>
            <label style={fieldLabelStyle}>Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(event) => setSelectedDate(event.target.value)}
              style={inputStyle}
            />
          </div>

          <NutritionPanel tone="base" style={{ padding: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={subtleTextStyle}>Food</span>
                <strong>{food.name}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={subtleTextStyle}>Portion</span>
                <strong>{portionCount.toFixed(2)}x</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={subtleTextStyle}>Calories</span>
                <strong>{formatNutritionNumber(scaled.calories)} kcal</strong>
              </div>
            </div>
          </NutritionPanel>
        </div>
      </NutritionModal>
    </div>
  );
}

function NutrientGrid({
  title,
  items,
  tone,
}: {
  title: string;
  items: Array<NutrientDetail & { scaledAmount: number }>;
  tone: string;
}) {
  return (
    <NutritionPanel style={{ padding: 22 }}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 6 }}>
          <NutritionKicker color={tone}>{title}</NutritionKicker>
          <div style={{ color: NUTRITION_CHROME.textMuted }}>
            {items.length > 0 ? `${items.length} tracked nutrients` : 'No nutrient panel available for this food.'}
          </div>
        </div>

        {items.length > 0 ? (
          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
            {items.map((item) => {
              const percentage = item.rda && item.rda > 0
                ? Math.min(Math.round((item.scaledAmount / item.rda) * 100), 100)
                : null;

              return (
                <div key={item.id} style={nutrientTileStyle}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong>{item.name}</strong>
                    <span style={subtleTextStyle}>
                      {formatNutritionNumber(item.scaledAmount, item.scaledAmount < 10 ? 1 : 0)} {item.unit}
                    </span>
                  </div>
                  {percentage !== null ? (
                    <div style={{ display: 'grid', gap: 8 }}>
                      <div style={{ height: 8, borderRadius: 999, background: alpha('#FFFFFF', 0.06), overflow: 'hidden' }}>
                        <div
                          style={{
                            height: '100%',
                            width: `${percentage}%`,
                            borderRadius: 999,
                            background: `linear-gradient(90deg, ${alpha(tone, 0.72)}, ${tone})`,
                          }}
                        />
                      </div>
                      <span style={subtleTextStyle}>{percentage}% of daily value</span>
                    </div>
                  ) : (
                    <span style={subtleTextStyle}>No daily value target stored.</span>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
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
    <div style={metricCardStyle}>
      <span style={{ fontSize: 11, letterSpacing: 1.6, textTransform: 'uppercase', color }}>{label}</span>
      <strong style={{ fontSize: 24, letterSpacing: -0.6 }}>{value}</strong>
      <span style={subtleTextStyle}>{detail}</span>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <span style={subtleTextStyle}>{label}</span>
      <strong style={{ textAlign: 'right' }}>{value}</strong>
    </div>
  );
}

const subtleTextStyle: CSSProperties = {
  color: NUTRITION_CHROME.textMuted,
  lineHeight: 1.7,
};

const noticeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 52,
  padding: '0 16px',
  borderRadius: 18,
  background: alpha(NUTRITION_CHROME.accent, 0.12),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accentLight, 0.18)}`,
};

const fieldLabelStyle: CSSProperties = {
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 1.8,
  textTransform: 'uppercase',
  color: NUTRITION_CHROME.textMuted,
};

const inputStyle: CSSProperties = {
  minHeight: 50,
  width: '100%',
  border: 'none',
  borderRadius: 18,
  padding: '0 16px',
  background: alpha('#FFFFFF', 0.05),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
};

const chipStyle: CSSProperties = {
  minHeight: 40,
  padding: '0 14px',
  border: 'none',
  borderRadius: 999,
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  cursor: 'pointer',
  fontWeight: 700,
};

const stepperStyle: CSSProperties = {
  width: 46,
  height: 46,
  borderRadius: 16,
  border: 'none',
  display: 'grid',
  placeItems: 'center',
  background: alpha('#FFFFFF', 0.05),
  cursor: 'pointer',
};

const portionCardStyle: CSSProperties = {
  minWidth: 180,
  minHeight: 88,
  padding: '0 18px',
  borderRadius: 22,
  display: 'grid',
  alignContent: 'center',
  gap: 6,
  background: alpha('#FFFFFF', 0.04),
};

const metricCardStyle: CSSProperties = {
  display: 'grid',
  gap: 6,
  padding: 16,
  borderRadius: 20,
  background: alpha('#FFFFFF', 0.04),
};

const nutrientTileStyle: CSSProperties = {
  display: 'grid',
  gap: 14,
  padding: 16,
  borderRadius: 20,
  background: alpha('#FFFFFF', 0.04),
};

export default function NutritionFoodDetailPage() {
  return (
    <Suspense fallback={null}>
      <NutritionFoodDetailPageContent />
    </Suspense>
  );
}
