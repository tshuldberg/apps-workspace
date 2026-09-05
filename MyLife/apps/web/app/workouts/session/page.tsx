'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  createPlayerStatus,
  formatTime,
  playerProgress,
  reducePlayer,
} from '@mylife/workouts';
import type { PlayerAction, PlayerStatus, WorkoutExerciseInput } from '@mylife/workouts';
import {
  doCompleteWorkoutSession,
  doCreateWorkoutSession,
  doRecordSetWeight,
  fetchWorkoutSessionBlueprint,
} from '../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  panelStyle,
  WORKOUTS_TOKENS,
} from '../ui';

type SessionBlueprint = Awaited<ReturnType<typeof fetchWorkoutSessionBlueprint>>;

const RING_SIZE = 180;
const STROKE_WIDTH = 10;
const RADIUS = (RING_SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const TICK_MS = 100;

function buildCompletionStatus(status: PlayerStatus): PlayerStatus {
  let current = status;
  while (current.state !== 'completed') {
    current = reducePlayer(current, { type: 'SKIP_EXERCISE' });
  }
  return current;
}

function WorkoutSessionPageContent() {
  const searchParams = useSearchParams();
  const workoutId = searchParams.get('workoutId');

  const [blueprint, setBlueprint] = useState<SessionBlueprint | null>(null);
  const [status, setStatus] = useState<PlayerStatus | null>(null);
  const [setInputs, setSetInputs] = useState<
    Record<string, { weight: string; reps: string }>
  >({});
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [persisting, setPersisting] = useState(false);
  const [finalized, setFinalized] = useState(false);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!workoutId) {
      setError('No workout selected.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutSessionBlueprint(workoutId);
        if (cancelled) return;
        if (!next) {
          setError('Workout not found.');
          setLoading(false);
          return;
        }

        const exercises: WorkoutExerciseInput[] = next.exerciseDetails.map(({ entry }) => ({
          exercise_id: entry.exerciseId,
          sets: entry.sets,
          reps: entry.reps,
          duration: entry.duration,
          rest_after: entry.restAfter,
          order: entry.order,
        }));

        const initialInputs = next.exerciseDetails.reduce<
          Record<string, { weight: string; reps: string }>
        >((accumulator, { entry }) => {
          for (let setNumber = 1; setNumber <= entry.sets; setNumber += 1) {
            const previous = next.previousPerformance[entry.exerciseId]?.[String(setNumber)];
            accumulator[`${entry.exerciseId}:${setNumber}`] = {
              weight: previous?.weight ? String(previous.weight) : '',
              reps: previous?.reps
                ? String(previous.reps)
                : entry.reps
                  ? String(entry.reps)
                  : '',
            };
          }
          return accumulator;
        }, {});

        setBlueprint(next);
        setStatus(createPlayerStatus(exercises));
        setSetInputs(initialInputs);
        setSessionId(null);
        setFinalized(false);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load session.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [workoutId]);

  useEffect(() => {
    if (!status) return;
    const shouldTick = status.state === 'playing' || status.state === 'rest';

    if (shouldTick && !tickRef.current) {
      tickRef.current = setInterval(() => {
        setStatus((current) =>
          current ? reducePlayer(current, { type: 'TICK', deltaMs: TICK_MS }) : current,
        );
      }, TICK_MS);
    }

    if (!shouldTick && tickRef.current) {
      clearInterval(tickRef.current);
      tickRef.current = null;
    }

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [status]);

  useEffect(() => {
    if (!status || status.state !== 'completed' || !sessionId || !blueprint || finalized || persisting) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setPersisting(true);
        await doCompleteWorkoutSession({
          sessionId,
          workoutId: blueprint.workout.id,
          exercisesCompleted: status.completed.map((entry) => ({
            exercise_id: entry.exercise_id,
            sets_completed: entry.sets_completed,
            reps_completed: entry.reps_completed,
            duration_actual: entry.duration_actual,
            skipped: entry.skipped,
          })),
        });
        if (!cancelled) setFinalized(true);
      } catch (persistError) {
        if (!cancelled) {
          setError(
            persistError instanceof Error
              ? persistError.message
              : 'Unable to complete workout session.',
          );
        }
      } finally {
        if (!cancelled) setPersisting(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [blueprint, finalized, persisting, sessionId, status]);

  const dispatch = useCallback((action: PlayerAction) => {
    setStatus((current) => (current ? reducePlayer(current, action) : current));
  }, []);

  useEffect(() => {
    if (!status) return;
    const currentStatus = status;

    function handleKey(event: KeyboardEvent) {
      if (currentStatus.state === 'rest') {
        if (event.code === 'Space') {
          event.preventDefault();
          dispatch({ type: 'REST_COMPLETE' });
        }
        if (event.code === 'ArrowUp') {
          event.preventDefault();
          dispatch({ type: 'ADJUST_REST', deltaMs: 30000 });
        }
        if (event.code === 'ArrowDown') {
          event.preventDefault();
          dispatch({ type: 'ADJUST_REST', deltaMs: -30000 });
        }
      }
    }

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [dispatch, status]);

  const current = status ? status.exercises[status.currentExerciseIndex] : null;
  const currentDetail =
    blueprint && current
      ? blueprint.exerciseDetails.find((item) => item.entry.exerciseId === current.exercise_id)
      : null;
  const next = status ? status.exercises[status.currentExerciseIndex + 1] : null;
  const currentKey = current ? `${current.exercise_id}:${status?.currentSet ?? 1}` : '';
  const currentInputs = currentKey
    ? setInputs[currentKey] ?? { weight: '', reps: current?.reps ? String(current.reps) : '' }
    : { weight: '', reps: '' };
  const previousSet =
    blueprint && current
      ? blueprint.previousPerformance[current.exercise_id]?.[String(status?.currentSet ?? 1)] ?? null
      : null;
  const progress = status ? playerProgress(status) : 0;
  const restProgress =
    status && status.state === 'rest' && current?.rest_after
      ? 1 - status.restRemaining / Math.max(current.rest_after * 1000, 1)
      : 0;
  const ringOffset = CIRCUMFERENCE - CIRCUMFERENCE * restProgress;

  const updateCurrentInput = (field: 'weight' | 'reps', value: string) => {
    if (!current) return;
    setSetInputs((existing) => ({
      ...existing,
      [currentKey]: {
        ...existing[currentKey],
        [field]: value,
      },
    }));
  };

  const handleStart = async () => {
    if (!blueprint || !status) return;
    try {
      if (!sessionId) {
        const nextSessionId = await doCreateWorkoutSession({
          workoutId: blueprint.workout.id,
        });
        setSessionId(nextSessionId);
      }
      dispatch({ type: 'START' });
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : 'Unable to start session.');
    }
  };

  const handleCompleteSet = async () => {
    if (!status || !current || !sessionId) {
      dispatch({ type: 'COMPLETE_SET' });
      return;
    }

    try {
      const weight = Number(currentInputs.weight);
      const reps = Number(currentInputs.reps || current.reps || 0);

      if (Number.isFinite(weight) && weight > 0 && Number.isFinite(reps) && reps > 0) {
        await doRecordSetWeight({
          sessionId,
          exerciseId: current.exercise_id,
          setNumber: status.currentSet,
          weight,
          reps,
          unit: blueprint?.settings.weightUnit ?? 'lbs',
        });
      }

      dispatch({ type: 'COMPLETE_SET' });
    } catch (recordError) {
      setError(recordError instanceof Error ? recordError.message : 'Unable to save set.');
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading live session...</WorkoutsSurface>;
  }

  if (error || !status || !blueprint || !current) {
    return (
      <EmptyState
        title="Session unavailable"
        body={error ?? 'This session could not be loaded.'}
        action={<ActionLink href="/workouts/workouts" label="Back To Library" icon="arrow_back" secondary />}
      />
    );
  }

  if (status.state === 'idle') {
    return (
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 20, justifyItems: 'center', textAlign: 'center' }}>
        <WorkoutsPageHeader
          eyebrow="Live Session"
          title={blueprint.workout.title}
          description={`${blueprint.workout.exercises.length} exercises are queued. Last-set memory and rest pacing will appear as soon as the timer starts.`}
        />
        <button
          type="button"
          onClick={() => void handleStart()}
          style={{
            border: 'none',
            borderRadius: 999,
            background: WORKOUTS_TOKENS.accent,
            color: '#2E1600',
            padding: '16px 24px',
            fontWeight: 800,
            cursor: 'pointer',
            fontSize: 16,
          }}
        >
          Start Workout
        </button>
      </WorkoutsSurface>
    );
  }

  if (status.state === 'completed') {
    return (
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 18, justifyItems: 'center', textAlign: 'center' }}>
        <WorkoutsPageHeader
          eyebrow="Completed"
          title="Workout complete"
          description={`${status.completed.filter((entry) => !entry.skipped).length} exercises finished in ${formatTime(status.elapsedTime)}.`}
        />
        <div style={{ color: WORKOUTS_TOKENS.textSecondary }}>
          {persisting ? 'Saving session...' : finalized ? 'Session saved to history and progress.' : 'Finalizing session...'}
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <ActionLink href="/workouts/history" label="Open History" icon="history" />
          <ActionLink href="/workouts/progress" label="View Progress" icon="insights" secondary />
        </div>
      </WorkoutsSurface>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 20 }}>
        <WorkoutsPageHeader
          eyebrow="Live Session"
          title={blueprint.workout.title}
          description={`Exercise ${status.currentExerciseIndex + 1} of ${status.exercises.length} · ${formatTime(status.elapsedTime)}`}
          actions={
            <button
              type="button"
              onClick={() => setStatus((currentStatus) => (currentStatus ? buildCompletionStatus(currentStatus) : currentStatus))}
              style={chipStyle(false)}
            >
              End Workout
            </button>
          }
        />

        <div style={{ height: 10, borderRadius: 999, overflow: 'hidden', background: WORKOUTS_TOKENS.surfaceHighest }}>
          <div
            style={{
              width: `${Math.max(6, progress * 100)}%`,
              height: '100%',
              background: WORKOUTS_TOKENS.accent,
            }}
          />
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Current Exercise"
            title={currentDetail?.exercise?.name ?? currentDetail?.entry.name ?? current.exercise_id}
            description={currentDetail?.exercise?.description ?? 'Use the set controls below to log each effort.'}
          />

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <span style={chipStyle(true)}>{status.currentSet} / {current.sets} sets</span>
            {current.reps ? <span style={chipStyle(false)}>{current.reps} reps</span> : null}
            {current.duration ? <span style={chipStyle(false)}>{current.duration}s interval</span> : null}
            <span style={chipStyle(false)}>{current.rest_after}s rest</span>
          </div>

          {previousSet ? (
            <div style={{ padding: 16, borderRadius: 18, background: 'rgba(201,137,77,0.1)' }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>Last set memory</strong>
              <span style={{ color: WORKOUTS_TOKENS.textSecondary }}>
                {previousSet.weight} {previousSet.unit} × {previousSet.reps}
              </span>
            </div>
          ) : null}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12 }}>
            <label style={{ display: 'grid', gap: 6 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Weight ({blueprint.settings.weightUnit})</span>
              <input
                type="number"
                min={0}
                value={currentInputs.weight}
                onChange={(event) => updateCurrentInput('weight', event.target.value)}
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
                value={currentInputs.reps}
                onChange={(event) => updateCurrentInput('reps', event.target.value)}
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

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {status.state === 'playing' ? (
              <button
                type="button"
                onClick={() => dispatch({ type: 'PAUSE' })}
                style={chipStyle(false)}
              >
                Pause
              </button>
            ) : (
              <button
                type="button"
                onClick={() => dispatch({ type: 'RESUME' })}
                style={chipStyle(true)}
              >
                Resume
              </button>
            )}
            <button type="button" onClick={() => void handleCompleteSet()} style={chipStyle(true)}>
              Complete Set
            </button>
            <button type="button" onClick={() => dispatch({ type: 'SKIP_EXERCISE' })} style={chipStyle(false)}>
              Skip Exercise
            </button>
            <button type="button" onClick={() => dispatch({ type: 'PREVIOUS_EXERCISE' })} style={chipStyle(false)}>
              Previous
            </button>
          </div>
        </WorkoutsSurface>

        <div style={{ display: 'grid', gap: 18 }}>
          <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16, justifyItems: 'center' }}>
            <SectionTitle
              eyebrow="Rest Timer"
              title={status.state === 'rest' ? formatTime(status.restRemaining) : 'Ready'}
              description={status.state === 'rest' ? 'Space skips the rest timer.' : 'Next effort is live.'}
            />

            <svg width={RING_SIZE} height={RING_SIZE} viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}>
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke="rgba(255,255,255,0.08)"
                strokeWidth={STROKE_WIDTH}
                fill="none"
              />
              <circle
                cx={RING_SIZE / 2}
                cy={RING_SIZE / 2}
                r={RADIUS}
                stroke={WORKOUTS_TOKENS.accent}
                strokeWidth={STROKE_WIDTH}
                fill="none"
                strokeDasharray={CIRCUMFERENCE}
                strokeDashoffset={ringOffset}
                strokeLinecap="round"
                transform={`rotate(-90 ${RING_SIZE / 2} ${RING_SIZE / 2})`}
              />
            </svg>

            {status.state === 'rest' ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => dispatch({ type: 'ADJUST_REST', deltaMs: -30000 })} style={chipStyle(false)}>
                  -30s
                </button>
                <button type="button" onClick={() => dispatch({ type: 'REST_COMPLETE' })} style={chipStyle(true)}>
                  Skip
                </button>
                <button type="button" onClick={() => dispatch({ type: 'ADJUST_REST', deltaMs: 30000 })} style={chipStyle(false)}>
                  +30s
                </button>
              </div>
            ) : null}
          </WorkoutsSurface>

          <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 14 }}>
            <SectionTitle
              eyebrow="Up Next"
              title={next ? next.exercise_id : 'Finish line'}
              description={next ? 'The next exercise in the stack.' : 'The workout closes after this exercise.'}
            />
            {next ? (
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={panelStyle('high')}>
                  <strong style={{ display: 'block', marginBottom: 6 }}>
                    {blueprint.exerciseDetails.find((item) => item.entry.exerciseId === next.exercise_id)?.exercise?.name ?? next.exercise_id}
                  </strong>
                  <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                    {next.sets} sets {next.reps ? `· ${next.reps} reps` : next.duration ? `· ${next.duration}s` : ''}
                  </span>
                </div>
                <ActionLink href={`/workouts/exercises/${current.exercise_id}`} label="Open Exercise Detail" icon="north_east" secondary />
              </div>
            ) : (
              <Link href="/workouts/history" style={chipStyle(false)}>
                Open History
              </Link>
            )}
          </WorkoutsSurface>
        </div>
      </div>
    </div>
  );
}

export default function WorkoutSessionPage() {
  return (
    <Suspense fallback={null}>
      <WorkoutSessionPageContent />
    </Suspense>
  );
}
