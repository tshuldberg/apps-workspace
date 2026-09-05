import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text as RNText,
  TextInput,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import type { WorkoutEquipmentOption } from '../../lib/workouts/settings';
import {
  Chip,
  GlassPanel,
  MaterialSymbol,
  SectionLabel,
  WK_ACCENT_DARK,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  WK_SURFACES,
  WORKOUT_CATEGORIES,
  WORKOUT_DIFFICULTIES,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  getWorkoutCategoryCounts,
  getWorkoutExercises,
  getWorkoutSessions,
  seedWorkoutExerciseLibrary,
  type MuscleGroup,
  type WorkoutCategory,
  type WorkoutDifficulty,
  type WorkoutExerciseLibraryItem,
} from '@mylife/workouts';
import { useDatabase } from './providers/DatabaseProvider';
import {
  getFavoriteWorkoutExercises,
  getWorkoutRecentViews,
  pushWorkoutRecentView,
} from '../../lib/workouts/settings';
import {
  PHASE3_EQUIPMENT_OPTIONS,
  formatCategoryLabel,
  getExerciseAccent,
  getPrimaryMuscle,
  inferExerciseEquipment,
} from '../../lib/workouts/phase3';
import {
  DifficultyStars,
  ExerciseArtwork,
  WorkoutRouteHeader,
} from './phase3-kit';
import { DW_ACCENT } from './theme/tokens';

const SEARCH_DEBOUNCE_MS = 200;

function equipmentLabel(value: WorkoutEquipmentOption): string {
  return PHASE3_EQUIPMENT_OPTIONS.find((item) => item.key === value)?.label ?? value;
}

type ExerciseGridCardProps = {
  exercise: WorkoutExerciseLibraryItem;
  isFavorite: boolean;
  onOpen: (exercise: WorkoutExerciseLibraryItem) => void;
};

const ExerciseGridCard = memo(function ExerciseGridCard({
  exercise,
  isFavorite,
  onOpen,
}: ExerciseGridCardProps) {
  return (
    <GlassPanel padding={0} onPress={() => onOpen(exercise)} style={styles.card}>
      <ExerciseArtwork
        title={exercise.name}
        accent={getExerciseAccent(exercise)}
        uri={exercise.thumbnailUrl}
        height={120}
      />
      <View style={styles.cardCopy}>
        <View style={styles.cardHeader}>
          <RNText style={styles.cardTitle} numberOfLines={2}>
            {exercise.name}
          </RNText>
          {isFavorite ? (
            <MaterialSymbol name="favorite_filled" size={16} color={WK_ACCENT_LIGHT} />
          ) : null}
        </View>
        <View style={styles.cardMeta}>
          <Chip
            label={MUSCLE_GROUP_LABELS[getPrimaryMuscle(exercise) ?? 'full_body']}
            accent={getExerciseAccent(exercise)}
            selected
          />
        </View>
        <DifficultyStars difficulty={exercise.difficulty} />
      </View>
    </GlassPanel>
  );
});

function GridRowSeparator() {
  return <View style={styles.gridSeparator} />;
}

export default function ExercisesScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<WorkoutCategory | null>(null);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [difficultyFilters, setDifficultyFilters] = useState<WorkoutDifficulty[]>([]);
  const [equipmentFilters, setEquipmentFilters] = useState<WorkoutEquipmentOption[]>([]);
  const [hasVideoOnly, setHasVideoOnly] = useState(false);
  const [draftDifficultyFilters, setDraftDifficultyFilters] = useState<WorkoutDifficulty[]>([]);
  const [draftEquipmentFilters, setDraftEquipmentFilters] = useState<WorkoutEquipmentOption[]>([]);
  const [draftHasVideoOnly, setDraftHasVideoOnly] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchDraft.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(timeout);
  }, [searchDraft]);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const state = useMemo(() => {
    try {
      seedWorkoutExerciseLibrary(db);

      const categoryCounts = new Map(
        getWorkoutCategoryCounts(db).map((item) => [item.category, item.count]),
      );
      const favorites = new Set(getFavoriteWorkoutExercises(db));
      const recentViews = getWorkoutRecentViews(db);
      const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 40 });
      const base = getWorkoutExercises(db, {
        search: search || undefined,
        category: selectedCategory,
        muscleGroups: selectedMuscle ? [selectedMuscle] : undefined,
        limit: 400,
      });

      const filtered = base.filter((exercise) => {
        if (difficultyFilters.length > 0 && !difficultyFilters.includes(exercise.difficulty)) {
          return false;
        }

        const inferredEquipment = inferExerciseEquipment(exercise);
        if (
          equipmentFilters.length > 0 &&
          !equipmentFilters.some((item) => inferredEquipment.includes(item))
        ) {
          return false;
        }

        if (hasVideoOnly && !exercise.videoUrl && !exercise.thumbnailUrl) {
          return false;
        }

        return true;
      });

      const lastCompletedExerciseId = sessions
        .flatMap((session) => session.exercisesCompleted)
        .find((exercise) => !exercise.skipped)?.exerciseId;
      const recentExerciseId = recentViews.find((item) => item.type === 'exercise')?.id;
      const heroExercise =
        filtered.find((exercise) => exercise.id === lastCompletedExerciseId) ??
        filtered.find((exercise) => exercise.id === recentExerciseId) ??
        filtered[0] ??
        null;

      const gridExercises = heroExercise
        ? filtered.filter((exercise) => exercise.id !== heroExercise.id)
        : filtered;

      return {
        error: null,
        categoryCounts,
        favorites,
        heroExercise,
        gridExercises,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unable to load the exercise library.',
        categoryCounts: new Map<WorkoutCategory, number>(),
        favorites: new Set<string>(),
        heroExercise: null,
        gridExercises: [] as WorkoutExerciseLibraryItem[],
      };
    }
  }, [
    db,
    difficultyFilters,
    equipmentFilters,
    hasVideoOnly,
    refreshKey,
    search,
    selectedCategory,
    selectedMuscle,
  ]);

  const activeFilterCount =
    difficultyFilters.length + equipmentFilters.length + (hasVideoOnly ? 1 : 0);

  const openExercise = useCallback((exercise: WorkoutExerciseLibraryItem) => {
    const route = `/(root)/exercise/${exercise.id}`;
    pushWorkoutRecentView(db, {
      id: exercise.id,
      type: 'exercise',
      title: exercise.name,
      subtitle: `${formatCategoryLabel(exercise.category)} • ${MUSCLE_GROUP_LABELS[getPrimaryMuscle(exercise) ?? 'full_body']}`,
      route,
      category: exercise.category,
    });
    router.push(route as never);
  }, [db, router]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setRefreshKey((value) => value + 1);
    setTimeout(() => setRefreshing(false), 350);
  }, []);

  const openFilterSheet = () => {
    setDraftDifficultyFilters(difficultyFilters);
    setDraftEquipmentFilters(equipmentFilters);
    setDraftHasVideoOnly(hasVideoOnly);
    setSheetVisible(true);
  };

  const applyFilters = () => {
    setDifficultyFilters(draftDifficultyFilters);
    setEquipmentFilters(draftEquipmentFilters);
    setHasVideoOnly(draftHasVideoOnly);
    setSheetVisible(false);
  };

  const resetDraftFilters = () => {
    setDraftDifficultyFilters([]);
    setDraftEquipmentFilters([]);
    setDraftHasVideoOnly(false);
  };

  const renderGridItem = useCallback(
    ({ item }: { item: WorkoutExerciseLibraryItem }) => (
      <ExerciseGridCard
        exercise={item}
        isFavorite={state.favorites.has(item.id)}
        onOpen={openExercise}
      />
    ),
    [state.favorites, openExercise],
  );

  const keyExtractor = useCallback((item: WorkoutExerciseLibraryItem) => item.id, []);

  const bothEmpty = state.heroExercise == null && state.gridExercises.length === 0;
  const gridData = state.error || bothEmpty ? [] : state.gridExercises;

  const listHeader = (
    <View>
      <WorkoutRouteHeader
        title="Exercise Library"
        overline="Browse"
        onBack={() => router.back()}
        right={(
          <Pressable onPress={openFilterSheet} style={styles.filterButton}>
            <MaterialSymbol name="filter_alt" size={18} color={WK_ACCENT_LIGHT} />
            {activeFilterCount > 0 ? (
              <View style={styles.filterCount}>
                <RNText style={styles.filterCountText}>{activeFilterCount}</RNText>
              </View>
            ) : null}
          </Pressable>
        )}
      />

      <View style={styles.body}>
        <View style={styles.searchRow}>
          <View style={styles.searchWrap}>
            <MaterialSymbol name="search" size={18} color="rgba(214, 195, 181, 0.58)" />
            <TextInput
              value={searchDraft}
              onChangeText={setSearchDraft}
              placeholder="Search exercises..."
              placeholderTextColor="rgba(214, 195, 181, 0.42)"
              style={styles.searchInput}
            />
          </View>
        </View>

        <View style={styles.railBlock}>
          <View style={styles.railHeader}>
            <SectionLabel accent={WK_ACCENT_LIGHT}>Categories</SectionLabel>
            <RNText style={styles.railMeta}>Focus view</RNText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            <Chip
              label="All"
              selected={selectedCategory == null}
              onPress={() => setSelectedCategory(null)}
            />
            {WORKOUT_CATEGORIES.map((category) => (
              <Chip
                key={category}
                label={`${formatCategoryLabel(category)} ${state.categoryCounts.get(category) ?? 0}`}
                selected={selectedCategory === category}
                onPress={() => setSelectedCategory((current) => (current === category ? null : category))}
              />
            ))}
          </ScrollView>
        </View>

        <View style={styles.railBlock}>
          <View style={styles.railHeader}>
            <SectionLabel accent={WK_ACCENT_LIGHT}>Muscle Group</SectionLabel>
            <RNText style={styles.railMeta}>Primary emphasis</RNText>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.rail}>
            <Chip
              label="All"
              selected={selectedMuscle == null}
              onPress={() => setSelectedMuscle(null)}
            />
            {MUSCLE_GROUPS.map((muscle) => (
              <Chip
                key={muscle}
                label={MUSCLE_GROUP_LABELS[muscle]}
                selected={selectedMuscle === muscle}
                onPress={() => setSelectedMuscle((current) => (current === muscle ? null : muscle))}
              />
            ))}
          </ScrollView>
        </View>

        {state.error ? (
          <GlassPanel style={styles.feedbackCard}>
            <RNText style={styles.feedbackTitle}>Library unavailable</RNText>
            <RNText style={styles.feedbackBody}>{state.error}</RNText>
            <Pressable onPress={() => setRefreshKey((value) => value + 1)} style={styles.feedbackButton}>
              <RNText style={styles.feedbackButtonText}>Retry</RNText>
            </Pressable>
          </GlassPanel>
        ) : bothEmpty ? (
          <GlassPanel style={styles.feedbackCard}>
            <RNText style={styles.feedbackTitle}>No exercises match</RNText>
            <RNText style={styles.feedbackBody}>
              Clear a few filters and the catalog will repopulate.
            </RNText>
            <Pressable
              onPress={() => {
                setSearchDraft('');
                setSearch('');
                setSelectedCategory(null);
                setSelectedMuscle(null);
                setDifficultyFilters([]);
                setEquipmentFilters([]);
                setHasVideoOnly(false);
              }}
              style={styles.feedbackButton}
            >
              <RNText style={styles.feedbackButtonText}>Reset Filters</RNText>
            </Pressable>
          </GlassPanel>
        ) : state.heroExercise ? (
          <GlassPanel padding={0} onPress={() => openExercise(state.heroExercise!)} style={styles.heroCard}>
            <ExerciseArtwork
              title={state.heroExercise.name}
              accent={getExerciseAccent(state.heroExercise)}
              uri={state.heroExercise.thumbnailUrl}
              height={230}
            />
            <View style={styles.heroCopy}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Most Recent</SectionLabel>
              <View style={styles.heroTopRow}>
                <RNText style={styles.heroTitle}>{state.heroExercise.name}</RNText>
                {state.favorites.has(state.heroExercise.id) ? (
                  <MaterialSymbol name="favorite_filled" size={18} color={WK_ACCENT_LIGHT} />
                ) : null}
              </View>
              <RNText style={styles.heroDescription} numberOfLines={3}>
                {state.heroExercise.description}
              </RNText>
              <View style={styles.heroMeta}>
                <Chip label={MUSCLE_GROUP_LABELS[getPrimaryMuscle(state.heroExercise) ?? 'full_body']} selected />
                <Chip label={equipmentLabel(inferExerciseEquipment(state.heroExercise)[0] ?? 'bodyweight')} />
              </View>
              <DifficultyStars difficulty={state.heroExercise.difficulty} />
            </View>
          </GlassPanel>
        ) : null}
      </View>

      {gridData.length > 0 ? <View style={styles.gridTopSpacer} /> : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ headerShown: false }} />

      <FlatList
        style={styles.screen}
        contentContainerStyle={styles.content}
        data={gridData}
        renderItem={renderGridItem}
        keyExtractor={keyExtractor}
        numColumns={2}
        columnWrapperStyle={styles.gridColumnWrapper}
        ItemSeparatorComponent={GridRowSeparator}
        ListHeaderComponent={listHeader}
        initialNumToRender={8}
        windowSize={7}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={DW_ACCENT}
            colors={[DW_ACCENT]}
          />
        }
      />

      <Modal
        visible={sheetVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSheetVisible(false)}
      >
        <View style={styles.sheetBackdrop}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setSheetVisible(false)} />
          <View style={styles.sheet}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <View>
                <SectionLabel accent={WK_ACCENT_LIGHT}>Filter Sheet</SectionLabel>
                <RNText style={styles.sheetTitle}>Refine the library</RNText>
              </View>
              <Pressable onPress={() => setSheetVisible(false)} style={styles.sheetIcon}>
                <MaterialSymbol name="close" size={18} color="rgba(228, 225, 233, 0.7)" />
              </Pressable>
            </View>

            <View style={styles.sheetSection}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Difficulty</SectionLabel>
              <View style={styles.sheetChips}>
                {WORKOUT_DIFFICULTIES.map((difficulty) => (
                  <Chip
                    key={difficulty}
                    label={difficulty.replace(/\b\w/g, (token) => token.toUpperCase())}
                    selected={draftDifficultyFilters.includes(difficulty)}
                    onPress={() => {
                      setDraftDifficultyFilters((current) => {
                        return current.includes(difficulty)
                          ? current.filter((item) => item !== difficulty)
                          : [...current, difficulty];
                      });
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={styles.sheetSection}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Equipment</SectionLabel>
              <View style={styles.sheetChips}>
                {PHASE3_EQUIPMENT_OPTIONS.map((equipment) => (
                  <Chip
                    key={equipment.key}
                    label={equipment.label}
                    selected={draftEquipmentFilters.includes(equipment.key)}
                    onPress={() => {
                      setDraftEquipmentFilters((current) => {
                        return current.includes(equipment.key)
                          ? current.filter((item) => item !== equipment.key)
                          : [...current, equipment.key];
                      });
                    }}
                  />
                ))}
              </View>
            </View>

            <View style={styles.sheetSection}>
              <SectionLabel accent={WK_ACCENT_LIGHT}>Video</SectionLabel>
              <Pressable
                onPress={() => setDraftHasVideoOnly((value) => !value)}
                style={[styles.toggleRow, draftHasVideoOnly && styles.toggleRowActive]}
              >
                <View>
                  <RNText style={styles.toggleTitle}>Has demo media</RNText>
                  <RNText style={styles.toggleBody}>Only show exercises that already include a video or thumb.</RNText>
                </View>
                <View style={[styles.toggleKnob, draftHasVideoOnly && styles.toggleKnobActive]}>
                  <MaterialSymbol
                    name={draftHasVideoOnly ? 'check' : 'close'}
                    size={14}
                    color={draftHasVideoOnly ? WK_ACCENT_DARK : 'rgba(228, 225, 233, 0.56)'}
                  />
                </View>
              </Pressable>
            </View>

            <View style={styles.sheetActions}>
              <Pressable onPress={resetDraftFilters} style={styles.sheetSecondary}>
                <RNText style={styles.sheetSecondaryText}>Reset</RNText>
              </Pressable>
              <Pressable onPress={applyFilters} style={styles.sheetPrimary}>
                <RNText style={styles.sheetPrimaryText}>Apply Filters</RNText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.base,
  },
  content: {
    paddingBottom: 56,
  },
  body: {
    paddingHorizontal: 24,
    gap: 24,
  },
  searchRow: {
    marginTop: 4,
  },
  searchWrap: {
    minHeight: 56,
    borderRadius: 999,
    paddingHorizontal: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: WK_SURFACES.highest,
  },
  searchInput: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 15,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  filterButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.low,
  },
  filterCount: {
    position: 'absolute',
    right: 4,
    top: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_ACCENT_LIGHT,
  },
  filterCountText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 10,
    lineHeight: 10,
    color: '#4B2700',
  },
  railBlock: {
    gap: 10,
  },
  railHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  railMeta: {
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    color: 'rgba(214, 195, 181, 0.46)',
  },
  rail: {
    gap: 8,
    paddingRight: 24,
  },
  feedbackCard: {
    gap: 10,
    padding: 20,
  },
  feedbackTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: '#E4E1E9',
  },
  feedbackBody: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(214, 195, 181, 0.72)',
  },
  feedbackButton: {
    alignSelf: 'flex-start',
    minHeight: 42,
    paddingHorizontal: 18,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_ACCENT,
  },
  feedbackButtonText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 12,
    lineHeight: 14,
    textTransform: 'uppercase',
    color: '#4B2700',
  },
  heroCard: {
    overflow: 'hidden',
  },
  heroCopy: {
    padding: 18,
    gap: 10,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  heroTitle: {
    flex: 1,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 30,
    letterSpacing: -0.8,
    color: '#E4E1E9',
  },
  heroDescription: {
    fontFamily: WK_FONTS.regular,
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(214, 195, 181, 0.76)',
  },
  heroMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  gridColumnWrapper: {
    paddingHorizontal: 24,
    justifyContent: 'space-between',
  },
  gridSeparator: {
    height: 16,
  },
  gridTopSpacer: {
    height: 24,
  },
  card: {
    width: '47%',
    overflow: 'hidden',
  },
  cardCopy: {
    padding: 14,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
  },
  cardTitle: {
    flex: 1,
    fontFamily: WK_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: '#E4E1E9',
  },
  cardMeta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  sheetBackdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.58)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 34,
    gap: 20,
    backgroundColor: WK_SURFACES.low,
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(214, 195, 181, 0.22)',
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  sheetTitle: {
    marginTop: 4,
    fontFamily: WK_FONTS.extraBold,
    fontSize: 24,
    lineHeight: 28,
    color: '#E4E1E9',
  },
  sheetIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  sheetSection: {
    gap: 10,
  },
  sheetChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleRow: {
    minHeight: 74,
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    backgroundColor: WK_SURFACES.high,
  },
  toggleRowActive: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  toggleTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: '#E4E1E9',
  },
  toggleBody: {
    marginTop: 4,
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  toggleKnob: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.highest,
  },
  toggleKnobActive: {
    backgroundColor: WK_ACCENT_LIGHT,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
  sheetSecondary: {
    minHeight: 52,
    paddingHorizontal: 22,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: WK_SURFACES.high,
  },
  sheetSecondaryText: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
    color: 'rgba(228, 225, 233, 0.82)',
  },
  sheetPrimary: {
    flex: 1,
    minHeight: 52,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: DW_ACCENT,
  },
  sheetPrimaryText: {
    fontFamily: WK_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    textTransform: 'uppercase',
    color: '#4B2700',
  },
});
