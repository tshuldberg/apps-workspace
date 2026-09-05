'use client';

import { useState } from 'react';
import type { ChannelBreakdown, ComparisonPeriod, DayPartHeatmap } from '@/lib/analytics';
import { calculateComparison } from '@/lib/analytics';

type CompareMode = 'week' | 'month' | 'year';

// Mock data for demonstration
const MOCK_COVERS: Record<CompareMode, { current: number; previous: number }> = {
  week: { current: 47, previous: 42 },
  month: { current: 1340, previous: 1210 },
  year: { current: 16200, previous: 14800 },
};

const MOCK_REVPASH: Record<CompareMode, { current: number; previous: number }> = {
  week: { current: 25.0, previous: 22.5 },
  month: { current: 23.8, previous: 21.4 },
  year: { current: 22.1, previous: 20.0 },
};

const MOCK_NOSHOW: Record<CompareMode, { current: number; previous: number }> = {
  week: { current: 6.3, previous: 8.1 },
  month: { current: 7.2, previous: 9.0 },
  year: { current: 7.8, previous: 10.2 },
};

const MOCK_TURNTIME: Record<CompareMode, { current: number; previous: number }> = {
  week: { current: 72, previous: 78 },
  month: { current: 74, previous: 76 },
  year: { current: 73, previous: 80 },
};

const MOCK_CHANNELS: ChannelBreakdown[] = [
  { channel: 'web_widget', count: 142, noShowRate: 5.6 },
  { channel: 'phone', count: 89, noShowRate: 8.9 },
  { channel: 'walk_in', count: 67, noShowRate: 1.5 },
  { channel: 'mylife_app', count: 43, noShowRate: 2.3 },
];

function generateMockHeatmap(): DayPartHeatmap[] {
  const data: DayPartHeatmap[] = [];
  for (let day = 0; day < 7; day++) {
    for (let hour = 10; hour <= 23; hour++) {
      const isLunch = hour >= 11 && hour <= 14;
      const isDinner = hour >= 17 && hour <= 21;
      const isWeekend = day === 0 || day === 5 || day === 6;
      let base = 2;
      if (isLunch) base += 8;
      if (isDinner) base += 14;
      if (isWeekend) base += 4;
      const covers = base + Math.floor(Math.random() * 5);
      data.push({ hour, dayOfWeek: day, covers });
    }
  }
  return data;
}

const MOCK_HEATMAP = generateMockHeatmap();

function TrendArrow({ trend, changePercent }: { trend: ComparisonPeriod['trend']; changePercent: number }) {
  const color = trend === 'up' ? '#30D158' : trend === 'down' ? '#DC2626' : 'var(--text-secondary)';
  const arrow = trend === 'up' ? '\u2191' : trend === 'down' ? '\u2193' : '\u2192';
  return (
    <span style={{ color, fontWeight: 600, fontSize: '0.875rem' }}>
      {arrow} {Math.abs(changePercent).toFixed(1)}%
    </span>
  );
}

function CompareToggle({ mode, onChange }: { mode: CompareMode; onChange: (m: CompareMode) => void }) {
  const options: { value: CompareMode; label: string }[] = [
    { value: 'week', label: 'vs Last Week' },
    { value: 'month', label: 'vs Last Month' },
    { value: 'year', label: 'vs Last Year' },
  ];
  return (
    <div style={{ display: 'flex', gap: '0.25rem' }}>
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            padding: '0.25rem 0.5rem',
            fontSize: '0.75rem',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            background: mode === opt.value ? 'var(--accent)' : 'var(--surface-mid)',
            color: mode === opt.value ? '#fff' : 'var(--text-secondary)',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

function CsvButton({ label }: { label: string }) {
  return (
    <button
      onClick={() => alert(`CSV export for "${label}" is not yet implemented.`)}
      style={{
        padding: '0.25rem 0.5rem',
        fontSize: '0.75rem',
        borderRadius: '4px',
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
      }}
    >
      Export CSV
    </button>
  );
}

function MetricCard({
  title,
  value,
  unit,
  comparison,
  compareMode,
  onCompareChange,
  csvLabel,
  children,
}: {
  title: string;
  value: string;
  unit?: string;
  comparison: ComparisonPeriod;
  compareMode: CompareMode;
  onCompareChange: (m: CompareMode) => void;
  csvLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: 'var(--surface-low)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.75rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{title}</span>
        <CsvButton label={csvLabel} />
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.5rem' }}>
        <span style={{ fontSize: '2rem', fontWeight: 700, color: 'var(--text)' }}>{value}</span>
        {unit && <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{unit}</span>}
        <TrendArrow trend={comparison.trend} changePercent={comparison.changePercent} />
      </div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        vs {comparison.previous}{unit ? ` ${unit}` : ''} previous
      </div>
      {children}
      <CompareToggle mode={compareMode} onChange={onCompareChange} />
    </div>
  );
}

function HeatmapGrid({ data }: { data: DayPartHeatmap[] }) {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const hours = Array.from({ length: 14 }, (_, i) => i + 10); // 10am - 11pm
  const maxCovers = Math.max(...data.map((d) => d.covers), 1);

  function getCell(hour: number, day: number): number {
    return data.find((d) => d.hour === hour && d.dayOfWeek === day)?.covers ?? 0;
  }

  function getColor(covers: number): string {
    if (covers === 0) return 'var(--surface-mid)';
    const intensity = covers / maxCovers;
    const alpha = 0.2 + intensity * 0.8;
    return `rgba(220, 38, 38, ${alpha})`;
  }

  return (
    <div
      style={{
        background: 'var(--surface-low)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '1.25rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Day-Part Heatmap (Covers)</span>
        <CsvButton label="Heatmap" />
      </div>
      <div style={{ overflowX: 'auto' }}>
        <div style={{ display: 'grid', gridTemplateColumns: `40px repeat(${hours.length}, 1fr)`, gap: '2px' }}>
          {/* Header row */}
          <div />
          {hours.map((h) => (
            <div key={h} style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
              {h > 12 ? `${h - 12}p` : h === 12 ? '12p' : `${h}a`}
            </div>
          ))}
          {/* Data rows */}
          {days.map((dayName, dayIdx) => (
            <>
              <div key={`label-${dayIdx}`} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                {dayName}
              </div>
              {hours.map((hour) => {
                const covers = getCell(hour, dayIdx);
                return (
                  <div
                    key={`${dayIdx}-${hour}`}
                    title={`${dayName} ${hour}:00 - ${covers} covers`}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '3px',
                      background: getColor(covers),
                      minWidth: '16px',
                      minHeight: '16px',
                    }}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [coversMode, setCoversMode] = useState<CompareMode>('week');
  const [revpashMode, setRevpashMode] = useState<CompareMode>('week');
  const [noshowMode, setNoshowMode] = useState<CompareMode>('week');
  const [turnMode, setTurnMode] = useState<CompareMode>('week');

  const coversComp = calculateComparison(MOCK_COVERS[coversMode].current, MOCK_COVERS[coversMode].previous);
  const revpashComp = calculateComparison(MOCK_REVPASH[revpashMode].current, MOCK_REVPASH[revpashMode].previous);
  const noshowComp = calculateComparison(MOCK_NOSHOW[noshowMode].current, MOCK_NOSHOW[noshowMode].previous);
  const turnComp = calculateComparison(MOCK_TURNTIME[turnMode].current, MOCK_TURNTIME[turnMode].previous);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 600, color: 'var(--text)' }}>Analytics</h1>

      {/* Hero tile - Covers Today */}
      <div
        style={{
          background: 'linear-gradient(135deg, var(--surface-low), var(--surface-mid))',
          border: '1px solid var(--accent)',
          borderRadius: '16px',
          padding: '1.5rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Covers Today</span>
          <CsvButton label="Covers" />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.75rem' }}>
          <span style={{ fontSize: '3rem', fontWeight: 700, color: 'var(--text)' }}>
            {MOCK_COVERS[coversMode].current}
          </span>
          <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>
            vs {MOCK_COVERS[coversMode].previous} last {coversMode}
          </span>
          <TrendArrow trend={coversComp.trend} changePercent={coversComp.changePercent} />
        </div>
        <CompareToggle mode={coversMode} onChange={setCoversMode} />
      </div>

      {/* Metric cards grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '1rem',
        }}
      >
        <MetricCard
          title="RevPASH"
          value={`$${MOCK_REVPASH[revpashMode].current.toFixed(2)}`}
          unit="/seat-hr"
          comparison={revpashComp}
          compareMode={revpashMode}
          onCompareChange={setRevpashMode}
          csvLabel="RevPASH"
        />

        <MetricCard
          title="No-Show Rate"
          value={`${MOCK_NOSHOW[noshowMode].current.toFixed(1)}%`}
          comparison={noshowComp}
          compareMode={noshowMode}
          onCompareChange={setNoshowMode}
          csvLabel="No-Show Rate"
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem' }}>
            {MOCK_CHANNELS.map((ch) => (
              <div
                key={ch.channel}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>{ch.channel.replace('_', ' ')}</span>
                <span>{ch.noShowRate.toFixed(1)}% ({ch.count})</span>
              </div>
            ))}
          </div>
        </MetricCard>

        <MetricCard
          title="Avg Turn Time"
          value={`${MOCK_TURNTIME[turnMode].current}`}
          unit="min"
          comparison={turnComp}
          compareMode={turnMode}
          onCompareChange={setTurnMode}
          csvLabel="Turn Time"
        />
      </div>

      {/* Heatmap */}
      <HeatmapGrid data={MOCK_HEATMAP} />
    </div>
  );
}
