import { useCallback, useMemo, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import type { NapRecord, SleepEntryRecord } from '@mylife/sleep';
import {
  formatDurationLabel,
  getNapSummary,
  listEntries,
  listNaps,
} from '@mylife/sleep';
import { colors, surfaceTiers } from '@mylife/ui';
import { useDatabase } from '../../../components/DatabaseProvider';
import { SLEEP_ACCENT } from '../_ui';

interface NapHistoryState {
  naps: NapRecord[];
  entries: SleepEntryRecord[];
}

function formatNapTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value.slice(11, 16);
  }

  return date.toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatNumber(value: number | null): string {
  return typeof value === 'number' ? value.toFixed(1) : '--';
}

export default function SleepNapHistoryScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [state, setState] = useState<NapHistoryState>({
    naps: [],
    entries: [],
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadHistory = useCallback(() => {
    setState({
      naps: listNaps(db, {
        startDate: '1900-01-01',
        endDate: new Date().toISOString().slice(0, 10),
      }),
      entries: listEntries(db, { limit: 500 }),
    });
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [loadHistory]),
  );

  const handleRefresh = useCallback(() => {
    setIsRefreshing(true);
    try {
      loadHistory();
    } finally {
      setIsRefreshing(false);
    }
  }, [loadHistory]);

  const summary = useMemo(
    () => getNapSummary(state.naps, state.entries),
    [state.entries, state.naps],
  );
  const recentNaps = state.naps.slice(0, 20);
  const recentTrend = summary.durationTrend.slice(-7).reverse();

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
        <Text style={styles.eyebrow}>Nap History</Text>
        <Text style={styles.heroTitle}>
          Naps stay separate from overnight sleep.
        </Text>
        <Text style={styles.heroCopy}>
          Track quick rests, accidental dozing, and whether nap days change the
          next morning's quality.
        </Text>
        <View style={styles.ctaRow}>
          <Pressable
            onPress={() => router.push('/(sleep)/nap/log' as never)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonText}>Log Nap</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(sleep)/hygiene' as never)}
            style={styles.secondaryButton}
          >
            <Text style={styles.secondaryButtonText}>Hygiene</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <Metric label="Total naps" value={String(summary.totalNaps)} />
        <Metric
          label="Total rest"
          value={formatDurationLabel(summary.totalMinutes)}
        />
        <Metric
          label="Avg duration"
          value={
            summary.averageDuration
              ? `${Math.round(summary.averageDuration)}m`
              : '--'
          }
        />
        <Metric
          label="Avg quality"
          value={`${formatNumber(summary.averageQuality)}/5`}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Nap impact</Text>
        <Text style={styles.cardTitle}>
          {summary.impactInsight.status === 'reportable'
            ? 'Next-night quality comparison'
            : 'Keep logging to compare'}
        </Text>
        <Text style={styles.cardCopy}>{summary.impactInsight.insight}</Text>
        <View style={styles.statRows}>
          <StatRow
            label="Nap-night sample"
            value={String(summary.impactInsight.napNightSampleSize)}
          />
          <StatRow
            label="Non-nap sample"
            value={String(summary.impactInsight.noNapNightSampleSize)}
          />
          <StatRow
            label="Quality delta"
            value={
              summary.impactInsight.qualityDelta === null
                ? '--'
                : summary.impactInsight.qualityDelta.toFixed(1)
            }
          />
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Duration trend</Text>
        <Text style={styles.cardTitle}>Recent nap days</Text>
        {recentTrend.length > 0 ? (
          <View style={styles.trendList}>
            {recentTrend.map((point) => (
              <StatRow
                key={point.date}
                label={point.date}
                value={`${point.count} nap${point.count === 1 ? '' : 's'} - ${Math.round(point.averageDuration)}m avg`}
              />
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            Log a nap to start the duration trend.
          </Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardEyebrow}>Recent naps</Text>
        <Text style={styles.cardTitle}>{recentNaps.length} loaded</Text>
        {recentNaps.length > 0 ? (
          <View style={styles.napList}>
            {recentNaps.map((nap) => (
              <View key={nap.id} style={styles.napRow}>
                <View style={styles.napMain}>
                  <Text style={styles.napDate}>{nap.date}</Text>
                  <Text style={styles.napMeta}>
                    {formatNapTime(nap.start_time)} - {nap.duration_minutes}m
                  </Text>
                </View>
                <View style={styles.napAside}>
                  <Text style={styles.intentPill}>
                    {nap.intentional ? 'Intentional' : 'Accidental'}
                  </Text>
                  <Text style={styles.qualityPill}>
                    {nap.quality ? `${nap.quality}/5` : 'No quality'}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <Text style={styles.emptyText}>
            No naps yet. The log screen is optimized for a quick first save.
          </Text>
        )}
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

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.statRow}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: surfaceTiers.lowest,
  },
  content: {
    gap: 14,
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 160,
  },
  hero: {
    gap: 10,
    padding: 20,
    borderRadius: 24,
    backgroundColor: 'rgba(167,139,250,0.11)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.26)',
  },
  eyebrow: {
    color: SLEEP_ACCENT,
    fontSize: 12,
    fontWeight: '800',
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
  ctaRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  primaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: SLEEP_ACCENT,
  },
  primaryButtonText: {
    color: '#0E0E13',
    fontSize: 14,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 46,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: surfaceTiers.low,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricCard: {
    flexGrow: 1,
    flexBasis: '45%',
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
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  metricValue: {
    color: colors.text,
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '800',
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
    color: SLEEP_ACCENT,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  cardTitle: {
    color: colors.text,
    fontSize: 19,
    lineHeight: 24,
    fontWeight: '800',
  },
  cardCopy: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
  statRows: {
    gap: 8,
  },
  trendList: {
    gap: 8,
  },
  statRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 6,
  },
  statLabel: {
    flex: 1,
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 19,
  },
  statValue: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  napList: {
    gap: 10,
  },
  napRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  napMain: {
    flex: 1,
    gap: 4,
  },
  napDate: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  napMeta: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  napAside: {
    alignItems: 'flex-end',
    gap: 6,
  },
  intentPill: {
    color: '#E9DDFF',
    fontSize: 12,
    fontWeight: '800',
  },
  qualityPill: {
    color: colors.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  emptyText: {
    color: colors.textSecondary,
    fontSize: 14,
    lineHeight: 20,
  },
});
