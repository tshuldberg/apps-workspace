'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculateWarmupSets } from '@mylife/workouts';
import { fetchWorkoutToolDefaults } from '../../actions';
import {
  ActionLink,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  WORKOUTS_TOKENS,
} from '../../ui';

export default function WorkoutWarmupPage() {
  const [workingWeight, setWorkingWeight] = useState('225');
  const [barWeight, setBarWeight] = useState('45');

  useEffect(() => {
    void (async () => {
      const defaults = await fetchWorkoutToolDefaults();
      setBarWeight(String(defaults.barWeight));
    })();
  }, []);

  const sets = useMemo(() => {
    return calculateWarmupSets(Number(workingWeight) || 0, Number(barWeight) || 0);
  }, [barWeight, workingWeight]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Calculator"
          title="Warmup builder"
          description="Create a clean ramp-up from the empty bar to the top work weight."
          actions={<ActionLink href="/workouts/tools/plate-loader" label="Plate Loader" icon="fitness_center" secondary />}
        />
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.8fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle eyebrow="Inputs" title="Working set target" description="Warmup sets update immediately as you adjust the inputs." />
          <div style={{ display: 'grid', gap: 12 }}>
            <input value={workingWeight} onChange={(event) => setWorkingWeight(event.target.value)} type="number" style={{ border: 'none', outline: 'none', borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh, color: WORKOUTS_TOKENS.text, padding: '12px 14px' }} />
            <input value={barWeight} onChange={(event) => setBarWeight(event.target.value)} type="number" style={{ border: 'none', outline: 'none', borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh, color: WORKOUTS_TOKENS.text, padding: '12px 14px' }} />
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 14 }}>
          <SectionTitle eyebrow="Plan" title={`${sets.length} warmup sets`} description="Standard bar, 50%, 70%, 85% progression." />
          <div style={{ display: 'grid', gap: 10 }}>
            {sets.map((set) => (
              <div key={`${set.weight}-${set.percentage}`} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh }}>
                <span>{set.weight} lb</span>
                <strong>{set.reps} reps</strong>
              </div>
            ))}
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
