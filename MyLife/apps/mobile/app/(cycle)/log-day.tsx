import { useCallback, useEffect, useMemo, useState } from 'react';
import { uuid } from '../../lib/uuid';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { Text as RNText } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Droplets, Heart, X } from 'lucide-react-native';
import {
  GlassCard,
  addSymptom,
  createCycleDay,
  deleteSymptom,
  getCycleDayByDate,
  getSymptomsForDay,
  updateCycleDay,
  MOOD_SYMPTOMS,
  PHYSICAL_SYMPTOMS,
  CYCLE_ACCENT,
  CYCLE_ACCENT_LIGHT,
  CYCLE_FONTS,
  CYCLE_PHASE_COLORS,
  CYCLE_SURFACES,
  CYCLE_TYPOGRAPHY,
  type FlowLevel,
} from '@mylife/cycle';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  FEELING_OPTIONS,
  decodeCycleLogNotes,
  encodeCycleLogNotes,
  formatLongDate,
  formatSymptomLabel,
  formatFlowLabel,
  isIsoDateParam,
  type FeelingValue,
} from './phase2-utils';

type FlowChoice = FlowLevel | 'none' | null;

const FLOW_OPTIONS: Array<{
  key: Exclude<FlowChoice, null>;
  label: string;
  color: string;
}> = [
  { key: 'none', label: 'None', color: 'rgba(228, 225, 233, 0.72)' },
  { key: 'spotting', label: 'Spotting', color: '#FCA5A5' },
  { key: 'light', label: 'Light', color: '#FB7185' },
  { key: 'medium', label: 'Medium', color: '#EF4444' },
  { key: 'heavy', label: 'Heavy', color: '#B91C1C' },
];

const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  sad: '😔',
  anxious: '😬',
  irritable: '😤',
  calm: '😌',
  emotional: '🥹',
};

const TRACKABLE_SYMPTOMS = new Set<string>([
  ...PHYSICAL_SYMPTOMS,
  ...MOOD_SYMPTOMS,
]);
const PHYSICAL_SYMPTOM_SET = new Set<string>(PHYSICAL_SYMPTOMS);

export default function LogDayScreen() {
  const db = useDatabase();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ date?: string | string[] }>();
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const rawDate = Array.isArray(params.date) ? params.date[0] : params.date;
  const selectedDate = isIsoDateParam(rawDate) ? rawDate : today;
  const isToday = selectedDate === today;

  const existingDay = useMemo(
    () => getCycleDayByDate(db, selectedDate),
    [db, selectedDate],
  );

  const existingSymptoms = useMemo(() => {
    if (!existingDay) {
      return { selected: [] as string[], ids: new Map<string, string>() };
    }
    const selected: string[] = [];
    const ids = new Map<string, string>();
    const symptoms = getSymptomsForDay(db, existingDay.id);

    for (const symptom of symptoms) {
      if (!TRACKABLE_SYMPTOMS.has(symptom.symptom)) continue;
      selected.push(symptom.symptom);
      ids.set(symptom.symptom, symptom.id);
    }

    return { selected, ids };
  }, [db, existingDay]);

  const decodedNotes = useMemo(
    () => decodeCycleLogNotes(existingDay?.notes),
    [existingDay?.notes],
  );
  const existingSymptomKey = useMemo(
    () => [...existingSymptoms.selected].sort().join('|'),
    [existingSymptoms.selected],
  );

  const [flowChoice, setFlowChoice] = useState<FlowChoice>(
    existingDay ? existingDay.flowLevel ?? 'none' : null,
  );
  const [selectedSymptoms, setSelectedSymptoms] = useState<Set<string>>(
    () => new Set(existingSymptoms.selected),
  );
  const [journal, setJournal] = useState(decodedNotes.journal);
  const [overallFeeling, setOverallFeeling] = useState<FeelingValue | null>(
    decodedNotes.overallFeeling,
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFlowChoice(existingDay ? existingDay.flowLevel ?? 'none' : null);
    setSelectedSymptoms(new Set(existingSymptoms.selected));
    setJournal(decodedNotes.journal);
    setOverallFeeling(decodedNotes.overallFeeling);
    setError(null);
  }, [
    existingDay?.id,
    existingDay?.flowLevel,
    decodedNotes.journal,
    decodedNotes.overallFeeling,
    existingSymptomKey,
  ]);

  const toggleSymptom = useCallback((symptom: string) => {
    setSelectedSymptoms((previous) => {
      const next = new Set(previous);
      if (next.has(symptom)) next.delete(symptom);
      else next.add(symptom);
      return next;
    });
  }, []);

  const handleSave = useCallback(() => {
    if (
      flowChoice == null &&
      selectedSymptoms.size === 0 &&
      overallFeeling == null &&
      journal.trim().length === 0
    ) {
      setError('Choose at least one detail to save.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const notePayload = encodeCycleLogNotes(journal, overallFeeling);
      const savedFlow =
        flowChoice != null && flowChoice !== 'none' ? flowChoice : null;

      let dayId = existingDay?.id ?? null;
      if (!dayId) {
        const created = createCycleDay(db, uuid(), {
          date: selectedDate,
          flowLevel: savedFlow ?? undefined,
          notes: notePayload,
          symptoms: [],
        });
        dayId = created.id;
      } else {
        updateCycleDay(db, dayId, {
          flowLevel: savedFlow,
          notes: notePayload ?? null,
        });
      }

      for (const [symptom, symptomId] of existingSymptoms.ids.entries()) {
        if (!selectedSymptoms.has(symptom)) {
          deleteSymptom(db, symptomId);
        }
      }

      for (const symptom of selectedSymptoms) {
        if (!existingSymptoms.ids.has(symptom)) {
          const category = PHYSICAL_SYMPTOM_SET.has(symptom)
            ? 'physical'
            : 'mood';
          addSymptom(db, uuid(), dayId, category, symptom);
        }
      }

      router.back();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save your entry.',
      );
    } finally {
      setSaving(false);
    }
  }, [
    db,
    existingDay?.id,
    existingSymptoms.ids,
    flowChoice,
    journal,
    overallFeeling,
    router,
    selectedDate,
    selectedSymptoms,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.screen}>
        <ScrollView
          contentContainerStyle={[
            styles.content,
            { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 136 },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <RNText style={styles.headerLabel}>DAILY LOG</RNText>
              <RNText style={styles.headerTitle}>
                {isToday ? 'Today' : 'Log Entry'}
              </RNText>
              <RNText style={styles.headerSub}>{formatLongDate(selectedDate)}</RNText>
            </View>
            <Pressable
              hitSlop={12}
              onPress={() => router.back()}
              style={({ pressed }) => [
                styles.closeButton,
                pressed && { opacity: 0.75 },
              ]}
            >
              <X size={20} color="#E4E1E9" strokeWidth={2.4} />
            </Pressable>
          </View>

          {error ? (
            <GlassCard style={styles.errorCard}>
              <RNText style={styles.errorText}>{error}</RNText>
            </GlassCard>
          ) : null}

          <View style={styles.sectionWrap}>
            <RNText style={styles.sectionLabel}>FLOW LEVEL</RNText>
            <View style={styles.flowGrid}>
              {FLOW_OPTIONS.map((option) => {
                const selected = flowChoice === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setFlowChoice(option.key)}
                    style={({ pressed }) => [
                      styles.flowCard,
                      selected && [
                        styles.flowCardSelected,
                        { backgroundColor: option.key === 'none' ? CYCLE_SURFACES.high : CYCLE_PHASE_COLORS.menstrual },
                      ],
                      pressed && { opacity: 0.92 },
                    ]}
                  >
                    <Droplets
                      size={option.key === 'heavy' ? 26 : 22}
                      color={selected ? '#FFFFFF' : option.color}
                      strokeWidth={2}
                    />
                    <RNText
                      style={[
                        styles.flowLabel,
                        selected && styles.flowLabelSelected,
                      ]}
                    >
                      {option.label}
                    </RNText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <RNText style={styles.sectionLabel}>PHYSICAL SYMPTOMS</RNText>
            <View style={styles.chipGrid}>
              {PHYSICAL_SYMPTOMS.map((symptom) => {
                const selected = selectedSymptoms.has(symptom);
                return (
                  <Pressable
                    key={symptom}
                    onPress={() => toggleSymptom(symptom)}
                    style={({ pressed }) => [
                      styles.chip,
                      selected && styles.chipSelected,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <RNText
                      style={[
                        styles.chipText,
                        selected && styles.chipTextSelected,
                      ]}
                    >
                      {formatSymptomLabel(symptom)}
                    </RNText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <RNText style={styles.sectionLabel}>MOOD</RNText>
            <View style={styles.chipGrid}>
              {MOOD_SYMPTOMS.map((symptom) => {
                const selected = selectedSymptoms.has(symptom);
                return (
                  <Pressable
                    key={symptom}
                    onPress={() => toggleSymptom(symptom)}
                    style={({ pressed }) => [
                      styles.moodChip,
                      selected && styles.moodChipSelected,
                      pressed && { opacity: 0.88 },
                    ]}
                  >
                    <RNText
                      style={[
                        styles.moodChipText,
                        selected && styles.moodChipTextSelected,
                      ]}
                    >
                      {MOOD_EMOJI[symptom] ?? '•'} {formatSymptomLabel(symptom)}
                    </RNText>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.sectionWrap}>
            <RNText style={styles.sectionLabel}>OVERALL FEELING</RNText>
            <GlassCard style={styles.feelingCard}>
              <View style={styles.feelingRow}>
                {FEELING_OPTIONS.map((option) => {
                  const selected = overallFeeling === option.value;
                  return (
                    <Pressable
                      key={option.value}
                      onPress={() => setOverallFeeling(option.value)}
                      style={({ pressed }) => [
                        styles.feelingButton,
                        selected && styles.feelingButtonSelected,
                        pressed && { opacity: 0.86 },
                      ]}
                    >
                      <RNText style={styles.feelingEmoji}>{option.emoji}</RNText>
                      <RNText
                        style={[
                          styles.feelingText,
                          selected && styles.feelingTextSelected,
                        ]}
                      >
                        {option.label}
                      </RNText>
                    </Pressable>
                  );
                })}
              </View>
              <View style={styles.feelingMetaRow}>
                <Heart size={16} color={CYCLE_ACCENT_LIGHT} strokeWidth={2} />
                <RNText style={styles.feelingMetaText}>
                  {overallFeeling == null
                    ? 'Tap the emoji that best matches your day.'
                    : `Selected: ${formatFlowLabel(flowChoice)} flow, ${FEELING_OPTIONS.find((option) => option.value === overallFeeling)?.label.toLowerCase()} overall.`}
                </RNText>
              </View>
            </GlassCard>
          </View>

          <View style={styles.sectionWrap}>
            <RNText style={styles.sectionLabel}>JOURNAL NOTES</RNText>
            <TextInput
              multiline
              value={journal}
              onChangeText={setJournal}
              placeholder="How are you feeling today?"
              placeholderTextColor="rgba(214, 195, 181, 0.38)"
              style={styles.notesInput}
              textAlignVertical="top"
            />
          </View>
        </ScrollView>

        <View
          style={[
            styles.footer,
            { paddingBottom: Math.max(insets.bottom, 16) },
          ]}
        >
          <Pressable
            onPress={handleSave}
            disabled={saving}
            style={({ pressed }) => [
              pressed && !saving && { opacity: 0.9 },
              saving && { opacity: 0.75 },
            ]}
          >
            <LinearGradient
              colors={[CYCLE_ACCENT_LIGHT, CYCLE_ACCENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.saveButton}
            >
              <RNText style={styles.saveButtonText}>
                {saving ? 'Saving…' : 'Save Entry'}
              </RNText>
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: CYCLE_SURFACES.lowest,
  },
  content: {
    paddingHorizontal: 20,
    gap: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  headerLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: CYCLE_ACCENT,
  },
  headerTitle: {
    fontFamily: CYCLE_FONTS.extraBold,
    fontSize: 40,
    lineHeight: 44,
    color: '#E4E1E9',
    letterSpacing: -1,
    marginTop: 6,
  },
  headerSub: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: 'rgba(214, 195, 181, 0.78)',
    marginTop: 6,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: CYCLE_SURFACES.low,
  },
  errorCard: {
    backgroundColor: 'rgba(239, 68, 68, 0.18)',
  },
  errorText: {
    ...CYCLE_TYPOGRAPHY.bodyMd,
    color: '#FED7D7',
  },
  sectionWrap: {
    gap: 12,
  },
  sectionLabel: {
    ...CYCLE_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  flowGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  flowCard: {
    width: '18%',
    minWidth: 62,
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: 22,
    backgroundColor: CYCLE_SURFACES.low,
  },
  flowCardSelected: {
    shadowColor: '#EF4444',
    shadowOpacity: 0.25,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  flowLabel: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 10,
    color: 'rgba(214, 195, 181, 0.72)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  flowLabelSelected: {
    color: '#FFFFFF',
  },
  chipGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  chip: {
    backgroundColor: CYCLE_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chipSelected: {
    backgroundColor: CYCLE_SURFACES.highest,
    shadowColor: CYCLE_PHASE_COLORS.ovulation,
    shadowOpacity: 0.25,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
  },
  chipText: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 13,
    color: 'rgba(228, 225, 233, 0.74)',
  },
  chipTextSelected: {
    color: '#E4E1E9',
  },
  moodChip: {
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: CYCLE_SURFACES.low,
  },
  moodChipSelected: {
    shadowColor: CYCLE_PHASE_COLORS.ovulation,
    shadowOpacity: 0.28,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 6,
  },
  moodChipText: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 13,
    color: 'rgba(228, 225, 233, 0.72)',
  },
  moodChipTextSelected: {
    color: '#FFFFFF',
  },
  feelingCard: {
    gap: 14,
    backgroundColor: CYCLE_SURFACES.low,
  },
  feelingRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  feelingButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 12,
    backgroundColor: CYCLE_SURFACES.high,
  },
  feelingButtonSelected: {
    backgroundColor: CYCLE_PHASE_COLORS.ovulation,
  },
  feelingEmoji: {
    fontSize: 24,
  },
  feelingText: {
    fontFamily: CYCLE_FONTS.medium,
    fontSize: 11,
    color: 'rgba(228, 225, 233, 0.74)',
  },
  feelingTextSelected: {
    color: '#FFFFFF',
  },
  feelingMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  feelingMetaText: {
    flex: 1,
    ...CYCLE_TYPOGRAPHY.bodySm,
    color: 'rgba(214, 195, 181, 0.74)',
  },
  notesInput: {
    minHeight: 120,
    borderRadius: 24,
    backgroundColor: CYCLE_SURFACES.low,
    paddingHorizontal: 18,
    paddingVertical: 18,
    color: '#E4E1E9',
    fontFamily: CYCLE_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
  },
  footer: {
    position: 'absolute',
    left: 20,
    right: 20,
    bottom: 0,
  },
  saveButton: {
    borderRadius: 999,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  saveButtonText: {
    fontFamily: CYCLE_FONTS.bold,
    fontSize: 16,
    color: '#4B2700',
    letterSpacing: 0.2,
  },
});
