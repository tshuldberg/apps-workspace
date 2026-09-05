import Link from 'next/link';
import { fetchWorkoutHistoryPageData } from '../actions';
import { ExportCsvButtons } from '../ExportCsvButtons';
import {
  ActionLink,
  HeatmapGrid,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  formatDateLabel,
  formatMinutes,
  WORKOUTS_TOKENS,
} from '../ui';

export default async function WorkoutHistoryPage() {
  const data = await fetchWorkoutHistoryPageData();

  const grouped = data.history.reduce<Record<string, typeof data.history>>((accumulator, entry) => {
    const key = new Date(entry.date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    accumulator[key] = accumulator[key] ?? [];
    accumulator[key].push(entry);
    return accumulator;
  }, {});

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 24 }}>
        <WorkoutsPageHeader
          eyebrow="History"
          title="Training journal"
          description="The desktop history surface mirrors the mobile journal: intensity grid up top, grouped sessions below."
          actions={<ActionLink href="/workouts/workouts" label="Start New Session" icon="play_arrow" />}
        />
        <ExportCsvButtons />
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.1fr) minmax(300px, 0.9fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="12 Weeks"
            title="Consistency heatmap"
            description="Each cell uses recent rep density as the intensity signal."
          />
          <HeatmapGrid values={data.intensityCells} columns={12} />
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Snapshot"
            title="Recent weeks"
            description="Sessions and minutes grouped into rolling weekly buckets."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {data.weekly.map((week) => (
              <div key={week.label} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong>{week.label}</strong>
                  <span style={{ color: WORKOUTS_TOKENS.textSecondary }}>
                    {week.sessions} sessions · {formatMinutes(week.totalMinutes)}
                  </span>
                </div>
                <div style={{ height: 8, borderRadius: 999, overflow: 'hidden', background: WORKOUTS_TOKENS.surfaceHighest }}>
                  <div style={{ width: `${Math.max(6, (week.sessions / Math.max(1, ...data.weekly.map((item) => item.sessions))) * 100)}%`, height: '100%', background: WORKOUTS_TOKENS.accent }} />
                </div>
              </div>
            ))}
          </div>
        </WorkoutsSurface>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        {Object.entries(grouped).map(([label, entries]) => (
          <WorkoutsSurface key={label} tone="low" style={{ display: 'grid', gap: 14 }}>
            <SectionTitle title={label} />
            <div style={{ display: 'grid', gap: 12 }}>
              {entries.map((entry) => (
                <Link
                  key={entry.sessionId}
                  href={`/workouts/session?workoutId=${entry.workoutId}`}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: 16,
                    padding: 16,
                    borderRadius: 22,
                    background: WORKOUTS_TOKENS.surfaceMid,
                    textDecoration: 'none',
                    color: WORKOUTS_TOKENS.text,
                  }}
                >
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong>{entry.workoutTitle}</strong>
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary }}>
                      {formatDateLabel(entry.date)} · {formatMinutes(entry.durationMinutes)} · {entry.totalReps} reps
                    </span>
                  </div>
                  <div style={{ color: WORKOUTS_TOKENS.textTertiary, fontWeight: 700 }}>
                    {entry.exercisesCompleted}/{entry.exercisesTotal}
                  </div>
                </Link>
              ))}
            </div>
          </WorkoutsSurface>
        ))}
      </div>
    </div>
  );
}
