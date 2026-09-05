'use client';

import { useEffect, useMemo, useState } from 'react';
import { calculatePlates, type WeightUnit } from '@mylife/workouts';
import { fetchWorkoutToolDefaults } from '../../actions';
import {
  ActionLink,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../../ui';

export default function WorkoutPlateLoaderPage() {
  const [targetWeight, setTargetWeight] = useState('225');
  const [barWeight, setBarWeight] = useState('45');
  const [unit, setUnit] = useState<WeightUnit>('lbs');

  useEffect(() => {
    void (async () => {
      const defaults = await fetchWorkoutToolDefaults();
      setBarWeight(String(defaults.barWeight));
      setUnit(defaults.unit);
    })();
  }, []);

  const result = useMemo(() => {
    return calculatePlates(Number(targetWeight) || 0, Number(barWeight) || 0, unit);
  }, [barWeight, targetWeight, unit]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Calculator"
          title="Plate loader"
          description="Break a target barbell weight into per-side plates using the same shared workouts utility used by mobile."
          actions={<ActionLink href="/workouts/tools/one-rm" label="1RM Calculator" icon="calculate" secondary />}
        />
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(320px, 0.8fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle eyebrow="Inputs" title="Load target" description="Adjust bar weight and unit before the breakdown updates." />
          <div style={{ display: 'grid', gap: 12 }}>
            <input value={targetWeight} onChange={(event) => setTargetWeight(event.target.value)} type="number" style={{ border: 'none', outline: 'none', borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh, color: WORKOUTS_TOKENS.text, padding: '12px 14px' }} />
            <input value={barWeight} onChange={(event) => setBarWeight(event.target.value)} type="number" style={{ border: 'none', outline: 'none', borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh, color: WORKOUTS_TOKENS.text, padding: '12px 14px' }} />
            <div style={{ display: 'flex', gap: 8 }}>
              {(['lbs', 'kg'] as const).map((item) => (
                <button key={item} type="button" onClick={() => setUnit(item)} style={chipStyle(unit === item)}>
                  {item}
                </button>
              ))}
            </div>
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 14 }}>
          <SectionTitle
            eyebrow="Per Side"
            title={`${result.totalWeight} ${unit}`}
            description={result.remainder > 0 ? `${result.remainder} ${unit} could not be loaded exactly.` : 'Exact load available.'}
          />
          <div style={{ display: 'grid', gap: 10 }}>
            {result.perSide.map((plate) => (
              <div key={plate.weight} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 16, background: WORKOUTS_TOKENS.surfaceHigh }}>
                <span>{plate.weight} {unit}</span>
                <strong>× {plate.count}</strong>
              </div>
            ))}
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
