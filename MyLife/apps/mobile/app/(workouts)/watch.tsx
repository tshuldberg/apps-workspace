import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import {
  GlassPanel,
  MaterialSymbol,
  WK_ACCENT_LIGHT,
  WK_CATEGORY_COLORS,
  WK_FONTS,
  WK_SURFACES,
  WK_TYPOGRAPHY,
  buildWatchWorkoutSummary,
  getWorkouts,
  isValidWatchMessage,
} from '@mylife/workouts';
import { spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  getWorkoutPhaseOneSettings,
  saveWorkoutPhaseOneSettings,
} from '../../lib/workouts/settings';
import { WorkoutHero, WorkoutPrimaryButton, WorkoutSecondaryButton } from './(tabs)/_screen-kit';

type SyncLogEntry = {
  id: string;
  direction: 'send' | 'receive';
  title: string;
  status: 'success' | 'stub';
  timestamp: string;
};

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function WatchScreen() {
  const db = useDatabase();
  const workouts = useMemo(() => getWorkouts(db, { limit: 8 }), [db]);
  const persistedSettings = useMemo(() => getWorkoutPhaseOneSettings(db), [db]);
  const [settings, setSettings] = useState(persistedSettings);
  const [showHeartRate, setShowHeartRate] = useState(true);
  const [lastSync, setLastSync] = useState<string | null>(null);
  const [syncLog, setSyncLog] = useState<SyncLogEntry[]>([]);

  const latestWorkoutSummary = useMemo(() => {
    const workout = workouts[0];
    if (!workout) return null;

    return buildWatchWorkoutSummary(
      workout.id,
      workout.title,
      workout.difficulty,
      workout.exercises,
      workout.estimatedDuration,
    );
  }, [workouts]);

  const updateSettings = (next: typeof settings) => {
    setSettings(next);
    saveWorkoutPhaseOneSettings(db, next);
  };

  const appendLog = (entry: Omit<SyncLogEntry, 'id' | 'timestamp'>) => {
    setLastSync(new Date().toISOString());
    setSyncLog((current) => [
      {
        ...entry,
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 8));
  };

  const handleSyncNow = () => {
    appendLog({
      direction: 'send',
      title: latestWorkoutSummary
        ? `Queued ${latestWorkoutSummary.title}`
        : 'Queued settings payload',
      status: 'stub',
    });
  };

  const handleReceiveSample = () => {
    const valid = isValidWatchMessage({ type: 'gps_points', routeId: 'sample', points: [] });
    appendLog({
      direction: 'receive',
      title: valid ? 'Validated sample watch payload' : 'Rejected sample watch payload',
      status: valid ? 'success' : 'stub',
    });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <WorkoutHero
        eyebrow="Companion Surface"
        title="Watch Sync"
        subtitle="Manage a stubbed watch transport, keep settings mirrored, and preview which workouts are ready to send."
        accent={WK_ACCENT_LIGHT}
        action={
          <View style={styles.statusPill}>
            <MaterialSymbol name="watch" size={16} color={WK_ACCENT_LIGHT} />
            <Text style={styles.statusPillText}>Stubbed</Text>
          </View>
        }
      />

      <GlassPanel style={styles.heroPanel} intensity={50}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.sectionLabel}>Connection Status</Text>
            <Text style={styles.heroTitle}>Watch transport not connected</Text>
            <Text style={styles.helperCopy}>
              The workspace does not have a live WatchConnectivity bridge, so this screen runs in stub mode and still persists your sync preferences.
            </Text>
          </View>
          <View style={styles.watchBadge}>
            <MaterialSymbol name="watch" size={22} color={WK_ACCENT_LIGHT} />
          </View>
        </View>

        <View style={styles.metaRow}>
          <Text style={styles.metaLabel}>Last sync</Text>
          <Text style={styles.metaValue}>{lastSync ? formatTimestamp(lastSync) : 'Never'}</Text>
        </View>
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Sync Settings</Text>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.settingTitle}>Auto-sync workouts</Text>
            <Text style={styles.settingHint}>Queue sessions for the watch whenever GPS tracking is enabled.</Text>
          </View>
          <Switch
            value={settings.gpsTrackingEnabled}
            onValueChange={(value) => updateSettings({ ...settings, gpsTrackingEnabled: value })}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(255, 184, 119, 0.36)' }}
            thumbColor="#F4EEE8"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.settingTitle}>Rest timer alerts</Text>
            <Text style={styles.settingHint}>Mirror the rest timer countdown as a watch-side nudge.</Text>
          </View>
          <Switch
            value={settings.restTimerAlerts}
            onValueChange={(value) => updateSettings({ ...settings, restTimerAlerts: value })}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(255, 184, 119, 0.36)' }}
            thumbColor="#F4EEE8"
          />
        </View>

        <View style={styles.settingRow}>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.settingTitle}>Show heart rate</Text>
            <Text style={styles.settingHint}>Reserved for a future live transport. Kept local for now.</Text>
          </View>
          <Switch
            value={showHeartRate}
            onValueChange={setShowHeartRate}
            trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(48, 209, 88, 0.36)' }}
            thumbColor="#F4EEE8"
          />
        </View>
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Ready To Send</Text>
        {latestWorkoutSummary ? (
          <View style={styles.summaryRow}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.settingTitle}>{latestWorkoutSummary.title}</Text>
              <Text style={styles.settingHint}>
                {latestWorkoutSummary.exercises.length} exercises • {Math.round(latestWorkoutSummary.estimatedDurationSeconds / 60)} min
              </Text>
            </View>
            <View style={styles.summaryPill}>
              <Text style={styles.summaryPillText}>{workouts.length} queued</Text>
            </View>
          </View>
        ) : (
          <Text style={styles.helperCopy}>
            Build at least one workout in MyWorkouts to create a watch payload preview.
          </Text>
        )}

        <View style={styles.actionsRow}>
          <WorkoutPrimaryButton label="Sync Now" icon="download" onPress={handleSyncNow} />
          <WorkoutSecondaryButton label="Receive Sample" icon="arrow_forward" onPress={handleReceiveSample} />
        </View>
      </GlassPanel>

      <GlassPanel style={styles.panel}>
        <Text style={styles.sectionLabel}>Sync Activity</Text>
        {syncLog.map((entry) => (
          <View key={entry.id} style={styles.logRow}>
            <View style={[styles.logIcon, { backgroundColor: entry.direction === 'send' ? 'rgba(255, 184, 119, 0.14)' : 'rgba(48, 209, 88, 0.14)' }]}>
              <MaterialSymbol
                name={entry.direction === 'send' ? 'arrow_forward' : 'check_circle'}
                size={16}
                color={entry.direction === 'send' ? WK_ACCENT_LIGHT : WK_CATEGORY_COLORS.recovery}
              />
            </View>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.settingTitle}>{entry.title}</Text>
              <Text style={styles.settingHint}>{formatTimestamp(entry.timestamp)}</Text>
            </View>
            <Text style={styles.logStatus}>{entry.status}</Text>
          </View>
        ))}
        {!syncLog.length ? (
          <Text style={styles.helperCopy}>
            Trigger a send or receive action to populate the watch activity log.
          </Text>
        ) : null}
      </GlassPanel>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: WK_SURFACES.lowest,
  },
  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
    gap: spacing.lg,
  },
  heroPanel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.high,
  },
  panel: {
    gap: spacing.md,
    backgroundColor: WK_SURFACES.low,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  sectionLabel: {
    ...WK_TYPOGRAPHY.labelUpper,
    color: 'rgba(214, 195, 181, 0.68)',
  },
  heroTitle: {
    fontFamily: WK_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
    color: '#FFF3E7',
  },
  helperCopy: {
    fontFamily: WK_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
    color: 'rgba(214, 195, 181, 0.66)',
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  statusPillText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: WK_ACCENT_LIGHT,
  },
  watchBadge: {
    width: 58,
    height: 58,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    borderRadius: 18,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  metaLabel: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: 'rgba(214, 195, 181, 0.56)',
  },
  metaValue: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 14,
    color: '#FFF3E7',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  settingTitle: {
    fontFamily: WK_FONTS.semiBold,
    fontSize: 15,
    color: '#F4EEE8',
  },
  settingHint: {
    fontFamily: WK_FONTS.regular,
    fontSize: 12,
    lineHeight: 16,
    color: 'rgba(214, 195, 181, 0.62)',
  },
  summaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  summaryPill: {
    borderRadius: 999,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    backgroundColor: 'rgba(48, 209, 88, 0.16)',
  },
  summaryPillText: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: WK_CATEGORY_COLORS.recovery,
  },
  actionsRow: {
    gap: spacing.md,
  },
  logRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderRadius: 20,
    padding: spacing.md,
    backgroundColor: WK_SURFACES.mid,
  },
  logIcon: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logStatus: {
    fontFamily: WK_FONTS.medium,
    fontSize: 12,
    color: WK_ACCENT_LIGHT,
    textTransform: 'capitalize',
  },
});
