import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { CircadianProfilePoint, SleepEntryRecord } from '@mylife/sleep';
import {
  getChronotypeAssessment,
  getCircadianProfile,
  listEntries,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SLEEP_ACCENT } from '../_ui';

function formatChronotype(value: string | null): string {
  if (!value) {
    return 'Keep logging';
  }

  return value
    .split('_')
    .map((part) => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}

function getPhasePoint(
  points: readonly CircadianProfilePoint[],
  phase: CircadianProfilePoint['phase'],
): CircadianProfilePoint | null {
  return points.find((point) => point.phase === phase) ?? null;
}

export default function SleepChronotypeScreen() {
  const db = useDatabase();
  const [entries, setEntries] = useState<SleepEntryRecord[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadEntries = useCallback(() => {
    setEntries(listEntries(db, { limit: 500 }));
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadEntries();
    }, [loadEntries]),
  );

  const assessment = useMemo(
    () => getChronotypeAssessment(entries),
    [entries],
  );
  const profile = useMemo(() => getCircadianProfile(entries), [entries]);
  const peak = getPhasePoint(profile.points, 'peak');
  const dip = getPhasePoint(profile.points, 'dip');
  const secondWind = getPhasePoint(profile.points, 'secondary_peak');
  const neededEntries = Math.max(
    0,
    assessment.requiredFreeDayEntries - assessment.freeDaySampleSize,
  );

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
        <Text style={styles.title}>Chronotype and circadian rhythm</Text>
        <Text style={styles.body}>
          MySleep estimates your natural rhythm from weekend sleep timing, then maps a simple 24 hour alertness curve from your typical wake time.
        </Text>
      </View>

      <View style={styles.resultCard}>
        <Text style={styles.cardEyebrow}>Chronotype</Text>
        <Text style={styles.resultTitle}>
          {formatChronotype(assessment.chronotype)}
        </Text>
        <Text style={styles.body}>{assessment.description}</Text>
        {assessment.status === 'insufficient_data' ? (
          <Text style={styles.progressText}>
            Log {neededEntries} more weekend or free-day nights to unlock a confident chronotype.
          </Text>
        ) : (
          <Text style={styles.progressText}>
            {assessment.confidence} confidence from {assessment.freeDaySampleSize} free-day nights.
          </Text>
        )}
      </View>

      <View style={styles.metricGrid}>
        <Metric label="Free-day nights" value={String(assessment.freeDaySampleSize)} />
        <Metric label="Median bedtime" value={assessment.medianBedtime ?? '--'} />
        <Metric label="Median wake" value={assessment.medianWakeTime ?? '--'} />
        <Metric label="Midpoint" value={assessment.midpoint ?? '--'} />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Circadian profile</Text>
        <Text style={styles.cardTitle}>
          Typical wake time {profile.recommendedWakeTime}
        </Text>
        <View style={styles.phaseList}>
          <PhaseRow label="Peak" point={peak} />
          <PhaseRow label="Dip" point={dip} />
          <PhaseRow label="Second wind" point={secondWind} />
        </View>
      </View>
    </ScrollView>
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

function PhaseRow({
  label,
  point,
}: {
  label: string;
  point: CircadianProfilePoint | null;
}) {
  return (
    <View style={styles.phaseRow}>
      <Text style={styles.phaseLabel}>{label}</Text>
      <Text style={styles.phaseValue}>
        {point ? `${point.clockTime} (${point.alertness}/100)` : '--'}
      </Text>
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
  resultCard: {
    gap: 10,
    padding: 20,
    borderRadius: 22,
    backgroundColor: 'rgba(167,139,250,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.30)',
  },
  card: {
    gap: 12,
    padding: 18,
    borderRadius: 20,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
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
  cardTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: '700',
  },
  progressText: {
    color: '#E9DDFF',
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
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
  phaseList: {
    gap: 10,
  },
  phaseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  phaseLabel: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  phaseValue: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: '700',
  },
});
