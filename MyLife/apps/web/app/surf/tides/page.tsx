import { fetchSurfForecast, fetchSurfHomeCards } from '../actions';
import { SURF_TEXT, SURF_TEXT_SECONDARY, SurfHero, SurfPanel } from '../ui';

export default async function SurfTidesPage() {
  const cards = await fetchSurfHomeCards();
  const focus = cards[0];

  if (!focus) {
    return <div style={{ color: SURF_TEXT_SECONDARY }}>No tide data available.</div>;
  }

  const points = await fetchSurfForecast(focus.spot.id, 3);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <SurfHero
        eyebrow="Tide Predictions"
        title={`Tide curve for ${focus.spot.name}.`}
        description="Track tide transitions, glance at high and low windows, and align the best part of the day with swell and wind."
      />

      <SurfPanel eyebrow="Interactive" title="Current Tide Curve">
        <div style={{ display: 'grid', gap: 14 }}>
          {points.slice(0, 10).map((point) => (
            <div key={point.timestamp} style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: SURF_TEXT_SECONDARY, fontSize: 13 }}>
                <span>{new Date(point.timestamp).toLocaleTimeString([], { hour: 'numeric' })}</span>
                <span>{point.tideHeightFt.toFixed(1)} ft</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: 'var(--surface)' }}>
                <div
                  style={{
                    width: `${Math.min(100, Math.max(10, ((point.tideHeightFt + 1.2) / 8.7) * 100))}%`,
                    height: '100%',
                    borderRadius: 999,
                    background: 'var(--accent-surf)',
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </SurfPanel>

      <SurfPanel eyebrow="7-Day Table" title="High And Low Tide Windows">
        <div style={{ display: 'grid', gap: 10 }}>
          {points.slice(0, 12).map((point) => (
            <div key={point.timestamp} style={rowStyle}>
              <strong style={{ color: SURF_TEXT }}>
                {new Date(point.timestamp).toLocaleDateString([], { weekday: 'short', hour: 'numeric' })}
              </strong>
              <span style={{ color: SURF_TEXT_SECONDARY }}>{point.tideHeightFt.toFixed(1)} ft</span>
              <span style={{ color: SURF_TEXT_SECONDARY }}>{point.waveHeightFt.toFixed(1)} ft surf</span>
            </div>
          ))}
        </div>
      </SurfPanel>
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const;
