'use client';

import { useEffect, useMemo, useState } from 'react';
import { BUILT_IN_PROGRAMS } from '@mylife/habits';
import {
  doCreateEnrollment,
  fetchHabits,
  fetchProgramProgress,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PillButton,
  PrimaryButton,
  ProgressBar,
  SectionHeading,
  SymbolIcon,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type Habit = {
  id: string;
  name: string;
};

type ProgramProgress = {
  programId: string;
  currentDay: number;
  totalDays: number;
  status: 'active' | 'completed' | 'paused';
  elapsedPercent: number;
  completionRate: number;
  completedDays: number;
  days: Array<{ day: number; target: number | null; completed: boolean }>;
};

type Tab = 'active' | 'browse' | 'completed';

export default function HabitsProgramsPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [habits, setHabits] = useState<Habit[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, ProgramProgress>>({});
  const [selectedId, setSelectedId] = useState<string | null>(BUILT_IN_PROGRAMS[0]?.id ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      setError(null);
      const habitRows = (await fetchHabits({ isArchived: false })) as Habit[];
      setHabits(habitRows);
      const entries = await Promise.all(BUILT_IN_PROGRAMS.map(async (program) => [program.id, await fetchProgramProgress(program.id)] as const));
      setProgressMap(Object.fromEntries(entries) as Record<string, ProgramProgress>);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load programs.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const visiblePrograms = useMemo(() => BUILT_IN_PROGRAMS.filter((program) => {
    const progress = progressMap[program.id];
    if (tab === 'browse') return !progress || progress.status !== 'completed';
    if (tab === 'active') return progress?.status === 'active';
    return progress?.status === 'completed';
  }), [progressMap, tab]);

  const selected = BUILT_IN_PROGRAMS.find((program) => program.id === selectedId) ?? null;
  const selectedProgress = selected ? progressMap[selected.id] : null;

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Programs"
        title="Guided challenges with browse, active, and completed states."
        description="Use the programs surface to start structured challenges, inspect day-by-day pacing, and keep the currently active track visible beside the catalog."
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {(['active', 'browse', 'completed'] as Tab[]).map((value) => (
          <PillButton active={tab === value} key={value} onClick={() => setTab(value)}>
            {value.charAt(0).toUpperCase() + value.slice(1)}
          </PillButton>
        ))}
      </div>

      {error ? <EmptyState body={error} title="Programs unavailable" /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 20 }}>
        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail={`${visiblePrograms.length} programs in this view`} title="Program list" />
          {loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} style={{ height: 100, borderRadius: 22, background: withAlpha('#ffffff', 0.04) }} />
              ))}
            </div>
          ) : visiblePrograms.length === 0 ? (
            <EmptyState body="Switch tabs or start a challenge to populate this view." title="No programs here yet" />
          ) : (
            <div style={{ display: 'grid', gap: 12 }}>
              {visiblePrograms.map((program) => {
                const progress = progressMap[program.id];
                return (
                  <button
                    key={program.id}
                    onClick={() => setSelectedId(program.id)}
                    style={{
                      padding: 18,
                      borderRadius: 24,
                      border: 'none',
                      background: selectedId === program.id ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04),
                      color: 'white',
                      cursor: 'pointer',
                      textAlign: 'left',
                      display: 'grid',
                      gap: 10,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{program.name}</div>
                        <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>{program.description}</div>
                      </div>
                      <div style={{ padding: '10px 12px', borderRadius: 18, background: withAlpha(HB_STREAK.fire, 0.16), fontWeight: 700 }}>
                        {program.durationDays}d
                      </div>
                    </div>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>
                      {progress ? `Day ${progress.currentDay} · ${progress.completionRate}% complete` : `${program.difficulty} · ${program.focusArea}`}
                    </div>
                    <ProgressBar tone={HB_ACCENT_LIGHT} value={progress?.elapsedPercent ?? 0} />
                  </button>
                );
              })}
            </div>
          )}
        </GlassPanel>

        <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail="Program detail and current schedule." title={selected?.name ?? 'Program detail'} />
          {selected ? (
            <>
              <div style={{ color: '#E4E1E9', lineHeight: 1.8 }}>{selected.description}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                <div style={{ padding: 16, borderRadius: 20, background: withAlpha(HB_ACCENT_LIGHT, 0.14) }}>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Duration</div>
                  <div style={{ marginTop: 6, fontSize: 24, fontWeight: 800 }}>{selected.durationDays}d</div>
                </div>
                <div style={{ padding: 16, borderRadius: 20, background: withAlpha('#8BCFF0', 0.14) }}>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Difficulty</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>{selected.difficulty}</div>
                </div>
                <div style={{ padding: 16, borderRadius: 20, background: withAlpha(HB_STREAK.fire, 0.14) }}>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Focus area</div>
                  <div style={{ marginTop: 6, fontSize: 18, fontWeight: 800 }}>{selected.focusArea}</div>
                </div>
              </div>
              <div style={{ display: 'grid', gap: 10 }}>
                {selected.schedule.slice(0, 7).map((value, index) => (
                  <div key={`${selected.id}-${index}`} style={{ padding: 12, borderRadius: 16, background: withAlpha('#ffffff', 0.04), display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <span>Day {index + 1}</span>
                    <span style={{ color: HB_TEXT_SECONDARY }}>{value} target</span>
                  </div>
                ))}
              </div>
              <PrimaryButton
                onClick={() => {
                  if (!habits[0]) return;
                  void doCreateEnrollment(crypto.randomUUID(), {
                    programId: selected.id,
                    habitId: habits[0].id,
                    startDate: new Date().toISOString().slice(0, 10),
                  }).then(load);
                }}
              >
                <SymbolIcon color="#0E0E13" filled name="flag" size={18} />
                {selectedProgress?.status === 'active' ? 'Continue program' : 'Start program'}
              </PrimaryButton>
            </>
          ) : (
            <EmptyState body="Choose a program from the list to inspect the schedule and current progress." title="No program selected" />
          )}
        </GlassPanel>
      </div>
    </div>
  );
}
