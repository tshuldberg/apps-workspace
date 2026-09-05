import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  setSetting,
  calculateBMR,
  applyActivityMultiplier,
  createDailyGoals,
  type UserProfile,
  type ActivityLevel,
  type UserSex,
} from '@mylife/nutrition';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.nutrition;
const TOTAL_STEPS = 5;

type WeightGoal = 'lose' | 'gain' | 'maintain';

const ACTIVITY_OPTIONS: { key: ActivityLevel; label: string; icon: string; description: string }[] = [
  { key: 'sedentary', label: 'Sedentary', icon: '\ud83d\udcbb', description: 'Little or no exercise, desk job' },
  { key: 'light', label: 'Lightly Active', icon: '\ud83d\udeb6', description: 'Light exercise 1-3 days/week' },
  { key: 'moderate', label: 'Moderately Active', icon: '\ud83c\udfc3', description: 'Moderate exercise 3-5 days/week' },
  { key: 'active', label: 'Very Active', icon: '\ud83c\udfcb\ufe0f', description: 'Hard exercise 6-7 days/week' },
  { key: 'very_active', label: 'Extra Active', icon: '\u26a1', description: 'Very hard exercise, physical job' },
];

const GOAL_OPTIONS: { key: WeightGoal; label: string; icon: string; description: string }[] = [
  { key: 'lose', label: 'Lose Weight', icon: '\ud83d\udcc9', description: 'Calorie deficit for fat loss' },
  { key: 'maintain', label: 'Maintain Weight', icon: '\u2696\ufe0f', description: 'Keep your current weight' },
  { key: 'gain', label: 'Gain Weight', icon: '\ud83d\udcc8', description: 'Calorie surplus for muscle gain' },
];

const RATE_OPTIONS = [
  { value: 0.25, label: '0.25 lb/week', description: 'Slow and steady' },
  { value: 0.5, label: '0.5 lb/week', description: 'Recommended' },
  { value: 1.0, label: '1 lb/week', description: 'Moderate' },
  { value: 1.5, label: '1.5 lb/week', description: 'Aggressive' },
];

function lbsToKg(lbs: number): number {
  return lbs * 0.453592;
}

function feetInchesToCm(feet: number, inches: number): number {
  return (feet * 12 + inches) * 2.54;
}

function ageFromBirthYear(year: number): number {
  return new Date().getFullYear() - year;
}

export default function OnboardingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [step, setStep] = useState(1);

  // Step 1: Profile
  const [sex, setSex] = useState<UserSex>('male');
  const [birthYear, setBirthYear] = useState('1994');
  const [heightFeet, setHeightFeet] = useState('5');
  const [heightInches, setHeightInches] = useState('10');
  const [weightLbs, setWeightLbs] = useState('180');

  // Step 2: Activity
  const [activityLevel, setActivityLevel] = useState<ActivityLevel>('moderate');

  // Step 3: Goal
  const [weightGoal, setWeightGoal] = useState<WeightGoal>('maintain');

  // Step 4: Rate (only for lose/gain)
  const [goalRate, setGoalRate] = useState(0.5);

  const next = () => {
    if (step === 3 && weightGoal === 'maintain') {
      setStep(5); // Skip rate step for maintenance
    } else {
      setStep((s) => Math.min(s + 1, TOTAL_STEPS));
    }
  };
  const back = () => {
    if (step === 5 && weightGoal === 'maintain') {
      setStep(3); // Skip back over rate step
    } else {
      setStep((s) => Math.max(s - 1, 1));
    }
  };

  const computeGoals = useCallback(() => {
    const profile: UserProfile = {
      weightKg: lbsToKg(parseFloat(weightLbs) || 180),
      heightCm: feetInchesToCm(parseInt(heightFeet) || 5, parseInt(heightInches) || 10),
      age: ageFromBirthYear(parseInt(birthYear) || 1994),
      sex,
      activityLevel,
    };

    const bmr = calculateBMR(profile);
    const tdee = applyActivityMultiplier(bmr, activityLevel);

    let calorieTarget = Math.round(tdee);
    if (weightGoal === 'lose') {
      // 1 lb fat ~= 3500 cal, so daily deficit = (rate * 3500) / 7
      calorieTarget = Math.round(tdee - (goalRate * 3500) / 7);
    } else if (weightGoal === 'gain') {
      calorieTarget = Math.round(tdee + (goalRate * 3500) / 7);
    }

    // Standard macro split: 30% protein, 40% carbs, 30% fat
    const proteinCal = calorieTarget * 0.3;
    const carbsCal = calorieTarget * 0.4;
    const fatCal = calorieTarget * 0.3;

    return {
      profile,
      tdee: Math.round(tdee),
      calories: Math.max(calorieTarget, 1200), // Safety floor
      proteinG: Math.round(proteinCal / 4),
      carbsG: Math.round(carbsCal / 4),
      fatG: Math.round(fatCal / 9),
    };
  }, [sex, birthYear, heightFeet, heightInches, weightLbs, activityLevel, weightGoal, goalRate]);

  const handleFinish = () => {
    const goals = computeGoals();

    // Save profile to settings
    setSetting(db, 'profile_sex', sex);
    setSetting(db, 'profile_birth_year', birthYear);
    setSetting(db, 'profile_height_feet', heightFeet);
    setSetting(db, 'profile_height_inches', heightInches);
    setSetting(db, 'profile_weight_lbs', weightLbs);
    setSetting(db, 'profile_activity_level', activityLevel);
    setSetting(db, 'profile_weight_goal', weightGoal);
    setSetting(db, 'profile_goal_rate', String(goalRate));

    // Create daily goals
    const today = new Date().toISOString().slice(0, 10);
    createDailyGoals(db, uuid(), {
      calories: goals.calories,
      proteinG: goals.proteinG,
      carbsG: goals.carbsG,
      fatG: goals.fatG,
      effectiveDate: today,
    });

    // Mark onboarding as completed
    setSetting(db, 'onboarding_completed', '1');

    router.replace('/(nutrition)/' as never);
  };

  const progressPct = (step / TOTAL_STEPS) * 100;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Header */}
      <View style={styles.header}>
        {step > 1 ? (
          <Pressable onPress={back} hitSlop={12}>
            <Text style={styles.backArrow}>{'\u2039'}</Text>
          </Pressable>
        ) : (
          <View style={{ width: 28 }} />
        )}
        <Text variant="caption" color={colors.textSecondary}>
          Step {step} of {TOTAL_STEPS}
        </Text>
        <View style={{ width: 28 }} />
      </View>

      {/* Progress bar */}
      <View style={styles.progressOuter}>
        <View style={[styles.progressInner, { width: `${progressPct}%` }]} />
      </View>

      {/* Step 1: Profile */}
      {step === 1 && (
        <>
          <Text variant="heading" style={styles.stepTitle}>Set Your Profile</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.stepDescription}>
            We'll use this to calculate your daily nutrition targets.
          </Text>

          <Card style={styles.fieldCard}>
            <Text variant="label" color={colors.textTertiary}>SEX</Text>
            <View style={styles.toggleRow}>
              {(['male', 'female'] as UserSex[]).map((s) => (
                <Pressable
                  key={s}
                  style={[styles.toggleOption, sex === s && styles.toggleActive]}
                  onPress={() => setSex(s)}
                >
                  <Text variant="body" color={sex === s ? ACCENT : colors.textSecondary}>
                    {s === 'male' ? '\u2642\ufe0f Male' : '\u2640\ufe0f Female'}
                  </Text>
                </Pressable>
              ))}
            </View>
          </Card>

          <Card style={styles.fieldCard}>
            <Text variant="label" color={colors.textTertiary}>BIRTH YEAR</Text>
            <TextInput
              style={styles.input}
              value={birthYear}
              onChangeText={setBirthYear}
              keyboardType="number-pad"
              placeholder="1994"
              placeholderTextColor={colors.textTertiary}
              maxLength={4}
            />
          </Card>

          <Card style={styles.fieldCard}>
            <Text variant="label" color={colors.textTertiary}>HEIGHT</Text>
            <View style={styles.heightRow}>
              <View style={styles.heightInput}>
                <TextInput
                  style={styles.input}
                  value={heightFeet}
                  onChangeText={setHeightFeet}
                  keyboardType="number-pad"
                  maxLength={1}
                />
                <Text variant="caption" color={colors.textSecondary}>ft</Text>
              </View>
              <View style={styles.heightInput}>
                <TextInput
                  style={styles.input}
                  value={heightInches}
                  onChangeText={setHeightInches}
                  keyboardType="number-pad"
                  maxLength={2}
                />
                <Text variant="caption" color={colors.textSecondary}>in</Text>
              </View>
            </View>
          </Card>

          <Card style={styles.fieldCard}>
            <Text variant="label" color={colors.textTertiary}>WEIGHT</Text>
            <View style={styles.weightRow}>
              <TextInput
                style={[styles.input, { flex: 1 }]}
                value={weightLbs}
                onChangeText={setWeightLbs}
                keyboardType="decimal-pad"
                maxLength={5}
              />
              <Text variant="caption" color={colors.textSecondary}>lbs</Text>
            </View>
          </Card>
        </>
      )}

      {/* Step 2: Activity Level */}
      {step === 2 && (
        <>
          <Text variant="heading" style={styles.stepTitle}>Activity Level</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.stepDescription}>
            Select the level that best describes your day-to-day life.
          </Text>

          {ACTIVITY_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.optionCard, activityLevel === opt.key && styles.optionActive]}
              onPress={() => setActivityLevel(opt.key)}
            >
              <Text style={styles.optionIcon}>{opt.icon}</Text>
              <View style={styles.optionInfo}>
                <Text variant="body" color={colors.text}>{opt.label}</Text>
                <Text variant="caption" color={colors.textSecondary}>{opt.description}</Text>
              </View>
              {activityLevel === opt.key && (
                <View style={styles.checkBadge}>
                  <Text variant="caption" color={ACCENT}>{'\u2713'}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </>
      )}

      {/* Step 3: Weight Goal */}
      {step === 3 && (
        <>
          <Text variant="heading" style={styles.stepTitle}>What's Your Goal?</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.stepDescription}>
            We'll calculate your daily calorie budget based on your goal.
          </Text>

          {GOAL_OPTIONS.map((opt) => (
            <Pressable
              key={opt.key}
              style={[styles.optionCard, weightGoal === opt.key && styles.optionActive]}
              onPress={() => setWeightGoal(opt.key)}
            >
              <Text style={styles.optionIcon}>{opt.icon}</Text>
              <View style={styles.optionInfo}>
                <Text variant="body" color={colors.text}>{opt.label}</Text>
                <Text variant="caption" color={colors.textSecondary}>{opt.description}</Text>
              </View>
              {weightGoal === opt.key && (
                <View style={styles.checkBadge}>
                  <Text variant="caption" color={ACCENT}>{'\u2713'}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </>
      )}

      {/* Step 4: Goal Rate */}
      {step === 4 && weightGoal !== 'maintain' && (
        <>
          <Text variant="heading" style={styles.stepTitle}>Goal Rate</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.stepDescription}>
            How fast do you want to {weightGoal === 'lose' ? 'lose' : 'gain'} weight?
          </Text>

          {RATE_OPTIONS.map((opt) => (
            <Pressable
              key={opt.value}
              style={[styles.optionCard, goalRate === opt.value && styles.optionActive]}
              onPress={() => setGoalRate(opt.value)}
            >
              <View style={styles.optionInfo}>
                <Text variant="body" color={colors.text}>{opt.label}</Text>
                <Text variant="caption" color={colors.textSecondary}>{opt.description}</Text>
              </View>
              {goalRate === opt.value && (
                <View style={styles.checkBadge}>
                  <Text variant="caption" color={ACCENT}>{'\u2713'}</Text>
                </View>
              )}
            </Pressable>
          ))}
        </>
      )}

      {/* Step 5: Review */}
      {step === 5 && (
        <>
          <Text variant="heading" style={styles.stepTitle}>Your Plan</Text>
          <Text variant="body" color={colors.textSecondary} style={styles.stepDescription}>
            Here are your personalized daily targets. You can adjust these anytime in Settings.
          </Text>

          {(() => {
            const goals = computeGoals();
            return (
              <>
                <Card style={styles.reviewCard}>
                  <View style={styles.reviewRow}>
                    <Text variant="body" color={colors.textSecondary}>TDEE</Text>
                    <Text variant="body" color={colors.text}>{goals.tdee} cal</Text>
                  </View>
                  <View style={styles.divider} />
                  <View style={styles.reviewRow}>
                    <Text variant="body" color={colors.textSecondary}>Daily Target</Text>
                    <Text variant="subheading" color={ACCENT}>{goals.calories} cal</Text>
                  </View>
                </Card>

                <Card style={styles.reviewCard}>
                  <Text variant="label" color={colors.textTertiary}>MACRO TARGETS</Text>
                  <View style={styles.macroGrid}>
                    <MacroReview label="Protein" value={goals.proteinG} unit="g" color="#3B82F6" />
                    <MacroReview label="Carbs" value={goals.carbsG} unit="g" color={colors.success} />
                    <MacroReview label="Fat" value={goals.fatG} unit="g" color="#EAB308" />
                  </View>
                </Card>

                <Card style={styles.reviewCard}>
                  <Text variant="label" color={colors.textTertiary}>PROFILE</Text>
                  <ReviewLine label="Sex" value={sex === 'male' ? 'Male' : 'Female'} />
                  <ReviewLine label="Age" value={`${ageFromBirthYear(parseInt(birthYear) || 1994)} years`} />
                  <ReviewLine label="Height" value={`${heightFeet}'${heightInches}"`} />
                  <ReviewLine label="Weight" value={`${weightLbs} lbs`} />
                  <ReviewLine label="Activity" value={ACTIVITY_OPTIONS.find((a) => a.key === activityLevel)?.label ?? ''} />
                  <ReviewLine label="Goal" value={GOAL_OPTIONS.find((g) => g.key === weightGoal)?.label ?? ''} />
                </Card>
              </>
            );
          })()}
        </>
      )}

      {/* Next/Finish button */}
      <Pressable
        style={[styles.nextButton, { backgroundColor: ACCENT }]}
        onPress={step === TOTAL_STEPS ? handleFinish : next}
      >
        <Text variant="body" color="#fff" style={{ fontWeight: '700', fontSize: 16 }}>
          {step === TOTAL_STEPS ? 'Start Tracking' : 'Next'}
        </Text>
      </Pressable>

      {step === 1 && (
        <Pressable
          style={styles.skipButton}
          onPress={() => {
            setSetting(db, 'onboarding_completed', '1');
            router.replace('/(nutrition)/' as never);
          }}
        >
          <Text variant="body" color={colors.textTertiary}>Skip for now</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}

function MacroReview({ label, value, unit, color }: { label: string; value: number; unit: string; color: string }) {
  return (
    <View style={styles.macroItem}>
      <View style={[styles.macroDot, { backgroundColor: color }]} />
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="body" color={colors.text} style={{ fontWeight: '600' }}>{value}{unit}</Text>
    </View>
  );
}

function ReviewLine({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.reviewRow}>
      <Text variant="caption" color={colors.textSecondary}>{label}</Text>
      <Text variant="body" color={colors.text}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: 100, gap: spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  backArrow: { fontSize: 28, color: ACCENT, fontWeight: '300' },
  progressOuter: {
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressInner: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 2,
  },
  stepTitle: { marginTop: spacing.sm },
  stepDescription: { marginBottom: spacing.xs },
  fieldCard: { gap: spacing.sm },
  toggleRow: { flexDirection: 'row', gap: spacing.sm },
  toggleOption: {
    flex: 1,
    paddingVertical: spacing.sm,
    borderRadius: 10,
    backgroundColor: colors.surfaceElevated,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  toggleActive: {
    borderColor: ACCENT,
    backgroundColor: `${ACCENT}12`,
  },
  input: {
    backgroundColor: colors.surfaceElevated,
    borderRadius: 8,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 18,
    fontFamily: 'Inter',
    borderWidth: 1,
    borderColor: colors.border,
    textAlign: 'center',
  },
  heightRow: { flexDirection: 'row', gap: spacing.md },
  heightInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: 12,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  optionActive: {
    borderColor: ACCENT,
    backgroundColor: `${ACCENT}10`,
  },
  optionIcon: { fontSize: 28 },
  optionInfo: { flex: 1, gap: 2 },
  checkBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: `${ACCENT}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  nextButton: {
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  skipButton: {
    alignItems: 'center',
    paddingVertical: spacing.sm,
  },
  reviewCard: { gap: spacing.sm },
  reviewRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
  macroGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: spacing.xs,
  },
  macroItem: { alignItems: 'center', gap: 4 },
  macroDot: { width: 8, height: 8, borderRadius: 4 },
});
