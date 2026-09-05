'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  doCreateHabitStack,
  doDeleteHabitStack,
  fetchHabitStacks,
  fetchHabits,
  fetchStackAnalytics,
  fetchStackSuggestions,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  SymbolIcon,
  ProgressBar,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type Habit = {
  id: string;
  name: string;
  icon: string | null;
};

type HabitStack = {
  id: string;
  anchorHabitId: string;
  habitIds: string[];
  chain: Array<{ habitId: string }>;
};

type HabitStackSuggestion = {
  id: string;
  title: string;
  description: string;
  habitIds: string[];
  confidence: number;
};

type HabitStackAnalytics = {
  anchorHabitId: string;
  completionRate: number;
  totalActivityDays: number;
  strongestStepHabitId: string | null;
  chainBreaks: Array<{ habitId: string; dropOff: number }>;
};

export default function HabitsStackingPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [stacks, setStacks] = useState<HabitStack[]>([]);
  const [suggestions, setSuggestions] = useState<HabitStackSuggestion[]>([]);
  const [analytics, setAnalytics] = useState<Record<string, HabitStackAnalytics>>({});
  const [selectedHabitIds, setSelectedHabitIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [habitRows, stackRows, suggestionRows] = await Promise.all([
        fetchHabits({ isArchived: false }),
        fetchHabitStacks(),
        fetchStackSuggestions(),
      ]);
      const nextStacks = (stackRows as HabitStack[]) ?? [];
      setHabits(habitRows as Habit[]);
      setStacks(nextStacks);
      setSuggestions((suggestionRows as HabitStackSuggestion[]) ?? []);

      const analyticEntries = await Promise.all(
        nextStacks.map(async (stack) => ({
          anchorHabitId: stack.anchorHabitId,
          analytics: (await fetchStackAnalytics(stack.anchorHabitId)) as HabitStackAnalytics | null,
        })),
      );
      setAnalytics(
        analyticEntries.reduce<Record<string, HabitStackAnalytics>>((accumulator, entry) => {
          if (entry.analytics) {
            accumulator[entry.anchorHabitId] = entry.analytics;
          }
          return accumulator;
        }, {}),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stack planner.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const habitsById = useMemo(() => new Map(habits.map((habit) => [habit.id, habit])), [habits]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Stacking"
        title="Build chains that make the next habit easier."
        description="Turn single habits into a predictable sequence, then inspect where the chain drops off so you can tighten weak steps."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.05fr', gap: 20 }}>
        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail="Pick at least two habits to create a stack." title="New stack" />
          <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflow: 'auto', paddingRight: 6 }}>
            {habits.map((habit) => {
              const selected = selectedHabitIds.includes(habit.id);
              return (
                <button
                  key={habit.id}
                  onClick={() => setSelectedHabitIds((current) => selected ? current.filter((value) => value !== habit.id) : [...current, habit.id])}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                    padding: 14,
                    borderRadius: 18,
                    border: 'none',
                    background: selected ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04),
                    color: 'white',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 14, display: 'grid', placeItems: 'center', background: withAlpha('#ffffff', 0.06), fontSize: 18 }}>
                      {habit.icon ?? '✓'}
                    </div>
                    <div style={{ fontWeight: 700 }}>{habit.name}</div>
                  </div>
                  <SymbolIcon color={selected ? HB_ACCENT_LIGHT : HB_TEXT_SECONDARY} filled={selected} name={selected ? 'check_circle' : 'radio_button_unchecked'} />
                </button>
              );
            })}
          </div>

          <PrimaryButton
            onClick={() => {
              if (selectedHabitIds.length < 2) return;
              void doCreateHabitStack({ habitIds: selectedHabitIds }).then(() => {
                setSelectedHabitIds([]);
                return load();
              }).catch((err) => setError(err instanceof Error ? err.message : 'Failed to create stack.'));
            }}
          >
            <SymbolIcon color="#0E0E13" filled name="add_link" size={18} />
            Create stack
          </PrimaryButton>

          {suggestions.length > 0 ? (
            <div style={{ display: 'grid', gap: 10 }}>
              <SectionHeading detail="Suggested chains from your current activity." title="Suggested stacks" />
              {suggestions.slice(0, 3).map((suggestion) => (
                <GlassPanel key={suggestion.id} level={1} style={{ padding: 16, display: 'grid', gap: 10 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{suggestion.title}</div>
                        <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>{suggestion.description}</div>
                      </div>
                    <div style={{ color: HB_STREAK.fire, fontWeight: 700 }}>{Math.round(suggestion.confidence > 1 ? suggestion.confidence : suggestion.confidence * 100)}%</div>
                  </div>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>
                    {suggestion.habitIds.map((habitId) => habitsById.get(habitId)?.name ?? 'Habit').join(' → ')}
                  </div>
                  <SecondaryButton onClick={() => void doCreateHabitStack({ habitIds: suggestion.habitIds }).then(load)}>
                    <SymbolIcon name="auto_awesome" size={18} />
                    Use suggestion
                  </SecondaryButton>
                </GlassPanel>
              ))}
            </div>
          ) : null}
        </GlassPanel>

        <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail="Existing chain visualizations and weak points." title="Current stacks" />
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} style={{ height: 94, borderRadius: 24, background: withAlpha('#ffffff', 0.04) }} />
              ))}
            </div>
          ) : stacks.length === 0 ? (
            <EmptyState body="Create a sequence to start turning isolated habits into a smoother flow." title="No stacks yet" />
          ) : (
            <div style={{ display: 'grid', gap: 14 }}>
              {stacks.map((stack) => {
                const chainNames = stack.habitIds.map((habitId) => habitsById.get(habitId)?.name ?? 'Habit');
                const stackAnalytics = analytics[stack.anchorHabitId];
                return (
                  <div key={stack.id} style={{ padding: 18, borderRadius: 24, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{chainNames[0]} flow</div>
                        <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>{chainNames.join(' → ')}</div>
                      </div>
                      <SecondaryButton onClick={() => void doDeleteHabitStack(stack.anchorHabitId).then(load)}>
                        <SymbolIcon name="delete" size={18} />
                        Remove
                      </SecondaryButton>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                      <div style={{ padding: 14, borderRadius: 18, background: withAlpha(HB_ACCENT_LIGHT, 0.12) }}>
                        <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Completion rate</div>
                        <div style={{ marginTop: 6, fontWeight: 800, fontSize: 24 }}>{Math.round((stackAnalytics?.completionRate ?? 0) * 100)}%</div>
                      </div>
                      <div style={{ padding: 14, borderRadius: 18, background: withAlpha(HB_STREAK.fire, 0.12) }}>
                        <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Activity days</div>
                        <div style={{ marginTop: 6, fontWeight: 800, fontSize: 24 }}>{stackAnalytics?.totalActivityDays ?? 0}</div>
                      </div>
                      <div style={{ padding: 14, borderRadius: 18, background: withAlpha('#8BCFF0', 0.12) }}>
                        <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Strongest step</div>
                        <div style={{ marginTop: 6, fontWeight: 800, fontSize: 18 }}>
                          {stackAnalytics?.strongestStepHabitId ? habitsById.get(stackAnalytics.strongestStepHabitId)?.name ?? 'Habit' : 'None'}
                        </div>
                      </div>
                    </div>

                    {stackAnalytics?.chainBreaks?.length ? (
                      <div style={{ display: 'grid', gap: 10 }}>
                        {stackAnalytics.chainBreaks.slice(0, 3).map((breakpoint) => {
                          const name = habitsById.get(breakpoint.habitId)?.name ?? 'Habit';
                          const health = Math.max(0, 100 - Math.round(breakpoint.dropOff * 100));
                          return (
                            <div key={breakpoint.habitId} style={{ display: 'grid', gap: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                                <span>{name}</span>
                                <span style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{Math.round(breakpoint.dropOff * 100)}% drop-off</span>
                              </div>
                              <ProgressBar tone={health > 60 ? HB_ACCENT_LIGHT : HB_STREAK.fire} value={health} />
                            </div>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
