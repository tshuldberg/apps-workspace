import { fetchWorkoutRecoveryView } from '../actions';
import {
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  valueAccent,
  WORKOUTS_TOKENS,
} from '../ui';

export default async function WorkoutRecoveryPage() {
  const data = await fetchWorkoutRecoveryView();

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Recovery Map"
          title="Readiness by muscle group"
          description="The recovery engine scores each region against recent work. Use it to pick a split that respects both fatigue and momentum."
        />
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 360px) minmax(0, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Best To Train"
            title={data.suggestion.label}
            description={`${data.suggestion.freshMuscles.length} muscles are fully recovered right now.`}
          />
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Fresh
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.suggestion.freshMuscles.map((muscle) => (
                  <span key={muscle} style={{ padding: '8px 12px', borderRadius: 999, background: `${WORKOUTS_TOKENS.success}18`, color: WORKOUTS_TOKENS.success, fontWeight: 700 }}>
                    {muscle.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                Fatigued
              </span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {data.suggestion.fatiguedMuscles.map((muscle) => (
                  <span key={muscle} style={{ padding: '8px 12px', borderRadius: 999, background: `${WORKOUTS_TOKENS.hypertrophy}18`, color: WORKOUTS_TOKENS.hypertrophy, fontWeight: 700 }}>
                    {muscle.replace('_', ' ')}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 14 }}>
          <SectionTitle
            eyebrow="Per Muscle"
            title="Recovery ledger"
            description="Primary and secondary muscles combine into one desktop score row."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {data.recovery.map((entry) => (
              <div
                key={entry.muscleGroup}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 16,
                  alignItems: 'center',
                  padding: 16,
                  borderRadius: 20,
                  background: WORKOUTS_TOKENS.surfaceMid,
                }}
              >
                <div style={{ display: 'grid', gap: 4 }}>
                  <strong style={{ textTransform: 'capitalize' }}>{entry.muscleGroup.replace('_', ' ')}</strong>
                  <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                    {entry.hoursSinceLastTrained == null
                      ? 'Never trained recently'
                      : `${entry.hoursSinceLastTrained}h since last trained · ${entry.frequencyLast7Days} hits this week`}
                  </span>
                </div>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, color: valueAccent(entry.score), fontWeight: 800 }}>
                  <SymbolIcon name="monitor_heart" size={18} color={valueAccent(entry.score)} />
                  {entry.score}%
                </div>
                <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontWeight: 700 }}>
                  {entry.hoursUntilRecovered}h left
                </span>
              </div>
            ))}
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
