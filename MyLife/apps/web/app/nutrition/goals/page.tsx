'use client';

import type { CSSProperties, ReactNode } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  ActivityLevel,
  MacroSplitPercents,
  UserSex,
  WeightGoalDirection,
} from '@mylife/nutrition';
import {
  calculateBMR,
  calculateDailyCalories,
  calculateMacroGrams,
  calculateTDEE,
  cmToFtIn,
  ftInToCm,
  kgToLbs,
  lbsToKg,
  normalizeMacroSplit,
} from '@mylife/nutrition';
import {
  doCreateGoals,
  doDeleteGoals,
  doSetSetting,
  doUpdateGoals,
  fetchActiveGoals,
  fetchAllGoals,
  fetchAllSettings,
} from '../actions';
import { NUTRITION_CHROME, alpha, formatNutritionDate } from '../_lib/design';
import {
  MaterialSymbol,
  NutritionBadge,
  NutritionButton,
  NutritionEmptyState,
  NutritionKicker,
  NutritionMetricCard,
  NutritionPageHeader,
  NutritionPanel,
} from '../_components/NutritionPrimitives';

type GoalEntry = Awaited<ReturnType<typeof fetchAllGoals>>[number];

type WeightUnit = 'lb' | 'kg';
type HeightMode = 'ft_in' | 'cm';
type MacroPresetKey = 'balanced' | 'high-protein' | 'keto' | 'custom';

interface GoalFormState {
  goalType: WeightGoalDirection;
  goalRate: number;
  weightUnit: WeightUnit;
  heightMode: HeightMode;
  currentWeight: string;
  targetWeight: string;
  heightFeet: string;
  heightInches: string;
  heightCm: string;
  age: number;
  sex: UserSex;
  activityLevel: ActivityLevel;
  calorieTarget: string;
  macroPreset: MacroPresetKey;
  split: MacroSplitPercents;
  manualMacros: boolean;
  proteinOverride: string;
  carbsOverride: string;
  fatOverride: string;
}

const GOAL_OPTIONS: Array<{
  key: WeightGoalDirection;
  title: string;
  subtitle: string;
}> = [
  { key: 'lose', title: 'Lose', subtitle: 'Create a measured calorie deficit.' },
  { key: 'maintain', title: 'Maintain', subtitle: 'Hold your current body weight steady.' },
  { key: 'gain', title: 'Gain', subtitle: 'Add calories for growth and recovery.' },
];

const ACTIVITY_OPTIONS: Array<{
  key: ActivityLevel;
  title: string;
  subtitle: string;
}> = [
  { key: 'sedentary', title: 'Sedentary', subtitle: 'Desk work and minimal training.' },
  { key: 'light', title: 'Light', subtitle: 'Movement or training 1 to 3 days.' },
  { key: 'moderate', title: 'Moderate', subtitle: 'Consistent training 3 to 5 days.' },
  { key: 'active', title: 'Active', subtitle: 'Hard training most days.' },
  { key: 'very_active', title: 'Very Active', subtitle: 'Double sessions or physical labor.' },
];

const RATE_OPTIONS = [0.25, 0.5, 1, 1.5] as const;

const PRESETS: Array<{
  key: Exclude<MacroPresetKey, 'custom'>;
  label: string;
  description: string;
  split: MacroSplitPercents;
}> = [
  {
    key: 'balanced',
    label: 'Balanced',
    description: '30/40/30 default split for most nutrition tracking.',
    split: { protein: 30, carbs: 40, fat: 30 },
  },
  {
    key: 'high-protein',
    label: 'High Protein',
    description: '40/30/30 for muscle building and satiety.',
    split: { protein: 40, carbs: 30, fat: 30 },
  },
  {
    key: 'keto',
    label: 'Keto',
    description: '25/5/70 for low-carb phases.',
    split: { protein: 25, carbs: 5, fat: 70 },
  },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function numberFrom(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatNumber(value: number, digits = 0): string {
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value));
}

function deriveSplitFromGoal(goal: GoalEntry | null): MacroSplitPercents {
  if (!goal || goal.calories <= 0) {
    return PRESETS[0].split;
  }

  return normalizeMacroSplit({
    protein: (goal.proteinG * 4 * 100) / goal.calories,
    carbs: (goal.carbsG * 4 * 100) / goal.calories,
    fat: (goal.fatG * 9 * 100) / goal.calories,
  });
}

function buildInitialForm(
  settings: Record<string, string>,
  goal: GoalEntry | null,
): GoalFormState {
  const weightUnit: WeightUnit = settings.weight_unit === 'kg' ? 'kg' : 'lb';
  const heightMode: HeightMode = settings.height_unit === 'cm' ? 'cm' : 'ft_in';
  const weightKg = numberFrom(settings.userWeightKg, lbsToKg(180));
  const heightCm = numberFrom(settings.userHeightCm, 178);
  const currentWeight = weightUnit === 'kg' ? formatNumber(weightKg, 1) : formatNumber(kgToLbs(weightKg));
  const targetWeightLbs = numberFrom(settings.nutrition_target_weight_lbs, kgToLbs(weightKg));
  const targetWeight = weightUnit === 'kg'
    ? formatNumber(lbsToKg(targetWeightLbs), 1)
    : formatNumber(targetWeightLbs);
  const convertedHeight = cmToFtIn(heightCm);
  const savedPreset = (settings.nutrition_macro_preset as MacroPresetKey | undefined) ?? 'balanced';
  const baseSplit = savedPreset === 'custom'
    ? normalizeMacroSplit({
        protein: numberFrom(settings.nutrition_macro_split_protein, deriveSplitFromGoal(goal).protein),
        carbs: numberFrom(settings.nutrition_macro_split_carbs, deriveSplitFromGoal(goal).carbs),
        fat: numberFrom(settings.nutrition_macro_split_fat, deriveSplitFromGoal(goal).fat),
      })
    : PRESETS.find((preset) => preset.key === savedPreset)?.split ?? deriveSplitFromGoal(goal);
  const calorieTarget = String(goal?.calories ?? numberFrom(settings.calorieGoal, 2200));
  const derivedMacros = calculateMacroGrams(numberFrom(calorieTarget, 2200), baseSplit);

  return {
    goalType: (settings.profile_weight_goal as WeightGoalDirection | undefined) ?? 'maintain',
    goalRate: numberFrom(settings.profile_goal_rate, 0.5),
    weightUnit,
    heightMode,
    currentWeight,
    targetWeight,
    heightFeet: String(convertedHeight.feet),
    heightInches: String(convertedHeight.inches),
    heightCm: formatNumber(heightCm),
    age: numberFrom(settings.userAge, 30),
    sex: (settings.userSex as UserSex | undefined) ?? 'male',
    activityLevel: (settings.activityLevel as ActivityLevel | undefined) ?? 'moderate',
    calorieTarget,
    macroPreset: savedPreset,
    split: baseSplit,
    manualMacros: settings.nutrition_macro_override === '1',
    proteinOverride: String(goal?.proteinG ?? derivedMacros.protein),
    carbsOverride: String(goal?.carbsG ?? derivedMacros.carbs),
    fatOverride: String(goal?.fatG ?? derivedMacros.fat),
  };
}

function estimateGoalDate(
  goalType: WeightGoalDirection,
  currentWeightLb: number,
  targetWeightLb: number,
  rateLbsPerWeek: number,
): string {
  if (goalType === 'maintain') {
    return 'Maintain mode keeps calories at estimated expenditure.';
  }

  const delta = Math.abs(targetWeightLb - currentWeightLb);
  if (delta <= 0 || rateLbsPerWeek <= 0) {
    return 'Add a target weight to estimate a finish date.';
  }

  const weeks = Math.ceil(delta / rateLbsPerWeek);
  const projected = new Date();
  projected.setDate(projected.getDate() + weeks * 7);

  return `${weeks} week estimate. Target date ${projected.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}.`;
}

export default function NutritionGoalsPage() {
  const [goals, setGoals] = useState<GoalEntry[]>([]);
  const [activeGoal, setActiveGoal] = useState<GoalEntry | null>(null);
  const [form, setForm] = useState<GoalFormState>(() => buildInitialForm({}, null));
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const [settings, nextActiveGoal, goalHistory] = await Promise.all([
        fetchAllSettings(),
        fetchActiveGoals(todayIso()),
        fetchAllGoals(),
      ]);

      setGoals(goalHistory);
      setActiveGoal(nextActiveGoal as GoalEntry | null);
      setForm(buildInitialForm(settings as Record<string, string>, nextActiveGoal as GoalEntry | null));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load your goal setup.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentWeightKg = useMemo(() => {
    const numeric = Number.parseFloat(form.currentWeight);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return form.weightUnit === 'kg' ? numeric : lbsToKg(numeric);
  }, [form.currentWeight, form.weightUnit]);

  const currentWeightLb = useMemo(() => {
    if (currentWeightKg <= 0) return 0;
    return kgToLbs(currentWeightKg);
  }, [currentWeightKg]);

  const targetWeightLb = useMemo(() => {
    const numeric = Number.parseFloat(form.targetWeight);
    if (!Number.isFinite(numeric) || numeric <= 0) return 0;
    return form.weightUnit === 'kg' ? kgToLbs(numeric) : numeric;
  }, [form.targetWeight, form.weightUnit]);

  const heightCm = useMemo(() => {
    if (form.heightMode === 'cm') {
      const numeric = Number.parseFloat(form.heightCm);
      return Number.isFinite(numeric) ? numeric : 0;
    }

    return ftInToCm(
      Number.parseFloat(form.heightFeet) || 0,
      Number.parseFloat(form.heightInches) || 0,
    );
  }, [form.heightCm, form.heightFeet, form.heightInches, form.heightMode]);

  const calorieTarget = useMemo(
    () => numberFrom(form.calorieTarget, activeGoal?.calories ?? 2200),
    [activeGoal?.calories, form.calorieTarget],
  );

  const normalizedSplit = useMemo(
    () => normalizeMacroSplit(form.split),
    [form.split],
  );

  const derivedMacros = useMemo(
    () => calculateMacroGrams(calorieTarget, normalizedSplit),
    [calorieTarget, normalizedSplit],
  );

  const macroTargets = useMemo(
    () => ({
      protein: form.manualMacros ? numberFrom(form.proteinOverride, derivedMacros.protein) : derivedMacros.protein,
      carbs: form.manualMacros ? numberFrom(form.carbsOverride, derivedMacros.carbs) : derivedMacros.carbs,
      fat: form.manualMacros ? numberFrom(form.fatOverride, derivedMacros.fat) : derivedMacros.fat,
    }),
    [
      derivedMacros.carbs,
      derivedMacros.fat,
      derivedMacros.protein,
      form.carbsOverride,
      form.fatOverride,
      form.manualMacros,
      form.proteinOverride,
    ],
  );

  const bmr = useMemo(() => {
    if (currentWeightKg <= 0 || heightCm <= 0 || form.age <= 0) return null;
    return Math.round(calculateBMR(currentWeightKg, heightCm, form.age, form.sex));
  }, [currentWeightKg, form.age, form.sex, heightCm]);

  const tdee = useMemo(
    () => (bmr == null ? null : calculateTDEE(bmr, form.activityLevel)),
    [bmr, form.activityLevel],
  );

  const recommendedCalories = useMemo(
    () => (tdee == null ? null : calculateDailyCalories(tdee, form.goalType, form.goalRate)),
    [form.goalRate, form.goalType, tdee],
  );

  const calorieStatus = useMemo(() => {
    if (recommendedCalories == null || tdee == null) {
      return 'Add weight, height, age, and activity to estimate daily calories.';
    }

    if (form.goalType === 'maintain') {
      return `Estimated maintenance is ${recommendedCalories} kcal from a ${tdee} kcal TDEE.`;
    }

    const delta = Math.abs(recommendedCalories - tdee);
    const sign = form.goalType === 'lose' ? '-' : '+';
    return `Estimated ${sign}${delta} kcal adjustment from ${tdee} kcal TDEE.`;
  }, [form.goalType, recommendedCalories, tdee]);

  const goalDateCopy = useMemo(
    () => estimateGoalDate(form.goalType, currentWeightLb, targetWeightLb, form.goalRate),
    [currentWeightLb, form.goalRate, form.goalType, targetWeightLb],
  );

  const setField = useCallback(<K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  }, []);

  const switchWeightUnit = useCallback((nextUnit: WeightUnit) => {
    if (nextUnit === form.weightUnit) return;

    const currentNumeric = Number.parseFloat(form.currentWeight);
    const targetNumeric = Number.parseFloat(form.targetWeight);

    setForm((current) => ({
      ...current,
      weightUnit: nextUnit,
      currentWeight: Number.isFinite(currentNumeric)
        ? (nextUnit === 'kg'
            ? formatNumber(lbsToKg(current.weightUnit === 'kg' ? currentNumeric * 2.2046226218 : currentNumeric), 1)
            : formatNumber(kgToLbs(current.weightUnit === 'kg' ? currentNumeric : lbsToKg(currentNumeric))))
        : current.currentWeight,
      targetWeight: Number.isFinite(targetNumeric)
        ? (nextUnit === 'kg'
            ? formatNumber(lbsToKg(current.weightUnit === 'kg' ? targetNumeric * 2.2046226218 : targetNumeric), 1)
            : formatNumber(kgToLbs(current.weightUnit === 'kg' ? targetNumeric : lbsToKg(targetNumeric))))
        : current.targetWeight,
    }));
  }, [form.currentWeight, form.targetWeight, form.weightUnit]);

  const switchHeightMode = useCallback((nextMode: HeightMode) => {
    if (nextMode === form.heightMode) return;

    if (nextMode === 'cm') {
      const converted = ftInToCm(
        Number.parseFloat(form.heightFeet) || 0,
        Number.parseFloat(form.heightInches) || 0,
      );

      setForm((current) => ({
        ...current,
        heightMode: 'cm',
        heightCm: formatNumber(converted),
      }));
      return;
    }

    const converted = cmToFtIn(Number.parseFloat(form.heightCm) || 0);
    setForm((current) => ({
      ...current,
      heightMode: 'ft_in',
      heightFeet: String(converted.feet),
      heightInches: String(converted.inches),
    }));
  }, [form.heightCm, form.heightFeet, form.heightInches, form.heightMode]);

  const applyPreset = useCallback((presetKey: Exclude<MacroPresetKey, 'custom'>) => {
    const preset = PRESETS.find((entry) => entry.key === presetKey);
    if (!preset) return;

    const nextMacros = calculateMacroGrams(calorieTarget, preset.split);
    setForm((current) => ({
      ...current,
      macroPreset: preset.key,
      split: preset.split,
      proteinOverride: String(nextMacros.protein),
      carbsOverride: String(nextMacros.carbs),
      fatOverride: String(nextMacros.fat),
    }));
  }, [calorieTarget]);

  const updateSplit = useCallback((key: keyof MacroSplitPercents, value: number) => {
    setForm((current) => ({
      ...current,
      macroPreset: 'custom',
      split: normalizeMacroSplit({
        ...current.split,
        [key]: value,
      }),
    }));
  }, []);

  const saveGoals = useCallback(async (mode: 'replace' | 'new') => {
    setBusy(true);
    setError(null);
    setNotice(null);

    try {
      const nextGoalPayload = {
        calories: calorieTarget,
        proteinG: macroTargets.protein,
        carbsG: macroTargets.carbs,
        fatG: macroTargets.fat,
        effectiveDate: todayIso(),
      };

      await Promise.all([
        doSetSetting('weight_unit', form.weightUnit),
        doSetSetting('height_unit', form.heightMode === 'cm' ? 'cm' : 'in'),
        doSetSetting('userWeightKg', String(currentWeightKg || lbsToKg(180))),
        doSetSetting('userHeightCm', String(heightCm || 178)),
        doSetSetting('userAge', String(form.age)),
        doSetSetting('userSex', form.sex),
        doSetSetting('activityLevel', form.activityLevel),
        doSetSetting('profile_weight_goal', form.goalType),
        doSetSetting('profile_goal_rate', String(form.goalRate)),
        doSetSetting('nutrition_target_weight_lbs', String(targetWeightLb || currentWeightLb || 180)),
        doSetSetting('nutrition_macro_preset', form.macroPreset),
        doSetSetting('nutrition_macro_split_protein', String(normalizedSplit.protein)),
        doSetSetting('nutrition_macro_split_carbs', String(normalizedSplit.carbs)),
        doSetSetting('nutrition_macro_split_fat', String(normalizedSplit.fat)),
        doSetSetting('nutrition_macro_override', form.manualMacros ? '1' : '0'),
        doSetSetting('calorieGoal', String(calorieTarget)),
      ]);

      if (mode === 'replace' && activeGoal) {
        await doUpdateGoals(activeGoal.id, nextGoalPayload);
      } else {
        await doCreateGoals(crypto.randomUUID(), nextGoalPayload);
      }

      setNotice(mode === 'replace' ? 'Today’s goal updated.' : 'Saved as a new goal version.');
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to save goals.');
    } finally {
      setBusy(false);
    }
  }, [
    activeGoal,
    calorieTarget,
    currentWeightKg,
    currentWeightLb,
    form.activityLevel,
    form.age,
    form.goalRate,
    form.goalType,
    form.heightMode,
    form.macroPreset,
    form.manualMacros,
    form.sex,
    form.weightUnit,
    heightCm,
    load,
    macroTargets.carbs,
    macroTargets.fat,
    macroTargets.protein,
    normalizedSplit.carbs,
    normalizedSplit.fat,
    normalizedSplit.protein,
    targetWeightLb,
  ]);

  const deleteGoal = useCallback(async (id: string) => {
    if (!window.confirm('Delete this goal version?')) return;

    setBusy(true);
    setError(null);

    try {
      await doDeleteGoals(id);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete that goal version.');
    } finally {
      setBusy(false);
    }
  }, [load]);

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20 }}>
        <NutritionPageHeader
          kicker={<NutritionKicker color={NUTRITION_CHROME.accentLight}>Goals</NutritionKicker>}
          title="Your Goals"
          description="Loading your profile, calorie target, and macro split controls."
        />
        <NutritionPanel tone="focus" style={{ minHeight: 360, opacity: 0.4 }} />
      </div>
    );
  }

  if (error && goals.length === 0) {
    return (
      <NutritionEmptyState
        title="Goals unavailable"
        description={error}
        action={<NutritionButton onClick={() => void load()}>Retry</NutritionButton>}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: 1100 }}>
      <NutritionPageHeader
        kicker={<NutritionKicker color={NUTRITION_CHROME.accentLight}>Goals</NutritionKicker>}
        title="Your Goals"
        description="Use the shared TDEE engine to size daily calories, then tune your macro split with presets or manual overrides."
        action={
          <>
            <NutritionButton tone="ghost" onClick={() => void saveGoals('new')} disabled={busy}>
              Save New Version
            </NutritionButton>
            <NutritionButton onClick={() => void saveGoals('replace')} disabled={busy}>
              {busy ? 'Saving...' : 'Save Goals'}
            </NutritionButton>
          </>
        }
      />

      {notice ? (
        <div style={noticeStyle}>
          <MaterialSymbol name="check_circle" size={16} color={NUTRITION_CHROME.success} />
          {notice}
        </div>
      ) : null}

      {error ? (
        <div style={errorStyle}>
          <MaterialSymbol name="error" size={16} color={NUTRITION_CHROME.danger} />
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
        <NutritionMetricCard
          label="BMR"
          value={bmr == null ? '...' : `${bmr}`}
          detail="Mifflin-St Jeor estimate"
          accent={NUTRITION_CHROME.calorie}
        />
        <NutritionMetricCard
          label="TDEE"
          value={tdee == null ? '...' : `${tdee}`}
          detail="Activity-adjusted daily burn"
          accent={NUTRITION_CHROME.accentLight}
        />
        <NutritionMetricCard
          label="Recommended"
          value={recommendedCalories == null ? '...' : `${recommendedCalories}`}
          detail="Suggested calorie target"
          accent={NUTRITION_CHROME.protein}
        />
        <NutritionMetricCard
          label="Projection"
          value={form.goalType === 'maintain' ? 'Steady' : `${form.goalRate}lb/wk`}
          detail={goalDateCopy}
          accent={NUTRITION_CHROME.water}
        />
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'minmax(0, 1.08fr) minmax(320px, 0.92fr)' }}>
        <NutritionPanel tone="focus" style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 20 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <NutritionKicker color={NUTRITION_CHROME.accentLight}>Goal Type</NutritionKicker>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>Weight direction and rate</div>
            </div>

            <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
              {GOAL_OPTIONS.map((option) => {
                const active = form.goalType === option.key;
                return (
                  <button
                    key={option.key}
                    type="button"
                    onClick={() => setField('goalType', option.key)}
                    style={{
                      ...selectionTileStyle,
                      background: active ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.04),
                      boxShadow: active
                        ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.accentLight, 0.34)}`
                        : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.03)}`,
                    }}
                  >
                    <strong style={{ fontSize: 18 }}>{option.title}</strong>
                    <span style={subtleTextStyle}>{option.subtitle}</span>
                  </button>
                );
              })}
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <label style={fieldLabelStyle}>Weekly Pace</label>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {RATE_OPTIONS.map((value) => {
                  const active = form.goalRate === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setField('goalRate', value)}
                      style={{
                        ...pillStyle,
                        background: active ? alpha(NUTRITION_CHROME.calorie, 0.18) : alpha('#FFFFFF', 0.05),
                        color: active ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                        boxShadow: active
                          ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.calorie, 0.32)}`
                          : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.04)}`,
                      }}
                    >
                      {value} lb / wk
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gap: 14 }}>
              <label style={fieldLabelStyle}>Profile Inputs</label>
              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <FieldGroup label="Weight Unit">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['lb', 'kg'] as WeightUnit[]).map((unit) => (
                      <button
                        key={unit}
                        type="button"
                        onClick={() => switchWeightUnit(unit)}
                        style={{
                          ...pillStyle,
                          background: form.weightUnit === unit ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.05),
                          color: form.weightUnit === unit ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                        }}
                      >
                        {unit.toUpperCase()}
                      </button>
                    ))}
                  </div>
                </FieldGroup>

                <FieldGroup label={`Current Weight (${form.weightUnit})`}>
                  <input
                    value={form.currentWeight}
                    onChange={(event) => setField('currentWeight', event.target.value)}
                    type="number"
                    style={inputStyle}
                  />
                </FieldGroup>

                <FieldGroup label={`Target Weight (${form.weightUnit})`}>
                  <input
                    value={form.targetWeight}
                    onChange={(event) => setField('targetWeight', event.target.value)}
                    type="number"
                    style={inputStyle}
                  />
                </FieldGroup>

                <FieldGroup label="Age">
                  <input
                    value={form.age}
                    onChange={(event) => setField('age', Number(event.target.value) || 0)}
                    type="number"
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>

              <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                <FieldGroup label="Height Unit">
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {(['ft_in', 'cm'] as HeightMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        onClick={() => switchHeightMode(mode)}
                        style={{
                          ...pillStyle,
                          background: form.heightMode === mode ? alpha(NUTRITION_CHROME.accent, 0.16) : alpha('#FFFFFF', 0.05),
                          color: form.heightMode === mode ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                        }}
                      >
                        {mode === 'ft_in' ? 'FT + IN' : 'CM'}
                      </button>
                    ))}
                  </div>
                </FieldGroup>

                {form.heightMode === 'cm' ? (
                  <FieldGroup label="Height (cm)">
                    <input
                      value={form.heightCm}
                      onChange={(event) => setField('heightCm', event.target.value)}
                      type="number"
                      style={inputStyle}
                    />
                  </FieldGroup>
                ) : (
                  <>
                    <FieldGroup label="Height (ft)">
                      <input
                        value={form.heightFeet}
                        onChange={(event) => setField('heightFeet', event.target.value)}
                        type="number"
                        style={inputStyle}
                      />
                    </FieldGroup>
                    <FieldGroup label="Height (in)">
                      <input
                        value={form.heightInches}
                        onChange={(event) => setField('heightInches', event.target.value)}
                        type="number"
                        style={inputStyle}
                      />
                    </FieldGroup>
                  </>
                )}

                <FieldGroup label="Sex">
                  <select
                    value={form.sex}
                    onChange={(event) => setField('sex', event.target.value as UserSex)}
                    style={inputStyle}
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </FieldGroup>
              </div>

              <FieldGroup label="Activity Level">
                <div style={{ display: 'grid', gap: 10, gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))' }}>
                  {ACTIVITY_OPTIONS.map((option) => {
                    const active = form.activityLevel === option.key;
                    return (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setField('activityLevel', option.key)}
                        style={{
                          ...selectionTileStyle,
                          background: active ? alpha(NUTRITION_CHROME.water, 0.14) : alpha('#FFFFFF', 0.04),
                          boxShadow: active
                            ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.water, 0.24)}`
                            : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.03)}`,
                        }}
                      >
                        <strong>{option.title}</strong>
                        <span style={subtleTextStyle}>{option.subtitle}</span>
                      </button>
                    );
                  })}
                </div>
              </FieldGroup>
            </div>
          </div>
        </NutritionPanel>

        <NutritionPanel style={{ padding: 24 }}>
          <div style={{ display: 'grid', gap: 18 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <NutritionKicker color={NUTRITION_CHROME.calorie}>Calorie Strategy</NutritionKicker>
              <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>TDEE wizard</div>
              <div style={subtleTextStyle}>{calorieStatus}</div>
            </div>

            <div style={{ display: 'grid', gap: 10 }}>
              <label style={fieldLabelStyle}>Daily Calorie Target</label>
              <input
                value={form.calorieTarget}
                onChange={(event) => setField('calorieTarget', event.target.value)}
                type="number"
                style={{
                  ...inputStyle,
                  fontSize: 34,
                  fontWeight: 800,
                  color: NUTRITION_CHROME.calorie,
                  letterSpacing: -1,
                }}
              />
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <NutritionButton
                tone="calorie"
                onClick={() => {
                  if (recommendedCalories != null) {
                    setField('calorieTarget', String(recommendedCalories));
                  }
                }}
              >
                Apply Recommendation
              </NutritionButton>
              <NutritionButton tone="ghost" onClick={() => setField('calorieTarget', String(activeGoal?.calories ?? 2200))}>
                Restore Current Goal
              </NutritionButton>
            </div>

            <NutritionPanel tone="base" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={subtleTextStyle}>Current weight</span>
                  <strong>{form.currentWeight || '--'} {form.weightUnit}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={subtleTextStyle}>Target weight</span>
                  <strong>{form.targetWeight || '--'} {form.weightUnit}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={subtleTextStyle}>Goal date</span>
                  <strong style={{ textAlign: 'right' }}>{goalDateCopy}</strong>
                </div>
              </div>
            </NutritionPanel>
          </div>
        </NutritionPanel>
      </div>

      <NutritionPanel style={{ padding: 24 }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <NutritionKicker color={NUTRITION_CHROME.protein}>Macro Split</NutritionKicker>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>Preset profiles and custom targets</div>
          </div>

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
            {PRESETS.map((preset) => {
              const active = form.macroPreset === preset.key;
              return (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => applyPreset(preset.key)}
                  style={{
                    ...selectionTileStyle,
                    background: active ? alpha(NUTRITION_CHROME.protein, 0.16) : alpha('#FFFFFF', 0.04),
                    boxShadow: active
                      ? `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.protein, 0.22)}`
                      : `inset 0 0 0 1.5px ${alpha('#FFFFFF', 0.03)}`,
                  }}
                >
                  <strong>{preset.label}</strong>
                  <span style={subtleTextStyle}>{preset.description}</span>
                  <NutritionBadge color={NUTRITION_CHROME.protein}>
                    {preset.split.protein}/{preset.split.carbs}/{preset.split.fat}
                  </NutritionBadge>
                </button>
              );
            })}
          </div>

          <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'minmax(0, 1fr) minmax(300px, 0.95fr)' }}>
            <div style={{ display: 'grid', gap: 16 }}>
              <MacroSlider
                label="Protein"
                value={normalizedSplit.protein}
                color={NUTRITION_CHROME.protein}
                onChange={(value) => updateSplit('protein', value)}
              />
              <MacroSlider
                label="Carbs"
                value={normalizedSplit.carbs}
                color={NUTRITION_CHROME.carbs}
                onChange={(value) => updateSplit('carbs', value)}
              />
              <MacroSlider
                label="Fat"
                value={normalizedSplit.fat}
                color={NUTRITION_CHROME.fat}
                onChange={(value) => updateSplit('fat', value)}
              />
            </div>

            <NutritionPanel tone="base" style={{ padding: 18 }}>
              <div style={{ display: 'grid', gap: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong>Custom gram overrides</strong>
                    <span style={subtleTextStyle}>Switch between auto-calculated grams and manual targets.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setField('manualMacros', !form.manualMacros)}
                    style={{
                      ...pillStyle,
                      background: form.manualMacros ? alpha(NUTRITION_CHROME.calorie, 0.18) : alpha('#FFFFFF', 0.05),
                      color: form.manualMacros ? NUTRITION_CHROME.text : NUTRITION_CHROME.textMuted,
                    }}
                  >
                    {form.manualMacros ? 'Manual' : 'Auto'}
                  </button>
                </div>

                <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(3, minmax(0, 1fr))' }}>
                  <FieldGroup label="Protein (g)">
                    <input
                      value={form.proteinOverride}
                      onChange={(event) => setField('proteinOverride', event.target.value)}
                      type="number"
                      style={inputStyle}
                      disabled={!form.manualMacros}
                    />
                  </FieldGroup>
                  <FieldGroup label="Carbs (g)">
                    <input
                      value={form.carbsOverride}
                      onChange={(event) => setField('carbsOverride', event.target.value)}
                      type="number"
                      style={inputStyle}
                      disabled={!form.manualMacros}
                    />
                  </FieldGroup>
                  <FieldGroup label="Fat (g)">
                    <input
                      value={form.fatOverride}
                      onChange={(event) => setField('fatOverride', event.target.value)}
                      type="number"
                      style={inputStyle}
                      disabled={!form.manualMacros}
                    />
                  </FieldGroup>
                </div>

                <div style={{ display: 'grid', gap: 10 }}>
                  <SummaryRow label="Calories" value={`${calorieTarget} kcal`} />
                  <SummaryRow label="Protein" value={`${macroTargets.protein}g`} />
                  <SummaryRow label="Carbs" value={`${macroTargets.carbs}g`} />
                  <SummaryRow label="Fat" value={`${macroTargets.fat}g`} />
                </div>
              </div>
            </NutritionPanel>
          </div>
        </div>
      </NutritionPanel>

      <NutritionPanel style={{ padding: 24 }}>
        <div style={{ display: 'grid', gap: 16 }}>
          <div style={{ display: 'grid', gap: 8 }}>
            <NutritionKicker color={NUTRITION_CHROME.water}>Goal History</NutritionKicker>
            <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: -0.7 }}>Saved versions</div>
          </div>

          {goals.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {goals.map((goal) => (
                <div key={goal.id} style={historyCardStyle}>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 18 }}>{goal.calories} kcal</strong>
                    <span style={subtleTextStyle}>
                      Effective {formatNutritionDate(goal.effectiveDate)}. P {goal.proteinG}g / C {goal.carbsG}g / F {goal.fatG}g
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    {activeGoal?.id === goal.id ? (
                      <NutritionBadge color={NUTRITION_CHROME.success}>Active</NutritionBadge>
                    ) : null}
                    <NutritionButton tone="danger" onClick={() => void deleteGoal(goal.id)} disabled={busy}>
                      Delete
                    </NutritionButton>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div style={emptyBlockStyle}>
              <MaterialSymbol name="flag" size={28} color={NUTRITION_CHROME.textMuted} />
              <div style={{ fontWeight: 700 }}>No saved goals yet</div>
              <div style={subtleTextStyle}>Save your first calorie target to keep a history of macro strategy changes over time.</div>
            </div>
          )}
        </div>
      </NutritionPanel>
    </div>
  );
}

function FieldGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <label style={fieldLabelStyle}>{label}</label>
      {children}
    </div>
  );
}

function MacroSlider({
  label,
  value,
  color,
  onChange,
}: {
  label: string;
  value: number;
  color: string;
  onChange: (value: number) => void;
}) {
  return (
    <div style={{ display: 'grid', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
        <strong style={{ color }}>{label}</strong>
        <span style={subtleTextStyle}>{value}%</span>
      </div>
      <input
        type="range"
        min={5}
        max={80}
        step={1}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: '100%', accentColor: color }}
      />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
      <span style={subtleTextStyle}>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

const subtleTextStyle: CSSProperties = {
  color: NUTRITION_CHROME.textMuted,
  lineHeight: 1.7,
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

const selectionTileStyle: CSSProperties = {
  border: 'none',
  borderRadius: 24,
  padding: 18,
  cursor: 'pointer',
  textAlign: 'left',
  display: 'grid',
  gap: 8,
};

const pillStyle: CSSProperties = {
  minHeight: 38,
  padding: '0 14px',
  border: 'none',
  borderRadius: 999,
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontWeight: 700,
};

const noticeStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 52,
  padding: '0 16px',
  borderRadius: 18,
  background: alpha(NUTRITION_CHROME.success, 0.12),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.success, 0.18)}`,
};

const errorStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  minHeight: 52,
  padding: '0 16px',
  borderRadius: 18,
  background: alpha(NUTRITION_CHROME.danger, 0.12),
  color: NUTRITION_CHROME.text,
  boxShadow: `inset 0 0 0 1.5px ${alpha(NUTRITION_CHROME.danger, 0.2)}`,
};

const historyCardStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  gap: 14,
  alignItems: 'center',
  flexWrap: 'wrap',
  padding: 18,
  borderRadius: 22,
  background: alpha('#FFFFFF', 0.04),
};

const emptyBlockStyle: CSSProperties = {
  minHeight: 220,
  borderRadius: 24,
  display: 'grid',
  placeItems: 'center',
  gap: 10,
  textAlign: 'center',
  padding: 24,
  background: alpha('#FFFFFF', 0.03),
};
