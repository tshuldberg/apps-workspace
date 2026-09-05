import Link from 'next/link';
import { fetchRecordings } from '../actions';
import { RecordingsTrendChart } from '../charts';
import {
  activityIcon,
  formatCompactDate,
  formatDistance,
  formatDurationDisplay,
  formatElevation,
  formatPace,
  TEXT,
  TEXT_SEC,
  TEXT_TER,
  type BasicRecording,
} from '../ui';
import {
  TrailsActionLink,
  TrailsChip,
  TrailsHero,
  TrailsMetricCard,
  TrailsPanel,
  TrailsSymbol,
} from '../shell';

export default async function TrailsRecordingsPage() {
  const recordings = (await fetchRecordings()) as BasicRecording[];

  const totals = recordings.reduce(
    (summary, recording) => {
      summary.distanceMeters += recording.distanceMeters;
      summary.elevationGainMeters += recording.elevationGainMeters;
      summary.durationSeconds += recording.durationSeconds;
      summary.activities.add(recording.activityType);
      return summary;
    },
    {
      distanceMeters: 0,
      elevationGainMeters: 0,
      durationSeconds: 0,
      activities: new Set<string>(),
    },
  );

  const trendData = groupRecordingsByMonth(recordings).slice(0, 6).reverse().map((group) => ({
    label: group.label,
    distance: Number((group.distanceMeters / 1000).toFixed(1)),
    elevation: Math.round(group.elevationGainMeters),
  }));

  const grouped = groupRecordingsByMonth(recordings);
  const averagePace =
    recordings.length > 0
      ? recordings.reduce((sum, recording) => {
          const km = recording.distanceMeters / 1000;
          return km > 0 ? sum + recording.durationSeconds / 60 / km : sum;
        }, 0) / recordings.length
      : null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <TrailsHero
        eyebrow="History"
        title="Monthly trend charts and grouped route memory."
        description="The recordings hub mirrors the mobile history view: trend charts up top, quick activity filters, and grouped runs, hikes, and rides with hover actions."
        actions={
          <>
            <TrailsActionLink href="/trails/export" symbol="ios_share">
              Export Activity
            </TrailsActionLink>
            <TrailsActionLink href="/trails/routes" symbol="route" secondary>
              Open Route Builder
            </TrailsActionLink>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
        <TrailsMetricCard label="Distance" value={formatDistance(totals.distanceMeters)} hint="logged on web + mobile" />
        <TrailsMetricCard label="Elevation" value={formatElevation(totals.elevationGainMeters)} hint="all climbs" />
        <TrailsMetricCard label="Time" value={formatDurationDisplay(totals.durationSeconds)} hint="moving + trail time" />
        <TrailsMetricCard label="Avg Pace" value={formatPace(averagePace)} hint={`${totals.activities.size} activity types`} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 16 }}>
        <TrailsPanel eyebrow="Trend" title="Monthly Distance And Elevation">
          <RecordingsTrendChart data={trendData} />
        </TrailsPanel>

        <TrailsPanel eyebrow="Filters" title="Activity Lenses">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {['All', 'Hike', 'Run', 'Bike', 'Walk'].map((label, index) => (
              <TrailsChip key={label} label={label} active={index === 0} subtle={index !== 0} />
            ))}
          </div>
          <div style={{ display: 'grid', gap: 10, marginTop: 8 }}>
            {[
              'Date grouped timeline',
              'Map-thumbnail hover actions',
              'Fast jump to recording details',
              'Export-ready desktop density',
            ].map((item) => (
              <div key={item} style={filterRowStyle}>
                <TrailsSymbol name="check_circle" size={18} color="#84CC16" />
                <span style={{ color: TEXT_SEC }}>{item}</span>
              </div>
            ))}
          </div>
        </TrailsPanel>
      </div>

      <TrailsPanel eyebrow="Timeline" title="Date-Grouped Recording History">
        {grouped.length > 0 ? (
          <div style={{ display: 'grid', gap: 18 }}>
            {grouped.map((group) => (
              <section key={group.label} style={{ display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ fontSize: 16, color: TEXT }}>{group.label}</strong>
                  <span style={{ color: TEXT_TER, fontSize: 12 }}>
                    {formatDistance(group.distanceMeters)} · {formatElevation(group.elevationGainMeters)}
                  </span>
                </div>
                <div style={{ display: 'grid', gap: 10 }}>
                  {group.items.map((recording) => {
                    const pace =
                      recording.distanceMeters > 0
                        ? recording.durationSeconds / 60 / (recording.distanceMeters / 1000)
                        : null;

                    return (
                      <Link key={recording.id} href={`/trails/recordings/${recording.id}`} style={recordingCardStyle}>
                        <div style={thumbnailStyle}>
                          <div style={thumbnailPathStyle(recording.id)} />
                        </div>
                        <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 8 }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                            <div style={{ display: 'grid', gap: 4 }}>
                              <strong style={{ fontSize: 15, color: TEXT }}>
                                {activityIcon(recording.activityType)} {recording.name}
                              </strong>
                              <span style={{ color: TEXT_SEC, fontSize: 13 }}>
                                {formatCompactDate(recording.startedAt)} · {recording.activityType}
                              </span>
                            </div>
                            <div style={{ display: 'flex', gap: 8, opacity: 0.9 }}>
                              <TrailsChip label="Open" active />
                              <TrailsChip label="Share" subtle />
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            <MetaPill label={formatDistance(recording.distanceMeters)} />
                            <MetaPill label={formatElevation(recording.elevationGainMeters)} />
                            <MetaPill label={formatDurationDisplay(recording.durationSeconds)} />
                            <MetaPill label={formatPace(pace)} />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </section>
            ))}
          </div>
        ) : (
          <p style={{ margin: 0, color: TEXT_SEC }}>
            Start recording on mobile to seed charts, date groups, and route thumbnails here.
          </p>
        )}
      </TrailsPanel>
    </div>
  );
}

function groupRecordingsByMonth(recordings: BasicRecording[]) {
  const groups = new Map<
    string,
    {
      label: string;
      items: BasicRecording[];
      distanceMeters: number;
      elevationGainMeters: number;
    }
  >();

  for (const recording of recordings) {
    const date = new Date(recording.startedAt);
    const key = `${date.getFullYear()}-${date.getMonth()}`;
    const label = date.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const existing = groups.get(key);
    if (existing) {
      existing.items.push(recording);
      existing.distanceMeters += recording.distanceMeters;
      existing.elevationGainMeters += recording.elevationGainMeters;
    } else {
      groups.set(key, {
        label,
        items: [recording],
        distanceMeters: recording.distanceMeters,
        elevationGainMeters: recording.elevationGainMeters,
      });
    }
  }

  return Array.from(groups.values()).sort((left, right) =>
    new Date(right.items[0]?.startedAt ?? 0).getTime() - new Date(left.items[0]?.startedAt ?? 0).getTime(),
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

const filterRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '12px 14px',
  borderRadius: 18,
  background: 'rgba(255,255,255,0.05)',
};

const recordingCardStyle = {
  display: 'flex',
  alignItems: 'stretch',
  gap: 14,
  padding: 14,
  borderRadius: 24,
  textDecoration: 'none',
  background: 'linear-gradient(180deg, rgba(43,43,48,0.76), rgba(19,19,24,0.98))',
  boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,0.08)',
};

const thumbnailStyle = {
  position: 'relative' as const,
  width: 124,
  minHeight: 110,
  borderRadius: 18,
  overflow: 'hidden' as const,
  background: 'linear-gradient(180deg, rgba(12,17,12,0.96), rgba(19,19,24,0.88))',
  boxShadow: 'inset 0 0 0 1.5px rgba(132,204,22,0.12)',
};

const thumbnailPathStyle = (seed: string) => {
  const rotation = (seed.charCodeAt(0) % 12) - 6;
  return {
    position: 'absolute' as const,
    left: '12%',
    right: '12%',
    top: '50%',
    height: 3,
    borderRadius: 999,
    background: 'linear-gradient(90deg, rgba(132,204,22,0.18), rgba(132,204,22,1), rgba(101,163,13,0.2))',
    transform: `rotate(${rotation}deg)`,
    boxShadow: '0 0 16px rgba(132,204,22,0.28)',
  };
};
