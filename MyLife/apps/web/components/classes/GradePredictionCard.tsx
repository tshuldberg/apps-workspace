'use client';

import { useMemo, useState } from 'react';
import {
  predictFinalGrade,
  type AssignmentRow,
  type CategoryWeights,
  type FinalPrediction,
} from '@mylife/classes';

export interface GradePredictionCardProps {
  className: string;
  accent: string;
  assignments: AssignmentRow[];
  weights: CategoryWeights | null;
  defaultTarget: number;
}

/**
 * Client-side what-if slider. Runs predictFinalGrade in-browser so the slider
 * is real-time. NEVER calls DB.
 */
export function GradePredictionCard({
  className,
  accent,
  assignments,
  weights,
  defaultTarget,
}: GradePredictionCardProps) {
  const [target, setTarget] = useState<number>(defaultTarget);

  const prediction = useMemo<FinalPrediction>(
    () => predictFinalGrade(assignments, weights, target),
    [assignments, weights, target],
  );

  const required = prediction.required_remaining_percent;
  const verdictTone = prediction.achievable
    ? 'var(--success, #30D158)'
    : 'var(--danger, #FFB4AB)';

  return (
    <div
      style={{
        borderRadius: 16,
        border: `1px solid ${accent}33`,
        background: 'var(--surface-elevated)',
        padding: 16,
        display: 'grid',
        gap: 12,
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          gap: 8,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          What if I get X% on remaining work for{' '}
          <span style={{ color: accent, fontWeight: 700 }}>{className}</span>?
        </div>
        <div style={{ fontSize: 18, fontWeight: 800, color: accent }}>
          Target {target.toFixed(0)}%
        </div>
      </div>

      <input
        type="range"
        min={50}
        max={100}
        step={1}
        value={target}
        onChange={(e) => setTarget(Number(e.target.value))}
        style={{
          width: '100%',
          accentColor: accent,
        }}
        aria-label={`Target percent for ${className}`}
      />

      <div style={{ display: 'grid', gap: 4 }}>
        {required === null ? (
          <div style={{ fontSize: 14, color: 'var(--text-secondary)' }}>
            {prediction.achievable
              ? 'Already meets target. No remaining work needed.'
              : 'No remaining work to grade. Out of reach.'}
          </div>
        ) : (
          <div style={{ fontSize: 14, color: 'var(--text)' }}>
            Need{' '}
            <span style={{ color: verdictTone, fontWeight: 700 }}>
              {required.toFixed(1)}%
            </span>{' '}
            avg on remaining work.
          </div>
        )}
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {prediction.achievable ? 'Achievable' : 'Out of reach'} · gap{' '}
          {(prediction.gap_points >= 0 ? '+' : '') + prediction.gap_points.toFixed(1)} pts
        </div>
      </div>

      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
        Default target {defaultTarget.toFixed(0)}%
      </div>
    </div>
  );
}
