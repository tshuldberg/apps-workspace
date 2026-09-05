'use client';

import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { doTrackWorkoutRecentView, fetchWorkoutExploreData } from '../actions';
import {
  ActionLink,
  EmptyState,
  SectionTitle,
  SymbolIcon,
  WorkoutsPageHeader,
  WorkoutsSurface,
  chipStyle,
  difficultyAccent,
  formatMinutes,
  WORKOUTS_TOKENS,
} from '../ui';

type ExploreData = Awaited<ReturnType<typeof fetchWorkoutExploreData>>;

function normalizeText(value: string): string {
  return value.trim().toLowerCase();
}

export default function WorkoutExplorePage() {
  const [data, setData] = useState<ExploreData | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const deferredSearch = useDeferredValue(search);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        setLoading(true);
        const next = await fetchWorkoutExploreData();
        if (cancelled) return;
        setData(next);
        setError(null);
      } catch (loadError) {
        if (cancelled) return;
        setError(loadError instanceof Error ? loadError.message : 'Unable to load explore.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    if (!data) {
      return { workouts: [], programs: [], trending: [], forYou: [] };
    }

    const query = normalizeText(deferredSearch);
    const matches = (value: string) => !query || normalizeText(value).includes(query);

    return {
      workouts: data.workouts.filter((item) => {
        return (
          matches(`${item.title} ${item.description}`) &&
          (!selectedCategory || item.inferredCategory === selectedCategory)
        );
      }),
      programs: data.programs.filter((item) => {
        return matches(`${item.title} ${item.description}`);
      }),
      trending: data.trending.filter((item) => {
        return (
          matches(`${item.name} ${item.description}`) &&
          (!selectedCategory || item.category === selectedCategory)
        );
      }),
      forYou: data.forYou.filter((item) => {
        return (
          matches(`${item.name} ${item.description}`) &&
          (!selectedCategory || item.category === selectedCategory)
        );
      }),
    };
  }, [data, deferredSearch, selectedCategory]);

  const categoryCounts = data?.categories ?? [];

  if (loading) {
    return <WorkoutsSurface tone="mid">Loading explore hub...</WorkoutsSurface>;
  }

  if (error || !data) {
    return (
      <EmptyState
        title="Explore unavailable"
        body={error ?? 'The workouts discovery surface could not be loaded.'}
        action={<ActionLink href="/workouts" label="Back To Dashboard" icon="arrow_back" secondary />}
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <WorkoutsSurface tone="glass" style={{ display: 'grid', gap: 22 }}>
        <WorkoutsPageHeader
          eyebrow="Explore"
          title="Training discovery"
          description="Search the library, skim the strongest templates, and jump straight into the next workout, program, or exercise worth opening."
          actions={
            <ActionLink href="/workouts/exercises" label="Open Exercise Library" icon="menu_book" />
          }
        />

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 14,
            alignItems: 'center',
          }}
        >
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '14px 18px',
              borderRadius: 22,
              background: WORKOUTS_TOKENS.surfaceHigh,
            }}
          >
            <SymbolIcon name="search" color={WORKOUTS_TOKENS.textTertiary} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search workouts, programs, or exercises"
              style={{
                width: '100%',
                border: 'none',
                outline: 'none',
                background: 'transparent',
                color: WORKOUTS_TOKENS.text,
                fontSize: 15,
              }}
            />
          </label>

          <Link href="/workouts/generate" style={chipStyle(true)}>
            <SymbolIcon name="auto_awesome" size={16} color={WORKOUTS_TOKENS.accentLight} />
            AI Generator
          </Link>
        </div>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
          <button
            type="button"
            onClick={() => setSelectedCategory(null)}
            style={chipStyle(selectedCategory == null)}
          >
            All categories
          </button>
          {categoryCounts.map((item) => (
            <button
              key={item.category}
              type="button"
              onClick={() => setSelectedCategory(item.category)}
              style={chipStyle(selectedCategory === item.category)}
            >
              <span style={{ textTransform: 'capitalize' }}>{item.category}</span>
              <span>{item.count}</span>
            </button>
          ))}
        </div>
      </WorkoutsSurface>

      {data.featured ? (
        <Link
          href={data.featured.route}
          style={{
            textDecoration: 'none',
            color: WORKOUTS_TOKENS.text,
          }}
          onClick={() => {
            void doTrackWorkoutRecentView({
              id: data.featured?.id ?? '',
              type: data.featured?.type ?? 'workout',
              title: data.featured?.title ?? 'Featured',
              subtitle: data.featured?.subtitle,
              route: data.featured?.route ?? '/workouts',
              category: null,
            });
          }}
        >
          <WorkoutsSurface
            tone="mid"
            style={{
              display: 'grid',
              gap: 18,
              background:
                'linear-gradient(135deg, rgba(201,137,77,0.18), rgba(19,19,24,0.94) 55%)',
            }}
          >
            <span
              style={{
                color: WORKOUTS_TOKENS.accentLight,
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.16em',
                textTransform: 'uppercase',
              }}
            >
              Featured {data.featured.type}
            </span>
            <div style={{ display: 'grid', gap: 8 }}>
              <strong style={{ fontSize: 'clamp(1.8rem, 3vw, 3.2rem)', letterSpacing: '-0.05em' }}>
                {data.featured.title}
              </strong>
              <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, fontSize: 15 }}>
                {data.featured.subtitle}
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', fontWeight: 700 }}>
              Open feature
              <SymbolIcon name="arrow_forward" size={18} color={WORKOUTS_TOKENS.text} />
            </div>
          </WorkoutsSurface>
        </Link>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.3fr) minmax(320px, 0.9fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Trending"
            title="Exercises drawing attention"
            description="High-interest library items based on favorites, video coverage, and movement density."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            {filtered.trending.slice(0, 6).map((exercise) => (
              <Link
                key={exercise.id}
                href={`/workouts/exercises/${exercise.id}`}
                onClick={() => {
                  void doTrackWorkoutRecentView({
                    id: exercise.id,
                    type: 'exercise',
                    title: exercise.name,
                    subtitle: exercise.description,
                    route: `/workouts/exercises/${exercise.id}`,
                    category: exercise.category,
                  });
                }}
                style={{
                  display: 'grid',
                  gap: 12,
                  padding: 16,
                  borderRadius: 22,
                  background: WORKOUTS_TOKENS.surfaceMid,
                  textDecoration: 'none',
                  color: WORKOUTS_TOKENS.text,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <strong style={{ fontSize: 16 }}>{exercise.name}</strong>
                  <span
                    style={{
                      color: difficultyAccent(exercise.difficulty),
                      fontSize: 11,
                      fontWeight: 800,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {exercise.difficulty}
                  </span>
                </div>
                <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary, lineHeight: 1.6, fontSize: 13 }}>
                  {exercise.description}
                </p>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 700 }}>
                  <span style={{ textTransform: 'capitalize' }}>{exercise.category}</span>
                  <span>{exercise.defaultSets} sets</span>
                </div>
              </Link>
            ))}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 16 }}>
          <SectionTitle
            eyebrow="Recently Viewed"
            title="Jump back in"
            description="The last surfaces you opened across the web library."
          />
          {data.recentViews.length === 0 ? (
            <p style={{ margin: 0, color: WORKOUTS_TOKENS.textSecondary }}>
              Nothing in the recent rail yet. Open a workout, program, or exercise and it will appear here.
            </p>
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {data.recentViews.map((item) => (
                <Link
                  key={`${item.type}-${item.id}`}
                  href={item.route}
                  style={{
                    display: 'grid',
                    gap: 6,
                    padding: 14,
                    borderRadius: 18,
                    background: WORKOUTS_TOKENS.surfaceHigh,
                    textDecoration: 'none',
                    color: WORKOUTS_TOKENS.text,
                  }}
                >
                  <strong>{item.title}</strong>
                  {item.subtitle ? (
                    <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>{item.subtitle}</span>
                  ) : null}
                  <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800 }}>
                    {item.type}
                  </span>
                </Link>
              ))}
            </div>
          )}
        </WorkoutsSurface>
      </div>

      <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
        <SectionTitle
          eyebrow="For You"
          title="Recommended next"
          description={`Weighted toward your default focus: ${data.settings.defaultFocus.replace(/_/g, ' ')}.`}
          aside={<ActionLink href="/workouts/exercises" label="Browse All Exercises" icon="arrow_forward" secondary />}
        />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {filtered.forYou.slice(0, 8).map((exercise) => (
            <Link
              key={exercise.id}
              href={`/workouts/exercises/${exercise.id}`}
              onClick={() => {
                void doTrackWorkoutRecentView({
                  id: exercise.id,
                  type: 'exercise',
                  title: exercise.name,
                  subtitle: exercise.description,
                  route: `/workouts/exercises/${exercise.id}`,
                  category: exercise.category,
                });
              }}
              style={{
                display: 'grid',
                gap: 12,
                padding: 16,
                borderRadius: 22,
                background: WORKOUTS_TOKENS.surfaceMid,
                textDecoration: 'none',
                color: WORKOUTS_TOKENS.text,
              }}
            >
              <div style={{ display: 'grid', gap: 6 }}>
                <strong style={{ fontSize: 16 }}>{exercise.name}</strong>
                <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                  {exercise.muscleGroups.slice(0, 3).join(' · ')}
                </span>
              </div>
              <span style={{ color: WORKOUTS_TOKENS.textTertiary, fontSize: 12, fontWeight: 700 }}>
                {exercise.defaultReps
                  ? `${exercise.defaultSets} × ${exercise.defaultReps}`
                  : `${exercise.defaultSets} × ${exercise.defaultDuration ?? 0}s`}
              </span>
            </Link>
          ))}
        </div>
      </WorkoutsSurface>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 1fr)', gap: 18 }}>
        <WorkoutsSurface tone="low" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Workout Sessions"
            title="Single-session library"
            description="Desktop workout cards tied directly to the live session route."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.workouts.slice(0, 6).map((workout) => (
              <Link
                key={workout.id}
                href={`/workouts/session?workoutId=${workout.id}`}
                onClick={() => {
                  void doTrackWorkoutRecentView({
                    id: workout.id,
                    type: 'workout',
                    title: workout.title,
                    subtitle: workout.description,
                    route: `/workouts/session?workoutId=${workout.id}`,
                    category: workout.inferredCategory,
                  });
                }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto',
                  gap: 12,
                  padding: 16,
                  borderRadius: 20,
                  background: WORKOUTS_TOKENS.surfaceMid,
                  textDecoration: 'none',
                  color: WORKOUTS_TOKENS.text,
                }}
              >
                <div style={{ display: 'grid', gap: 6 }}>
                  <strong>{workout.title}</strong>
                  <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                    {workout.exercises.length} exercises · {formatMinutes(Math.round(workout.estimatedDuration / 60))}
                  </span>
                </div>
                <span style={{ color: difficultyAccent(workout.difficulty), fontWeight: 800, textTransform: 'uppercase', fontSize: 11, letterSpacing: '0.12em' }}>
                  {workout.difficulty}
                </span>
              </Link>
            ))}
          </div>
        </WorkoutsSurface>

        <WorkoutsSurface tone="mid" style={{ display: 'grid', gap: 18 }}>
          <SectionTitle
            eyebrow="Program Paths"
            title="Longer arcs"
            description="Structured plans that keep the weekly cadence visible."
          />
          <div style={{ display: 'grid', gap: 12 }}>
            {filtered.programs.slice(0, 5).map((program) => (
              <Link
                key={program.id}
                href={`/workouts/programs/${program.id}`}
                onClick={() => {
                  void doTrackWorkoutRecentView({
                    id: program.id,
                    type: 'program',
                    title: program.title,
                    subtitle: program.description,
                    route: `/workouts/programs/${program.id}`,
                    category: null,
                  });
                }}
                style={{
                  display: 'grid',
                  gap: 8,
                  padding: 16,
                  borderRadius: 20,
                  background: WORKOUTS_TOKENS.surfaceHigh,
                  textDecoration: 'none',
                  color: WORKOUTS_TOKENS.text,
                }}
              >
                <strong>{program.title}</strong>
                <span style={{ color: WORKOUTS_TOKENS.textSecondary, fontSize: 13 }}>
                  {program.weekCount} weeks · {program.frequency} sessions / week
                </span>
              </Link>
            ))}
          </div>
        </WorkoutsSurface>
      </div>
    </div>
  );
}
