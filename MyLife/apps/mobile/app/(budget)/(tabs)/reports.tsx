import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import Svg, { Circle, Polyline } from 'react-native-svg';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  AmountDisplay,
  GlassCard,
  MaterialSymbol,
  PeriodSelector,
  bucketizeCategories,
  exportBudgetTransactionsCsv,
  getSpendingByCategory,
  getTopPayees,
  getTransactions,
  getSplitsByTransaction,
  listEnvelopes,
  type BudgetTransaction,
  type Envelope,
  type PeriodSelectorValue,
  type TransactionSplit,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';

type ChartMonthPoint = {
  label: string;
  income: number;
  month: string;
  spending: number;
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function getDateRange(period: PeriodSelectorValue): { end: string; start: string } {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);

  if (period === 'last_30d') {
    const start = new Date(now);
    start.setDate(start.getDate() - 30);
    return { end: today, start: start.toISOString().slice(0, 10) };
  }

  if (period === 'this_year' || period === 'custom') {
    const year = now.getFullYear();
    return { end: `${year}-12-31`, start: `${year}-01-01` };
  }

  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const lastDay = new Date(year, now.getMonth() + 1, 0).getDate();
  return {
    end: `${year}-${month}-${String(lastDay).padStart(2, '0')}`,
    start: `${year}-${month}-01`,
  };
}

function getLastSixMonths(): string[] {
  const months: string[] = [];
  const today = new Date();

  for (let index = 5; index >= 0; index -= 1) {
    const date = new Date(today.getFullYear(), today.getMonth() - index, 1);
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`);
  }

  return months;
}

function buildMonthSeries(transactions: BudgetTransaction[]): ChartMonthPoint[] {
  const grouped = new Map<string, { income: number; spending: number }>();
  getLastSixMonths().forEach((month) => {
    grouped.set(month, { income: 0, spending: 0 });
  });

  transactions.forEach((transaction) => {
    if (transaction.direction === 'transfer') {
      return;
    }
    const month = transaction.occurred_on.slice(0, 7);
    const current = grouped.get(month);
    if (!current) {
      return;
    }
    if (transaction.direction === 'outflow') {
      current.spending += Math.abs(transaction.amount);
    } else {
      current.income += Math.abs(transaction.amount);
    }
  });

  return [...grouped.entries()].map(([month, value]) => ({
    income: value.income,
    label: new Date(`${month}-01T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
    }),
    month,
    spending: value.spending,
  }));
}

function getCategoryColor(index: number): string {
  return [BG_ACCENT_LIGHT, BG_MONEY, '#8BCFF0', '#A78BFA', '#F59E0B'][index % 5];
}

export default function BudgetReportsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();

  const [period, setPeriod] = useState<PeriodSelectorValue>('this_month');
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [trendTransactions, setTrendTransactions] = useState<BudgetTransaction[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [splits, setSplits] = useState<TransactionSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const range = getDateRange(period);
      const nextTransactions = getTransactions(db, {
        from_date: range.start,
        limit: 1200,
        to_date: range.end,
      });
      const trendRange = getLastSixMonths();
      const trendStart = `${trendRange[0]}-01`;
      const trendEndMonth = trendRange[trendRange.length - 1];
      const trendEndDate = new Date(
        Number(trendEndMonth.slice(0, 4)),
        Number(trendEndMonth.slice(5, 7)),
        0,
      )
        .toISOString()
        .slice(0, 10);
      const nextTrendTransactions = getTransactions(db, {
        from_date: trendStart,
        limit: 2000,
        to_date: trendEndDate,
      });
      const nextEnvelopes = listEnvelopes(db, true);
      const nextSplits = nextTransactions.flatMap((transaction) =>
        getSplitsByTransaction(db, transaction.id),
      );

      setTransactions(nextTransactions);
      setTrendTransactions(nextTrendTransactions);
      setEnvelopes(nextEnvelopes);
      setSplits(nextSplits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load reports.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, period]);

  useEffect(() => {
    load();
  }, [load, params.refresh]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const mappedTransactions = useMemo(
    () =>
      transactions.map((transaction) => ({
        amount:
          transaction.direction === 'outflow'
            ? -Math.abs(transaction.amount)
            : Math.abs(transaction.amount),
        categoryId: transaction.envelope_id,
        date: transaction.occurred_on,
        id: transaction.id,
        isTransfer: transaction.direction === 'transfer',
        payee: transaction.merchant ?? 'Unknown',
      })),
    [transactions],
  );

  const categories = useMemo(
    () =>
      envelopes.map((envelope) => ({
        id: envelope.id,
        name: envelope.name,
      })),
    [envelopes],
  );

  const spendingByCategory = useMemo(
    () =>
      bucketizeCategories(
        getSpendingByCategory(
          mappedTransactions,
          splits.map((split) => ({
            amount: split.amount,
            categoryId: split.envelope_id ?? '',
            transactionId: split.transaction_id,
          })),
          categories,
          getDateRange(period),
        ),
        4,
      ),
    [categories, mappedTransactions, period, splits],
  );

  const incomeTotal = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.direction === 'inflow')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [transactions],
  );

  const expenseTotal = useMemo(
    () =>
      transactions
        .filter((transaction) => transaction.direction === 'outflow')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [transactions],
  );

  const netTotal = incomeTotal - expenseTotal;

  const monthSeries = useMemo(
    () => buildMonthSeries(trendTransactions),
    [trendTransactions],
  );

  const topMerchants = useMemo(
    () => getTopPayees(mappedTransactions, getDateRange(period), 4),
    [mappedTransactions, period],
  );

  const linePoints = useMemo(() => {
    const width = 300;
    const height = 140;
    const padding = 16;
    const values = monthSeries.map((point) => point.spending);
    const maxValue = Math.max(...values, 1);

    return monthSeries
      .map((point, index) => {
        const x = padding + (index / Math.max(monthSeries.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - (point.spending / maxValue) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [monthSeries]);

  const maxBarValue = useMemo(
    () =>
      Math.max(
        ...monthSeries.flatMap((point) => [point.income, point.spending]),
        1,
      ),
    [monthSeries],
  );

  const handleExport = useCallback(async () => {
    try {
      await Share.share({
        message: exportBudgetTransactionsCsv(db),
        title: 'MyBudget Transactions Export',
      });
    } catch (err) {
      Alert.alert(
        'Export failed',
        err instanceof Error ? err.message : 'Unable to export reports right now.',
      );
    }
  }, [db]);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl
          colors={[BG_ACCENT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={BG_ACCENT}
        />
      }
      style={styles.container}
    >
      <View style={styles.header}>
        <PeriodSelector onChange={setPeriod} value={period} />

        {loading ? <Text style={styles.emptyCopy}>Loading report data...</Text> : null}

        <View style={styles.summaryGrid}>
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Income</Text>
            <AmountDisplay cents={incomeTotal} size="lg" type="income" />
          </GlassCard>
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Expenses</Text>
            <AmountDisplay cents={expenseTotal} size="lg" type="expense" />
          </GlassCard>
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Net</Text>
            <AmountDisplay
              cents={netTotal}
              size="lg"
              type={netTotal >= 0 ? 'income' : 'expense'}
            />
          </GlassCard>
          <GlassCard style={styles.summaryCard}>
            <Text style={styles.summaryLabel}>Top Category</Text>
            <Text style={styles.summaryValue}>
              {spendingByCategory[0]?.categoryName ?? 'None yet'}
            </Text>
            <Text style={styles.summaryMeta}>
              {spendingByCategory[0]
                ? formatCurrency(spendingByCategory[0].amount)
                : 'No outflows in range'}
            </Text>
          </GlassCard>
        </View>

        <GlassCard style={styles.chartCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Category Mix</Text>
            <Pressable onPress={handleExport} style={styles.exportChip}>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="receipt_long" size={14} />
              <Text style={styles.exportChipLabel}>Export CSV</Text>
            </Pressable>
          </View>

          {spendingByCategory.length === 0 ? (
            <Text style={styles.emptyCopy}>Spend in a few envelopes to unlock this view.</Text>
          ) : (
            <View style={styles.donutLayout}>
              <View style={styles.donutShell}>
                <Svg height={168} width={168}>
                  <Circle
                    cx={84}
                    cy={84}
                    fill="transparent"
                    r={66}
                    stroke={BG_SURFACES.high}
                    strokeWidth={16}
                  />
                  {(() => {
                    const total = spendingByCategory.reduce((sum, item) => sum + item.amount, 0);
                    let offset = 0;

                    return spendingByCategory.map((item, index) => {
                      const circumference = 2 * Math.PI * 66;
                      const length = total > 0 ? (item.amount / total) * circumference : 0;
                      const dashOffset = circumference - offset;
                      offset += length;
                      return (
                        <Circle
                          key={item.categoryId}
                          cx={84}
                          cy={84}
                          fill="transparent"
                          r={66}
                          stroke={getCategoryColor(index)}
                          strokeDasharray={`${Math.max(length, 0)} ${circumference}`}
                          strokeDashoffset={dashOffset}
                          strokeLinecap="round"
                          strokeWidth={16}
                          transform="rotate(-90 84 84)"
                        />
                      );
                    });
                  })()}
                </Svg>
                <View style={styles.donutCenter}>
                  <Text style={styles.donutLabel}>Spent</Text>
                  <Text style={styles.donutValue}>{formatCurrency(expenseTotal)}</Text>
                </View>
              </View>

              <View style={styles.legendColumn}>
                {spendingByCategory.map((item, index) => (
                  <View key={item.categoryId} style={styles.legendRow}>
                    <View
                      style={[styles.legendDot, { backgroundColor: getCategoryColor(index) }]}
                    />
                    <View style={styles.legendCopy}>
                      <Text style={styles.legendLabel}>{item.categoryName}</Text>
                      <Text style={styles.legendValue}>
                        {formatCurrency(item.amount)} • {item.percentage}%
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Income vs Expense</Text>
          <View style={styles.barChartRow}>
            {monthSeries.map((point) => {
              const incomeHeight = Math.max((point.income / maxBarValue) * 96, 6);
              const expenseHeight = Math.max((point.spending / maxBarValue) * 96, 6);
              return (
                <View key={point.month} style={styles.barColumn}>
                  <View style={styles.barTrack}>
                    <View
                      style={[
                        styles.bar,
                        styles.incomeBar,
                        { backgroundColor: BG_MONEY, height: incomeHeight },
                      ]}
                    />
                    <View
                      style={[
                        styles.bar,
                        styles.expenseBar,
                        { backgroundColor: BG_DANGER, height: expenseHeight },
                      ]}
                    />
                  </View>
                  <Text style={styles.barLabel}>{point.label}</Text>
                </View>
              );
            })}
          </View>
        </GlassCard>

        <GlassCard style={styles.chartCard}>
          <Text style={styles.sectionTitle}>Spending Trend</Text>
          <Svg height={140} width={300}>
            <Polyline
              fill="none"
              points={linePoints}
              stroke={BG_ACCENT_LIGHT}
              strokeWidth={3}
            />
          </Svg>
        </GlassCard>

        <View style={styles.tileGrid}>
          <Pressable
            onPress={() => router.push('/(budget)/cash-flow')}
            style={styles.navTile}
          >
            <MaterialSymbol color={BG_MONEY} name="trending_up" size={18} />
            <Text style={styles.navTileTitle}>Cash Flow</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(budget)/spending-heatmap')}
            style={styles.navTile}
          >
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="calendar_today" size={18} />
            <Text style={styles.navTileTitle}>Spending Heatmap</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push('/(budget)/income')}
            style={styles.navTile}
          >
            <MaterialSymbol color="#8BCFF0" name="attach_money" size={18} />
            <Text style={styles.navTileTitle}>Income Tracking</Text>
          </Pressable>
          <Pressable
            onPress={() =>
              Alert.alert(
                'Top Merchants',
                topMerchants.length > 0
                  ? topMerchants
                      .map((merchant) => `${merchant.payee}: ${formatCurrency(merchant.totalAmount)}`)
                      .join('\n')
                  : 'No merchant data in this period.',
              )
            }
            style={styles.navTile}
          >
            <MaterialSymbol color="#A78BFA" name="list_alt" size={18} />
            <Text style={styles.navTileTitle}>Top Merchants</Text>
          </Pressable>
        </View>

        {error ? (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorTitle}>Reports unavailable</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </GlassCard>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.lowest,
    flex: 1,
  },
  content: {
    paddingBottom: 136,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    gap: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  summaryCard: {
    flexBasis: '47%',
    gap: 8,
    minHeight: 124,
  },
  summaryLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  summaryMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  chartCard: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  exportChip: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 32,
    paddingHorizontal: 12,
  },
  exportChipLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  emptyCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  donutLayout: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  donutShell: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  donutCenter: {
    alignItems: 'center',
    gap: 4,
    position: 'absolute',
  },
  donutLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  donutValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    textAlign: 'center',
  },
  legendColumn: {
    flex: 1,
    gap: 10,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  legendDot: {
    borderRadius: 6,
    height: 12,
    width: 12,
  },
  legendCopy: {
    flex: 1,
    gap: 2,
  },
  legendLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 16,
  },
  legendValue: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  barChartRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  barColumn: {
    alignItems: 'center',
    gap: 8,
  },
  barTrack: {
    alignItems: 'flex-end',
    height: 104,
    position: 'relative',
    width: 30,
  },
  bar: {
    borderRadius: 5,
    bottom: 0,
    position: 'absolute',
    width: 12,
  },
  incomeBar: {
    left: 0,
  },
  expenseBar: {
    left: 18,
  },
  barLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  tileGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  navTile: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flexBasis: '47%',
    gap: 10,
    minHeight: 94,
    padding: 16,
  },
  navTileTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  errorCard: {
    gap: 6,
  },
  errorTitle: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  errorMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
