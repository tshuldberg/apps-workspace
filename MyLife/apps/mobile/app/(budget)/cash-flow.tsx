import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
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
  calculateCashFlowByPeriod,
  calculateNetCash,
  calculateRunningBalance,
  calculateSavingsRate,
  detectIncomeStreams,
  getCategoryGroups,
  getEnvelopesByGroup,
  listAccounts,
  listEnvelopes,
  listTransactions,
  type BudgetTransaction,
  type Envelope,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';

type Period = 'month' | 'quarter' | 'year';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function getRange(period: Period): { from: string; to: string } {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();

  if (period === 'year') {
    return { from: `${year}-01-01`, to: `${year}-12-31` };
  }

  if (period === 'quarter') {
    const quarterStart = Math.floor(month / 3) * 3;
    const end = new Date(year, quarterStart + 3, 0).getDate();
    return {
      from: `${year}-${String(quarterStart + 1).padStart(2, '0')}-01`,
      to: `${year}-${String(quarterStart + 3).padStart(2, '0')}-${String(end).padStart(2, '0')}`,
    };
  }

  const lastDay = new Date(year, month + 1, 0).getDate();
  return {
    from: `${year}-${String(month + 1).padStart(2, '0')}-01`,
    to: `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

function ActionChip({
  active,
  label,
  onPress,
}: {
  active: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? `${BG_ACCENT}22` : BG_SURFACES.high },
      ]}
    >
      <Text
        style={[
          styles.chipLabel,
          { color: active ? BG_ACCENT_LIGHT : BG_TEXT_SECONDARY },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function CashFlowScreen() {
  const db = useDatabase();

  const [period, setPeriod] = useState<Period>('month');
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const range = getRange(period);
      setTransactions(
        listTransactions(db, {
          from_date: range.from,
          limit: 2000,
          to_date: range.to,
        }),
      );
      setEnvelopes(listEnvelopes(db, true));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cash flow.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, period]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const netCashInput = useMemo(
    () =>
      transactions.map((transaction) => ({
        amount:
          transaction.direction === 'outflow'
            ? -Math.abs(transaction.amount)
            : Math.abs(transaction.amount),
        date: transaction.occurred_on,
        isTransfer: transaction.direction === 'transfer',
      })),
    [transactions],
  );

  const netCash = useMemo(() => calculateNetCash(netCashInput), [netCashInput]);

  const accountsTotal = useMemo(
    () => listAccounts(db, false).reduce((sum, account) => sum + account.current_balance, 0),
    [db],
  );

  const runningBalance = useMemo(
    () => calculateRunningBalance(netCashInput, accountsTotal),
    [accountsTotal, netCashInput],
  );

  const linePoints = useMemo(() => {
    const width = 300;
    const height = 150;
    const padding = 18;
    const values = runningBalance.map((entry) => entry.balance);
    const minValue = Math.min(...values, 0);
    const maxValue = Math.max(...values, 1);
    const range = Math.max(maxValue - minValue, 1);

    return runningBalance
      .map((entry, index) => {
        const x = padding + (index / Math.max(runningBalance.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - ((entry.balance - minValue) / range) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(' ');
  }, [runningBalance]);

  const incomeSources = useMemo(
    () =>
      detectIncomeStreams(
        transactions
          .filter((transaction) => transaction.direction === 'inflow')
          .map((transaction) => ({
            amount: Math.abs(transaction.amount),
            date: transaction.occurred_on,
            payee: transaction.merchant ?? 'Income',
          })),
      ).slice(0, 4),
    [transactions],
  );

  const expenseGroups = useMemo(() => {
    const groupLookup = new Map<string, string>();
    const envelopeLookup = new Map(envelopes.map((envelope) => [envelope.id, envelope]));

    getCategoryGroups(db, false).forEach((group) => {
      getEnvelopesByGroup(db, group.id).forEach((ref) => {
        groupLookup.set(ref.id, group.name);
      });
    });

    const totals = new Map<string, number>();
    transactions.forEach((transaction) => {
      if (transaction.direction !== 'outflow') {
        return;
      }
      const groupName =
        (transaction.envelope_id ? groupLookup.get(transaction.envelope_id) : null) ??
        (transaction.envelope_id ? envelopeLookup.get(transaction.envelope_id)?.name : null) ??
        'Uncategorized';
      totals.set(groupName, (totals.get(groupName) ?? 0) + Math.abs(transaction.amount));
    });

    return [...totals.entries()]
      .map(([name, amount]) => ({ amount, name }))
      .sort((left, right) => right.amount - left.amount)
      .slice(0, 5);
  }, [db, envelopes, transactions]);

  const monthlyTrend = useMemo(
    () => calculateCashFlowByPeriod(netCashInput, 'monthly'),
    [netCashInput],
  );

  const savingsRate = useMemo(
    () => calculateSavingsRate(netCash.inflows, netCash.outflows),
    [netCash.inflows, netCash.outflows],
  );

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
      <View style={styles.chipRow}>
        {(['month', 'quarter', 'year'] as const).map((value) => (
          <ActionChip
            active={period === value}
            key={value}
            label={value[0].toUpperCase() + value.slice(1)}
            onPress={() => setPeriod(value)}
          />
        ))}
      </View>

      <GlassCard style={styles.heroCard}>
        <Text style={styles.eyebrow}>Net Cash</Text>
        <AmountDisplay
          cents={netCash.netCash}
          size="xl"
          type={netCash.netCash >= 0 ? 'income' : 'expense'}
        />
        <Text style={styles.heroMeta}>
          {loading
            ? 'Loading cash flow snapshot...'
            : `Savings rate ${savingsRate.toFixed(1)}% • ${netCash.transactionCount} non-transfer transactions`}
        </Text>
      </GlassCard>

      <View style={styles.summaryGrid}>
        <GlassCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Inflows</Text>
          <AmountDisplay cents={netCash.inflows} size="lg" type="income" />
        </GlassCard>
        <GlassCard style={styles.summaryCard}>
          <Text style={styles.summaryLabel}>Outflows</Text>
          <AmountDisplay cents={netCash.outflows} size="lg" type="expense" />
        </GlassCard>
      </View>

      <GlassCard style={styles.chartCard}>
        <Text style={styles.sectionTitle}>Running Balance</Text>
        <Svg height={150} width={300}>
          <Polyline
            fill="none"
            points={linePoints}
            stroke={BG_ACCENT_LIGHT}
            strokeWidth={3}
          />
        </Svg>
      </GlassCard>

      <GlassCard style={styles.listCard}>
        <Text style={styles.sectionTitle}>Income by Source</Text>
        {incomeSources.length === 0 ? (
          <Text style={styles.emptyCopy}>No recurring income streams detected yet.</Text>
        ) : (
          incomeSources.map((stream) => (
            <View key={stream.payee} style={styles.listRow}>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{stream.payee}</Text>
                <Text style={styles.listMeta}>
                  {stream.frequency.replace('_', ' ')} • {Math.round(stream.confidence * 100)}% confidence
                </Text>
              </View>
              <Text style={styles.listValue}>{formatCurrency(stream.monthlyEstimate)}</Text>
            </View>
          ))
        )}
      </GlassCard>

      <GlassCard style={styles.listCard}>
        <Text style={styles.sectionTitle}>Expense by Category Group</Text>
        {expenseGroups.length === 0 ? (
          <Text style={styles.emptyCopy}>No expenses recorded for this period.</Text>
        ) : (
          expenseGroups.map((group) => (
            <View key={group.name} style={styles.listRow}>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{group.name}</Text>
              </View>
              <Text style={[styles.listValue, { color: BG_DANGER }]}>
                {formatCurrency(group.amount)}
              </Text>
            </View>
          ))
        )}
      </GlassCard>

      <GlassCard style={styles.listCard}>
        <Text style={styles.sectionTitle}>Monthly Trend</Text>
        {monthlyTrend.length === 0 ? (
          <Text style={styles.emptyCopy}>No monthly trend yet for this range.</Text>
        ) : (
          monthlyTrend.map((entry) => (
            <View key={entry.period} style={styles.listRow}>
              <View style={styles.listCopy}>
                <Text style={styles.listTitle}>{entry.period}</Text>
                <Text style={styles.listMeta}>
                  In {formatCurrency(entry.inflows)} • Out {formatCurrency(entry.outflows)}
                </Text>
              </View>
              <Text
                style={[
                  styles.listValue,
                  { color: entry.netCash >= 0 ? BG_MONEY : BG_DANGER },
                ]}
              >
                {entry.netCash >= 0 ? '+' : ''}
                {formatCurrency(entry.netCash)}
              </Text>
            </View>
          ))
        )}
      </GlassCard>

      {error ? (
        <GlassCard style={styles.errorCard}>
          <Text style={styles.errorTitle}>Cash flow unavailable</Text>
          <Text style={styles.errorMessage}>{error}</Text>
        </GlassCard>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.lowest,
    flex: 1,
  },
  content: {
    paddingBottom: 80,
    paddingHorizontal: 20,
    paddingTop: 20,
    gap: 16,
  },
  chipRow: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  heroCard: {
    gap: 10,
  },
  eyebrow: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  heroMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  summaryGrid: {
    flexDirection: 'row',
    gap: 12,
  },
  summaryCard: {
    flex: 1,
    gap: 8,
  },
  summaryLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  chartCard: {
    gap: 12,
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  listCard: {
    gap: 12,
  },
  listRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  listCopy: {
    flex: 1,
    gap: 2,
  },
  listTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  listMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  listValue: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
    marginLeft: 12,
  },
  emptyCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
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
