import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  MAX_FREEZES_PER_MONTH,
  AreaChip,
  CheckCircle,
  GlassCard,
  HB_ACCENT,
  HB_ACCENT_LIGHT,
  HB_HABIT_TYPES,
  HB_STREAK,
  HB_SURFACES,
  HB_TEXT,
  HB_TEXT_SECONDARY,
  HB_TEXT_TERTIARY,
  HB_TYPOGRAPHY,
  HeatmapCalendar,
  MaterialSymbol,
  SectionHeader,
  StatTile,
  StreakFlame,
  calculateActionProgress,
  completeActionItem,
  createActionItem,
  createReminder,
  createStreakFreeze,
  deleteActionItem,
  deleteCompletion,
  deleteHabit,
  deleteReminder,
  deleteStreakFreeze,
  endSession,
  getActionItemsForHabit,
  getAreas,
  getCompletedActionItemIds,
  getCompletions,
  getFreezeDatesForHabit,
  getFreezesForHabit,
  getHabitById,
  getHabits,
  getHeatmapData,
  getLinksForHabit,
  getMeasurementsForHabit,
  getNegativeStreaks,
  getRemindersForHabit,
  getSessionsForHabit,
  getStreaks,
  getStreaksWithGrace,
  getYearlyStats,
  recordCompletion,
  recordMeasurement,
  remainingFreezes,
  resolveActionStates,
  startSession,
  toggleReminder,
  uncompleteActionItem,
  updateActionItemLabel,
  updateActionItemOrder,
  updateHabit,
  updateReminder,
  type Habit,
} from '@mylife/habits';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

function toDateString(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toIsoForDate(dateString: string) {
  return `${dateString}T12:00:00.000Z`;
}

function formatLongDate(dateString: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${dateString}T12:00:00.000Z`));
}

function formatReminderTime(time: string) {
  const [hoursRaw, minutesRaw] = time.split(':');
  const hours = Number.parseInt(hoursRaw ?? '', 10);
  const minutes = Number.parseInt(minutesRaw ?? '', 10);

  if (Number.isNaN(hours) || Number.isNaN(minutes)) {
    return time;
  }

  const period = hours >= 12 ? 'PM' : 'AM';
  const normalizedHours = hours % 12 || 12;
  return `${normalizedHours}:${String(minutes).padStart(2, '0')} ${period}`;
}

function formatFrequency(habit: Habit) {
  if (habit.frequency === 'specific_days' && habit.specificDays?.length) {
    return habit.specificDays.map((day) => day.slice(0, 3)).join(' • ');
  }
  return habit.frequency.replace('_', ' ');
}

function formatHabitType(habit: Habit) {
  if (habit.habitType === 'standard') return 'binary';
  if (habit.habitType === 'negative') return 'sobriety';
  return habit.habitType;
}

function MetaChip({
  label,
  tint,
}: {
  label: string;
  tint: string;
}) {
  return (
    <View style={[styles.metaChip, { backgroundColor: `${tint}24` }]}>
      <Text style={[styles.metaChipText, { color: tint }]}>
        {label}
      </Text>
    </View>
  );
}

function MiniButton({
  label,
  onPress,
  variant = 'default',
}: {
  label: string;
  onPress: () => void;
  variant?: 'default' | 'danger' | 'primary';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.miniButton,
        variant === 'primary' ? styles.miniButtonPrimary : null,
        variant === 'danger' ? styles.miniButtonDanger : null,
      ]}
    >
      <Text
        style={[
          styles.miniButtonText,
          variant === 'primary' ? styles.miniButtonTextPrimary : null,
          variant === 'danger' ? styles.miniButtonTextDanger : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function HabitDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tick, setTick] = useState(0);
  const [editingIdentity, setEditingIdentity] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [newActionLabel, setNewActionLabel] = useState('');
  const [editingActionId, setEditingActionId] = useState<string | null>(null);
  const [editingActionLabel, setEditingActionLabel] = useState('');
  const [newReminderTime, setNewReminderTime] = useState('');
  const [newReminderLabel, setNewReminderLabel] = useState('');
  const [editingReminderId, setEditingReminderId] = useState<string | null>(null);
  const [editingReminderTime, setEditingReminderTime] = useState('');
  const [editingReminderLabel, setEditingReminderLabel] = useState('');

  const refresh = useCallback(() => {
    setTick((value) => value + 1);
  }, []);

  const withErrorAlert = useCallback((message: string, action: () => void) => {
    try {
      action();
      refresh();
    } catch (error) {
      const description = error instanceof Error ? error.message : message;
      Alert.alert('MyHabits', description);
    }
  }, [refresh]);

  const habit = useMemo(() => {
    if (!id) return null;
    try { return getHabitById(db, id); } catch { return null; }
  }, [db, id, tick]);
  const today = useMemo(() => toDateString(new Date()), []);
  const stats = useMemo(
    () => (id ? getYearlyStats(db, id) : null),
    [db, id, tick],
  );
  const heatmap = useMemo(
    () => (id ? getHeatmapData(db, id).map((day) => ({ date: day.date, value: day.count })) : []),
    [db, id, tick],
  );
  const completions = useMemo(
    () => (id ? getCompletions(db, id) : []),
    [db, id, tick],
  );
  const measurements = useMemo(
    () => (id ? getMeasurementsForHabit(db, id) : []),
    [db, id, tick],
  );
  const sessions = useMemo(
    () => (id ? getSessionsForHabit(db, id) : []),
    [db, id, tick],
  );
  const actionItems = useMemo(
    () => (id ? getActionItemsForHabit(db, id) : []),
    [db, id, tick],
  );
  const completedActionIds = useMemo(
    () => (id ? getCompletedActionItemIds(db, id, today) : new Set<string>()),
    [db, id, tick, today],
  );
  const actionStates = useMemo(
    () => resolveActionStates(actionItems, completedActionIds),
    [actionItems, completedActionIds],
  );
  const actionProgress = useMemo(
    () => calculateActionProgress(actionItems.length, completedActionIds.size),
    [actionItems.length, completedActionIds.size],
  );
  const reminders = useMemo(
    () => (id ? getRemindersForHabit(db, id) : []),
    [db, id, tick],
  );
  const links = useMemo(
    () => (id ? getLinksForHabit(db, id) : []),
    [db, id, tick],
  );
  const allHabits = useMemo(
    () => getHabits(db),
    [db, tick],
  );
  const allAreas = useMemo(
    () => getAreas(db),
    [db, tick],
  );
  const freezes = useMemo(
    () => (id ? getFreezesForHabit(db, id) : []),
    [db, id, tick],
  );
  const freezeDates = useMemo(
    () => (id ? getFreezeDatesForHabit(db, id) : []),
    [db, id, tick],
  );

  const streakInfo = useMemo(() => {
    if (!habit) return null;
    if (habit.habitType === 'negative') {
      return getNegativeStreaks(db, habit.id);
    }
    if (habit.habitType === 'measurable') {
      return getStreaks(db, habit.id);
    }
    if (habit.gracePeriod > 0) {
      return getStreaksWithGrace(db, habit.id, habit.gracePeriod);
    }
    return getStreaks(db, habit.id);
  }, [db, habit, tick]);

  const completionsByDate = useMemo(() => {
    const map = new Map<string, typeof completions>();
    for (const completion of completions) {
      const date = completion.completedAt.slice(0, 10);
      const next = map.get(date) ?? [];
      next.push(completion);
      map.set(date, next);
    }
    return map;
  }, [completions]);

  const measurementsByDate = useMemo(() => {
    const map = new Map<string, typeof measurements>();
    for (const measurement of measurements) {
      const date = measurement.measuredAt.slice(0, 10);
      const next = map.get(date) ?? [];
      next.push(measurement);
      map.set(date, next);
    }
    return map;
  }, [measurements]);

  const sessionsByDate = useMemo(() => {
    const map = new Map<string, typeof sessions>();
    for (const session of sessions) {
      const date = session.startedAt.slice(0, 10);
      const next = map.get(date) ?? [];
      next.push(session);
      map.set(date, next);
    }
    return map;
  }, [sessions]);

  const relatedHabits = useMemo(
    () => new Map(allHabits.map((entry) => [entry.id, entry])),
    [allHabits],
  );

  const beforeLinks = useMemo(
    () => links.filter((link) => link.childHabitId === id).sort((a, b) => a.sortOrder - b.sortOrder),
    [id, links],
  );
  const afterLinks = useMemo(
    () => links.filter((link) => link.parentHabitId === id).sort((a, b) => a.sortOrder - b.sortOrder),
    [id, links],
  );
  const currentArea = useMemo(
    () => (habit?.areaId ? allAreas.find((entry) => entry.id === habit.areaId) ?? null : null),
    [allAreas, habit?.areaId],
  );

  if (!habit || !id) {
    return (
      <View style={styles.missingState}>
        <GlassCard level={3} style={styles.missingCard}>
          <Text style={styles.missingTitle}>
            Habit not found
          </Text>
          <Text style={styles.missingCopy}>
            This habit may have been deleted or moved.
          </Text>
          <MiniButton label="Back" onPress={() => router.back()} variant="primary" />
        </GlassCard>
      </View>
    );
  }

  const todayCompletionRows = completionsByDate.get(today) ?? [];
  const todayMeasurementRows = measurementsByDate.get(today) ?? [];
  const todaySessionRows = sessionsByDate.get(today) ?? [];
  const isCompletedToday = habit.habitType === 'timed'
    ? todaySessionRows.some((session) => session.completed)
    : habit.habitType === 'measurable'
      ? todayMeasurementRows.some((measurement) => measurement.value >= measurement.target)
      : todayCompletionRows.length > 0;
  const currentStreak = streakInfo && 'currentStreak' in streakInfo
    ? streakInfo.currentStreak
    : streakInfo && 'daysSinceLastSlip' in streakInfo
      ? streakInfo.daysSinceLastSlip
      : 0;
  const longestStreak = streakInfo && 'longestStreak' in streakInfo
    ? streakInfo.longestStreak
    : streakInfo && 'longestCleanStreak' in streakInfo
      ? streakInfo.longestCleanStreak
      : 0;
  const freezesRemaining = remainingFreezes(freezeDates, today.slice(0, 7));
  const habitTypeTint = habit.habitType === 'timed'
    ? HB_HABIT_TYPES.timed
    : habit.habitType === 'measurable'
      ? HB_HABIT_TYPES.measurement
      : habit.habitType === 'negative'
        ? HB_HABIT_TYPES.sobriety
        : HB_ACCENT_LIGHT;

  const handleShare = async () => {
    try {
      await Share.share({
        title: habit.name,
        message: `${habit.name}\n${formatFrequency(habit)}\nCurrent streak: ${currentStreak} days`,
      });
    } catch {
      Alert.alert('MyHabits', 'Unable to open the share sheet.');
    }
  };

  const handleMore = () => {
    Alert.alert(
      habit.name,
      'Choose an action for this habit.',
      [
        {
          text: habit.isArchived ? 'Unarchive' : 'Archive',
          onPress: () => {
            withErrorAlert('Unable to update this habit.', () => {
              updateHabit(db, habit.id, { isArchived: !habit.isArchived });
            });
          },
        },
        {
          text: habit.endDate == null || habit.endDate > today ? 'Pause today' : 'Resume',
          onPress: () => {
            withErrorAlert('Unable to update this habit.', () => {
              updateHabit(db, habit.id, {
                endDate: habit.endDate == null || habit.endDate > today ? today : null,
              });
            });
          },
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'Delete habit?',
              `Delete "${habit.name}" and all related history? This cannot be undone.`,
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Delete',
                  style: 'destructive',
                  onPress: () => {
                    withErrorAlert('Unable to delete this habit.', () => {
                      deleteHabit(db, habit.id);
                      router.replace('/(habits)/habits');
                    });
                  },
                },
              ],
            );
          },
        },
        { text: 'Cancel', style: 'cancel' },
      ],
    );
  };

  const handleTodayCheck = () => {
    if (habit.habitType === 'negative') {
      Alert.alert('Slip-free tracking', 'Negative habits are logged from the sobriety and craving flows.');
      return;
    }

    if (habit.habitType === 'standard' && isCompletedToday) {
      withErrorAlert('Unable to update today.', () => {
        for (const completion of todayCompletionRows) {
          deleteCompletion(db, completion.id);
        }
      });
      return;
    }

    if (habit.habitType === 'timed' && isCompletedToday) {
      Alert.alert('Already completed', 'This timed habit is already complete for today.');
      return;
    }

    if (habit.habitType === 'measurable' && isCompletedToday) {
      Alert.alert('Already logged', 'This measurable habit already hit its goal today.');
      return;
    }

    withErrorAlert('Unable to update today.', () => {
      const iso = new Date().toISOString();
      if (habit.habitType === 'timed') {
        const sessionId = uuid();
        startSession(db, sessionId, habit.id, habit.targetCount);
        endSession(db, sessionId, habit.targetCount);
        recordCompletion(db, uuid(), habit.id, iso, habit.targetCount);
        return;
      }

      if (habit.habitType === 'measurable') {
        recordMeasurement(db, uuid(), habit.id, iso, habit.targetCount, habit.targetCount);
        return;
      }

      recordCompletion(db, uuid(), habit.id, iso, 1);
    });
  };

  const handleHeatmapPress = (day: { date: string; value: number }) => {
    const matching = completionsByDate.get(day.date) ?? [];

    if (matching.length > 0) {
      Alert.alert(
        formatLongDate(day.date),
        `${matching.length} completion${matching.length === 1 ? '' : 's'} recorded.`,
      );
      return;
    }

    if (habit.habitType !== 'standard') {
      Alert.alert(
        formatLongDate(day.date),
        'Tap days on measurable, timed, and sobriety habits to review history only.',
      );
      return;
    }

    Alert.alert(
      'Mark complete?',
      `Record ${habit.name} on ${formatLongDate(day.date)}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Complete',
          onPress: () => {
            withErrorAlert('Unable to update this day.', () => {
              recordCompletion(db, uuid(), habit.id, toIsoForDate(day.date), 1);
            });
          },
        },
      ],
    );
  };

  const beginEditingIdentity = () => {
    setDraftName(habit.name);
    setDraftNotes(habit.description ?? '');
    setEditingIdentity(true);
  };

  const saveIdentity = () => {
    withErrorAlert('Unable to save habit changes.', () => {
      updateHabit(db, habit.id, {
        name: draftName.trim() || habit.name,
        description: draftNotes.trim() || null,
      });
      setEditingIdentity(false);
    });
  };

  const toggleActionItem = (actionItemId: string, completed: boolean) => {
    withErrorAlert('Unable to update this action item.', () => {
      if (completed) {
        uncompleteActionItem(db, actionItemId, today);
      } else {
        completeActionItem(db, actionItemId, today);
      }
    });
  };

  const moveActionItem = (actionItemId: string, direction: -1 | 1) => {
    const index = actionItems.findIndex((item) => item.id === actionItemId);
    const swapIndex = index + direction;

    if (index < 0 || swapIndex < 0 || swapIndex >= actionItems.length) {
      return;
    }

    const current = actionItems[index];
    const target = actionItems[swapIndex];

    withErrorAlert('Unable to reorder this list.', () => {
      updateActionItemOrder(db, current.id, target.sortOrder);
      updateActionItemOrder(db, target.id, current.sortOrder);
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <GlassCard level={2} contentStyle={styles.headerCard}>
        <Pressable onPress={() => router.back()} style={styles.headerPill}>
          <Text style={styles.headerPillText}>
            Back
          </Text>
        </Pressable>
        <View style={styles.headerActions}>
          <Pressable onPress={editingIdentity ? saveIdentity : beginEditingIdentity} style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              {editingIdentity ? 'Save' : 'Edit'}
            </Text>
          </Pressable>
          <Pressable onPress={handleShare} style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              Share
            </Text>
          </Pressable>
          <Pressable onPress={handleMore} style={styles.headerPill}>
            <Text style={styles.headerPillText}>
              More
            </Text>
          </Pressable>
        </View>
      </GlassCard>

      <GlassCard level={4} contentStyle={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <CheckCircle
            checked={isCompletedToday}
            color={habitTypeTint}
            onPress={handleTodayCheck}
            size={96}
          />
          <View style={styles.heroStreak}>
            <View style={styles.heroStreakBadge}>
              <StreakFlame count={currentStreak} size={28} showNumber={false} frozen={freezeDates.includes(today)} />
              <Text style={styles.heroStreakValue}>
                {currentStreak}
              </Text>
            </View>
            <Text style={styles.heroStreakLabel}>
              day streak
            </Text>
          </View>
        </View>

        {editingIdentity ? (
          <View style={styles.identityEditor}>
            <TextInput
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Habit name"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.heroNameInput}
            />
            <TextInput
              value={draftNotes}
              onChangeText={setDraftNotes}
              multiline
              placeholder="Add context, notes, or motivation"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.heroNotesInput}
            />
            <View style={styles.inlineButtons}>
              <MiniButton label="Save" onPress={saveIdentity} variant="primary" />
              <MiniButton label="Cancel" onPress={() => setEditingIdentity(false)} />
            </View>
          </View>
        ) : (
          <>
            <Text style={styles.heroTitle}>
              {habit.name}
            </Text>
            <Text style={styles.heroCopy}>
              {habit.description?.trim()
                ? habit.description
                : 'A habit built to reinforce consistency through small daily wins.'}
            </Text>
          </>
        )}

        <View style={styles.metaRail}>
          {currentArea ? (
            <AreaChip
              area={{
                name: currentArea.name,
                color: currentArea.color,
                icon: currentArea.icon,
              }}
            />
          ) : null}
          <MetaChip label={formatFrequency(habit)} tint={HB_ACCENT_LIGHT} />
          <MetaChip label={formatHabitType(habit)} tint={habitTypeTint} />
          {habit.habitType === 'measurable' && habit.unit ? (
            <MetaChip label={`${habit.targetCount} ${habit.unit}`} tint={HB_HABIT_TYPES.measurement} />
          ) : null}
          {habit.habitType === 'timed' ? (
            <MetaChip label={`${Math.round(habit.targetCount / 60)} min`} tint={HB_HABIT_TYPES.timed} />
          ) : null}
        </View>
      </GlassCard>

      <View style={styles.statsRow}>
        <StatTile icon="local_fire_department" label="Current Streak" value={currentStreak} color={HB_STREAK.fire} />
        <StatTile icon="military_tech" label="Best Streak" value={longestStreak} color={HB_STREAK.legendary} />
        <StatTile icon="bar_chart" label="Completion" value={`${Math.round((stats?.completionRate ?? 0) * 100)}%`} color={HB_ACCENT_LIGHT} />
      </View>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <SectionHeader title="Heatmap" />
        <Text style={styles.sectionCopy}>
          Last three months of consistency. Tap a day to inspect it or mark a standard habit complete.
        </Text>
        <HeatmapCalendar
          data={heatmap}
          months={3}
          onDayPress={handleHeatmapPress}
        />
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <SectionHeader title="Action Items" action={{ label: 'Add', onPress: () => {
          if (!newActionLabel.trim()) {
            Alert.alert('MyHabits', 'Enter an action item label first.');
            return;
          }
          withErrorAlert('Unable to add this action item.', () => {
            createActionItem(db, habit.id, newActionLabel.trim(), actionItems.length);
            setNewActionLabel('');
          });
        } }} />
        <Text style={styles.sectionCopy}>
          {actionItems.length === 0
            ? 'Break this habit into smaller moves and track today’s progress.'
            : `${actionProgress.completed}/${actionProgress.total} done today.`}
        </Text>
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${actionProgress.percentage}%` }]} />
        </View>
        <View style={styles.listSection}>
          {actionStates.map((item, index) => (
            <GlassCard key={item.id} level={1} contentStyle={styles.actionRow}>
              <CheckCircle
                checked={item.isCompleted}
                onPress={() => toggleActionItem(item.id, item.isCompleted)}
              />
              <View style={styles.actionBody}>
                {editingActionId === item.id ? (
                  <TextInput
                    autoFocus
                    value={editingActionLabel}
                    onChangeText={setEditingActionLabel}
                    onSubmitEditing={() => {
                      withErrorAlert('Unable to save this action item.', () => {
                        updateActionItemLabel(db, item.id, editingActionLabel.trim() || item.label);
                        setEditingActionId(null);
                        setEditingActionLabel('');
                      });
                    }}
                    placeholder="Action item"
                    placeholderTextColor={HB_TEXT_TERTIARY}
                    style={styles.inlineInput}
                  />
                ) : (
                  <Text style={[styles.actionLabel, item.isCompleted ? styles.actionLabelDone : null]}>
                    {item.label}
                  </Text>
                )}
              </View>
              <View style={styles.actionControls}>
                {index > 0 ? <MiniButton label="Up" onPress={() => moveActionItem(item.id, -1)} /> : null}
                {index < actionStates.length - 1 ? <MiniButton label="Down" onPress={() => moveActionItem(item.id, 1)} /> : null}
                {editingActionId === item.id ? (
                  <MiniButton label="Done" onPress={() => {
                    withErrorAlert('Unable to save this action item.', () => {
                      updateActionItemLabel(db, item.id, editingActionLabel.trim() || item.label);
                      setEditingActionId(null);
                      setEditingActionLabel('');
                    });
                  }} variant="primary" />
                ) : (
                  <MiniButton label="Edit" onPress={() => {
                    setEditingActionId(item.id);
                    setEditingActionLabel(item.label);
                  }} />
                )}
                <MiniButton label="Delete" onPress={() => {
                  withErrorAlert('Unable to remove this action item.', () => {
                    deleteActionItem(db, item.id);
                  });
                }} variant="danger" />
              </View>
            </GlassCard>
          ))}
          <GlassCard level={1} contentStyle={styles.addRow}>
            <TextInput
              value={newActionLabel}
              onChangeText={setNewActionLabel}
              placeholder="Add new action item"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.inlineInput}
            />
          </GlassCard>
        </View>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <SectionHeader title="Reminders" />
        <Text style={styles.sectionCopy}>
          Multiple reminder moments per habit. Toggle active reminders or edit their label and time.
        </Text>
        <View style={styles.listSection}>
          {reminders.map((reminder) => (
            <GlassCard key={reminder.id} level={1} contentStyle={styles.reminderCard}>
              <View style={styles.reminderMain}>
                {editingReminderId === reminder.id ? (
                  <>
                    <TextInput
                      autoFocus
                      value={editingReminderTime}
                      onChangeText={setEditingReminderTime}
                      placeholder="08:30"
                      placeholderTextColor={HB_TEXT_TERTIARY}
                      style={[styles.inlineInput, styles.reminderTimeInput]}
                    />
                    <TextInput
                      value={editingReminderLabel}
                      onChangeText={setEditingReminderLabel}
                      placeholder="Label"
                      placeholderTextColor={HB_TEXT_TERTIARY}
                      style={styles.inlineInput}
                    />
                  </>
                ) : (
                  <>
                    <Text style={styles.reminderTime}>
                      {formatReminderTime(reminder.time)}
                    </Text>
                    <Text style={styles.reminderLabel}>
                      {reminder.label?.trim() || 'Daily cue'}
                    </Text>
                  </>
                )}
              </View>
              <View style={styles.actionControls}>
                <MiniButton
                  label={reminder.isActive ? 'Mute' : 'Enable'}
                  onPress={() => {
                    withErrorAlert('Unable to update this reminder.', () => {
                      toggleReminder(db, reminder.id, !reminder.isActive);
                    });
                  }}
                />
                {editingReminderId === reminder.id ? (
                  <MiniButton
                    label="Save"
                    variant="primary"
                    onPress={() => {
                      if (!/^\d{2}:\d{2}$/.test(editingReminderTime)) {
                        Alert.alert('MyHabits', 'Use HH:MM for reminder time.');
                        return;
                      }
                      withErrorAlert('Unable to update this reminder.', () => {
                        updateReminder(db, reminder.id, {
                          time: editingReminderTime,
                          label: editingReminderLabel.trim() || null,
                        });
                        setEditingReminderId(null);
                        setEditingReminderTime('');
                        setEditingReminderLabel('');
                      });
                    }}
                  />
                ) : (
                  <MiniButton
                    label="Edit"
                    onPress={() => {
                      setEditingReminderId(reminder.id);
                      setEditingReminderTime(reminder.time);
                      setEditingReminderLabel(reminder.label ?? '');
                    }}
                  />
                )}
                <MiniButton
                  label="Delete"
                  variant="danger"
                  onPress={() => {
                    withErrorAlert('Unable to delete this reminder.', () => {
                      deleteReminder(db, reminder.id);
                    });
                  }}
                />
              </View>
            </GlassCard>
          ))}
          <GlassCard level={1} contentStyle={styles.reminderComposer}>
            <TextInput
              value={newReminderTime}
              onChangeText={setNewReminderTime}
              placeholder="08:30"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={[styles.inlineInput, styles.reminderTimeInput]}
            />
            <TextInput
              value={newReminderLabel}
              onChangeText={setNewReminderLabel}
              placeholder="Morning cue"
              placeholderTextColor={HB_TEXT_TERTIARY}
              style={styles.inlineInput}
            />
            <MiniButton
              label="Add Reminder"
              variant="primary"
              onPress={() => {
                if (!/^\d{2}:\d{2}$/.test(newReminderTime)) {
                  Alert.alert('MyHabits', 'Use HH:MM for reminder time.');
                  return;
                }
                withErrorAlert('Unable to create this reminder.', () => {
                  createReminder(db, uuid(), habit.id, newReminderTime, newReminderLabel.trim() || undefined);
                  setNewReminderTime('');
                  setNewReminderLabel('');
                });
              }}
            />
          </GlassCard>
        </View>
      </GlassCard>

      {(beforeLinks.length > 0 || afterLinks.length > 0) ? (
        <GlassCard level={3} contentStyle={styles.sectionCard}>
          <SectionHeader title="Stack Chain" action={{ label: 'Open', onPress: () => router.push('/(habits)/stacking') }} />
          <Text style={styles.sectionCopy}>
            See how this habit fits before and after your other routines.
          </Text>
          <View style={styles.stackColumn}>
            {beforeLinks.map((link) => {
              const linkedHabit = relatedHabits.get(link.parentHabitId);
              if (!linkedHabit) return null;
              return (
                <View key={link.id} style={styles.stackPill}>
                  <Text style={styles.stackCaption}>Before this</Text>
                  <Text style={styles.stackLabel}>{linkedHabit.name}</Text>
                </View>
              );
            })}
            <View style={[styles.stackPill, styles.stackAnchor]}>
              <Text style={styles.stackCaption}>Current</Text>
              <Text style={styles.stackLabel}>{habit.name}</Text>
            </View>
            {afterLinks.map((link) => {
              const linkedHabit = relatedHabits.get(link.childHabitId);
              if (!linkedHabit) return null;
              return (
                <View key={link.id} style={styles.stackPill}>
                  <Text style={styles.stackCaption}>After this</Text>
                  <Text style={styles.stackLabel}>{linkedHabit.name}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>
      ) : null}

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <SectionHeader title="Streak Freeze" />
        <Text style={styles.sectionCopy}>
          {freezesRemaining} of {MAX_FREEZES_PER_MONTH} freezes remain this month.
        </Text>
        <View style={styles.freezeHeader}>
          <Text style={styles.freezeCounter}>
            {freezesRemaining}
          </Text>
          <MiniButton
            label={freezeDates.includes(today) ? 'Frozen Today' : 'Use Today'}
            variant="primary"
            onPress={() => {
              if (freezeDates.includes(today)) {
                Alert.alert('Already frozen', 'Today is already protected with a streak freeze.');
                return;
              }
              if (freezesRemaining <= 0) {
                Alert.alert('No freezes left', 'You have already used all freezes for this month.');
                return;
              }
              withErrorAlert('Unable to create a freeze.', () => {
                createStreakFreeze(db, habit.id, today, 'Used from habit detail');
              });
            }}
          />
        </View>
        <View style={styles.freezeRail}>
          {freezes.length === 0 ? (
            <Text style={styles.freezeEmpty}>
              No freeze dates used yet.
            </Text>
          ) : freezes.map((freeze) => (
            <Pressable
              key={freeze.id}
              onLongPress={() => {
                withErrorAlert('Unable to remove this freeze.', () => {
                  deleteStreakFreeze(db, freeze.id);
                });
              }}
              style={styles.freezeChip}
            >
              <MaterialSymbol name="local_fire_department" size={14} color={HB_STREAK.frozen} filled />
              <Text style={styles.freezeChipText}>
                {formatLongDate(freeze.freezeDate)}
              </Text>
            </Pressable>
          ))}
        </View>
      </GlassCard>

      <GlassCard level={3} contentStyle={styles.sectionCard}>
        <SectionHeader title="Notes" action={!editingIdentity ? { label: 'Edit', onPress: beginEditingIdentity } : undefined} />
        <TextInput
          multiline
          value={editingIdentity ? draftNotes : (habit.description ?? '')}
          onChangeText={editingIdentity ? setDraftNotes : undefined}
          editable={editingIdentity}
          placeholder="Keep cues, motivation, or observations here."
          placeholderTextColor={HB_TEXT_TERTIARY}
          style={[styles.notesInput, editingIdentity ? styles.notesInputEditing : null]}
        />
      </GlassCard>

      <GlassCard level={1} contentStyle={styles.dangerZone}>
        <SectionHeader title="Danger Zone" accent={HB_HABIT_TYPES.sobriety} />
        <Text style={styles.sectionCopy}>
          Archive keeps history. Delete removes everything. Pausing sets an end date until you resume it.
        </Text>
        <View style={styles.dangerActions}>
          <MiniButton
            label={habit.endDate == null || habit.endDate > today ? 'Pause Habit' : 'Resume Habit'}
            onPress={() => {
              withErrorAlert('Unable to update this habit.', () => {
                updateHabit(db, habit.id, {
                  endDate: habit.endDate == null || habit.endDate > today ? today : null,
                });
              });
            }}
          />
          <MiniButton
            label={habit.isArchived ? 'Unarchive' : 'Archive'}
            onPress={() => {
              withErrorAlert('Unable to update this habit.', () => {
                updateHabit(db, habit.id, { isArchived: !habit.isArchived });
              });
            }}
          />
          <MiniButton
            label="Delete"
            variant="danger"
            onPress={handleMore}
          />
        </View>
      </GlassCard>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: HB_SURFACES.base,
  },
  content: {
    gap: 14,
    paddingHorizontal: 16,
    paddingTop: 18,
    paddingBottom: 140,
  },
  missingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: HB_SURFACES.base,
    padding: 20,
  },
  missingCard: {
    width: '100%',
  },
  missingTitle: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
    marginBottom: 8,
  },
  missingCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
    marginBottom: 18,
  },
  headerCard: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerPill: {
    borderRadius: 999,
    backgroundColor: `${HB_ACCENT}18`,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  headerPillText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_ACCENT_LIGHT,
  },
  heroCard: {
    gap: 16,
    paddingTop: 20,
    paddingBottom: 20,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 18,
  },
  heroStreak: {
    alignItems: 'flex-end',
    gap: 8,
  },
  heroStreakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  heroStreakValue: {
    ...HB_TYPOGRAPHY.streakDisplay,
    color: HB_ACCENT_LIGHT,
  },
  heroStreakLabel: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  heroTitle: {
    ...HB_TYPOGRAPHY.displayLg,
    color: HB_TEXT,
  },
  heroCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  identityEditor: {
    gap: 12,
  },
  heroNameInput: {
    ...HB_TYPOGRAPHY.displayLg,
    borderRadius: 20,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT,
    paddingHorizontal: 18,
    paddingVertical: 14,
  },
  heroNotesInput: {
    ...HB_TYPOGRAPHY.bodyMd,
    minHeight: 96,
    borderRadius: 18,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  inlineButtons: {
    flexDirection: 'row',
    gap: 10,
  },
  metaRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metaChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaChipText: {
    ...HB_TYPOGRAPHY.labelUpper,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sectionCard: {
    gap: 12,
  },
  sectionCopy: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  progressTrack: {
    height: 10,
    borderRadius: 999,
    backgroundColor: HB_SURFACES.lowest,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: HB_ACCENT,
  },
  listSection: {
    gap: 10,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionBody: {
    flex: 1,
  },
  actionLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
  actionLabelDone: {
    color: HB_TEXT_SECONDARY,
    textDecorationLine: 'line-through',
  },
  actionControls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'flex-end',
    gap: 8,
  },
  inlineInput: {
    ...HB_TYPOGRAPHY.bodyMd,
    borderRadius: 14,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  addRow: {
    padding: 10,
  },
  reminderCard: {
    gap: 10,
  },
  reminderMain: {
    gap: 6,
  },
  reminderTime: {
    ...HB_TYPOGRAPHY.headlineMd,
    color: HB_TEXT,
  },
  reminderLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_SECONDARY,
  },
  reminderComposer: {
    gap: 10,
  },
  reminderTimeInput: {
    minWidth: 112,
  },
  stackColumn: {
    gap: 10,
  },
  stackPill: {
    borderRadius: 18,
    backgroundColor: HB_SURFACES.lowest,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 4,
  },
  stackAnchor: {
    backgroundColor: `${HB_ACCENT}16`,
  },
  stackCaption: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_TERTIARY,
  },
  stackLabel: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
  },
  freezeHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  freezeCounter: {
    ...HB_TYPOGRAPHY.streakDisplay,
    color: HB_ACCENT_LIGHT,
  },
  freezeRail: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  freezeChip: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    borderRadius: 999,
    backgroundColor: `${HB_STREAK.frozen}18`,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  freezeChipText: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT,
    fontSize: 13,
    lineHeight: 18,
  },
  freezeEmpty: {
    ...HB_TYPOGRAPHY.bodyMd,
    color: HB_TEXT_TERTIARY,
  },
  notesInput: {
    ...HB_TYPOGRAPHY.bodyMd,
    minHeight: 112,
    borderRadius: 20,
    backgroundColor: HB_SURFACES.lowest,
    color: HB_TEXT_SECONDARY,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: 'top',
  },
  notesInputEditing: {
    color: HB_TEXT,
  },
  dangerZone: {
    gap: 12,
  },
  dangerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  miniButton: {
    borderRadius: 999,
    backgroundColor: HB_SURFACES.lowest,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  miniButtonPrimary: {
    backgroundColor: HB_ACCENT,
  },
  miniButtonDanger: {
    backgroundColor: `${HB_HABIT_TYPES.sobriety}20`,
  },
  miniButtonText: {
    ...HB_TYPOGRAPHY.labelUpper,
    color: HB_TEXT_SECONDARY,
  },
  miniButtonTextPrimary: {
    color: HB_SURFACES.lowest,
  },
  miniButtonTextDanger: {
    color: HB_HABIT_TYPES.sobriety,
  },
});
