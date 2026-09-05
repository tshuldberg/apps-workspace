import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import DraggableFlatList, {
  ScaleDecorator,
  type RenderItemParams,
} from 'react-native-draggable-flatlist';
import { LinearGradient } from 'expo-linear-gradient';
import {
  HB_ACCENT,
  HB_ACCENT_GLOW,
  HB_ACCENT_LIGHT,
  HB_FONTS,
  HB_GLASS,
  HB_STREAK,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  GlassCard,
  MaterialSymbol,
  createHabitStack,
  deleteHabitStack,
  getHabitById,
  getHabitStacks,
  getHabits,
  getStackAnalytics,
  getStackSuggestions,
  updateHabitStack,
  withAlpha,
  type Habit,
  type HabitStackRecord,
  type HabitStackSuggestion,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';

type DraftStack = {
  visible: boolean;
  mode: 'create' | 'edit';
  originalAnchorId: string | null;
  habitIds: string[];
};

const EMPTY_DRAFT: DraftStack = {
  visible: false,
  mode: 'create',
  originalAnchorId: null,
  habitIds: [],
};

export default function StackingScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [draft, setDraft] = useState<DraftStack>(EMPTY_DRAFT);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const habits = useMemo(
    () => getHabits(db, { isArchived: false }),
    [db, refreshKey],
  );
  const habitMap = useMemo(
    () => new Map(habits.map((habit) => [habit.id, habit])),
    [habits],
  );
  const stacks = useMemo(
    () => getHabitStacks(db),
    [db, refreshKey],
  );
  const stackSuggestions = useMemo(
    () => getStackSuggestions(db),
    [db, refreshKey],
  );
  const analyticsMap = useMemo(
    () => new Map(getStackAnalytics(db).map((entry) => [entry.anchorHabitId, entry])),
    [db, refreshKey],
  );

  const stackCards = useMemo(
    () => stacks.map((stack) => ({
      stack,
      analytics: analyticsMap.get(stack.anchorHabitId) ?? null,
      habits: stack.habitIds.map((habitId) => habitMap.get(habitId)).filter(Boolean) as Habit[],
    })),
    [analyticsMap, habitMap, stacks],
  );

  const strongestStack = useMemo(() => {
    return [...analyticsMap.values()].sort((left, right) => right.completionRate - left.completionRate)[0] ?? null;
  }, [analyticsMap]);

  const biggestBreak = useMemo(() => {
    const breaks = [...analyticsMap.values()].flatMap((entry) =>
      entry.chainBreaks.map((breakpoint) => ({
        anchorHabitId: entry.anchorHabitId,
        ...breakpoint,
      })),
    );
    return breaks.sort((left, right) => right.dropOff - left.dropOff)[0] ?? null;
  }, [analyticsMap]);

  const draftStepHabits = draft.habitIds
    .map((habitId) => habitMap.get(habitId))
    .filter(Boolean) as Habit[];

  const availableStepHabits = habits.filter((habit) => !draft.habitIds.includes(habit.id));

  const openCreate = useCallback(() => {
    setDraft({
      visible: true,
      mode: 'create',
      originalAnchorId: null,
      habitIds: habits.slice(0, Math.min(2, habits.length)).map((habit) => habit.id),
    });
  }, [habits]);

  const openSuggestion = useCallback((suggestion: HabitStackSuggestion) => {
    setDraft({
      visible: true,
      mode: 'create',
      originalAnchorId: null,
      habitIds: suggestion.habitIds,
    });
  }, []);

  const openEdit = useCallback((stack: HabitStackRecord) => {
    setDraft({
      visible: true,
      mode: 'edit',
      originalAnchorId: stack.anchorHabitId,
      habitIds: stack.habitIds,
    });
  }, []);

  const closeDraft = useCallback(() => {
    setDraft(EMPTY_DRAFT);
  }, []);

  const setAnchorHabit = useCallback((habitId: string) => {
    setDraft((current) => {
      const nextIds = [habitId, ...current.habitIds.filter((id) => id !== habitId)];
      return { ...current, habitIds: nextIds };
    });
  }, []);

  const addStep = useCallback((habitId: string) => {
    setDraft((current) => ({
      ...current,
      habitIds: [...current.habitIds, habitId],
    }));
  }, []);

  const removeStep = useCallback((habitId: string) => {
    setDraft((current) => ({
      ...current,
      habitIds: current.habitIds.filter((id) => id !== habitId),
    }));
  }, []);

  const saveDraft = useCallback(() => {
    try {
      if (draft.habitIds.length < 2) {
        Alert.alert('Add more habits', 'Choose at least two habits to form a stack.');
        return;
      }

      if (draft.mode === 'edit' && draft.originalAnchorId) {
        updateHabitStack(db, draft.originalAnchorId, { habitIds: draft.habitIds });
      } else {
        createHabitStack(db, { habitIds: draft.habitIds });
      }

      setRefreshKey((value) => value + 1);
      closeDraft();
    } catch (error) {
      Alert.alert(
        'Could not save stack',
        error instanceof Error ? error.message : 'Please try again.',
      );
    }
  }, [closeDraft, db, draft]);

  const confirmDelete = useCallback((stack: HabitStackRecord) => {
    Alert.alert(
      'Delete stack?',
      'This removes the links between these habits but keeps the habits themselves.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteHabitStack(db, stack.anchorHabitId);
              setRefreshKey((value) => value + 1);
            } catch (error) {
              Alert.alert(
                'Could not delete stack',
                error instanceof Error ? error.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }, [db]);

  const renderDraftStep = useCallback(
    ({ item, drag, isActive }: RenderItemParams<Habit>) => (
      <ScaleDecorator>
        <Pressable
          delayLongPress={150}
          onLongPress={drag}
          style={[styles.draftRow, isActive ? styles.draftRowActive : null]}
        >
          <View style={styles.draftRowLeft}>
            <View style={styles.draftHandle}>
              <RNText style={styles.draftHandleText}>::</RNText>
            </View>
            <View style={styles.stepBubble}>
              <RNText style={styles.stepEmoji}>{item.icon ?? '•'}</RNText>
            </View>
            <View style={styles.draftCopy}>
              <RNText style={styles.draftName}>{item.name}</RNText>
              <RNText style={styles.draftMeta}>
                {item.timeOfDay === 'anytime' ? 'Anytime' : item.timeOfDay}
              </RNText>
            </View>
          </View>

          <Pressable
            onPress={() => removeStep(item.id)}
            hitSlop={10}
            style={styles.removeButton}
          >
            <MaterialSymbol name="close" size={18} color={HB_TEXT_TERTIARY} />
          </Pressable>
        </Pressable>
      </ScaleDecorator>
    ),
    [removeStep],
  );

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View>
            <RNText style={styles.eyebrow}>STACK HABITS</RNText>
            <RNText style={styles.screenTitle}>Habit Stacking</RNText>
          </View>
          <Pressable onPress={openCreate} style={styles.headerAction}>
            <MaterialSymbol name="add" size={18} color={HB_TEXT} />
            <RNText style={styles.headerActionText}>Add Stack</RNText>
          </Pressable>
        </View>

        <GlassCard
          level={2}
          contentStyle={styles.heroCard}
          style={styles.heroShell}
        >
          <LinearGradient
            colors={[withAlpha(HB_ACCENT, 0.24), withAlpha(HB_ACCENT_LIGHT, 0.04)]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGlow}
          />
          <RNText style={styles.heroEyebrow}>STACK HABITS</RNText>
          <RNText style={styles.heroTitle}>Chain Them Together</RNText>
          <RNText style={styles.heroBody}>
            After I [existing habit], I will [new habit]. Build one obvious sequence,
            then let repetition do the hard part.
          </RNText>

          <View style={styles.formulaCard}>
            <MaterialSymbol name="link" size={18} color={HB_ACCENT_LIGHT} />
            <RNText style={styles.formulaText}>
              After I <RNText style={styles.formulaAccent}>finish a cue</RNText>, I will
              <RNText style={styles.formulaAccent}> start the next habit</RNText>.
            </RNText>
          </View>

          <View style={styles.heroStats}>
            <HeroMetric label="Active stacks" value={String(stacks.length)} />
            <HeroMetric label="Suggestions" value={String(stackSuggestions.length)} />
            <HeroMetric
              label="Best chain"
              value={strongestStack ? `${strongestStack.completionRate}%` : '--'}
            />
          </View>
        </GlassCard>

        <View style={styles.sectionRow}>
          <RNText style={styles.sectionTitle}>Your stacks</RNText>
          <RNText style={styles.sectionHint}>Tap a step to open the habit.</RNText>
        </View>

        {stackCards.length === 0 ? (
          <GlassCard level={1} contentStyle={styles.emptyCard}>
            <MaterialSymbol name="link" size={28} color={HB_ACCENT_LIGHT} />
            <RNText style={styles.emptyTitle}>No stacks yet</RNText>
            <RNText style={styles.emptyBody}>
              Start with two habits that already happen in the same time window.
            </RNText>
            <Pressable onPress={openCreate} style={styles.secondaryButton}>
              <RNText style={styles.secondaryButtonText}>Create your first stack</RNText>
            </Pressable>
          </GlassCard>
        ) : (
          stackCards.map(({ stack, habits: stackHabits, analytics }) => (
            <GlassCard key={stack.id} level={1} contentStyle={styles.stackCard}>
              <View style={styles.stackCardHeader}>
                <View style={styles.stackCardHeading}>
                  <RNText style={styles.stackLabel}>Stack chain</RNText>
                  <RNText style={styles.stackTitle}>
                    {stackHabits[0]?.name ?? 'Untitled stack'}
                  </RNText>
                  <RNText style={styles.stackSubtitle}>
                    {stackHabits.length} habits linked together
                  </RNText>
                </View>

                <View style={styles.stackHeaderStats}>
                  <RNText style={styles.stackRate}>
                    {analytics ? `${analytics.completionRate}%` : '--'}
                  </RNText>
                  <RNText style={styles.stackRateLabel}>completion</RNText>
                </View>
              </View>

              <View style={styles.chainColumn}>
                {stackHabits.map((habit, index) => (
                  <View key={habit.id}>
                    <Pressable
                      onPress={() => router.push({
                        pathname: '/(habits)/[id]',
                        params: { id: habit.id },
                      })}
                      style={styles.chainRow}
                    >
                      <View style={styles.chainMarkerColumn}>
                        <View style={styles.chainMarker} />
                        {index < stackHabits.length - 1 ? <View style={styles.chainLine} /> : null}
                      </View>
                      <View style={styles.chainInfoCard}>
                        <View style={styles.chainInfoLeft}>
                          <RNText style={styles.chainEmoji}>{habit.icon ?? '•'}</RNText>
                          <View style={styles.chainCopy}>
                            <RNText style={styles.chainName}>{habit.name}</RNText>
                            <RNText style={styles.chainMeta}>
                              {index === 0 ? 'Anchor habit' : `Step ${index + 1}`}
                            </RNText>
                          </View>
                        </View>
                        <MaterialSymbol name="chevron_right" size={18} color={HB_TEXT_TERTIARY} />
                      </View>
                    </Pressable>
                    {index < stackHabits.length - 1 ? (
                      <View style={styles.arrowLabelRow}>
                        <MaterialSymbol name="link" size={14} color={HB_ACCENT_LIGHT} />
                        <RNText style={styles.arrowLabel}>then</RNText>
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>

              <View style={styles.analyticsRow}>
                <MetricCard
                  label="Stack depth"
                  value={String(stackHabits.length)}
                  tone={withAlpha(HB_ACCENT, 0.24)}
                />
                <MetricCard
                  label="Break risk"
                  value={analytics?.chainBreaks[0] ? `${analytics.chainBreaks[0].dropOff}` : '0'}
                  tone={withAlpha(HB_STREAK.fire, 0.24)}
                />
              </View>

              <View style={styles.stackActions}>
                <Pressable onPress={() => openEdit(stack)} style={styles.inlineAction}>
                  <MaterialSymbol name="edit" size={16} color={HB_TEXT} />
                  <RNText style={styles.inlineActionText}>Edit chain</RNText>
                </Pressable>
                <Pressable onPress={() => confirmDelete(stack)} style={styles.inlineAction}>
                  <MaterialSymbol name="delete" size={16} color={HB_TEXT_TERTIARY} />
                  <RNText style={[styles.inlineActionText, styles.inlineDanger]}>Delete</RNText>
                </Pressable>
              </View>
            </GlassCard>
          ))
        )}

        <View style={styles.sectionRow}>
          <RNText style={styles.sectionTitle}>Suggestions</RNText>
          <RNText style={styles.sectionHint}>Generated from your current habit list.</RNText>
        </View>

        {stackSuggestions.map((suggestion) => (
          <GlassCard key={suggestion.id} level={1} contentStyle={styles.suggestionCard}>
            <View style={styles.suggestionHeader}>
              <View style={styles.suggestionTitleWrap}>
                <MaterialSymbol name="psychology" size={18} color={HB_ACCENT_LIGHT} />
                <RNText style={styles.suggestionTitle}>{suggestion.title}</RNText>
              </View>
              <RNText style={styles.confidenceBadge}>{suggestion.confidence}% match</RNText>
            </View>
            <RNText style={styles.suggestionBody}>{suggestion.description}</RNText>
            <View style={styles.suggestionPills}>
              {suggestion.habitNames.map((name) => (
                <View key={name} style={styles.suggestionPill}>
                  <RNText style={styles.suggestionPillText}>{name}</RNText>
                </View>
              ))}
            </View>
            <Pressable onPress={() => openSuggestion(suggestion)} style={styles.suggestionButton}>
              <RNText style={styles.suggestionButtonText}>Use suggestion</RNText>
            </Pressable>
          </GlassCard>
        ))}

        <View style={styles.sectionRow}>
          <RNText style={styles.sectionTitle}>Stack analytics</RNText>
          <RNText style={styles.sectionHint}>Spot the strongest chains and weak links.</RNText>
        </View>

        <View style={styles.analyticsGrid}>
          <GlassCard level={1} contentStyle={styles.analyticsCard}>
            <RNText style={styles.analyticsLabel}>Highest completion</RNText>
            <RNText style={styles.analyticsValue}>
              {strongestStack ? `${strongestStack.completionRate}%` : '--'}
            </RNText>
            <RNText style={styles.analyticsBody}>
              {strongestStack
                ? getHabitById(db, strongestStack.anchorHabitId)?.name ?? 'Active stack'
                : 'Create a stack to start measuring consistency.'}
            </RNText>
          </GlassCard>

          <GlassCard level={1} contentStyle={styles.analyticsCard}>
            <RNText style={styles.analyticsLabel}>Chain break analysis</RNText>
            <RNText style={styles.analyticsValue}>
              {biggestBreak ? `${biggestBreak.dropOff}` : '--'}
            </RNText>
            <RNText style={styles.analyticsBody}>
              {biggestBreak
                ? `${habitMap.get(biggestBreak.habitId)?.name ?? 'Step'} is the biggest drop-off.`
                : 'No breakpoints yet. Once you complete a stack, the weak step will show here.'}
            </RNText>
          </GlassCard>
        </View>
      </ScrollView>

      <Modal
        animationType="slide"
        visible={draft.visible}
        transparent
        onRequestClose={closeDraft}
      >
        <Pressable onPress={closeDraft} style={styles.modalBackdrop}>
          <Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}>
            <View style={styles.modalHeader}>
              <View>
                <RNText style={styles.modalEyebrow}>
                  {draft.mode === 'edit' ? 'EDIT CHAIN' : 'NEW STACK'}
                </RNText>
                <RNText style={styles.modalTitle}>
                  {draft.mode === 'edit' ? 'Refine your sequence' : 'Build a habit stack'}
                </RNText>
              </View>
              <Pressable onPress={closeDraft}>
                <MaterialSymbol name="close" size={20} color={HB_TEXT_TERTIARY} />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalScroll}
              contentContainerStyle={styles.modalContent}
              showsVerticalScrollIndicator={false}
            >
              <GlassCard level={1} contentStyle={styles.builderSection}>
                <RNText style={styles.builderLabel}>Anchor habit</RNText>
                <RNText style={styles.builderHint}>
                  Pick the cue that already happens reliably.
                </RNText>
                <View style={styles.choiceWrap}>
                  {habits.map((habit) => (
                    <Pressable
                      key={habit.id}
                      onPress={() => setAnchorHabit(habit.id)}
                      style={[
                        styles.choiceChip,
                        draft.habitIds[0] === habit.id ? styles.choiceChipActive : null,
                      ]}
                    >
                      <RNText
                        style={[
                          styles.choiceText,
                          draft.habitIds[0] === habit.id ? styles.choiceTextActive : null,
                        ]}
                      >
                        {habit.icon ?? '•'} {habit.name}
                      </RNText>
                    </Pressable>
                  ))}
                </View>
              </GlassCard>

              <GlassCard level={1} contentStyle={styles.builderSection}>
                <RNText style={styles.builderLabel}>Then I will...</RNText>
                <RNText style={styles.builderHint}>
                  Drag to reorder. Remove anything that makes the chain feel heavy.
                </RNText>

                <DraggableFlatList
                  data={draftStepHabits}
                  keyExtractor={(item) => item.id}
                  renderItem={renderDraftStep}
                  onDragEnd={({ data }) =>
                    setDraft((current) => ({ ...current, habitIds: data.map((habit) => habit.id) }))
                  }
                  scrollEnabled={false}
                  activationDistance={10}
                  containerStyle={styles.dragList}
                />

                {availableStepHabits.length > 0 ? (
                  <>
                    <RNText style={styles.builderSubLabel}>Add more steps</RNText>
                    <View style={styles.choiceWrap}>
                      {availableStepHabits.map((habit) => (
                        <Pressable
                          key={habit.id}
                          onPress={() => addStep(habit.id)}
                          style={styles.choiceChip}
                        >
                          <RNText style={styles.choiceText}>
                            {habit.icon ?? '•'} {habit.name}
                          </RNText>
                        </Pressable>
                      ))}
                    </View>
                  </>
                ) : null}

                <Pressable
                  onPress={() => {
                    closeDraft();
                    router.push('/(habits)/add-habit');
                  }}
                  style={styles.addHabitLink}
                >
                  <MaterialSymbol name="add" size={16} color={HB_ACCENT_LIGHT} />
                  <RNText style={styles.addHabitLinkText}>Create a new habit</RNText>
                </Pressable>
              </GlassCard>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable onPress={closeDraft} style={styles.footerGhostButton}>
                <RNText style={styles.footerGhostText}>Cancel</RNText>
              </Pressable>
              <Pressable onPress={saveDraft} style={styles.footerPrimaryButton}>
                <LinearGradient
                  colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.footerPrimaryGradient}
                >
                  <RNText style={styles.footerPrimaryText}>
                    {draft.mode === 'edit' ? 'Save changes' : 'Create stack'}
                  </RNText>
                </LinearGradient>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroMetric}>
      <RNText style={styles.heroMetricValue}>{value}</RNText>
      <RNText style={styles.heroMetricLabel}>{label}</RNText>
    </View>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: string;
}) {
  return (
    <View style={[styles.metricCard, { backgroundColor: tone }]}>
      <RNText style={styles.metricCardValue}>{value}</RNText>
      <RNText style={styles.metricCardLabel}>{label}</RNText>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 140,
    gap: 18,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  screenTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    marginTop: 6,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.2),
  },
  headerActionText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
  heroShell: {
    shadowColor: HB_ACCENT_GLOW,
    shadowOpacity: 0.22,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 12 },
    elevation: 14,
  },
  heroCard: {
    gap: 16,
    overflow: 'hidden',
  },
  heroGlow: {
    ...StyleSheet.absoluteFillObject,
  },
  heroEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
    maxWidth: '90%',
  },
  heroBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 15,
    lineHeight: 24,
    color: HB_TEXT_SECONDARY,
    maxWidth: '92%',
  },
  formulaCard: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_SURFACES.lowest, 0.6),
  },
  formulaText: {
    flex: 1,
    fontFamily: HB_FONTS.medium,
    fontSize: 14,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  formulaAccent: {
    color: HB_TEXT,
    fontFamily: HB_FONTS.bold,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 12,
  },
  heroMetric: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_SURFACES.lowest, 0.42),
    gap: 4,
  },
  heroMetricValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 22,
    lineHeight: 28,
    color: HB_TEXT,
  },
  heroMetricLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
  },
  sectionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'flex-end',
  },
  sectionTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: HB_TEXT,
  },
  sectionHint: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
    maxWidth: '46%',
    textAlign: 'right',
  },
  emptyCard: {
    gap: 12,
    alignItems: 'flex-start',
  },
  emptyTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: HB_TEXT,
  },
  emptyBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  secondaryButton: {
    marginTop: 6,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
  },
  secondaryButtonText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
  stackCard: {
    gap: 16,
  },
  stackCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 16,
  },
  stackCardHeading: {
    flex: 1,
    gap: 4,
  },
  stackLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  stackTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
    color: HB_TEXT,
  },
  stackSubtitle: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 20,
    color: HB_TEXT_SECONDARY,
  },
  stackHeaderStats: {
    minWidth: 70,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  stackRate: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: HB_ACCENT_LIGHT,
  },
  stackRateLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: HB_TEXT_TERTIARY,
  },
  chainColumn: {
    gap: 6,
  },
  chainRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chainMarkerColumn: {
    alignItems: 'center',
    width: 20,
  },
  chainMarker: {
    width: 12,
    height: 12,
    borderRadius: 999,
    backgroundColor: HB_ACCENT_LIGHT,
    marginTop: 16,
    shadowColor: HB_ACCENT_GLOW,
    shadowOpacity: 0.55,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  chainLine: {
    width: 2,
    flex: 1,
    marginTop: 8,
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.3),
  },
  chainInfoCard: {
    flex: 1,
    minHeight: 56,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_GLASS.backgroundColor, 0.96),
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  chainInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  chainEmoji: {
    fontSize: 22,
  },
  chainCopy: {
    flex: 1,
  },
  chainName: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: HB_TEXT,
  },
  chainMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_TERTIARY,
    marginTop: 2,
  },
  arrowLabelRow: {
    marginLeft: 34,
    marginTop: 2,
    marginBottom: 2,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  arrowLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: HB_TEXT_TERTIARY,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  analyticsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  metricCard: {
    flex: 1,
    padding: 14,
    borderRadius: 16,
    gap: 4,
  },
  metricCardValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 20,
    lineHeight: 24,
    color: HB_TEXT,
  },
  metricCardLabel: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT_SECONDARY,
  },
  stackActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  inlineActionText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
  inlineDanger: {
    color: HB_TEXT_TERTIARY,
  },
  suggestionCard: {
    gap: 12,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  suggestionTitleWrap: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    flex: 1,
  },
  suggestionTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 17,
    lineHeight: 22,
    color: HB_TEXT,
  },
  confidenceBadge: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: HB_TEXT,
    backgroundColor: withAlpha(HB_ACCENT, 0.24),
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
  },
  suggestionBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 21,
    color: HB_TEXT_SECONDARY,
  },
  suggestionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  suggestionPill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.82),
  },
  suggestionPillText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    color: HB_TEXT,
  },
  suggestionButton: {
    alignSelf: 'flex-start',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_ACCENT, 0.2),
  },
  suggestionButtonText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_TEXT,
  },
  analyticsGrid: {
    gap: 12,
  },
  analyticsCard: {
    gap: 8,
  },
  analyticsLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  analyticsValue: {
    fontFamily: HB_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
    color: HB_TEXT,
  },
  analyticsBody: {
    fontFamily: HB_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: HB_TEXT_SECONDARY,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.64)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    maxHeight: '92%',
    backgroundColor: HB_SURFACES.base,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },
  modalEyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  modalTitle: {
    fontFamily: HB_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
    color: HB_TEXT,
    marginTop: 6,
  },
  modalScroll: {
    flex: 1,
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 14,
  },
  builderSection: {
    gap: 14,
  },
  builderLabel: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: HB_TEXT,
  },
  builderHint: {
    fontFamily: HB_FONTS.regular,
    fontSize: 13,
    lineHeight: 19,
    color: HB_TEXT_SECONDARY,
  },
  builderSubLabel: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
    color: HB_TEXT,
  },
  choiceWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  choiceChip: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.78),
  },
  choiceChipActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.3),
    shadowColor: HB_ACCENT_GLOW,
    shadowOpacity: 0.32,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  choiceText: {
    fontFamily: HB_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: HB_TEXT,
  },
  choiceTextActive: {
    fontFamily: HB_FONTS.semiBold,
  },
  dragList: {
    gap: 10,
  },
  draftRow: {
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.76),
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  draftRowActive: {
    backgroundColor: withAlpha(HB_ACCENT, 0.26),
  },
  draftRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  draftHandle: {
    width: 20,
    alignItems: 'center',
  },
  draftHandleText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 16,
    color: HB_TEXT_TERTIARY,
  },
  stepBubble: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT, 0.18),
  },
  stepEmoji: {
    fontSize: 18,
  },
  draftCopy: {
    flex: 1,
  },
  draftName: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: HB_TEXT,
  },
  draftMeta: {
    fontFamily: HB_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: HB_TEXT_TERTIARY,
    marginTop: 2,
    textTransform: 'capitalize',
  },
  removeButton: {
    padding: 6,
  },
  addHabitLink: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 6,
  },
  addHabitLinkText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 13,
    color: HB_ACCENT_LIGHT,
  },
  modalFooter: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 28,
    backgroundColor: withAlpha(HB_SURFACES.lowest, 0.4),
  },
  footerGhostButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 18,
    minHeight: 54,
    backgroundColor: withAlpha(HB_SURFACES.high, 0.72),
  },
  footerGhostText: {
    fontFamily: HB_FONTS.semiBold,
    fontSize: 14,
    color: HB_TEXT_SECONDARY,
  },
  footerPrimaryButton: {
    flex: 1.2,
    borderRadius: 18,
    overflow: 'hidden',
    shadowColor: HB_ACCENT_GLOW,
    shadowOpacity: 0.32,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 12,
  },
  footerPrimaryGradient: {
    minHeight: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerPrimaryText: {
    fontFamily: HB_FONTS.bold,
    fontSize: 14,
    color: '#120B26',
  },
});
