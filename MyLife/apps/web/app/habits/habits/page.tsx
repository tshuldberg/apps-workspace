'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  doUpdateHabit,
  fetchAreas,
  fetchHabits,
  fetchNegativeStreaks,
  fetchMeasurableStreaks,
  fetchStreaks,
  fetchStreaksWithGrace,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PillButton,
  SectionHeading,
  SecondaryButton,
  SymbolIcon,
  habitTypeLabel,
  resolveAreaTone,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type Habit = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  habitType: string;
  frequency: string;
  gracePeriod: number;
  areaId: string | null;
  isArchived: boolean;
};

type Area = {
  id: string;
  name: string;
  color: string | null;
};

type FilterMode = 'active' | 'archived' | 'all';

export default function HabitsLibraryPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [streaks, setStreaks] = useState<Record<string, number>>({});
  const [query, setQuery] = useState('');
  const [activeArea, setActiveArea] = useState('all');
  const [mode, setMode] = useState<FilterMode>('active');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [habitRows, areaRows] = await Promise.all([
        fetchHabits(),
        fetchAreas(),
      ]);
      const nextHabits = (habitRows as Habit[]) ?? [];
      setHabits(nextHabits);
      setAreas((areaRows as Area[]) ?? []);

      const entries = await Promise.all(nextHabits.map(async (habit) => {
        try {
          if (habit.habitType === 'negative') {
            const streak = await fetchNegativeStreaks(habit.id) as { daysSinceLastSlip: number };
            return [habit.id, streak.daysSinceLastSlip] as const;
          }
          if (habit.habitType === 'measurable') {
            const streak = await fetchMeasurableStreaks(habit.id, habit.gracePeriod) as { currentStreak: number };
            return [habit.id, streak.currentStreak] as const;
          }
          if (habit.gracePeriod > 0) {
            const streak = await fetchStreaksWithGrace(habit.id, habit.gracePeriod) as { currentStreak: number };
            return [habit.id, streak.currentStreak] as const;
          }
          const streak = await fetchStreaks(habit.id) as { currentStreak: number };
          return [habit.id, streak.currentStreak] as const;
        } catch {
          return [habit.id, 0] as const;
        }
      }));
      setStreaks(Object.fromEntries(entries));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load habits.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const areasById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);
  const areaRail = useMemo(() => [{ id: 'all', name: 'All', color: null }, ...areas], [areas]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return habits.filter((habit) => {
      const matchesMode = mode === 'all' || (mode === 'archived' ? habit.isArchived : !habit.isArchived);
      const matchesArea = activeArea === 'all' || habit.areaId === activeArea;
      const matchesQuery = normalized.length === 0 || habit.name.toLowerCase().includes(normalized);
      return matchesMode && matchesArea && matchesQuery;
    });
  }, [activeArea, habits, mode, query]);

  const sections = useMemo(() => {
    const map = new Map<string, Habit[]>();
    for (const habit of filtered) {
      const title = habit.areaId ? areasById.get(habit.areaId)?.name ?? 'Other' : 'Other';
      const bucket = map.get(title) ?? [];
      bucket.push(habit);
      map.set(title, bucket);
    }
    return [...map.entries()];
  }, [areasById, filtered]);

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Library"
        title="Every habit, grouped by area and ready for review."
        description="Filter the library by area or state, inspect streak health, and jump into the detail surface for reminders, notes, and action items."
      />

      <GlassPanel level={1} style={{ padding: 20, display: 'grid', gap: 16 }}>
        <SectionHeading detail={`${filtered.length} visible habits`} title="Filters" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search habits"
          style={{ width: '100%', borderRadius: 18, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px', fontSize: 14 }}
        />

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {([
            ['active', 'Active'],
            ['archived', 'Archived'],
            ['all', 'All'],
          ] as const).map(([value, label]) => (
            <PillButton active={mode === value} key={value} onClick={() => setMode(value)}>
              {label}
            </PillButton>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {areaRail.map((area) => (
            <button
              key={area.id}
              onClick={() => setActiveArea(area.id)}
              style={{
                padding: '10px 14px',
                borderRadius: 999,
                border: 'none',
                background: activeArea === area.id ? withAlpha(resolveAreaTone(area.name, area.color), 0.18) : withAlpha('#ffffff', 0.04),
                color: activeArea === area.id ? 'white' : HB_TEXT_SECONDARY,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {area.name}
            </button>
          ))}
        </div>
      </GlassPanel>

      {error ? <EmptyState body={error} title="Habit library unavailable" /> : null}

      {loading ? (
        <div style={{ display: 'grid', gap: 16 }}>
          {Array.from({ length: 6 }).map((_, index) => (
            <GlassPanel key={index} level={1} style={{ minHeight: 88 }}>
              <div />
            </GlassPanel>
          ))}
        </div>
      ) : sections.length === 0 ? (
        <EmptyState body="Try a wider filter or add a few more habits to populate the library." title="No habits match this filter" />
      ) : (
        <div style={{ display: 'grid', gap: 18 }}>
          {sections.map(([title, items]) => {
            const tone = resolveAreaTone(title, items[0]?.areaId ? areasById.get(items[0].areaId)?.color ?? null : null);
            return (
              <GlassPanel key={title} level={1} style={{ padding: 20, display: 'grid', gap: 14 }}>
                <SectionHeading detail={`${items.length} habit${items.length === 1 ? '' : 's'}`} title={title} />
                <div style={{ display: 'grid', gap: 10 }}>
                  {items.map((habit) => (
                    <div key={habit.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: 16, borderRadius: 22, background: withAlpha('#ffffff', 0.04) }}>
                      <div style={{ width: 42, height: 42, borderRadius: 16, display: 'grid', placeItems: 'center', background: withAlpha(tone, 0.16), fontSize: 20 }}>
                        {habit.icon ?? '✓'}
                      </div>
                      <Link href={`/habits/${habit.id}`} style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700 }}>{habit.name}</div>
                        <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>
                          {habitTypeLabel(habit.habitType)} · {habit.frequency.replace('_', ' ')} · {streaks[habit.id] ?? 0}d streak
                        </div>
                      </Link>
                      <div style={{ display: 'flex', gap: 10 }}>
                        <SecondaryButton onClick={() => void doUpdateHabit(habit.id, { isArchived: !habit.isArchived }).then(load)}>
                          <SymbolIcon name={habit.isArchived ? 'restore' : 'archive'} size={18} />
                          {habit.isArchived ? 'Restore' : 'Archive'}
                        </SecondaryButton>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassPanel>
            );
          })}
        </div>
      )}
    </div>
  );
}
