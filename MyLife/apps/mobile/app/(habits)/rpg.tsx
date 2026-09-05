import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Line } from 'react-native-svg';
import {
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_AREAS,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  HB_VIOLET_GLOW_STYLE,
  MaterialSymbol,
  SectionHeader,
  StatTile,
  STREAK_MILESTONES,
  UNLOCKABLE_ITEMS,
  XPBar,
  ensurePlayerProfile,
  getAreas,
  getCompletions,
  getCompletionsForDate,
  getHabits,
  getLevelForXP,
  getLevelHistory,
  getPlayerProfile,
  getStreaks,
  getUnlockedItems,
  getXPTransactions,
  withAlpha,
  type Habit,
  type LevelHistoryEntry,
  type XPTransaction,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';

type AreaProgress = {
  id: string;
  label: string;
  color: string;
  icon: string;
  xp: number;
  level: number;
  habitCount: number;
  completions: number;
  bestStreak: number;
  topHabit: string | null;
};

type Quest = {
  id: string;
  title: string;
  description: string;
  reward: string;
  progress: number;
  target: number;
};

const FALLBACK_AREA_META: Record<string, { icon: string; color: string }> = {
  health: { icon: 'favorite', color: HB_AREAS.health },
  mind: { icon: 'psychology', color: HB_AREAS.mind },
  body: { icon: 'fitness_center', color: HB_AREAS.body },
  money: { icon: 'attach_money', color: HB_AREAS.money },
  social: { icon: 'people', color: HB_AREAS.social },
  spiritual: { icon: 'eco', color: HB_AREAS.spiritual },
  learning: { icon: 'military_tech', color: HB_AREAS.learning },
  other: { icon: 'smart_toy', color: HB_AREAS.other },
};

function titleForLevel(level: number) {
  if (level >= 15) return 'Legend Architect';
  if (level >= 10) return 'Quest Captain';
  if (level >= 6) return 'Streak Ranger';
  if (level >= 3) return 'Consistency Adept';
  return 'Habit Apprentice';
}

function formatSourceLabel(source: string) {
  return source
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function startOfWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + diff);
  start.setHours(0, 0, 0, 0);
  return start;
}

function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

function getNextStreakTarget(streak: number) {
  return STREAK_MILESTONES.find((milestone) => milestone > streak) ?? Math.max(30, streak);
}

function buildAreaProgress(db: ReturnType<typeof useDatabase>) {
  const areas = getAreas(db);
  const habits = getHabits(db, { isArchived: false });

  const defaultAreas = Object.keys(FALLBACK_AREA_META).map((key) => ({
    id: key,
    label: key[0].toUpperCase() + key.slice(1),
    color: FALLBACK_AREA_META[key].color,
    icon: FALLBACK_AREA_META[key].icon,
    xp: 0,
    level: 1,
    habitCount: 0,
    completions: 0,
    bestStreak: 0,
    topHabit: null,
  }));

  const progress = new Map<string, AreaProgress>(defaultAreas.map((entry) => [entry.id, entry]));

  for (const area of areas) {
    const normalized = area.name.trim().toLowerCase();
    const fallback = FALLBACK_AREA_META[normalized] ?? FALLBACK_AREA_META.other;
    progress.set(area.id, {
      id: area.id,
      label: area.name,
      color: area.color ?? fallback.color,
      icon: area.icon ?? fallback.icon,
      xp: 0,
      level: 1,
      habitCount: 0,
      completions: 0,
      bestStreak: 0,
      topHabit: null,
    });
  }

  for (const habit of habits) {
    const key = habit.areaId ?? 'other';
    const area = progress.get(key) ?? progress.get('other');

    if (!area) continue;

    const completions = getCompletions(db, habit.id);
    const streaks = getStreaks(db, habit.id);
    const habitXP = completions.length * 10 + streaks.longestStreak * 4;
    const current = progress.get(area.id) ?? area;
    const nextArea: AreaProgress = {
      ...current,
      xp: current.xp + habitXP,
      completions: current.completions + completions.length,
      bestStreak: Math.max(current.bestStreak, streaks.longestStreak),
      habitCount: current.habitCount + 1,
      topHabit: current.topHabit == null || habitXP > ((current.completions * 10) + current.bestStreak * 4) ? habit.name : current.topHabit,
    };
    nextArea.level = 1 + Math.floor(nextArea.xp / 120);
    progress.set(area.id, nextArea);
  }

  return [...progress.values()]
    .filter((entry) => entry.habitCount > 0)
    .sort((left, right) => right.xp - left.xp);
}

function buildQuests(
  habits: Habit[],
  transactions: XPTransaction[],
  areaProgress: AreaProgress[],
  strongestStreak: number,
) {
  const today = new Date();
  const todayCount = transactions.filter((entry) => entry.earnedAt.slice(0, 10) === toDateKey(today)).length;
  const weeklyStart = startOfWeek(today);
  const weeklyCompletions = transactions.filter((entry) => new Date(entry.earnedAt) >= weeklyStart).length;
  const topArea = areaProgress[0];
  const nextStreak = getNextStreakTarget(strongestStreak);

  const quests: Quest[] = [
    {
      id: 'daily-burst',
      title: 'Daily Burst',
      description: 'Log three XP events before the day closes.',
      reward: '+40 XP',
      progress: Math.min(todayCount, 3),
      target: 3,
    },
    {
      id: 'weekly-rhythm',
      title: 'Weekly Rhythm',
      description: 'Keep the momentum with twelve XP events this week.',
      reward: '+120 XP',
      progress: Math.min(weeklyCompletions, 12),
      target: 12,
    },
    {
      id: 'streak-breaker',
      title: 'Streak Breaker',
      description: `Push your top habit to ${nextStreak} days.`,
      reward: `+${Math.max(50, nextStreak * 3)} XP`,
      progress: Math.min(strongestStreak, nextStreak),
      target: nextStreak,
    },
  ];

  if (topArea != null) {
    quests.push({
      id: 'area-ascension',
      title: `${topArea.label} Ascension`,
      description: `Drive ${topArea.label.toLowerCase()} to level ${topArea.level + 1}.`,
      reward: '+1 unlock',
      progress: topArea.xp % 120,
      target: 120,
    });
  }

  if (habits.length === 0) {
    quests.push({
      id: 'first-habit',
      title: 'First Rollout',
      description: 'Create your first habit to start the progression tree.',
      reward: '+Starter XP',
      progress: 0,
      target: 1,
    });
  }

  return quests.slice(0, 4);
}

function SkillTree({
  areas,
  selectedId,
  onSelect,
}: {
  areas: AreaProgress[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const size = 286;
  const center = size / 2;
  const radius = 104;

  return (
    <View style={styles.skillTreeWrap}>
      <Svg height={size} style={StyleSheet.absoluteFillObject} width={size}>
        {areas.map((area, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(areas.length, 1) - Math.PI / 2;
          const x = center + radius * Math.cos(angle);
          const y = center + radius * Math.sin(angle);

          return (
            <Line
              key={area.id}
              stroke={withAlpha(area.color, 0.38)}
              strokeWidth={3}
              x1={center}
              x2={x}
              y1={center}
              y2={y}
            />
          );
        })}
        <Circle
          cx={center}
          cy={center}
          fill={withAlpha(HB_ACCENT, 0.2)}
          r={38}
          stroke={withAlpha(HB_ACCENT_LIGHT, 0.28)}
          strokeWidth={4}
        />
      </Svg>
      <View style={styles.skillTreeCenter}>
        <Text style={styles.skillTreeCenterLabel}>Player</Text>
      </View>

      {areas.map((area, index) => {
        const angle = (Math.PI * 2 * index) / Math.max(areas.length, 1) - Math.PI / 2;
        const x = center + radius * Math.cos(angle) - 32;
        const y = center + radius * Math.sin(angle) - 32;
        const active = area.id === selectedId;

        return (
          <Pressable
            key={area.id}
            onPress={() => onSelect(area.id)}
            style={[
              styles.skillNode,
              {
                left: x,
                top: y,
                backgroundColor: withAlpha(area.color, active ? 0.28 : 0.16),
              },
              active ? styles.skillNodeActive : null,
            ]}
          >
            <MaterialSymbol color={area.color} filled={active} name={area.icon} size={22} />
            <Text style={styles.skillNodeValue}>Lv {area.level}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function QuestCard({
  quest,
}: {
  quest: Quest;
}) {
  const progress = Math.max(0, Math.min(1, quest.progress / Math.max(1, quest.target)));

  return (
    <GlassCard level={2} style={styles.questCard}>
      <View style={styles.questTopRow}>
        <Text style={styles.questTitle}>{quest.title}</Text>
        <Text style={styles.questReward}>{quest.reward}</Text>
      </View>
      <Text style={styles.questDescription}>{quest.description}</Text>
      <View style={styles.questTrack}>
        <LinearGradient
          colors={[HB_ACCENT_LIGHT, HB_ACCENT]}
          end={{ x: 1, y: 0.5 }}
          start={{ x: 0, y: 0.5 }}
          style={[styles.questFill, { width: `${progress * 100}%` }]}
        />
      </View>
      <Text style={styles.questProgress}>
        {quest.progress} / {quest.target}
      </Text>
    </GlassCard>
  );
}

function LevelHistoryRow({
  entry,
}: {
  entry: LevelHistoryEntry;
}) {
  return (
    <View style={styles.levelHistoryRow}>
      <View style={styles.levelHistoryBadge}>
        <Text style={styles.levelHistoryBadgeText}>Lv {entry.level}</Text>
      </View>
      <View style={styles.levelHistoryBody}>
        <Text style={styles.levelHistoryTitle}>Level up unlocked</Text>
        <Text style={styles.levelHistoryMeta}>
          {formatSourceLabel(entry.source)} · {entry.totalXP.toLocaleString()} XP
        </Text>
      </View>
      <Text style={styles.levelHistoryDate}>{entry.earnedAt.slice(0, 10)}</Text>
    </View>
  );
}

export default function RPGScreen() {
  const db = useDatabase();
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null);

  const data = useMemo(() => {
    try {
      ensurePlayerProfile(db);

      const profile = getPlayerProfile(db);
      const transactions = getXPTransactions(db, 24);
      const levelHistory = getLevelHistory(db, 10);
      const habits = getHabits(db, { isArchived: false });
      const areaProgress = buildAreaProgress(db);
      const strongestStreak = habits.reduce((best, habit) => Math.max(best, getStreaks(db, habit.id).currentStreak), 0);
      const quests = buildQuests(habits, transactions, areaProgress, strongestStreak);
      const todayCompletions = getCompletionsForDate(db, toDateKey(new Date())).length;

      return {
        profile,
        transactions,
        levelHistory,
        habits,
        areaProgress,
        quests,
        strongestStreak,
        todayCompletions,
      };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Unable to load progression right now.',
      };
    }
  }, [db]);

  if ('error' in data || data.profile == null) {
    return (
      <View style={styles.screen}>
        <GlassCard level={2} style={styles.errorCard}>
          <MaterialSymbol color={HB_ACCENT_LIGHT} filled name="military_tech" size={24} />
          <Text style={styles.errorTitle}>RPG progression unavailable</Text>
          <Text style={styles.errorBody}>{'error' in data ? data.error : 'No player profile found.'}</Text>
        </GlassCard>
      </View>
    );
  }

  const level = getLevelForXP(data.profile.totalXP);
  const progressXP = data.profile.totalXP % 120;
  const unlockedItems = getUnlockedItems(level);
  const nextUnlock = UNLOCKABLE_ITEMS.find((item) => item.level > level) ?? null;
  const selectedArea = data.areaProgress.find((area) => area.id === selectedAreaId) ?? data.areaProgress[0] ?? null;

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <GlassCard level={4} style={styles.heroCard} contentStyle={styles.heroCardInner}>
          <LinearGradient
            colors={[withAlpha(HB_ACCENT_LIGHT, 0.2), withAlpha(HB_ACCENT, 0.06)]}
            end={{ x: 1, y: 1 }}
            start={{ x: 0.05, y: 0 }}
            style={StyleSheet.absoluteFillObject}
          />
          <View style={styles.profileRow}>
            <View style={styles.profileAvatar}>
              <MaterialSymbol color={HB_TEXT} filled name="smart_toy" size={30} />
            </View>
            <View style={styles.profileText}>
              <Text style={styles.eyebrow}>RPG Progress</Text>
              <Text style={styles.heroTitle}>Habit Adventurer</Text>
              <Text style={styles.heroSubtitle}>{titleForLevel(level)}</Text>
            </View>
            <View style={styles.levelPill}>
              <Text style={styles.levelPillText}>Lv {level}</Text>
            </View>
          </View>

          <XPBar current={progressXP} level={level} max={120} />

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{data.profile.totalXP.toLocaleString()}</Text>
              <Text style={styles.heroStatLabel}>Total XP</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{data.todayCompletions}</Text>
              <Text style={styles.heroStatLabel}>Today</Text>
            </View>
            <View style={styles.heroStat}>
              <Text style={styles.heroStatValue}>{unlockedItems.length}</Text>
              <Text style={styles.heroStatLabel}>Unlocks</Text>
            </View>
          </View>
        </GlassCard>

        <GlassCard level={2} style={styles.skillCard}>
          <SectionHeader title="Skill Tree" />
          {data.areaProgress.length === 0 ? (
            <Text style={styles.emptyText}>Create habits across your life areas to light up the progression tree.</Text>
          ) : (
            <>
              <SkillTree
                areas={data.areaProgress.slice(0, 8)}
                onSelect={setSelectedAreaId}
                selectedId={selectedArea?.id ?? null}
              />
              {selectedArea != null ? (
                <GlassCard level={1} style={styles.selectedAreaCard}>
                  <View style={styles.selectedAreaTop}>
                    <View style={[styles.selectedAreaOrb, { backgroundColor: withAlpha(selectedArea.color, 0.16) }]}>
                      <MaterialSymbol color={selectedArea.color} filled name={selectedArea.icon} size={20} />
                    </View>
                    <View style={styles.selectedAreaText}>
                      <Text style={styles.selectedAreaTitle}>{selectedArea.label}</Text>
                      <Text style={styles.selectedAreaMeta}>
                        {selectedArea.habitCount} habits · {selectedArea.completions} completions
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.selectedAreaBody}>
                    Best streak {selectedArea.bestStreak} days{selectedArea.topHabit ? ` · Top habit: ${selectedArea.topHabit}` : ''}
                  </Text>
                </GlassCard>
              ) : null}
            </>
          )}
        </GlassCard>

        <View style={styles.statGrid}>
          {data.areaProgress.slice(0, 4).map((area) => (
            <StatTile
              key={area.id}
              color={area.color}
              delta={`${area.completions} completions`}
              icon={area.icon}
              label={area.label}
              value={`Lv ${area.level}`}
            />
          ))}
        </View>

        <GlassCard level={2} style={styles.rewardsCard}>
          <SectionHeader title="Reward Milestones" />
          <View style={styles.rewardsList}>
            {unlockedItems.slice(-4).map((item) => (
              <View key={`${item.level}-${item.name}`} style={styles.rewardRow}>
                <View style={styles.rewardIcon}>
                  <MaterialSymbol color={HB_ACCENT_LIGHT} filled name={item.type === 'title' ? 'military_tech' : item.type === 'effect' ? 'bolt' : item.type === 'accessory' ? 'smart_toy' : 'pets'} size={18} />
                </View>
                <View style={styles.rewardBody}>
                  <Text style={styles.rewardTitle}>{item.name}</Text>
                  <Text style={styles.rewardMeta}>Unlocked at level {item.level}</Text>
                </View>
              </View>
            ))}
            {nextUnlock != null ? (
              <View style={[styles.rewardRow, styles.rewardRowNext]}>
                <View style={styles.rewardIcon}>
                  <MaterialSymbol color={HB_TEXT_TERTIARY} name="chevron_right" size={18} />
                </View>
                <View style={styles.rewardBody}>
                  <Text style={styles.rewardTitle}>{nextUnlock.name}</Text>
                  <Text style={styles.rewardMeta}>Next unlock at level {nextUnlock.level}</Text>
                </View>
              </View>
            ) : null}
          </View>
        </GlassCard>

        <View style={styles.sectionStack}>
          <SectionHeader title="Active Quests" />
          {data.quests.map((quest) => (
            <QuestCard key={quest.id} quest={quest} />
          ))}
        </View>

        <GlassCard level={2} style={styles.feedCard}>
          <SectionHeader title="XP Feed" />
          {data.transactions.length === 0 ? (
            <Text style={styles.emptyText}>Complete a habit to start your XP history.</Text>
          ) : (
            data.transactions.map((transaction) => (
              <View key={transaction.id} style={styles.feedRow}>
                <View style={styles.feedDot} />
                <View style={styles.feedBody}>
                  <Text style={styles.feedTitle}>{formatSourceLabel(transaction.source)}</Text>
                  <Text style={styles.feedMeta}>{transaction.earnedAt.slice(0, 10)}</Text>
                </View>
                <Text style={styles.feedXP}>+{transaction.amount}</Text>
              </View>
            ))
          )}
        </GlassCard>

        <GlassCard level={2} style={styles.historyCard}>
          <SectionHeader title="Level History" />
          {data.levelHistory.length === 0 ? (
            <Text style={styles.emptyText}>Your level milestones will show up here as soon as you cross the first threshold.</Text>
          ) : (
            data.levelHistory.map((entry) => (
              <LevelHistoryRow entry={entry} key={`${entry.level}-${entry.earnedAt}`} />
            ))
          )}
        </GlassCard>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.lowest,
  },
  content: {
    padding: 20,
    paddingBottom: 120,
    gap: 18,
  },
  heroCard: {
    overflow: 'hidden',
    ...HB_VIOLET_GLOW_STYLE,
  },
  heroCardInner: {
    gap: 18,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  profileAvatar: {
    width: 64,
    height: 64,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.14),
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
    fontSize: 30,
    lineHeight: 34,
  },
  heroSubtitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  levelPill: {
    minWidth: 68,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT, 0.2),
  },
  levelPillText: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  heroStat: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: withAlpha(HB_SURFACES.highest, 0.82),
    gap: 4,
  },
  heroStatValue: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 22,
    lineHeight: 26,
  },
  heroStatLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  skillCard: {
    gap: 16,
  },
  skillTreeWrap: {
    width: 286,
    height: 286,
    alignSelf: 'center',
    justifyContent: 'center',
  },
  skillTreeCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -42,
    marginTop: -42,
    width: 84,
    height: 84,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skillTreeCenterLabel: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 16,
    lineHeight: 20,
  },
  skillNode: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  skillNodeActive: {
    ...HB_VIOLET_GLOW_STYLE,
  },
  skillNodeValue: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT,
  },
  selectedAreaCard: {
    marginTop: 6,
  },
  selectedAreaTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selectedAreaOrb: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedAreaText: {
    flex: 1,
    gap: 2,
  },
  selectedAreaTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
  },
  selectedAreaMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  selectedAreaBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginTop: 10,
  },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  rewardsCard: {
    gap: 12,
  },
  rewardsList: {
    gap: 10,
  },
  rewardRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rewardRowNext: {
    opacity: 0.72,
  },
  rewardIcon: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.12),
  },
  rewardBody: {
    flex: 1,
    gap: 2,
  },
  rewardTitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  rewardMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionStack: {
    gap: 12,
  },
  questCard: {
    gap: 10,
  },
  questTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  questTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    fontSize: 18,
    lineHeight: 22,
    flex: 1,
  },
  questReward: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  questDescription: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  questTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.high,
    overflow: 'hidden',
  },
  questFill: {
    height: '100%',
    borderRadius: 999,
  },
  questProgress: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  feedCard: {
    gap: 12,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  feedDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: HB_ACCENT_LIGHT,
  },
  feedBody: {
    flex: 1,
    gap: 2,
  },
  feedTitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  feedMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
    fontSize: 12,
    lineHeight: 16,
  },
  feedXP: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_ACCENT_LIGHT,
    fontSize: 16,
    lineHeight: 20,
  },
  historyCard: {
    gap: 8,
  },
  levelHistoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  levelHistoryBadge: {
    minWidth: 56,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: withAlpha(HB_ACCENT_LIGHT, 0.16),
  },
  levelHistoryBadgeText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT,
  },
  levelHistoryBody: {
    flex: 1,
    gap: 2,
  },
  levelHistoryTitle: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontFamily: HB_TYPOGRAPHY.headlineMd.fontFamily,
  },
  levelHistoryMeta: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  levelHistoryDate: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  emptyText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  errorCard: {
    margin: 20,
    gap: 10,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 220,
  },
  errorTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  errorBody: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    textAlign: 'center',
  },
});
