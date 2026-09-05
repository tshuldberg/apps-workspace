import { useCallback, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import Svg, { Circle, Polyline, Rect } from 'react-native-svg';
import {
  GlassCard,
  MaterialSymbol,
  RecordingCard,
  SectionHeader,
  TR_ACCENT,
  TR_ACCENT_GLOW,
  TR_ACCENT_LIGHT,
  TR_SURFACES,
  TR_TEXT,
  TR_TEXT_SECONDARY,
  TR_TEXT_TERTIARY,
  TR_TYPOGRAPHY,
  deleteRecording,
  formatDuration,
  withAlpha,
  type ActivityType,
} from '@mylife/trails';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  getRecordingModels,
  getRecordingSummary,
  getRecordingTrend,
  groupRecordingsByMonth,
  type RecordingPeriod,
} from '../phase1-data';

const ACTIVITY_FILTERS: Array<ActivityType | 'all'> = ['all', 'hike', 'run', 'bike', 'walk'];
const PERIODS: RecordingPeriod[] = ['week', 'month', 'year'];
const SORT_OPTIONS = ['date', 'distance', 'elevation', 'duration'] as const;

export default function RecordingsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const [tick, setTick] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [period, setPeriod] = useState<RecordingPeriod>('month');
  const [activityFilter, setActivityFilter] = useState<ActivityType | 'all'>('all');
  const [sortMode, setSortMode] = useState<(typeof SORT_OPTIONS)[number]>('date');

  useFocusEffect(
    useCallback(() => {
      setTick((value) => value + 1);
    }, []),
  );

  const recordings = useMemo(() => {
    try {
      return getRecordingModels(db, 240);
    } catch (error) {
      console.error('[MyTrails] failed to build recordings tab', error);
      return [];
    }
  }, [db, tick]);

  const filteredRecordings = useMemo(() => {
    const base =
      activityFilter === 'all'
        ? recordings
        : recordings.filter((recording) => recording.activityType === activityFilter);

    return base.slice().sort((left, right) => {
      if (sortMode === 'distance') {
        return right.distanceMeters - left.distanceMeters;
      }
      if (sortMode === 'elevation') {
        return right.elevationGainMeters - left.elevationGainMeters;
      }
      if (sortMode === 'duration') {
        return right.durationSeconds - left.durationSeconds;
      }
      return (
        new Date(right.startedAt).getTime() -
        new Date(left.startedAt).getTime()
      );
    });
  }, [activityFilter, recordings, sortMode]);

  const summary = useMemo(
    () => getRecordingSummary(filteredRecordings, period),
    [filteredRecordings, period],
  );
  const trendPoints = useMemo(
    () => getRecordingTrend(filteredRecordings, period),
    [filteredRecordings, period],
  );
  const groupedRecordings = useMemo(
    () => groupRecordingsByMonth(filteredRecordings),
    [filteredRecordings],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setTick((value) => value + 1);
    setTimeout(() => setRefreshing(false), 250);
  }, []);

  const handleDelete = useCallback(
    (recordingId: string, recordingName: string) => {
      Alert.alert('Delete Recording', `Delete "${recordingName}"?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteRecording(db, recordingId);
              setTick((value) => value + 1);
            } catch {
              Alert.alert('Delete failed', 'MyTrails could not remove that recording.');
            }
          },
        },
      ]);
    },
    [db],
  );

  const handleShare = useCallback(async (recordingName: string) => {
    try {
      await Share.share({
        message: `Shared from MyTrails: ${recordingName}`,
      });
    } catch (error) {
      console.error('[MyTrails] share failed', error);
    }
  }, []);

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={handleRefresh}
          tintColor={TR_ACCENT}
        />
      }
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.heroCopy}>
        <Text style={styles.eyebrow}>History</Text>
        <Text style={styles.title}>Your Adventures</Text>
        <Text style={styles.subtitle}>
          Monthly rollups, trend lines, and clean access to every trail session you have captured.
        </Text>
      </View>

      <GlassCard style={styles.summaryCard}>
        <View style={styles.periodRow}>
          {PERIODS.map((value) => (
            <PillChip
              key={value}
              label={value.charAt(0).toUpperCase() + value.slice(1)}
              active={period === value}
              onPress={() => setPeriod(value)}
            />
          ))}
        </View>

        <View style={styles.summaryGrid}>
          <SummaryStat
            label="Distance"
            value={(summary.totalDistanceMeters / 1000).toFixed(1)}
            unit="km"
            delta={summary.deltaDistancePct}
          />
          <SummaryStat
            label="Elevation"
            value={Math.round(summary.totalElevationGainMeters)}
            unit="m"
            delta={summary.deltaElevationPct}
          />
          <SummaryStat
            label="Time"
            value={formatDuration(summary.totalDurationSeconds)}
            delta={summary.deltaDurationPct}
          />
          <SummaryStat label="Trails" value={summary.trailCount} />
        </View>
      </GlassCard>

      <GlassCard style={styles.trendCard}>
        <View style={styles.trendHeader}>
          <Text style={styles.sectionTitle}>Trend Charts</Text>
          <Text style={styles.sectionMeta}>Distance + elevation</Text>
        </View>
        <TrendChart points={trendPoints} />
      </GlassCard>

      <View style={styles.filterStack}>
        <FilterRail
          label="Activity"
          values={ACTIVITY_FILTERS}
          activeValue={activityFilter}
          renderLabel={(value) =>
            value === 'all' ? 'All' : value.charAt(0).toUpperCase() + value.slice(1)
          }
          onPress={(value) => setActivityFilter(value as ActivityType | 'all')}
        />
        <FilterRail
          label="Sort"
          values={SORT_OPTIONS}
          activeValue={sortMode}
          renderLabel={(value) =>
            value.charAt(0).toUpperCase() + value.slice(1)
          }
          onPress={(value) => setSortMode(value as (typeof SORT_OPTIONS)[number])}
        />
      </View>

      {filteredRecordings.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <MaterialSymbol name="fiber_manual_record" size={24} color={TR_ACCENT_LIGHT} />
          <Text style={styles.emptyTitle}>No recordings yet</Text>
          <Text style={styles.emptyBody}>
            Start your first trail capture to unlock distance, elevation, and trend history.
          </Text>
          <Pressable onPress={() => router.push('/(trails)/record')} style={styles.inlineButton}>
            <Text style={styles.inlineButtonCopy}>Start Recording</Text>
          </Pressable>
        </GlassCard>
      ) : (
        groupedRecordings.map((group) => (
          <View key={group.label} style={styles.groupSection}>
            <SectionHeader title={group.label} />
            <View style={styles.groupList}>
              {group.items.map((recording) => (
                <GlassCard key={recording.id} style={styles.recordingShell}>
                  <RecordingCard
                    recording={recording}
                    onPress={() =>
                      router.push(`/(trails)/recording/${recording.id}` as `/${string}`)
                    }
                  />
                  <View style={styles.recordingActions}>
                    <Pressable
                      onPress={() => handleShare(recording.name)}
                      style={styles.actionButton}
                    >
                      <Text style={styles.actionCopy}>Share</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => handleDelete(recording.id, recording.name)}
                      style={styles.actionButton}
                    >
                      <Text style={[styles.actionCopy, styles.actionDeleteCopy]}>Delete</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          </View>
        ))
      )}
    </ScrollView>
  );
}

function SummaryStat({
  label,
  value,
  unit,
  delta,
}: {
  label: string;
  value: number | string;
  unit?: string;
  delta?: number | null;
}) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <View style={styles.summaryValueRow}>
        <Text style={styles.summaryValue}>{value}</Text>
        {unit ? <Text style={styles.summaryUnit}>{unit}</Text> : null}
      </View>
      {delta !== undefined && delta !== null ? (
        <Text style={[styles.deltaCopy, { color: delta >= 0 ? TR_ACCENT_LIGHT : '#FFB4AB' }]}>
          {delta >= 0 ? '+' : ''}
          {delta.toFixed(0)}% vs prev
        </Text>
      ) : (
        <Text style={styles.deltaPlaceholder}>No prior period</Text>
      )}
    </View>
  );
}

function TrendChart({
  points,
}: {
  points: Array<{ label: string; distanceKm: number; elevationGainMeters: number }>;
}) {
  const maxDistance = Math.max(...points.map((point) => point.distanceKm), 1);
  const maxElevation = Math.max(...points.map((point) => point.elevationGainMeters), 1);
  const barWidth = 32;
  const gap = 18;
  const chartHeight = 128;

  const linePoints = points.map((point, index) => {
    const x = index * (barWidth + gap) + barWidth / 2;
    const y = chartHeight - (point.elevationGainMeters / maxElevation) * 74 - 18;
    return `${x},${y}`;
  });

  return (
    <View style={styles.chartShell}>
      <Svg
        width="100%"
        height={160}
        viewBox={`0 0 ${points.length * (barWidth + gap)} 160`}
        preserveAspectRatio="none"
      >
        {points.map((point, index) => {
          const height = (point.distanceKm / maxDistance) * 92;
          const x = index * (barWidth + gap);
          const y = chartHeight - height;

          return (
            <Rect
              key={`${point.label}-bar`}
              x={x}
              y={y}
              width={barWidth}
              height={height}
              rx={10}
              fill={withAlpha(TR_ACCENT_LIGHT, 0.3)}
            />
          );
        })}

        <Polyline
          points={linePoints.join(' ')}
          fill="none"
          stroke={TR_ACCENT_GLOW}
          strokeWidth={10}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <Polyline
          points={linePoints.join(' ')}
          fill="none"
          stroke={TR_ACCENT_LIGHT}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((point, index) => {
          const x = index * (barWidth + gap) + barWidth / 2;
          const y = chartHeight - (point.elevationGainMeters / maxElevation) * 74 - 18;

          return (
            <Circle
              key={`${point.label}-dot`}
              cx={x}
              cy={y}
              r={4}
              fill={TR_ACCENT_LIGHT}
            />
          );
        })}
      </Svg>

      <View style={styles.chartLabels}>
        {points.map((point) => (
          <Text key={point.label} style={styles.chartLabel}>
            {point.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

function FilterRail<T extends string>({
  label,
  values,
  activeValue,
  renderLabel,
  onPress,
}: {
  label: string;
  values: readonly T[];
  activeValue: T;
  renderLabel: (value: T) => string;
  onPress: (value: T) => void;
}) {
  return (
    <View style={styles.filterRail}>
      <Text style={styles.filterLabel}>{label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.filterRailContent}>
          {values.map((value) => (
            <PillChip
              key={value}
              label={renderLabel(value)}
              active={activeValue === value}
              onPress={() => onPress(value)}
            />
          ))}
        </View>
      </ScrollView>
    </View>
  );
}

function PillChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.pillChip,
        active ? styles.pillChipActive : null,
      ]}
    >
      <Text style={[styles.pillChipCopy, { color: active ? '#102108' : TR_TEXT_SECONDARY }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: TR_SURFACES.base,
  },
  content: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 140,
    gap: 18,
  },
  heroCopy: {
    gap: 6,
  },
  eyebrow: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  title: {
    ...TR_TYPOGRAPHY.displayLg,
    color: TR_TEXT,
    fontSize: 34,
  },
  subtitle: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_SECONDARY,
    maxWidth: 330,
  },
  summaryCard: {
    gap: 18,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.06),
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
  },
  summaryTile: {
    width: '47%',
    gap: 6,
  },
  summaryLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_TERTIARY,
  },
  summaryValueRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  summaryValue: {
    ...TR_TYPOGRAPHY.statDisplay,
    color: TR_TEXT,
    fontSize: 28,
  },
  summaryUnit: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_SECONDARY,
    marginBottom: 4,
  },
  deltaCopy: {
    ...TR_TYPOGRAPHY.caption,
    fontWeight: '700',
  },
  deltaPlaceholder: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  trendCard: {
    gap: 12,
  },
  trendHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  sectionMeta: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
  },
  chartShell: {
    gap: 6,
  },
  chartLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  chartLabel: {
    ...TR_TYPOGRAPHY.caption,
    color: TR_TEXT_TERTIARY,
    flex: 1,
    textAlign: 'center',
  },
  filterStack: {
    gap: 12,
  },
  filterRail: {
    gap: 8,
  },
  filterLabel: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_TEXT_TERTIARY,
  },
  filterRailContent: {
    flexDirection: 'row',
    gap: 8,
    paddingRight: 16,
  },
  pillChip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: TR_SURFACES.high,
  },
  pillChipActive: {
    backgroundColor: TR_ACCENT_LIGHT,
  },
  pillChipCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
  },
  emptyCard: {
    alignItems: 'flex-start',
    gap: 10,
  },
  emptyTitle: {
    ...TR_TYPOGRAPHY.titleMd,
    color: TR_TEXT,
  },
  emptyBody: {
    ...TR_TYPOGRAPHY.bodyMd,
    color: TR_TEXT_TERTIARY,
  },
  inlineButton: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.16),
  },
  inlineButtonCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  groupSection: {
    gap: 10,
  },
  groupList: {
    gap: 12,
  },
  recordingShell: {
    gap: 12,
  },
  recordingActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
  },
  actionButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: withAlpha(TR_ACCENT_LIGHT, 0.08),
  },
  actionCopy: {
    ...TR_TYPOGRAPHY.labelUpper,
    color: TR_ACCENT_LIGHT,
  },
  actionDeleteCopy: {
    color: '#FFB4AB',
  },
});
