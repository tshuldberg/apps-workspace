import Link from 'next/link';
import {
  fetchWorkoutDashboardPageData,
  fetchWorkoutProgress,
  fetchWorkoutRecoveryView,
} from './actions';
import {
  ActionLink,
  BarStripChart,
  MetricCard,
  ProgressTrack,
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  categoryAccent,
  formatDateLabel,
  formatMinutes,
  valueAccent,
  WORKOUTS_TOKENS,
} from './ui';

export default async function WorkoutsDashboardPage() {
  const [dashboardData, progressData, recoveryData] = await Promise.all([
    fetchWorkoutDashboardPageData(),
    fetchWorkoutProgress(),
    fetchWorkoutRecoveryView(),
  ]);

  const weeklyBars = progressData.weeklySummaries.slice().reverse().map((week) => ({
    label: week.label.replace('This ', '').replace('Last ', 'L-'),
    value: week.totalReps || week.sessions * 10,
    accent: WORKOUTS_TOKENS.hypertrophy,
  }));

  const topCategories = dashboardData.categories.slice(0, 4);
  const recentHistory = dashboardData.history.slice(0, 5);
  const freshMuscles = recoveryData.recovery.filter((entry) => entry.status === 'fresh').slice(0, 4);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 28 }}>
        <WorkoutsPageHeader
          eyebrow="Performance Center"
          title="Digital Sanctuary"
          description="Your complete training command deck across live sessions, weekly volume, recovery readiness, and the next block worth attacking."
          actions={(
            <>
              <ActionLink href="/workouts/workouts" label="Start Workout" icon="play_arrow" />
              <ActionLink href="/workouts/explore" label="Explore Library" icon="search" secondary />
            </>
          )}
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 16,
          }}
        >
          <MetricCard
            label="This Week Sessions"
            value={`${progressData.weeklySummaries[0]?.sessions ?? 0} / 6`}
            detail={<ProgressTrack value={progressData.weeklySummaries[0]?.sessions ?? 0} max={6} />}
            icon="calendar_today"
          />
          <MetricCard
            label="Volume This Month"
            value={`${dashboardData.metrics.totalMinutes} min`}
            detail={`${dashboardData.metrics.totalCalories} est. calories in the last 30 days`}
            icon="schedule"
          />
          <MetricCard
            label="Current Streak"
            value={`${progressData.streaks.current} days`}
            detail={`${progressData.streaks.longest} days all-time best`}
            accent={WORKOUTS_TOKENS.cardio}
            icon="local_fire_department"
          />
          <MetricCard
            label="Next Recommendation"
            value={recoveryData.suggestion.label}
            detail={`${freshMuscles.length} muscle groups are fully ready to train`}
            accent={valueAccent(freshMuscles.length * 20)}
            icon="bolt"
          />
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.7fr) minmax(320px, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 22 }}>
          <SectionTitle
            eyebrow="Load Curve"
            title="Weekly training volume"
            description="Eight recent blocks, using rep totals as the desktop volume signal."
          />
          <BarStripChart items={weeklyBars} />
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 20 }}>
          <SectionTitle
            eyebrow="Recovery"
            title="Ready today"
            description={`${recoveryData.suggestion.type.replace('_', ' ')} focus is the cleanest split right now.`}
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {recoveryData.recovery.slice(0, 6).map((entry) => (
              <div key={entry.muscleGroup} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ fontWeight: 700 }}>{entry.muscleGroup.replace('_', ' ')}</span>
                  <span style={{ color: valueAccent(entry.score), fontWeight: 800 }}>{entry.score}%</span>
                </div>
                <ProgressTrack value={entry.score} max={100} accent={valueAccent(entry.score)} />
              </div>
            ))}
          </div>
          <Link
            href="/workouts/recovery"
            style={{
              color: WORKOUTS_TOKENS.accentLight,
              fontWeight: 700,
              textDecoration: 'none',
              display: 'inline-flex',
              gap: 8,
              alignItems: 'center',
            }}
          >
            Open recovery map
            <SymbolIcon name="arrow_forward" size={18} color={WORKOUTS_TOKENS.accentLight} />
          </Link>
        </WorkoutsSurface>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Archived Sessions"
            title="Recent completions"
            description="Your latest finished sessions, grouped as the desktop journal rail."
            aside={<ActionLink href="/workouts/history" label="Full History" icon="history" secondary />}
          />
          {recentHistory.length === 0 ? (
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
              No completed workouts yet. Build a session and this archive starts populating immediately.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {recentHistory.map((entry) => (
                <div
                  key={entry.sessionId}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'auto 1fr auto',
                    gap: 16,
                    alignItems: 'center',
                    padding: 16,
                    borderRadius: 22,
                    background: WORKOUTS_TOKENS.surfaceMid,
                  }}
                >
                  <div
                    style={{
                      width: 46,
                      height: 46,
                      borderRadius: 18,
                      background: `${categoryAccent('strength')}18`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <SymbolIcon name="fitness_center" color={WORKOUTS_TOKENS.accentLight} />
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    <strong style={{ fontSize: 16 }}>{entry.workoutTitle}</strong>
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                      {formatDateLabel(entry.date)}  ·  {formatMinutes(entry.durationMinutes)}  ·  {entry.totalReps} reps
                    </span>
                  </div>
                  <div style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 700 }}>
                    {entry.exercisesCompleted}/{entry.exercisesTotal}
                  </div>
                </div>
              ))}
            </div>
          )}
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Library Pulse"
            title="Current catalog"
            description="What the workouts engine has available right now."
          />
          <div style={{ display: 'grid', gap: 14 }}>
            {topCategories.map((category) => (
              <div key={category.category} style={{ display: 'grid', gap: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <span style={{ textTransform: 'capitalize', fontWeight: 700 }}>
                    {category.category}
                  </span>
                  <span style={{ color: categoryAccent(category.category), fontWeight: 800 }}>
                    {category.count}
                  </span>
                </div>
                <ProgressTrack
                  value={category.count}
                  max={Math.max(1, ...topCategories.map((item) => item.count))}
                  accent={categoryAccent(category.category)}
                />
              </div>
            ))}
          </div>
          <div style={{ display: 'grid', gap: 10, paddingTop: 6 }}>
            <Link
              href="/workouts/exercises"
              style={{ color: WORKOUTS_TOKENS.text, textDecoration: 'none', fontWeight: 700 }}
            >
              {dashboardData.dashboard.exercises} live exercises
            </Link>
            <Link
              href="/workouts/programs"
              style={{ color: WORKOUTS_TOKENS.text, textDecoration: 'none', fontWeight: 700 }}
            >
              {dashboardData.plans.length} structured programs
            </Link>
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
