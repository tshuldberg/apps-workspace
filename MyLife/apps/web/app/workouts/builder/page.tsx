'use client';

import { Suspense, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import type {
  WorkoutDifficulty,
  WorkoutExerciseEntry,
  WorkoutExerciseLibraryItem,
} from '@mylife/workouts';
import {
  doCreateWorkout,
  doDeleteWorkout,
  doUpdateWorkout,
  fetchWorkoutBuilderSeed,
} from '../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  panelStyle,
  WORKOUTS_TOKENS,
} from '../ui';

type BuilderSeed = Awaited<ReturnType<typeof fetchWorkoutBuilderSeed>>;

const FOCUS_OPTIONS = [
  'strength',
  'hypertrophy',
  'cardio',
  'mobility',
  'recovery',
] as const;

function mapExerciseToEntry(exercise: WorkoutExerciseLibraryItem, order: number): WorkoutExerciseEntry {
  return {
    exerciseId: exercise.id,
    name: exercise.name,
    category: exercise.category,
    sets: exercise.defaultSets,
    reps: exercise.defaultReps,
    duration: exercise.defaultDuration,
    restAfter: 90,
    order,
  };
}

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

function WorkoutBuilderPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('workoutId');
  const exerciseId = searchParams.get('exerciseId');

  const [seed, setSeed] = useState<BuilderSeed | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<WorkoutDifficulty>('intermediate');
  const [focus, setFocus] = useState<typeof FOCUS_OPTIONS[number]>('strength');
  const [selectedExercises, setSelectedExercises] = useState<WorkoutExerciseEntry[]>([]);
  const [librarySearch, setLibrarySearch] = useState('');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [savedWorkoutId, setSavedWorkoutId] = useState<string | null>(workoutId);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutBuilderSeed({ workoutId, exerciseId });
        if (cancelled) return;
        setSeed(next);

        if (next.workout) {
          setSavedWorkoutId(next.workout.id);
          setTitle(next.workout.title);
          setDescription(next.workout.description);
          setDifficulty(next.workout.difficulty);
          setSelectedExercises(next.workout.exercises);
        } else {
          setSavedWorkoutId(null);
          setTitle('');
          setDescription('');
          setDifficulty('intermediate');
          setSelectedExercises([]);
        }

        setFocus(next.settings.defaultFocus);

        if (!next.workout && next.starterExerciseId) {
          const starter = next.exercises.find((exercise) => exercise.id === next.starterExerciseId);
          if (starter) {
            setSelectedExercises([mapExerciseToEntry(starter, 0)]);
            setTitle(`${starter.name} Builder`);
          }
        }

        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load builder.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exerciseId, workoutId]);

  const filteredLibrary = useMemo(() => {
    const query = normalizeText(librarySearch);
    const exercises = seed?.exercises ?? [];
    return exercises.filter((exercise) => {
      if (!query) return true;
      return normalizeText(`${exercise.name} ${exercise.description}`).includes(query);
    });
  }, [librarySearch, seed?.exercises]);

  const addExercise = (exercise: WorkoutExerciseLibraryItem) => {
    setSelectedExercises((current) => [...current, mapExerciseToEntry(exercise, current.length)]);
  };

  const updateExercise = (
    index: number,
    patch: Partial<WorkoutExerciseEntry>,
  ) => {
    setSelectedExercises((current) =>
      current.map((entry, entryIndex) =>
        entryIndex === index ? { ...entry, ...patch } : entry,
      ),
    );
  };

  const removeExercise = (index: number) => {
    setSelectedExercises((current) =>
      current
        .filter((_, entryIndex) => entryIndex !== index)
        .map((entry, entryIndex) => ({ ...entry, order: entryIndex })),
    );
  };

  const moveExercise = (fromIndex: number, toIndex: number) => {
    setSelectedExercises((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next.map((entry, entryIndex) => ({ ...entry, order: entryIndex }));
    });
  };

  const handleSave = async () => {
    if (!title.trim()) {
      setError('Add a workout title before saving.');
      return;
    }

    if (selectedExercises.length === 0) {
      setError('Add at least one exercise to the workout.');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      const payload = {
        title: title.trim(),
        description: description.trim(),
        difficulty,
        exercises: selectedExercises.map((entry, index) => ({ ...entry, order: index })),
      };

      const nextId = savedWorkoutId
        ? await doUpdateWorkout(savedWorkoutId, payload)
        : await doCreateWorkout(payload);

      setSavedWorkoutId(nextId);
      router.replace(`/workouts/builder?workoutId=${nextId}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save workout.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!savedWorkoutId) return;
    const confirmed = window.confirm('Delete this workout?');
    if (!confirmed) return;

    try {
      setSaving(true);
      await doDeleteWorkout(savedWorkoutId);
      router.push('/workouts/workouts');
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete workout.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading builder...</WorkoutsSurface>;
  }

  if (!seed) {
    return (
      <EmptyState
        title="Builder unavailable"
        body={error ?? 'The workout builder could not be loaded.'}
        action={<ActionLink href="/workouts/workouts" label="Back To Library" icon="arrow_back" secondary />}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Builder"
          title={savedWorkoutId ? 'Refine workout' : 'Create workout'}
          description="Use the left rail to add movements, drag the stack into the right order, then save the workout back into the shared library."
          actions={
            <>
              {savedWorkoutId ? (
                <Link href={`/workouts/session?workoutId=${savedWorkoutId}`} style={chipStyle(true)}>
                  Start Saved Workout
                </Link>
              ) : null}
              <ActionLink href="/workouts/workouts" label="Back To Library" icon="arrow_back" secondary />
            </>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Title
            </span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Upper body density"
              style={{
                border: 'none',
                outline: 'none',
                borderRadius: 18,
                background: WORKOUTS_TOKENS.surfaceHigh,
                color: WORKOUTS_TOKENS.text,
                padding: '14px 16px',
                fontSize: 15,
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
              Difficulty
            </span>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['beginner', 'intermediate', 'advanced'] as const).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setDifficulty(item)}
                  style={chipStyle(difficulty === item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </label>
        </div>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Focus
          </span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {FOCUS_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setFocus(item)}
                style={chipStyle(focus === item)}
              >
                {item}
              </button>
            ))}
          </div>
        </label>

        <label style={{ display: 'grid', gap: 8 }}>
          <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            Description
          </span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="What this block is trying to accomplish."
            style={{
              resize: 'vertical',
              border: 'none',
              outline: 'none',
              borderRadius: 18,
              background: WORKOUTS_TOKENS.surfaceHigh,
              color: WORKOUTS_TOKENS.text,
              padding: 16,
              fontSize: 14,
              lineHeight: 1.6,
            }}
          />
        </label>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(300px, 340px) minmax(0, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16, alignContent: 'start' }}>
          <SectionTitle
            eyebrow="Exercise Rail"
            title="Add movements"
            description="Search the full library and click a card to append it to the workout."
          />

          <input
            value={librarySearch}
            onChange={(event) => setLibrarySearch(event.target.value)}
            placeholder="Search exercise library"
            style={{
              border: 'none',
              outline: 'none',
              borderRadius: 18,
              background: WORKOUTS_TOKENS.surfaceHigh,
              color: WORKOUTS_TOKENS.text,
              padding: '14px 16px',
            }}
          />

          <div style={{ display: 'grid', gap: 10, maxHeight: 720, overflow: 'auto', paddingRight: 4 }}>
            {filteredLibrary.slice(0, 80).map((exercise) => (
              <button
                key={exercise.id}
                type="button"
                onClick={() => addExercise(exercise)}
                style={{
                  ...panelStyle('low'),
                  padding: 16,
                  display: 'grid',
                  gap: 8,
                  textAlign: 'left',
                  border: 'none',
                  color: WORKOUTS_TOKENS.text,
                  cursor: 'pointer',
                }}
              >
                <strong>{exercise.name}</strong>
                <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                  {exercise.muscleGroups.slice(0, 3).join(' · ')}
                </span>
              </button>
            ))}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Workout Stack"
            title={`${selectedExercises.length} exercises`}
            description="Drag cards to reorder the session. Each row controls its own sets, reps, duration, and rest."
          />

          {selectedExercises.length === 0 ? (
            <EmptyState
              title="No exercises added"
              body="Use the library rail to start building the workout."
            />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {selectedExercises.map((entry, index) => (
                <div
                  key={`${entry.exerciseId}-${index}`}
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex == null || dragIndex === index) return;
                    moveExercise(dragIndex, index);
                    setDragIndex(null);
                  }}
                  style={{
                    ...panelStyle('mid'),
                    padding: 18,
                    display: 'grid',
                    gap: 14,
                    cursor: 'grab',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 12,
                          background: 'rgba(201,137,77,0.16)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: WORKOUTS_TOKENS.accentLight,
                          fontWeight: 800,
                        }}
                      >
                        {index + 1}
                      </div>
                      <div style={{ display: 'grid', gap: 4 }}>
                        <strong>{entry.name}</strong>
                        <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                          {entry.category}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeExercise(index)}
                      style={{
                        width: 36,
                        height: 36,
                        border: 'none',
                        borderRadius: 999,
                        background: 'rgba(255,69,58,0.14)',
                        cursor: 'pointer',
                      }}
                    >
                      <SymbolIcon name="delete" size={18} color={WORKOUTS_TOKENS.danger} />
                    </button>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10 }}>
                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Sets</span>
                      <input
                        type="number"
                        min={1}
                        value={entry.sets}
                        onChange={(event) =>
                          updateExercise(index, { sets: Math.max(1, Number(event.target.value) || 1) })
                        }
                        style={{
                          border: 'none',
                          outline: 'none',
                          borderRadius: 14,
                          background: WORKOUTS_TOKENS.surfaceHigh,
                          color: WORKOUTS_TOKENS.text,
                          padding: '12px 14px',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Reps</span>
                      <input
                        type="number"
                        min={0}
                        value={entry.reps ?? ''}
                        onChange={(event) =>
                          updateExercise(index, {
                            reps: event.target.value ? Math.max(1, Number(event.target.value) || 1) : null,
                          })
                        }
                        style={{
                          border: 'none',
                          outline: 'none',
                          borderRadius: 14,
                          background: WORKOUTS_TOKENS.surfaceHigh,
                          color: WORKOUTS_TOKENS.text,
                          padding: '12px 14px',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Duration (s)</span>
                      <input
                        type="number"
                        min={0}
                        value={entry.duration ?? ''}
                        onChange={(event) =>
                          updateExercise(index, {
                            duration: event.target.value ? Math.max(1, Number(event.target.value) || 1) : null,
                          })
                        }
                        style={{
                          border: 'none',
                          outline: 'none',
                          borderRadius: 14,
                          background: WORKOUTS_TOKENS.surfaceHigh,
                          color: WORKOUTS_TOKENS.text,
                          padding: '12px 14px',
                        }}
                      />
                    </label>

                    <label style={{ display: 'grid', gap: 6 }}>
                      <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Rest (s)</span>
                      <input
                        type="number"
                        min={0}
                        value={entry.restAfter}
                        onChange={(event) =>
                          updateExercise(index, {
                            restAfter: Math.max(0, Number(event.target.value) || 0),
                          })
                        }
                        style={{
                          border: 'none',
                          outline: 'none',
                          borderRadius: 14,
                          background: WORKOUTS_TOKENS.surfaceHigh,
                          color: WORKOUTS_TOKENS.text,
                          padding: '12px 14px',
                        }}
                      />
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error ? (
            <div style={{ color: WORKOUTS_TOKENS.danger, fontSize: 14 }}>{error}</div>
          ) : null}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              style={{
                border: 'none',
                borderRadius: 999,
                background: WORKOUTS_TOKENS.accent,
                color: '#2E1600',
                padding: '14px 20px',
                fontWeight: 800,
                cursor: saving ? 'default' : 'pointer',
              }}
            >
              {saving ? 'Saving...' : savedWorkoutId ? 'Save Changes' : 'Save Workout'}
            </button>

            {savedWorkoutId ? (
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={saving}
                style={{
                  border: 'none',
                  borderRadius: 999,
                  background: 'rgba(255,69,58,0.14)',
                  color: WORKOUTS_TOKENS.danger,
                  padding: '14px 20px',
                  fontWeight: 800,
                  cursor: saving ? 'default' : 'pointer',
                }}
              >
                Delete Workout
              </button>
            ) : null}
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}

export default function WorkoutBuilderPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutBuilderPageContent />
    </Suspense>
  );
}
