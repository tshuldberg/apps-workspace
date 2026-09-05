import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import {
  AlertTriangle,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Plus,
  Square,
} from 'lucide-react-native';
import {
  completeSeasonalTask,
  getPendingSeasonalTasks,
  getPlants,
  getSeason,
  getWateringSchedule,
  waterPlant,
  GARDEN_ACCENT,
  GARDEN_ACCENT_LIGHT,
  GARDEN_DANGER,
  GARDEN_GOLD,
  GARDEN_SURFACES,
  GARDEN_TYPOGRAPHY,
  GlassCard,
  SectionHeader,
  ZoneChip,
  type Plant,
  type SeasonalTask,
  type WateringScheduleItem,
} from '@mylife/garden';
import { colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';

type Filter = 'all' | 'overdue' | 'today' | 'upcoming' | 'completed';
type Priority = 'low' | 'medium' | 'high';

const PRIORITY_COLORS: Record<Priority, string> = {
  low: GARDEN_ACCENT, // #84CC16
  medium: GARDEN_GOLD, // #FFB877
  high: GARDEN_DANGER, // #FFB4AB
};

interface TaskItem {
  id: string;
  kind: 'water' | 'seasonal';
  title: string;
  plantName: string | null;
  plantId: string | null;
  zone: string | null;
  priority: Priority;
  dueLabel: string;
  dueBucket: 'overdue' | 'today' | 'upcoming';
  daysAway: number; // negative = overdue, 0 = today, positive = future
  rawDate: string | null;
}

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function diffInDays(target: Date): number {
  const today = startOfDay(new Date());
  const t = startOfDay(target);
  return Math.round((t.getTime() - today.getTime()) / MS_PER_DAY);
}

function bucketFor(days: number): 'overdue' | 'today' | 'upcoming' {
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  return 'upcoming';
}

function upcomingGroupKey(days: number, target: Date): string {
  if (days === 1) return 'Tomorrow';
  if (days <= 7) return DAY_NAMES[target.getDay()];
  if (days <= 14) return 'Next Week';
  return 'Later';
}

function inferSeasonalPriority(task: SeasonalTask): Priority {
  switch (task.taskType) {
    case 'check_pests':
    case 'move_indoors':
    case 'move_outdoors':
      return 'high';
    case 'increase_watering':
    case 'decrease_watering':
    case 'start_fertilizing':
    case 'stop_fertilizing':
    case 'prune':
    case 'repot':
      return 'medium';
    default:
      return 'low';
  }
}

function seasonalLabel(task: SeasonalTask): string {
  return task.taskType.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());
}

function buildTasks(
  schedule: WateringScheduleItem[],
  seasonal: SeasonalTask[],
  plantById: Map<string, Plant>,
): TaskItem[] {
  const items: TaskItem[] = [];

  for (const item of schedule) {
    let days: number;
    let rawDate: string | null = item.nextWaterDate;
    if (item.isOverdue) {
      days = -item.daysOverdue;
    } else if (item.nextWaterDate) {
      days = diffInDays(new Date(item.nextWaterDate));
    } else {
      // never watered, treat as overdue today
      days = -1;
      rawDate = null;
    }
    const bucket = bucketFor(days);
    const priority: Priority = bucket === 'overdue' ? 'high' : bucket === 'today' ? 'medium' : 'low';
    const dueLabel =
      bucket === 'overdue'
        ? `${Math.abs(days)}d overdue`
        : bucket === 'today'
          ? 'Today'
          : days === 1
            ? 'Tomorrow'
            : days <= 7
              ? `In ${days}d`
              : (rawDate ?? `In ${days}d`);
    const plant = plantById.get(item.plantId) ?? null;
    items.push({
      id: `water:${item.plantId}`,
      kind: 'water',
      title: `Water ${item.plantName}`,
      plantName: item.plantName,
      plantId: item.plantId,
      zone: plant?.zone ?? null,
      priority,
      dueLabel,
      dueBucket: bucket,
      daysAway: days,
      rawDate,
    });
  }

  const currentMonth = new Date().getMonth() + 1;
  for (const task of seasonal) {
    const dueMonth = task.dueMonth;
    let days: number;
    let rawDate: string | null = null;
    if (dueMonth == null) {
      days = 14; // unscheduled = upcoming bucket
    } else if (dueMonth < currentMonth) {
      days = -1;
    } else if (dueMonth === currentMonth) {
      days = 0;
    } else {
      // approximate days to first of due month
      const target = new Date();
      target.setMonth(dueMonth - 1, 1);
      days = diffInDays(target);
      rawDate = `${MONTH_NAMES[dueMonth]} 1`;
    }
    const bucket = bucketFor(days);
    const priority = inferSeasonalPriority(task);
    const plant = task.plantId ? plantById.get(task.plantId) : null;
    const dueLabel =
      bucket === 'overdue'
        ? 'Overdue'
        : bucket === 'today'
          ? 'This month'
          : (rawDate ?? `In ${days}d`);
    items.push({
      id: `seasonal:${task.id}`,
      kind: 'seasonal',
      title: seasonalLabel(task),
      plantName: plant?.name ?? null,
      plantId: plant?.id ?? null,
      zone: plant?.zone ?? null,
      priority,
      dueLabel,
      dueBucket: bucket,
      daysAway: days,
      rawDate,
    });
  }

  return items.sort((a, b) => a.daysAway - b.daysAway);
}

export default function TasksScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [filter, setFilter] = useState<Filter>('all');
  const [completedExpanded, setCompletedExpanded] = useState(false);

  const schedule = useMemo<WateringScheduleItem[]>(
    () => getWateringSchedule(db),
    [db, tick],
  );
  const currentSeason = useMemo(() => getSeason(new Date().getMonth()), []);
  const seasonalTasks = useMemo<SeasonalTask[]>(
    () => getPendingSeasonalTasks(db, currentSeason),
    [db, tick, currentSeason],
  );
  const plants = useMemo<Plant[]>(() => getPlants(db), [db, tick]);

  const plantById = useMemo(() => {
    const map = new Map<string, Plant>();
    for (const p of plants) map.set(p.id, p);
    return map;
  }, [plants]);

  const tasks = useMemo(
    () => buildTasks(schedule, seasonalTasks, plantById),
    [schedule, seasonalTasks, plantById],
  );

  const overdueCount = tasks.filter((t) => t.dueBucket === 'overdue').length;
  const todayCount = tasks.filter((t) => t.dueBucket === 'today').length;
  const weekCount = tasks.filter(
    (t) => t.dueBucket === 'upcoming' && t.daysAway <= 7,
  ).length;

  const counts: Record<Filter, number> = {
    all: tasks.length,
    overdue: overdueCount,
    today: todayCount,
    upcoming: tasks.filter((t) => t.dueBucket === 'upcoming').length,
    completed: 0,
  };

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  const handleToggle = useCallback(
    (task: TaskItem) => {
      try {
        if (task.kind === 'water' && task.plantId) {
          waterPlant(db, task.plantId);
        } else if (task.kind === 'seasonal') {
          const seasonalId = task.id.replace('seasonal:', '');
          completeSeasonalTask(db, seasonalId);
        }
        refresh();
      } catch {
        Alert.alert('Error', "Couldn't complete task. Tap to retry.");
      }
    },
    [db, refresh],
  );

  const handleOpenTask = useCallback(
    (task: TaskItem) => {
      if (task.plantId) {
        router.push(`/(garden)/plant/${task.plantId}`);
      }
    },
    [router],
  );

  const handleAddTask = useCallback(() => {
    router.push('/(garden)/add-plant');
  }, [router]);

  const visibleTasks = useMemo(() => {
    if (filter === 'all') return tasks;
    if (filter === 'overdue') return tasks.filter((t) => t.dueBucket === 'overdue');
    if (filter === 'today') return tasks.filter((t) => t.dueBucket === 'today');
    if (filter === 'upcoming') return tasks.filter((t) => t.dueBucket === 'upcoming');
    return [];
  }, [tasks, filter]);

  const overdueTasks = useMemo(
    () => visibleTasks.filter((t) => t.dueBucket === 'overdue'),
    [visibleTasks],
  );
  const todayTasks = useMemo(
    () => visibleTasks.filter((t) => t.dueBucket === 'today'),
    [visibleTasks],
  );
  const upcomingTasks = useMemo(
    () => visibleTasks.filter((t) => t.dueBucket === 'upcoming'),
    [visibleTasks],
  );

  const upcomingGroups = useMemo(() => {
    const groups = new Map<string, TaskItem[]>();
    for (const t of upcomingTasks) {
      let target: Date;
      if (t.kind === 'water' && t.rawDate) {
        target = new Date(t.rawDate);
      } else {
        target = new Date();
        target.setDate(target.getDate() + Math.max(t.daysAway, 1));
      }
      const key = upcomingGroupKey(t.daysAway, target);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(t);
    }
    return Array.from(groups.entries());
  }, [upcomingTasks]);

  const showEmpty =
    filter !== 'completed' &&
    overdueTasks.length === 0 &&
    todayTasks.length === 0 &&
    upcomingTasks.length === 0;

  return (
    <View style={styles.screen}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.displayLg}>Tasks</Text>
          <Text style={styles.subtitle}>
            {overdueCount} OVERDUE  ·  {todayCount} TODAY  ·  {weekCount} THIS WEEK
          </Text>
        </View>

        {/* Filter chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {(['all', 'overdue', 'today', 'upcoming', 'completed'] as Filter[]).map((f) => (
            <FilterChip
              key={f}
              filter={f}
              active={filter === f}
              count={counts[f]}
              onPress={() => setFilter(f)}
            />
          ))}
        </ScrollView>

        {/* Overdue hero */}
        {filter !== 'completed' && overdueCount > 0 && (
          <GlassCard level={2} style={styles.overdueHero}>
            <View style={styles.overdueHeroHead}>
              <View style={styles.overdueHeroLeft}>
                <View style={styles.overdueIconBubble}>
                  <AlertTriangle size={18} color={GARDEN_DANGER} strokeWidth={2} />
                </View>
                <View>
                  <Text style={styles.overdueLabel}>NEEDS ATTENTION</Text>
                  <Text style={styles.overdueCount}>
                    {overdueCount} overdue task{overdueCount === 1 ? '' : 's'}
                  </Text>
                </View>
              </View>
              <Pressable onPress={() => setFilter('overdue')} hitSlop={8}>
                <Text style={styles.overdueAction}>SEE ALL</Text>
              </Pressable>
            </View>
            <View style={styles.overdueList}>
              {tasks
                .filter((t) => t.dueBucket === 'overdue')
                .slice(0, 4)
                .map((task) => (
                  <OverdueRow
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggle(task)}
                    onPress={() => handleOpenTask(task)}
                  />
                ))}
            </View>
          </GlassCard>
        )}

        {/* Today section */}
        {filter !== 'completed' && todayTasks.length > 0 && (
          <View style={styles.section}>
            <SectionHeader label="DUE TODAY" title="In your garden" />
            <View style={styles.taskList}>
              {todayTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onToggle={() => handleToggle(task)}
                  onPress={() => handleOpenTask(task)}
                />
              ))}
            </View>
          </View>
        )}

        {/* Upcoming section */}
        {filter !== 'completed' && upcomingGroups.length > 0 && (
          <View style={styles.section}>
            <SectionHeader label="UPCOMING" title="Next up" />
            {upcomingGroups.map(([groupName, groupTasks]) => (
              <View key={groupName} style={styles.upcomingGroup}>
                <Text style={styles.upcomingGroupLabel}>{groupName.toUpperCase()}</Text>
                <View style={styles.taskList}>
                  {groupTasks.map((task) => (
                    <TaskCard
                      key={task.id}
                      task={task}
                      compact
                      onToggle={() => handleToggle(task)}
                      onPress={() => handleOpenTask(task)}
                    />
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Completed section (collapsible) */}
        <Pressable
          style={styles.completedHeader}
          onPress={() => setCompletedExpanded((v) => !v)}
        >
          <Text style={styles.completedLabel}>COMPLETED · 0</Text>
          {completedExpanded ? (
            <ChevronUp size={16} color={colors.textSecondary} />
          ) : (
            <ChevronDown size={16} color={colors.textSecondary} />
          )}
        </Pressable>
        {completedExpanded && (
          <GlassCard level={1} style={styles.completedEmpty}>
            <Text style={styles.completedEmptyText}>
              Recently completed tasks will live here once history is wired in.
            </Text>
          </GlassCard>
        )}

        {/* Empty state */}
        {showEmpty && (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🌿</Text>
            <Text style={styles.emptyTitle}>No tasks in your sanctuary</Text>
            <Text style={styles.emptyBody}>
              Your garden is all caught up. Enjoy the quiet.
            </Text>
          </View>
        )}
      </ScrollView>

      {/* FAB */}
      <Pressable style={styles.fab} onPress={handleAddTask} hitSlop={8}>
        <LinearGradient
          colors={[GARDEN_ACCENT_LIGHT, GARDEN_ACCENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.fabGradient}
        >
          <Plus size={26} color="#0B1A04" strokeWidth={2.6} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}

function FilterChip({
  filter,
  active,
  count,
  onPress,
}: {
  filter: Filter;
  active: boolean;
  count: number;
  onPress: () => void;
}) {
  const labelMap: Record<Filter, string> = {
    all: 'All',
    overdue: 'Overdue',
    today: 'Today',
    upcoming: 'Upcoming',
    completed: 'Completed',
  };
  return (
    <Pressable onPress={onPress} hitSlop={4}>
      <View style={[styles.filterChip, active && styles.filterChipActive]}>
        <Text
          style={[
            styles.filterChipLabel,
            { color: active ? '#0B1A04' : colors.textSecondary },
          ]}
        >
          {labelMap[filter]}
        </Text>
        {count > 0 && (
          <View
            style={[
              styles.filterChipBadge,
              active && styles.filterChipBadgeActive,
            ]}
          >
            <Text
              style={[
                styles.filterChipBadgeLabel,
                { color: active ? '#0B1A04' : colors.textSecondary },
              ]}
            >
              {count}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function TaskCard({
  task,
  onToggle,
  onPress,
  compact = false,
}: {
  task: TaskItem;
  onToggle: () => void;
  onPress: () => void;
  compact?: boolean;
}) {
  const accent = PRIORITY_COLORS[task.priority];
  return (
    <Pressable onPress={onPress}>
      <View style={[styles.taskCard, compact && styles.taskCardCompact]}>
        <View style={[styles.priorityBar, { backgroundColor: accent }]} />
        <View style={styles.taskBody}>
          <View style={styles.taskHeader}>
            <Text style={styles.taskTitle} numberOfLines={1}>
              {task.title}
            </Text>
            <Text style={styles.taskDue}>{task.dueLabel.toUpperCase()}</Text>
          </View>
          {(task.plantName || task.zone) && (
            <View style={styles.taskMeta}>
              {task.plantName && task.kind === 'seasonal' && (
                <View style={styles.plantChip}>
                  <Text style={styles.plantChipIcon}>🌱</Text>
                  <Text style={styles.plantChipLabel} numberOfLines={1}>
                    {task.plantName}
                  </Text>
                </View>
              )}
              {task.zone && <ZoneChip label={task.zone} active={false} />}
            </View>
          )}
        </View>
        <Pressable
          style={styles.checkbox}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggle();
          }}
          hitSlop={8}
        >
          <Square size={26} color={accent} strokeWidth={1.8} />
        </Pressable>
      </View>
    </Pressable>
  );
}

function OverdueRow({
  task,
  onToggle,
  onPress,
}: {
  task: TaskItem;
  onToggle: () => void;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress}>
      <View style={styles.overdueRow}>
        <Pressable
          onPress={(e) => {
            e.stopPropagation?.();
            onToggle();
          }}
          hitSlop={8}
        >
          <Square size={22} color={GARDEN_DANGER} strokeWidth={1.8} />
        </Pressable>
        <View style={styles.overdueRowBody}>
          <Text style={styles.overdueRowTitle} numberOfLines={1}>
            {task.title}
          </Text>
          {task.zone && (
            <Text style={styles.overdueRowMeta} numberOfLines={1}>
              {task.zone}
            </Text>
          )}
        </View>
        <Text style={styles.overdueRowDue}>{task.dueLabel.toUpperCase()}</Text>
      </View>
    </Pressable>
  );
}

// Local Text wrapper to avoid touching @mylife/ui Text variants
function Text({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: any;
  numberOfLines?: number;
}) {
  return (
    <Animated.Text style={style} numberOfLines={numberOfLines}>
      {children}
    </Animated.Text>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    paddingTop: 100,
    paddingHorizontal: spacing.md,
    paddingBottom: 140,
    gap: spacing.lg,
  },
  header: {
    paddingHorizontal: 4,
    gap: 8,
  },
  displayLg: {
    fontFamily: GARDEN_TYPOGRAPHY.displayLg.fontFamily,
    fontSize: GARDEN_TYPOGRAPHY.displayLg.fontSize,
    letterSpacing: GARDEN_TYPOGRAPHY.displayLg.letterSpacing,
    color: colors.text,
  },
  subtitle: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    color: colors.textSecondary,
  },

  // Filter row
  filterRow: {
    gap: spacing.xs,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 999,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
  },
  filterChipActive: {
    backgroundColor: GARDEN_ACCENT,
  },
  filterChipLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    letterSpacing: 0.1 * 11,
  },
  filterChipBadge: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: GARDEN_SURFACES.depth,
  },
  filterChipBadgeActive: {
    backgroundColor: 'rgba(11, 26, 4, 0.2)',
  },
  filterChipBadgeLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    letterSpacing: 0,
  },

  // Overdue hero
  overdueHero: {
    backgroundColor: 'rgba(255, 180, 171, 0.06)',
    gap: 14,
  },
  overdueHeroHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overdueHeroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  overdueIconBubble: {
    width: 36,
    height: 36,
    borderRadius: 999,
    backgroundColor: 'rgba(255, 180, 171, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  overdueLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: GARDEN_DANGER,
  },
  overdueCount: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 17,
    color: colors.text,
  },
  overdueAction: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: GARDEN_DANGER,
  },
  overdueList: {
    gap: 8,
  },
  overdueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: 'rgba(255, 180, 171, 0.04)',
    borderRadius: 12,
  },
  overdueRowBody: {
    flex: 1,
    gap: 2,
  },
  overdueRowTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 14,
    color: colors.text,
  },
  overdueRowMeta: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 12,
    color: colors.textSecondary,
  },
  overdueRowDue: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: GARDEN_DANGER,
  },

  // Sections + tasks
  section: {
    gap: 12,
  },
  taskList: {
    gap: 10,
  },
  upcomingGroup: {
    gap: 8,
    marginTop: 4,
  },
  upcomingGroupLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textTertiary,
    marginLeft: 20,
  },
  taskCard: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: GARDEN_SURFACES.lift,
    borderRadius: 18,
    overflow: 'hidden',
    minHeight: 76,
  },
  taskCardCompact: {
    minHeight: 64,
  },
  priorityBar: {
    width: 4,
  },
  taskBody: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 8,
    justifyContent: 'center',
  },
  taskHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  taskTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    fontSize: 15,
    color: colors.text,
    flex: 1,
  },
  taskDue: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textTertiary,
  },
  taskMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  plantChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: GARDEN_SURFACES.focus,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
    gap: 4,
    maxWidth: 160,
  },
  plantChipIcon: { fontSize: 11 },
  plantChipLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 10,
    color: colors.textSecondary,
  },
  checkbox: {
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Completed
  completedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    marginTop: 4,
  },
  completedLabel: {
    ...GARDEN_TYPOGRAPHY.labelUpper,
    fontSize: 11,
    color: colors.textSecondary,
  },
  completedEmpty: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  completedEmptyText: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 13,
    color: colors.textTertiary,
    textAlign: 'center',
  },

  // Empty state
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
    gap: 12,
  },
  emptyIcon: { fontSize: 56 },
  emptyTitle: {
    ...GARDEN_TYPOGRAPHY.headlineMd,
    color: colors.text,
  },
  emptyBody: {
    ...GARDEN_TYPOGRAPHY.bodyMd,
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },

  // FAB
  fab: {
    position: 'absolute',
    bottom: 96,
    right: 24,
    width: 60,
    height: 60,
    borderRadius: 20,
    shadowColor: GARDEN_ACCENT,
    shadowOpacity: 0.4,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  fabGradient: {
    width: 60,
    height: 60,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

// Suppress unused import warnings for icons we expose for future composer wiring
void CheckSquare;
