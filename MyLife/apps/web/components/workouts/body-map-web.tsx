'use client';

import { useCallback, useState } from 'react';
import dynamic from 'next/dynamic';
import type { MuscleGroup } from '@mylife/workouts';
import { MUSCLE_GROUP_LABELS } from '@mylife/workouts';

const Model = dynamic(() => import('react-body-highlighter'), { ssr: false });

const MUSCLE_GROUP_TO_WEB_SLUGS: Record<string, string[]> = {
  chest: ['chest'],
  back: ['upper-back', 'lower-back', 'trapezius'],
  shoulders: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
  forearms: ['forearm'],
  core: ['abs', 'obliques'],
  quads: ['quadriceps'],
  hamstrings: ['hamstring'],
  glutes: ['gluteal'],
  calves: ['calves'],
  hip_flexors: ['adductor', 'abductors'],
  neck: ['neck'],
  full_body: [
    'chest', 'upper-back', 'lower-back', 'trapezius', 'front-deltoids',
    'back-deltoids', 'biceps', 'triceps', 'forearm', 'abs', 'obliques',
    'quadriceps', 'hamstring', 'gluteal', 'calves', 'adductor', 'abductors', 'neck',
  ],
};

const WEB_SLUG_TO_MUSCLE_GROUP: Record<string, MuscleGroup> = {
  'chest': 'chest',
  'upper-back': 'back',
  'lower-back': 'back',
  'front-deltoids': 'shoulders',
  'back-deltoids': 'shoulders',
  'biceps': 'biceps',
  'triceps': 'triceps',
  'forearm': 'forearms',
  'abs': 'core',
  'obliques': 'core',
  'quadriceps': 'quads',
  'hamstring': 'hamstrings',
  'gluteal': 'glutes',
  'calves': 'calves',
  'adductor': 'hip_flexors',
  'abductors': 'hip_flexors',
  'neck': 'neck',
  'trapezius': 'back',
  'knees': 'quads',
};

interface WorkoutBodyMapWebProps {
  selectedMuscles: MuscleGroup[];
  onToggleMuscle: (muscle: MuscleGroup) => void;
}

export function WorkoutBodyMapWeb({ selectedMuscles, onToggleMuscle }: WorkoutBodyMapWebProps) {
  const [side, setSide] = useState<'anterior' | 'posterior'>('anterior');

  const handleClick = useCallback(
    (muscleStats: { muscle: string }) => {
      const group = WEB_SLUG_TO_MUSCLE_GROUP[muscleStats.muscle];
      if (group) {
        onToggleMuscle(group);
      }
    },
    [onToggleMuscle],
  );

  const highlightData = selectedMuscles.flatMap((group) => {
    const slugs = MUSCLE_GROUP_TO_WEB_SLUGS[group] ?? [];
    return slugs.map((slug) => ({
      name: MUSCLE_GROUP_LABELS[group] ?? group,
      muscles: [slug],
      frequency: 1,
    }));
  });

  return (
    <div style={styles.container}>
      <div style={styles.toggleRow}>
        <button
          type="button"
          style={side === 'anterior' ? styles.toggleActive : styles.toggle}
          onClick={() => setSide('anterior')}
        >
          Front
        </button>
        <button
          type="button"
          style={side === 'posterior' ? styles.toggleActive : styles.toggle}
          onClick={() => setSide('posterior')}
        >
          Back
        </button>
      </div>

      <div style={styles.modelWrap}>
        <Model
          type={side}
          data={highlightData as any}
          onClick={handleClick as any}
          bodyColor="#E5E7EB"
          highlightedColors={['#EF4444']}
          style={{ width: '100%', cursor: 'pointer' }}
        />
      </div>

      <div style={styles.chipRow}>
        {selectedMuscles.length === 0 ? (
          <span style={styles.chipEmpty}>Tap body to filter</span>
        ) : (
          selectedMuscles.map((m) => (
            <button
              key={m}
              type="button"
              style={styles.chip}
              onClick={() => onToggleMuscle(m)}
            >
              {MUSCLE_GROUP_LABELS[m] ?? m}
              <span style={styles.chipX}>&times;</span>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 12,
  },
  toggleRow: {
    display: 'flex',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border)',
    overflow: 'hidden',
  },
  toggle: {
    padding: '6px 20px',
    fontSize: 13,
    fontWeight: 600,
    background: 'var(--surface)',
    color: 'var(--text-secondary)',
    border: 'none',
    cursor: 'pointer',
  },
  toggleActive: {
    padding: '6px 20px',
    fontSize: 13,
    fontWeight: 600,
    background: '#EF4444',
    color: '#fff',
    border: 'none',
    cursor: 'pointer',
  },
  modelWrap: {
    width: '100%',
    maxWidth: 260,
  },
  chipRow: {
    display: 'flex',
    flexWrap: 'wrap' as const,
    gap: 6,
    justifyContent: 'center',
    minHeight: 32,
    alignItems: 'center',
  },
  chipEmpty: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 4,
    padding: '4px 10px',
    fontSize: 12,
    fontWeight: 600,
    borderRadius: '999px',
    border: '1px solid #EF4444',
    background: 'rgba(239, 68, 68, 0.12)',
    color: '#EF4444',
    cursor: 'pointer',
  },
  chipX: {
    fontSize: 14,
    lineHeight: 1,
  },
};
