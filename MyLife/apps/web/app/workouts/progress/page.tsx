import { fetchWorkoutProgressPageData } from '../actions';
import {
  ActionLink,
  LineChart,
  MetricCard,
  RouteTile,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  formatDateLabel,
  WORKOUTS_TOKENS,
} from '../ui';

export default async function WorkoutProgressPage() {
  const data = await fetchWorkoutProgressPageData();

  const linePoints = data.weeklySummaries
    .slice()
    .reverse()
    .map((item) => ({
      label: item.label.replace('This ', '').replace('Last ', 'L-'),
      value: item.totalReps || item.sessions * 10,
    }));

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 26 }}>
        <WorkoutsPageHeader
          eyebrow="Progress Analytics"
          title="Performance arc"
          description="Desktop analytics pulls together the same mobile signals: streaks, PRs, body metrics, and the next surfaces worth checking."
          actions={(
            <>
              <ActionLink href="/workouts/measurements" label="Log Measurement" icon="straighten" />
              <ActionLink href="/workouts/recovery" label="Recovery" icon="health_and_safety" secondary />
            </>
          )}
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
          <MetricCard label="Current streak" value={`${data.streaks.current}d`} icon="local_fire_department" />
          <MetricCard label="Longest streak" value={`${data.streaks.longest}d`} icon="emoji_events" accent={WORKOUTS_TOKENS.cardio} />
          <MetricCard label="Total sessions" value={`${data.volume.totalSessions}`} icon="fitness_center" />
          <MetricCard label="Total reps" value={`${data.volume.totalReps}`} icon="bolt" accent={WORKOUTS_TOKENS.hypertrophy} />
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.5fr) minmax(320px, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Trend"
            title="Rep volume over time"
            description="A desktop line treatment for the same weekly progression used on mobile."
          />
          <LineChart points={linePoints} accent={WORKOUTS_TOKENS.hypertrophy} />
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Body metrics"
            title="Latest scale trend"
            description={data.measurements[0] ? `Latest entry on ${formatDateLabel(data.measurements[0].measuredAt)}` : 'Add your first metric entry to unlock trend views.'}
          />
          {data.measurements.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              {data.measurements.slice(0, 5).map((entry) => (
                <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span>{formatDateLabel(entry.measuredAt)}</span>
                  <strong>{entry.value} {entry.unit}</strong>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
              No measurements logged yet.
            </p>
          )}
        </WorkoutsSurface>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="PR Ledger"
            title="Recent personal records"
            description="Top output pulls from the pure workouts analytics engine."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {data.personalRecords.slice(0, 8).map((record) => (
              <div key={`${record.exerciseId}-${record.achievedAt}`} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: 16, borderRadius: 20, background: WORKOUTS_TOKENS.surfaceMid }}>
                <strong>{record.exerciseName}</strong>
                <span style={{ color: WORKOUTS_TOKENS.textSecondary }}>{record.maxSets} sets · {record.maxReps} reps</span>
                <span style={{ color: WORKOUTS_TOKENS.accentLight, fontWeight: 800 }}>{formatDateLabel(record.achievedAt)}</span>
              </div>
            ))}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Navigation"
            title="Go deeper"
            description={`Photos stored locally: ${data.photoCount}`}
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {data.routeTiles.map((tile) => (
              <RouteTile key={tile.href} href={tile.href} icon={tile.icon} title={tile.title} description={tile.description} />
            ))}
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
