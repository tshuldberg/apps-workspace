import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Card, EmptyState, LoadingState, ErrorState, colors, spacing } from '@mylife/ui';
import {
  getActiveMedications,
  getDoseLogsForDate,
  getLowSupplyAlerts,
  getLatestVital,
  getSleepSessions,
  getLastNightSleep,
} from '@mylife/health';
import { useDatabase } from '../../components/DatabaseProvider';

const ACCENT = colors.modules.health;

export default function VitalsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const refresh = useCallback(() => setTick((v) => v + 1), []);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), [tick]);

  // --- Medications ---
  const medications = useMemo(() => {
    try { return getActiveMedications(db); } catch { return []; }
  }, [db, tick]);

  const todayDoses = useMemo(() => {
    try { return getDoseLogsForDate(db, today); } catch { return []; }
  }, [db, tick]);

  const supplyAlerts = useMemo(() => {
    try { return getLowSupplyAlerts(db); } catch { return []; }
  }, [db, tick]);

  // --- Vitals ---
  const latestHR = useMemo(() => {
    try { return getLatestVital(db, 'heart_rate'); } catch { return null; }
  }, [db, tick]);

  const latestRestingHR = useMemo(() => {
    try { return getLatestVital(db, 'resting_heart_rate'); } catch { return null; }
  }, [db, tick]);

  const latestHRV = useMemo(() => {
    try { return getLatestVital(db, 'hrv'); } catch { return null; }
  }, [db, tick]);

  const latestSpO2 = useMemo(() => {
    try { return getLatestVital(db, 'blood_oxygen'); } catch { return null; }
  }, [db, tick]);

  const latestBP = useMemo(() => {
    try { return getLatestVital(db, 'blood_pressure'); } catch { return null; }
  }, [db, tick]);

  const latestTemp = useMemo(() => {
    try { return getLatestVital(db, 'body_temperature'); } catch { return null; }
  }, [db, tick]);

  // --- Sleep ---
  const lastSleep = useMemo(() => {
    try { return getLastNightSleep(db); } catch { return null; }
  }, [db, tick]);

  const recentSleep = useMemo(() => {
    try { return getSleepSessions(db, 7); } catch { return []; }
  }, [db, tick]);

  // --- Activity ---
  const latestSteps = useMemo(() => {
    try { return getLatestVital(db, 'steps'); } catch { return null; }
  }, [db, tick]);

  const latestEnergy = useMemo(() => {
    try { return getLatestVital(db, 'active_energy'); } catch { return null; }
  }, [db, tick]);

  // Suppress lint for unused refresh -- will be wired when dose-log actions are added
  void refresh;

  const pendingMeds = medications.length - todayDoses.length;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Medications */}
      <Text variant="label" color={colors.textSecondary} style={styles.sectionHeader}>
        Medications
      </Text>
      {medications.length > 0 ? (
        <>
          <Card style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flex1}>
                <Text variant="subheading">
                  {todayDoses.length}/{medications.length} doses
                </Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {pendingMeds > 0
                    ? `${pendingMeds} remaining today`
                    : 'All doses taken'}
                </Text>
              </View>
              <View style={[styles.adherenceRing, pendingMeds === 0 && styles.adherenceComplete]}>
                <Text variant="label" color={pendingMeds === 0 ? ACCENT : colors.text}>
                  {medications.length > 0
                    ? `${Math.round((todayDoses.length / medications.length) * 100)}%`
                    : '--'}
                </Text>
              </View>
            </View>
          </Card>
          {medications.slice(0, 5).map((med) => (
            <Card key={med.id} style={styles.card}>
              <Pressable
                style={styles.medRow}
                onPress={() => router.push(`/(health)/med-detail?id=${med.id}` as never)}
              >
                <Text variant="body">{med.name}</Text>
                <Text variant="caption" color={colors.textSecondary}>
                  {med.dosage} {med.unit ?? ''}
                </Text>
              </Pressable>
            </Card>
          ))}
          {supplyAlerts.length > 0 && (
            <Card style={styles.card}>
              <Text variant="caption" color={colors.danger}>
                {supplyAlerts.length} medication{supplyAlerts.length === 1 ? '' : 's'} running low
              </Text>
            </Card>
          )}
          <Pressable
            style={styles.addLink}
            onPress={() => router.push('/(health)/add-med' as never)}
          >
            <Text variant="caption" color={ACCENT}>+ Add Medication</Text>
          </Pressable>
        </>
      ) : (
        <EmptyState
          icon="💊"
          title="No Active Medications"
          actionLabel="+ Add Medication"
          onAction={() => router.push('/(health)/add-med' as never)}
          accentColor={ACCENT}
        />
      )}

      {/* Body Vitals */}
      <Text variant="label" color={colors.textSecondary} style={styles.sectionHeader}>
        Body
      </Text>
      <View style={styles.vitalsGrid}>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>Heart Rate</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestHR ? `${Math.round(latestHR.value)}` : '--'}
          </Text>
          {latestHR && (
            <Text variant="caption" color={colors.textSecondary}>
              bpm{latestHR.source === 'apple_health' ? ' \u00B7 \u{2764}\u{FE0F}' : ''}
            </Text>
          )}
        </Card>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>Resting HR</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestRestingHR ? `${Math.round(latestRestingHR.value)}` : '--'}
          </Text>
          {latestRestingHR && (
            <Text variant="caption" color={colors.textSecondary}>
              bpm{latestRestingHR.source === 'apple_health' ? ' \u00B7 \u{2764}\u{FE0F}' : ''}
            </Text>
          )}
        </Card>
      </View>
      <View style={styles.vitalsGrid}>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>HRV</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestHRV ? `${Math.round(latestHRV.value)}` : '--'}
          </Text>
          {latestHRV && (
            <Text variant="caption" color={colors.textSecondary}>
              ms{latestHRV.source === 'apple_health' ? ' \u00B7 \u{2764}\u{FE0F}' : ''}
            </Text>
          )}
        </Card>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>SpO2</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestSpO2 ? `${Math.round(latestSpO2.value)}%` : '--'}
          </Text>
          {latestSpO2?.source === 'apple_health' && (
            <Text variant="caption" color={colors.textTertiary}>{'\u{2764}\u{FE0F}'} Apple Health</Text>
          )}
        </Card>
      </View>
      <View style={styles.vitalsGrid}>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>Blood Pressure</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestBP
              ? `${Math.round(latestBP.value)}/${Math.round(latestBP.value_secondary ?? 0)}`
              : '--'}
          </Text>
          {latestBP && (
            <Text variant="caption" color={colors.textSecondary}>
              mmHg{latestBP.source === 'apple_health' ? ' \u00B7 \u{2764}\u{FE0F}' : ''}
            </Text>
          )}
        </Card>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>Temperature</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestTemp ? `${latestTemp.value.toFixed(1)}` : '--'}
          </Text>
          {latestTemp && (
            <Text variant="caption" color={colors.textSecondary}>
              {latestTemp.unit}{latestTemp.source === 'apple_health' ? ' \u00B7 \u{2764}\u{FE0F}' : ''}
            </Text>
          )}
        </Card>
      </View>
      <Pressable
        style={styles.addLink}
        onPress={() => router.push('/(health)/measurement-log' as never)}
      >
        <Text variant="caption" color={ACCENT}>+ Log Measurement</Text>
      </Pressable>

      {/* Sleep */}
      <Text variant="label" color={colors.textSecondary} style={styles.sectionHeader}>
        Sleep
      </Text>
      {lastSleep ? (
        <Card style={styles.card}>
          <View style={styles.row}>
            <View style={styles.flex1}>
              <Text variant="subheading">Last Night</Text>
              <Text style={[styles.vitalValue, { color: ACCENT }]}>
                {Math.floor(lastSleep.duration_minutes / 60)}h {lastSleep.duration_minutes % 60}m
              </Text>
            </View>
            {lastSleep.quality_score != null && (
              <View style={styles.qualityBadge}>
                <Text variant="caption" color={colors.textSecondary}>Quality</Text>
                <Text style={[styles.vitalValue, { color: ACCENT }]}>
                  {lastSleep.quality_score}
                </Text>
              </View>
            )}
          </View>
          {(lastSleep.deep_minutes != null || lastSleep.rem_minutes != null) && (
            <View style={styles.sleepStages}>
              {lastSleep.deep_minutes != null && (
                <Text variant="caption" color={colors.textSecondary}>
                  Deep: {lastSleep.deep_minutes}m
                </Text>
              )}
              {lastSleep.rem_minutes != null && (
                <Text variant="caption" color={colors.textSecondary}>
                  REM: {lastSleep.rem_minutes}m
                </Text>
              )}
              {lastSleep.light_minutes != null && (
                <Text variant="caption" color={colors.textSecondary}>
                  Light: {lastSleep.light_minutes}m
                </Text>
              )}
            </View>
          )}
          {lastSleep.source === 'apple_health' && (
            <Text variant="caption" color={colors.textTertiary}>from Apple Health</Text>
          )}
        </Card>
      ) : (
        <EmptyState
          icon="😴"
          title="No Sleep Data"
          message="Sync sleep data from Apple Health to see your sleep summary."
          accentColor={ACCENT}
        />
      )}
      {recentSleep.length > 1 && (
        <Card style={styles.card}>
          <Text variant="caption" color={colors.textSecondary}>
            7-day average:{' '}
            {Math.round(recentSleep.reduce((sum, s) => sum + s.duration_minutes, 0) / recentSleep.length / 60 * 10) / 10}h
          </Text>
        </Card>
      )}

      {/* Activity */}
      <Text variant="label" color={colors.textSecondary} style={styles.sectionHeader}>
        Activity
      </Text>
      <View style={styles.vitalsGrid}>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>Steps</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestSteps ? Math.round(latestSteps.value).toLocaleString() : '--'}
          </Text>
          {latestSteps?.source === 'apple_health' && (
            <Text variant="caption" color={colors.textTertiary}>from Apple Health</Text>
          )}
        </Card>
        <Card style={styles.vitalCard}>
          <Text variant="caption" color={colors.textSecondary}>Active Energy</Text>
          <Text style={[styles.vitalValue, { color: ACCENT }]}>
            {latestEnergy ? `${Math.round(latestEnergy.value)}` : '--'}
          </Text>
          {latestEnergy && (
            <Text variant="caption" color={colors.textSecondary}>
              kcal{latestEnergy.source === 'apple_health' ? ' \u00B7 \u{2764}\u{FE0F}' : ''}
            </Text>
          )}
        </Card>
      </View>
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
  },
  sectionHeader: {
    marginTop: spacing.md,
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  card: {
    marginBottom: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  flex1: {
    flex: 1,
  },
  medRow: {
    gap: spacing.xs,
  },
  adherenceRing: {
    width: 56,
    height: 56,
    borderRadius: 28,
    borderWidth: 3,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adherenceComplete: {
    borderColor: ACCENT,
  },
  addLink: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
  },
  vitalsGrid: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  vitalCard: {
    flex: 1,
    gap: spacing.xs,
  },
  vitalValue: {
    fontSize: 20,
    fontWeight: '700',
  },
  qualityBadge: {
    alignItems: 'center',
  },
  sleepStages: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
});
