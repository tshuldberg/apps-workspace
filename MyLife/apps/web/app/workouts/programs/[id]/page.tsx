'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  doToggleWorkoutPlanSubscription,
  doTrackWorkoutRecentView,
  fetchWorkoutPlanDetail,
} from '../../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  WORKOUTS_TOKENS,
} from '../../ui';

type ProgramDetail = Awaited<ReturnType<typeof fetchWorkoutPlanDetail>>;

export default function WorkoutProgramDetailPage() {
  const params = useParams<{ id: string }>();
  const programId = Array.isArray(params?.id) ? params.id[0] : params?.id;
  const [data, setData] = useState<ProgramDetail>(null);
  const [collapsedWeeks, setCollapsedWeeks] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!programId) {
      setError('Program not found.');
      setLoading(false);
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutPlanDetail(programId);
        if (cancelled) return;
        setData(next);
        if (next?.plan) {
          void doTrackWorkoutRecentView({
            id: next.plan.id,
            type: 'program',
            title: next.plan.title,
            subtitle: next.plan.description,
            route: `/workouts/programs/${next.plan.id}`,
            category: null,
          });
        }
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load program.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [programId]);

  const todaysWorkoutId = useMemo(() => {
    if (!data?.activeWeek || !data?.position) return null;
    return data.activeWeek.days[data.position.dayIndex]?.workout_id ?? null;
  }, [data?.activeWeek, data?.position]);

  const toggleWeek = (weekNumber: number) => {
    setCollapsedWeeks((current) =>
      current.includes(weekNumber)
        ? current.filter((item) => item !== weekNumber)
        : [...current, weekNumber],
    );
  };

  const handleSubscription = async () => {
    if (!data?.plan) return;
    try {
      setPending(true);
      const nextSubscribed = await doToggleWorkoutPlanSubscription(data.plan.id);
      setData((current) =>
        current
          ? {
              ...current,
              isSubscribed: nextSubscribed,
            }
          : current,
      );
      const refreshed = await fetchWorkoutPlanDetail(data.plan.id);
      setData(refreshed);
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Unable to update subscription.');
    } finally {
      setPending(false);
    }
  };

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading program detail...</WorkoutsSurface>;
  }

  if (error || !data || !data.plan) {
    return (
      <EmptyState
        title="Program detail unavailable"
        body={error ?? 'This program could not be loaded.'}
        action={<ActionLink href="/workouts/programs" label="Back To Programs" icon="arrow_back" secondary />}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 24 }}>
        <WorkoutsPageHeader
          eyebrow="Program Detail"
          title={data.plan.title}
          description={data.plan.description}
          actions={
            <>
              <button
                type="button"
                onClick={() => void handleSubscription()}
                disabled={pending}
                style={chipStyle(data.isSubscribed)}
              >
                {pending ? 'Updating...' : data.isSubscribed ? 'Subscribed' : 'Subscribe'}
              </button>
              <ActionLink href="/workouts/programs" label="Back To Programs" icon="arrow_back" secondary />
            </>
          }
        />

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <span style={chipStyle(true)}>{data.plan.weeks.length} weeks</span>
          <span style={chipStyle(false)}>{data.frequency} sessions / week</span>
          <span style={chipStyle(false)}>{data.workoutCount} total workouts</span>
          {data.equipmentSummary.map((item) => (
            <span key={item} style={chipStyle(false)}>
              {item}
            </span>
          ))}
        </div>
      </WorkoutsSurface>

      {data.isSubscribed && data.progress ? (
        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Current Position"
            title={`Week ${data.position?.weekNumber ?? 1}`}
            description={`${data.progress.completed} of ${data.progress.total} workouts completed.`}
            aside={
              todaysWorkoutId ? (
                <ActionLink href={`/workouts/session?workoutId=${todaysWorkoutId}`} label="Start Today" icon="play_arrow" />
              ) : null
            }
          />
          <div style={{ height: 10, borderRadius: 999, background: WORKOUTS_TOKENS.surfaceHighest, overflow: 'hidden' }}>
            <div
              style={{
                width: `${data.progress.percent}%`,
                height: '100%',
                background: WORKOUTS_TOKENS.accent,
              }}
            />
          </div>
        </WorkoutsSurface>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.8fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Weekly Schedule"
            title="Program structure"
            description="Each week maps to either a workout route or a rest day note."
          />
          <div style={{ display: 'grid', gap: 14 }}>
            {data.plan.weeks.map((week) => {
              const isCollapsed = collapsedWeeks.includes(week.week_number);

              return (
                <div key={week.week_number} style={{ display: 'grid', gap: 12 }}>
                  <button
                    type="button"
                    onClick={() => toggleWeek(week.week_number)}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 12,
                      padding: 16,
                      border: 'none',
                      borderRadius: 20,
                      background: WORKOUTS_TOKENS.surfaceMid,
                      color: WORKOUTS_TOKENS.text,
                      cursor: 'pointer',
                    }}
                  >
                    <strong>Week {week.week_number}</strong>
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                      {isCollapsed ? 'Expand' : 'Collapse'}
                    </span>
                  </button>

                  {!isCollapsed ? (
                    <div style={{ display: 'grid', gap: 10, paddingLeft: 8 }}>
                      {week.days.map((day) => {
                        const workout = day.workout_id ? data.workoutsById[day.workout_id] : null;
                        const isToday =
                          data.position?.weekNumber === week.week_number &&
                          data.position.dayIndex === day.day_number - 1;

                        return (
                          <div
                            key={`${week.week_number}-${day.day_number}`}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: 'auto 1fr auto',
                              gap: 14,
                              alignItems: 'center',
                              padding: 16,
                              borderRadius: 18,
                              background: isToday ? 'rgba(201,137,77,0.12)' : WORKOUTS_TOKENS.surfaceHigh,
                            }}
                          >
                            <div
                              style={{
                                width: 34,
                                height: 34,
                                borderRadius: 999,
                                background: isToday ? 'rgba(201,137,77,0.16)' : 'rgba(255,255,255,0.06)',
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                              }}
                            >
                              {day.day_number}
                            </div>
                            <div style={{ display: 'grid', gap: 4 }}>
                              <strong>{day.rest_day ? 'Recovery day' : workout?.title ?? 'Workout'}</strong>
                              <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                                {day.notes || (day.rest_day ? 'Recovery, mobility, or walk.' : `${workout?.exercises.length ?? 0} exercises`)}
                              </span>
                            </div>
                            {workout ? (
                              <Link href={`/workouts/session?workoutId=${workout.id}`} style={chipStyle(isToday)}>
                                Start
                              </Link>
                            ) : (
                              <span style={chipStyle(false)}>Rest</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Overview"
            title="Why this arc"
            description="A compact desktop summary of the program frame."
          />
          <div style={{ display: 'grid', gap: 10 }}>
            <div style={{ padding: 14, borderRadius: 18, background: WORKOUTS_TOKENS.surfaceHigh }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>Active today</strong>
              <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                {todaysWorkoutId ? data.workoutsById[todaysWorkoutId]?.title ?? 'Workout queued' : 'Rest or recovery day'}
              </span>
            </div>
            <div style={{ padding: 14, borderRadius: 18, background: WORKOUTS_TOKENS.surfaceHigh }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>Cadence</strong>
              <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                {data.frequency} sessions per week over {data.plan.weeks.length} weeks.
              </span>
            </div>
            <div style={{ padding: 14, borderRadius: 18, background: WORKOUTS_TOKENS.surfaceHigh }}>
              <strong style={{ display: 'block', marginBottom: 6 }}>Equipment stack</strong>
              <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                {data.equipmentSummary.join(', ') || 'Mixed equipment'}
              </span>
            </div>
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
