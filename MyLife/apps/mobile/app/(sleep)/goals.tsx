import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type {
  SleepGoal,
  SleepGoalProgress,
  SleepGoalType,
  SleepStreak,
  SleepStreakHistoryPoint,
  SleepStreakType,
  SleepWeeklyProgressSummary,
} from '@mylife/sleep';
import {
  SLEEP_STREAK_TYPES,
  buildWeeklyGoalDots,
  checkGoalProgress,
  compactStreakHistory,
  createGoal,
  deactivateGoal,
  formatGoalProgress,
  formatGoalTarget,
  formatGoalTypeLabel,
  formatStreakTypeLabel,
  generateAccountabilityMessage,
  getActiveGoals,
  getDefaultGoalTarget,
  getGoalTargetPlaceholder,
  getSleepWeekStart,
  getStreakHistory,
  getStreaks,
  getWeeklySummary,
  isNewLongestStreak,
  listEntries,
  updateGoal,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { SLEEP_ACCENT, readSleepTargetHours } from './_ui';

type StreakHistoryMap = Record<SleepStreakType, SleepStreakHistoryPoint[]>;

const GOAL_TYPES: SleepGoalType[] = [
  'duration',
  'bedtime',
  'wake_time',
  'consistency',
];

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

function getLatestEntryDate(entries: readonly { date: string }[]): string {
  return entries.reduce(
    (latest, entry) => (entry.date > latest ? entry.date : latest),
    todayDate(),
  );
}

export default function SleepGoalsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [goals, setGoals] = useState<SleepGoal[]>([]);
  const [progress, setProgress] = useState<Record<string, SleepGoalProgress>>(
    {},
  );
  const [streaks, setStreaks] = useState<SleepStreak[]>([]);
  const [history, setHistory] = useState<StreakHistoryMap>({
    quality_above_3: [],
    on_time_bed: [],
    target_hours: [],
    no_snooze: [],
  });
  const [summary, setSummary] =
    useState<SleepWeeklyProgressSummary | null>(null);
  const [weekDots, setWeekDots] = useState<
    ReturnType<typeof buildWeeklyGoalDots>
  >([]);
  const [targetHours, setTargetHours] = useState(8);
  const [goalType, setGoalType] = useState<SleepGoalType>('duration');
  const [targetValue, setTargetValue] = useState('8');
  const [notes, setNotes] = useState('');
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = useCallback(() => {
    const entries = listEntries(db, { limit: 500 });
    const activeGoals = getActiveGoals(db);
    const streakRows = getStreaks(db);
    const nextTargetHours = readSleepTargetHours(db);
    const weekStart = getSleepWeekStart(getLatestEntryDate(entries));
    const nextProgress: Record<string, SleepGoalProgress> = {};
    const nextHistory = SLEEP_STREAK_TYPES.reduce<StreakHistoryMap>(
      (acc, type) => {
        acc[type] = compactStreakHistory(getStreakHistory(db, type), 21);
        return acc;
      },
      {
        quality_above_3: [],
        on_time_bed: [],
        target_hours: [],
        no_snooze: [],
      },
    );

    for (const goal of activeGoals) {
      const goalProgress = checkGoalProgress(db, goal.id);
      if (goalProgress) {
        nextProgress[goal.id] = goalProgress;
      }
    }

    setTargetHours(nextTargetHours);
    setGoals(activeGoals);
    setProgress(nextProgress);
    setStreaks(streakRows);
    setHistory(nextHistory);
    setSummary(getWeeklySummary(entries, activeGoals, weekStart, streakRows));
    setWeekDots(buildWeeklyGoalDots(entries, activeGoals, weekStart));
    setError(null);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      try {
        loadDashboard();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not load goals.');
      }
    }, [loadDashboard]),
  );

  const isEditing = editingGoalId !== null;
  const hasRecord = useMemo(
    () => streaks.some((streak) => isNewLongestStreak(streak)),
    [streaks],
  );

  const resetForm = useCallback(() => {
    setEditingGoalId(null);
    setGoalType('duration');
    setTargetValue(getDefaultGoalTarget('duration', targetHours));
    setNotes('');
  }, [targetHours]);

  const handleSelectType = useCallback(
    (type: SleepGoalType) => {
      setGoalType(type);
      setTargetValue(getDefaultGoalTarget(type, targetHours));
    },
    [targetHours],
  );

  const handleEditGoal = useCallback((goal: SleepGoal) => {
    setEditingGoalId(goal.id);
    setGoalType(goal.type);
    setTargetValue(goal.target_value);
    setNotes(goal.notes ?? '');
  }, []);

  const handleSaveGoal = useCallback(() => {
    try {
      if (isEditing && editingGoalId) {
        updateGoal(db, editingGoalId, {
          type: goalType,
          target_value: targetValue,
          notes,
        });
      } else {
        createGoal(db, {
          type: goalType,
          target_value: targetValue,
          start_date: todayDate(),
          notes,
        });
      }
      resetForm();
      loadDashboard();
    } catch (err) {
      Alert.alert(
        'Goal needs attention',
        err instanceof Error ? err.message : 'Check the target and try again.',
      );
    }
  }, [
    db,
    editingGoalId,
    goalType,
    isEditing,
    loadDashboard,
    notes,
    resetForm,
    targetValue,
  ]);

  const handleDeactivateGoal = useCallback(
    (goal: SleepGoal) => {
      Alert.alert(
        'Deactivate goal?',
        `${formatGoalTypeLabel(goal.type)} can be added again later.`,
        [
          { text: 'Keep', style: 'cancel' },
          {
            text: 'Deactivate',
            style: 'destructive',
            onPress: () => {
              deactivateGoal(db, goal.id);
              if (editingGoalId === goal.id) {
                resetForm();
              }
              loadDashboard();
            },
          },
        ],
      );
    },
    [db, editingGoalId, loadDashboard, resetForm],
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadDashboard();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadDashboard]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={SLEEP_ACCENT}
        />
      )}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Goals</Text>
        <Text style={styles.heroTitle}>Keep sleep progress visible without making it punitive.</Text>
        <Text style={styles.heroCopy}>
          Set one or two targets, watch the week fill in, and let MySleep track streaks as morning logs arrive.
        </Text>
        <View style={styles.heroRow}>
          <View style={styles.heroPill}>
            <Text style={styles.heroPillText}>{goals.length} active goals</Text>
          </View>
          <Pressable
            onPress={() => router.push('/(sleep)/insights' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Insights</Text>
          </Pressable>
        </View>
      </View>

      {error && (
        <View style={styles.errorCard}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {summary && (
        <View style={styles.panel}>
          <View style={styles.panelHeader}>
            <View>
              <Text style={styles.cardEyebrow}>Weekly accountability</Text>
              <Text style={styles.panelTitle}>
                {summary.daysOnTarget} of {summary.evaluatedDays} nights on target
              </Text>
            </View>
            <View style={styles.scoreRing}>
              <Text style={styles.scoreText}>
                {formatPercentage(summary.goalAdherencePercentage)}
              </Text>
            </View>
          </View>
          <Text style={styles.bodyText}>
            {generateAccountabilityMessage(summary)}
          </Text>
          <View style={styles.weekDotRow}>
            {weekDots.map((dot) => (
              <View key={dot.date} style={styles.weekDotItem}>
                <View
                  style={[
                    styles.weekDot,
                    dot.status === 'met' && styles.weekDotMet,
                    dot.status === 'missed' && styles.weekDotMissed,
                  ]}
                />
                <Text style={styles.weekDotLabel}>{dot.label}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      <View style={styles.panel}>
        <Text style={styles.cardEyebrow}>
          {isEditing ? 'Edit goal' : 'Set a goal'}
        </Text>
        <View style={styles.typeGrid}>
          {GOAL_TYPES.map((type) => {
            const selected = goalType === type;
            return (
              <Pressable
                key={type}
                onPress={() => handleSelectType(type)}
                style={[styles.typeButton, selected && styles.typeButtonSelected]}
              >
                <Text
                  style={[
                    styles.typeButtonText,
                    selected && styles.typeButtonTextSelected,
                  ]}
                >
                  {formatGoalTypeLabel(type)}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={targetValue}
          onChangeText={setTargetValue}
          placeholder={getGoalTargetPlaceholder(goalType)}
          placeholderTextColor="rgba(240,240,245,0.35)"
          keyboardType={goalType === 'duration' || goalType === 'consistency' ? 'numeric' : 'default'}
          autoCapitalize="none"
          style={styles.input}
        />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Optional note"
          placeholderTextColor="rgba(240,240,245,0.35)"
          multiline
          style={[styles.input, styles.notesInput]}
        />
        <View style={styles.actionRow}>
          <Pressable onPress={handleSaveGoal} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>
              {isEditing ? 'Save Goal' : 'Add Goal'}
            </Text>
          </Pressable>
          {isEditing && (
            <Pressable onPress={resetForm} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Cancel</Text>
            </Pressable>
          )}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Active Goals</Text>
        {goals.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No active goals yet</Text>
            <Text style={styles.emptyCopy}>
              Add one target above. Duration goals usually work best as the first goal.
            </Text>
          </View>
        ) : (
          goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              progress={progress[goal.id]}
              onEdit={handleEditGoal}
              onDeactivate={handleDeactivateGoal}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Streaks</Text>
          {hasRecord && (
            <View style={styles.recordBadge}>
              <Text style={styles.recordBadgeText}>New record</Text>
            </View>
          )}
        </View>
        {streaks.map((streak) => (
          <StreakCard
            key={streak.type}
            streak={streak}
            history={history[streak.type]}
          />
        ))}
      </View>
    </ScrollView>
  );
}

function GoalCard({
  goal,
  progress,
  onEdit,
  onDeactivate,
}: {
  goal: SleepGoal;
  progress?: SleepGoalProgress;
  onEdit: (goal: SleepGoal) => void;
  onDeactivate: (goal: SleepGoal) => void;
}) {
  const percentage = progress?.percentage ?? 0;

  return (
    <View style={styles.goalCard}>
      <View style={styles.goalHeader}>
        <View>
          <Text style={styles.cardEyebrow}>{formatGoalTypeLabel(goal.type)}</Text>
          <Text style={styles.goalTitle}>
            {formatGoalTarget(goal.type, goal.target_value)}
          </Text>
        </View>
        <View style={styles.scoreRing}>
          <Text style={styles.scoreText}>{formatPercentage(percentage)}</Text>
        </View>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(100, percentage)}%` }]} />
      </View>
      <Text style={styles.bodyText}>
        {progress ? formatGoalProgress(progress) : 'No nights evaluated yet'}
      </Text>
      {goal.notes && <Text style={styles.noteText}>{goal.notes}</Text>}
      <View style={styles.actionRow}>
        <Pressable onPress={() => onEdit(goal)} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonText}>Edit</Text>
        </Pressable>
        <Pressable
          onPress={() => onDeactivate(goal)}
          style={styles.destructiveButton}
        >
          <Text style={styles.destructiveButtonText}>Deactivate</Text>
        </Pressable>
      </View>
    </View>
  );
}

function StreakCard({
  streak,
  history,
}: {
  streak: SleepStreak;
  history: SleepStreakHistoryPoint[];
}) {
  return (
    <View style={styles.streakCard}>
      <View style={styles.streakHeader}>
        <View style={styles.flameBadge}>
          <Text style={styles.flameText}>🔥</Text>
        </View>
        <View style={styles.streakCopy}>
          <Text style={styles.cardEyebrow}>{formatStreakTypeLabel(streak.type)}</Text>
          <Text style={styles.streakTitle}>
            {streak.current_count}-day streak
          </Text>
          <Text style={styles.bodyText}>
            Longest record {streak.longest_count} days
          </Text>
        </View>
        {isNewLongestStreak(streak) && (
          <View style={styles.recordBadge}>
            <Text style={styles.recordBadgeText}>Record</Text>
          </View>
        )}
      </View>
      <View style={styles.historyRow}>
        {history.length === 0 ? (
          <Text style={styles.bodyText}>History starts with your next logged night.</Text>
        ) : (
          history.map((point) => (
            <View
              key={point.id}
              style={[
                styles.historyCell,
                point.met ? styles.historyCellMet : styles.historyCellMissed,
              ]}
            />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
    gap: 16,
  },
  hero: {
    gap: 12,
    padding: 20,
    borderRadius: 24,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  heroCopy: {
    color: colors.textSecondary,
    fontSize: 15,
    lineHeight: 22,
  },
  heroRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  heroPill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
  },
  heroPillText: {
    color: '#E9DDFF',
    fontSize: 13,
    fontWeight: '700',
  },
  panel: {
    gap: 14,
    padding: 18,
    borderRadius: 22,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  panelHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  panelTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  cardEyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  bodyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  noteText: {
    color: '#E9DDFF',
    fontSize: 13,
    lineHeight: 19,
  },
  scoreRing: {
    width: 62,
    height: 62,
    borderRadius: 31,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderWidth: 3,
    borderColor: SLEEP_ACCENT,
  },
  scoreText: {
    color: '#F5F3FF',
    fontSize: 16,
    fontWeight: '800',
  },
  weekDotRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  weekDotItem: {
    alignItems: 'center',
    gap: 6,
    flex: 1,
  },
  weekDot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  weekDotMet: {
    backgroundColor: 'rgba(48,209,88,0.72)',
    borderColor: 'rgba(48,209,88,0.92)',
  },
  weekDotMissed: {
    backgroundColor: 'rgba(255,69,58,0.55)',
    borderColor: 'rgba(255,69,58,0.82)',
  },
  weekDotLabel: {
    color: colors.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  typeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  typeButtonSelected: {
    backgroundColor: 'rgba(167,139,250,0.18)',
    borderColor: 'rgba(167,139,250,0.48)',
  },
  typeButtonText: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '700',
  },
  typeButtonTextSelected: {
    color: '#F5F3FF',
  },
  input: {
    minHeight: 48,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
    color: colors.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  notesInput: {
    minHeight: 82,
    textAlignVertical: 'top',
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 999,
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#101018',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  destructiveButton: {
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.34)',
    backgroundColor: 'rgba(255,69,58,0.12)',
  },
  destructiveButtonText: {
    color: '#FECACA',
    fontSize: 13,
    fontWeight: '700',
  },
  section: {
    gap: 12,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 20,
    lineHeight: 25,
    fontWeight: '800',
  },
  goalCard: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  goalTitle: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: SLEEP_ACCENT,
  },
  streakCard: {
    gap: 12,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  flameBadge: {
    width: 46,
    height: 46,
    borderRadius: 23,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(167,139,250,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.32)',
  },
  flameText: {
    fontSize: 22,
  },
  streakCopy: {
    flex: 1,
    gap: 2,
  },
  streakTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '800',
  },
  historyRow: {
    minHeight: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 5,
    alignItems: 'center',
  },
  historyCell: {
    width: 13,
    height: 13,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  historyCellMet: {
    backgroundColor: 'rgba(48,209,88,0.72)',
  },
  historyCellMissed: {
    backgroundColor: 'rgba(255,69,58,0.56)',
  },
  recordBadge: {
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(48,209,88,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(48,209,88,0.34)',
  },
  recordBadgeText: {
    color: '#BBF7D0',
    fontSize: 12,
    fontWeight: '800',
  },
  emptyCard: {
    gap: 8,
    padding: 18,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  emptyCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  errorCard: {
    padding: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255,69,58,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,69,58,0.28)',
  },
  errorText: {
    color: '#FECACA',
    fontSize: 14,
    lineHeight: 20,
  },
});
