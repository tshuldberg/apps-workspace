/**
 * Phase 4a Insights — Trends panel (web).
 *
 * Client component: user picks a single metric from the permitted modules,
 * and the panel calls `fetchTrendsAction` to retrieve a 30-day series.
 * Renders as an inline-SVG sparkline.
 */
'use client';

import { useState, useTransition } from 'react';
import { fetchTrendsAction } from '@/app/actions';
import type { TrendResult } from '@mylife/intelligence';

interface MetricOption {
  moduleId: string;
  moduleName: string;
  metric: string;
  label: string;
  unit: string;
}

interface Props {
  modules: Array<{
    id: string;
    name: string;
    series: Array<{ metric: string; label: string; unit: string }>;
  }>;
}

export function TrendsPanel({ modules }: Props) {
  const options: MetricOption[] = modules.flatMap((m) =>
    m.series.map((s) => ({
      moduleId: m.id,
      moduleName: m.name,
      metric: s.metric,
      label: s.label,
      unit: s.unit,
    })),
  );

  const [active, setActive] = useState<MetricOption | null>(options[0] ?? null);
  const [trend, setTrend] = useState<TrendResult | null>(null);
  const [, startTransition] = useTransition();

  function selectMetric(opt: MetricOption) {
    setActive(opt);
    startTransition(async () => {
      try {
        const result = await fetchTrendsAction(opt.moduleId, opt.metric);
        setTrend(result);
      } catch {
        setTrend(null);
      }
    });
  }

  if (options.length === 0) {
    return (
      <div style={emptyStyle}>
        <div style={emptyTitleStyle}>No trackable metrics</div>
        <p style={emptyBodyStyle}>
          Enable tracking modules like Budget, Habits, Meds, or Workouts to see
          trends here.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={chipRowStyle}>
        {options.map((opt) => {
          const isActive =
            active?.metric === opt.metric && active?.moduleId === opt.moduleId;
          return (
            <button
              key={`${opt.moduleId}-${opt.metric}`}
              type="button"
              onClick={() => selectMetric(opt)}
              aria-label={`metric-${opt.moduleId}-${opt.metric}`}
              style={{
                ...chipStyle,
                background: isActive ? '#FFB877' : 'rgba(255,255,255,0.03)',
                color: isActive ? '#131318' : '#E4E1E9',
                fontWeight: isActive ? 700 : 500,
                borderColor: isActive ? '#FFB877' : 'rgba(255,255,255,0.06)',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      <div style={resultCardStyle}>
        {trend && trend.points.length > 0 ? (
          <>
            <h3 style={titleStyle}>{trend.label}</h3>
            <div style={metaStyle}>
              {trend.points.length} days · {trend.unit}
            </div>
            <Sparkline points={trend.points} />
          </>
        ) : (
          <p style={bodyStyle}>
            {active
              ? `No data in the last 30 days for ${active.label}. Pick a different metric above.`
              : 'Pick a metric above to see its 30-day trend.'}
          </p>
        )}
      </div>
    </div>
  );
}

function Sparkline({ points }: { points: { date: string; value: number }[] }) {
  const width = 640;
  const height = 120;
  if (points.length === 0) return null;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = points.length > 1 ? width / (points.length - 1) : 0;
  const coords = points.map((p, i) => {
    const x = i * stepX;
    const y = height - ((p.value - min) / range) * (height - 16) - 8;
    return { x, y };
  });
  const d = coords.reduce(
    (acc, c, i) => acc + (i === 0 ? `M ${c.x} ${c.y}` : ` L ${c.x} ${c.y}`),
    '',
  );
  return (
    <svg
      width="100%"
      viewBox={`0 0 ${width} ${height}`}
      aria-label={`sparkline-${points.length}pts`}
      role="img"
    >
      <path d={d} stroke="#FFB877" strokeWidth={2} fill="none" />
      {coords.map((c, i) => (
        <circle key={i} cx={c.x} cy={c.y} r={3} fill="#FFB877" />
      ))}
    </svg>
  );
}

const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
  marginBottom: 16,
};
const chipStyle: React.CSSProperties = {
  padding: '6px 14px',
  borderRadius: 999,
  border: '1px solid rgba(255,255,255,0.06)',
  cursor: 'pointer',
  fontSize: 13,
  fontFamily: 'inherit',
  transition: 'background 160ms ease, color 160ms ease',
};
const resultCardStyle: React.CSSProperties = {
  background: '#2A292F',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 20,
};
const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: '#E4E1E9',
};
const metaStyle: React.CSSProperties = {
  color: '#D6C3B5',
  fontSize: 12,
  marginTop: 4,
  marginBottom: 12,
};
const bodyStyle: React.CSSProperties = {
  margin: 0,
  color: '#D6C3B5',
  fontSize: 14,
  lineHeight: 1.5,
};
const emptyStyle: React.CSSProperties = {
  padding: 40,
  textAlign: 'center',
  color: '#D6C3B5',
  background: '#2A292F',
  borderRadius: 12,
  border: '1px solid rgba(255, 255, 255, 0.06)',
};
const emptyTitleStyle: React.CSSProperties = {
  color: '#E4E1E9',
  fontSize: 16,
  fontWeight: 600,
  marginBottom: 8,
};
const emptyBodyStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 14,
  lineHeight: 1.5,
};
