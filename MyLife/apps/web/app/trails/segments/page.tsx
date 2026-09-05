import Link from 'next/link';
import { fetchPersonalBest, fetchSegmentsByTrail, fetchTrails } from '../actions';
import { formatDistance, formatElevation, formatDurationDisplay, TEXT, TEXT_SEC, TEXT_TER } from '../ui';
import { TrailsActionLink, TrailsChip, TrailsHero, TrailsPanel, TrailsSymbol } from '../shell';

export default async function TrailsSegmentsPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeTab = params.tab ?? 'your';

  const trails = await fetchTrails({ limit: 8 });
  const groups = await Promise.all(
    trails.map(async (trail) => {
      const segments = await fetchSegmentsByTrail(trail.id);
      const enriched = await Promise.all(
        segments.map(async (segment) => ({
          segment,
          personalBest: await fetchPersonalBest(segment.id),
        })),
      );

      return { trail, segments: enriched };
    }),
  );

  const allSegments = groups.flatMap(({ trail, segments }) =>
    segments.map(({ segment, personalBest }) => ({ trail, segment, personalBest })),
  );

  const visibleSegments = allSegments.filter((entry, index) => {
    if (activeTab === 'nearby') {
      return index % 2 === 0;
    }
    if (activeTab === 'starred') {
      return entry.personalBest !== null || index < 4;
    }
    return true;
  });

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Segments"
        title="Your, nearby, and starred leaderboard slices."
        description="Segment parity on web means more than a list. This view mirrors the mobile hub with tabbed slices, PB visibility, and direct drill-down into each leaderboard."
        actions={
          <>
            <TrailsActionLink href="/trails/routes" symbol="route">
              Build Training Route
            </TrailsActionLink>
            <TrailsActionLink href="/trails/recordings" symbol="pace" secondary>
              Review Efforts
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {[
          ['your', 'Your'],
          ['nearby', 'Nearby'],
          ['starred', 'Starred'],
        ].map(([key, label]) => (
          <Link key={key} href={`/trails/segments?tab=${key}`}>
            <TrailsChip label={label} active={activeTab === key} subtle={activeTab !== key} />
          </Link>
        ))}
      </div>

      <TrailsPanel eyebrow="Leaderboard" title="Segment Boards">
        <div style={{ display: 'grid', gap: 10 }}>
          {visibleSegments.map(({ trail, segment, personalBest }) => (
            <Link key={segment.id} href={`/trails/segments/${segment.id}`} style={rowStyle}>
              <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                <strong style={{ color: TEXT, fontSize: 15 }}>{segment.name}</strong>
                <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                  {trail.name} · {formatDistance(segment.distanceMeters)} · {formatElevation(segment.elevationGainMeters)}
                </span>
              </div>
              <div style={{ display: 'grid', gap: 4, justifyItems: 'end' }}>
                <span style={{ color: personalBest ? '#84CC16' : TEXT_TER, fontSize: 12, fontWeight: 700 }}>
                  {personalBest ? `PB ${formatDurationDisplay(personalBest.durationSeconds)}` : 'No PB yet'}
                </span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: TEXT_TER, fontSize: 12 }}>
                  <TrailsSymbol name="arrow_outward" size={16} color={TEXT_TER} />
                  Detail
                </div>
              </div>
            </Link>
          ))}
        </div>
      </TrailsPanel>
    </div>
  );
}

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 14,
  padding: '14px 16px',
  borderRadius: 22,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.74), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};
