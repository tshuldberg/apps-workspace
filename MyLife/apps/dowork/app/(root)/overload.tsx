import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  OVERLOAD_PRESETS,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  createOverloadRule,
  deleteOverloadRule,
  generateOverloadSuggestion,
  getEffectiveRule,
  getExercisePerformanceHistory,
  getOverloadRules,
  getWorkoutExercises,
  seedWorkoutExerciseLibrary,
  updateOverloadRule,
  type ExercisePerformanceHistory,
  type OverloadRule,
  type OverloadRuleType,
  type OverloadSuggestion,
  type OverloadTrigger,
  type WorkoutExerciseLibraryItem,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from './providers/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import { WorkoutHero, WorkoutPrimaryButton } from './(tabs)/_screen-kit';
import { DW_ACCENT_LIGHT } from './theme/tokens';

type DraftRule = {
  id: string | null;
  exerciseId: string | null;
  ruleType: OverloadRuleType;
  triggerCondition: OverloadTrigger;
  targetReps: string;
  incrementValue: string;
  incrementUnit: 'lbs' | 'kg' | 'reps' | 'percent';
  minSessions: string;
  isActive: boolean;
};

const RULE_TYPE_OPTIONS: OverloadRuleType[] = [
  'weight_increment',
  'rep_increment',
  'set_increment',
  'percentage',
];

const TRIGGER_OPTIONS: OverloadTrigger[] = [
  'all_sets_hit',
  'any_set_hit',
  'average_reps_hit',
];

function createDraftFromRule(rule: OverloadRule): DraftRule {
  return {
    id: rule.id,
    exerciseId: rule.exerciseId,
    ruleType: rule.ruleType,
    triggerCondition: rule.triggerCondition,
    targetReps: String(rule.targetReps ?? 10),
    incrementValue: String(rule.incrementValue),
    incrementUnit: rule.incrementUnit,
    minSessions: String(rule.minSessions),
    isActive: rule.isActive,
  };
}

function createDraftFromPreset(
  presetKey: keyof typeof OVERLOAD_PRESETS,
  exerciseId: string | null,
): DraftRule {
  const preset = OVERLOAD_PRESETS[presetKey];
  return {
    id: null,
    exerciseId,
    ruleType: preset.ruleType,
    triggerCondition: preset.triggerCondition,
    targetReps: String(preset.targetReps ?? 10),
    incrementValue: String(preset.incrementValue),
    incrementUnit: preset.incrementUnit,
    minSessions: String(preset.minSessions),
    isActive: true,
  };
}

function getRuleTypeLabel(ruleType: OverloadRuleType): string {
  switch (ruleType) {
    case 'weight_increment':
      return 'Weight';
    case 'rep_increment':
      return 'Reps';
    case 'set_increment':
      return 'Sets';
    case 'percentage':
      return 'Percent';
  }
}

function getTriggerLabel(trigger: OverloadTrigger): string {
  switch (trigger) {
    case 'all_sets_hit':
      return 'All sets hit the target';
    case 'any_set_hit':
      return 'Any set hits the target';
    case 'average_reps_hit':
      return 'Average reps hit the target';
  }
}

function getTriggerExplanation(rule: Pick<OverloadRule, 'triggerCondition' | 'targetReps' | 'incrementValue' | 'incrementUnit'>): string {
  const target = rule.targetReps ?? 10;
  switch (rule.triggerCondition) {
    case 'all_sets_hit':
      return `When every work set reaches ${target} reps, the next session nudges the load by ${rule.incrementValue} ${rule.incrementUnit}.`;
    case 'any_set_hit':
      return `As soon as one set reaches ${target} reps, progression becomes available for the next session.`;
    case 'average_reps_hit':
      return `The rule waits for your session average to land at ${target} reps before unlocking a new target.`;
  }
}

function buildSuggestionLabel(suggestion: OverloadSuggestion): string {
  switch (suggestion.ruleApplied) {
    case 'weight_increment':
    case 'percentage':
      return `${suggestion.previousWeight} ${suggestion.unit} x ${suggestion.previousReps} -> ${suggestion.suggestedWeight} ${suggestion.unit}`;
    case 'rep_increment':
      return `${suggestion.previousWeight} ${suggestion.unit} x ${suggestion.previousReps} -> ${suggestion.previousWeight} ${suggestion.unit} x ${suggestion.suggestedReps}`;
    case 'set_increment':
      return `Keep ${suggestion.previousWeight} ${suggestion.unit} and add a set next time`;
  }
}

function describeRule(rule: Pick<OverloadRule, 'ruleType' | 'incrementValue' | 'incrementUnit' | 'minSessions'>): string {
  return `${getRuleTypeLabel(rule.ruleType)} +${rule.incrementValue}${rule.incrementUnit} after ${rule.minSessions} session${rule.minSessions === 1 ? '' : 's'}`;
}

export default function OverloadScreen() {
  const db = useDatabase();
  const [rules, setRules] = useState<OverloadRule[]>([]);
  const [exercises, setExercises] = useState<WorkoutExerciseLibraryItem[]>([]);
  const [search, setSearch] = useState('');
  const [editorSearch, setEditorSearch] = useState('');
  const [showEditor, setShowEditor] = useState(false);
  const [appliedSuggestionIds, setAppliedSuggestionIds] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<DraftRule>(createDraftFromPreset('linear', null));

  useEffect(() => {
    seedWorkoutExerciseLibrary(db);
    setRules(getOverloadRules(db));
    setExercises(getWorkoutExercises(db, { limit: 500 }));
  }, [db]);

  const defaultRule = useMemo(() => {
    return rules.find((rule) => rule.exerciseId === null && rule.isActive) ?? {
      id: '__builtin__',
      exerciseId: null,
      targetReps: 10,
      incrementValue: 5,
      incrementUnit: 'lbs' as const,
      minSessions: 1,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ruleType: 'weight_increment' as const,
      triggerCondition: 'all_sets_hit' as const,
      isActive: true,
    };
  }, [rules]);

  const exerciseLookup = useMemo(() => {
    return new Map(exercises.map((exercise) => [exercise.id, exercise]));
  }, [exercises]);

  const overrideRows = useMemo(() => {
    return rules
      .filter((rule) => rule.exerciseId)
      .filter((rule) => {
        if (!search.trim()) return true;
        const name = exerciseLookup.get(rule.exerciseId ?? '')?.name ?? '';
        return name.toLowerCase().includes(search.trim().toLowerCase());
      });
  }, [exerciseLookup, rules, search]);

  const matchingExercises = useMemo(() => {
    const query = editorSearch.trim().toLowerCase();
    return exercises
      .filter((exercise) => {
        if (!query) return true;
        return exercise.name.toLowerCase().includes(query);
      })
      .slice(0, 12);
  }, [editorSearch, exercises]);

  const suggestionRows = useMemo(() => {
    return exercises
      .map((exercise) => {
        const history = getExercisePerformanceHistory(db, exercise.id, undefined, 8);
        const rule = getEffectiveRule(exercise.id, rules);
        const suggestion = generateOverloadSuggestion(
          exercise.id,
          exercise.category,
          rule,
          history,
        );

        if (!suggestion) return null;

        return {
          exercise,
          history,
          rule,
          suggestion,
        };
      })
      .filter((item): item is {
        exercise: WorkoutExerciseLibraryItem;
        history: ExercisePerformanceHistory;
        rule: OverloadRule;
        suggestion: OverloadSuggestion;
      } => item != null)
      .slice(0, 6);
  }, [db, exercises, rules]);

  const openEditor = (rule?: OverloadRule, exerciseId?: string | null) => {
    if (rule) {
      setDraft(createDraftFromRule(rule));
      setEditorSearch(exerciseLookup.get(rule.exerciseId ?? '')?.name ?? '');
      setShowEditor(true);
      return;
    }

    setDraft(createDraftFromPreset('linear', exerciseId ?? null));
    setEditorSearch(exerciseLookup.get(exerciseId ?? '')?.name ?? '');
    setShowEditor(true);
  };

  const saveRule = () => {
    try {
      if (draft.id) {
        updateOverloadRule(db, draft.id, {
          ruleType: draft.ruleType,
          triggerCondition: draft.triggerCondition,
          targetReps: Number(draft.targetReps) || 10,
          incrementValue: Number(draft.incrementValue) || 5,
          incrementUnit: draft.incrementUnit,
          minSessions: Number(draft.minSessions) || 1,
          isActive: draft.isActive,
        });
      } else {
        createOverloadRule(db, uuid(), {
          exerciseId: draft.exerciseId,
          ruleType: draft.ruleType,
          triggerCondition: draft.triggerCondition,
          targetReps: Number(draft.targetReps) || 10,
          incrementValue: Number(draft.incrementValue) || 5,
          incrementUnit: draft.incrementUnit,
          minSessions: Number(draft.minSessions) || 1,
        });
      }

      setRules(getOverloadRules(db));
      setShowEditor(false);
    } catch (error) {
      Alert.alert(
        'Could not save rule',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  };

  const handleDelete = () => {
    if (!draft.id) return;
    Alert.alert('Delete rule', 'Remove this overload rule?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteOverloadRule(db, draft.id!);
          setRules(getOverloadRules(db));
          setShowEditor(false);
        },
      },
    ]);
  };

  return (
    <>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
        <WorkoutHero
          title="Progression Engine"
          subtitle="Tune the default progression logic, add exercise-specific overrides, and preview the next jump based on recent history."
          trailing={
            <Pressable
              onPress={() => openEditor(undefined, null)}
              style={styles.secondaryButton}
              accessibilityRole="button"
              accessibilityLabel="Add Override"
            >
              <Text style={styles.secondaryButtonText}>Add Override</Text>
            </Pressable>
          }
        />

        <GlassPanel style={styles.heroPanel} intensity={50}>
          <View style={styles.rowBetween}>
            <View style={{ flex: 1, gap: 6 }}>
              <Text style={styles.sectionLabel}>Default Rule</Text>
              <Text style={styles.defaultTitle}>{describeRule(defaultRule)}</Text>
              <Text style={styles.helperCopy}>{getTriggerExplanation(defaultRule)}</Text>
            </View>
            <Pressable onPress={() => openEditor(defaultRule.id === '__builtin__' ? undefined : defaultRule)} style={styles.editButton}>
              <MaterialSymbol name="edit" size={16} color={DW_ACCENT_LIGHT} />
            </Pressable>
          </View>

          <View style={styles.chipRow}>
            {Object.entries(OVERLOAD_PRESETS).map(([key, preset]) => (
              <Chip
                key={key}
                label={preset.label.split(' ')[0] ?? key}
                selected={false}
                onPress={() => {
                  setDraft(createDraftFromPreset(key as keyof typeof OVERLOAD_PRESETS, null));
                  setEditorSearch('');
                  setShowEditor(true);
                }}
              />
            ))}
          </View>
        </GlassPanel>

        <GlassPanel style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Per-Exercise Overrides</Text>
            <Text style={styles.helperCopy}>{overrideRows.length} active</Text>
          </View>

          <View style={styles.searchCard}>
            <MaterialSymbol name="search" size={18} color="rgba(214, 195, 181, 0.6)" />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search exercises"
              placeholderTextColor="rgba(214, 195, 181, 0.36)"
              style={styles.searchInput}
            />
          </View>

          {overrideRows.map((rule) => {
            const exercise = exerciseLookup.get(rule.exerciseId ?? '');
            return (
              <Pressable key={rule.id} onPress={() => openEditor(rule)} style={styles.overrideRow}>
                <View style={{ flex: 1, gap: 3 }}>
                  <Text style={styles.overrideTitle}>{exercise?.name ?? 'Global rule'}</Text>
                  <Text style={styles.overrideMeta}>{describeRule(rule)}</Text>
                  <Text style={styles.overrideMeta}>{getTriggerLabel(rule.triggerCondition)}</Text>
                </View>
                <View style={styles.rulePill}>
                  <Text style={styles.rulePillText}>{getRuleTypeLabel(rule.ruleType)}</Text>
                </View>
              </Pressable>
            );
          })}

          {!overrideRows.length ? (
            <Text style={styles.emptyCopy}>
              No exercise-specific overrides yet. Add one for lifts that progress slower than your default rule.
            </Text>
          ) : null}
        </GlassPanel>

        <GlassPanel style={styles.panel}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionLabel}>Next Session Suggestions</Text>
            <Text style={styles.helperCopy}>{suggestionRows.length} ready</Text>
          </View>

          {suggestionRows.map((item) => {
            const applied = appliedSuggestionIds.has(item.exercise.id);
            return (
              <View key={item.exercise.id} style={styles.suggestionRow}>
                <View style={[styles.suggestionDot, { backgroundColor: applied ? WK_CATEGORY_COLORS.recovery : DW_ACCENT_LIGHT }]} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.overrideTitle}>{item.exercise.name}</Text>
                  <Text style={styles.overrideMeta}>{buildSuggestionLabel(item.suggestion)}</Text>
                  <Text style={styles.overrideMeta}>
                    Based on {item.history.sessions.length} tracked session{item.history.sessions.length === 1 ? '' : 's'}
                  </Text>
                </View>
                <Pressable
                  onPress={() => {
                    setAppliedSuggestionIds((current) => new Set(current).add(item.exercise.id));
                  }}
                  style={[styles.applyButton, applied && styles.applyButtonApplied]}
                >
                  <Text style={styles.applyButtonText}>{applied ? 'Applied' : 'Apply'}</Text>
                </Pressable>
              </View>
            );
          })}

          {!suggestionRows.length ? (
            <Text style={styles.emptyCopy}>
              Complete more repeat sessions to unlock suggestion previews here.
            </Text>
          ) : null}
        </GlassPanel>
      </ScrollView>

      <Modal visible={showEditor} animationType="slide" transparent>
        <View style={styles.modalScrim}>
          <View style={styles.modalCard}>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.modalTitle}>{draft.id ? 'Edit Rule' : 'New Override'}</Text>
                <Text style={styles.modalSubtitle}>
                  Choose a scope, tweak the trigger, then save it back into the workouts database.
                </Text>
              </View>
              <Pressable onPress={() => setShowEditor(false)} style={styles.editButton}>
                <MaterialSymbol name="close" size={16} color="rgba(214, 195, 181, 0.72)" />
              </Pressable>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Exercise Scope</Text>
              <TextInput
                value={editorSearch}
                onChangeText={setEditorSearch}
                placeholder="Global or search for an exercise"
                placeholderTextColor="rgba(214, 195, 181, 0.36)"
                style={styles.input}
              />
              <View style={styles.chipRow}>
                <Chip
                  label="Global"
                  selected={draft.exerciseId == null}
                  onPress={() => setDraft((current) => ({ ...current, exerciseId: null }))}
                />
                {matchingExercises.map((exercise) => (
                  <Chip
                    key={exercise.id}
                    label={exercise.name}
                    selected={draft.exerciseId === exercise.id}
                    onPress={() => setDraft((current) => ({ ...current, exerciseId: exercise.id }))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Rule Type</Text>
              <View style={styles.chipRow}>
                {RULE_TYPE_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={getRuleTypeLabel(option)}
                    selected={draft.ruleType === option}
                    onPress={() => setDraft((current) => ({
                      ...current,
                      ruleType: option,
                      incrementUnit: option === 'rep_increment'
                        ? 'reps'
                        : option === 'percentage'
                          ? 'percent'
                          : current.incrementUnit === 'reps'
                            ? 'lbs'
                            : current.incrementUnit,
                    }))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Trigger</Text>
              <View style={styles.chipRow}>
                {TRIGGER_OPTIONS.map((option) => (
                  <Chip
                    key={option}
                    label={getTriggerLabel(option)}
                    selected={draft.triggerCondition === option}
                    onPress={() => setDraft((current) => ({ ...current, triggerCondition: option }))}
                  />
                ))}
              </View>
            </View>

            <View style={styles.formRow}>
              <View style={styles.inputCardCompact}>
                <Text style={styles.inputLabel}>Target Reps</Text>
                <TextInput
                  value={draft.targetReps}
                  onChangeText={(value) => setDraft((current) => ({ ...current, targetReps: value }))}
                  keyboardType="number-pad"
                  style={styles.inputCompact}
                />
              </View>
              <View style={styles.inputCardCompact}>
                <Text style={styles.inputLabel}>Increment</Text>
                <TextInput
                  value={draft.incrementValue}
                  onChangeText={(value) => setDraft((current) => ({ ...current, incrementValue: value }))}
                  keyboardType="decimal-pad"
                  style={styles.inputCompact}
                />
              </View>
              <View style={styles.inputCardCompact}>
                <Text style={styles.inputLabel}>Min Sessions</Text>
                <TextInput
                  value={draft.minSessions}
                  onChangeText={(value) => setDraft((current) => ({ ...current, minSessions: value }))}
                  keyboardType="number-pad"
                  style={styles.inputCompact}
                />
              </View>
            </View>

            <View style={styles.inputCard}>
              <Text style={styles.inputLabel}>Increment Unit</Text>
              <View style={styles.chipRow}>
                {(['lbs', 'kg', 'reps', 'percent'] as const)
                  .filter((unit) => {
                    if (draft.ruleType === 'rep_increment') return unit === 'reps';
                    if (draft.ruleType === 'percentage') return unit === 'percent';
                    if (draft.ruleType === 'set_increment') return unit === 'reps';
                    return unit === 'lbs' || unit === 'kg';
                  })
                  .map((unit) => (
                    <Chip
                      key={unit}
                      label={unit}
                      selected={draft.incrementUnit === unit}
                      onPress={() => setDraft((current) => ({ ...current, incrementUnit: unit }))}
                    />
                  ))}
              </View>
            </View>

            <WorkoutPrimaryButton label="Save Rule" onPress={saveRule} />
            {draft.id ? (
              <Pressable onPress={handleDelete} style={styles.deleteAction}>
                <Text style={styles.deleteText}>Delete Rule</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroPanel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.high,
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  defaultTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: '#FFF3E7',
  },
  helperCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  editButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.mid,
  },
  secondaryButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 107, 0, 0.10)',
  },
  secondaryButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: DW_ACCENT_LIGHT,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  searchCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderRadius: 20,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  searchInput: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    color: '#F4EEE8',
    paddingVertical: 0,
  },
  overrideRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  overrideTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 16,
    color: '#F4EEE8',
  },
  overrideMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  rulePill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 107, 0, 0.12)',
  },
  rulePillText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    color: DW_ACCENT_LIGHT,
  },
  suggestionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  suggestionDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  applyButton: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    backgroundColor: 'rgba(255, 107, 0, 0.16)',
  },
  applyButtonApplied: {
    backgroundColor: 'rgba(48, 209, 88, 0.16)',
  },
  applyButtonText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: '#FFF3E7',
  },
  emptyCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  modalScrim: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.72)',
  },
  modalCard: {
    maxHeight: '88%',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: spacing.lg,
    gap: spacing.md,
    backgroundColor: WK_SURFACES.base,
  },
  modalTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: '#FFF3E7',
  },
  modalSubtitle: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  inputCard: {
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.low,
  },
  inputLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  input: {
    fontFamily: WK_FONTS.medium,
    fontSize: 16,
    lineHeight: 22,
    color: '#FFF3E7',
    paddingVertical: 0,
  },
  formRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  inputCardCompact: {
    flex: 1,
    borderRadius: 22,
    padding: spacing.md,
    gap: spacing.sm,
    backgroundColor: WK_SURFACES.low,
  },
  inputCompact: {
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: '#FFF3E7',
    paddingVertical: 0,
  },
  deleteAction: {
    alignSelf: 'center',
    paddingVertical: spacing.sm,
  },
  deleteText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    color: '#FFB4AB',
  },
});
