// DoWork explore tab — exercise library browser.
//
// Streamlined adaptation of apps/mobile/app/(workouts)/(tabs)/explore.tsx.
// Lists the seeded exercise library with category filter chips. Tapping
// an exercise routes to /(root)/exercise/[id] (added in P5 Batch A).

import { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Search } from 'lucide-react-native';
import {
  WK_FONTS,
  WORKOUT_CATEGORIES,
  getWorkoutExercises,
  seedWorkoutExerciseLibrary,
  type WorkoutCategory,
  type WorkoutExerciseLibraryItem,
} from '@mylife/workouts';
import { useDatabase } from '../providers/DatabaseProvider';
import { DW_BORDER, DW_SURFACES, DW_TEXT } from '../theme/tokens';
import {
  WorkoutHero,
  WorkoutPrimaryButton,
  WorkoutSectionHeader,
  WorkoutTabScrollView,
} from './_screen-kit';

const SEARCH_DEBOUNCE_MS = 200;

export default function ExploreScreen() {
  const router = useRouter();
  const db = useDatabase();
  const [exercises, setExercises] = useState<WorkoutExerciseLibraryItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<WorkoutCategory | null>(null);
  const [searchDraft, setSearchDraft] = useState('');
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchDraft.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [searchDraft]);

  const refresh = useCallback(() => {
    seedWorkoutExerciseLibrary(db);
    const result = getWorkoutExercises(db, {
      search: search || undefined,
      category: activeCategory,
      limit: 200,
    });
    setExercises(result);
  }, [db, search, activeCategory]);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh();
    setTimeout(() => setRefreshing(false), 300);
  }, [refresh]);

  return (
    <WorkoutTabScrollView refreshing={refreshing} onRefresh={onRefresh}>
      <WorkoutHero
        title="Explore"
        subtitle={`${exercises.length} exercises`}
        trailing={
          <WorkoutPrimaryButton
            label="Full library"
            onPress={() => router.push('/(root)/exercises' as never)}
          />
        }
      />

      <View style={styles.searchRow}>
        <Search size={16} color={DW_TEXT.tertiary} />
        <TextInput
          value={searchDraft}
          onChangeText={setSearchDraft}
          placeholder="Search exercises"
          placeholderTextColor={DW_TEXT.tertiary}
          style={styles.searchInput}
          accessibilityLabel="Search exercises"
        />
      </View>

      <View style={styles.chipRow}>
        <Pressable
          onPress={() => setActiveCategory(null)}
          style={[styles.chip, activeCategory === null && styles.chipActive]}
        >
          <Text style={[styles.chipLabel, activeCategory === null && styles.chipLabelActive]}>
            All
          </Text>
        </Pressable>
        {WORKOUT_CATEGORIES.map((category) => (
          <Pressable
            key={category}
            onPress={() => setActiveCategory(category)}
            style={[styles.chip, activeCategory === category && styles.chipActive]}
          >
            <Text style={[styles.chipLabel, activeCategory === category && styles.chipLabelActive]}>
              {category}
            </Text>
          </Pressable>
        ))}
      </View>

      <WorkoutSectionHeader title={activeCategory ?? 'All exercises'} />

      <View style={styles.exerciseList}>
        {exercises.slice(0, 60).map((exercise) => (
          <Pressable
            key={exercise.id}
            style={({ pressed }) => [styles.exerciseRow, pressed && { opacity: 0.86 }]}
            onPress={() => router.push(`/(root)/exercise/${exercise.id}` as never)}
          >
            <Text style={styles.exerciseName}>{exercise.name}</Text>
            <Text style={styles.exerciseMeta}>
              {exercise.category} · {exercise.difficulty}
            </Text>
          </Pressable>
        ))}
      </View>
    </WorkoutTabScrollView>
  );
}

const styles = StyleSheet.create({
  searchRow: {
    marginHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 16,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontFamily: WK_FONTS.medium,
    fontSize: 14,
    color: DW_TEXT.primary,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingHorizontal: 20,
  },
  chip: {
    backgroundColor: DW_SURFACES.low,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: DW_BORDER.subtle,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipActive: {
    backgroundColor: '#FF6B0022',
    borderColor: '#FF6B00',
  },
  chipLabel: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 12,
    color: DW_TEXT.secondary,
    textTransform: 'capitalize',
    letterSpacing: 0.4,
  },
  chipLabelActive: {
    color: '#FF8B33',
  },
  exerciseList: {
    paddingHorizontal: 20,
    gap: 8,
  },
  exerciseRow: {
    backgroundColor: DW_SURFACES.low,
    borderColor: DW_BORDER.subtle,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    gap: 4,
  },
  exerciseName: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: DW_TEXT.primary,
  },
  exerciseMeta: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    color: DW_TEXT.tertiary,
    textTransform: 'capitalize',
  },
});
