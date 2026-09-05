import Link from 'next/link';
import { fetchRecentConditions, fetchRecordings, fetchStats, fetchTrails } from './actions';
import {
  activityIcon,
  ACCENT_LIGHT,
  difficultyColor,
  formatCompactDate,
  formatDistance,
  formatElevation,
  formatPace,
  TEXT,
  TEXT_SEC,
  TEXT_TER,
  weatherTone,
  withAlpha,
  type BasicRecording,
  type BasicTrail,
} from './ui';
import {
  TrailsActionLink,
  TrailsChip,
  TrailsHero,
  TrailsMetricCard,
  TrailsPanel,
  TrailsSectionLabel,
  TrailsSurface,
  TrailsSymbol,
} from './shell';

export default async function TrailsHomePage() {
  const [stats, recordings, trails] = await Promise.all([
    fetchStats(),
    fetchRecordings({ limit: 6 }),
    fetchTrails({ limit: 6 }),
  ]);

  const recentRecordings = recordings as BasicRecording[];
  const nearbyTrails = trails as BasicTrail[];
  const featuredTrail = nearbyTrails[0] ?? null;
  const featuredRecording = recentRecordings[0] ?? null;

  const weatherStrip = await Promise.all(
    nearbyTrails.slice(0, 4).map(async (trail) => ({
      trail,
      conditions: await fetchRecentConditions(trail.id),
    })),
  );

  const typedStats = stats as {
    totalRecordings: number;
    totalDistanceMeters: number;
    totalElevationGainMeters: number;
    averagePaceMinPerKm: number | null;
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Last Explored"
        title={featuredRecording?.name ?? featuredTrail?.name ?? 'Field-ready mission control'}
        description="Monitor recent route captures, scout nearby trails, keep an eye on mountain conditions, and pivot into offline prep from one desktop home surface."
        actions={
          <>
            <TrailsActionLink href="/trails/list" symbol="terrain">
              Open Trails
            </TrailsActionLink>
            <TrailsActionLink href="/trails/routes" symbol="route" secondary>
              Route Builder
            </TrailsActionLink>
            <TrailsActionLink href="/trails/recordings" symbol="pace" secondary>
              Recording History
            </TrailsActionLink>
          </>
        }
        aside={
          <TrailsSurface style={{ gap: 14, minHeight: '100%' }}>
            <div style={{ display: 'grid', gap: 6 }}>
              <TrailsSectionLabel>Live GPS</TrailsSectionLabel>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    width: 12,
                    height: 12,
                    borderRadius: 999,
                    background: '#84CC16',
                    boxShadow: '0 0 0 10px rgba(132,204,22,0.14)',
                  }}
                />
                <strong style={{ fontSize: 18, color: TEXT }}>
                  {featuredTrail?.region ?? 'Mission Control Ready'}
                </strong>
              </div>
              <p style={{ margin: 0, color: TEXT_SEC, lineHeight: 1.6 }}>
                {featuredTrail
                  ? `${formatDistance(featuredTrail.distanceMeters)} with ${formatElevation(featuredTrail.elevationGainMeters)} gain.`
                  : 'Open a trail to pin its route, weather, and segment stats here.'}
              </p>
            </div>
            <div style={mapHeroStyle}>
              <div style={mapGridStyle} />
              {nearbyTrails.slice(0, 4).map((trail, index) => (
                <div
                  key={trail.id}
                  style={{
                    position: 'absolute',
                    left: `${18 + index * 22}%`,
                    top: `${28 + ((index % 2) * 18)}%`,
                    display: 'grid',
                    gap: 4,
                    justifyItems: 'center',
                  }}
                >
                  <span
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: difficultyColor(trail.difficulty),
                      boxShadow: `0 0 0 10px ${withAlpha(difficultyColor(trail.difficulty), 0.14)}`,
                    }}
                  />
                  <span style={{ fontSize: 11, color: TEXT_TER }}>{trail.name.split(' ')[0]}</span>
                </div>
              ))}
              <div style={routeRibbonStyle} />
            </div>
          </TrailsSurface>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <TrailsMetricCard
          label="Recordings"
          value={String(typedStats.totalRecordings)}
          hint="captured sessions"
        />
        <TrailsMetricCard
          label="Distance"
          value={formatDistance(typedStats.totalDistanceMeters)}
          hint="all-time mileage"
        />
        <TrailsMetricCard
          label="Elevation"
          value={formatElevation(typedStats.totalElevationGainMeters)}
          hint="vertical gain"
        />
        <TrailsMetricCard
          label="Avg Pace"
          value={formatPace(typedStats.averagePaceMinPerKm)}
          hint="rolling average"
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: 16 }}>
        <TrailsPanel eyebrow="Nearby" title="Trails Near Your Last Anchor">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {nearbyTrails.slice(0, 3).map((trail) => (
              <Link key={trail.id} href={`/trails/${trail.id}`} style={trailCardStyle}>
                <div style={{ display: 'grid', gap: 8 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                    <div style={{ display: 'grid', gap: 4 }}>
                      <strong style={{ fontSize: 16, color: TEXT }}>{trail.name}</strong>
                      <span style={{ color: TEXT_SEC, fontSize: 13 }}>{trail.region ?? 'Local area'}</span>
                    </div>
                    <TrailsChip label={trail.difficulty} active />
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    <MetaPill label={formatDistance(trail.distanceMeters)} />
                    <MetaPill label={formatElevation(trail.elevationGainMeters)} />
                    {trail.estimatedMinutes ? <MetaPill label={`${trail.estimatedMinutes} min`} /> : null}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </TrailsPanel>

        <TrailsPanel eyebrow="Weather Strip" title="Mountain Signals">
          <div style={{ display: 'grid', gap: 10 }}>
            {weatherStrip.map(({ trail, conditions }) => {
              const label = conditions.length > 0 ? conditions[0].replace(/_/g, ' ') : 'Clear window';
              const tone = weatherTone(label);

              return (
                <div key={trail.id} style={weatherRowStyle}>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: 999,
                      background: tone,
                      boxShadow: `0 0 0 10px ${withAlpha(tone, 0.16)}`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: TEXT, fontSize: 14 }}>{trail.name}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>{label}</span>
                  </div>
                  <span style={{ color: TEXT_TER, fontSize: 12 }}>{trail.region ?? 'Trailhead'}</span>
                </div>
              );
            })}
          </div>
        </TrailsPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrailsPanel eyebrow="Recent Adventures" title="Latest Recordings">
          <div style={{ display: 'grid', gap: 10 }}>
            {recentRecordings.length > 0 ? (
              recentRecordings.map((recording) => (
                <Link key={recording.id} href={`/trails/recordings/${recording.id}`} style={recordingRowStyle}>
                  <span style={{ fontSize: 20 }}>{activityIcon(recording.activityType)}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: TEXT, fontSize: 14 }}>{recording.name}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                      {formatDistance(recording.distanceMeters)} · {formatCompactDate(recording.startedAt)}
                    </span>
                  </div>
                  <TrailsSymbol name="arrow_outward" size={18} color={TEXT_TER} />
                </Link>
              ))
            ) : (
              <p style={{ margin: 0, color: TEXT_SEC }}>
                Recordings from mobile will appear here with pace, duration, and route context.
              </p>
            )}
          </div>
        </TrailsPanel>

        <TrailsPanel eyebrow="Fast Access" title="Mission Control Shortcuts">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
            {[
              ['Offline regions', '/trails/offline', 'download_for_offline'],
              ['Trip planner', '/trails/trips', 'camping'],
              ['Packing lists', '/trails/packing', 'checklist'],
              ['Segment boards', '/trails/segments', 'social_leaderboard'],
            ].map(([label, href, symbol]) => (
              <Link key={href} href={href} style={shortcutStyle}>
                <TrailsSymbol name={symbol} size={20} color={ACCENT_LIGHT} />
                <span style={{ color: TEXT }}>{label}</span>
              </Link>
            ))}
          </div>
        </TrailsPanel>
      </div>
    </div>
  );
}

function MetaPill({ label }: { label: string }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        background: 'rgba(255,255,255,0.05)',
        color: TEXT_SEC,
        fontSize: 12,
      }}
    >
      {label}
    </span>
  );
}

const mapHeroStyle = {
  position: 'relative' as const,
  minHeight: 220,
  overflow: 'hidden' as const,
  borderRadius: 24,
  background: 'linear-gradient(180deg, rgba(12,18,12,0.98), rgba(17,24,14,0.94))',
  boxShadow: 'inset 0 0 0 1.5px rgba(132,204,22,0.12)',
};

const mapGridStyle = {
  position: 'absolute' as const,
  inset: 0,
  backgroundImage:
    'linear-gradient(rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.04) 1px, transparent 1px)',
  backgroundSize: '32px 32px',
  opacity: 0.4,
};

const routeRibbonStyle = {
  position: 'absolute' as const,
  left: '9%',
  right: '14%',
  top: '58%',
  height: 3,
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(132,204,22,0.2), rgba(132,204,22,0.95), rgba(101,163,13,0.2))',
  transform: 'rotate(-12deg)',
  boxShadow: '0 0 24px rgba(132,204,22,0.4)',
};

const trailCardStyle = {
  display: 'grid',
  gap: 12,
  padding: 18,
  borderRadius: 24,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.76), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08), 0 18px 32px rgba(0,0,0,0.2)',
};

const weatherRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

const recordingRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 20,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const shortcutStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '14px 16px',
  borderRadius: 20,
  textDecoration: 'none',
  background: 'rgba(255,255,255,0.05)',
};
