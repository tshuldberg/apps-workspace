import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, colors, spacing } from '@mylife/ui';
import { LinearGradient } from 'expo-linear-gradient';
import {
  getActiveGoals,
  getGoalProgress,
  type HealthGoal,
  type GoalProgress,
  HEALTH_ACCENT,
  HEALTH_SURFACES,
  HEALTH_TYPOGRAPHY,
  HEALTH_CTA_GRADIENT,
  GlassCard,
  GoalProgressCard,
  StatBadge,
  SectionHeader,
  GradientButton,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

type FilterTab = 'all' | 'active' | 'completed';

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'ALL' },
  { id: 'active', label: 'ACTIVE' },
  { id: 'completed', label: 'COMPLETED' },
];

const DOMAIN_COLORS: Record<string, string> = {
  fasting: '#FFB877',
  weight: '#F472B6',
  steps: '#FFB877',
  sleep: '#A78BFA',
  adherence: '#F472B6',
  water: '#60A5FA',
  vitals: '#60A5FA',
  custom: '#34D399',
};

function getGoalColor(domain: string): string {
  return DOMAIN_COLORS[domain] ?? HEALTH_ACCENT;
}

function getLatestProgress(progress: GoalProgress[]): GoalProgress | null {
  return progress.length > 0 ? progress[0]! : null;
}

export default function GoalsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<FilterTab>('all');
  const [showCompleted, setShowCompleted] = useState(false);

  const allGoals = useMemo(() => {
    try {
      return db ? getActiveGoals(db, 100) : [];
    } catch {
      return [];
    }
  }, [db]);

  const goalProgressMap = useMemo(() => {
    const map = new Map<string, GoalProgress[]>();
    for (const goal of allGoals) {
      try {
        const progress = db ? getGoalProgress(db, goal.id, 5) : [];
        map.set(goal.id, progress);
      } catch {
        map.set(goal.id, []);
      }
    }
    return map;
  }, [db, allGoals]);

  const isGoalCompleted = useCallback(
    (goal: HealthGoal): boolean => {
      const progress = goalProgressMap.get(goal.id) ?? [];
      const latest = getLatestProgress(progress);
      return latest != null && latest.completed === 1;
    },
    [goalProgressMap],
  );

  const activeGoals = useMemo(
    () => allGoals.filter((g) => !isGoalCompleted(g)),
    [allGoals, isGoalCompleted],
  );

  const completedGoals = useMemo(
    () => allGoals.filter((g) => isGoalCompleted(g)),
    [allGoals, isGoalCompleted],
  );

  const featuredGoal = activeGoals[0] ?? null;
  const remainingActive = activeGoals.slice(featuredGoal != null ? 1 : 0);

  const totalGoals = allGoals.length;
  const completedCount = completedGoals.length;

  const calculateStreak = (): number => {
    let streak = 0;
    for (const goal of allGoals) {
      const progress = goalProgressMap.get(goal.id) ?? [];
      for (const p of progress) {
        if (p.completed === 1) streak++;
        else break;
      }
    }
    return streak;
  };

  const overallScore = totalGoals > 0
    ? Math.round((completedCount / totalGoals) * 100)
    : 0;

  const getRank = (): string => {
    if (overallScore >= 90) return 'Elite';
    if (overallScore >= 70) return 'Advanced';
    if (overallScore >= 40) return 'Active';
    return 'Beginner';
  };

  const renderGoalCard = (goal: HealthGoal) => {
    const progress = goalProgressMap.get(goal.id) ?? [];
    const latest = getLatestProgress(progress);
    const current = latest?.current_value ?? 0;
    const target = goal.target_value;
    const completed = latest != null && latest.completed === 1;

    return (
      <View key={goal.id} style={completed ? styles.completedCard : undefined}>
        <GoalProgressCard
          title={goal.label ?? `${goal.domain} goal`}
          current={current}
          target={target}
          unit={goal.unit ?? ''}
          color={completed ? HEALTH_SURFACES.highest : getGoalColor(goal.domain)}
        />
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Title */}
        <Text style={styles.title}>Health Goals</Text>

        {/* Filter Tabs */}
        <View style={styles.filterRow}>
          {FILTER_TABS.map((tab) => (
            <Pressable
              key={tab.id}
              style={[styles.filterPill, activeTab === tab.id && styles.filterPillActive]}
              onPress={() => setActiveTab(tab.id)}
            >
              <Text
                style={[
                  styles.filterPillText,
                  activeTab === tab.id && styles.filterPillTextActive,
                ]}
              >
                {tab.label}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Featured Goal */}
        {featuredGoal != null && activeTab !== 'completed' && (
          <GlassCard level={3} style={styles.featuredCard}>
            <Text style={styles.featuredLabel}>FEATURED GOAL</Text>
            <Text style={styles.featuredTitle}>
              {featuredGoal.label ?? `${featuredGoal.domain} goal`}
            </Text>
            {featuredGoal.metric && (
              <Text style={styles.featuredDesc}>
                {featuredGoal.direction === 'at_least' ? 'Reach' : featuredGoal.direction === 'at_most' ? 'Stay under' : 'Hit exactly'}{' '}
                {featuredGoal.target_value.toLocaleString()} {featuredGoal.unit ?? ''} {featuredGoal.period}
              </Text>
            )}
            <View style={styles.featuredStatsRow}>
              <View style={styles.featuredStat}>
                <Text style={styles.featuredStatValue}>
                  {(goalProgressMap.get(featuredGoal.id) ?? []).length}
                </Text>
                <Text style={styles.featuredStatLabel}>Sessions</Text>
              </View>
              <View style={styles.featuredStatDivider} />
              <View style={styles.featuredStat}>
                <Text style={styles.featuredStatValue}>
                  {Math.round(
                    (new Date().getTime() - new Date(featuredGoal.start_date).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )}
                </Text>
                <Text style={styles.featuredStatLabel}>Days</Text>
              </View>
            </View>
            <GradientButton
              title="UPDATE STATS"
              onPress={() => router.push('/(health)/add-goal')}
            />
          </GlassCard>
        )}

        {/* Active Goals */}
        {activeTab !== 'completed' && remainingActive.length > 0 && (
          <View style={styles.section}>
            <SectionHeader title="Active Goals" />
            <View style={styles.goalsList}>
              {remainingActive.map(renderGoalCard)}
            </View>
          </View>
        )}

        {/* Completed Goals (filtered view) */}
        {activeTab === 'completed' && (
          <View style={styles.section}>
            <View style={styles.goalsList}>
              {completedGoals.length > 0 ? (
                completedGoals.map(renderGoalCard)
              ) : (
                <GlassCard level={2} style={styles.emptyCard}>
                  <Text style={styles.emptyText}>No completed goals yet</Text>
                </GlassCard>
              )}
            </View>
          </View>
        )}

        {/* Completed Goals (collapsible, non-filtered view) */}
        {activeTab !== 'completed' && completedGoals.length > 0 && (
          <View style={styles.section}>
            <Pressable
              style={styles.completedToggle}
              onPress={() => setShowCompleted((v) => !v)}
            >
              <Text style={styles.completedToggleText}>
                Completed ({completedCount})
              </Text>
              <Text style={styles.completedToggleArrow}>
                {showCompleted ? '\u25B2' : '\u25BC'}
              </Text>
            </Pressable>
            {showCompleted && (
              <View style={styles.goalsList}>
                {completedGoals.map(renderGoalCard)}
              </View>
            )}
          </View>
        )}

        {/* All tab: show all filtered goals when no special sections */}
        {activeTab === 'all' && allGoals.length === 0 && (
          <GlassCard level={2} style={styles.emptyCard}>
            <Text style={styles.emptyIcon}>{'\u{1F3AF}'}</Text>
            <Text style={styles.emptyTitle}>No Goals Yet</Text>
            <Text style={styles.emptyText}>
              Set your first health goal to start tracking progress
            </Text>
            <View style={{ marginTop: spacing.md }}>
              <GradientButton
                title="Create Goal"
                onPress={() => router.push('/(health)/add-goal')}
              />
            </View>
          </GlassCard>
        )}

        {/* Bottom Stats Bar */}
        {totalGoals > 0 && (
          <GlassCard level={2} style={styles.statsBar}>
            <View style={styles.statsRow}>
              <StatBadge value={overallScore} label="Score" icon={'\u{1F4CA}'} />
              <StatBadge value={calculateStreak()} label="Streak" icon={'\u{1F525}'} />
              <StatBadge
                value={`${completedCount}/${totalGoals}`}
                label="Goals"
                icon={'\u{1F3AF}'}
              />
              <StatBadge value={getRank()} label="Rank" icon={'\u{1F3C6}'} />
            </View>
          </GlassCard>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(health)/add-goal')}
      >
        <LinearGradient
          colors={[HEALTH_CTA_GRADIENT.from, HEALTH_CTA_GRADIENT.to]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Text style={styles.fabIcon}>+</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HEALTH_SURFACES.depth,
  },
  container: {
    flex: 1,
  },
  content: {
    paddingBottom: 100,
  },
  title: {
    ...HEALTH_TYPOGRAPHY.displayLg,
    color: colors.text,
    paddingHorizontal: 20,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },

  // Filter tabs
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 20,
    marginBottom: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: HEALTH_SURFACES.lift,
  },
  filterPillActive: {
    backgroundColor: HEALTH_ACCENT,
  },
  filterPillText: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
    color: colors.textSecondary,
  },
  filterPillTextActive: {
    color: '#FFFFFF',
  },

  // Featured goal
  featuredCard: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.lg,
    gap: 12,
  },
  featuredLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    color: HEALTH_ACCENT,
  },
  featuredTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 22,
    color: colors.text,
  },
  featuredDesc: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
  },
  featuredStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingVertical: 8,
  },
  featuredStat: {
    alignItems: 'center',
    gap: 2,
  },
  featuredStatValue: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  featuredStatLabel: {
    ...HEALTH_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0.1 * 10,
    color: colors.textSecondary,
  },
  featuredStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: HEALTH_SURFACES.focus,
  },

  // Sections
  section: {
    marginBottom: spacing.lg,
  },
  goalsList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },

  // Completed toggle
  completedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  completedToggleText: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    fontSize: 16,
    color: colors.textSecondary,
  },
  completedToggleArrow: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  completedCard: {
    opacity: 0.5,
  },

  // Empty state
  emptyCard: {
    marginHorizontal: spacing.md,
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 40,
    marginBottom: 4,
  },
  emptyTitle: {
    ...HEALTH_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyText: {
    ...HEALTH_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // Stats bar
  statsBar: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 20,
    zIndex: 10,
  },
  fabGradient: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: HEALTH_CTA_GRADIENT.from,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabIcon: {
    fontSize: 28,
    fontWeight: '300',
    color: '#1a1008',
    marginTop: -2,
  },
});
