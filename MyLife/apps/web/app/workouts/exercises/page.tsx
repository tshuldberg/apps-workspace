'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { WorkoutBodyMapWeb } from '@/components/workouts/body-map-web';
import type { MuscleGroup } from '@mylife/workouts';
import {
  doToggleFavoriteWorkoutExercise,
  doTrackWorkoutRecentView,
  fetchWorkoutExercises,
  fetchWorkoutExploreData,
} from '../actions';
import {
  ActionLink,
  EmptyState,
  RouteTile,
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  difficultyAccent,
  muscleGroupLabel,
  WORKOUTS_TOKENS,
} from '../ui';

type ExerciseData = Awaited<ReturnType<typeof fetchWorkoutExercises>>;
type ExploreData = Awaited<ReturnType<typeof fetchWorkoutExploreData>>;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export default function WorkoutExercisesPage() {
  const [exercises, setExercises] = useState<ExerciseData>([]);
  const [meta, setMeta] = useState<ExploreData | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string | null>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const [exerciseList, exploreMeta] = await Promise.all([
          fetchWorkoutExercises({ limit: 500 }),
          fetchWorkoutExploreData(),
        ]);
        if (cancelled) return;
        setExercises(exerciseList);
        setMeta(exploreMeta);
        setFavorites(exploreMeta.favorites);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load exercises.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filteredExercises = useMemo(() => {
    const query = normalizeText(deferredSearch);
    return exercises.filter((exercise) => {
      const matchesSearch =
        !query ||
        normalizeText(`${exercise.name} ${exercise.description}`).includes(query);
      const matchesCategory =
        selectedCategory == null || exercise.category === selectedCategory;
      const matchesDifficulty =
        selectedDifficulty == null || exercise.difficulty === selectedDifficulty;
      const matchesMuscles =
        selectedMuscles.length === 0 ||
        selectedMuscles.every((muscle) => exercise.muscleGroups.includes(muscle));

      return matchesSearch && matchesCategory && matchesDifficulty && matchesMuscles;
    });
  }, [deferredSearch, exercises, selectedCategory, selectedDifficulty, selectedMuscles]);

  const categoryCounts = meta?.categories ?? [];

  const toggleMuscle = (muscle: MuscleGroup) => {
    setSelectedMuscles((current) =>
      current.includes(muscle)
        ? current.filter((entry) => entry !== muscle)
        : [...current, muscle],
    );
  };

  const handleToggleFavorite = async (exerciseId: string) => {
    try {
      const next = await doToggleFavoriteWorkoutExercise(exerciseId);
      setFavorites(next);
    } catch (toggleError) {
      setError(
        toggleError instanceof Error ? toggleError.message : 'Unable to update favorites.',
      );
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading exercise library...</WorkoutsSurface>;
  }

  if (error && !meta) {
    return (
      <EmptyState
        title="Exercise library unavailable"
        body={error}
        action={<ActionLink href="/workouts" label="Back To Dashboard" icon="arrow_back" secondary />}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Exercise Library"
          title="Movement catalog"
          description="Filter by muscle, difficulty, or category, then jump into the exercise detail screen or seed a new builder draft directly from the library."
          actions={<ActionLink href="/workouts/builder" label="Open Builder" icon="build" />}
        />

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderRadius: 22,
            background: WORKOUTS_TOKENS.surfaceHigh,
          }}
        >
          <SymbolIcon name="search" color={WORKOUTS_TOKENS.textTertiary} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search exercise names or movement descriptions"
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              background: 'transparent',
              color: WORKOUTS_TOKENS.text,
              fontSize: 15,
            }}
          />
        </label>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={chipStyle(selectedCategory == null)}
          >
            All categories
          </button>
          {categoryCounts.map((item) => (
            <button
              key={item.category}
              type="button"
              onClick={() => setSelectedCategory(item.category)}
              style={chipStyle(selectedCategory === item.category)}
            >
              <span style={{ textTransform: 'capitalize' }}>{item.category}</span>
              <span>{item.count}</span>
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            onClick={() => setSelectedDifficulty(null)}
            style={chipStyle(selectedDifficulty == null)}
          >
            All difficulty
          </button>
          {(['beginner', 'intermediate', 'advanced'] as const).map((difficulty) => (
            <button
              key={difficulty}
              type="button"
              onClick={() => setSelectedDifficulty(difficulty)}
              style={chipStyle(selectedDifficulty === difficulty, difficultyAccent(difficulty))}
            >
              {difficulty}
            </button>
          ))}
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) minmax(0, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <SectionTitle
            eyebrow="Body Filter"
            title="Target muscles"
            description="Use the body map to narrow the library to specific regions."
          />
          <WorkoutBodyMapWeb selectedMuscles={selectedMuscles} onToggleMuscle={toggleMuscle} />
          {selectedMuscles.length > 0 ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {selectedMuscles.map((muscle) => (
                <button
                  key={muscle}
                  type="button"
                  style={chipStyle(true)}
                  onClick={() => toggleMuscle(muscle)}
                >
                  {muscleGroupLabel(muscle)}
                </button>
              ))}
            </div>
          ) : null}
        </WorkoutsSurface>

        <div style={{ display: 'grid', gap: 18 }}>
          <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
            <SectionTitle
              eyebrow="Utility Belt"
              title="Quick tools"
              description="Desktop calculators and helpers that complement the library flow."
            />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <RouteTile href="/workouts/tools/one-rm" icon="calculate" title="1RM Calculator" description="Estimate strength from working reps." />
              <RouteTile href="/workouts/tools/plate-loader" icon="fitness_center" title="Plate Loader" description="Build a barbell quickly with standard plates." />
              <RouteTile href="/workouts/tools/warmup" icon="local_fire_department" title="Warmup Sets" description="Create a simple ramp-up before work sets." />
            </div>
          </WorkoutsSurface>

          {filteredExercises.length === 0 ? (
            <EmptyState
              title="No exercises match"
              body="Adjust one of the filters or clear the body-map selections to see more of the library."
            />
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 14 }}>
              {filteredExercises.map((exercise) => {
                const isFavorite = favorites.includes(exercise.id);

                return (
                  <WorkoutsSurface key={exercise.id} tone="low" style={{ display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <strong style={{ fontSize: 17 }}>{exercise.name}</strong>
                        <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                          {exercise.muscleGroups.slice(0, 3).map(muscleGroupLabel).join(' · ')}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleFavorite(exercise.id)}
                        style={{
                          width: 38,
                          height: 38,
                          border: 'none',
                          borderRadius: 999,
                          background: isFavorite ? 'rgba(201,137,77,0.18)' : WORKOUTS_TOKENS.surfaceHigh,
                          color: isFavorite ? WORKOUTS_TOKENS.accentLight : WORKOUTS_TOKENS.textTertiary,
                          cursor: 'pointer',
                        }}
                        aria-label={isFavorite ? 'Remove favorite' : 'Add favorite'}
                      >
                        <SymbolIcon name="favorite" size={18} color={isFavorite ? WORKOUTS_TOKENS.accentLight : WORKOUTS_TOKENS.textTertiary} filled={isFavorite} />
                      </button>
                    </div>

                    <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.6, fontSize: 13 }}>
                      {exercise.description}
                    </p>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 700 }}>
                      <span style={{ textTransform: 'capitalize' }}>{exercise.category}</span>
                      <span>{exercise.defaultReps ? `${exercise.defaultSets} × ${exercise.defaultReps}` : `${exercise.defaultSets} × ${exercise.defaultDuration ?? 0}s`}</span>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10 }}>
                      <Link
                        href={`/workouts/exercises/${exercise.id}`}
                        onClick={() => {
                          void doTrackWorkoutRecentView({
                            id: exercise.id,
                            type: 'exercise',
                            title: exercise.name,
                            subtitle: exercise.description,
                            route: `/workouts/exercises/${exercise.id}`,
                            category: exercise.category,
                          });
                        }}
                        style={chipStyle(true, difficultyAccent(exercise.difficulty))}
                      >
                        Detail
                      </Link>
                      <Link
                        href={`/workouts/builder?exerciseId=${exercise.id}`}
                        style={chipStyle(false)}
                      >
                        Add To Builder
                      </Link>
                    </div>
                  </WorkoutsSurface>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
