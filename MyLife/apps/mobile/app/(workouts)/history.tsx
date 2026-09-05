import { useCallback, useMemo, useState } from 'react';
import {
  RefreshControl,
  StyleSheet,
  Text as RNText,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import Svg, { Rect } from 'react-native-svg';
import {
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT,
  WK_ACCENT_LIGHT,
  WK_FONTS,
  buildHistory,
  calculateStreaks,
  getSetWeightsForSession,
  getWeeklySummaries,
  getWorkoutSessions,
  getWorkouts,
  type ProgressSession,
  type WorkoutHistoryEntry,
  type WorkoutSession,
} from '@mylife/workouts';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  WorkoutBodyCopy,
  WorkoutPhaseHeader,
  WorkoutPhaseScreen,
  formatDateLabel,
  formatMinutesLabel,
  formatVolumeLabel,
} from './phase2-kit';

type HeatmapCell = {
  key: string;
  label: string;
  volume: number;
  column: number;
  row: number;
};

type HistoryViewModel = {
  totalSessions: number;
  totalVolume: number;
  currentStreak: number;
  bestWeekLabel: string;
  bestWeekCount: number;
  sections: Array<{ title: string; items: WorkoutHistoryEntry[] }>;
  heatmap: HeatmapCell[];
  tooltip: HeatmapCell | null;
};

const CELL_SIZE = 18;
const CELL_GAP = 6;

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date: Date): Date {
  const copy = startOfDay(date);
  const weekday = copy.getDay();
  const diff = (weekday + 6) % 7;
  copy.setDate(copy.getDate() - diff);
  return copy;
}

function dayKey(date: Date): string {
  return startOfDay(date).toISOString().slice(0, 10);
}

function toProgressSessions(sessions: WorkoutSession[]): ProgressSession[] {
  return sessions.map((session) => ({
    id: session.id,
    workout_id: session.workoutId,
    started_at: session.startedAt,
    completed_at: session.completedAt,
    exercises_completed: session.exercisesCompleted.map((item) => ({
      exercise_id: item.exerciseId,
      sets_completed: item.setsCompleted,
      reps_completed: item.repsCompleted,
      duration_actual: item.durationActual,
      skipped: item.skipped,
    })),
  }));
}

function buildHistoryView(db: ReturnType<typeof useDatabase>): HistoryViewModel {
  const sessions = getWorkoutSessions(db, { onlyCompleted: true, limit: 300 });
  const progressSessions = toProgressSessions(sessions);
  const workoutTitles = Object.fromEntries(
    getWorkouts(db).map((workout) => [workout.id, workout.title]),
  );
  const history = buildHistory(progressSessions, workoutTitles);
  const streaks = calculateStreaks(progressSessions);
  const weekly = getWeeklySummaries(progressSessions, 12);

  const volumeBySession = new Map<string, number>();
  const volumeByDay = new Map<string, number>();
  for (const session of sessions) {
    const sessionWeights = getSetWeightsForSession(db, session.id);
    const sessionVolume =
      sessionWeights.reduce((total, item) => total + item.weight * item.reps, 0) ||
      session.exercisesCompleted.reduce(
        (total, item) => total + item.setsCompleted * (item.repsCompleted ?? 0) * 10,
        0,
      );
    volumeBySession.set(session.id, sessionVolume);
    const key = dayKey(new Date(session.completedAt ?? session.startedAt));
    volumeByDay.set(key, (volumeByDay.get(key) ?? 0) + sessionVolume);
  }

  const totalVolume = Array.from(volumeBySession.values()).reduce((sum, value) => sum + value, 0);
  const bestWeek = weekly.reduce((best, item) => {
    if (item.sessions > best.sessions) {
      return item;
    }
    return best;
  }, weekly[0] ?? { label: 'This Week', sessions: 0, totalMinutes: 0, totalReps: 0 });

  const now = new Date();
  const currentWeekStart = startOfWeek(now);
  const lastWeekStart = new Date(currentWeekStart);
  lastWeekStart.setDate(lastWeekStart.getDate() - 7);

  const sections: HistoryViewModel['sections'] = [
    { title: 'This Week', items: [] },
    { title: 'Last Week', items: [] },
    { title: 'Earlier', items: [] },
  ];

  history.forEach((entry) => {
    const date = new Date(entry.date);
    if (date >= currentWeekStart) {
      sections[0].items.push(entry);
    } else if (date >= lastWeekStart) {
      sections[1].items.push(entry);
    } else {
      sections[2].items.push(entry);
    }
  });

  const heatmapStart = startOfWeek(new Date(now.getTime() - 11 * 7 * 24 * 60 * 60 * 1000));
  const heatmap: HeatmapCell[] = [];

  for (let column = 0; column < 12; column += 1) {
    for (let row = 0; row < 7; row += 1) {
      const date = new Date(heatmapStart);
      date.setDate(heatmapStart.getDate() + column * 7 + row);
      const key = dayKey(date);
      heatmap.push({
        key,
        label: formatDateLabel(key),
        volume: volumeByDay.get(key) ?? 0,
        column,
        row,
      });
    }
  }

  const tooltip =
    heatmap.find((item) => item.key === dayKey(now)) ??
    heatmap[heatmap.length - 1] ??
    null;

  return {
    totalSessions: history.length,
    totalVolume,
    currentStreak: streaks.current,
    bestWeekLabel: bestWeek.label,
    bestWeekCount: bestWeek.sessions,
    sections: sections.filter((section) => section.items.length > 0),
    heatmap,
    tooltip,
  };
}

function resolveHeatColor(volume: number, maxVolume: number): string {
  if (volume <= 0 || maxVolume <= 0) {
    return 'rgba(255, 255, 255, 0.06)';
  }

  const ratio = volume / maxVolume;
  if (ratio >= 0.66) {
    return 'rgba(239, 68, 68, 1)';
  }
  if (ratio >= 0.33) {
    return 'rgba(239, 68, 68, 0.6)';
  }
  return 'rgba(239, 68, 68, 0.3)';
}

export default function WorkoutHistoryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [refreshKey, setRefreshKey] = useState(0);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      setRefreshKey((value) => value + 1);
    }, []),
  );

  const state = useMemo(() => {
    try {
      return { data: buildHistoryView(db), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unable to load training journal.',
      };
    }
  }, [db, refreshKey]);

  const selectedCell = useMemo(() => {
    if (!state.data) {
      return null;
    }
    if (!selectedKey) {
      return state.data.tooltip;
    }
    return state.data.heatmap.find((item) => item.key === selectedKey) ?? state.data.tooltip;
  }, [selectedKey, state.data]);

  const maxHeatVolume = useMemo(() => {
    return Math.max(...(state.data?.heatmap.map((item) => item.volume) ?? [0]));
  }, [state.data]);

  return (
    <WorkoutPhaseScreen
      refreshControl={
        <RefreshControl
          refreshing={false}
          onRefresh={() => setRefreshKey((value) => value + 1)}
          tintColor={WK_ACCENT}
          colors={[WK_ACCENT]}
        />
      }
    >
      <Stack.Screen options={{ headerShown: false }} />
      <WorkoutPhaseHeader title="Training Journal" onBack={() => router.back()} />

      {state.error ? (
        <View style={styles.body}>
          <GlassPanel padding={22}>
            <RNText style={styles.errorTitle}>Training journal unavailable</RNText>
            <WorkoutBodyCopy>{state.error}</WorkoutBodyCopy>
          </GlassPanel>
        </View>
      ) : !state.data || state.data.totalSessions === 0 ? (
        <View style={styles.body}>
          <GlassPanel padding={24} style={styles.emptyCard}>
            <MaterialSymbol name="history" size={28} color={WK_ACCENT_LIGHT} />
            <RNText style={styles.emptyTitle}>No sessions yet</RNText>
            <WorkoutBodyCopy>Start your first workout to light up the journal.</WorkoutBodyCopy>
          </GlassPanel>
        </View>
      ) : (
        <View style={styles.body}>
          <View style={styles.hero}>
            <RNText style={styles.heroTitle}>Training Journal</RNText>
            <View style={styles.heroStats}>
              <GlassPanel padding={18} style={styles.heroStatCard}>
                <RNText style={styles.heroStatValue}>{state.data.totalSessions}</RNText>
                <RNText style={styles.heroStatLabel}>Sessions</RNText>
              </GlassPanel>
              <GlassPanel padding={18} style={styles.heroStatCard}>
                <RNText style={styles.heroStatValue}>
                  {formatVolumeLabel(state.data.totalVolume)}
                </RNText>
                <RNText style={styles.heroStatLabel}>Volume</RNText>
              </GlassPanel>
              <GlassPanel padding={18} style={styles.heroStatCard}>
                <RNText style={styles.heroStatValue}>{state.data.currentStreak}d</RNText>
                <RNText style={styles.heroStatLabel}>Current Streak</RNText>
              </GlassPanel>
              <GlassPanel padding={18} style={styles.heroStatCard}>
                <RNText style={styles.heroStatValue}>{state.data.bestWeekCount}</RNText>
                <RNText style={styles.heroStatLabel}>{state.data.bestWeekLabel}</RNText>
              </GlassPanel>
            </View>
          </View>

          <GlassPanel padding={20} style={styles.heatmapCard}>
            <View style={styles.heatmapHeader}>
              <RNText style={styles.sectionTitle}>Last 12 Weeks</RNText>
              <RNText style={styles.sectionMeta}>
                {selectedCell
                  ? `${selectedCell.label} • ${formatVolumeLabel(selectedCell.volume)}`
                  : 'Tap a day to inspect volume'}
              </RNText>
            </View>
            <Svg
              width={12 * CELL_SIZE + 11 * CELL_GAP}
              height={7 * CELL_SIZE + 6 * CELL_GAP}
            >
              {state.data.heatmap.map((cell) => (
                <Rect
                  key={cell.key}
                  x={cell.column * (CELL_SIZE + CELL_GAP)}
                  y={cell.row * (CELL_SIZE + CELL_GAP)}
                  rx={6}
                  ry={6}
                  width={CELL_SIZE}
                  height={CELL_SIZE}
                  fill={resolveHeatColor(cell.volume, maxHeatVolume)}
                  onPress={() => setSelectedKey(cell.key)}
                  opacity={selectedCell?.key === cell.key ? 1 : 0.92}
                />
              ))}
            </Svg>
          </GlassPanel>

          {state.data.sections.map((section) => (
            <View key={section.title} style={styles.section}>
              <RNText style={styles.sectionTitle}>{section.title}</RNText>
              <View style={styles.stack}>
                {section.items.map((item) => (
                  <GlassPanel
                    key={item.sessionId}
                    padding={18}
                    onPress={() =>
                      router.push(`/(workouts)/session?id=${item.sessionId}` as never)
                    }
                  >
                    <View style={styles.itemRow}>
                      <View style={styles.itemCopy}>
                        <RNText style={styles.itemTitle}>{item.workoutTitle}</RNText>
                        <RNText style={styles.itemMeta}>
                          {formatDateLabel(item.date)} • {formatMinutesLabel(item.durationMinutes)}
                        </RNText>
                      </View>
                      <View style={styles.itemStats}>
                        <RNText style={styles.itemStatValue}>{item.totalReps} reps</RNText>
                        <RNText style={styles.itemStatMeta}>
                          {item.exercisesCompleted}/{item.exercisesTotal} exercises
                        </RNText>
                      </View>
                      <MaterialSymbol name="chevron_right" size={18} color={WK_ACCENT_LIGHT} />
                    </View>
                  </GlassPanel>
                ))}
              </View>
            </View>
          ))}
        </View>
      )}
    </WorkoutPhaseScreen>
  );
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: 20,
    paddingTop: 24,
    gap: 24,
  },
  hero: {
    gap: 16,
  },
  heroTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.extraBold,
    fontSize: 36,
    lineHeight: 40,
    letterSpacing: -0.8,
  },
  heroStats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  heroStatCard: {
    width: '48%',
    gap: 6,
  },
  heroStatValue: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  heroStatLabel: {
    color: 'rgba(214, 195, 181, 0.68)',
    fontFamily: WK_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heatmapCard: {
    gap: 16,
  },
  heatmapHeader: {
    gap: 4,
  },
  section: {
    gap: 12,
  },
  sectionTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 18,
    lineHeight: 22,
  },
  sectionMeta: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  stack: {
    gap: 10,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  itemCopy: {
    flex: 1,
    gap: 4,
  },
  itemTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 18,
  },
  itemMeta: {
    color: 'rgba(214, 195, 181, 0.72)',
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  itemStats: {
    alignItems: 'flex-end',
    gap: 2,
  },
  itemStatValue: {
    color: WK_ACCENT_LIGHT,
    fontFamily: WK_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 16,
  },
  itemStatMeta: {
    color: 'rgba(214, 195, 181, 0.6)',
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
  },
  emptyTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  errorTitle: {
    color: '#E4E1E9',
    fontFamily: WK_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
});
