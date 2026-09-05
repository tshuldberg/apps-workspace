'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { fetchCyclePredictionBundle } from '../actions';
import { PHASE_COLORS, TOKENS, eyebrowStyle, ghostButtonStyle, panelStyle, subtitleStyle, titleStyle } from '../ui';
import { formatSymptomLabel } from '../utils';

type PredictionData = Awaited<ReturnType<typeof fetchCyclePredictionBundle>>;

export default function CyclePredictionsPage() {
  const [data, setData] = useState<PredictionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const next = await fetchCyclePredictionBundle();
      setData(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load predictions');
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
        <p style={{ color: TOKENS.danger, fontWeight: 700, marginBottom: 18 }}>{error ?? 'Failed to load predictions'}</p>
        <button type="button" onClick={() => void load()} style={ghostButtonStyle}>
          Retry
        </button>
      </div>
    );
  }

  if (!data.predictionAvailable) {
    return (
      <div style={{ ...panelStyle('mid'), padding: '64px 32px', textAlign: 'center' }}>
        <h1 style={{ ...titleStyle, marginBottom: 14 }}>More data sharpens your forecast</h1>
        <p style={{ ...subtitleStyle, maxWidth: 520, margin: '0 auto' }}>{data.heroLabel}</p>
      </div>
    );
  }

  return (
    <div className="cy-section-stack">
      <section className="cy-home-grid">
        <div
          style={{
            ...panelStyle('mid'),
            padding: 28,
            background:
              'radial-gradient(circle at top left, rgba(255,184,119,0.18), transparent 34%), linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
          }}
        >
          <p style={eyebrowStyle}>Coming Up</p>
          <h1 style={{ ...titleStyle, marginTop: 10 }}>Next Period</h1>
          <p style={{ ...subtitleStyle, marginTop: 12 }}>{data.heroLabel}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 28, alignItems: 'center', marginTop: 24 }}>
            <ConfidenceRing percent={data.confidencePct} />
            <div style={{ display: 'grid', gap: 14 }}>
              <StatRow label="Forecast confidence" value={`${data.confidencePct}%`} />
              <StatRow label="Fertile range" value={data.fertileRange} />
              <StatRow label="Peak signal" value={data.peakLabel} />
            </div>
          </div>
        </div>

        <div style={{ ...panelStyle('low'), padding: 24 }}>
          <p style={eyebrowStyle}>Forecast Method</p>
          <h2 style={{ fontSize: 22, fontWeight: 800, marginTop: 10 }}>Weighted moving average</h2>
          <p style={{ ...subtitleStyle, marginTop: 10 }}>
            The forecast leans harder on recent completed cycles while still keeping longer-term history in the model.
          </p>
        </div>
      </section>

      <section style={{ ...panelStyle('low'), padding: 26 }}>
        <p style={eyebrowStyle}>Fertile Window</p>
        <h2 style={{ fontSize: 24, fontWeight: 800, marginTop: 10 }}>{data.fertileRange}</h2>
        <p style={{ ...subtitleStyle, marginTop: 10 }}>{data.peakLabel}</p>
        <div style={{ display: 'flex', gap: 12, alignItems: 'end', marginTop: 24 }}>
          {data.fertileBars.map((bar) => (
            <div key={bar.date} style={{ flex: 1, display: 'grid', gap: 10, justifyItems: 'center' }}>
              <div style={{ width: '100%', height: 120, borderRadius: 999, background: 'rgba(255,255,255,0.05)', display: 'flex', alignItems: 'end', padding: 6 }}>
                <div
                  style={{
                    width: '100%',
                    height: `${Math.max(12, bar.intensity * 100)}%`,
                    borderRadius: 999,
                    background: bar.isPeak ? TOKENS.accent : PHASE_COLORS.ovulation,
                  }}
                />
              </div>
              <span style={{ fontSize: 12, color: TOKENS.textSecondary }}>{bar.date.slice(5)}</span>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...panelStyle('low'), padding: 26 }}>
        <p style={eyebrowStyle}>Symptom Forecast</p>
        <div style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          {data.symptomRows.map((row) => (
            <div key={row.symptom} style={{ ...panelStyle('base'), padding: 18 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 800 }}>{formatSymptomLabel(row.symptom)}</h3>
                  <p style={{ ...subtitleStyle, marginTop: 6 }}>Most associated with your upcoming phase.</p>
                </div>
                <span style={{ color: PHASE_COLORS[row.phase], fontWeight: 800 }}>{row.percentage}%</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ ...panelStyle('low'), padding: 26 }}>
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          style={{ ...ghostButtonStyle, width: '100%', justifyContent: 'space-between', display: 'flex' }}
        >
          <span>Cycle health guide</span>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
        {expanded ? (
          <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
            {[
              'Forecast confidence improves when you log complete cycles with period length and symptom detail.',
              'Large changes in sleep, stress, illness, or training load can temporarily shift cycle timing.',
              'Use predictions as planning signals, not medical certainty. Sudden or extreme changes deserve attention.',
            ].map((copy) => (
              <div key={copy} style={{ ...panelStyle('base'), padding: 16 }}>
                <p style={subtitleStyle}>{copy}</p>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

function ConfidenceRing({ percent }: { percent: number }) {
  const circumference = 534.07;
  const offset = circumference - (Math.max(0, Math.min(100, percent)) / 100) * circumference;
  return (
    <div style={{ width: 210, height: 210, position: 'relative', margin: '0 auto' }}>
      <svg viewBox="0 0 210 210" style={{ width: '100%', height: '100%' }}>
        <circle cx="105" cy="105" r="85" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="14" />
        <circle
          cx="105"
          cy="105"
          r="85"
          fill="none"
          stroke={TOKENS.accent}
          strokeWidth="14"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 105 105)"
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        <div>
          <p style={eyebrowStyle}>Confidence</p>
          <p style={{ fontSize: 54, fontWeight: 800, letterSpacing: '-0.04em', marginTop: 10 }}>{percent}%</p>
        </div>
      </div>
    </div>
  );
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ ...panelStyle('base'), padding: 16, display: 'flex', justifyContent: 'space-between', gap: 16 }}>
      <span style={{ color: TOKENS.textSecondary, fontSize: 13, fontWeight: 700 }}>{label}</span>
      <span style={{ fontSize: 14, fontWeight: 800 }}>{value}</span>
    </div>
  );
}
