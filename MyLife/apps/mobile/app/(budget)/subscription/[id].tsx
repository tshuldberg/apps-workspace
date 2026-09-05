import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  TxRow,
  cancelSubscription,
  createCancellationAction,
  getCancellationActionsBySubscription,
  getSubscriptionById,
  listTransactions,
  normalizeToAnnual,
  normalizeToMonthly,
  pauseSubscription,
  resumeSubscription,
  scoreSubscriptionROI,
  type BudgetSubscription,
  type BudgetTransaction,
  type CancellationAction,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';
import {
  BudgetActionButton,
  BudgetBottomSheet,
  BudgetChip,
  BudgetHeroCard,
  BudgetMetricCard,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetProgressBar,
  BudgetSection,
} from '../../../components/budget/BudgetPhase5Kit';
import { resolveSubscriptionMeta } from '../../../components/budget/budgetSubscriptionMeta';

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function daysBetween(start: string, end: string): number {
  const a = new Date(`${start}T00:00:00`);
  const b = new Date(`${end}T00:00:00`);
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

function daysUntil(isoDate: string): number {
  return daysBetween(new Date().toISOString().slice(0, 10), isoDate);
}

function monthsActive(startDate: string): number {
  return Math.max(1, Math.round(daysBetween(startDate, new Date().toISOString().slice(0, 10)) / 30));
}

function normalizeLookup(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function matchesSubscriptionTransaction(
  subscription: BudgetSubscription,
  transaction: BudgetTransaction,
): boolean {
  if (!transaction.merchant) {
    return false;
  }

  const merchant = normalizeLookup(transaction.merchant);
  const subscriptionName = normalizeLookup(subscription.name);
  if (merchant.includes(subscriptionName) || subscriptionName.includes(merchant)) {
    return true;
  }

  const primaryToken = subscription.name.split(' ')[0];
  const normalizedToken = normalizeLookup(primaryToken);
  return normalizedToken.length >= 3 && merchant.includes(normalizedToken);
}

function roiScoreFromActivity(daysSinceLastActivity: number | null, monthlyCostCents: number): number {
  const recencyBonus =
    daysSinceLastActivity === null
      ? 0
      : daysSinceLastActivity <= 7
        ? 22
        : daysSinceLastActivity <= 30
          ? 14
          : daysSinceLastActivity <= 60
            ? 6
            : 0;
  const costPenalty = monthlyCostCents >= 2000 ? 6 : monthlyCostCents >= 1000 ? 3 : 0;
  return Math.max(12, Math.min(96, 58 + recencyBonus - costPenalty));
}

function roiTone(score: number): 'money' | 'gold' | 'danger' {
  if (score >= 74) return 'money';
  if (score >= 45) return 'gold';
  return 'danger';
}

function actionLabel(action: CancellationAction['action']): string {
  switch (action) {
    case 'cancelled':
      return 'Cancelled';
    case 'dismissed':
      return 'Dismissed';
    case 'downgraded':
      return 'Downgraded';
    case 'kept':
      return 'Kept';
    default:
      return 'Reminder sent';
  }
}

export default function BudgetSubscriptionDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string | string[] }>();
  const subscriptionId = Array.isArray(params.id) ? params.id[0] : params.id;

  const [subscription, setSubscription] = useState<BudgetSubscription | null>(null);
  const [relatedTransactions, setRelatedTransactions] = useState<BudgetTransaction[]>([]);
  const [actions, setActions] = useState<CancellationAction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [assistVisible, setAssistVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(() => {
    if (!subscriptionId) {
      setSubscription(null);
      setError('Subscription not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextSubscription = getSubscriptionById(db, subscriptionId);
      if (!nextSubscription) {
        setSubscription(null);
        setError('Subscription not found.');
        return;
      }

      const transactions = listTransactions(db, { limit: 2000 }).filter((transaction) =>
        matchesSubscriptionTransaction(nextSubscription, transaction),
      );

      setSubscription(nextSubscription);
      setRelatedTransactions(transactions.slice(0, 12));
      setActions(getCancellationActionsBySubscription(db, nextSubscription.id));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load the subscription.',
      );
    } finally {
      setLoading(false);
      setSubmitting(false);
    }
  }, [db, subscriptionId]);

  useEffect(() => {
    load();
  }, [load]);

  const resolvedMeta = useMemo(
    () =>
      subscription
        ? resolveSubscriptionMeta(subscription)
        : null,
    [subscription],
  );

  const monthlyCost = useMemo(
    () =>
      subscription
        ? normalizeToMonthly(subscription.price, subscription.billing_cycle, subscription.custom_days)
        : 0,
    [subscription],
  );

  const annualCost = useMemo(
    () =>
      subscription
        ? normalizeToAnnual(subscription.price, subscription.billing_cycle, subscription.custom_days)
        : 0,
    [subscription],
  );

  const roi = useMemo(() => {
    if (!subscription) {
      return null;
    }

    return scoreSubscriptionROI({
      relatedTransactionDates: relatedTransactions.map((transaction) => transaction.occurred_on),
      subscription,
      today: new Date().toISOString().slice(0, 10),
    });
  }, [relatedTransactions, subscription]);

  const roiValue = useMemo(
    () =>
      roi ? roiScoreFromActivity(roi.daysSinceLastActivity, roi.monthlyCostCents) : 0,
    [roi],
  );

  const roiActivityCaption = useMemo(() => {
    if (!roi || roi.daysSinceLastActivity === null) {
      return 'No recent activity matched';
    }
    return `Last activity ${roi.daysSinceLastActivity}d ago`;
  }, [roi]);

  const lifetimeTotalPaid = useMemo(() => {
    if (relatedTransactions.length > 0) {
      return relatedTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    }
    return monthsActive(subscription?.start_date ?? new Date().toISOString().slice(0, 10)) * monthlyCost;
  }, [monthlyCost, relatedTransactions, subscription]);

  const lastRenewalDate = useMemo(() => {
    if (relatedTransactions.length > 0) {
      return relatedTransactions[0]?.occurred_on ?? subscription?.start_date ?? null;
    }
    return subscription?.start_date ?? null;
  }, [relatedTransactions, subscription]);

  const handlePauseResume = useCallback(() => {
    if (!subscription || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      if (subscription.status === 'paused') {
        resumeSubscription(db, subscription.id);
      } else {
        pauseSubscription(db, subscription.id);
      }
      load();
    } catch (actionError) {
      setSubmitting(false);
      Alert.alert(
        'Unable to update subscription',
        actionError instanceof Error ? actionError.message : 'Try again in a moment.',
      );
    }
  }, [db, load, subscription, submitting]);

  const handleMarkCancelled = useCallback(() => {
    if (!subscription || subscription.status === 'cancelled' || submitting) {
      return;
    }

    Alert.alert('Mark as cancelled?', 'This records the cancellation and updates the renewal status.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Mark cancelled',
        style: 'destructive',
        onPress: () => {
          setSubmitting(true);
          try {
            cancelSubscription(db, subscription.id);
            createCancellationAction(db, {
              action: 'cancelled',
              notes: 'Marked as cancelled from subscription detail',
              savings_amount: annualCost,
              subscription_id: subscription.id,
            });
            setAssistVisible(false);
            load();
          } catch (actionError) {
            setSubmitting(false);
            Alert.alert(
              'Unable to cancel',
              actionError instanceof Error ? actionError.message : 'Try again in a moment.',
            );
          }
        },
      },
    ]);
  }, [annualCost, db, load, subscription, submitting]);

  const handleOpenProviderSite = useCallback(async () => {
    if (!subscription || !resolvedMeta?.url || submitting) {
      return;
    }

    setSubmitting(true);
    try {
      await WebBrowser.openBrowserAsync(resolvedMeta.url);
      createCancellationAction(db, {
        action: 'reminded',
        notes: 'Opened provider site from cancellation assist',
        savings_amount: annualCost,
        subscription_id: subscription.id,
      });
      load();
    } catch (actionError) {
      setSubmitting(false);
      Alert.alert(
        'Unable to open provider site',
        actionError instanceof Error ? actionError.message : 'Check the saved URL and try again.',
      );
    }
  }, [annualCost, db, load, resolvedMeta?.url, subscription, submitting]);

  if (loading) {
    return (
      <BudgetPhaseScreen contentContainerStyle={styles.loadingState}>
        <Text style={styles.loadingText}>Loading subscription detail…</Text>
      </BudgetPhaseScreen>
    );
  }

  if (!subscription || !resolvedMeta) {
    return (
      <BudgetPhaseScreen contentContainerStyle={styles.loadingState}>
        <GlassCard padding={24} style={styles.errorCard}>
          <Text style={styles.errorTitle}>Subscription not found</Text>
          <Text style={styles.errorMessage}>{error ?? 'Go back to the subscriptions list and try again.'}</Text>
          <BudgetActionButton
            icon="arrow_back"
            label="Back to subscriptions"
            onPress={() => router.replace('/(budget)/subscriptions' as never)}
            tone="gold"
          />
        </GlassCard>
      </BudgetPhaseScreen>
    );
  }

  return (
    <>
      <BudgetPhaseScreen>
        <BudgetPhaseHeader
          action={
            <BudgetChip
              active={subscription.status === 'active'}
              label={subscription.status}
              tone={subscription.status === 'cancelled' ? 'danger' : subscription.status === 'paused' ? 'gold' : 'money'}
            />
          }
          eyebrow="Subscription detail"
          eyebrowIcon="subscriptions"
          subtitle={`${resolvedMeta.categoryLabel} · ${monthsActive(subscription.start_date)} months active`}
          title={subscription.name}
        />

        <BudgetHeroCard
          detail={
            subscription.status === 'cancelled'
              ? `Cancelled on ${subscription.cancelled_date ? formatDate(subscription.cancelled_date) : 'this plan'}`
              : `${daysUntil(subscription.next_renewal)} days until renewal`
          }
          footer={
            <View style={styles.heroMetaRow}>
              <Text style={styles.heroMetaText}>Monthly {formatCurrency(monthlyCost)}</Text>
              <Text style={styles.heroMetaDivider}>•</Text>
              <Text style={styles.heroMetaText}>Annual {formatCurrency(annualCost)}</Text>
            </View>
          }
          subtitle={subscription.billing_cycle.replace(/_/g, ' ')}
          title="Cost profile"
          value={formatCurrency(subscription.price)}
        />

        <View style={styles.metricRow}>
          <BudgetMetricCard
            caption="Historical renewals detected"
            label="Lifetime paid"
            tone="gold"
            value={formatCurrency(lifetimeTotalPaid)}
          />
          <BudgetMetricCard
            caption={lastRenewalDate ? `Last renewal ${formatDate(lastRenewalDate)}` : 'No matched renewals yet'}
            label="Renewal countdown"
            tone={subscription.status === 'cancelled' ? 'danger' : 'money'}
            value={
              subscription.status === 'cancelled'
                ? 'Closed'
                : `${daysUntil(subscription.next_renewal)}d`
            }
          />
        </View>

        <View style={styles.metricRow}>
          <BudgetMetricCard
            caption={resolvedMeta.categoryLabel}
            label="Category"
            tone="info"
            value={resolvedMeta.glyph}
          />
          <BudgetMetricCard
            caption={roiActivityCaption}
            label="Usage score"
            tone={roiTone(roiValue)}
            value={`${(roiValue / 10).toFixed(1)}/10`}
          />
        </View>

        <BudgetSection
          subtitle={roi?.summary ?? 'Usage value is waiting for linked renewal transactions.'}
          title="ROI"
        >
          <GlassCard padding={18}>
            <View style={styles.roiHeader}>
              <View>
                <Text style={styles.roiLabel}>Usage to cost rating</Text>
                <Text style={styles.roiValue}>{Math.round(roiValue)} / 100</Text>
              </View>
              <BudgetChip
                active
                label={
                  roiValue >= 74 ? 'High value' : roiValue >= 45 ? 'Watch closely' : 'Low value'
                }
                tone={roiTone(roiValue)}
              />
            </View>
            <BudgetProgressBar progress={roiValue / 100} tone={roiTone(roiValue)} />
            <View style={styles.roiNotes}>
              <Text style={styles.roiNoteText}>
                {roiValue >= 74
                  ? 'Consistent activity and cost efficiency keep this plan in the green.'
                  : roiValue >= 45
                    ? 'Usage is slipping. Check whether this service still earns its monthly slot.'
                    : 'This is a strong cancellation candidate based on recent value signals.'}
              </Text>
            </View>
          </GlassCard>
        </BudgetSection>

        <BudgetSection
          subtitle="Pause, review the provider site, or close the subscription when you are ready."
          title="Actions"
        >
          <View style={styles.actionRow}>
            <BudgetActionButton
              icon={subscription.status === 'paused' ? 'play_arrow' : 'pause'}
              label={subscription.status === 'paused' ? 'Resume' : 'Pause'}
              onPress={handlePauseResume}
              quiet
              tone="gold"
            />
            <BudgetActionButton
              icon="support_agent"
              label="Cancellation Assist"
              onPress={() => setAssistVisible(true)}
              tone="danger"
            />
            <BudgetActionButton
              icon="task_alt"
              label="Mark Cancelled"
              onPress={handleMarkCancelled}
              quiet
              tone="money"
            />
          </View>
        </BudgetSection>

        <BudgetSection
          action={
            <BudgetActionButton
              icon="insights"
              label="Full ROI"
              onPress={() => router.push('/(budget)/subscription-roi' as never)}
              quiet
              tone="info"
            />
          }
          subtitle="Auto-matched historical renewals tied to this subscription name."
          title="Linked transactions"
        >
          {relatedTransactions.length > 0 ? (
            <View style={styles.listColumn}>
              {relatedTransactions.map((transaction) => (
                <TxRow
                  key={transaction.id}
                  onPress={() => router.push(`/(budget)/transaction/${transaction.id}` as never)}
                  tx={transaction}
                />
              ))}
            </View>
          ) : (
            <GlassCard padding={18}>
              <Text style={styles.emptyCopy}>
                No renewal transactions are linked yet. Import or review transactions to improve matching.
              </Text>
            </GlassCard>
          )}
        </BudgetSection>

        <BudgetSection subtitle="Recent assist actions are logged to budget cancellation history." title="Assist history">
          {actions.length > 0 ? (
            <View style={styles.listColumn}>
              {actions.map((action) => (
                <GlassCard key={action.id} padding={16}>
                  <View style={styles.historyRow}>
                    <View style={styles.historyCopy}>
                      <Text style={styles.historyTitle}>{actionLabel(action.action)}</Text>
                      <Text style={styles.historyMeta}>
                        {formatDate(action.acted_on.slice(0, 10))}
                        {action.notes ? ` · ${action.notes}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.historySavings}>
                      {action.savings_amount ? formatCurrency(action.savings_amount) : '—'}
                    </Text>
                  </View>
                </GlassCard>
              ))}
            </View>
          ) : (
            <GlassCard padding={18}>
              <Text style={styles.emptyCopy}>
                No assist actions recorded yet. Opening the provider site or marking this plan cancelled will show up here.
              </Text>
            </GlassCard>
          )}
        </BudgetSection>
      </BudgetPhaseScreen>

      <BudgetBottomSheet
        footer={
          <View style={styles.sheetActions}>
            <BudgetActionButton
              icon="open_in_new"
              label={resolvedMeta.url ? 'Open provider site' : 'No site saved'}
              onPress={handleOpenProviderSite}
              tone="danger"
            />
            <BudgetActionButton
              icon="task_alt"
              label="Mark Cancelled"
              onPress={handleMarkCancelled}
              quiet
              tone="money"
            />
          </View>
        }
        onClose={() => setAssistVisible(false)}
        subtitle="Use the provider site when available, follow the guided steps, then confirm the outcome back in MyBudget."
        title="Cancellation Assist"
        visible={assistVisible}
      >
        <GlassCard padding={16}>
          <Text style={styles.sheetCardLabel}>Provider link</Text>
          <Text style={styles.sheetCardValue}>
            {resolvedMeta.url ?? 'No direct provider URL is saved for this subscription yet.'}
          </Text>
        </GlassCard>
        <View style={styles.listColumn}>
          {resolvedMeta.steps.map((step, index) => (
            <GlassCard key={step} padding={14}>
              <View style={styles.stepRow}>
                <View style={styles.stepBadge}>
                  <Text style={styles.stepBadgeText}>{index + 1}</Text>
                </View>
                <Text style={styles.stepText}>{step}</Text>
              </View>
            </GlassCard>
          ))}
        </View>
      </BudgetBottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  loadingState: {
    flexGrow: 1,
    justifyContent: 'center',
  },
  loadingText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
    textAlign: 'center',
  },
  errorCard: {
    gap: 12,
  },
  errorTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
    color: BG_TEXT,
  },
  errorMessage: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: BG_TEXT_SECONDARY,
  },
  heroMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  heroMetaText: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  heroMetaDivider: {
    color: BG_TEXT_TERTIARY,
  },
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  roiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 14,
  },
  roiLabel: {
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: BG_TEXT_TERTIARY,
  },
  roiValue: {
    marginTop: 6,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 32,
    color: BG_TEXT,
  },
  roiNotes: {
    marginTop: 14,
    paddingTop: 2,
  },
  roiNoteText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
  actionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  listColumn: {
    gap: 10,
  },
  emptyCopy: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  historyCopy: {
    flex: 1,
    gap: 4,
  },
  historyTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  historyMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  historySavings: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_ACCENT_LIGHT,
  },
  sheetActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  sheetCardLabel: {
    fontFamily: BG_FONTS.bold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: BG_TEXT_TERTIARY,
    marginBottom: 8,
  },
  sheetCardValue: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 20,
    color: BG_TEXT_SECONDARY,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  stepBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,184,119,0.18)',
  },
  stepBadgeText: {
    fontFamily: BG_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
    color: BG_ACCENT_LIGHT,
  },
  stepText: {
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: BG_TEXT_SECONDARY,
  },
});
