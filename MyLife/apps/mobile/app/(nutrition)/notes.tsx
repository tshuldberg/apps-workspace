import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import {
  deleteDailyNote,
  getDailyNotes,
  getFoodById,
  getFoodLogEntries,
  getFoodLogItems,
  GlassCard,
  MaterialSymbol,
  NU_ACCENT,
  NU_ACCENT_DARK,
  NU_ACCENT_LIGHT,
  NU_FONT_MEDIUM,
  NU_FONT_REGULAR,
  NU_FONT_SEMIBOLD,
  NU_SURFACES,
  NU_TEXT,
  NU_TEXT_SECONDARY,
  NU_TEXT_TERTIARY,
  searchFoods,
  searchFoodsFTS,
  searchNotes,
  upsertDailyNote,
  type DailyNote,
  type Food,
  type MealType,
  type NoteSearchResult,
} from '@mylife/nutrition';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';
import {
  NutritionBottomSheet,
  NutritionChip,
  NutritionEmptyState,
  NutritionFieldLabel,
  NutritionHeaderBar,
  NutritionHero,
  NutritionIconButton,
  NutritionInput,
  NutritionPrimaryButton,
  NutritionScrollScreen,
  NutritionSearchField,
  NutritionSecondaryButton,
  NutritionSectionTitle,
  useDebouncedValue,
} from './phase3-kit';

type NoteEditorDraft = {
  originalDate: string | null;
  date: string;
  content: string;
  tags: string[];
  mealTypes: MealType[];
  linkedFoodIds: string[];
};

type NoteContext = {
  linkedFoodNames: string[];
  mealTypes: MealType[];
};

const NOTE_TAGS = ['Energizing', 'Heavy', 'Bloated', 'Satisfied', 'Hungry', 'Mood-boost', 'Crash'];

const MEAL_OPTIONS: { key: MealType; label: string }[] = [
  { key: 'breakfast', label: 'Breakfast' },
  { key: 'lunch', label: 'Lunch' },
  { key: 'dinner', label: 'Dinner' },
  { key: 'snack', label: 'Snack' },
];

const EMPTY_EDITOR_DRAFT: NoteEditorDraft = {
  originalDate: null,
  date: todayIso(),
  content: '',
  tags: [],
  mealTypes: [],
  linkedFoodIds: [],
};

export default function NotesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [activeTag, setActiveTag] = useState<string>('All');
  const [expandedDates, setExpandedDates] = useState<Record<string, boolean>>({});
  const [editorVisible, setEditorVisible] = useState(false);
  const [editorDraft, setEditorDraft] = useState<NoteEditorDraft>(EMPTY_EDITOR_DRAFT);
  const [foodSearchText, setFoodSearchText] = useState('');

  const debouncedQuery = useDebouncedValue(queryText, 200);
  const debouncedFoodSearch = useDebouncedValue(foodSearchText, 200);

  const notes = useMemo(() => {
    try {
      return getDailyNotes(db, { limit: 120 });
    } catch {
      return [] as DailyNote[];
    }
  }, [db, tick]);

  const noteContext = useMemo(() => {
    const map = new Map<string, NoteContext>();

    for (const note of notes) {
      const explicitFoods = (note.linkedFoodIds ?? [])
        .map((foodId) => getFoodById(db, foodId)?.name)
        .filter((name): name is string => typeof name === 'string');

      const foodLogEntries = getFoodLogEntries(db, note.date);
      const derivedMealTypes = Array.from(
        new Set(foodLogEntries.map((entry) => entry.mealType)),
      ) as MealType[];

      const derivedFoods = foodLogEntries.flatMap((entry) =>
        getFoodLogItems(db, entry.id)
          .map((item) => getFoodById(db, item.foodId)?.name)
          .filter((name): name is string => typeof name === 'string'),
      );

      map.set(note.date, {
        linkedFoodNames: uniqueStrings(explicitFoods.length > 0 ? explicitFoods : derivedFoods).slice(0, 4),
        mealTypes: uniqueMealTypes(note.mealTypes ?? derivedMealTypes),
      });
    }

    return map;
  }, [db, notes, tick]);

  const filteredNotes = useMemo(() => {
    const query = debouncedQuery.trim().toLowerCase();

    return notes.filter((note) => {
      const matchesTag = activeTag === 'All' || (note.tags ?? []).includes(activeTag);
      if (!matchesTag) {
        return false;
      }

      if (!query) {
        return true;
      }

      const context = noteContext.get(note.date);
      const haystack = [
        note.content,
        ...(note.tags ?? []),
        ...(context?.linkedFoodNames ?? []),
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [activeTag, debouncedQuery, noteContext, notes]);

  const mealNoteMatches = useMemo(() => {
    if (!debouncedQuery.trim()) {
      return [] as NoteSearchResult[];
    }

    try {
      return searchNotes(db, debouncedQuery).filter((result) => result.source === 'meal');
    } catch {
      return [] as NoteSearchResult[];
    }
  }, [db, debouncedQuery]);

  const foodSearchResults = useMemo(() => {
    if (!editorVisible || !debouncedFoodSearch.trim()) {
      return [] as Food[];
    }

    try {
      const ftsResults = searchFoodsFTS(db, debouncedFoodSearch, 16);
      if (ftsResults.length > 0) {
        return ftsResults;
      }
      return searchFoods(db, debouncedFoodSearch, 16);
    } catch {
      return [] as Food[];
    }
  }, [db, debouncedFoodSearch, editorVisible]);

  const insightCopy = useMemo(() => buildInsightCopy(filteredNotes, noteContext, activeTag), [activeTag, filteredNotes, noteContext]);

  const refresh = useCallback(() => setTick((value) => value + 1), []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setRefreshing(false);
  }, [refresh]);

  const openNewNote = useCallback(() => {
    setFoodSearchText('');
    setEditorDraft({
      ...EMPTY_EDITOR_DRAFT,
      date: todayIso(),
    });
    setEditorVisible(true);
  }, []);

  const openExistingNote = useCallback(
    (note: DailyNote) => {
      setFoodSearchText('');
      setEditorDraft({
        originalDate: note.date,
        date: note.date,
        content: note.content,
        tags: [...(note.tags ?? [])],
        mealTypes: [...(note.mealTypes ?? noteContext.get(note.date)?.mealTypes ?? [])],
        linkedFoodIds: [...(note.linkedFoodIds ?? [])],
      });
      setEditorVisible(true);
    },
    [noteContext],
  );

  const closeEditor = useCallback(() => {
    setEditorVisible(false);
    setEditorDraft(EMPTY_EDITOR_DRAFT);
    setFoodSearchText('');
  }, []);

  const handleSaveNote = useCallback(() => {
    if (!editorDraft.content.trim()) {
      Alert.alert('Note required', 'Write a journal note before saving.');
      return;
    }

    try {
      if (editorDraft.originalDate != null && editorDraft.originalDate !== editorDraft.date) {
        deleteDailyNote(db, editorDraft.originalDate);
      }

      upsertDailyNote(db, uuid(), {
        date: editorDraft.date,
        content: editorDraft.content.trim(),
        tags: editorDraft.tags,
        mealTypes: editorDraft.mealTypes,
        linkedFoodIds: editorDraft.linkedFoodIds,
      });
      refresh();
      closeEditor();
    } catch {
      Alert.alert('Save failed', 'Could not save this food journal entry.');
    }
  }, [closeEditor, db, editorDraft, refresh]);

  const handleDeleteNote = useCallback(() => {
    if (editorDraft.originalDate == null) {
      closeEditor();
      return;
    }

    Alert.alert('Delete note', 'This will remove the food journal entry for that date.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteDailyNote(db, editorDraft.originalDate!);
            refresh();
            closeEditor();
          } catch {
            Alert.alert('Delete failed', 'Could not delete this note.');
          }
        },
      },
    ]);
  }, [closeEditor, db, editorDraft.originalDate, refresh]);

  const toggleExpanded = useCallback((date: string) => {
    setExpandedDates((current) => ({
      ...current,
      [date]: !current[date],
    }));
  }, []);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />

      <NutritionScrollScreen
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={NU_ACCENT} />}
      >
        <NutritionHeaderBar
          title="Food Journal"
          onBack={() => router.back()}
          action={<NutritionIconButton icon="add" label="Add" onPress={openNewNote} />}
        />

        <NutritionHero
          eyebrow="REFLECTIONS"
          title="Food Journal"
          subtitle="How did your meals make you feel?"
          icon="edit_note"
        />

        <NutritionSearchField
          value={queryText}
          onChangeText={setQueryText}
          placeholder="Search notes, tags, or linked foods..."
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRail}
        >
          {['All', ...NOTE_TAGS].map((tag) => (
            <NutritionChip
              key={tag}
              label={tag}
              selected={activeTag === tag}
              onPress={() => setActiveTag(tag)}
            />
          ))}
        </ScrollView>

        <NutritionSectionTitle title="Daily Notes" />

        {filteredNotes.length === 0 ? (
          <NutritionEmptyState
            icon="edit_note"
            title="Start journaling your meals"
            body="Capture how your meals affected your energy, hunger, and mood so patterns are easier to spot."
            action={<NutritionPrimaryButton label="Add food journal note" icon="add" onPress={openNewNote} />}
          />
        ) : (
          filteredNotes.map((note) => {
            const context = noteContext.get(note.date);
            const expanded = expandedDates[note.date] ?? false;
            return (
              <View key={note.date} style={styles.noteSection}>
                <NutritionSectionTitle title={formatDateLabel(note.date)} />
                <GlassCard style={styles.noteCard}>
                  <Pressable onPress={() => toggleExpanded(note.date)} style={styles.noteHeader}>
                    <View style={styles.noteHeaderCopy}>
                      <Text style={styles.noteTime}>{formatTimeLabel(note.updatedAt)}</Text>
                      <View style={styles.noteMetaWrap}>
                        {(context?.mealTypes ?? []).map((mealType) => (
                          <View key={mealType} style={styles.mealChip}>
                            <Text style={styles.mealChipLabel}>{labelForMealType(mealType)}</Text>
                          </View>
                        ))}
                        {(note.tags ?? []).map((tag) => (
                          <View key={tag} style={styles.tagChip}>
                            <Text style={styles.tagChipLabel}>{tag}</Text>
                          </View>
                        ))}
                      </View>
                    </View>
                    <MaterialSymbol
                      name={expanded ? 'expand_less' : 'expand_more'}
                      size={20}
                      color={NU_TEXT_TERTIARY}
                    />
                  </Pressable>

                  <Text
                    style={styles.noteBody}
                    numberOfLines={expanded ? undefined : 3}
                  >
                    {note.content}
                  </Text>

                  <View style={styles.noteFooter}>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.linkedFoodsRail}>
                      {(context?.linkedFoodNames ?? []).map((foodName) => (
                        <View key={foodName} style={styles.foodChip}>
                          <Text style={styles.foodChipLabel}>{foodName}</Text>
                        </View>
                      ))}
                    </ScrollView>

                    <View style={styles.noteActions}>
                      <Pressable onPress={() => openExistingNote(note)} style={styles.noteActionButton}>
                        <MaterialSymbol name="edit" size={16} color={NU_TEXT_SECONDARY} />
                      </Pressable>
                      <Pressable
                        onPress={() => {
                          Alert.alert('Delete note', 'Remove this food journal entry?', [
                            { text: 'Cancel', style: 'cancel' },
                            {
                              text: 'Delete',
                              style: 'destructive',
                              onPress: () => {
                                try {
                                  deleteDailyNote(db, note.date);
                                  refresh();
                                } catch {
                                  Alert.alert('Delete failed', 'Could not remove this note.');
                                }
                              },
                            },
                          ]);
                        }}
                        style={styles.noteActionButton}
                      >
                        <MaterialSymbol name="delete" size={16} color="#FFB4AB" />
                      </Pressable>
                    </View>
                  </View>
                </GlassCard>
              </View>
            );
          })
        )}

        {mealNoteMatches.length > 0 ? (
          <GlassCard style={styles.mealMatchesCard}>
            <Text style={styles.metaEyebrow}>MEAL LOG MATCHES</Text>
            <View style={styles.mealMatchList}>
              {mealNoteMatches.slice(0, 6).map((result, index) => (
                <View key={`${result.date}-${index}`} style={styles.mealMatchRow}>
                  <View style={styles.mealMatchCopy}>
                    <Text style={styles.mealMatchTitle}>
                      {formatDateLabel(result.date)}
                      {result.mealType ? ` • ${labelForMealType(result.mealType as MealType)}` : ''}
                    </Text>
                    <Text style={styles.mealMatchSnippet}>{result.snippet}</Text>
                  </View>
                </View>
              ))}
            </View>
          </GlassCard>
        ) : null}

        <GlassCard style={styles.insightCard}>
          <Text style={styles.metaEyebrow}>PATTERN INSIGHT</Text>
          <Text style={styles.insightCopy}>{insightCopy}</Text>
        </GlassCard>
      </NutritionScrollScreen>

      <NutritionBottomSheet
        visible={editorVisible}
        title={editorDraft.originalDate == null ? 'Add Food Journal Note' : 'Edit Food Journal Note'}
        onClose={closeEditor}
      >
        <View>
          <NutritionFieldLabel label="Date" />
          <NutritionInput
            value={editorDraft.date}
            onChangeText={(value) => setEditorDraft((draft) => ({ ...draft, date: value }))}
            placeholder="YYYY-MM-DD"
          />
          <View style={styles.quickDateRail}>
            {buildQuickDates().map((date) => (
              <NutritionChip
                key={date}
                label={quickDateLabel(date)}
                selected={editorDraft.date === date}
                onPress={() => setEditorDraft((draft) => ({ ...draft, date }))}
              />
            ))}
          </View>
        </View>

        <View>
          <NutritionFieldLabel label="Meal moments" />
          <View style={styles.sheetChipWrap}>
            {MEAL_OPTIONS.map((meal) => (
              <NutritionChip
                key={meal.key}
                label={meal.label}
                selected={editorDraft.mealTypes.includes(meal.key)}
                onPress={() =>
                  setEditorDraft((draft) => ({
                    ...draft,
                    mealTypes: toggleStringSelection(draft.mealTypes, meal.key) as MealType[],
                  }))
                }
              />
            ))}
          </View>
        </View>

        <View>
          <NutritionFieldLabel label="Tags" />
          <View style={styles.sheetChipWrap}>
            {NOTE_TAGS.map((tag) => (
              <NutritionChip
                key={tag}
                label={tag}
                selected={editorDraft.tags.includes(tag)}
                onPress={() =>
                  setEditorDraft((draft) => ({
                    ...draft,
                    tags: toggleStringSelection(draft.tags, tag),
                  }))
                }
              />
            ))}
          </View>
        </View>

        <View>
          <NutritionFieldLabel label="Linked foods" />
          <NutritionInput
            value={foodSearchText}
            onChangeText={setFoodSearchText}
            placeholder="Search foods to link..."
          />
          {foodSearchResults.length > 0 ? (
            <View style={styles.foodSearchResults}>
              {foodSearchResults.map((food) => {
                const selected = editorDraft.linkedFoodIds.includes(food.id);
                return (
                  <Pressable
                    key={food.id}
                    onPress={() =>
                      setEditorDraft((draft) => ({
                        ...draft,
                        linkedFoodIds: toggleStringSelection(draft.linkedFoodIds, food.id),
                      }))
                    }
                    style={[styles.foodResultRow, selected ? styles.foodResultRowSelected : null]}
                  >
                    <View style={styles.foodResultCopy}>
                      <Text style={styles.foodResultTitle}>{food.name}</Text>
                      <Text style={styles.foodResultMeta}>
                        {food.brand ? `${food.brand} • ` : ''}
                        {Math.round(food.calories)} kcal
                      </Text>
                    </View>
                    <MaterialSymbol
                      name={selected ? 'check' : 'add'}
                      size={18}
                      color={selected ? NU_ACCENT_DARK : NU_ACCENT_LIGHT}
                      filled={selected}
                    />
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {editorDraft.linkedFoodIds.length > 0 ? (
            <View style={styles.selectedFoodWrap}>
              {editorDraft.linkedFoodIds
                .map((foodId) => getFoodById(db, foodId))
                .filter((food): food is Food => food != null)
                .map((food) => (
                  <View key={food.id} style={styles.foodChip}>
                    <Text style={styles.foodChipLabel}>{food.name}</Text>
                  </View>
                ))}
            </View>
          ) : null}
        </View>

        <View>
          <NutritionFieldLabel label="Journal note" />
          <NutritionInput
            value={editorDraft.content}
            onChangeText={(value) => setEditorDraft((draft) => ({ ...draft, content: value }))}
            placeholder="How did your meals make you feel?"
            multiline
          />
        </View>

        <View style={styles.sheetActionRow}>
          {editorDraft.originalDate != null ? (
            <View style={styles.actionGrow}>
              <NutritionSecondaryButton label="Delete" onPress={handleDeleteNote} />
            </View>
          ) : null}
          <View style={styles.actionGrow}>
            <NutritionSecondaryButton label="Cancel" onPress={closeEditor} />
          </View>
          <View style={styles.actionGrow}>
            <NutritionPrimaryButton label="Save note" icon="check" onPress={handleSaveNote} />
          </View>
        </View>
      </NutritionBottomSheet>
    </>
  );
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildQuickDates(): string[] {
  return Array.from({ length: 4 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - index);
    return date.toISOString().slice(0, 10);
  });
}

function quickDateLabel(date: string): string {
  const today = todayIso();
  if (date === today) {
    return 'Today';
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === yesterday.toISOString().slice(0, 10)) {
    return 'Yesterday';
  }

  return formatDateLabel(date);
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTimeLabel(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Updated recently';
  }

  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function labelForMealType(mealType: MealType): string {
  return MEAL_OPTIONS.find((option) => option.key === mealType)?.label ?? mealType;
}

function toggleStringSelection(list: string[], value: string): string[] {
  return list.includes(value)
    ? list.filter((item) => item !== value)
    : [...list, value];
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values));
}

function uniqueMealTypes(values: MealType[]): MealType[] {
  return Array.from(new Set(values));
}

function buildInsightCopy(
  notes: DailyNote[],
  noteContext: Map<string, NoteContext>,
  activeTag: string,
): string {
  const relevantTag = activeTag === 'All' ? null : activeTag;
  const notePool = relevantTag == null
    ? notes.filter((note) => (note.tags ?? []).length > 0)
    : notes.filter((note) => (note.tags ?? []).includes(relevantTag));

  if (notePool.length === 0) {
    return 'Log a few meals and reflections to start surfacing which foods most often map to your energy and mood patterns.';
  }

  const frequency = new Map<string, number>();

  for (const note of notePool) {
    for (const foodName of noteContext.get(note.date)?.linkedFoodNames ?? []) {
      frequency.set(foodName, (frequency.get(foodName) ?? 0) + 1);
    }
  }

  const topFoods = Array.from(frequency.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([food]) => food);

  if (topFoods.length === 0) {
    return relevantTag == null
      ? 'Most recent notes are saved, but you have not linked foods to them yet. Add linked foods in the editor to generate richer correlations.'
      : `You are tagging entries as ${relevantTag}, but there are no linked foods yet. Add a few linked foods to make the correlation feed more specific.`;
  }

  if (relevantTag != null) {
    return `Foods you tagged "${relevantTag}" most often: ${topFoods.join(', ')}.`;
  }

  return `Most common linked foods across recent notes: ${topFoods.join(', ')}.`;
}

const styles = StyleSheet.create({
  filterRail: {
    gap: 10,
    paddingRight: 20,
  },
  noteSection: {
    gap: 10,
  },
  noteCard: {
    gap: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  noteHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  noteHeaderCopy: {
    flex: 1,
    gap: 8,
  },
  noteTime: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_TERTIARY,
  },
  noteMetaWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  mealChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: `${NU_ACCENT}20`,
  },
  mealChipLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 11,
    color: NU_ACCENT_LIGHT,
  },
  tagChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  tagChipLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 11,
    color: NU_TEXT_SECONDARY,
  },
  noteBody: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 15,
    lineHeight: 22,
    color: NU_TEXT,
  },
  noteFooter: {
    gap: 12,
  },
  linkedFoodsRail: {
    gap: 8,
    paddingRight: 20,
  },
  foodChip: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 184, 119, 0.14)',
  },
  foodChipLabel: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_ACCENT_LIGHT,
  },
  noteActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  noteActionButton: {
    width: 34,
    height: 34,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: NU_SURFACES.mid,
  },
  mealMatchesCard: {
    gap: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  mealMatchList: {
    gap: 12,
  },
  mealMatchRow: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: NU_SURFACES.mid,
  },
  mealMatchCopy: {
    gap: 6,
  },
  mealMatchTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  mealMatchSnippet: {
    fontFamily: NU_FONT_REGULAR,
    fontSize: 13,
    lineHeight: 18,
    color: NU_TEXT_SECONDARY,
  },
  insightCard: {
    gap: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  metaEyebrow: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 10,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: NU_ACCENT_LIGHT,
  },
  insightCopy: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 14,
    lineHeight: 20,
    color: NU_TEXT_SECONDARY,
  },
  quickDateRail: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
    flexWrap: 'wrap',
  },
  sheetChipWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  foodSearchResults: {
    marginTop: 10,
    gap: 8,
  },
  foodResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 18,
    padding: 14,
    backgroundColor: NU_SURFACES.mid,
  },
  foodResultRowSelected: {
    backgroundColor: `${NU_ACCENT}22`,
  },
  foodResultCopy: {
    flex: 1,
    gap: 4,
  },
  foodResultTitle: {
    fontFamily: NU_FONT_SEMIBOLD,
    fontSize: 14,
    color: NU_TEXT,
  },
  foodResultMeta: {
    fontFamily: NU_FONT_MEDIUM,
    fontSize: 12,
    color: NU_TEXT_TERTIARY,
  },
  selectedFoodWrap: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    marginTop: 12,
  },
  sheetActionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionGrow: {
    flex: 1,
  },
});
