import Link from 'next/link';
import {
  fetchSurfForecast,
  fetchSurfHomeCards,
  fetchSurfNarrative,
} from '../actions';
import { SURF_TEXT_SECONDARY, SurfHero, SurfPanel, surfSlug } from '../ui';

export default async function SurfRatingsPage() {
  const cards = await fetchSurfHomeCards();
  const focus = cards[0];

  if (!focus) {
    return <div style={{ color: SURF_TEXT_SECONDARY }}>No ratings available.</div>;
  }

  const forecast = await fetchSurfForecast(focus.spot.id, 3);
  const narrative = await fetchSurfNarrative({ spotId: focus.spot.id });
  const point = forecast[0];
  const breakdown = [
    { label: 'Swell Energy', weight: 45, score: Math.min(100, Math.round(((point?.energyKj ?? 180) / 400) * 100)) },
    { label: 'Wind', weight: 30, score: Math.max(15, 100 - Math.round((point?.windKts ?? 12) * 3)) },
    { label: 'Tide', weight: 15, score: Math.max(20, 100 - Math.round(Math.abs((point?.tideHeightFt ?? 2.5) - 2.5) * 18)) },
    { label: 'Consistency', weight: 10, score: point?.consistency ?? 70 },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <SurfHero
        eyebrow="Ratings Explorer"
        title={`${focus.spot.name} rating model.`}
        description="Inspect the exact mix of swell energy, wind, tide, and consistency that powers the spot score."
        actions={<Link href={`/surf/spot/${surfSlug(focus.spot.name)}`} style={linkStyle}>Open spot detail</Link>}
      />

      <div style={{ display: 'grid', gridTemplateColumns: '0.8fr 1.2fr', gap: 16 }}>
        <SurfPanel eyebrow="Overall" title={`${focus.days[0]?.rating.toFixed(1) ?? '0.0'} / 5`}>
          <p style={{ margin: 0, color: SURF_TEXT_SECONDARY, lineHeight: 1.7 }}>
            {narrative?.summary ?? 'Daily rating narrative unavailable.'}
          </p>
        </SurfPanel>

        <SurfPanel eyebrow="Breakdown" title="Weighted Factors">
          <div style={{ display: 'grid', gap: 14 }}>
            {breakdown.map((item) => (
              <div key={item.label} style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: SURF_TEXT_SECONDARY, fontSize: 13 }}>
                  <span>{item.label}</span>
                  <span>{item.weight}% · {item.score}</span>
                </div>
                <div style={{ height: 8, borderRadius: 999, background: 'var(--surface)' }}>
                  <div style={{ width: `${item.score}%`, height: '100%', borderRadius: 999, background: 'var(--accent-surf)' }} />
                </div>
              </div>
            ))}
          </div>
        </SurfPanel>
      </div>

      <SurfPanel eyebrow="History" title="7-Day Rating Trend">
        <div style={{ display: 'flex', alignItems: 'end', gap: 10, minHeight: 220 }}>
          {focus.days.slice(0, 7).map((day) => (
            <div key={day.date} style={{ flex: 1, display: 'grid', justifyItems: 'center', gap: 10 }}>
              <div
                style={{
                  width: '100%',
                  height: `${Math.max(30, day.rating * 34)}px`,
                  borderRadius: '16px 16px 6px 6px',
                  background: 'linear-gradient(180deg, rgba(59,130,246,0.85), rgba(59,130,246,0.24))',
                }}
              />
              <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 12 }}>{day.label}</span>
            </div>
          ))}
        </div>
      </SurfPanel>
    </div>
  );
}

const linkStyle = {
  borderRadius: 999,
  padding: '10px 16px',
  textDecoration: 'none',
  fontWeight: 700,
  fontSize: 13,
  color: 'var(--background)',
  background: 'var(--accent-surf)',
} as const;
