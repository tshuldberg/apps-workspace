import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  GlassCard,
  MacroBar,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_CALORIE,
  NU_FONT_BOLD,
  NU_FONT_MEDIUM,
  NU_FONT_REGULAR,
  NU_FONT_SEMIBOLD,
  NU_GOAL_STATUS,
  NU_MACROS,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  NU_TYPOGRAPHY,
  SectionHeader,
  calculateBMR,
  calculateDailyCalories,
  calculateMacroGrams,
  calculateTDEE,
  cmToFtIn,
  createDailyGoals,
  ftInToCm,
  getActiveGoals,
  getDailyGoalProgress,
  getSetting,
  getWaterGoalMl,
  kgToLbs,
  lbsToKg,
  normalizeMacroSplit,
  setSetting,
  updateDailyGoals,
  type ActivityLevel,
  type DailyGoals,
  type GoalProgress,
  type MacroSplitPercents,
  type UserSex,
  type WeightGoalDirection,
} from '@mylife/nutrition';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

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
  fiberTarget: string;
  waterTargetMl: string;
}

interface GoalSnapshot {
  activeGoal: DailyGoals | null;
  progress: GoalProgress | null;
  form: GoalFormState;
}

const GOAL_OPTIONS: Array<{
  key: WeightGoalDirection;
  title: string;
  subtitle: string;
}> = [
  { key: 'lose', title: 'Lose', subtitle: 'Create a measured calorie deficit' },
  { key: 'maintain', title: 'Maintain', subtitle: 'Hold your current body weight steady' },
  { key: 'gain', title: 'Gain', subtitle: 'Add calories for growth and recovery' },
];

const ACTIVITY_OPTIONS: Array<{
  key: ActivityLevel;
  title: string;
  subtitle: string;
}> = [
  { key: 'sedentary', title: 'Sedentary', subtitle: 'Desk work and minimal training' },
  { key: 'light', title: 'Light', subtitle: 'Movement or training 1 to 3 days' },
  { key: 'moderate', title: 'Moderate', subtitle: 'Consistent training 3 to 5 days' },
  { key: 'active', title: 'Active', subtitle: 'Hard training most days' },
  { key: 'very_active', title: 'Very Active', subtitle: 'Double sessions or physical labor' },
];

const RATE_OPTIONS = [0.25, 0.5, 1, 1.5] as const;

const MACRO_PRESETS: Record<Exclude<MacroPresetKey, 'custom'>, MacroSplitPercents> = {
  balanced: { protein: 30, carbs: 40, fat: 30 },
  'high-protein': { protein: 40, carbs: 30, fat: 30 },
  keto: { protein: 25, carbs: 5, fat: 70 },
};

function today() {
  return new Date().toISOString().slice(0, 10);
}

function parseNumber(raw: string | undefined, fallback: number) {
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function formatNumber(value: number, digits = 0) {
  return digits > 0 ? value.toFixed(digits) : String(Math.round(value));
}

function formatDateLabel(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function deriveSplitFromGoal(goal: DailyGoals | null): MacroSplitPercents {
  if (!goal || goal.calories <= 0) {
    return MACRO_PRESETS.balanced;
  }

  return normalizeMacroSplit({
    protein: (goal.proteinG * 4 * 100) / goal.calories,
    carbs: (goal.carbsG * 4 * 100) / goal.calories,
    fat: (goal.fatG * 9 * 100) / goal.calories,
  });
}

function buildGoalSnapshot(db: ReturnType<typeof useDatabase>, date: string): GoalSnapshot {
  const activeGoal = getActiveGoals(db, date);
  const progress = getDailyGoalProgress(db, date);
  const weightUnit = getSetting(db, 'weight_unit') === 'kg' ? 'kg' : 'lb';
  const heightMode = getSetting(db, 'height_unit') === 'cm' ? 'cm' : 'ft_in';
  const goalType = (getSetting(db, 'profile_weight_goal') as WeightGoalDirection | undefined) ?? 'maintain';
  const goalRate = parseNumber(getSetting(db, 'profile_goal_rate'), 0.5);
  const userWeightKg = parseNumber(
    getSetting(db, 'userWeightKg'),
    lbsToKg(parseNumber(getSetting(db, 'profile_weight_lbs'), 180)),
  );
  const userHeightCm = parseNumber(
    getSetting(db, 'userHeightCm'),
    ftInToCm(
      parseNumber(getSetting(db, 'profile_height_feet'), 5),
      parseNumber(getSetting(db, 'profile_height_inches'), 10),
    ),
  );
  const currentWeight =
    weightUnit === 'kg' ? formatNumber(userWeightKg, 1) : formatNumber(kgToLbs(userWeightKg), 0);
  const targetWeightLbs = parseNumber(getSetting(db, 'nutrition_target_weight_lbs'), kgToLbs(userWeightKg));
  const targetWeight =
    weightUnit === 'kg'
      ? formatNumber(lbsToKg(targetWeightLbs), 1)
      : formatNumber(targetWeightLbs, 0);
  const { feet, inches } = cmToFtIn(userHeightCm);
  const savedPreset = (getSetting(db, 'nutrition_macro_preset') as MacroPresetKey | undefined) ?? 'balanced';
  const savedSplit: MacroSplitPercents = normalizeMacroSplit({
    protein: parseNumber(getSetting(db, 'nutrition_macro_split_protein'), deriveSplitFromGoal(activeGoal).protein),
    carbs: parseNumber(getSetting(db, 'nutrition_macro_split_carbs'), deriveSplitFromGoal(activeGoal).carbs),
    fat: parseNumber(getSetting(db, 'nutrition_macro_split_fat'), deriveSplitFromGoal(activeGoal).fat),
  });
  const baseSplit =
    savedPreset !== 'custom'
      ? MACRO_PRESETS[savedPreset as keyof typeof MACRO_PRESETS] ?? savedSplit
      : savedSplit;

  return {
    activeGoal,
    progress,
    form: {
      goalType,
      goalRate,
      weightUnit,
      heightMode,
      currentWeight,
      targetWeight,
      heightFeet: String(feet),
      heightInches: String(inches),
      heightCm: formatNumber(userHeightCm, 0),
      age: parseNumber(getSetting(db, 'userAge'), 30),
      sex: (getSetting(db, 'userSex') as UserSex | undefined) ?? 'male',
      activityLevel: (getSetting(db, 'activityLevel') as ActivityLevel | undefined) ?? 'moderate',
      calorieTarget: String(activeGoal?.calories ?? 2200),
      macroPreset: savedPreset,
      split: baseSplit,
      manualMacros: getSetting(db, 'nutrition_macro_override') === '1',
      proteinOverride: String(activeGoal?.proteinG ?? calculateMacroGrams(2200, baseSplit).protein),
      carbsOverride: String(activeGoal?.carbsG ?? calculateMacroGrams(2200, baseSplit).carbs),
      fatOverride: String(activeGoal?.fatG ?? calculateMacroGrams(2200, baseSplit).fat),
      fiberTarget: getSetting(db, 'fiberTargetG') ?? '30',
      waterTargetMl: String(getWaterGoalMl(db)),
    },
  };
}

function estimateGoalDate(
  goalType: WeightGoalDirection,
  currentWeightLb: number,
  targetWeightLb: number,
  rateLbsPerWeek: number,
) {
  if (goalType === 'maintain') {
    return 'Maintain mode keeps calories at estimated expenditure.';
  }

  const delta = Math.abs(targetWeightLb - currentWeightLb);
  if (delta <= 0 || rateLbsPerWeek <= 0) {
    return 'Add a target weight to estimate a finish date.';
  }

  const weeks = Math.ceil(delta / rateLbsPerWeek);
  const target = new Date();
  target.setDate(target.getDate() + weeks * 7);

  return `${weeks} week estimate. Target date ${target.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })}.`;
}

export default function GoalsScreen() {
  const db = useDatabase();
  const date = useMemo(() => today(), []);
  const [tick, setTick] = useState(0);
  const snapshot = useMemo(() => buildGoalSnapshot(db, date), [db, date, tick]);
  const [form, setForm] = useState<GoalFormState>(snapshot.form);

  useEffect(() => {
    setForm(snapshot.form);
  }, [snapshot.form]);

  const activeGoal = snapshot.activeGoal;
  const progress = snapshot.progress;

  const currentWeightKg = useMemo(() => {
    const numeric = parseFloat(form.currentWeight);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }

    return form.weightUnit === 'kg' ? numeric : lbsToKg(numeric);
  }, [form.currentWeight, form.weightUnit]);

  const targetWeightLb = useMemo(() => {
    const numeric = parseFloat(form.targetWeight);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return 0;
    }

    return form.weightUnit === 'kg' ? kgToLbs(numeric) : numeric;
  }, [form.targetWeight, form.weightUnit]);

  const currentWeightLb = useMemo(
    () => (currentWeightKg > 0 ? kgToLbs(currentWeightKg) : 0),
    [currentWeightKg],
  );

  const heightCm = useMemo(() => {
    if (form.heightMode === 'cm') {
      const numeric = parseFloat(form.heightCm);
      return Number.isFinite(numeric) ? numeric : 0;
    }

    return ftInToCm(parseFloat(form.heightFeet) || 0, parseFloat(form.heightInches) || 0);
  }, [form.heightCm, form.heightFeet, form.heightInches, form.heightMode]);

  const bmr = useMemo(() => {
    if (currentWeightKg <= 0 || heightCm <= 0 || form.age <= 0) {
      return null;
    }

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

  const calorieTarget = useMemo(() => parseNumber(form.calorieTarget, activeGoal?.calories ?? 2200), [activeGoal?.calories, form.calorieTarget]);
  const normalizedSplit = useMemo(() => normalizeMacroSplit(form.split), [form.split]);
  const derivedMacros = useMemo(() => calculateMacroGrams(calorieTarget, normalizedSplit), [calorieTarget, normalizedSplit]);
  const macroTargets = useMemo(
    () => ({
      protein: form.manualMacros ? parseNumber(form.proteinOverride, derivedMacros.protein) : derivedMacros.protein,
      carbs: form.manualMacros ? parseNumber(form.carbsOverride, derivedMacros.carbs) : derivedMacros.carbs,
      fat: form.manualMacros ? parseNumber(form.fatOverride, derivedMacros.fat) : derivedMacros.fat,
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

  const calorieStatus = useMemo(() => {
    if (recommendedCalories == null || tdee == null) {
      return 'Complete the profile fields to estimate daily calories.';
    }

    if (form.goalType === 'maintain') {
      return `Estimated maintenance is ${recommendedCalories} kcal from a ${tdee} kcal TDEE.`;
    }

    const sign = form.goalType === 'lose' ? '-' : '+';
    const delta = Math.abs(recommendedCalories - tdee);
    return `Estimated ${sign}${delta} kcal adjustment from ${tdee} kcal TDEE.`;
  }, [form.goalType, recommendedCalories, tdee]);

  const goalDateCopy = useMemo(
    () => estimateGoalDate(form.goalType, currentWeightLb, targetWeightLb, form.goalRate),
    [currentWeightLb, form.goalRate, form.goalType, targetWeightLb],
  );

  const updateForm = <K extends keyof GoalFormState>(key: K, value: GoalFormState[K]) => {
    setForm((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const applyWeightUnit = (nextUnit: WeightUnit) => {
    if (nextUnit === form.weightUnit) {
      return;
    }

    const currentWeightValue = parseFloat(form.currentWeight);
    const targetWeightValue = parseFloat(form.targetWeight);

    updateForm('weightUnit', nextUnit);
    if (Number.isFinite(currentWeightValue)) {
      updateForm(
        'currentWeight',
        nextUnit === 'kg'
          ? formatNumber(lbsToKg(currentWeightValue), 1)
          : formatNumber(kgToLbs(currentWeightValue), 0),
      );
    }
    if (Number.isFinite(targetWeightValue)) {
      updateForm(
        'targetWeight',
        nextUnit === 'kg'
          ? formatNumber(lbsToKg(targetWeightValue), 1)
          : formatNumber(kgToLbs(targetWeightValue), 0),
      );
    }
  };

  const applyHeightMode = (nextMode: HeightMode) => {
    if (nextMode === form.heightMode) {
      return;
    }

    if (nextMode === 'cm') {
      updateForm('heightCm', formatNumber(ftInToCm(parseFloat(form.heightFeet) || 0, parseFloat(form.heightInches) || 0), 0));
    } else {
      const converted = cmToFtIn(parseFloat(form.heightCm) || 0);
      updateForm('heightFeet', String(converted.feet));
      updateForm('heightInches', String(converted.inches));
    }

    updateForm('heightMode', nextMode);
  };

  const applyPreset = (preset: MacroPresetKey) => {
    if (preset === 'custom') {
      updateForm('macroPreset', 'custom');
      return;
    }

    updateForm('macroPreset', preset);
    updateForm('split', MACRO_PRESETS[preset]);
    updateForm('manualMacros', false);
  };

  const adjustMacroSplit = (target: keyof MacroSplitPercents, delta: number) => {
    setForm((current) => {
      const nextTargetValue = Math.max(0, current.split[target] + delta);
      const otherKeys = (['protein', 'carbs', 'fat'] as Array<keyof MacroSplitPercents>).filter(
        (key) => key !== target,
      );
      const currentOtherTotal = otherKeys.reduce((sum, key) => sum + current.split[key], 0);
      const remainder = Math.max(0, 100 - nextTargetValue);
      const nextSplit: MacroSplitPercents = {
        ...current.split,
        [target]: nextTargetValue,
      };

      if (currentOtherTotal <= 0) {
        const even = Math.floor(remainder / otherKeys.length);
        otherKeys.forEach((key) => {
          nextSplit[key] = even;
        });
      } else {
        otherKeys.forEach((key) => {
          nextSplit[key] = Math.round((current.split[key] / currentOtherTotal) * remainder);
        });
      }

      const diff = 100 - (nextSplit.protein + nextSplit.carbs + nextSplit.fat);
      nextSplit[otherKeys[0]] += diff;

      return {
        ...current,
        split: normalizeMacroSplit(nextSplit),
        macroPreset: 'custom',
      };
    });
  };

  const applyRecommendedCalories = () => {
    if (recommendedCalories == null) {
      Alert.alert('Missing profile', 'Complete weight, height, age, sex, and activity to calculate a target.');
      return;
    }

    updateForm('calorieTarget', String(recommendedCalories));
    if (!form.manualMacros) {
      const recalculated = calculateMacroGrams(recommendedCalories, normalizedSplit);
      updateForm('proteinOverride', String(recalculated.protein));
      updateForm('carbsOverride', String(recalculated.carbs));
      updateForm('fatOverride', String(recalculated.fat));
    }
  };

  const handleSave = () => {
    if (currentWeightKg <= 0 || heightCm <= 0 || form.age <= 0) {
      Alert.alert('Missing profile', 'Weight, height, and age are required before saving goals.');
      return;
    }

    if (calorieTarget < 1200 || calorieTarget > 6000) {
      Alert.alert('Invalid calories', 'Daily calories must be between 1200 and 6000.');
      return;
    }

    const fiberTarget = parseNumber(form.fiberTarget, 30);
    const waterTargetMl = parseNumber(form.waterTargetMl, 2500);
    if (fiberTarget < 0 || waterTargetMl < 250) {
      Alert.alert('Invalid targets', 'Fiber and water targets need realistic values before saving.');
      return;
    }

    try {
      db.transaction(() => {
        const targetLbs = targetWeightLb > 0 ? targetWeightLb : currentWeightLb;
        const heightFeetInches = cmToFtIn(heightCm);
        const birthYear = new Date().getFullYear() - form.age;

        setSetting(db, 'weight_unit', form.weightUnit);
        setSetting(db, 'height_unit', form.heightMode === 'cm' ? 'cm' : 'in');
        setSetting(db, 'userWeightKg', currentWeightKg.toFixed(2));
        setSetting(db, 'userHeightCm', heightCm.toFixed(1));
        setSetting(db, 'userAge', String(form.age));
        setSetting(db, 'userSex', form.sex);
        setSetting(db, 'activityLevel', form.activityLevel);
        setSetting(db, 'profile_weight_lbs', String(Math.round(currentWeightLb)));
        setSetting(db, 'profile_height_feet', String(heightFeetInches.feet));
        setSetting(db, 'profile_height_inches', String(heightFeetInches.inches));
        setSetting(db, 'profile_birth_year', String(birthYear));
        setSetting(db, 'profile_sex', form.sex);
        setSetting(db, 'profile_activity_level', form.activityLevel);
        setSetting(db, 'profile_weight_goal', form.goalType);
        setSetting(db, 'profile_goal_rate', String(form.goalRate));
        setSetting(db, 'nutrition_target_weight_lbs', String(targetLbs));
        setSetting(db, 'nutrition_macro_preset', form.macroPreset);
        setSetting(db, 'nutrition_macro_override', form.manualMacros ? '1' : '0');
        setSetting(db, 'nutrition_macro_split_protein', String(normalizedSplit.protein));
        setSetting(db, 'nutrition_macro_split_carbs', String(normalizedSplit.carbs));
        setSetting(db, 'nutrition_macro_split_fat', String(normalizedSplit.fat));
        setSetting(db, 'fiberTargetG', String(fiberTarget));
        setSetting(db, 'waterGoalMl', String(waterTargetMl));
        if (bmr != null) {
          setSetting(db, 'nutrition_bmr', String(bmr));
        }
        if (tdee != null) {
          setSetting(db, 'nutrition_tdee', String(tdee));
        }

        const goalPayload = {
          calories: calorieTarget,
          proteinG: macroTargets.protein,
          carbsG: macroTargets.carbs,
          fatG: macroTargets.fat,
          effectiveDate: date,
        };

        if (activeGoal && activeGoal.effectiveDate === date) {
          updateDailyGoals(db, activeGoal.id, goalPayload);
        } else {
          createDailyGoals(db, uuid(), goalPayload);
        }
      });

      setTick((value) => value + 1);
      Alert.alert('Goals saved', 'Your calorie, macro, and hydration targets were updated.');
    } catch (error) {
      Alert.alert(
        'Save failed',
        error instanceof Error ? error.message : 'The goal settings could not be saved.',
      );
    }
  };

  const progressRows = progress == null
    ? []
    : [
        { label: 'Calories', consumed: progress.calories.consumed, goal: progress.calories.goal, color: NU_CALORIE },
        { label: 'Protein', consumed: progress.proteinG.consumed, goal: progress.proteinG.goal, color: NU_MACROS.protein },
        { label: 'Carbs', consumed: progress.carbsG.consumed, goal: progress.carbsG.goal, color: NU_MACROS.carbs },
        { label: 'Fat', consumed: progress.fatG.consumed, goal: progress.fatG.goal, color: NU_MACROS.fat },
      ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>TARGETS</Text>
        <Text style={styles.title}>Your Goals</Text>
        <Text style={styles.subtitle}>Personalized to your body, training load, and nutrition style.</Text>
      </View>

      <GlassCard elevated style={styles.card}>
        <SectionHeader
          title="Goal Direction"
          action={<MetricPill label="Active plan" value={activeGoal ? formatDateLabel(activeGoal.effectiveDate) : 'New'} />}
          accent={NU_TEXT}
        />
        <View style={styles.goalGrid}>
          {GOAL_OPTIONS.map((option) => {
            const active = form.goalType === option.key;
            return (
              <Pressable
                key={option.key}
                onPress={() => updateForm('goalType', option.key)}
                style={[styles.goalTile, active ? styles.goalTileActive : null]}
              >
                <Text style={[styles.goalTitle, active ? styles.goalTitleActive : null]}>{option.title}</Text>
                <Text style={styles.goalSubtitle}>{option.subtitle}</Text>
              </Pressable>
            );
          })}
        </View>

        {form.goalType !== 'maintain' ? (
          <View style={styles.rateSection}>
            <SectionHeader title="Weekly Rate" accent={NU_TEXT} />
            <View style={styles.inlineOptions}>
              {RATE_OPTIONS.map((value) => {
                const active = form.goalRate === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => updateForm('goalRate', value)}
                    style={[styles.optionChip, active ? styles.optionChipActive : null]}
                  >
                    <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                      {value} lb / week
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader
          title="Calculate Calorie Needs"
          action={<MetricPill label="Activity" value={form.activityLevel.replace('_', ' ')} />}
          accent={NU_TEXT}
        />

        <View style={styles.inputSection}>
          <View style={styles.rowBetween}>
            <Text style={styles.label}>Weight unit</Text>
            <View style={styles.compactToggle}>
              <CompactToggle label="LB" active={form.weightUnit === 'lb'} onPress={() => applyWeightUnit('lb')} />
              <CompactToggle label="KG" active={form.weightUnit === 'kg'} onPress={() => applyWeightUnit('kg')} />
            </View>
          </View>

          <InputRow
            label="Current weight"
            value={form.currentWeight}
            suffix={form.weightUnit}
            onChangeText={(value) => updateForm('currentWeight', value)}
          />
          <InputRow
            label="Target weight"
            value={form.targetWeight}
            suffix={form.weightUnit}
            onChangeText={(value) => updateForm('targetWeight', value)}
          />

          <View style={styles.rowBetween}>
            <Text style={styles.label}>Height format</Text>
            <View style={styles.compactToggle}>
              <CompactToggle label="FT + IN" active={form.heightMode === 'ft_in'} onPress={() => applyHeightMode('ft_in')} />
              <CompactToggle label="CM" active={form.heightMode === 'cm'} onPress={() => applyHeightMode('cm')} />
            </View>
          </View>

          {form.heightMode === 'cm' ? (
            <InputRow
              label="Height"
              value={form.heightCm}
              suffix="cm"
              onChangeText={(value) => updateForm('heightCm', value)}
            />
          ) : (
            <View style={styles.dualInputRow}>
              <InputRow
                label="Height"
                value={form.heightFeet}
                suffix="ft"
                onChangeText={(value) => updateForm('heightFeet', value)}
                containerStyle={styles.dualInputCell}
              />
              <InputRow
                label=" "
                value={form.heightInches}
                suffix="in"
                onChangeText={(value) => updateForm('heightInches', value)}
                containerStyle={styles.dualInputCell}
              />
            </View>
          )}

          <StepperRow
            label="Age"
            value={form.age}
            minimum={13}
            maximum={90}
            suffix="years"
            onChange={(value) => updateForm('age', value)}
          />

          <View style={styles.dualChoiceRow}>
            {(['male', 'female'] as const).map((sexOption) => {
              const active = form.sex === sexOption;
              return (
                <Pressable
                  key={sexOption}
                  onPress={() => updateForm('sex', sexOption)}
                  style={[styles.dualChoice, active ? styles.dualChoiceActive : null]}
                >
                  <Text style={[styles.dualChoiceLabel, active ? styles.dualChoiceLabelActive : null]}>
                    {sexOption === 'male' ? 'Male' : 'Female'}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.activityGrid}>
            {ACTIVITY_OPTIONS.map((option) => {
              const active = form.activityLevel === option.key;
              return (
                <Pressable
                  key={option.key}
                  onPress={() => updateForm('activityLevel', option.key)}
                  style={[styles.activityTile, active ? styles.activityTileActive : null]}
                >
                  <Text style={[styles.activityTitle, active ? styles.activityTitleActive : null]}>{option.title}</Text>
                  <Text style={styles.activitySubtitle}>{option.subtitle}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.metricsRow}>
          <MetricCard label="BMR" value={bmr != null ? `${bmr}` : '--'} suffix="kcal" />
          <MetricCard label="TDEE" value={tdee != null ? `${tdee}` : '--'} suffix="kcal" highlight />
        </View>

        <PrimaryButton
          label="Apply To Goal"
          icon="monitor_weight"
          onPress={applyRecommendedCalories}
          disabled={recommendedCalories == null}
        />
      </GlassCard>

      <GlassCard elevated style={styles.card}>
        <SectionHeader title="Calorie Target" accent={NU_TEXT} />
        <View style={styles.calorieHero}>
          <View>
            <Text style={styles.label}>Daily calories</Text>
            <TextInput
              keyboardType="number-pad"
              value={form.calorieTarget}
              onChangeText={(value) => updateForm('calorieTarget', value)}
              style={styles.calorieInput}
            />
          </View>
          <View style={styles.calorieBadge}>
            <MaterialSymbol name="local_dining" size={22} color={NU_ACCENT_DARK} />
            <Text style={styles.calorieBadgeText}>kcal / day</Text>
          </View>
        </View>
        <Text style={styles.statusText}>{calorieStatus}</Text>
        <Text style={[styles.statusText, { color: NU_TEXT_TERTIARY }]}>{goalDateCopy}</Text>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader
          title="Macro Split"
          action={<MetricPill label="Current" value={`${normalizedSplit.protein}/${normalizedSplit.carbs}/${normalizedSplit.fat}`} />}
          accent={NU_TEXT}
        />
        <View style={styles.inlineOptions}>
          {(['balanced', 'high-protein', 'keto', 'custom'] as MacroPresetKey[]).map((preset) => {
            const active = form.macroPreset === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => applyPreset(preset)}
                style={[styles.optionChip, active ? styles.optionChipActive : null]}
              >
                <Text style={[styles.optionLabel, active ? styles.optionLabelActive : null]}>
                  {preset === 'high-protein' ? 'High Protein' : preset.charAt(0).toUpperCase() + preset.slice(1)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.macroRows}>
          <MacroAdjuster
            label="Protein"
            color={NU_MACROS.protein}
            value={normalizedSplit.protein}
            onDecrease={() => adjustMacroSplit('protein', -5)}
            onIncrease={() => adjustMacroSplit('protein', 5)}
          />
          <MacroAdjuster
            label="Carbs"
            color={NU_MACROS.carbs}
            value={normalizedSplit.carbs}
            onDecrease={() => adjustMacroSplit('carbs', -5)}
            onIncrease={() => adjustMacroSplit('carbs', 5)}
          />
          <MacroAdjuster
            label="Fat"
            color={NU_MACROS.fat}
            value={normalizedSplit.fat}
            onDecrease={() => adjustMacroSplit('fat', -5)}
            onIncrease={() => adjustMacroSplit('fat', 5)}
          />
        </View>

        <View style={styles.barGrid}>
          <MacroBar label="protein" grams={macroTargets.protein} goalGrams={macroTargets.protein} color={NU_MACROS.protein} />
          <MacroBar label="carbs" grams={macroTargets.carbs} goalGrams={macroTargets.carbs} color={NU_MACROS.carbs} />
          <MacroBar label="fat" grams={macroTargets.fat} goalGrams={macroTargets.fat} color={NU_MACROS.fat} />
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <SectionHeader
          title="Custom Overrides"
          action={<MetricPill label="Mode" value={form.manualMacros ? 'Manual' : 'Derived'} />}
          accent={NU_TEXT}
        />
        <ToggleRow
          label="Use custom macro grams"
          value={form.manualMacros}
          onToggle={() => updateForm('manualMacros', !form.manualMacros)}
          description="Switch on when you want direct protein, carbs, and fat targets instead of percentage-based macros."
        />

        {form.manualMacros ? (
          <View style={styles.overrideGrid}>
            <InputRow
              label="Protein"
              value={form.proteinOverride}
              suffix="g"
              onChangeText={(value) => updateForm('proteinOverride', value)}
              containerStyle={styles.overrideCell}
            />
            <InputRow
              label="Carbs"
              value={form.carbsOverride}
              suffix="g"
              onChangeText={(value) => updateForm('carbsOverride', value)}
              containerStyle={styles.overrideCell}
            />
            <InputRow
              label="Fat"
              value={form.fatOverride}
              suffix="g"
              onChangeText={(value) => updateForm('fatOverride', value)}
              containerStyle={styles.overrideCell}
            />
          </View>
        ) : (
          <Text style={styles.supportCopy}>
            Protein, carbs, and fat are derived automatically from your calorie target and macro split.
          </Text>
        )}

        <View style={styles.overrideGrid}>
          <InputRow
            label="Fiber target"
            value={form.fiberTarget}
            suffix="g"
            onChangeText={(value) => updateForm('fiberTarget', value)}
            containerStyle={styles.overrideCell}
          />
          <InputRow
            label="Water target"
            value={form.waterTargetMl}
            suffix="ml"
            onChangeText={(value) => updateForm('waterTargetMl', value)}
            containerStyle={styles.overrideCell}
          />
        </View>
      </GlassCard>

      {progressRows.length > 0 ? (
        <GlassCard style={styles.card}>
          <SectionHeader title="Today vs Goal" accent={NU_TEXT} />
          <View style={styles.progressList}>
            {progressRows.map((row) => (
              <ProgressRow
                key={row.label}
                label={row.label}
                consumed={row.consumed}
                goal={row.goal}
                color={row.color}
              />
            ))}
          </View>
        </GlassCard>
      ) : null}

      <PrimaryButton label="Save Goals" icon="add" onPress={handleSave} />
    </ScrollView>
  );
}

function PrimaryButton({
  label,
  icon,
  onPress,
  disabled = false,
}: {
  label: string;
  icon: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [disabled ? styles.buttonDisabled : null, pressed ? styles.buttonPressed : null]}>
      <LinearGradient colors={[NU_ACCENT_LIGHT, NU_ACCENT]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.primaryButton}>
        <MaterialSymbol name={icon} size={18} color={NU_ACCENT_DARK} />
        <Text style={styles.primaryButtonLabel}>{label}</Text>
      </LinearGradient>
    </Pressable>
  );
}

function MetricPill({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricPill}>
      <Text style={styles.metricPillLabel}>{label}</Text>
      <Text style={styles.metricPillValue}>{value}</Text>
    </View>
  );
}

function MetricCard({
  label,
  value,
  suffix,
  highlight = false,
}: {
  label: string;
  value: string;
  suffix: string;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.metricCard, highlight ? styles.metricCardHighlight : null]}>
      <Text style={styles.metricCardLabel}>{label}</Text>
      <Text style={[styles.metricCardValue, highlight ? { color: NU_ACCENT_LIGHT } : null]}>{value}</Text>
      <Text style={styles.metricCardSuffix}>{suffix}</Text>
    </View>
  );
}

function CompactToggle({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.compactToggleButton, active ? styles.compactToggleButtonActive : null]}>
      <Text style={[styles.compactToggleLabel, active ? styles.compactToggleLabelActive : null]}>{label}</Text>
    </Pressable>
  );
}

function InputRow({
  label,
  value,
  suffix,
  onChangeText,
  containerStyle,
}: {
  label: string;
  value: string;
  suffix: string;
  onChangeText: (value: string) => void;
  containerStyle?: object;
}) {
  return (
    <View style={containerStyle}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputShell}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          keyboardType="decimal-pad"
          style={styles.input}
          placeholderTextColor={NU_TEXT_TERTIARY}
        />
        <Text style={styles.inputSuffix}>{suffix}</Text>
      </View>
    </View>
  );
}

function StepperRow({
  label,
  value,
  minimum,
  maximum,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  minimum: number;
  maximum: number;
  suffix: string;
  onChange: (next: number) => void;
}) {
  const clamp = (next: number) => Math.max(minimum, Math.min(maximum, next));

  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.stepperRow}>
        <Pressable onPress={() => onChange(clamp(value - 1))} style={styles.stepperButton}>
          <Text style={styles.stepperButtonLabel}>-</Text>
        </Pressable>
        <View style={styles.stepperValue}>
          <Text style={styles.stepperValueNumber}>{value}</Text>
          <Text style={styles.stepperValueSuffix}>{suffix}</Text>
        </View>
        <Pressable onPress={() => onChange(clamp(value + 1))} style={styles.stepperButton}>
          <Text style={styles.stepperButtonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MacroAdjuster({
  label,
  color,
  value,
  onDecrease,
  onIncrease,
}: {
  label: string;
  color: string;
  value: number;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <View style={styles.adjusterRow}>
      <View style={styles.adjusterLabelWrap}>
        <View style={[styles.adjusterDot, { backgroundColor: color }]} />
        <Text style={styles.adjusterLabel}>{label}</Text>
      </View>
      <View style={styles.adjusterControls}>
        <Pressable onPress={onDecrease} style={styles.adjusterButton}>
          <Text style={styles.adjusterButtonLabel}>-</Text>
        </Pressable>
        <Text style={[styles.adjusterValue, { color }]}>{value}%</Text>
        <Pressable onPress={onIncrease} style={styles.adjusterButton}>
          <Text style={styles.adjusterButtonLabel}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onToggle,
}: {
  label: string;
  description: string;
  value: boolean;
  onToggle: () => void;
}) {
  return (
    <Pressable onPress={onToggle} style={styles.toggleRow}>
      <View style={styles.toggleCopy}>
        <Text style={styles.toggleTitle}>{label}</Text>
        <Text style={styles.toggleDescription}>{description}</Text>
      </View>
      <View style={[styles.toggleTrack, value ? styles.toggleTrackActive : null]}>
        <View style={[styles.toggleThumb, value ? styles.toggleThumbActive : null]} />
      </View>
    </Pressable>
  );
}

function ProgressRow({
  label,
  consumed,
  goal,
  color,
}: {
  label: string;
  consumed: number;
  goal: number;
  color: string;
}) {
  const percent = goal > 0 ? Math.min(100, Math.round((consumed / goal) * 100)) : 0;
  const statusColor =
    consumed > goal ? NU_GOAL_STATUS.over : percent >= 95 ? NU_GOAL_STATUS.met : color;

  return (
    <View style={styles.progressRow}>
      <View style={styles.rowBetween}>
        <Text style={styles.progressLabel}>{label}</Text>
        <Text style={styles.progressValue}>
          {Math.round(consumed)} / {Math.round(goal)}
        </Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: statusColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: NU_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
    gap: 18,
  },
  hero: {
    gap: 6,
    paddingTop: 8,
  },
  eyebrow: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_ACCENT_LIGHT,
  },
  title: {
    ...NU_TYPOGRAPHY.displayLg,
    fontSize: 42,
    lineHeight: 46,
    color: NU_TEXT,
  },
  subtitle: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  card: {
    gap: 16,
  },
  goalGrid: {
    gap: 12,
  },
  goalTile: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: NU_SURFACES.low,
    gap: 6,
  },
  goalTileActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.22)',
  },
  goalTitle: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 18,
    color: NU_TEXT,
  },
  goalTitleActive: {
    color: NU_ACCENT_LIGHT,
  },
  goalSubtitle: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 13,
    lineHeight: 20,
    color: NU_TEXT_SECONDARY,
  },
  rateSection: {
    gap: 10,
  },
  inlineOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  optionChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
  },
  optionChipActive: {
    backgroundColor: 'rgba(255, 184, 119, 0.18)',
  },
  optionLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_SECONDARY,
  },
  optionLabelActive: {
    color: NU_ACCENT_LIGHT,
  },
  inputSection: {
    gap: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  compactToggle: {
    flexDirection: 'row',
    gap: 8,
  },
  compactToggleButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
  },
  compactToggleButtonActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.22)',
  },
  compactToggleLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  compactToggleLabelActive: {
    color: NU_ACCENT_LIGHT,
  },
  label: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
    marginBottom: 8,
  },
  inputShell: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: NU_SURFACES.high,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  input: {
    flex: 1,
    color: NU_TEXT,
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 17,
    paddingVertical: 14,
  },
  inputSuffix: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_TERTIARY,
    textTransform: 'uppercase',
  },
  dualInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  dualInputCell: {
    flex: 1,
  },
  stepperRow: {
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: NU_SURFACES.high,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stepperButton: {
    width: 38,
    height: 38,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.highest,
  },
  stepperButtonLabel: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 18,
    color: NU_ACCENT_LIGHT,
  },
  stepperValue: {
    alignItems: 'center',
    gap: 2,
  },
  stepperValueNumber: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 20,
    color: NU_TEXT,
  },
  stepperValueSuffix: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  dualChoiceRow: {
    flexDirection: 'row',
    gap: 10,
  },
  dualChoice: {
    flex: 1,
    minHeight: 54,
    borderRadius: 16,
    backgroundColor: NU_SURFACES.high,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dualChoiceActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.22)',
  },
  dualChoiceLabel: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT_SECONDARY,
  },
  dualChoiceLabelActive: {
    color: NU_ACCENT_LIGHT,
  },
  activityGrid: {
    gap: 10,
  },
  activityTile: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: NU_SURFACES.low,
    gap: 4,
  },
  activityTileActive: {
    backgroundColor: 'rgba(255, 184, 119, 0.18)',
  },
  activityTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  activityTitleActive: {
    color: NU_ACCENT_LIGHT,
  },
  activitySubtitle: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 12,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  metricsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  metricCard: {
    flex: 1,
    borderRadius: 16,
    backgroundColor: NU_SURFACES.low,
    padding: 16,
    gap: 6,
  },
  metricCardHighlight: {
    backgroundColor: 'rgba(249, 115, 22, 0.12)',
  },
  metricCardLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  metricCardValue: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 26,
    color: NU_TEXT,
  },
  metricCardSuffix: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_SECONDARY,
  },
  calorieHero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 16,
  },
  calorieInput: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 44,
    lineHeight: 48,
    color: NU_CALORIE,
    minWidth: 160,
  },
  calorieBadge: {
    borderRadius: 999,
    backgroundColor: 'rgba(255, 184, 119, 0.22)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  calorieBadgeText: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_ACCENT_DARK,
  },
  statusText: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  macroRows: {
    gap: 10,
  },
  adjusterRow: {
    borderRadius: 16,
    backgroundColor: NU_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  adjusterLabelWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adjusterDot: {
    width: 10,
    height: 10,
    borderRadius: 999,
  },
  adjusterLabel: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  adjusterControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  adjusterButton: {
    width: 32,
    height: 32,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.highest,
  },
  adjusterButtonLabel: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 16,
    color: NU_TEXT,
  },
  adjusterValue: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 18,
    minWidth: 52,
    textAlign: 'center',
  },
  barGrid: {
    gap: 12,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 4,
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  toggleDescription: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 12,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  toggleTrack: {
    width: 54,
    height: 30,
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
    padding: 3,
    justifyContent: 'center',
  },
  toggleTrackActive: {
    backgroundColor: 'rgba(201, 137, 77, 0.4)',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 999,
    backgroundColor: NU_TEXT_SECONDARY,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
    backgroundColor: NU_ACCENT_LIGHT,
  },
  overrideGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  overrideCell: {
    flexBasis: '48%',
    flexGrow: 1,
  },
  supportCopy: {
    ...NU_TYPOGRAPHY.bodyMd,
    color: NU_TEXT_SECONDARY,
  },
  progressList: {
    gap: 12,
  },
  progressRow: {
    gap: 8,
  },
  progressLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 13,
    color: NU_TEXT_SECONDARY,
  },
  progressValue: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 13,
    color: NU_TEXT,
  },
  progressTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: NU_SURFACES.high,
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  primaryButton: {
    minHeight: 56,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  primaryButtonLabel: {
    fontFamily: NU_FONT_BOLD,
    fontSize: 14,
    color: NU_ACCENT_DARK,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  buttonDisabled: {
    opacity: 0.45,
  },
  buttonPressed: {
    opacity: 0.82,
  },
  metricPill: {
    borderRadius: 999,
    backgroundColor: NU_SURFACES.high,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 2,
  },
  metricPillLabel: {
    ...NU_TYPOGRAPHY.labelUpper,
    color: NU_TEXT_TERTIARY,
  },
  metricPillValue: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 12,
    color: NU_TEXT,
  },
});
