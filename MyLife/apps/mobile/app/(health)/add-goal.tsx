import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import {
  createGoal,
  type GoalDomain,
  type GoalPeriod,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  JAKARTA_FONTS,
  GlassCard,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

interface CategoryOption {
  id: GoalDomain;
  label: string;
  subtitle: string;
  icon: string;
  color: string;
  defaultMetric: string;
  defaultUnit: string;
  defaultTarget: string;
}

const CATEGORIES: CategoryOption[] = [
  {
    id: 'fasting',
    label: 'Fasting',
    subtitle: 'Intermittent fasting',
    icon: '\u23F1\uFE0F',
    color: '#FFB877',
    defaultMetric: 'fasts_completed',
    defaultUnit: 'fasts',
    defaultTarget: '5',
  },
  {
    id: 'weight',
    label: 'Weight',
    subtitle: 'Body weight goals',
    icon: '\u2696\uFE0F',
    color: '#F472B6',
    defaultMetric: 'body_weight',
    defaultUnit: 'lbs',
    defaultTarget: '150',
  },
  {
    id: 'steps',
    label: 'Steps',
    subtitle: 'Daily movement',
    icon: '\u{1F6B6}',
    color: '#FFB877',
    defaultMetric: 'daily_steps',
    defaultUnit: 'steps',
    defaultTarget: '10000',
  },
  {
    id: 'sleep',
    label: 'Sleep',
    subtitle: 'Sleep duration',
    icon: '\u{1F319}',
    color: '#A78BFA',
    defaultMetric: 'sleep_hours',
    defaultUnit: 'hours',
    defaultTarget: '8',
  },
  {
    id: 'adherence',
    label: 'Medications',
    subtitle: 'Med adherence',
    icon: '\u{1F48A}',
    color: '#F472B6',
    defaultMetric: 'adherence_rate',
    defaultUnit: '%',
    defaultTarget: '90',
  },
  {
    id: 'water',
    label: 'Water',
    subtitle: 'Daily hydration',
    icon: '\u{1F4A7}',
    color: '#60A5FA',
    defaultMetric: 'glasses',
    defaultUnit: 'glasses',
    defaultTarget: '8',
  },
  {
    id: 'vitals',
    label: 'Vitals',
    subtitle: 'Health metrics',
    icon: '\u{1FA7A}',
    color: '#60A5FA',
    defaultMetric: 'heart_rate',
    defaultUnit: 'bpm',
    defaultTarget: '70',
  },
  {
    id: 'custom',
    label: 'Custom',
    subtitle: 'Your own goal',
    icon: '\u2728',
    color: '#34D399',
    defaultMetric: '',
    defaultUnit: '',
    defaultTarget: '',
  },
];

type Frequency = GoalPeriod;

const FREQUENCIES: { id: Frequency; label: string }[] = [
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'monthly', label: 'Monthly' },
];

export default function AddGoalScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState<GoalDomain>('steps');
  const [targetValue, setTargetValue] = useState('10000');
  const [frequency, setFrequency] = useState<Frequency>('daily');
  const [startDate] = useState(() => new Date().toISOString().split('T')[0]!);
  const [reminder, setReminder] = useState(true);
  const [customMetric, setCustomMetric] = useState('');
  const [customUnit, setCustomUnit] = useState('');
  const [label, setLabel] = useState('');

  const category = CATEGORIES.find((c) => c.id === selectedCategory);
  const isCustom = selectedCategory === 'custom';
  const displayUnit = isCustom ? customUnit || 'units' : (category?.defaultUnit ?? '');

  const handleCategorySelect = (cat: CategoryOption) => {
    setSelectedCategory(cat.id);
    if (cat.id !== 'custom') {
      setTargetValue(cat.defaultTarget);
    }
  };

  const handleCreate = () => {
    const numTarget = Number(targetValue);
    if (!Number.isFinite(numTarget) || numTarget <= 0) {
      Alert.alert('Invalid target', 'Please enter a valid target value.');
      return;
    }

    if (isCustom && !customMetric.trim()) {
      Alert.alert('Missing metric', 'Please enter a metric name for your custom goal.');
      return;
    }

    try {
      createGoal(db, {
        domain: selectedCategory,
        metric: isCustom ? customMetric.trim() : (category?.defaultMetric ?? ''),
        target_value: numTarget,
        unit: isCustom ? customUnit.trim() || undefined : category?.defaultUnit,
        period: frequency,
        direction: 'at_least',
        label: label.trim() || undefined,
        start_date: startDate,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create goal.');
    }
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Step 1: Category Selection */}
      <Text style={styles.stepLabel}>STEP 1</Text>
      <Text style={styles.stepTitle}>Select Goal Category</Text>

      <View style={styles.categoryGrid}>
        {CATEGORIES.map((cat) => {
          const isSelected = selectedCategory === cat.id;
          return (
            <GlassCard
              key={cat.id}
              level={2}
              style={[
                styles.categoryCard,
                isSelected && { backgroundColor: HEALTH_SURFACES.focus },
              ]}
              onPress={() => handleCategorySelect(cat)}
            >
              <View style={styles.categoryCardInner}>
                <View style={[styles.categoryIcon, { backgroundColor: `${cat.color}20` }]}>
                  <Text style={styles.categoryIconText}>{cat.icon}</Text>
                </View>
                <View style={styles.categoryTextCol}>
                  <Text style={styles.categoryName}>{cat.label}</Text>
                  <Text style={styles.categorySub}>{cat.subtitle}</Text>
                </View>
                {isSelected && <View style={styles.selectedDot} />}
              </View>
            </GlassCard>
          );
        })}
      </View>

      {/* Custom metric fields */}
      {isCustom && (
        <View style={styles.customSection}>
          <Text style={styles.inputLabel}>Metric Name</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., meditation minutes"
            placeholderTextColor={colors.textTertiary}
            value={customMetric}
            onChangeText={setCustomMetric}
          />
          <Text style={[styles.inputLabel, { marginTop: 12 }]}>Unit</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g., minutes"
            placeholderTextColor={colors.textTertiary}
            value={customUnit}
            onChangeText={setCustomUnit}
          />
        </View>
      )}

      {/* Step 2: Configuration */}
      <Text style={[styles.stepLabel, { marginTop: spacing.xl }]}>STEP 2: CONFIGURATION</Text>

      {/* Goal Label */}
      <View style={styles.configSection}>
        <Text style={styles.inputLabel}>Goal Name (optional)</Text>
        <TextInput
          style={styles.textInput}
          placeholder={`e.g., ${category?.label ?? 'My'} challenge`}
          placeholderTextColor={colors.textTertiary}
          value={label}
          onChangeText={setLabel}
        />
      </View>

      {/* Target Value */}
      <View style={styles.configSection}>
        <Text style={styles.inputLabel}>Target Value</Text>
        <View style={styles.targetRow}>
          <TextInput
            style={styles.targetInput}
            value={targetValue}
            onChangeText={setTargetValue}
            keyboardType="numeric"
            placeholder="0"
            placeholderTextColor={colors.textTertiary}
          />
          <View style={styles.unitBadge}>
            <Text style={styles.unitText}>{displayUnit.toUpperCase()}</Text>
          </View>
        </View>
      </View>

      {/* Frequency */}
      <View style={styles.configSection}>
        <Text style={styles.inputLabel}>Frequency</Text>
        <View style={styles.frequencyRow}>
          {FREQUENCIES.map((f) => {
            const isActive = frequency === f.id;
            return (
              <Pressable
                key={f.id}
                style={[styles.frequencyPill, isActive && styles.frequencyPillActive]}
                onPress={() => setFrequency(f.id)}
              >
                <Text
                  style={[
                    styles.frequencyPillText,
                    isActive && styles.frequencyPillTextActive,
                  ]}
                >
                  {f.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Start Date */}
      <View style={styles.configRow}>
        <Text style={styles.configRowIcon}>{'\u{1F4C5}'}</Text>
        <Text style={styles.configRowLabel}>Start Date</Text>
        <Text style={styles.configRowValue}>{startDate}</Text>
      </View>

      {/* Reminder Toggle */}
      <View style={styles.configRow}>
        <Text style={styles.configRowIcon}>{'\u{1F514}'}</Text>
        <Text style={styles.configRowLabel}>Reminder</Text>
        <Switch
          value={reminder}
          onValueChange={setReminder}
          trackColor={{ false: HEALTH_SURFACES.focus, true: `${HEALTH_ACCENT}80` }}
          thumbColor={reminder ? HEALTH_ACCENT : HEALTH_SURFACES.highest}
        />
      </View>

      {/* Create Button */}
      <View style={styles.createButtonWrap}>
        <GradientButton title="Create Goal" onPress={handleCreate} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: 100,
  },

  // Step headers
  stepLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_ACCENT,
    marginBottom: 8,
  },
  stepTitle: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    fontSize: 24,
    letterSpacing: -0.02 * 24,
    color: colors.text,
    marginBottom: spacing.lg,
  },

  // Category grid
  categoryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  categoryCard: {
    width: '48%' as unknown as number,
    flexGrow: 0,
    flexShrink: 0,
    flexBasis: '48%' as unknown as number,
    padding: 14,
  },
  categoryCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  categoryIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  categoryIconText: {
    fontSize: 18,
  },
  categoryTextCol: {
    flex: 1,
    gap: 2,
  },
  categoryName: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
  },
  categorySub: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSecondary,
  },
  selectedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HEALTH_ACCENT,
  },

  // Custom section
  customSection: {
    marginTop: spacing.md,
  },

  // Config section
  configSection: {
    marginBottom: spacing.md,
  },
  inputLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.regular,
    fontSize: 15,
  },

  // Target value
  targetRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  targetInput: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: colors.text,
    fontFamily: JAKARTA_FONTS.bold,
    fontSize: 28,
    letterSpacing: -0.5,
  },
  unitBadge: {
    backgroundColor: HEALTH_SURFACES.focus,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  unitText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.1 * 12,
    color: colors.textSecondary,
  },

  // Frequency pills
  frequencyRow: {
    flexDirection: 'row',
    gap: 10,
  },
  frequencyPill: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: HEALTH_SURFACES.lift,
  },
  frequencyPillActive: {
    backgroundColor: HEALTH_ACCENT,
  },
  frequencyPillText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 12,
    letterSpacing: 0.1 * 12,
    color: colors.textSecondary,
  },
  frequencyPillTextActive: {
    color: '#FFFFFF',
  },

  // Config rows (date, reminder)
  configRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: HEALTH_SURFACES.lift,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: spacing.sm,
    gap: 12,
  },
  configRowIcon: {
    fontSize: 18,
  },
  configRowLabel: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  configRowValue: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 15,
    color: colors.textSecondary,
  },

  // Create button
  createButtonWrap: {
    marginTop: spacing.lg,
    paddingHorizontal: 0,
  },
});
