'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { WorkoutBodyMapWeb } from '@/components/workouts/body-map-web';
import type { MuscleGroup } from '@mylife/workouts';
import {
  doToggleFavoriteWorkoutExercise,
  doTrackWorkoutRecentView,
  fetchWorkoutExerciseDetail,
} from '../../actions';
import {
  ActionLink,
  EmptyState,
  LineChart,
  MetaList,
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  difficultyAccent,
  muscleGroupLabel,
  WORKOUTS_TOKENS,
} from '../../ui';

type ExerciseDetail = Awaited<ReturnType<typeof fetchWorkoutExerciseDetail>>;

function buildInstructionSteps(description: string): string[] {
  return description
    .split('. ')
    .map((item) => item.trim().replace(/\.$/, ''))
    .filter(Boolean);
}

export default function WorkoutExerciseDetailPage() {
  const params = useParams<{ id: string }>();
  const exerciseId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [data, setData] = useState<ExerciseDetail>(null);
  const [selectedMuscles, setSelectedMuscles] = useState<MuscleGroup[]>([]);
  const [favorite, setFavorite] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!exerciseId) {
      setError('Exercise not found.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutExerciseDetail(exerciseId);
        if (cancelled) return;
        setData(next);
        setFavorite(Boolean(next?.favorite));
        setSelectedMuscles(next?.exercise.muscleGroups ?? []);
        if (next?.exercise) {
          void doTrackWorkoutRecentView({
            id: next.exercise.id,
            type: 'exercise',
            title: next.exercise.name,
            subtitle: next.exercise.description,
            route: `/workouts/exercises/${next.exercise.id}`,
            category: next.exercise.category,
          });
        }
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load exercise.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [exerciseId]);

  const historyPoints = useMemo(() => {
    const history = data?.history ?? [];
    const byDate = new Map<string, number>();

    history
      .slice()
      .reverse()
      .forEach((row) => {
        const key = row.createdAt.slice(0, 10);
        const current = byDate.get(key) ?? 0;
        byDate.set(key, Math.max(current, row.weight));
      });

    return Array.from(byDate.entries())
      .slice(-6)
      .map(([key, value]) => ({
        label: new Date(key).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        value,
      }));
  }, [data?.history]);

  const instructions = useMemo(
    () => buildInstructionSteps(data?.exercise.description ?? ''),
    [data?.exercise.description],
  );

  const toggleMuscle = (muscle: MuscleGroup) => {
    setSelectedMuscles((current) =>
      current.includes(muscle)
        ? current.filter((entry) => entry !== muscle)
        : [...current, muscle],
    );
  };

  const handleToggleFavorite = async () => {
    if (!exerciseId) return;
    try {
      const next = await doToggleFavoriteWorkoutExercise(exerciseId);
      setFavorite(next.includes(exerciseId));
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update favorite.');
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading exercise detail...</WorkoutsSurface>;
  }

  if (error || !data || !data.exercise) {
    return (
      <EmptyState
        title="Exercise detail unavailable"
        body={error ?? 'This exercise could not be loaded.'}
        action={<ActionLink href="/workouts/exercises" label="Back To Library" icon="arrow_back" secondary />}
      />
    );
  }

  const exercise = data.exercise;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Exercise Detail"
          title={exercise.name}
          description={exercise.description}
          actions={
            <>
              <button
                type="button"
                onClick={() => void handleToggleFavorite()}
                style={chipStyle(favorite, WORKOUTS_TOKENS.accentLight)}
              >
                <SymbolIcon name="favorite" size={16} color={WORKOUTS_TOKENS.accentLight} filled={favorite} />
                {favorite ? 'Saved' : 'Favorite'}
              </button>
              <Link href={`/workouts/builder?exerciseId=${exercise.id}`} style={chipStyle(false)}>
                Add To Builder
              </Link>
              <ActionLink href="/workouts/exercises" label="Back To Library" icon="arrow_back" secondary />
            </>
          }
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={chipStyle(true, difficultyAccent(exercise.difficulty))}>{exercise.difficulty}</span>
          <span style={chipStyle(false)}>{exercise.category}</span>
          <span style={chipStyle(false)}>{data.equipmentLabel}</span>
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Movement Pattern"
            title="Primary muscles"
            description="Tap the body map or the chips below to isolate each region."
          />
          <WorkoutBodyMapWeb selectedMuscles={selectedMuscles} onToggleMuscle={toggleMuscle} />
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {exercise.muscleGroups.map((muscle) => (
              <button
                key={muscle}
                type="button"
                onClick={() => toggleMuscle(muscle)}
                style={chipStyle(selectedMuscles.includes(muscle))}
              >
                {muscleGroupLabel(muscle)}
              </button>
            ))}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Stats"
            title="Programming defaults"
            description="Pulled straight from the shared workouts engine."
          />
          <MetaList
            rows={[
              { label: 'Category', value: <span style={{ textTransform: 'capitalize' }}>{exercise.category}</span> },
              { label: 'Difficulty', value: <span style={{ textTransform: 'capitalize' }}>{exercise.difficulty}</span> },
              {
                label: 'Default',
                value: exercise.defaultReps
                  ? `${exercise.defaultSets} × ${exercise.defaultReps}`
                  : `${exercise.defaultSets} × ${exercise.defaultDuration ?? 0}s`,
              },
              {
                label: 'Latest 1RM',
                value: data.latestOneRM
                  ? `${Math.round(data.latestOneRM.estimated1rm)} ${data.latestOneRM.unit}`
                  : 'None logged',
              },
              {
                label: 'Weighted sets',
                value: data.history.length > 0 ? `${data.history.length} logged` : 'No set history',
              },
            ]}
          />
        </WorkoutsSurface>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="History"
            title="Load trend"
            description="Maximum logged weight per day for this exercise."
          />
          {historyPoints.length > 0 ? (
            <LineChart points={historyPoints} accent={WORKOUTS_TOKENS.accentLight} />
          ) : (
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
              No weighted history yet. Log a few sets from a live session and the trend will appear here.
            </p>
          )}
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Coaching"
            title="Execution notes"
            description="The exercise description has been split into readable desktop cues."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {instructions.length > 0 ? (
              instructions.map((step, index) => (
                <div key={`${exercise.id}-step-${index}`} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 12 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 999,
                      background: 'rgba(201,137,77,0.18)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: WORKOUTS_TOKENS.accentLight,
                      fontWeight: 800,
                    }}
                  >
                    {index + 1}
                  </div>
                  <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.7 }}>{step}</p>
                </div>
              ))
            ) : (
              <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
                No coaching notes available for this movement yet.
              </p>
            )}
          </div>
        </WorkoutsSurface>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Video Library"
            title="Trainer demos"
            description="Exercise videos are optional. If present, they surface here before a builder jump."
          />
          {data.videos.length > 0 ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {data.videos.map((video) => (
                <a
                  key={video.id}
                  href={video.videoUri}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 12,
                    padding: 16,
                    borderRadius: 20,
                    background: WORKOUTS_TOKENS.surfaceMid,
                    color: WORKOUTS_TOKENS.text,
                    textDecoration: 'none',
                  }}
                >
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong>{video.notes || `${video.angle.replace(/_/g, ' ')} demo`}</strong>
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                      {video.durationSeconds > 0 ? `${video.durationSeconds}s` : 'External demo'}
                    </span>
                  </div>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: WORKOUTS_TOKENS.accentLight, fontWeight: 700 }}>
                    Watch
                    <SymbolIcon name="open_in_new" size={16} color={WORKOUTS_TOKENS.accentLight} />
                  </div>
                </a>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
              No trainer videos have been attached to this exercise yet.
            </p>
          )}
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Related Workouts"
            title="Where it appears"
            description="Use an existing workout or seed a custom one in the builder."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {data.relatedWorkouts.length > 0 ? (
              data.relatedWorkouts.slice(0, 6).map((workout) => (
                <Link
                  key={workout.id}
                  href={`/workouts/session?workoutId=${workout.id}`}
                  style={{
                    display: 'grid',
                    gap: 6,
                    padding: 14,
                    borderRadius: 18,
                    background: WORKOUTS_TOKENS.surfaceHigh,
                    textDecoration: 'none',
                    color: WORKOUTS_TOKENS.text,
                  }}
                >
                  <strong>{workout.title}</strong>
                  <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                    {workout.exercises.length} exercises
                  </span>
                </Link>
              ))
            ) : (
              <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
                This exercise is not used in a saved workout yet.
              </p>
            )}
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
