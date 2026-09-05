import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
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
  BG_TYPOGRAPHY,
  AmountDisplay,
  GlassCard,
  MaterialSymbol,
  detectPaydays,
  estimateMonthlyIncome,
  getPaydaySchedule,
  listTransactions,
  predictNextPayday,
  type BudgetTransaction,
  type IncomeEstimate,
  type IncomeStream,
  type PaydayPrediction,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import { BudgetLineChart } from '../../components/budget/BudgetLineChart';

type IncomeSuggestion = {
  amount: number;
  date: string;
  payee: string;
  reason: string;
};

function sixMonthsAgoISO() {
  const date = new Date();
  date.setMonth(date.getMonth() - 6);
  return date.toISOString().slice(0, 10);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatCurrency(cents: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(cents / 100);
}

function classifySource(stream: IncomeStream) {
  const name = stream.payee.toLowerCase();
  if (
    name.includes('uber') ||
    name.includes('lyft') ||
    name.includes('doordash') ||
    name.includes('stripe') ||
    name.includes('shopify')
  ) {
    return 'Gig';
  }
  if (stream.frequency === 'weekly' || stream.frequency === 'biweekly' || stream.frequency === 'semi_monthly' || stream.frequency === 'monthly') {
    return 'Employer';
  }
  return 'Other';
}

function monthlySeries(transactions: BudgetTransaction[]) {
  const grouped = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.direction === 'inflow')
    .forEach((transaction) => {
      const key = transaction.occurred_on.slice(0, 7);
      grouped.set(key, (grouped.get(key) ?? 0) + transaction.amount);
    });

  return [...grouped.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .slice(-6)
    .map(([month, total]) => ({
      label: new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
      }),
      value: total / 100,
    }));
}

function buildSuggestions(
  transactions: BudgetTransaction[],
  estimate: IncomeEstimate | null,
) {
  const knownPayees = new Set(
    (estimate?.streams ?? []).map((stream) => stream.payee.toLowerCase().trim()),
  );
  const counts = new Map<string, number>();

  transactions
    .filter((transaction) => transaction.direction === 'inflow')
    .forEach((transaction) => {
      const payee = (transaction.merchant ?? 'Unknown deposit').trim();
      const key = payee.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    });

  return transactions
    .filter((transaction) => transaction.direction === 'inflow')
    .map((transaction) => {
      const payee = (transaction.merchant ?? 'Unknown deposit').trim() || 'Unknown deposit';
      const key = payee.toLowerCase();
      const known = knownPayees.has(key);
      const occurrenceCount = counts.get(key) ?? 1;

      if (known && occurrenceCount > 1) {
        return null;
      }

      return {
        amount: transaction.amount,
        date: transaction.occurred_on,
        payee,
        reason: known
          ? 'Single recent credit'
          : payee === 'Unknown deposit'
            ? 'Missing payee details'
            : 'New inflow source candidate',
      } satisfies IncomeSuggestion;
    })
    .filter((suggestion): suggestion is IncomeSuggestion => suggestion != null)
    .slice(0, 8);
}

function reserveRate(estimate: IncomeEstimate | null) {
  if (!estimate) {
    return 0.18;
  }

  if (estimate.totalMonthlyIncome >= 1_200_000) {
    return 0.28;
  }
  if (estimate.totalMonthlyIncome >= 700_000) {
    return 0.24;
  }
  if (estimate.totalMonthlyIncome >= 350_000) {
    return 0.20;
  }
  return 0.16;
}

export default function IncomeTrackingScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [estimate, setEstimate] = useState<IncomeEstimate | null>(null);
  const [nextPayday, setNextPayday] = useState<PaydayPrediction | null>(null);
  const [schedule, setSchedule] = useState<
    Array<{ date: string; payee: string; amount: number }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const nextTransactions = listTransactions(db, {
        from_date: sixMonthsAgoISO(),
        limit: 2000,
        to_date: todayISO(),
      });
      const incomeTransactions = nextTransactions
        .filter((transaction) => transaction.direction === 'inflow')
        .map((transaction) => ({
          amount: transaction.amount,
          date: transaction.occurred_on,
          payee: transaction.merchant?.trim() || 'Unknown deposit',
        }));

      const nextEstimate =
        incomeTransactions.length > 1
          ? estimateMonthlyIncome(incomeTransactions)
          : null;
      const patterns = detectPaydays(incomeTransactions);
      const predictedPayday =
        patterns.length > 0 ? predictNextPayday(patterns[0], todayISO()) : null;

      setTransactions(nextTransactions);
      setEstimate(nextEstimate);
      setNextPayday(predictedPayday);
      setSchedule(
        getPaydaySchedule(patterns, 6).map((entry) => ({
          amount: entry.expectedAmount,
          date: entry.predictedDate,
          payee: entry.payee,
        })),
      );
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Failed to analyze income.',
      );
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const chartPoints = useMemo(() => monthlySeries(transactions), [transactions]);
  const taxReserve = useMemo(
    () => (estimate ? Math.round(estimate.totalMonthlyIncome * reserveRate(estimate)) : 0),
    [estimate],
  );
  const incomeSuggestions = useMemo(
    () => buildSuggestions(transactions, estimate),
    [estimate, transactions],
  );

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Analyzing income patterns...</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Income</Text>
              <Text style={styles.heroTitle}>Recurring cash flow, payday timing, and income source confidence in one view.</Text>
            </View>
            <Pressable onPress={() => setShowSuggestions(true)} style={styles.heroAction}>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="auto_awesome" size={18} />
              <Text style={styles.heroActionLabel}>Mark as income</Text>
            </Pressable>
          </View>

          {estimate ? (
            <>
              <AmountDisplay cents={estimate.totalMonthlyIncome} size="xl" type="income" />
              <View style={styles.confidenceRow}>
                <View style={styles.confidencePill}>
                  <Text style={styles.confidenceLabel}>
                    {Math.round(estimate.confidence * 100)}% confidence
                  </Text>
                </View>
                <Text style={styles.heroMeta}>Estimated from the last 6 months of inflow activity.</Text>
              </View>
            </>
          ) : (
            <View style={styles.emptyHero}>
              <Text style={styles.emptyHeroTitle}>Not enough inflow history yet</Text>
              <Text style={styles.emptyHeroCopy}>
                Once at least two recurring credits are in the ledger, this view estimates monthly income and next paydays.
              </Text>
            </View>
          )}
        </GlassCard>

        {error ? (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorText}>{error}</Text>
          </GlassCard>
        ) : null}

        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Next payday</Text>
            {nextPayday ? (
              <>
                <Text style={styles.statTitle}>{nextPayday.payee}</Text>
                <Text style={styles.statMeta}>{nextPayday.predictedDate}</Text>
                <AmountDisplay cents={nextPayday.expectedAmount} size="lg" type="income" />
              </>
            ) : (
              <Text style={styles.statPlaceholder}>No payday pattern yet</Text>
            )}
          </GlassCard>

          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Tax reserve</Text>
            <AmountDisplay cents={taxReserve} size="lg" type="neutral" />
            <Text style={styles.statMeta}>
              {estimate ? `${Math.round(reserveRate(estimate) * 100)}% of estimated monthly income` : 'Simple reserve appears once income is detected'}
            </Text>
          </GlassCard>
        </View>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Income history</Text>
              <Text style={styles.sectionSubtitle}>
                Monthly inflow totals across the most recent six-month window.
              </Text>
            </View>
          </View>

          <BudgetLineChart
            fillFromColor="rgba(74, 222, 128, 0.32)"
            fillToColor="rgba(74, 222, 128, 0.03)"
            formatValue={(value) => `$${Math.round(value).toLocaleString()}`}
            points={chartPoints}
            strokeColor={BG_MONEY}
          />
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Income sources</Text>
              <Text style={styles.sectionSubtitle}>
                Detected recurring payees, normalized to a monthly estimate.
              </Text>
            </View>
          </View>

          {estimate && estimate.streams.length > 0 ? (
            <View style={styles.sourceList}>
              {estimate.streams.map((stream) => (
                <GlassCard key={`${stream.payee}-${stream.lastDate}`} style={styles.sourceCard}>
                  <View style={styles.sourceHeader}>
                    <View>
                      <Text style={styles.sourceTitle}>{stream.payee}</Text>
                      <Text style={styles.sourceSubtitle}>
                        {classifySource(stream)} · {stream.frequency.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <View style={styles.sourcePill}>
                      <Text style={styles.sourcePillLabel}>
                        {Math.round(stream.confidence * 100)}%
                      </Text>
                    </View>
                  </View>

                  <View style={styles.sourceStatsRow}>
                    <View style={styles.sourceStat}>
                      <Text style={styles.sourceStatLabel}>Avg deposit</Text>
                      <Text style={styles.sourceStatValue}>{formatCurrency(stream.averageAmount)}</Text>
                    </View>
                    <View style={styles.sourceStat}>
                      <Text style={styles.sourceStatLabel}>Monthly est.</Text>
                      <Text style={[styles.sourceStatValue, styles.sourceStatValueAccent]}>
                        {formatCurrency(stream.monthlyEstimate)}
                      </Text>
                    </View>
                    <View style={styles.sourceStat}>
                      <Text style={styles.sourceStatLabel}>Last hit</Text>
                      <Text style={styles.sourceStatValue}>{stream.lastDate}</Text>
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No recurring sources detected</Text>
              <Text style={styles.emptyStateCopy}>
                Capture at least a couple of matching inflow transactions to identify employers, gigs, or other recurring sources.
              </Text>
            </View>
          )}
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Payday schedule</Text>
              <Text style={styles.sectionSubtitle}>
                Upcoming predicted deposits based on the strongest recurring patterns.
              </Text>
            </View>
          </View>

          {schedule.length > 0 ? (
            <View style={styles.scheduleList}>
              {schedule.map((entry) => (
                <View key={`${entry.payee}-${entry.date}`} style={styles.scheduleRow}>
                  <View style={styles.scheduleCopy}>
                    <Text style={styles.scheduleTitle}>{entry.payee}</Text>
                    <Text style={styles.scheduleMeta}>{entry.date}</Text>
                  </View>
                  <Text style={styles.scheduleAmount}>{formatCurrency(entry.amount)}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>Schedule unavailable</Text>
              <Text style={styles.emptyStateCopy}>
                The payday predictor needs at least three matched deposits from the same payee.
              </Text>
            </View>
          )}
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowSuggestions(false)}
        transparent
        visible={showSuggestions}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.eyebrow}>Mark as income</Text>
            <Text style={styles.modalTitle}>Review unclassified credits and promote them into tracked sources.</Text>

            {incomeSuggestions.length > 0 ? (
              <View style={styles.suggestionList}>
                {incomeSuggestions.map((suggestion) => (
                  <View key={`${suggestion.payee}-${suggestion.date}-${suggestion.amount}`} style={styles.suggestionRow}>
                    <View style={styles.suggestionCopy}>
                      <Text style={styles.suggestionTitle}>{suggestion.payee}</Text>
                      <Text style={styles.suggestionMeta}>
                        {suggestion.reason} · {suggestion.date}
                      </Text>
                    </View>
                    <Text style={styles.suggestionAmount}>{formatCurrency(suggestion.amount)}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateTitle}>No new suggestions</Text>
                <Text style={styles.emptyStateCopy}>
                  All recent inflows are already mapped into recurring sources or do not have enough signal yet.
                </Text>
              </View>
            )}

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setShowSuggestions(false)}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>Close</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  setShowSuggestions(false);
                  router.push('/(budget)/review-transactions' as never);
                }}
                style={styles.primaryAction}
              >
                <Text style={styles.primaryActionLabel}>Review transactions</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
  },
  loadingText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  heroCard: {
    gap: 18,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  heroAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  heroActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  confidenceRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  confidencePill: {
    backgroundColor: `${BG_MONEY}22`,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  confidenceLabel: {
    color: BG_MONEY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  heroMeta: {
    color: BG_TEXT_SECONDARY,
    flex: 1,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyHero: {
    gap: 8,
  },
  emptyHeroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  emptyHeroCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  errorCard: {
    backgroundColor: `${BG_DANGER}18`,
  },
  errorText: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    gap: 10,
    minHeight: 132,
  },
  statLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 21,
  },
  statMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  statPlaceholder: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    gap: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  sourceList: {
    gap: 12,
  },
  sourceCard: {
    backgroundColor: BG_SURFACES.low,
    gap: 14,
  },
  sourceHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sourceTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  sourceSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  sourcePill: {
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sourcePillLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  sourceStatsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  sourceStat: {
    flex: 1,
    gap: 4,
  },
  sourceStatLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
  },
  sourceStatValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  sourceStatValueAccent: {
    color: BG_MONEY,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  emptyStateTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  emptyStateCopy: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  scheduleList: {
    gap: 12,
  },
  scheduleRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  scheduleCopy: {
    flex: 1,
    gap: 4,
  },
  scheduleTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  scheduleMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  scheduleAmount: {
    color: BG_MONEY,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalCard: {
    gap: 16,
    paddingBottom: 20,
  },
  modalTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  suggestionList: {
    gap: 12,
  },
  suggestionRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  suggestionCopy: {
    flex: 1,
    gap: 4,
  },
  suggestionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  suggestionMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
  },
  suggestionAmount: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: BG_MONEY,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryActionLabel: {
    color: BG_SURFACES.base,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
});
