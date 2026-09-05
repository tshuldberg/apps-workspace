/**
 * Phase 4a Insights — Correlations panel (web).
 *
 * Client component: user picks module A × module B, panel calls
 * `fetchCorrelationAction` to retrieve every Pearson coefficient the engine
 * can compute for overlapping metric series. Renders coefficient + direction +
 * strength + a tiny inline-SVG scatter.
 */
'use client';

import { useEffect, useState, useTransition } from 'react';
import { fetchCorrelationAction } from '@/app/actions';
import type { CorrelationResult } from '@mylife/intelligence';

interface Props {
  modules: Array<{
    id: string;
    name: string;
    series: Array<{ metric: string; label: string; unit: string }>;
  }>;
}

function directionLabel(coefficient: number): 'positive' | 'negative' | 'none' {
  if (Math.abs(coefficient) < 0.1) return 'none';
  return coefficient > 0 ? 'positive' : 'negative';
}

export function CorrelationPanel({ modules }: Props) {
  const [aId, setAId] = useState<string | null>(modules[0]?.id ?? null);
  const [bId, setBId] = useState<string | null>(modules[1]?.id ?? null);
  const [results, setResults] = useState<CorrelationResult[]>([]);
  const [, startTransition] = useTransition();

  useEffect(() => {
    if (!aId || !bId || aId === bId) {
      setResults([]);
      return;
    }
    startTransition(async () => {
      try {
        const next = await fetchCorrelationAction(aId, bId);
        setResults(next);
      } catch {
        setResults([]);
      }
    });
  }, [aId, bId]);

  if (modules.length < 2) {
    return (
      <div style={emptyStyle}>
        <div style={emptyTitleStyle}>Not enough data yet</div>
        <p style={emptyBodyStyle}>
          Correlations need at least two modules with tracked metrics. Enable a
          second tracking module and log data for a week or two.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
        <ModulePicker label="Metric A" modules={modules} value={aId} onChange={setAId} />
        <ModulePicker label="Metric B" modules={modules} value={bId} onChange={setBId} />
      </div>

      {aId === bId ? (
        <div style={emptyStyle}>
          <p style={emptyBodyStyle}>Pick two different modules.</p>
        </div>
      ) : results.length === 0 ? (
        <div style={emptyStyle}>
          <div style={emptyTitleStyle}>No overlap</div>
          <p style={emptyBodyStyle}>
            Not enough overlapping days of data between these two modules yet.
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {results.map((r, i) => (
            <CorrelationCard key={i} result={r} />
          ))}
        </div>
      )}
    </div>
  );
}

function ModulePicker({
  label,
  modules,
  value,
  onChange,
}: {
  label: string;
  modules: Props['modules'];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <div style={pickerLabelStyle}>{label}</div>
      <div style={chipRowStyle}>
        {modules.map((m) => {
          const active = m.id === value;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              aria-label={`${label}-${m.id}`}
              style={{
                ...chipStyle,
                background: active ? '#FFB877' : 'rgba(255,255,255,0.03)',
                color: active ? '#131318' : '#E4E1E9',
                fontWeight: active ? 700 : 500,
                borderColor: active ? '#FFB877' : 'rgba(255,255,255,0.06)',
              }}
            >
              {m.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CorrelationCard({ result }: { result: CorrelationResult }) {
  const dir = directionLabel(result.coefficient);
  return (
    <div style={cardStyle}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={titleStyle}>
          {result.labelA} × {result.labelB}
        </div>
        <div style={coeffStyle}>r = {result.coefficient.toFixed(2)}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Pill label={dir} tone={dir} />
          <Pill label={result.strength} tone="neutral" />
          <Pill label={`${result.dataPoints}d`} tone="neutral" />
        </div>
      </div>
      <Scatter coefficient={result.coefficient} />
    </div>
  );
}

function Pill({
  label,
  tone,
}: {
  label: string;
  tone: 'positive' | 'negative' | 'none' | 'neutral';
}) {
  const bg =
    tone === 'positive'
      ? 'rgba(48, 209, 88, 0.14)'
      : tone === 'negative'
        ? 'rgba(255, 180, 171, 0.14)'
        : 'rgba(255,255,255,0.04)';
  const fg =
    tone === 'positive' ? '#30D158' : tone === 'negative' ? '#FFB4AB' : '#E4E1E9';
  return (
    <span
      style={{
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        padding: '2px 10px',
        borderRadius: 999,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
      }}
    >
      {label}
    </span>
  );
}

function Scatter({ coefficient }: { coefficient: number }) {
  const size = 140;
  const mid = size / 2;
  const r = Math.max(-1, Math.min(1, coefficient));
  const points = Array.from({ length: 24 }).map((_, i) => {
    const t = (i - 12) / 12;
    const noise = (((i * 9301 + 49297) % 233280) / 233280) * 0.6 - 0.3;
    const x = mid + t * (mid - 10);
    const y = mid - (t * r + noise * (1 - Math.abs(r))) * (mid - 10);
    return { x, y };
  });
  return (
    <svg width={size} height={size} aria-label={`scatter-${r.toFixed(2)}`} role="img">
      <rect x={0} y={0} width={size} height={size} fill="rgba(255,255,255,0.02)" rx={8} />
      <line x1={0} y1={mid} x2={size} y2={mid} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      <line x1={mid} y1={0} x2={mid} y2={size} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={3} fill="#FFB877" />
      ))}
    </svg>
  );
}

const pickerLabelStyle: React.CSSProperties = {
  color: '#D6C3B5',
  fontSize: 11,
  letterSpacing: 1,
  textTransform: 'uppercase',
  marginBottom: 6,
};
const chipRowStyle: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  flexWrap: 'wrap',
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
const cardStyle: React.CSSProperties = {
  display: 'flex',
  gap: 20,
  alignItems: 'center',
  background: '#2A292F',
  border: '1px solid rgba(255, 255, 255, 0.06)',
  borderRadius: 12,
  padding: 20,
};
const titleStyle: React.CSSProperties = {
  color: '#E4E1E9',
  fontSize: 15,
  fontWeight: 600,
};
const coeffStyle: React.CSSProperties = {
  color: '#FFB877',
  fontSize: 28,
  fontWeight: 700,
};
const emptyStyle: React.CSSProperties = {
  padding: 28,
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
