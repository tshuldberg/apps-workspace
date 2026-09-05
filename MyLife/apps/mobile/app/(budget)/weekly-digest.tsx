import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import {
  BG_FONTS,
  BG_MONEY,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  GlassCard,
  TxRow,
  generateWeeklyDigest,
  getAlertHistoryByMonth,
  listEnvelopes,
  listTransactions,
  type BudgetTransaction,
  type DigestTransaction,
  type Envelope,
  type WeeklyDigest,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  BudgetActionButton,
  BudgetEmptyState,
  BudgetHeroCard,
  BudgetMetricCard,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetSection,
} from '../../components/budget/BudgetPhase5Kit';

type MerchantDigest = {
  amount: number;
  count: number;
  name: string;
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function getMonday(date: Date): string {
  const copy = new Date(date);
  const day = copy.getDay();
  const diff = copy.getDate() - day + (day === 0 ? -6 : 1);
  copy.setDate(diff);
  return copy.toISOString().slice(0, 10);
}

function shiftDays(isoDate: string, delta: number): string {
  const copy = new Date(`${isoDate}T00:00:00`);
  copy.setDate(copy.getDate() + delta);
  return copy.toISOString().slice(0, 10);
}

function weekLabel(startDate: string): string {
  const endDate = shiftDays(startDate, 6);
  const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
  const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
  const start = new Date(startYear, startMonth - 1, startDay);
  const end = new Date(endYear, endMonth - 1, endDay);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
}

function buildMerchantDigest(transactions: BudgetTransaction[], envelopeMap: Map<string, Envelope>): MerchantDigest[] {
  const merchantMap = new Map<string, MerchantDigest>();

  transactions.forEach((transaction) => {
    if (transaction.direction !== 'outflow') {
      return;
    }
    const name = transaction.merchant?.trim() || 'Unknown merchant';
    const existing = merchantMap.get(name);
    if (existing) {
      existing.amount += transaction.amount;
      existing.count += 1;
      return;
    }
    merchantMap.set(name, {
      amount: transaction.amount,
      count: envelopeMap.has(transaction.envelope_id ?? '') ? 1 : 1,
      name,
    });
  });

  return Array.from(merchantMap.values())
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
}

export default function WeeklyDigestScreen() {
  const db = useDatabase();

  const [weekStart, setWeekStart] = useState(() => getMonday(new Date()));
  const [digest, setDigest] = useState<WeeklyDigest | null>(null);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [merchantDigest, setMerchantDigest] = useState<MerchantDigest[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(() => {
    try {
      const envelopes = listEnvelopes(db, false);
      const envelopeMap = new Map<string, Envelope>(envelopes.map((envelope) => [envelope.id, envelope]));
      const weekTransactions = listTransactions(db, {
        from_date: weekStart,
        limit: 500,
        to_date: shiftDays(weekStart, 6),
      });
      const priorTransactions = listTransactions(db, {
        from_date: shiftDays(weekStart, -7),
        limit: 500,
        to_date: shiftDays(weekStart, -1),
      });
      const priorWeekSpent = priorTransactions
        .filter((transaction) => transaction.direction === 'outflow')
        .reduce((sum, transaction) => sum + transaction.amount, 0);

      const digestTransactions: DigestTransaction[] = weekTransactions.map((transaction) => ({
        amountCents: transaction.amount,
        date: transaction.occurred_on,
        direction: transaction.direction as DigestTransaction['direction'],
        envelopeName: transaction.envelope_id ? envelopeMap.get(transaction.envelope_id)?.name ?? null : null,
        merchant: transaction.merchant,
      }));

      const nextDigest = generateWeeklyDigest({
        alertsTriggered: getAlertHistoryByMonth(db, weekStart.slice(0, 7)).length,
        priorWeekSpentCents: priorWeekSpent > 0 ? priorWeekSpent : null,
        transactions: digestTransactions,
        weekStart,
      });

      setDigest(nextDigest);
      setTransactions(
        weekTransactions
          .filter((transaction) => transaction.direction === 'outflow')
          .sort((left, right) => right.amount - left.amount)
          .slice(0, 5),
      );
      setMerchantDigest(buildMerchantDigest(weekTransactions, envelopeMap));
    } finally {
      setRefreshing(false);
    }
  }, [db, weekStart]);

  useEffect(() => {
    load();
  }, [load]);

  const refreshControl = (
    <RefreshControl
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      refreshing={refreshing}
      tintColor={BG_MONEY}
    />
  );

  const narrative = useMemo(() => {
    if (!digest) {
      return null;
    }
    const topCategory = digest.topCategories[0]?.envelopeName;
    return topCategory ? `${digest.summary}. Top category was ${topCategory}.` : digest.summary;
  }, [digest]);

  const handleShare = useCallback(async () => {
    if (!digest) {
      return;
    }

    await Share.share({
      message: [
        `MyBudget weekly digest for ${weekLabel(weekStart)}`,
        narrative ?? digest.summary,
        `Net: ${formatCurrency(digest.netCents)}`,
        `Spent: ${formatCurrency(digest.totalSpentCents)}`,
        `Income: ${formatCurrency(digest.totalIncomeCents)}`,
      ].join('\n'),
    });
  }, [digest, narrative, weekStart]);

  return (
    <BudgetPhaseScreen refreshControl={refreshControl}>
      <BudgetPhaseHeader
        action={
          <View style={styles.headerActions}>
            <BudgetActionButton
              icon="chevron_left"
              label="Prev"
              onPress={() => setWeekStart((current) => shiftDays(current, -7))}
              quiet
              tone="gold"
            />
            <BudgetActionButton
              icon="today"
              label="Current"
              onPress={() => setWeekStart(getMonday(new Date()))}
              quiet
              tone="money"
            />
            <BudgetActionButton
              icon="share"
              label="Share"
              onPress={handleShare}
              quiet
              tone="info"
            />
          </View>
        }
        eyebrow="Weekly digest"
        eyebrowIcon="auto_awesome"
        subtitle={weekLabel(weekStart)}
        title="This week"
      />

      {digest ? (
        <>
          <BudgetHeroCard
            detail={`${digest.transactionCount} transactions · ${digest.noSpendDays} no-spend days`}
            subtitle={narrative ?? digest.summary}
            title="Net week result"
            value={formatCurrency(digest.netCents)}
          />

          <View style={styles.metricRow}>
            <BudgetMetricCard
              caption="Money in"
              label="Income"
              tone="money"
              value={formatCurrency(digest.totalIncomeCents)}
            />
            <BudgetMetricCard
              caption="Money out"
              label="Spent"
              tone="danger"
              value={formatCurrency(digest.totalSpentCents)}
            />
            <BudgetMetricCard
              caption="Triggered this week"
              label="Alerts"
              tone="gold"
              value={String(digest.alertsTriggered)}
            />
          </View>

          <BudgetSection
            subtitle="The heaviest budget buckets from this week."
            title="Top categories"
          >
            {digest.topCategories.length > 0 ? (
              <GlassCard padding={20}>
                <Svg height={180} width="100%">
                  {digest.topCategories.map((category, index) => {
                    const barWidth = 48;
                    const gap = 16;
                    const left = 18 + index * (barWidth + gap);
                    const maxValue = Math.max(...digest.topCategories.map((item) => item.totalCents), 1);
                    const barHeight = (category.totalCents / maxValue) * 110;
                    return (
                      <Rect
                        fill={index === 0 ? BG_MONEY : 'rgba(255,255,255,0.24)'}
                        height={barHeight}
                        key={category.envelopeName}
                        rx={12}
                        width={barWidth}
                        x={left}
                        y={138 - barHeight}
                      />
                    );
                  })}
                </Svg>
                <View style={styles.chartLabels}>
                  {digest.topCategories.map((category) => (
                    <View key={category.envelopeName} style={styles.chartLabel}>
                      <Text numberOfLines={1} style={styles.chartLabelTitle}>
                        {category.envelopeName}
                      </Text>
                      <Text style={styles.chartLabelValue}>
                        {formatCurrency(category.totalCents)}
                      </Text>
                    </View>
                  ))}
                </View>
              </GlassCard>
            ) : (
              <BudgetEmptyState
                icon="receipt_long"
                message="No outflow transactions landed in this week yet."
                title="Quiet week"
              />
            )}
          </BudgetSection>

          <BudgetSection
            subtitle="The merchants that pulled the most dollars this week."
            title="Top merchants"
          >
            {merchantDigest.length > 0 ? (
              <View style={styles.listColumn}>
                {merchantDigest.map((merchant) => (
                  <GlassCard key={merchant.name} padding={18}>
                    <View style={styles.listRow}>
                      <View style={styles.listCopy}>
                        <Text style={styles.listTitle}>{merchant.name}</Text>
                        <Text style={styles.listMeta}>
                          {merchant.count} purchase{merchant.count === 1 ? '' : 's'}
                        </Text>
                      </View>
                      <Text style={styles.listAmount}>{formatCurrency(merchant.amount)}</Text>
                    </View>
                  </GlassCard>
                ))}
              </View>
            ) : (
              <BudgetEmptyState
                icon="storefront"
                message="Merchant rankings appear once the week includes outflow transactions."
                title="No merchant ranking yet"
              />
            )}
          </BudgetSection>

          <BudgetSection
            subtitle="Largest outflows, ordered by amount."
            title="Biggest transactions"
          >
            {transactions.length > 0 ? (
              <View style={styles.listColumn}>
                {transactions.map((transaction) => (
                  <TxRow key={transaction.id} tx={transaction} />
                ))}
              </View>
            ) : (
              <BudgetEmptyState
                icon="swap_vert"
                message="No large transactions landed this week."
                title="Nothing to rank"
              />
            )}
          </BudgetSection>
        </>
      ) : (
        <BudgetEmptyState
          icon="calendar_view_week"
          message="This week does not have enough data to generate a digest yet."
          title="No digest yet"
        />
      )}
    </BudgetPhaseScreen>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chartLabels: {
    marginTop: 8,
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  chartLabel: {
    minWidth: 84,
    gap: 2,
  },
  chartLabelTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT,
  },
  chartLabelValue: {
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 15,
    color: BG_TEXT_SECONDARY,
  },
  listColumn: {
    gap: 10,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  listCopy: {
    flex: 1,
    gap: 4,
  },
  listTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  listMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  listAmount: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
});
