import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import {
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  calculateAgeOfMoney,
  calculateAoMTrend,
  createAoMSnapshot,
  getAoMStatus,
  getRecentAoMSnapshots,
  listTransactions,
  type AoMSnapshot,
  type BudgetTransaction,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  BudgetActionButton,
  BudgetChip,
  BudgetEmptyState,
  BudgetHeroCard,
  BudgetMetricCard,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetSection,
} from '../../components/budget/BudgetPhase5Kit';

type TrendPoint = {
  date: string;
  value: number;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function statusLabel(status: 'urgent' | 'improving' | 'healthy'): string {
  if (status === 'healthy') return 'Healthy';
  if (status === 'improving') return 'Improving';
  return 'At Risk';
}

function statusTone(status: 'urgent' | 'improving' | 'healthy'): 'danger' | 'gold' | 'money' {
  if (status === 'healthy') return 'money';
  if (status === 'improving') return 'gold';
  return 'danger';
}

function buildLinePath(points: TrendPoint[], width: number, height: number): string {
  if (points.length === 0) {
    return '';
  }

  const minValue = Math.min(...points.map((point) => point.value));
  const maxValue = Math.max(...points.map((point) => point.value));
  const range = Math.max(maxValue - minValue, 1);

  return points
    .map((point, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - ((point.value - minValue) / range) * (height - 24) - 12;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

export default function AgeOfMoneyScreen() {
  const db = useDatabase();

  const [ageDays, setAgeDays] = useState<number | null>(null);
  const [sampleSize, setSampleSize] = useState(0);
  const [isEstimate, setIsEstimate] = useState(false);
  const [snapshots, setSnapshots] = useState<AoMSnapshot[]>([]);
  const [todaySaved, setTodaySaved] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    try {
      const currentTransactions = listTransactions(db, { limit: 2000 });
      const result = calculateAgeOfMoney(
        currentTransactions.map((transaction: BudgetTransaction) => ({
          amount: transaction.amount,
          direction: transaction.direction as 'inflow' | 'outflow' | 'transfer',
          occurredOn: transaction.occurred_on,
        })),
        todayIso(),
      );

      setAgeDays(result?.ageDays ?? null);
      setSampleSize(result?.sampleSize ?? 0);
      setIsEstimate(result?.isEstimate ?? false);

      const recentSnapshots = getRecentAoMSnapshots(db, 30);
      setSnapshots(recentSnapshots);
      setTodaySaved(recentSnapshots.some((snapshot) => snapshot.date === todayIso()));
    } finally {
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const status = useMemo(
    () => (ageDays === null ? null : getAoMStatus(ageDays)),
    [ageDays],
  );

  const displaySnapshots = useMemo(() => {
    const points = [...snapshots]
      .sort((left, right) => left.date.localeCompare(right.date))
      .map((snapshot) => ({ date: snapshot.date, value: snapshot.age_days }));

    if (ageDays !== null && !points.some((point) => point.date === todayIso())) {
      points.push({ date: todayIso(), value: ageDays });
    }

    return points.slice(-12);
  }, [ageDays, snapshots]);

  const trend = useMemo(() => {
    if (ageDays === null) {
      return null;
    }

    const previous = [...snapshots]
      .sort((left, right) => right.date.localeCompare(left.date))
      .find((snapshot) => snapshot.date !== todayIso());

    return calculateAoMTrend(ageDays, previous?.age_days ?? null);
  }, [ageDays, snapshots]);

  const trendPath = useMemo(() => buildLinePath(displaySnapshots, 300, 170), [displaySnapshots]);

  const handleSaveSnapshot = useCallback(() => {
    if (ageDays === null || todaySaved) {
      return;
    }

    try {
      createAoMSnapshot(db, {
        age_days: ageDays,
        date: todayIso(),
        sample_size: sampleSize,
      });
      load();
    } catch {
      setTodaySaved(false);
    }
  }, [ageDays, db, load, sampleSize, todaySaved]);

  const tips = useMemo(() => {
    if (status === 'healthy') {
      return [
        'Keep one month of fixed bills sitting in checking before you spend them.',
        'Let windfalls land in a buffer envelope before assigning them elsewhere.',
        'Review subscription renewals before they hit so your buffer stays intact.',
      ];
    }
    if (status === 'improving') {
      return [
        'Push non-urgent discretionary spending to the second half of the month.',
        'Send irregular income to holding envelopes before allocating it broadly.',
        'Trim low-value subscriptions and short-term leaks while the buffer grows.',
      ];
    }
    return [
      'Cover fixed bills with a dedicated buffer envelope first.',
      'Pause non-essential renewals until age of money clears two weeks.',
      'Use the checklist and reports screens to spot overspends early this month.',
    ];
  }, [status]);

  const refreshControl = (
    <RefreshControl
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      refreshing={refreshing}
      tintColor={BG_TEXT}
    />
  );

  return (
    <BudgetPhaseScreen refreshControl={refreshControl}>
      <BudgetPhaseHeader
        eyebrow="Reports"
        eyebrowIcon="monitoring"
        subtitle="Age of Money tracks how long dollars sit before they leave your accounts."
        title="Age of Money"
      />

      {ageDays !== null && status ? (
        <>
          <BudgetHeroCard
            detail={
              trend && trend.direction !== 'flat'
                ? `${trend.direction === 'up' ? '+' : ''}${trend.change} days versus the previous snapshot`
                : 'No trend change from the last snapshot'
            }
            footer={<BudgetChip active label={statusLabel(status)} tone={statusTone(status)} />}
            subtitle={isEstimate ? 'Estimate based on recent outflows' : 'Computed from the latest FIFO sample'}
            title="Current age"
            value={`${ageDays} days`}
          />

          <View style={styles.metricRow}>
            <BudgetMetricCard
              caption="Recent outflows used in the calculation"
              label="Sample size"
              tone="info"
              value={String(sampleSize)}
            />
            <BudgetMetricCard
              caption={todaySaved ? 'Saved for today' : 'Snapshot not saved yet'}
              label="Snapshot"
              tone={todaySaved ? 'money' : 'gold'}
              value={todaySaved ? 'Captured' : 'Pending'}
            />
            <BudgetMetricCard
              caption="Practical buffer target"
              label="Target"
              tone="money"
              value="30 days"
            />
          </View>

          <BudgetSection
            action={
              <BudgetActionButton
                icon="save"
                label={todaySaved ? 'Saved today' : 'Capture today'}
                onPress={handleSaveSnapshot}
                quiet
                tone="gold"
              />
            }
            subtitle="Recent snapshots, with today injected into the line when it has not been saved yet."
            title="Trend"
          >
            {displaySnapshots.length > 1 ? (
              <GlassCard padding={20}>
                <Svg height={170} width={300}>
                  <Path
                    d={trendPath}
                    fill="none"
                    stroke={statusTone(status) === 'money' ? '#22C55E' : statusTone(status) === 'gold' ? '#FFB877' : '#FFB4AB'}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={4}
                  />
                  {displaySnapshots.map((point, index) => {
                    const minValue = Math.min(...displaySnapshots.map((item) => item.value));
                    const maxValue = Math.max(...displaySnapshots.map((item) => item.value));
                    const range = Math.max(maxValue - minValue, 1);
                    const x = (index / Math.max(displaySnapshots.length - 1, 1)) * 300;
                    const y = 170 - ((point.value - minValue) / range) * (170 - 24) - 12;
                    return (
                      <Circle
                        cx={x}
                        cy={y}
                        fill={BG_SURFACES.base}
                        key={point.date}
                        r={5}
                        stroke={statusTone(status) === 'money' ? '#22C55E' : statusTone(status) === 'gold' ? '#FFB877' : '#FFB4AB'}
                        strokeWidth={3}
                      />
                    );
                  })}
                </Svg>
                <View style={styles.snapshotRow}>
                  {displaySnapshots.map((point) => (
                    <View key={point.date} style={styles.snapshotLabel}>
                      <Text style={styles.snapshotDate}>{formatDate(point.date)}</Text>
                      <Text style={styles.snapshotValue}>{point.value}d</Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            ) : (
              <BudgetEmptyState
                icon="timeline"
                message="Capture a few days of snapshots to unlock the AoM trend line."
                title="Trend line pending"
              />
            )}
          </BudgetSection>

          <BudgetSection
            subtitle="The current result is grounded in real transaction cadence, not a projected forecast."
            title="Breakdown"
          >
            <GlassCard padding={18}>
              <Text style={styles.bodyCopy}>
                Age of Money uses a FIFO queue. Older inflows fund the newest outflows first, then the app averages how old those dollars were when they left.
              </Text>
              <Text style={styles.bodyCopy}>
                This run used {sampleSize} recent outflows{isEstimate ? ' and is marked as an estimate because there were fewer than ten recent samples.' : '.'}
              </Text>
            </GlassCard>
          </BudgetSection>

          <BudgetSection subtitle="Practical moves that usually improve this metric fastest." title="Tips">
            <View style={styles.tipColumn}>
              {tips.map((tip) => (
                <GlassCard key={tip} padding={16}>
                  <Text style={styles.tipText}>{tip}</Text>
                </GlassCard>
              ))}
            </View>
          </BudgetSection>
        </>
      ) : (
        <BudgetEmptyState
          icon="payments"
          message="We need both inflows and outflows before MyBudget can calculate your buffer age."
          title="Not enough data yet"
        />
      )}
    </BudgetPhaseScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  snapshotRow: {
    marginTop: 12,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  snapshotLabel: {
    minWidth: 60,
    gap: 2,
  },
  snapshotDate: {
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 15,
    color: BG_TEXT_TERTIARY,
  },
  snapshotValue: {
    fontFamily: BG_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT,
  },
  bodyCopy: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
    marginBottom: 10,
  },
  tipColumn: {
    gap: 10,
  },
  tipText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
});
