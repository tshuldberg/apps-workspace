import { fetchSurfForecast, fetchSurfHomeCards } from '../actions';
import { SURF_TEXT, SURF_TEXT_SECONDARY, SurfHero, SurfPanel } from '../ui';

export default async function SurfSwellPage() {
  const cards = await fetchSurfHomeCards();
  const focus = cards[0];

  if (!focus) {
    return <div style={{ color: SURF_TEXT_SECONDARY }}>No swell data available.</div>;
  }

  const points = await fetchSurfForecast(focus.spot.id, 4);
  const primary = points[0];
  const secondary = points[1];
  const tertiary = points[2];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <SurfHero
        eyebrow="Swell Components"
        title={`Directional energy for ${focus.spot.name}.`}
        description="Break out the primary and secondary swells, compare energy, and monitor where combined swell pushes the lineup."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.1fr 0.8fr', gap: 16 }}>
        {[primary, secondary, tertiary].filter(Boolean).map((point, index) => (
          <SurfPanel
            key={point?.timestamp}
            eyebrow={index === 0 ? 'Primary' : index === 1 ? 'Secondary' : 'Tertiary'}
            title={`${point?.waveHeightFt.toFixed(1)} ft @ ${point?.periodSec.toFixed(0)}s`}
          >
            <div style={tileStyle}>
              <span style={{ color: SURF_TEXT_SECONDARY }}>Direction</span>
              <strong style={{ color: SURF_TEXT }}>{point?.windDir}</strong>
            </div>
            <div style={tileStyle}>
              <span style={{ color: SURF_TEXT_SECONDARY }}>Energy</span>
              <strong style={{ color: SURF_TEXT }}>{point?.energyKj} kJ</strong>
            </div>
          </SurfPanel>
        ))}
      </div>

      <SurfPanel eyebrow="Rose" title="Combined Swell Visualization">
        <div
          style={{
            minHeight: 280,
            borderRadius: 24,
            display: 'grid',
            placeItems: 'center',
            background:
              'radial-gradient(circle, rgba(59,130,246,0.2), rgba(59,130,246,0) 55%), #0F1724',
            border: '1px solid rgba(59,130,246,0.18)',
          }}
        >
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 60, marginBottom: 12 }}>{'\u25CE'}</div>
            <p style={{ margin: 0, color: SURF_TEXT }}>
              Directional rose placeholder for multiple swell sources.
            </p>
            <p style={{ margin: '6px 0 0', color: SURF_TEXT_SECONDARY }}>
              Primary energy is currently strongest from {primary?.windDir ?? 'W'}.
            </p>
          </div>
        </div>
      </SurfPanel>
    </div>
  );
}

const tileStyle = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 18,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const;
