'use client';

import { useCallback, useEffect, useState } from 'react';
import { Activity, HeartPulse } from 'lucide-react';
import { fetchCycleSymptomAnalysisBundle } from '../actions';
import { PHASE_COLORS, TOKENS, eyebrowStyle, ghostButtonStyle, panelStyle, subtitleStyle, titleStyle } from '../ui';
import { formatPhaseLabel, formatSymptomLabel } from '../utils';

type SymptomData = Awaited<ReturnType<typeof fetchCycleSymptomAnalysisBundle>>;

export default function CycleSymptomsPage() {
  const [data, setData] = useState<SymptomData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCycleSymptomAnalysisBundle();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load symptom insights');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return <div style={{ ...panelStyle('mid'), minHeight: 540, opacity: 0.5, animation: 'pulse 2s infinite' }} />;
  }

  if (error || !data) {
    return (
      <div style={{ ...panelStyle('mid'), padding: 36, maxWidth: 520, margin: '48px auto', textAlign: 'center' }}>
        <p style={{ color: TOKENS.danger, fontWeight: 700, marginBottom: 18 }}>{error ?? 'Failed to load symptom insights'}</p>
        <button type="button" onClick={() => void load()} style={ghostButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (!data.hasSymptoms) {
    return (
      <div style={{ ...panelStyle('mid'), padding: '64px 32px', textAlign: 'center' }}>
        <h1 style={{ ...titleStyle, marginBottom: 14 }}>No symptom patterns yet</h1>
        <p style={{ ...subtitleStyle, maxWidth: 520, margin: '0 auto' }}>
          Log cramps, mood, bloating, fatigue, and other signals from the daily log to unlock your physical and emotional phase analysis.
        </p>
      </div>
    );
  }

  return (
    <div className="cy-section-stack">
      <div className="cy-grid-2">
        {data.topPhysical ? (
          <section style={{ ...panelStyle('mid'), padding: 26 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
              <div>
                <p style={eyebrowStyle}>Physical Tracking</p>
                <h1 style={{ ...titleStyle, fontSize: 30, marginTop: 10 }}>{formatSymptomLabel(data.topPhysical.symptom)}</h1>
                <p style={{ ...subtitleStyle, marginTop: 10 }}>
                  Logged {data.topPhysical.totalCount} times • peaks in your {formatPhaseLabel(data.topPhysical.dominantPhase).toLowerCase()} phase.
                </p>
              </div>
              <HeartPulse size={24} color={PHASE_COLORS[data.topPhysical.dominantPhase]} strokeWidth={2.1} />
            </div>
            <PhaseBars pattern={data.topPhysical.byPhase} />
          </section>
        ) : null}

        <section style={{ ...panelStyle('low'), padding: 26 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'flex-start' }}>
            <div>
              <p style={eyebrowStyle}>Emotional State</p>
              <h2 style={{ fontSize: 28, fontWeight: 800, marginTop: 10 }}>
                {data.topMood ? formatSymptomLabel(data.topMood.symptom) : 'Mood patterns'}
              </h2>
              <p style={{ ...subtitleStyle, marginTop: 10 }}>
                {data.topMood
                  ? `${Math.round(data.topMood.phaseConcentration * 100)}% of logged ${formatSymptomLabel(data.topMood.symptom).toLowerCase()} entries cluster in ${formatPhaseLabel(data.topMood.dominantPhase).toLowerCase()}.`
                  : 'Keep logging mood to reveal stronger emotional arcs.'}
              </p>
            </div>
            <Activity size={24} color={TOKENS.accentLight} strokeWidth={2.1} />
          </div>

          <div style={{ display: 'grid', gap: 12, marginTop: 20 }}>
            {data.topMoodPatterns.map((pattern) => (
              <div key={pattern.symptom} style={{ ...panelStyle('base'), padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
                <span style={{ fontSize: 15, fontWeight: 700 }}>{formatSymptomLabel(pattern.symptom)}</span>
                <span style={{ color: PHASE_COLORS[pattern.dominantPhase], fontWeight: 800 }}>
                  {Math.round(pattern.phaseConcentration * 100)}%
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <section style={{ ...panelStyle('low'), padding: 26 }}>
        <p style={eyebrowStyle}>Symptom Frequency</p>
        <div className="cy-grid-3" style={{ marginTop: 18 }}>
          {data.physicalTiles.map((tile) => (
            <div key={tile.symptom} style={{ ...panelStyle('base'), padding: 18 }}>
              <h3 style={{ fontSize: 18, fontWeight: 800 }}>{formatSymptomLabel(tile.symptom)}</h3>
              <p style={{ ...subtitleStyle, marginTop: 8 }}>Logged {tile.count} times</p>
              <div style={{ height: 12, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden', marginTop: 14 }}>
                <div style={{ width: `${tile.intensityPct}%`, height: '100%', borderRadius: 999, background: PHASE_COLORS[tile.phase] }} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...panelStyle('low'), padding: 26 }}>
        <p style={eyebrowStyle}>Pattern Notes</p>
        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {data.insightRows.map((row) => (
            <div key={row} style={{ ...panelStyle('base'), padding: 18 }}>
              <p style={subtitleStyle}>{row}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function PhaseBars({
  pattern,
}: {
  pattern: Record<'menstrual' | 'follicular' | 'ovulation' | 'luteal', number>;
}) {
  const max = Math.max(1, ...Object.values(pattern));
  return (
    <div style={{ display: 'grid', gap: 14, marginTop: 24 }}>
      {(Object.entries(pattern) as Array<[keyof typeof pattern, number]>).map(([phase, count]) => (
        <div key={phase} style={{ display: 'grid', gap: 6 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{formatPhaseLabel(phase)}</span>
            <span style={{ color: TOKENS.textSecondary, fontSize: 12 }}>{count}</span>
          </div>
          <div style={{ height: 10, borderRadius: 999, background: 'rgba(255,255,255,0.05)', overflow: 'hidden' }}>
            <div style={{ width: `${Math.max(8, (count / max) * 100)}%`, height: '100%', borderRadius: 999, background: PHASE_COLORS[phase] }} />
          </div>
        </div>
      ))}
    </div>
  );
}
