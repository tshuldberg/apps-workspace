import { fetchSurfForecast, fetchSurfHomeCards } from '../actions';
import {
  SURF_CONDITION_COLORS,
  SURF_TEXT,
  SURF_TEXT_SECONDARY,
  SurfHero,
  SurfPanel,
} from '../ui';

export default async function SurfForecastPage() {
  const cards = await fetchSurfHomeCards();
  const focus = cards[0];

  if (!focus) {
    return <div style={{ color: SURF_TEXT_SECONDARY }}>No surf spots available yet.</div>;
  }

  const forecast = await fetchSurfForecast(focus.spot.id, 7);
  const rows = forecast.slice(0, 14);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <SurfHero
        eyebrow="Forecast Dashboard"
        title={`${focus.spot.name} leads the next 7 days.`}
        description="Stack swell components, wind windows, and tide timing into a single desktop forecast grid."
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <SurfPanel eyebrow="Swell" title="Swell Components">
          {rows.slice(0, 3).map((point) => (
            <div key={point.timestamp} style={tileStyle}>
              <strong style={{ color: SURF_TEXT }}>{point.waveHeightFt.toFixed(1)} ft</strong>
              <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 13 }}>
                {point.periodSec.toFixed(0)}s · {point.windDir}
              </span>
            </div>
          ))}
        </SurfPanel>
        <SurfPanel eyebrow="Wind" title="Wind Map">
          {rows.slice(0, 4).map((point) => (
            <div key={point.timestamp} style={tileStyle}>
              <strong style={{ color: SURF_TEXT }}>{point.windKts.toFixed(0)} kts</strong>
              <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 13 }}>{point.windDir}</span>
            </div>
          ))}
        </SurfPanel>
        <SurfPanel eyebrow="Tide" title="Tide Profile">
          {rows.slice(0, 4).map((point) => (
            <div key={point.timestamp} style={tileStyle}>
              <strong style={{ color: SURF_TEXT }}>{point.tideHeightFt.toFixed(1)} ft</strong>
              <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 13 }}>
                {new Date(point.timestamp).toLocaleTimeString([], { hour: 'numeric' })}
              </span>
            </div>
          ))}
        </SurfPanel>
      </div>

      <SurfPanel eyebrow="7-Day Table" title="Forecast Windows">
        <div style={{ display: 'grid', gap: 10 }}>
          {rows.map((point) => (
            <div key={point.timestamp} style={rowStyle}>
              <strong style={{ color: SURF_TEXT, width: 110 }}>
                {new Date(point.timestamp).toLocaleDateString([], { weekday: 'short', hour: 'numeric' })}
              </strong>
              <span style={{ color: SURF_TEXT_SECONDARY }}>{point.waveHeightFt.toFixed(1)} ft</span>
              <span style={{ color: SURF_TEXT_SECONDARY }}>{point.periodSec.toFixed(0)}s</span>
              <span style={{ color: SURF_TEXT_SECONDARY }}>{point.windKts.toFixed(0)} kts</span>
              <span style={{ color: SURF_TEXT_SECONDARY }}>{point.tideHeightFt.toFixed(1)} ft</span>
              <span
                style={{
                  marginLeft: 'auto',
                  color: SURF_CONDITION_COLORS[point.conditionColor] ?? SURF_TEXT,
                  fontWeight: 700,
                }}
              >
                {point.rating.toFixed(1)}
              </span>
            </div>
          ))}
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

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  borderRadius: 18,
  background: 'var(--surface)',
  border: '1px solid var(--border)',
} as const;
