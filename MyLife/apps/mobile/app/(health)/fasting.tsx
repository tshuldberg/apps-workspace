import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, Card, EmptyState, LoadingState, ErrorState, colors, spacing } from '@mylife/ui';
import {
  getActiveFast,
  startFast,
  endFast,
  getProtocols,
  listFasts,
  getStreaks,
  getWaterIntake,
  incrementWaterIntake,
  getSetting,
  type ActiveFast,
} from '@mylife/fast';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.health;

function formatElapsed(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

/**
 * Fasting tab -- the FREE section of MyHealth.
 * Renders the fasting timer, protocol selector, water intake, and history.
 * This tab is always accessible without a subscription.
 */
export default function FastingScreen() {
  const db = useDatabase();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [selectedProtocol, setSelectedProtocol] = useState<string | null>(null);

  const activeFast = useMemo(() => {
    try { return getActiveFast(db); } catch { return null; }
  }, [db, tick]) as ActiveFast | null;

  const protocols = useMemo(() => {
    try { return getProtocols(db); } catch { return []; }
  }, [db]);

  const recentFasts = useMemo(() => {
    try { return listFasts(db, { limit: 5 }); } catch { return []; }
  }, [db, tick]);

  const streaks = useMemo(() => {
    try { return getStreaks(db); } catch { return { currentStreak: 0, longestStreak: 0, totalFasts: 0 }; }
  }, [db, tick]);

  const waterData = useMemo(() => {
    try { return getWaterIntake(db, new Date()); } catch { return null; }
  }, [db, tick]);

  const waterCount = waterData?.count ?? 0;
  const waterTarget = useMemo(() => {
    try {
      const val = getSetting(db, 'waterDailyTarget');
      return val ? Number(val) : 8;
    } catch { return 8; }
  }, [db]);

  // Default selected protocol
  useEffect(() => {
    if (!selectedProtocol && protocols.length > 0) {
      setSelectedProtocol(protocols[0].id);
    }
  }, [protocols, selectedProtocol]);

  // Timer tick
  useEffect(() => {
    if (activeFast) {
      const update = () => {
        const start = new Date(activeFast.startedAt).getTime();
        setElapsed(Date.now() - start);
      };
      update();
      intervalRef.current = setInterval(update, 1000);
      return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
      };
    } else {
      setElapsed(0);
    }
  }, [activeFast]);

  const handleStart = () => {
    const protocol = protocols.find((p) => p.id === selectedProtocol);
    if (!protocol) return;

    try {
      const id = `fast_${Date.now()}`;
      startFast(db, id, protocol.id, protocol.fasting_hours);
      refresh();
    } catch { /* ignore */ }
  };

  const handleStop = () => {
    try {
      endFast(db, new Date());
      refresh();
    } catch { /* ignore */ }
  };

  const handleAddWater = () => {
    try {
      incrementWaterIntake(db, 1, new Date());
      refresh();
    } catch { /* ignore */ }
  };

  const targetMs = activeFast ? activeFast.targetHours * 3600 * 1000 : 0;
  const progress = targetMs > 0 ? Math.min(1, elapsed / targetMs) : 0;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Timer */}
      <Card style={styles.timerCard}>
        <Text variant="heading" style={styles.timerText}>
          {formatElapsed(elapsed)}
        </Text>
        {activeFast ? (
          <>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.round(progress * 100)}%` },
                ]}
              />
            </View>
            <Text variant="caption" color={colors.textSecondary}>
              {activeFast.protocol} -- {activeFast.targetHours}h target
            </Text>
            <Pressable style={styles.stopButton} onPress={handleStop}>
              <Text variant="label" color={colors.background}>End Fast</Text>
            </Pressable>
          </>
        ) : (
          <>
            {/* Protocol selector */}
            <View style={styles.protocolRow}>
              {protocols.map((p) => (
                <Pressable
                  key={p.id}
                  style={[
                    styles.protocolChip,
                    selectedProtocol === p.id && styles.protocolChipActive,
                  ]}
                  onPress={() => setSelectedProtocol(p.id)}
                >
                  <Text
                    variant="caption"
                    color={selectedProtocol === p.id ? colors.background : colors.text}
                  >
                    {p.name}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Pressable style={styles.startButton} onPress={handleStart}>
              <Text variant="label" color={colors.background}>Start Fast</Text>
            </Pressable>
          </>
        )}
      </Card>

      {/* Water Intake */}
      <Card style={styles.card}>
        <View style={styles.waterRow}>
          <View>
            <Text variant="subheading">Water Intake</Text>
            <Text variant="caption" color={colors.textSecondary}>
              {waterCount} / {waterTarget} glasses
            </Text>
          </View>
          <Pressable style={styles.waterButton} onPress={handleAddWater}>
            <Text variant="label" color={ACCENT}>+ Water</Text>
          </Pressable>
        </View>
        <View style={styles.progressTrack}>
          <View
            style={[
              styles.progressFill,
              { width: `${Math.min(100, Math.round((waterCount / waterTarget) * 100))}%` },
            ]}
          />
        </View>
      </Card>

      {/* Streaks */}
      <View style={styles.metricsGrid}>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Current Streak</Text>
          <Text style={[styles.metricValue, { color: ACCENT }]}>
            {streaks.currentStreak}
          </Text>
        </Card>
        <Card style={styles.metricCard}>
          <Text variant="caption" color={colors.textSecondary}>Longest Streak</Text>
          <Text style={[styles.metricValue, { color: ACCENT }]}>
            {streaks.longestStreak}
          </Text>
        </Card>
      </View>

      {/* Recent Fasts */}
      <Card style={styles.card}>
        <Text variant="subheading">Recent Fasts</Text>
        {recentFasts.length === 0 ? (
          <Text variant="caption" color={colors.textSecondary}>
            No fasts recorded yet
          </Text>
        ) : (
          recentFasts.map((fast) => (
            <View key={fast.id} style={styles.historyRow}>
              <Text variant="body">{fast.protocol}</Text>
              <Text variant="caption" color={colors.textSecondary}>
                {fast.startedAt.slice(0, 10)}
              </Text>
            </View>
          ))
        )}
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
    paddingBottom: spacing.xxl,
    gap: spacing.sm,
  },
  timerCard: {
    alignItems: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  timerText: {
    fontSize: 48,
    fontVariant: ['tabular-nums'],
  },
  progressTrack: {
    width: '100%',
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.surfaceElevated,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 4,
    backgroundColor: ACCENT,
  },
  protocolRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  protocolChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
  },
  protocolChipActive: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  startButton: {
    backgroundColor: ACCENT,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  stopButton: {
    backgroundColor: colors.danger,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.sm,
    borderRadius: 8,
  },
  card: {
    gap: spacing.sm,
  },
  waterRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  waterButton: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: ACCENT,
    borderRadius: 8,
  },
  metricsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    gap: spacing.xs,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
