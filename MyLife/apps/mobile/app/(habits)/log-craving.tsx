import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  MaterialSymbol,
  createCraving,
  getAllSobrietyProfiles,
  getCravingsForHabit,
  type CravingOutcome,
  type TriggerCategory,
} from '@mylife/habits';
import { EmptyState, Text } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  formatRelativeTimestamp,
  parseCravingContext,
  serializeCravingContext,
} from '../../components/habits/phase5';

type TriggerOption = {
  label: string;
  category: TriggerCategory;
};

const TRIGGER_OPTIONS: TriggerOption[] = [
  { label: 'Stress', category: 'emotional' },
  { label: 'Anxiety', category: 'emotional' },
  { label: 'Boredom', category: 'emotional' },
  { label: 'Social', category: 'social' },
  { label: 'Anger', category: 'emotional' },
  { label: 'Sadness', category: 'emotional' },
  { label: 'Celebration', category: 'social' },
  { label: 'Routine', category: 'routine' },
  { label: 'Sight', category: 'environmental' },
  { label: 'Smell', category: 'environmental' },
  { label: 'Other', category: 'custom' },
];

const STRATEGY_OPTIONS = [
  'Distract',
  'Breathe',
  'Call Support',
  'Wait',
  'Walk',
  'Journal',
  'Other',
] as const;

const OUTCOME_OPTIONS: Array<{ label: string; value: CravingOutcome }> = [
  { label: 'Resisted', value: 'resisted' },
  { label: 'Delayed', value: 'delayed' },
  { label: 'Distracted', value: 'distracted' },
  { label: 'Gave In', value: 'gave_in' },
];

const INTENSITY_COPY: Record<number, { emoji: string; label: string }> = {
  1: { emoji: '🙂', label: 'Barely there' },
  2: { emoji: '🙂', label: 'Light' },
  3: { emoji: '😐', label: 'Noticeable' },
  4: { emoji: '😐', label: 'Steady' },
  5: { emoji: '😕', label: 'Building' },
  6: { emoji: '😕', label: 'Tense' },
  7: { emoji: '😣', label: 'Sharp' },
  8: { emoji: '😣', label: 'Heavy' },
  9: { emoji: '😫', label: 'Overpowering' },
  10: { emoji: '😫', label: 'Maximum' },
};

export default function LogCravingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ habitId?: string }>();
  const fallbackHabitId = useMemo(
    () => getAllSobrietyProfiles(db)[0]?.habitId ?? null,
    [db],
  );
  const activeHabitId = params.habitId ?? fallbackHabitId;

  const [intensity, setIntensity] = useState(6);
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>(['Stress']);
  const [customTrigger, setCustomTrigger] = useState('');
  const [selectedStrategy, setSelectedStrategy] = useState<(typeof STRATEGY_OPTIONS)[number]>('Breathe');
  const [customStrategy, setCustomStrategy] = useState('');
  const [outcome, setOutcome] = useState<CravingOutcome>('resisted');
  const [locationLabel, setLocationLabel] = useState('');
  const [companions, setCompanions] = useState('');
  const [notes, setNotes] = useState('');
  const [loggedAt, setLoggedAt] = useState(() => new Date());

  const recentEntries = useMemo(
    () => (activeHabitId
      ? getCravingsForHabit(db, activeHabitId, { limit: 3 }).map((craving) => ({
        craving,
        context: parseCravingContext(craving.notes),
      }))
      : []),
    [activeHabitId, db],
  );

  const toggleTrigger = useCallback((label: string) => {
    setSelectedTriggers((current) => (
      current.includes(label)
        ? current.filter((item) => item !== label)
        : [...current, label]
    ));
  }, []);

  const handleSave = useCallback(() => {
    if (!activeHabitId) {
      Alert.alert('No sobriety habit found', 'Create a sobriety tracker before logging cravings.');
      return;
    }

    const selectedOptions = TRIGGER_OPTIONS.filter((option) => selectedTriggers.includes(option.label));
    const triggerPayload = selectedOptions
      .filter((option) => option.label !== 'Other')
      .map((option) => ({
        id: uuid(),
        name: option.label,
        category: option.category,
      }));

    if (selectedTriggers.includes('Other') && customTrigger.trim()) {
      triggerPayload.push({
        id: uuid(),
        name: customTrigger.trim(),
        category: 'custom',
      });
    }

    if (triggerPayload.length === 0) {
      Alert.alert('Pick at least one trigger', 'A trigger helps the insights screen build useful patterns.');
      return;
    }

    const strategy = selectedStrategy === 'Other'
      ? customStrategy.trim()
      : selectedStrategy;

    createCraving(db, uuid(), {
      habitId: activeHabitId,
      intensity,
      copingStrategy: strategy || undefined,
      outcome,
      loggedAt: loggedAt.toISOString(),
      notes: serializeCravingContext({
        location: locationLabel,
        companions,
        notes,
      }),
      triggers: triggerPayload,
    });

    Alert.alert('Craving logged', 'Saved to your recovery timeline.', [
      {
        text: 'View insights',
        onPress: () => router.replace(`/(habits)/craving-insights?habitId=${activeHabitId}`),
      },
    ]);
  }, [
    activeHabitId,
    companions,
    customStrategy,
    customTrigger,
    db,
    intensity,
    locationLabel,
    loggedAt,
    notes,
    outcome,
    router,
    selectedStrategy,
    selectedTriggers,
  ]);

  if (!activeHabitId) {
    return (
      <View style={styles.emptyState}>
        <EmptyState
          icon={'\u23F0'}
          title="No sobriety tracker"
          message="Create a negative habit with sobriety enabled before logging cravings."
        />
      </View>
    );
  }

  const intensityState = INTENSITY_COPY[intensity];

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.topRow}>
        <View style={styles.headingBlock}>
          <Text style={styles.overline}>Recovery log</Text>
          <Text style={styles.title}>How are you feeling?</Text>
          <Text style={styles.subtitle}>
            Awareness creates the opening for a different next step.
          </Text>
        </View>
        <Pressable style={styles.closeButton} onPress={() => router.back()}>
          <MaterialSymbol name="close" size={18} color={HB_TEXT} />
        </Pressable>
      </View>

      <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroContent}>
        <LinearGradient
          colors={['rgba(167,139,250,0.24)', 'rgba(139,92,246,0.08)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
        />
        <Text style={styles.heroEmoji}>{intensityState.emoji}</Text>
        <Text style={styles.heroNumber}>{intensity}</Text>
        <Text style={styles.heroLabel}>{intensityState.label}</Text>
        <Text style={styles.heroSubLabel}>Intensity right now</Text>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Intensity slider</Text>
        <View style={styles.sliderRow}>
          {Array.from({ length: 10 }, (_, index) => {
            const value = index + 1;
            const active = value === intensity;
            return (
              <Pressable
                key={value}
                style={[styles.sliderStep, active ? styles.sliderStepActive : undefined]}
                onPress={() => setIntensity(value)}
              >
                <Text style={[styles.sliderStepText, active ? styles.sliderStepTextActive : undefined]}>
                  {value}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.sliderMeta}>
          <Text style={styles.sliderMetaText}>Mild</Text>
          <Text style={styles.sliderMetaText}>Extreme</Text>
        </View>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Trigger picker</Text>
        <View style={styles.chipWrap}>
          {TRIGGER_OPTIONS.map((option) => {
            const active = selectedTriggers.includes(option.label);
            return (
              <Pressable
                key={option.label}
                style={[styles.chip, active ? styles.chipActive : undefined]}
                onPress={() => toggleTrigger(option.label)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedTriggers.includes('Other') ? (
          <TextInput
            value={customTrigger}
            onChangeText={setCustomTrigger}
            placeholder="What else triggered it?"
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={styles.input}
          />
        ) : null}
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Context</Text>
        <View style={styles.contextCard}>
          <View style={styles.contextHeader}>
            <MaterialSymbol name="schedule" size={16} color={HB_ACCENT_LIGHT} />
            <Text style={styles.contextLabel}>{loggedAt.toLocaleString()}</Text>
          </View>
          <Pressable style={styles.contextAction} onPress={() => setLoggedAt(new Date())}>
            <Text style={styles.contextActionText}>Use now</Text>
          </Pressable>
        </View>
        <TextInput
          value={locationLabel}
          onChangeText={setLocationLabel}
          placeholder="Location"
          placeholderTextColor={HB_TEXT_TERTIARY}
          style={styles.input}
        />
        <TextInput
          value={companions}
          onChangeText={setCompanions}
          placeholder="Who are you with?"
          placeholderTextColor={HB_TEXT_TERTIARY}
          style={styles.input}
        />
        <Text style={styles.helperText}>Manual location entry is available in this workspace.</Text>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Strategy picker</Text>
        <View style={styles.chipWrap}>
          {STRATEGY_OPTIONS.map((option) => {
            const active = selectedStrategy === option;
            return (
              <Pressable
                key={option}
                style={[styles.chip, active ? styles.chipActive : undefined]}
                onPress={() => setSelectedStrategy(option)}
              >
                <Text style={[styles.chipText, active ? styles.chipTextActive : undefined]}>
                  {option}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {selectedStrategy === 'Other' ? (
          <TextInput
            value={customStrategy}
            onChangeText={setCustomStrategy}
            placeholder="What will you do instead?"
            placeholderTextColor={HB_TEXT_TERTIARY}
            style={styles.input}
          />
        ) : null}
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>How did it go?</Text>
        <View style={styles.outcomeGrid}>
          {OUTCOME_OPTIONS.map((option) => {
            const active = option.value === outcome;
            return (
              <Pressable
                key={option.value}
                style={[styles.outcomeCard, active ? styles.outcomeCardActive : undefined]}
                onPress={() => setOutcome(option.value)}
              >
                <Text style={[styles.outcomeTitle, active ? styles.outcomeTitleActive : undefined]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <Text style={styles.sectionLabel}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="What happened, what helped, what do you want to remember?"
          placeholderTextColor={HB_TEXT_TERTIARY}
          style={[styles.input, styles.textArea]}
          multiline
          textAlignVertical="top"
        />
      </GlassCard>

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save craving</Text>
      </Pressable>

      <GlassCard level={2} contentStyle={styles.sectionCard}>
        <View style={styles.recentHeader}>
          <Text style={styles.sectionLabel}>Recent cravings</Text>
          <Pressable onPress={() => router.push(`/(habits)/craving-insights?habitId=${activeHabitId}`)}>
            <Text style={styles.contextActionText}>Insights</Text>
          </Pressable>
        </View>
        {recentEntries.length > 0 ? recentEntries.map(({ craving, context }) => (
          <View key={craving.id} style={styles.recentRow}>
            <View style={styles.recentBadge}>
              <Text style={styles.recentBadgeText}>{craving.intensity}</Text>
            </View>
            <View style={styles.recentCopy}>
              <Text style={styles.recentTitle}>
                {craving.copingStrategy || 'Craving logged'}
              </Text>
              <Text style={styles.recentMeta}>
                {formatRelativeTimestamp(craving.loggedAt)}
                {context.location ? ` · ${context.location}` : ''}
              </Text>
            </View>
          </View>
        )) : (
          <Text style={styles.helperText}>Your next save will start the pattern history.</Text>
        )}
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: HB_SURFACES.base,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
  },
  headingBlock: {
    flex: 1,
    gap: 4,
  },
  overline: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  title: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -1,
    color: HB_TEXT,
  },
  subtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  heroCard: {
    shadowColor: HB_ACCENT,
    shadowOpacity: 0.22,
    shadowRadius: 26,
    shadowOffset: { width: 0, height: 12 },
    elevation: 12,
  },
  heroContent: {
    position: 'relative',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 24,
  },
  heroEmoji: {
    fontSize: 32,
    lineHeight: 38,
  },
  heroNumber: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 64,
    lineHeight: 70,
    letterSpacing: -1.8,
    color: HB_TEXT,
    fontVariant: ['tabular-nums'],
  },
  heroLabel: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  heroSubLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  sectionCard: {
    gap: 14,
  },
  sectionLabel: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: HB_ACCENT_LIGHT,
  },
  sliderRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  sliderStep: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  sliderStepActive: {
    backgroundColor: HB_ACCENT_LIGHT,
  },
  sliderStepText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  sliderStepTextActive: {
    color: HB_SURFACES.lowest,
  },
  sliderMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sliderMetaText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: HB_TEXT_TERTIARY,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  chipActive: {
    backgroundColor: 'rgba(167,139,250,0.2)',
  },
  chipText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  chipTextActive: {
    color: HB_ACCENT_LIGHT,
  },
  contextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  contextHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  contextLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT,
  },
  contextAction: {
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  contextActionText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: HB_ACCENT_LIGHT,
  },
  input: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.low,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: HB_TEXT,
    fontFamily: HB_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  helperText: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  outcomeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  outcomeCard: {
    minWidth: '47%',
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  outcomeCardActive: {
    backgroundColor: 'rgba(167,139,250,0.2)',
  },
  outcomeTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT_SECONDARY,
  },
  outcomeTitleActive: {
    color: HB_TEXT,
  },
  textArea: {
    minHeight: 120,
  },
  saveButton: {
    borderRadius: 20,
    backgroundColor: HB_ACCENT_LIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  saveButtonText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_SURFACES.lowest,
  },
  recentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  recentBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.16)',
  },
  recentBadgeText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 15,
    lineHeight: 18,
    color: HB_ACCENT_LIGHT,
  },
  recentCopy: {
    flex: 1,
    gap: 2,
  },
  recentTitle: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  recentMeta: {
    fontFamily: HB_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
});
