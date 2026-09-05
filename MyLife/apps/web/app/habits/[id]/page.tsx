'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  doCompleteActionItem,
  doCreateActionItem,
  doCreateReminder,
  doDeleteActionItem,
  doDeleteHabit,
  doDeleteReminder,
  doToggleReminder,
  doUncompleteActionItem,
  doUpdateHabit,
  fetchActionItemsForHabit,
  fetchAreas,
  fetchCompletedActionItemIds,
  fetchCompletions,
  fetchHabitById,
  fetchHabits,
  fetchHeatmapData,
  fetchLinksForHabit,
  fetchNegativeStreaks,
  fetchRemindersForHabit,
  fetchStreaks,
  fetchStreaksWithGrace,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  HeatmapCalendarGrid,
  PageIntro,
  PrimaryButton,
  SecondaryButton,
  SectionHeading,
  SymbolIcon,
  formatLongDate,
  habitTypeLabel,
  resolveAreaTone,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, withAlpha } from '@mylife/habits';

type Habit = {
  id: string;
  name: string;
  icon: string | null;
  color: string | null;
  description: string | null;
  frequency: string;
  habitType: string;
  gracePeriod: number;
  areaId: string | null;
};

type Area = {
  id: string;
  name: string;
  color: string | null;
};

type ActionItem = {
  id: string;
  label: string;
};

type Reminder = {
  id: string;
  time: string;
  label: string | null;
  isActive: boolean;
};

type Completion = {
  id: string;
  completedAt: string;
  value: number | null;
};

type HabitLink = {
  id: string;
  parentHabitId: string;
  childHabitId: string;
};

export default function HabitDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const habitId = params.id;

  const [habit, setHabit] = useState<Habit | null>(null);
  const [areas, setAreas] = useState<Area[]>([]);
  const [allHabits, setAllHabits] = useState<Habit[]>([]);
  const [heatmap, setHeatmap] = useState<Array<{ date: string; count: number }>>([]);
  const [completions, setCompletions] = useState<Completion[]>([]);
  const [links, setLinks] = useState<HabitLink[]>([]);
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [completedActionIds, setCompletedActionIds] = useState<string[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [streak, setStreak] = useState<{ currentStreak: number; longestStreak: number } | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [newAction, setNewAction] = useState('');
  const [newReminder, setNewReminder] = useState({ time: '08:00', label: '' });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      setError(null);
      const [habitRow, areaRows, habitRows, heatmapRows, completionRows, linkRows, itemRows, reminderRows] = await Promise.all([
        fetchHabitById(habitId),
        fetchAreas(),
        fetchHabits({ isArchived: false }),
        fetchHeatmapData(habitId),
        fetchCompletions(habitId),
        fetchLinksForHabit(habitId),
        fetchActionItemsForHabit(habitId),
        fetchRemindersForHabit(habitId),
      ]);

      const nextHabit = (habitRow as Habit | null) ?? null;
      setHabit(nextHabit);
      setAreas((areaRows as Area[]) ?? []);
      setAllHabits((habitRows as Habit[]) ?? []);
      setHeatmap((heatmapRows as Array<{ date: string; count: number }>) ?? []);
      setCompletions((completionRows as Completion[]) ?? []);
      setLinks((linkRows as HabitLink[]) ?? []);
      setActionItems((itemRows as ActionItem[]) ?? []);
      setReminders((reminderRows as Reminder[]) ?? []);
      setCompletedActionIds((await fetchCompletedActionItemIds(habitId, new Date().toISOString().slice(0, 10))) as string[]);

      if (nextHabit) {
        setDraftName(nextHabit.name);
        setDraftDescription(nextHabit.description ?? '');
        if (nextHabit.habitType === 'negative') {
          const result = await fetchNegativeStreaks(habitId) as { daysSinceLastSlip: number; longestCleanStreak: number };
          setStreak({ currentStreak: result.daysSinceLastSlip, longestStreak: result.longestCleanStreak });
        } else if (nextHabit.gracePeriod > 0) {
          setStreak(await fetchStreaksWithGrace(habitId, nextHabit.gracePeriod) as { currentStreak: number; longestStreak: number });
        } else {
          setStreak(await fetchStreaks(habitId) as { currentStreak: number; longestStreak: number });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load habit detail.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [habitId]);

  const area = useMemo(() => habit?.areaId ? areas.find((entry) => entry.id === habit.areaId) ?? null : null, [areas, habit?.areaId]);
  const tone = resolveAreaTone(area?.name, habit?.color ?? area?.color ?? null);
  const habitsById = useMemo(() => new Map(allHabits.map((item) => [item.id, item])), [allHabits]);
  const linkedNames = links.map((link) => habitsById.get(link.parentHabitId === habitId ? link.childHabitId : link.parentHabitId)?.name).filter(Boolean) as string[];

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 18 }}>
        {Array.from({ length: 4 }).map((_, index) => (
          <GlassPanel key={index} level={1} style={{ minHeight: 110 }}>
            <div />
          </GlassPanel>
        ))}
      </div>
    );
  }

  if (!habit || error) {
    return <EmptyState body={error ?? 'This habit no longer exists.'} title="Habit unavailable" />;
  }

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="Habit Detail"
        title={habit.name}
        description={habit.description ?? 'No detail notes yet. Add context so reminders and future reviews stay grounded in the why behind this habit.'}
        actions={
          <>
            <PrimaryButton onClick={() => void doUpdateHabit(habitId, { isArchived: true }).then(() => router.push('/habits/habits'))}>
              <SymbolIcon color="#0E0E13" filled name="archive" size={18} />
              Archive
            </PrimaryButton>
            <SecondaryButton onClick={() => void doDeleteHabit(habitId).then(() => router.push('/habits/habits'))}>
              <SymbolIcon name="delete" size={18} />
              Delete
            </SecondaryButton>
          </>
        }
      />

      <div style={{ display: 'grid', gridTemplateColumns: '1.15fr 0.85fr', gap: 20 }}>
        <div style={{ display: 'grid', gap: 20 }}>
          <GlassPanel level={2} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail={`${habitTypeLabel(habit.habitType)} · ${habit.frequency.replace('_', ' ')}`} title="Hero" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 18, alignItems: 'flex-start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <div style={{ width: 52, height: 52, borderRadius: 18, display: 'grid', placeItems: 'center', background: withAlpha(tone, 0.18), fontSize: 24 }}>
                    {habit.icon ?? '✓'}
                  </div>
                  <div>
                    <div style={{ fontSize: 28, lineHeight: 1.1, fontWeight: 800 }}>{habit.name}</div>
                    <div style={{ color: HB_TEXT_SECONDARY, marginTop: 6 }}>{area?.name ?? 'General focus'}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
                  <div style={{ padding: 16, borderRadius: 20, background: withAlpha(HB_STREAK.fire, 0.14) }}>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Current streak</div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: HB_STREAK.fire }}>{streak?.currentStreak ?? 0}d</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 20, background: withAlpha(HB_ACCENT_LIGHT, 0.14) }}>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Longest</div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: HB_ACCENT_LIGHT }}>{streak?.longestStreak ?? 0}d</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 20, background: withAlpha('#8BCFF0', 0.14) }}>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Completions</div>
                    <div style={{ marginTop: 6, fontSize: 28, fontWeight: 800, color: '#8BCFF0' }}>{completions.length}</div>
                  </div>
                </div>
              </div>

              <div style={{ width: 120, height: 120, borderRadius: 36, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${withAlpha(tone, 0.24)} 0%, ${withAlpha('#ffffff', 0.06)} 100%)` }}>
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 36, fontWeight: 800, color: tone }}>{habit.icon ?? '✓'}</div>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 12 }}>Focus card</div>
                </div>
              </div>
            </div>
          </GlassPanel>

          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail="Recent activity intensity." title="Heatmap" />
            <HeatmapCalendarGrid data={heatmap} weeks={16} />
          </GlassPanel>

          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail="Editable summary for notes and intent." title="Notes" />
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              onBlur={() => void doUpdateHabit(habitId, { name: draftName.trim() }).then(load)}
              style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px', fontSize: 18, fontWeight: 700 }}
            />
            <textarea
              value={draftDescription}
              onChange={(event) => setDraftDescription(event.target.value)}
              onBlur={() => void doUpdateHabit(habitId, { description: draftDescription.trim() }).then(load)}
              rows={5}
              style={{ borderRadius: 18, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '16px 18px', resize: 'vertical', fontSize: 14, lineHeight: 1.7 }}
            />
          </GlassPanel>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail="Sub-tasks that support this habit." title="Action items" />
            <div style={{ display: 'grid', gap: 10 }}>
              {actionItems.map((item) => {
                const completed = completedActionIds.includes(item.id);
                return (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04) }}>
                    <button
                      onClick={() => {
                        const date = new Date().toISOString().slice(0, 10);
                        const action = completed ? doUncompleteActionItem(item.id, date) : doCompleteActionItem(item.id, date);
                        void action.then(load);
                      }}
                      style={{ width: 34, height: 34, borderRadius: 999, border: 'none', background: completed ? withAlpha(HB_ACCENT_LIGHT, 0.18) : withAlpha('#ffffff', 0.04), cursor: 'pointer' }}
                    >
                      <SymbolIcon color={HB_ACCENT_LIGHT} filled={completed} name={completed ? 'check_circle' : 'radio_button_unchecked'} size={18} />
                    </button>
                    <div style={{ color: completed ? 'white' : HB_TEXT_SECONDARY }}>{item.label}</div>
                    <button onClick={() => void doDeleteActionItem(item.id).then(load)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                      <SymbolIcon name="delete" size={18} />
                    </button>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                value={newAction}
                onChange={(event) => setNewAction(event.target.value)}
                placeholder="Add action item"
                style={{ flex: 1, borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
              />
              <PrimaryButton
                onClick={() => {
                  if (!newAction.trim()) return;
                  void doCreateActionItem(habitId, newAction.trim()).then(() => {
                    setNewAction('');
                    return load();
                  });
                }}
              >
                <SymbolIcon color="#0E0E13" filled name="add" size={18} />
                Add
              </PrimaryButton>
            </div>
          </GlassPanel>

          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail="Reminder schedule for this habit." title="Reminders" />
            <div style={{ display: 'grid', gap: 10 }}>
              {reminders.map((reminder) => (
                <div key={reminder.id} style={{ display: 'grid', gridTemplateColumns: '1fr auto auto', gap: 12, alignItems: 'center', padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04) }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{reminder.time}</div>
                    <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{reminder.label ?? 'Reminder'}</div>
                  </div>
                  <button onClick={() => void doToggleReminder(reminder.id, !reminder.isActive).then(load)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <SymbolIcon color={reminder.isActive ? HB_ACCENT_LIGHT : HB_TEXT_SECONDARY} filled={reminder.isActive} name={reminder.isActive ? 'notifications_active' : 'notifications_off'} size={20} />
                  </button>
                  <button onClick={() => void doDeleteReminder(reminder.id).then(load)} style={{ border: 'none', background: 'transparent', cursor: 'pointer' }}>
                    <SymbolIcon name="delete" size={18} />
                  </button>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 10 }}>
              <input
                type="time"
                value={newReminder.time}
                onChange={(event) => setNewReminder((current) => ({ ...current, time: event.target.value }))}
                style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
              />
              <input
                value={newReminder.label}
                onChange={(event) => setNewReminder((current) => ({ ...current, label: event.target.value }))}
                placeholder="Reminder label"
                style={{ borderRadius: 16, border: 'none', background: withAlpha('#ffffff', 0.05), color: 'white', padding: '14px 16px' }}
              />
              <PrimaryButton
                onClick={() => void doCreateReminder(crypto.randomUUID(), habitId, newReminder.time, newReminder.label || undefined).then(() => {
                  setNewReminder({ time: '08:00', label: '' });
                  return load();
                })}
              >
                <SymbolIcon color="#0E0E13" filled name="add_alert" size={18} />
                Add
              </PrimaryButton>
            </div>
          </GlassPanel>

          <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
            <SectionHeading detail="Recent history and linked flows." title="Stats + links" />
            <div style={{ display: 'grid', gap: 10 }}>
              {completions.slice(0, 6).map((completion) => (
                <div key={completion.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, padding: 12, borderRadius: 16, background: withAlpha('#ffffff', 0.04) }}>
                  <span>{formatLongDate(completion.completedAt)}</span>
                  <span style={{ color: HB_TEXT_SECONDARY }}>{completion.value ?? 1}x</span>
                </div>
              ))}
            </div>
            {linkedNames.length > 0 ? (
              <div style={{ display: 'grid', gap: 10 }}>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>Linked stack context</div>
                <div style={{ color: 'white', fontWeight: 700 }}>{linkedNames.join(' → ')}</div>
              </div>
            ) : (
              <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>No stack links configured yet.</div>
            )}
          </GlassPanel>
        </div>
      </div>
    </div>
  );
}
