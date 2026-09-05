'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { WorkoutDifficulty } from '@mylife/workouts';
import {
  doGenerateWorkout,
  doSaveGeneratedWorkout,
  fetchWorkoutSettings,
} from '../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../ui';

type GeneratedState = NonNullable<Awaited<ReturnType<typeof doGenerateWorkout>>>;

const GOALS = [
  { key: 'strength', label: 'Strength' },
  { key: 'hypertrophy', label: 'Hypertrophy' },
  { key: 'endurance', label: 'Endurance' },
  { key: 'general', label: 'General' },
] as const;

const EQUIPMENT = [
  { key: 'barbell', label: 'Barbell' },
  { key: 'dumbbells', label: 'Dumbbells' },
  { key: 'machines', label: 'Machines' },
  { key: 'bodyweight', label: 'Bodyweight' },
  { key: 'bands', label: 'Bands' },
  { key: 'kettlebell', label: 'Kettlebell' },
] as const;

const MUSCLES = [
  'chest',
  'back',
  'shoulders',
  'biceps',
  'triceps',
  'core',
  'quads',
  'hamstrings',
  'glutes',
  'calves',
] as const;

function mapSettingsFocusToGoal(
  focus: Awaited<ReturnType<typeof fetchWorkoutSettings>>['defaultFocus'],
) {
  if (focus === 'hypertrophy') return 'hypertrophy';
  if (focus === 'cardio') return 'endurance';
  return 'strength';
}

export default function WorkoutGeneratePage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [goal, setGoal] = useState<'strength' | 'hypertrophy' | 'endurance' | 'general'>('strength');
  const [difficulty, setDifficulty] = useState<WorkoutDifficulty>('intermediate');
  const [muscleFocus, setMuscleFocus] = useState<string[]>(['back', 'shoulders']);
  const [equipment, setEquipment] = useState<Array<(typeof EQUIPMENT)[number]['key']>>([
    'barbell',
    'dumbbells',
  ]);
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [result, setResult] = useState<GeneratedState | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const settings = await fetchWorkoutSettings();
        setGoal(mapSettingsFocusToGoal(settings.defaultFocus));
        setDifficulty(settings.defaultFocus === 'recovery' ? 'beginner' : 'intermediate');
      } catch {
        // Use local defaults.
      }
    })();
  }, []);

  const summary = useMemo(() => {
    return `${goal} · ${difficulty} · ${durationMinutes} min`;
  }, [difficulty, durationMinutes, goal]);

  const toggleMuscle = (muscle: string) => {
    setMuscleFocus((current) =>
      current.includes(muscle)
        ? current.filter((item) => item !== muscle)
        : [...current, muscle],
    );
  };

  const toggleEquipment = (item: (typeof EQUIPMENT)[number]['key']) => {
    setEquipment((current) =>
      current.includes(item)
        ? current.filter((entry) => entry !== item)
        : [...current, item],
    );
  };

  const handleGenerate = async () => {
    try {
      setLoading(true);
      const next = await doGenerateWorkout({
        goal,
        muscleFocus,
        equipment,
        durationMinutes,
        difficulty,
      });
      if (!next) {
        setError('No workout could be generated from the current inputs.');
        return;
      }
      setResult(next);
      setStep(3);
      setError(null);
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : 'Unable to generate workout.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!result) return;
    try {
      setSaving(true);
      const workoutId = await doSaveGeneratedWorkout({
        generationId: result.generationId,
        workout: result.workout,
      });
      router.push(`/workouts/session?workoutId=${workoutId}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save generated workout.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="AI Generator"
          title="Build a fresh session"
          description="Generate a desktop-ready workout with the local workouts engine, then save it directly into the shared library."
          actions={<ActionLink href="/workouts/builder" label="Open Builder" icon="build" secondary />}
        />
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {[1, 2, 3].map((value) => (
            <span key={value} style={chipStyle(step === value)}>
              Step {value}
            </span>
          ))}
          <span style={chipStyle(false)}>{summary}</span>
        </div>
      </WorkoutsSurface>

      {step <= 2 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.8fr)', gap: 18 }}>
          <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
            <SectionTitle eyebrow="Step 1" title="Goal and difficulty" description="Choose the shape and difficulty of the session before selecting target muscles." />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {GOALS.map((item) => (
                <button key={item.key} type="button" onClick={() => setGoal(item.key)} style={chipStyle(goal === item.key)}>
                  {item.label}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {(['beginner', 'intermediate', 'advanced'] as const).map((item) => (
                <button key={item} type="button" onClick={() => setDifficulty(item)} style={chipStyle(difficulty === item)}>
                  {item}
                </button>
              ))}
            </div>
            <button type="button" onClick={() => setStep(2)} style={chipStyle(true)}>
              Next
            </button>
          </WorkoutsSurface>

          <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
            <SectionTitle eyebrow="Step 2" title="Focus and equipment" description="Pick muscles, available gear, and target duration." />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {MUSCLES.map((item) => (
                <button key={item} type="button" onClick={() => toggleMuscle(item)} style={chipStyle(muscleFocus.includes(item))}>
                  {item}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {EQUIPMENT.map((item) => (
                <button key={item.key} type="button" onClick={() => toggleEquipment(item.key)} style={chipStyle(equipment.includes(item.key))}>
                  {item.label}
                </button>
              ))}
            </div>
            <label style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12 }}>Duration (minutes)</span>
              <input
                type="range"
                min={20}
                max={75}
                step={5}
                value={durationMinutes}
                onChange={(event) => setDurationMinutes(Number(event.target.value))}
              />
              <strong>{durationMinutes} minutes</strong>
            </label>
            <div style={{ display: 'flex', gap: 10 }}>
              <button type="button" onClick={() => setStep(1)} style={chipStyle(false)}>
                Back
              </button>
              <button type="button" onClick={() => void handleGenerate()} style={chipStyle(true)}>
                {loading ? 'Generating...' : 'Generate Workout'}
              </button>
            </div>
          </WorkoutsSurface>
        </div>
      ) : null}

      {step === 3 ? (
        result ? (
          <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
            <SectionTitle
              eyebrow="Result"
              title={result.workout.title}
              description={result.workout.description}
              aside={
                <div style={{ display: 'flex', gap: 10 }}>
                  <button type="button" onClick={() => setStep(2)} style={chipStyle(false)}>
                    Adjust Inputs
                  </button>
                  <button type="button" onClick={() => void handleSave()} style={chipStyle(true)}>
                    {saving ? 'Saving...' : 'Save And Start'}
                  </button>
                </div>
              }
            />
            <div style={{ display: 'grid', gap: 12 }}>
              {result.workout.exercises.map((exercise, index) => (
                <div key={`${exercise.exerciseId}-${index}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 12, padding: 16, borderRadius: 18, background: WORKOUTS_TOKENS.surfaceMid }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong>{exercise.name}</strong>
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                      {exercise.category}
                    </span>
                  </div>
                  <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 13 }}>
                    {exercise.sets} sets · {exercise.reps ? `${exercise.reps} reps` : `${exercise.duration ?? 0}s`}
                  </span>
                </div>
              ))}
            </div>
          </WorkoutsSurface>
        ) : (
          <EmptyState title="No generation yet" body="Run the generator to preview a new workout." />
        )
      ) : null}

      {error ? <div style={{ color: WORKOUTS_TOKENS.danger }}>{error}</div> : null}
    </div>
  );
}
