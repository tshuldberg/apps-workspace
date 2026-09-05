import Link from 'next/link';
import { fetchWorkoutLibraryData, fetchWorkouts } from '../actions';
import {
  ActionLink,
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  difficultyAccent,
  formatMinutes,
  WORKOUTS_TOKENS,
} from '../ui';

export default async function WorkoutLibraryPage({
  searchParams,
}: {
  searchParams?: Promise<{ difficulty?: string }>;
}) {
  const difficulty = (await searchParams)?.difficulty;
  const [library, workouts] = await Promise.all([
    fetchWorkoutLibraryData(),
    fetchWorkouts({
      difficulty:
        difficulty === 'beginner' || difficulty === 'intermediate' || difficulty === 'advanced'
          ? difficulty
          : undefined,
    }),
  ]);

  const activePlan = library.plans.find((plan) => plan.isActive) ?? library.plans[0] ?? null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 24 }}>
        <WorkoutsPageHeader
          eyebrow="Library"
          title="Workouts and programs"
          description="Segmented the same way as mobile: quick access to single-session workouts, then structured plans once you want a longer arc."
          actions={(
            <>
              <Link href="/workouts/workouts" style={chipStyle(true)}>Workouts</Link>
              <Link href="/workouts/programs" style={chipStyle(false)}>Programs</Link>
              <ActionLink href="/workouts/builder" label="Build Workout" icon="add" />
            </>
          )}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Link href="/workouts/workouts" style={chipStyle(!difficulty)}>All difficulty</Link>
          <Link href="/workouts/workouts?difficulty=beginner" style={chipStyle(difficulty === 'beginner', WORKOUTS_TOKENS.cardio)}>Beginner</Link>
          <Link href="/workouts/workouts?difficulty=intermediate" style={chipStyle(difficulty === 'intermediate', WORKOUTS_TOKENS.accentLight)}>Intermediate</Link>
          <Link href="/workouts/workouts?difficulty=advanced" style={chipStyle(difficulty === 'advanced', WORKOUTS_TOKENS.hypertrophy)}>Advanced</Link>
        </div>
      </WorkoutsSurface>

      {activePlan ? (
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Active Program"
            title={activePlan.title}
            description={`${activePlan.weekCount} weeks  ·  ${activePlan.frequency} sessions per week`}
            aside={<ActionLink href={`/workouts/programs/${activePlan.id}`} label="Open Program" icon="north_east" secondary />}
          />
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.7 }}>
              {activePlan.description || 'This plan is currently pinned as your active progression arc.'}
            </div>
            {activePlan.progressPercent != null ? (
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800 }}>
                    Completion
                  </span>
                  <span style={{ fontWeight: 800, color: WORKOUTS_TOKENS.accentLight }}>{activePlan.progressPercent}%</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: WORKOUTS_TOKENS.surfaceHighest, overflow: 'hidden' }}>
                  <div style={{ width: `${activePlan.progressPercent}%`, height: '100%', borderRadius: 999, background: WORKOUTS_TOKENS.accent }} />
                </div>
              </div>
            ) : null}
          </div>
        </WorkoutsSurface>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {workouts.map((workout) => (
          <WorkoutsSurface key={workout.id} tone="low" style={{ display: 'grid', gap: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <strong style={{ fontSize: 18 }}>{workout.title}</strong>
                <span style={{ color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.6 }}>
                  {workout.description || 'Custom desktop-ready workout definition from the local workouts engine.'}
                </span>
              </div>
              <span
                style={{
                  color: difficultyAccent(workout.difficulty),
                  fontSize: 11,
                  fontWeight: 800,
                  letterSpacing: '0.14em',
                  textTransform: 'uppercase',
                }}
              >
                {workout.difficulty}
              </span>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              {workout.exercises.slice(0, 3).map((exercise) => (
                <div key={`${workout.id}-${exercise.exerciseId}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: WORKOUTS_TOKENS.textSecondary }}>
                  <span>{exercise.name}</span>
                  <span>{exercise.sets} × {exercise.reps ?? `${exercise.duration}s`}</span>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
              <div style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                {workout.exercises.length} exercises  ·  {formatMinutes(Math.round((workout.estimatedDuration ?? 0) / 60))}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <Link href={`/workouts/builder?workoutId=${workout.id}`} style={chipStyle(false)}>
                  Edit
                </Link>
                <Link href={`/workouts/session?workoutId=${workout.id}`} style={chipStyle(true, difficultyAccent(workout.difficulty))}>
                  <SymbolIcon name="play_arrow" size={16} color={difficultyAccent(workout.difficulty)} />
                  Start
                </Link>
              </div>
            </div>
          </WorkoutsSurface>
        ))}
      </div>
    </div>
  );
}
