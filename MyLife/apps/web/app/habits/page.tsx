'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  doDeleteCompletion,
  doEnsurePlayerProfile,
  doRecordCompletion,
  doRecordMeasurement,
  fetchAreas,
  fetchCompletionsForDate,
  fetchHabits,
  fetchMeasurementsForDate,
  fetchNegativeStreaks,
  fetchMeasurableStreaks,
  fetchPetState,
  fetchPlayerProfile,
  fetchSessionsForDate,
  fetchSleepRoutineContext,
  fetchStreaks,
  fetchStreaksWithGrace,
} from './actions';
import {
  EmptyState,
  GlassPanel,
  MetricTile,
  PageIntro,
  PrimaryButton,
  ProgressBar,
  SectionHeading,
  SecondaryButton,
  SymbolIcon,
  groupLabel,
  habitTypeLabel,
  resolveAreaTone,
} from './ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, HB_XP, withAlpha } from '@mylife/habits';
import type { SleepRoutineContext } from '@mylife/habits';

type Habit = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  frequency: string;
  habitType: string;
  targetCount: number;
  gracePeriod: number;
  timeOfDay: string | null;
  areaId: string | null;
  specificDays: string[] | null;
};

type Area = {
  id: string;
  name: string;
  color: string | null;
};

type Completion = {
  id: string;
  habitId: string;
};

type Measurement = {
  habitId: string;
  value: number;
  target: number;
};

type Session = {
  habitId: string;
  completed: boolean;
};

type PlayerProfile = {
  currentLevel: number;
  totalXP: number;
};

type PetState = {
  name: string;
  species: string;
};

type Streak = {
  currentStreak: number;
  longestStreak: number;
};

const DAY_MAP: Record<number, string> = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
const TIME_GROUPS = ['morning', 'afternoon', 'evening', 'anytime'] as const;

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function isDueToday(habit: Habit) {
  const day = DAY_MAP[new Date().getDay()];
  if (habit.frequency === 'daily') return true;
  if (habit.frequency === 'specific_days' && habit.specificDays) return habit.specificDays.includes(day);
  if (habit.frequency === 'weekly') return day === 'mon';
  if (habit.frequency === 'monthly') return new Date().getDate() === 1;
  return true;
}

export default function HabitsTodayPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [streaks, setStreaks] = useState<Record<string, Streak>>({});
  const [player, setPlayer] = useState<PlayerProfile | null>(null);
  const [pet, setPet] = useState<PetState | null>(null);
  const [sleepRoutineContext, setSleepRoutineContext] = useState<SleepRoutineContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      await doEnsurePlayerProfile();
      const date = todayKey();
      const [habitRows, areaRows, completionRows, measurementRows, sessionRows, playerProfile, petState, sleepContext] = await Promise.all([
        fetchHabits({ isArchived: false }),
        fetchAreas(),
        fetchCompletionsForDate(date),
        fetchMeasurementsForDate(date),
        fetchSessionsForDate(date),
        fetchPlayerProfile(),
        fetchPetState(),
        fetchSleepRoutineContext(date),
      ]);
      const nextHabits = habitRows as Habit[];
      setHabits(nextHabits);
      setAreas((areaRows as Area[]) ?? []);
      setCompletions((completionRows as Completion[]) ?? []);
      setMeasurements((measurementRows as Measurement[]) ?? []);
      setSessions((sessionRows as Session[]) ?? []);
      setPlayer((playerProfile as PlayerProfile | null) ?? null);
      setPet((petState as PetState | null) ?? null);
      setSleepRoutineContext((sleepContext as SleepRoutineContext | null) ?? null);

      const entries = await Promise.all(
        nextHabits.map(async (habit) => {
          try {
            if (habit.habitType === 'negative') {
              const streak = await fetchNegativeStreaks(habit.id) as { daysSinceLastSlip: number; longestCleanStreak: number };
              return [habit.id, { currentStreak: streak.daysSinceLastSlip, longestStreak: streak.longestCleanStreak }] as const;
            }
            if (habit.habitType === 'measurable') {
              return [habit.id, await fetchMeasurableStreaks(habit.id, habit.gracePeriod) as Streak] as const;
            }
            if (habit.gracePeriod > 0) {
              return [habit.id, await fetchStreaksWithGrace(habit.id, habit.gracePeriod) as Streak] as const;
            }
            return [habit.id, await fetchStreaks(habit.id) as Streak] as const;
          } catch {
            return [habit.id, { currentStreak: 0, longestStreak: 0 }] as const;
          }
        }),
      );
      setStreaks(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load the today dashboard.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const dueHabits = useMemo(() => habits.filter(isDueToday), [habits]);
  const completionsByHabit = useMemo(() => new Map(completions.map((completion) => [completion.habitId, completion])), [completions]);
  const measurementTotals = useMemo(() => {
    const map = new Map<string, number>();
    for (const measurement of measurements) {
      map.set(measurement.habitId, (map.get(measurement.habitId) ?? 0) + measurement.value);
    }
    return map;
  }, [measurements]);
  const sessionsByHabit = useMemo(() => new Map(sessions.map((session) => [session.habitId, session.completed])), [sessions]);

  const grouped = useMemo(() => {
    const map = new Map<string, Habit[]>();
    for (const key of TIME_GROUPS) map.set(key, []);
    for (const habit of dueHabits) {
      const bucket = (habit.timeOfDay ?? 'anytime').toLowerCase();
      const key = TIME_GROUPS.includes(bucket as (typeof TIME_GROUPS)[number]) ? bucket : 'anytime';
      map.get(key)?.push(habit);
    }
    return map;
  }, [dueHabits]);

  const completedCount = useMemo(() => dueHabits.filter((habit) => {
    if (habit.habitType === 'measurable') return (measurementTotals.get(habit.id) ?? 0) >= habit.targetCount;
    if (habit.habitType === 'timed') return sessionsByHabit.get(habit.id) === true;
    return completionsByHabit.has(habit.id);
  }).length, [completionsByHabit, dueHabits, measurementTotals, sessionsByHabit]);

  const streakHero = useMemo(() => dueHabits.reduce((best, habit) => Math.max(best, streaks[habit.id]?.currentStreak ?? 0), 0), [dueHabits, streaks]);

  const completionRate = dueHabits.length === 0 ? 0 : Math.round((completedCount / dueHabits.length) * 100);
  const xpProgress = player ? Math.max(0, Math.min(100, ((player.totalXP % 1000) / 1000) * 100)) : 48;

  const handleQuickToggle = async (habit: Habit) => {
    try {
      if (habit.habitType === 'measurable') {
        const current = measurementTotals.get(habit.id) ?? 0;
        await doRecordMeasurement(crypto.randomUUID(), habit.id, new Date().toISOString(), current + 1, habit.targetCount);
      } else {
        const existing = completionsByHabit.get(habit.id);
        if (existing) {
          await doDeleteCompletion(existing.id);
        } else {
          await doRecordCompletion(crypto.randomUUID(), habit.id, new Date().toISOString(), 1);
        }
      }
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update habit.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Today"
        title="Today’s habit board, streak pressure, and recovery context."
        description="See the day grouped by time of day, keep your streak hero in view, and use quick actions to jump into the deeper systems when you need more than a checkmark."
        actions={
          <>
            <PrimaryButton href="/habits/habits">
              <SymbolIcon color="#0E0E13" filled name="view_list" size={18} />
              Open habit library
            </PrimaryButton>
            <SecondaryButton href="/habits/focus">
              <SymbolIcon name="timer" size={18} />
              Start focus block
            </SecondaryButton>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        <MetricTile detail="due across the current day" label="Due today" tone={HB_ACCENT_LIGHT} value={String(dueHabits.length)} />
        <MetricTile detail="based on today’s check-ins and sessions" label="Completion rate" tone={HB_XP} value={`${completionRate}%`} />
        <MetricTile detail="highest active streak on the board" label="Streak hero" tone={HB_STREAK.fire} value={`${streakHero}d`} />
      </div>

      {error ? <EmptyState body={error} title="Today board unavailable" /> : null}

      {sleepRoutineContext ? (
        <SleepRoutineBridgeCard context={sleepRoutineContext} />
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
        <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Momentum, companion, and quick links." title="Streak hero" />
          <div style={{ padding: 22, borderRadius: 24, background: `linear-gradient(135deg, ${withAlpha(HB_STREAK.fire, 0.22)} 0%, ${withAlpha(HB_ACCENT_LIGHT, 0.18)} 100%)` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, alignItems: 'flex-start' }}>
              <div>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginBottom: 8 }}>Current lead streak</div>
                <div style={{ fontSize: 54, lineHeight: 1, fontWeight: 800, color: HB_STREAK.fire }}>{streakHero}d</div>
                <div style={{ color: HB_TEXT_SECONDARY, marginTop: 10 }}>Keep the current run intact before the night closes.</div>
              </div>
              {pet ? (
                <div style={{ width: 92, height: 92, borderRadius: 28, display: 'grid', placeItems: 'center', background: withAlpha('#ffffff', 0.08), textAlign: 'center' }}>
                  <div style={{ fontSize: 30 }}>🐾</div>
                  <div style={{ fontSize: 12, color: HB_TEXT_SECONDARY }}>{pet.name}</div>
                </div>
              ) : null}
            </div>
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {[
              ['/habits/pet', 'Pet sanctuary', 'pets'],
              ['/habits/sobriety', 'Sobriety dashboard', 'timelapse'],
              ['/habits/cravings', 'Craving log', 'analytics'],
            ].map(([href, label, icon]) => (
              <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 14, display: 'grid', placeItems: 'center', background: withAlpha(HB_ACCENT_LIGHT, 0.16) }}>
                    <SymbolIcon color={HB_ACCENT_LIGHT} filled name={icon} size={18} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{label}</div>
                </div>
                <SymbolIcon name="arrow_forward" size={18} />
              </Link>
            ))}
          </div>
        </GlassPanel>

        <div style={{ display: 'grid', gap: 16 }}>
          {loading ? (
            Array.from({ length: 4 }).map((_, index) => (
              <GlassPanel key={index} level={1} style={{ minHeight: 160 }}>
                <div />
              </GlassPanel>
            ))
          ) : dueHabits.length === 0 ? (
            <EmptyState body="Once habits are active for today, they will land here grouped by time of day." title="Nothing due right now" />
          ) : (
            TIME_GROUPS.map((group) => {
              const habitsInGroup = grouped.get(group) ?? [];
              if (habitsInGroup.length === 0) return null;
              return (
                <GlassPanel key={group} level={1} style={{ padding: 20, display: 'grid', gap: 12 }}>
                  <SectionHeading detail={`${habitsInGroup.length} habit${habitsInGroup.length === 1 ? '' : 's'}`} title={groupLabel(group)} />
                  <div style={{ display: 'grid', gap: 10 }}>
                    {habitsInGroup.map((habit) => {
                      const area = habit.areaId ? areasById.get(habit.areaId) : null;
                      const tone = resolveAreaTone(area?.name, habit.color ?? area?.color ?? null);
                      const isDone = habit.habitType === 'measurable'
                        ? (measurementTotals.get(habit.id) ?? 0) >= habit.targetCount
                        : habit.habitType === 'timed'
                          ? sessionsByHabit.get(habit.id) === true
                          : completionsByHabit.has(habit.id);

                      return (
                        <div key={habit.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: 14, borderRadius: 20, background: withAlpha('#ffffff', 0.04) }}>
                          <button
                            onClick={() => void handleQuickToggle(habit)}
                            style={{
                              width: 42,
                              height: 42,
                              borderRadius: 999,
                              border: 'none',
                              background: isDone ? withAlpha(tone, 0.26) : withAlpha('#ffffff', 0.04),
                              color: tone,
                              cursor: 'pointer',
                            }}
                          >
                            <SymbolIcon color={tone} filled={isDone} name={isDone ? 'check_circle' : 'radio_button_unchecked'} size={22} />
                          </button>
                          <Link href={`/habits/${habit.id}`} style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span>{habit.icon ?? '✓'}</span>
                              <span>{habit.name}</span>
                            </div>
                            <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>
                              {area?.name ?? 'General'} · {habitTypeLabel(habit.habitType)} · {streaks[habit.id]?.currentStreak ?? 0}d streak
                            </div>
                          </Link>
                          <div style={{ padding: '8px 10px', borderRadius: 999, background: withAlpha(tone, 0.14), color: tone, fontSize: 12, fontWeight: 700 }}>
                            {habit.habitType === 'measurable'
                              ? `${measurementTotals.get(habit.id) ?? 0}/${habit.targetCount}`
                              : habit.habitType === 'timed'
                                ? 'Timer'
                                : 'Today'}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </GlassPanel>
              );
            })
          )}
        </div>

        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
          <SectionHeading detail="XP, progress, and quick jumps." title="Daily progress" />
          <div style={{ padding: 18, borderRadius: 20, background: withAlpha('#ffffff', 0.04) }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
              <div>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>XP progress</div>
                <div style={{ marginTop: 6, fontSize: 32, fontWeight: 800, color: HB_XP }}>
                  {player?.totalXP?.toLocaleString() ?? '0'}
                </div>
              </div>
              <div style={{ padding: '10px 12px', borderRadius: 18, background: withAlpha(HB_XP, 0.16), color: HB_XP, fontWeight: 700 }}>
                Lv {player?.currentLevel ?? 1}
              </div>
            </div>
            <ProgressBar tone={HB_XP} value={xpProgress} />
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {[
              ['/habits/stats', 'Open analytics', 'query_stats'],
              ['/habits/programs', 'Browse programs', 'flag'],
              ['/habits/stacking', 'Plan stacks', 'alt_route'],
              ['/habits/settings', 'Review settings', 'settings'],
            ].map(([href, label, icon]) => (
              <Link key={href} href={href} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04) }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 36, height: 36, borderRadius: 14, display: 'grid', placeItems: 'center', background: withAlpha(HB_ACCENT_LIGHT, 0.16) }}>
                    <SymbolIcon color={HB_ACCENT_LIGHT} filled name={icon} size={18} />
                  </div>
                  <div style={{ fontWeight: 700 }}>{label}</div>
                </div>
                <SymbolIcon name="arrow_forward" size={18} />
              </Link>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}

function SleepRoutineBridgeCard({ context }: { context: SleepRoutineContext }) {
  return (
    <GlassPanel level={2} style={{ padding: 22, display: 'grid', gap: 14 }}>
      <SectionHeading
        detail={`${context.completedRoutineCount}/${context.routineHabitCount} routine habits · ${context.completionRate}%`}
        title="Sleep routine context"
      />
      <p style={{ margin: 0, color: HB_TEXT_SECONDARY, fontSize: 14, lineHeight: 1.7 }}>
        {context.context}
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
        <MetricTile
          detail="last sleep log"
          label="Sleep quality"
          tone={HB_ACCENT_LIGHT}
          value={`${context.qualityRating}/5`}
        />
        <MetricTile
          detail={`routine date ${context.routineDate}`}
          label="Routine completion"
          tone={HB_XP}
          value={`${context.completionRate}%`}
        />
      </div>
    </GlassPanel>
  );
}
