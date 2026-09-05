import Link from 'next/link';
import { fetchWorkoutPlans } from '../actions';
import {
  ActionLink,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  panelStyle,
  WORKOUTS_TOKENS,
} from '../ui';

export default async function WorkoutProgramsIndexPage() {
  const plans = await fetchWorkoutPlans();
  const activePlan = plans.find((plan) => plan.isActive) ?? plans[0] ?? null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Programs"
          title="Training arcs"
          description="Long-form programming lives here with one active highlight and the rest available as quieter arcs."
          actions={(
            <>
              <Link href="/workouts/workouts" style={chipStyle(false)}>Workouts</Link>
              <Link href="/workouts/programs" style={chipStyle(true)}>Programs</Link>
              <ActionLink href="/workouts/generate" label="AI Generator" icon="auto_awesome" secondary />
            </>
          )}
        />
      </WorkoutsSurface>

      {activePlan ? (
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Current Focus"
            title={activePlan.title}
            description={`${activePlan.weekCount} weeks  ·  ${activePlan.frequency} sessions per week`}
            aside={<ActionLink href={`/workouts/programs/${activePlan.id}`} label="Dive In" icon="north_east" />}
          />
          <div style={{ color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.7 }}>
            {activePlan.description || 'Your highlighted program is ready to continue from the next available training day.'}
          </div>
          {activePlan.progressPercent != null ? (
            <div style={{ display: 'grid', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  Completion
                </span>
                <span style={{ fontWeight: 800, color: WORKOUTS_TOKENS.accentLight }}>{activePlan.progressPercent}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 999, background: WORKOUTS_TOKENS.surfaceHighest, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${activePlan.progressPercent}%`, background: WORKOUTS_TOKENS.accent }} />
              </div>
            </div>
          ) : null}
        </WorkoutsSurface>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 18 }}>
        {plans.map((plan) => (
          <Link
            key={plan.id}
            href={`/workouts/programs/${plan.id}`}
            style={{
              ...panelStyle('low'),
              display: 'grid',
              gap: 16,
              textDecoration: 'none',
              color: WORKOUTS_TOKENS.text,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
              <strong style={{ fontSize: 18 }}>{plan.title}</strong>
              {plan.isActive ? (
                <span style={{ color: WORKOUTS_TOKENS.accentLight, fontSize: 11, fontWeight: 800, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
                  Active
                </span>
              ) : null}
            </div>
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.7 }}>
              {plan.description || 'Structured weekly schedule with reusable day templates.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              <span>{plan.weekCount} weeks</span>
              <span>{plan.frequency} days / week</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
