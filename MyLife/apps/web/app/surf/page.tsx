import Link from 'next/link';
import {
  fetchSurfHomeCards,
  fetchSurfOverview,
  fetchSurfRegionalNarrative,
  fetchSurfZones,
} from './actions';
import {
  SURF_CONDITION_COLORS,
  SURF_TEXT,
  SURF_TEXT_SECONDARY,
  SURF_TEXT_TERTIARY,
  SurfActionLink,
  SurfHero,
  SurfMetricCard,
  SurfPanel,
  SurfPill,
  surfConditionLabel,
  surfSlug,
} from './ui';

export default async function SurfExplorerPage() {
  const [overview, cards, narrative, zones] = await Promise.all([
    fetchSurfOverview(),
    fetchSurfHomeCards(),
    fetchSurfRegionalNarrative(),
    fetchSurfZones(),
  ]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <SurfHero
        eyebrow="Spot Explorer"
        title="Desktop intel for every break on your list."
        description="Browse zones, compare conditions, and jump from map-level context into forecast, tides, sessions, and ratings without leaving the surf stack."
        actions={
          <>
            <SurfActionLink href="/surf/forecast">Open Forecast</SurfActionLink>
            <SurfActionLink href="/surf/sessions" secondary>
              Log Session
            </SurfActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <SurfMetricCard label="Tracked Spots" value={String(overview.spots)} hint="seeded + saved" />
        <SurfMetricCard label="Favorites" value={String(overview.favorites)} hint="priority breaks" />
        <SurfMetricCard label="Avg Wave" value={`${overview.averageWaveHeightFt.toFixed(1)} ft`} hint="across spots" />
        <SurfMetricCard label="Sessions" value={String(overview.sessions)} hint="journal entries" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 20 }}>
        <SurfPanel eyebrow="Map" title="Explorer Split View">
          <div
            style={{
              minHeight: 320,
              borderRadius: 24,
              padding: 24,
              display: 'grid',
              alignContent: 'space-between',
              border: '1px solid rgba(59,130,246,0.18)',
              background:
                'radial-gradient(circle at top right, rgba(59,130,246,0.22), rgba(59,130,246,0) 40%), #0F1724',
            }}
          >
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={{ color: SURF_TEXT_TERTIARY, fontSize: 12 }}>Interactive map canvas</span>
              <h2 style={{ margin: 0, fontSize: 26, color: SURF_TEXT }}>Regional break coverage</h2>
              <p style={{ margin: 0, maxWidth: 520, color: SURF_TEXT_SECONDARY, lineHeight: 1.6 }}>
                Use the zone list to jump between coastlines, then scan condition color, favorite status, and session history from the spot deck below.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {zones.map((zone) => (
                <SurfPill key={zone.id}>{zone.name}</SurfPill>
              ))}
            </div>
          </div>
        </SurfPanel>

        <SurfPanel eyebrow="Regional Brief" title="Today&apos;s Outlook">
          <p style={{ margin: 0, color: SURF_TEXT, fontSize: 18, lineHeight: 1.5 }}>{narrative.summary}</p>
          <p style={{ margin: 0, color: SURF_TEXT_SECONDARY, lineHeight: 1.7 }}>{narrative.body}</p>
          <div style={{ display: 'grid', gap: 10 }}>
            {cards.slice(0, 3).map((card) => {
              const today = card.days[0];
              return (
                <div
                  key={card.spot.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: 14,
                    borderRadius: 18,
                    background: 'var(--surface)',
                    border: '1px solid var(--border)',
                  }}
                >
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ color: SURF_TEXT }}>{card.spot.name}</strong>
                    <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 13 }}>
                      {card.spot.region} · {card.spot.breakType}
                    </span>
                  </div>
                  {today ? (
                    <div style={{ textAlign: 'right' }}>
                      <div
                        style={{
                          color: SURF_CONDITION_COLORS[today.conditionColor] ?? SURF_TEXT,
                          fontSize: 18,
                          fontWeight: 800,
                        }}
                      >
                        {today.rating.toFixed(1)}
                      </div>
                      <span style={{ color: SURF_TEXT_TERTIARY, fontSize: 12 }}>
                        {surfConditionLabel(today.conditionColor)}
                      </span>
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SurfPanel>
      </div>

      <SurfPanel eyebrow="Spots" title="Condition Deck">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {cards.slice(0, 8).map((card) => {
            const today = card.days[0];
            return (
              <Link
                key={card.spot.id}
                href={`/surf/spot/${surfSlug(card.spot.name)}`}
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: 18,
                  borderRadius: 20,
                  textDecoration: 'none',
                  color: SURF_TEXT,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong>{card.spot.name}</strong>
                    <span style={{ color: SURF_TEXT_SECONDARY, fontSize: 13 }}>
                      {card.spot.region} · {card.spot.breakType}
                    </span>
                  </div>
                  <SurfPill active={card.spot.isFavorite}>Favorite</SurfPill>
                </div>
                {today ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: SURF_TEXT_SECONDARY, fontSize: 13 }}>
                      <span>{today.waveHeightMin.toFixed(1)}-{today.waveHeightMax.toFixed(1)} ft</span>
                      <span>{today.windKtsAvg.toFixed(0)} kts</span>
                    </div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {card.days.slice(0, 7).map((day) => (
                        <span
                          key={day.date}
                          style={{
                            flex: 1,
                            height: 6,
                            borderRadius: 999,
                            background: SURF_CONDITION_COLORS[day.conditionColor] ?? 'var(--border)',
                          }}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </Link>
            );
          })}
        </div>
      </SurfPanel>
    </div>
  );
}
