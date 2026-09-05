import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import type { JetLagTracker, SleepEntryRecord } from '@mylife/sleep';
import {
  createJetLagTracker,
  getAdjustmentProgress,
  getRecommendation,
  listEntries,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SLEEP_ACCENT } from '../_ui';

function todayDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function buildTracker(
  originTimeZone: string,
  destinationTimeZone: string,
  arrivalDate: string,
  targetBedtime: string,
): { tracker: JetLagTracker | null; error: string | null } {
  try {
    return {
      tracker: createJetLagTracker(
        originTimeZone,
        destinationTimeZone,
        arrivalDate,
        targetBedtime,
      ),
      error: null,
    };
  } catch (error) {
    return {
      tracker: null,
      error: error instanceof Error ? error.message : 'Unable to build tracker.',
    };
  }
}

export default function SleepJetLagScreen() {
  const db = useDatabase();
  const [entries, setEntries] = useState<SleepEntryRecord[]>([]);
  const [originTimeZone, setOriginTimeZone] = useState('America/Los_Angeles');
  const [destinationTimeZone, setDestinationTimeZone] =
    useState('America/New_York');
  const [arrivalDate, setArrivalDate] = useState(todayDate());
  const [targetBedtime, setTargetBedtime] = useState('23:00');
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadEntries = useCallback(() => {
    setEntries(listEntries(db, { limit: 90 }));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries]),
  );

  const trackerResult = useMemo(
    () =>
      buildTracker(
        originTimeZone,
        destinationTimeZone,
        arrivalDate,
        targetBedtime,
      ),
    [arrivalDate, destinationTimeZone, originTimeZone, targetBedtime],
  );
  const tracker = trackerResult.tracker;
  const progress = tracker ? getAdjustmentProgress(tracker, entries) : 0;
  const recommendations = tracker
    ? [0, 1, 2, 3].map((day) => ({
        day,
        message: getRecommendation(tracker, day),
      }))
    : [];

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadEntries();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadEntries]);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={(
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={SLEEP_ACCENT}
        />
      )}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>Sleep Science</Text>
        <Text style={styles.title}>Jet lag tracker</Text>
        <Text style={styles.body}>
          Build a local adjustment plan from timezone difference, arrival date, target bedtime, and your recent sleep timing.
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Trip</Text>
        <Field
          label="Origin timezone"
          value={originTimeZone}
          onChangeText={setOriginTimeZone}
        />
        <Field
          label="Destination timezone"
          value={destinationTimeZone}
          onChangeText={setDestinationTimeZone}
        />
        <Field
          label="Arrival date"
          value={arrivalDate}
          onChangeText={setArrivalDate}
        />
        <Field
          label="Target bedtime"
          value={targetBedtime}
          onChangeText={setTargetBedtime}
        />
      </View>

      {tracker ? (
        <>
          <View style={styles.resultCard}>
            <Text style={styles.cardEyebrow}>Adjustment</Text>
            <Text style={styles.resultTitle}>{progress}% adjusted</Text>
            <Text style={styles.body}>
              {tracker.timeZoneDifferenceHours}h {tracker.direction}, about {tracker.estimatedAdjustmentDays} days to adapt.
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, { width: `${progress}%` }]} />
            </View>
          </View>

          <View style={styles.metricGrid}>
            <Metric
              label="Body bedtime"
              value={tracker.bodyAlignedBedtime}
            />
            <Metric
              label="Target"
              value={tracker.targetBedtime}
            />
            <Metric
              label="Daily shift"
              value={`${tracker.dailyAdjustmentHours}h`}
            />
            <Metric
              label="Entries"
              value={String(entries.length)}
            />
          </View>

          <View style={styles.card}>
            <Text style={styles.cardEyebrow}>Tonight plan</Text>
            {recommendations.map((recommendation) => (
              <Text key={recommendation.day} style={styles.recommendation}>
                Day {recommendation.day + 1}: {recommendation.message}
              </Text>
            ))}
          </View>
        </>
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardEyebrow}>Check trip</Text>
          <Text style={styles.body}>{trackerResult.error}</Text>
        </View>
      )}
    </ScrollView>
  );
}

function Field({
  label,
  value,
  onChangeText,
}: {
  label: string;
  value: string;
  onChangeText: (value: string) => void;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        style={styles.input}
      />
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metricCard}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
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
    gap: 10,
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
  title: {
    color: colors.text,
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '800',
  },
  body: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 21,
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  resultCard: {
    gap: 10,
    padding: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
  },
  cardEyebrow: {
    color: '#C4B5FD',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  resultTitle: {
    color: colors.text,
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
  },
  field: {
    gap: 6,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  input: {
    minHeight: 46,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: surfaceTiers.container,
    borderWidth: 1,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 15,
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
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    width: '48%',
    minWidth: 150,
    gap: 6,
    padding: 16,
    borderRadius: 18,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  metricLabel: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  metricValue: {
    color: colors.text,
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '800',
  },
  recommendation: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
  },
});
