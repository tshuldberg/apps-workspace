'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  PRESET_COPING_STRATEGIES,
  PRESET_TRIGGERS,
  analyzePeakTimes,
  analyzeTriggerFrequency,
} from '@mylife/habits';
import {
  doCreateCraving,
  fetchAllTriggersForHabit,
  fetchCravingsForHabit,
  fetchHabits,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  PrimaryButton,
  SectionHeading,
  SymbolIcon,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type Habit = {
  id: string;
  name: string;
  habitType: string;
};

type Craving = {
  id: string;
  intensity: number;
  outcome: string | null;
  loggedAt: string;
  notes: string | null;
};

type CravingTrigger = {
  triggerName: string;
  triggerCategory: string;
};

const OUTCOMES = ['resisted', 'gave_in', 'distracted', 'delayed'] as const;

export default function HabitsCravingsPage() {
  const [habits, setHabits] = useState<Habit[]>([]);
  const [selectedHabitId, setSelectedHabitId] = useState('');
  const [cravings, setCravings] = useState<Craving[]>([]);
  const [triggers, setTriggers] = useState<CravingTrigger[]>([]);
  const [intensity, setIntensity] = useState(5);
  const [duration, setDuration] = useState('');
  const [notes, setNotes] = useState('');
  const [outcome, setOutcome] = useState<(typeof OUTCOMES)[number]>('resisted');
  const [copingStrategy, setCopingStrategy] = useState('');
  const [selectedTriggers, setSelectedTriggers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async (targetHabitId?: string) => {
    try {
      setError(null);
      const habitRows = (await fetchHabits({ isArchived: false })) as Habit[];
      const negativeHabits = habitRows.filter((habit) => habit.habitType === 'negative');
      setHabits(negativeHabits);

      const nextHabitId = targetHabitId ?? selectedHabitId ?? negativeHabits[0]?.id ?? '';
      setSelectedHabitId(nextHabitId);

      if (nextHabitId) {
        const [cravingRows, triggerRows] = await Promise.all([
          fetchCravingsForHabit(nextHabitId),
          fetchAllTriggersForHabit(nextHabitId),
        ]);
        setCravings((cravingRows as Craving[]) ?? []);
        setTriggers((triggerRows as CravingTrigger[]) ?? []);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cravings data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedHabitId) return;
    void load(selectedHabitId);
  }, [selectedHabitId]);

  const triggerStats = analyzeTriggerFrequency(triggers as never);
  const peakStats = analyzePeakTimes(cravings as never).map((entry) => ({
    label: `${entry.hour}:00`,
    value: entry.count,
  }));

  const handleSave = async () => {
    if (!selectedHabitId) return;
    try {
      await doCreateCraving(crypto.randomUUID(), {
        habitId: selectedHabitId,
        intensity,
        durationMinutes: duration ? Number.parseInt(duration, 10) : undefined,
        copingStrategy: copingStrategy || undefined,
        outcome,
        notes: notes || undefined,
        triggers: selectedTriggers.map((name) => {
          const preset = PRESET_TRIGGERS.find((entry) => entry.name === name);
          return {
            id: crypto.randomUUID(),
            name,
            category: preset?.category ?? 'custom',
          };
        }),
      });
      setIntensity(5);
      setDuration('');
      setNotes('');
      setCopingStrategy('');
      setOutcome('resisted');
      setSelectedTriggers([]);
      await load(selectedHabitId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save craving log.');
    }
  };

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Cravings"
        title="Trigger tracking, coping strategy, and recent weak spots."
        description="Log cravings fast, see which triggers repeat, and keep the recovery context visible without switching away from the habits workspace."
      />

      {error ? <EmptyState body={error} title="Craving insights unavailable" /> : null}

      {habits.length === 0 && !loading ? (
        <EmptyState body="Create a negative-type habit to unlock craving tracking and sobriety analytics." title="No recovery habits yet" />
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '0.98fr 1.02fr', gap: 20 }}>
          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail="Log the moment while it is still fresh." title="Craving log" />
            <select
              value={selectedHabitId}
              onChange={(event) => setSelectedHabitId(event.target.value)}
              style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
            >
              {habits.map((habit) => (
                <option key={habit.id} value={habit.id}>{habit.name}</option>
              ))}
            </select>
            <div style={{ display: 'grid', gap: 8 }}>
              <label style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Intensity: {intensity}/10</label>
              <input type="range" min={1} max={10} value={intensity} onChange={(event) => setIntensity(Number(event.target.value))} style={{ width: '100%', accentColor: HB_ACCENT_LIGHT }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
              <input
                value={duration}
                onChange={(event) => setDuration(event.target.value)}
                placeholder="Duration (min)"
                style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
              />
              <select
                value={copingStrategy}
                onChange={(event) => setCopingStrategy(event.target.value)}
                style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
              >
                <option value="">Select coping strategy</option>
                {PRESET_COPING_STRATEGIES.map((value) => (
                  <option key={value} value={value}>{value}</option>
                ))}
              </select>
            </div>
            <select
              value={outcome}
              onChange={(event) => setOutcome(event.target.value as (typeof OUTCOMES)[number])}
              style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
            >
              {OUTCOMES.map((value) => (
                <option key={value} value={value}>{value.replace('_', ' ')}</option>
              ))}
            </select>
            <textarea
              rows={4}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Optional notes, location, or context"
              style={{ borderRadius: 18, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '16px 18px', resize: 'vertical' }}
            />
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {PRESET_TRIGGERS.map((trigger) => {
                const active = selectedTriggers.includes(trigger.name);
                return (
                  <button
                    key={trigger.name}
                    onClick={() => setSelectedTriggers((current) => active ? current.filter((value) => value !== trigger.name) : [...current, trigger.name])}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 999,
                      border: 'none',
                      background: active ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04),
                      color: 'white',
                      cursor: 'pointer',
                    }}
                  >
                    {trigger.name}
                  </button>
                );
              })}
            </div>
            <PrimaryButton onClick={() => void handleSave()}>
              <SymbolIcon color="#0E0E13" filled name="save" size={18} />
              Save craving
            </PrimaryButton>
          </GlassPanel>

          <div style={{ display: 'grid', gap: 20 }}>
            <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 18 }}>
              <SectionHeading detail="Most repeated triggers in the selected habit." title="Trigger frequency" />
              {triggerStats.length === 0 ? (
                <EmptyState body="Log a few cravings to surface repeat triggers." title="No trigger data yet" />
              ) : (
                <div style={{ width: '100%', height: 240 }}>
                  <ResponsiveContainer>
                    <BarChart data={triggerStats.map((entry) => ({ label: entry.triggerName, value: entry.count }))}>
                      <CartesianGrid stroke={withAlpha('#ffffff', 0.08)} vertical={false} />
                      <XAxis dataKey="label" stroke={HB_TEXT_SECONDARY} />
                      <YAxis stroke={HB_TEXT_SECONDARY} width={36} />
                      <Tooltip contentStyle={{ borderRadius: 16, border: 'none', background: '#15151b', color: 'white' }} />
                      <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                        {triggerStats.map((entry, index) => (
                          <Cell fill={index % 2 === 0 ? HB_ACCENT_LIGHT : HB_STREAK.fire} key={entry.triggerName} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </GlassPanel>

            <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 18 }}>
              <SectionHeading detail="When cravings tend to cluster." title="Peak times" />
              {peakStats.length === 0 ? (
                <EmptyState body="Once you have enough logs, timing trends will show up here." title="No timing data yet" />
              ) : (
                <div style={{ display: 'grid', gap: 10 }}>
                  {peakStats.map((entry) => (
                    <div key={entry.label} style={{ display: 'grid', gap: 8 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                        <span>{entry.label}</span>
                        <span style={{ color: HB_TEXT_SECONDARY }}>{entry.value}</span>
                      </div>
                      <div style={{ height: 10, borderRadius: 999, background: withAlpha('#ffffff', 0.08), overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${Math.min(100, entry.value * 16)}%`, borderRadius: 999, background: `linear-gradient(90deg, ${HB_ACCENT_LIGHT} 0%, ${HB_STREAK.fire} 100%)` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </GlassPanel>

            <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
              <SectionHeading detail="Latest entries." title="Recent cravings" />
              <div style={{ display: 'grid', gap: 10 }}>
                {cravings.slice(0, 6).map((craving) => (
                  <div key={craving.id} style={{ padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontWeight: 700 }}>Intensity {craving.intensity}/10</div>
                      <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{craving.loggedAt.slice(0, 10)}</div>
                    </div>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{craving.outcome?.replace('_', ' ') ?? 'Outcome not set'}</div>
                    {craving.notes ? <div style={{ color: '#D6C3B5', fontSize: 13 }}>{craving.notes}</div> : null}
                  </div>
                ))}
              </div>
            </GlassPanel>
          </div>
        </div>
      )}
    </div>
  );
}
