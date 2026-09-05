import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchEffortsBySegment, fetchPersonalBest, fetchSegmentsByTrail, fetchTrails } from '../../actions';
import { formatCompactDate, formatDistance, formatDurationDisplay, formatElevation, formatPace, TEXT, TEXT_SEC, TEXT_TER } from '../../ui';
import { TrailsActionLink, TrailsHero, TrailsPanel } from '../../shell';

export default async function SegmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const trails = await fetchTrails({ limit: 16 });

  let matched:
    | {
        trail: Awaited<ReturnType<typeof fetchTrails>>[number];
        segment: Awaited<ReturnType<typeof fetchSegmentsByTrail>>[number];
      }
    | null = null;

  for (const trail of trails) {
    const segments = await fetchSegmentsByTrail(trail.id);
    const found = segments.find((segment) => segment.id === id);
    if (found) {
      matched = { trail, segment: found };
      break;
    }
  }

  if (!matched) {
    notFound();
  }

  const [efforts, personalBest] = await Promise.all([
    fetchEffortsBySegment(id),
    fetchPersonalBest(id),
  ]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="Segment Detail"
        title={matched.segment.name}
        description={`Leaderboard detail for ${matched.trail.name}. Review your best effort, recent attempts, and the core shape of this route slice without leaving the trails desktop shell.`}
        actions={
          <>
            <TrailsActionLink href="/trails/segments" symbol="social_leaderboard">
              Back To Segments
            </TrailsActionLink>
            <TrailsActionLink href={`/trails/${matched.trail.id}`} symbol="terrain" secondary>
              Open Trail
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <TrailsPanel eyebrow="Profile" title="Segment Overview">
          <div style={{ display: 'grid', gap: 12 }}>
            <Metric label="Distance" value={formatDistance(matched.segment.distanceMeters)} />
            <Metric label="Elevation" value={formatElevation(matched.segment.elevationGainMeters)} />
            <Metric label="Trail" value={matched.trail.name} />
            <Metric
              label="Personal Best"
              value={personalBest ? formatDurationDisplay(personalBest.durationSeconds) : 'No PB yet'}
            />
          </div>
        </TrailsPanel>

        <TrailsPanel eyebrow="Map" title="Leaderboard Line">
          <div style={mapStyle}>
            <div style={mapPathStyle} />
          </div>
        </TrailsPanel>
      </div>

      <TrailsPanel eyebrow="Efforts" title="Your Leaderboard Attempts">
        {efforts.length > 0 ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {efforts.map((effort, index) => (
              <div key={effort.id} style={effortRowStyle}>
                <div style={{ display: 'grid', gap: 4, flex: 1, minWidth: 0 }}>
                  <strong style={{ color: TEXT, fontSize: 15 }}>
                    Attempt {index + 1} {effort.isPersonalBest ? '· PB' : ''}
                  </strong>
                  <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                    {formatCompactDate(effort.startedAt)} · {formatDurationDisplay(effort.durationSeconds)}
                  </span>
                </div>
                <span style={{ color: TEXT_TER, fontSize: 12 }}>
                  {formatPace(effort.paceMinPerKm)}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: TEXT_SEC }}>No efforts recorded for this segment yet.</p>
        )}
      </TrailsPanel>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricStyle}>
      <span style={{ color: TEXT_TER, fontSize: 11, letterSpacing: 0.9, textTransform: 'uppercase' }}>{label}</span>
      <strong style={{ color: TEXT, fontSize: 18 }}>{value}</strong>
    </div>
  );
}

const metricStyle = {
  display: 'grid',
  gap: 6,
  padding: 14,
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

const mapStyle = {
  position: 'relative' as const,
  minHeight: 220,
  borderRadius: 24,
  overflow: 'hidden' as const,
  background: 'linear-gradient(180deg, rgba(12,17,12,0.96), rgba(19,19,24,0.88))',
  boxShadow: 'inset 0 0 0 1.5px rgba(132,204,22,0.12)',
};

const mapPathStyle = {
  position: 'absolute' as const,
  left: '12%',
  right: '12%',
  top: '50%',
  height: 4,
  borderRadius: 999,
  background: 'linear-gradient(90deg, rgba(132,204,22,0.2), rgba(132,204,22,1), rgba(101,163,13,0.2))',
  transform: 'rotate(-8deg)',
  boxShadow: '0 0 18px rgba(132,204,22,0.28)',
};

const effortRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};
