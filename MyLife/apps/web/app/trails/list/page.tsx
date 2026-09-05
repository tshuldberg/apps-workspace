import Link from 'next/link';
import { fetchRecordings, fetchTrails } from '../actions';
import {
  difficultyColor,
  formatCompactDate,
  formatDistance,
  formatElevation,
  TEXT,
  TEXT_SEC,
  TEXT_TER,
  withAlpha,
  type BasicRecording,
  type BasicTrail,
} from '../ui';
import {
  TrailsActionLink,
  TrailsChip,
  TrailsHero,
  TrailsPanel,
  TrailsSurface,
  TrailsSymbol,
} from '../shell';

export default async function TrailsListPage({
  searchParams,
}: {
  searchParams?: Promise<{ difficulty?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const activeDifficulty = params.difficulty ?? 'all';

  const [trails, recordings] = await Promise.all([fetchTrails(), fetchRecordings({ limit: 24 })]);
  const allTrails = trails as BasicTrail[];
  const allRecordings = recordings as BasicRecording[];

  const featured = allTrails.slice(0, 3);
  const saved = allTrails.filter((trail) => trail.isSaved).slice(0, 6);
  const recentlyCompletedIds = new Set(allRecordings.map((recording) => recording.trailId).filter(Boolean));
  const recentlyCompleted = allTrails.filter((trail) => recentlyCompletedIds.has(trail.id)).slice(0, 6);
  const gridTrails =
    activeDifficulty === 'all'
      ? allTrails
      : allTrails.filter((trail) => trail.difficulty === activeDifficulty);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Trail Explorer"
        title="Featured routes, saved bets, and a clean desktop scouting grid."
        description="Phase 9 turns the trails directory into a desktop-first explorer: large hero cards, a sticky filter rail, curated saved sections, and enough density to compare routes without losing the alpine feel."
        actions={
          <>
            <TrailsActionLink href="/trails/discover" symbol="explore">
              Discover Hub
            </TrailsActionLink>
            <TrailsActionLink href="/trails/routes" symbol="route" secondary>
              Build A Route
            </TrailsActionLink>
          </>
        }
      />

      <div
        style={{
          position: 'sticky',
          top: 86,
          zIndex: 10,
          display: 'grid',
          gap: 12,
          padding: 16,
          borderRadius: 24,
          background: 'linear-gradient(180deg, rgba(27,27,32,0.94), rgba(19,19,24,0.96))',
          boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08), 0 18px 36px rgba(0,0,0,0.18)',
          backdropFilter: 'blur(18px)',
        }}
      >
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={searchStyle}>
            <TrailsSymbol name="search" size={18} color={TEXT_TER} />
            <span style={{ color: TEXT_TER, fontSize: 13 }}>Search by trail or region</span>
          </div>
          {['all', 'easy', 'moderate', 'hard', 'expert'].map((level) => {
            const href = level === 'all' ? '/trails/list' : `/trails/list?difficulty=${level}`;
            const active = activeDifficulty === level;
            return (
              <Link key={level} href={href}>
                <TrailsChip
                  label={level === 'all' ? 'All' : level.charAt(0).toUpperCase() + level.slice(1)}
                  active={active}
                  subtle={!active}
                />
              </Link>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', color: TEXT_SEC, fontSize: 13 }}>
          <span>{gridTrails.length} matched trails</span>
          <span>3-column desktop grid</span>
          <span>{saved.length} saved routes</span>
          <span>{recentlyCompleted.length} recently completed</span>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
        {featured.map((trail, index) => (
          <Link key={trail.id} href={`/trails/${trail.id}`} style={featuredCardStyle(index)}>
            <div style={{ display: 'grid', gap: 10 }}>
              <span style={{ color: TEXT_TER, fontSize: 11, letterSpacing: 1.1, textTransform: 'uppercase' }}>
                Featured {index + 1}
              </span>
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ fontSize: 20, color: TEXT }}>{trail.name}</strong>
                <span style={{ color: TEXT_SEC }}>{trail.region ?? 'Mountain district'}</span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <Badge tone={difficultyColor(trail.difficulty)} label={trail.difficulty} />
                <Badge tone="rgba(255,255,255,0.12)" label={formatDistance(trail.distanceMeters)} neutral />
                <Badge tone="rgba(255,255,255,0.12)" label={formatElevation(trail.elevationGainMeters)} neutral />
              </div>
            </div>
            <div style={featuredArtworkStyle}>
              <div style={featuredPathStyle(index)} />
            </div>
          </Link>
        ))}
      </div>

      <TrailsPanel eyebrow="Grid" title="Trail Explorer Grid">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {gridTrails.map((trail) => (
            <Link key={trail.id} href={`/trails/${trail.id}`} style={gridCardStyle}>
              <div style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ display: 'grid', gap: 4 }}>
                    <strong style={{ fontSize: 16, color: TEXT }}>{trail.name}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>{trail.region ?? 'Regional trailhead'}</span>
                  </div>
                  <Badge tone={difficultyColor(trail.difficulty)} label={trail.difficulty} />
                </div>
                <p style={{ margin: 0, color: TEXT_SEC, fontSize: 13, lineHeight: 1.6 }}>
                  {trail.description ?? 'Saved trail ready for route planning, recording, and offline prep.'}
                </p>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <Badge tone="rgba(255,255,255,0.12)" label={formatDistance(trail.distanceMeters)} neutral />
                  <Badge tone="rgba(255,255,255,0.12)" label={formatElevation(trail.elevationGainMeters)} neutral />
                </div>
                <TrailsSymbol name="arrow_outward" size={18} color={TEXT_TER} />
              </div>
            </Link>
          ))}
        </div>
      </TrailsPanel>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrailsPanel eyebrow="Saved" title="Quick Access">
          {saved.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {saved.map((trail) => (
                <Link key={trail.id} href={`/trails/${trail.id}`} style={rowStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <strong style={{ display: 'block', color: TEXT }}>{trail.name}</strong>
                    <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                      {trail.region ?? 'Trailhead'} · {formatDistance(trail.distanceMeters)}
                    </span>
                  </div>
                  <TrailsSymbol name="bookmark" size={18} color="#84CC16" />
                </Link>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: TEXT_SEC }}>Save a few trails to build a persistent fast-access shelf.</p>
          )}
        </TrailsPanel>

        <TrailsPanel eyebrow="Recently Completed" title="Routes You Touched Recently">
          {recentlyCompleted.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {recentlyCompleted.map((trail) => {
                const recording = allRecordings.find((entry) => entry.trailId === trail.id);
                return (
                  <Link key={trail.id} href={`/trails/${trail.id}`} style={rowStyle}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <strong style={{ display: 'block', color: TEXT }}>{trail.name}</strong>
                      <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                        {recording ? `Last recorded ${formatCompactDate(recording.startedAt)}` : 'Recent activity'}
                      </span>
                    </div>
                    <span style={{ fontSize: 18 }}>{recording ? '🥾' : '📍'}</span>
                  </Link>
                );
              })}
            </div>
          ) : (
            <p style={{ margin: 0, color: TEXT_SEC }}>Completed trail summaries appear after your first linked recording.</p>
          )}
        </TrailsPanel>
      </div>
    </div>
  );
}

function Badge({
  tone,
  label,
  neutral,
}: {
  tone: string;
  label: string;
  neutral?: boolean;
}) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '6px 10px',
        borderRadius: 999,
        background: neutral ? tone : withAlpha(tone, 0.14),
        color: neutral ? TEXT_SEC : tone,
        fontSize: 12,
        fontWeight: 600,
      }}
    >
      {label}
    </span>
  );
}

const searchStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  minWidth: 260,
  padding: '10px 14px',
  borderRadius: 999,
  background: 'rgba(255,255,255,0.05)',
};

const featuredCardStyle = (index: number) => ({
  display: 'grid',
  gap: 18,
  minHeight: 250,
  padding: 20,
  borderRadius: 28,
  textDecoration: 'none',
  background: [
    `radial-gradient(circle at 100% 0%, ${withAlpha(difficultyColor(index === 0 ? 'easy' : index === 1 ? 'moderate' : 'hard'), 0.22)}, transparent 42%)`,
    'linear-gradient(180deg, rgba(43,43,48,0.82), rgba(19,19,24,0.98))',
  ].join(', '),
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08), 0 18px 36px rgba(0,0,0,0.18)',
});

const featuredArtworkStyle = {
  position: 'relative' as const,
  minHeight: 90,
  borderRadius: 20,
  overflow: 'hidden' as const,
  background: 'rgba(12,17,12,0.9)',
};

const featuredPathStyle = (index: number) => ({
  position: 'absolute' as const,
  inset: '28px 16px auto 16px',
  height: 4,
  borderRadius: 999,
  background: `linear-gradient(90deg, ${withAlpha(difficultyColor(index === 0 ? 'easy' : index === 1 ? 'moderate' : 'hard'), 0.18)}, ${difficultyColor(index === 0 ? 'easy' : index === 1 ? 'moderate' : 'hard')}, ${withAlpha(difficultyColor(index === 0 ? 'easy' : index === 1 ? 'moderate' : 'hard'), 0.18)})`,
  transform: `rotate(${index === 1 ? '-8deg' : '6deg'})`,
  boxShadow: `0 0 20px ${withAlpha(difficultyColor(index === 0 ? 'easy' : index === 1 ? 'moderate' : 'hard'), 0.25)}`,
});

const gridCardStyle = {
  display: 'grid',
  gap: 16,
  padding: 18,
  borderRadius: 24,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.76), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const rowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  textDecoration: 'none',
  background: 'rgba(255,255,255,0.05)',
};
