'use client';

import { useEffect, useMemo, useState } from 'react';
import { getUnlockedItems, getXPProgress } from '@mylife/habits';
import {
  doEnsurePlayerProfile,
  fetchAreas,
  fetchHabits,
  fetchLevelHistory,
  fetchNegativeStreaks,
  fetchPlayerProfile,
  fetchStreaks,
  fetchXPTransactions,
} from '../actions';
import {
  EmptyState,
  GlassPanel,
  PageIntro,
  ProgressBar,
  SectionHeading,
  SymbolIcon,
  formatLongDate,
  resolveAreaTone,
} from '../ui';
import { HB_ACCENT_LIGHT, HB_STREAK, HB_TEXT_SECONDARY, HB_XP, withAlpha } from '@mylife/habits';

type PlayerProfile = {
  totalXP: number;
  currentLevel: number;
};

type XPTransaction = {
  id: string;
  amount: number;
  source: string;
  habitId: string | null;
  earnedAt: string;
};

type LevelHistoryEntry = {
  level: number;
  totalXP: number;
  earnedAt: string;
  source: string;
};

type Area = {
  id: string;
  name: string;
  color: string | null;
};

type Habit = {
  id: string;
  name: string;
  areaId: string | null;
  habitType: string;
};

export default function HabitsRpgPage() {
  const [profile, setProfile] = useState<PlayerProfile | null>(null);
  const [transactions, setTransactions] = useState<XPTransaction[]>([]);
  const [levelHistory, setLevelHistory] = useState<LevelHistoryEntry[]>([]);
  const [areas, setAreas] = useState<Area[]>([]);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [streakMap, setStreakMap] = useState<Record<string, number>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        setError(null);
        await doEnsurePlayerProfile();
        const [profileRow, transactionRows, historyRows, areaRows, habitRows] = await Promise.all([
          fetchPlayerProfile(),
          fetchXPTransactions(12),
          fetchLevelHistory(8),
          fetchAreas(),
          fetchHabits({ isArchived: false }),
        ]);
        const nextHabits = (habitRows as Habit[]) ?? [];
        setProfile((profileRow as PlayerProfile | null) ?? null);
        setTransactions((transactionRows as XPTransaction[]) ?? []);
        setLevelHistory((historyRows as LevelHistoryEntry[]) ?? []);
        setAreas((areaRows as Area[]) ?? []);
        setHabits(nextHabits);

        const entries = await Promise.all(nextHabits.map(async (habit) => {
          try {
            if (habit.habitType === 'negative') {
              const streak = await fetchNegativeStreaks(habit.id) as { daysSinceLastSlip: number };
              return [habit.id, streak.daysSinceLastSlip] as const;
            }
            const streak = await fetchStreaks(habit.id) as { currentStreak: number };
            return [habit.id, streak.currentStreak] as const;
          } catch {
            return [habit.id, 0] as const;
          }
        }));
        setStreakMap(Object.fromEntries(entries));
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load RPG progress.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const progress = profile ? getXPProgress(profile.totalXP) : { level: 1, currentXP: 0, neededXP: 100 };
  const unlocks = getUnlockedItems(progress.level);
  const areaProgress = useMemo(() => {
    return areas.map((area) => {
      const related = habits.filter((habit) => habit.areaId === area.id);
      const score = related.reduce((sum, habit) => sum + (streakMap[habit.id] ?? 0) * 10 + 20, 0);
      return {
        id: area.id,
        name: area.name,
        color: resolveAreaTone(area.name, area.color),
        level: Math.max(1, Math.floor(score / 80) + 1),
        score,
      };
    }).filter((entry) => entry.score > 0);
  }, [areas, habits, streakMap]);

  const quests = [
    { title: 'Daily streak guard', reward: '+40 XP', progress: Math.min(100, (transactions.length / 6) * 100) },
    { title: 'Area balance', reward: '+1 unlock', progress: Math.min(100, areaProgress.length * 18) },
    { title: 'Legend climb', reward: '+80 XP', progress: Math.min(100, (progress.currentXP / Math.max(progress.neededXP, 1)) * 100) },
  ];

  return (
    <div style={{ display: 'grid', gap: 24 }}>
      <PageIntro
        eyebrow="RPG"
        title="Level, quests, and the areas pushing your progress upward."
        description="Turn streaks and completions into a clearer progression system. This board shows your current level, active quests, area power, unlockables, and the recent XP events behind the climb."
      />

      {error ? <EmptyState body={error} title="RPG dashboard unavailable" /> : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1.08fr 0.92fr', gap: 20 }}>
        <GlassPanel level={2} style={{ padding: 26, display: 'grid', gap: 18 }}>
          <SectionHeading detail="Profile, XP bar, and quest stack." title="Player profile" />
          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', gap: 16, alignItems: 'center' }}>
            <div style={{ width: 96, height: 96, borderRadius: 32, display: 'grid', placeItems: 'center', background: `linear-gradient(135deg, ${withAlpha(HB_ACCENT_LIGHT, 0.22)} 0%, ${withAlpha(HB_XP, 0.16)} 100%)` }}>
              <SymbolIcon color={HB_XP} filled name="auto_awesome" size={42} />
            </div>
            <div>
              <div style={{ fontSize: 30, fontWeight: 800 }}>Level {progress.level}</div>
              <div style={{ color: '#D6C3B5', marginTop: 6 }}>{profile?.totalXP?.toLocaleString() ?? 0} total XP collected</div>
            </div>
            <div style={{ padding: '12px 16px', borderRadius: 20, background: withAlpha(HB_XP, 0.16), color: HB_XP, fontWeight: 700 }}>
              {progress.currentXP}/{progress.neededXP}
            </div>
          </div>
          <ProgressBar tone={HB_XP} value={(progress.currentXP / Math.max(progress.neededXP, 1)) * 100} />

          <div style={{ display: 'grid', gap: 12 }}>
            {quests.map((quest) => (
              <div key={quest.title} style={{ padding: 16, borderRadius: 20, background: withAlpha('#ffffff', 0.04), display: 'grid', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ fontWeight: 700 }}>{quest.title}</div>
                  <div style={{ color: HB_ACCENT_LIGHT, fontWeight: 700 }}>{quest.reward}</div>
                </div>
                <ProgressBar tone={HB_ACCENT_LIGHT} value={quest.progress} />
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail="Area levels derived from linked habits and streaks." title="Skill tree" />
          <div style={{ position: 'relative', minHeight: 280, borderRadius: 28, background: withAlpha('#ffffff', 0.04), overflow: 'hidden' }}>
            <svg height="280" width="100%">
              <circle cx="50%" cy="50%" fill="none" r="44" stroke={withAlpha(HB_ACCENT_LIGHT, 0.28)} strokeWidth="8" />
              {areaProgress.map((entry, index) => {
                const angle = (Math.PI * 2 * index) / Math.max(areaProgress.length, 1) - Math.PI / 2;
                const x = 160 + Math.cos(angle) * 94;
                const y = 140 + Math.sin(angle) * 94;
                return (
                  <g key={entry.id}>
                    <line stroke={withAlpha(entry.color, 0.4)} strokeWidth="3" x1="160" x2={x} y1="140" y2={y} />
                    <circle cx={x} cy={y} fill={withAlpha(entry.color, 0.24)} r="28" stroke={entry.color} strokeWidth="3" />
                    <text fill="#E4E1E9" fontSize="10" textAnchor="middle" x={x} y={y + 4}>
                      Lv {entry.level}
                    </text>
                  </g>
                );
              })}
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontWeight: 800, fontSize: 22 }}>Operator</div>
                <div style={{ color: '#D6C3B5', fontSize: 13 }}>Habit class</div>
              </div>
            </div>
          </div>
        </GlassPanel>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail={`${unlocks.length} unlocked rewards`} title="Unlockables" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
            {unlocks.map((unlock) => (
              <div key={`${unlock.level}-${unlock.name}`} style={{ padding: 16, borderRadius: 20, background: withAlpha('#ffffff', 0.04) }}>
                <div style={{ fontWeight: 700 }}>{unlock.name}</div>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 6 }}>Lv {unlock.level} · {unlock.type}</div>
              </div>
            ))}
          </div>
        </GlassPanel>

        <GlassPanel level={1} style={{ padding: 24, display: 'grid', gap: 16 }}>
          <SectionHeading detail="Recent XP feed and level milestones." title="XP history" />
          <div style={{ display: 'grid', gap: 10 }}>
            {transactions.slice(0, 5).map((transaction) => (
              <div key={transaction.id} style={{ padding: 14, borderRadius: 18, background: withAlpha('#ffffff', 0.04), display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <div style={{ fontWeight: 700 }}>{transaction.source.replace(/_/g, ' ')}</div>
                  <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13 }}>{formatLongDate(transaction.earnedAt)}</div>
                </div>
                <div style={{ color: HB_XP, fontWeight: 800 }}>+{transaction.amount}</div>
              </div>
            ))}
            {levelHistory.slice(0, 3).map((entry) => (
              <div key={`${entry.level}-${entry.earnedAt}`} style={{ padding: 14, borderRadius: 18, background: withAlpha(HB_ACCENT_LIGHT, 0.12) }}>
                <div style={{ fontWeight: 700 }}>Reached level {entry.level}</div>
                <div style={{ color: HB_TEXT_SECONDARY, fontSize: 13, marginTop: 4 }}>{formatLongDate(entry.earnedAt)}</div>
              </div>
            ))}
          </div>
        </GlassPanel>
      </div>
    </div>
  );
}
