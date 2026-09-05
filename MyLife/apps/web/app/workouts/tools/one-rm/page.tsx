'use client';

import { useMemo, useState } from 'react';
import { calculate1RM, type OneRMFormula } from '@mylife/workouts';
import {
  ActionLink,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../../ui';

export default function WorkoutOneRmPage() {
  const [weight, setWeight] = useState('185');
  const [reps, setReps] = useState('5');
  const [formula, setFormula] = useState<OneRMFormula>('epley');

  const estimate = useMemo(() => {
    return calculate1RM(Number(weight) || 0, Number(reps) || 0, formula);
  }, [formula, reps, weight]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Calculator"
          title="One-rep max"
          description="Estimate your top single from a heavier working set and pivot straight into warmup or plate loading."
          actions={<ActionLink href="/workouts/tools/warmup" label="Warmup Calculator" icon="local_fire_department" secondary />}
        />
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.8fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Inputs"
            title="Working set"
            description="Pick the formula you want and adjust the working set values."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <input value={weight} onChange={(event) => setWeight(event.target.value)} type="number" style={{ border: 'none', outline: 'none', borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh, color: WORKOUTS_TOKENS.text, padding: '12px 14px' }} />
            <input value={reps} onChange={(event) => setReps(event.target.value)} type="number" style={{ border: 'none', outline: 'none', borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh, color: WORKOUTS_TOKENS.text, padding: '12px 14px' }} />
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['epley', 'brzycki'] as const).map((item) => (
              <button key={item} type="button" onClick={() => setFormula(item)} style={chipStyle(formula === item)}>
                {item}
              </button>
            ))}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 14 }}>
          <SectionTitle
            eyebrow="Estimate"
            title={`${estimate}`}
            description="Projected one-rep max from the current working set."
          />
          <ActionLink href="/workouts/tools/plate-loader" label="Open Plate Loader" icon="fitness_center" />
        </WorkoutsSurface>
      </div>
    </div>
  );
}
