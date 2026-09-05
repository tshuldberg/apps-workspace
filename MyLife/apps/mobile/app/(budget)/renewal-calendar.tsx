import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  getSubscriptions,
  getUpcomingRenewals,
  normalizeToMonthly,
  type BudgetSubscription,
} from '@mylife/budget';
import { useDatabase } from '../../components/DatabaseProvider';
import {
  BudgetEmptyState,
  BudgetHeroCard,
  BudgetMetricCard,
  BudgetPhaseHeader,
  BudgetPhaseScreen,
  BudgetSection,
} from '../../components/budget/BudgetPhase5Kit';
import { resolveSubscriptionMeta } from '../../components/budget/budgetSubscriptionMeta';

type RenewalBucket = {
  id: string;
  label: string;
  subscriptions: BudgetSubscription[];
};

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
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function daysUntil(isoDate: string): number {
  const today = new Date(new Date().toISOString().slice(0, 10));
  const target = new Date(`${isoDate}T00:00:00`);
  return Math.max(0, Math.round((target.getTime() - today.getTime()) / 86400000));
}

function bucketRenewals(subscriptions: BudgetSubscription[]): RenewalBucket[] {
  const buckets: RenewalBucket[] = [
    { id: 'week', label: 'This week', subscriptions: [] },
    { id: 'next', label: 'Next two weeks', subscriptions: [] },
    { id: 'month', label: 'Later this month', subscriptions: [] },
  ];

  subscriptions.forEach((subscription) => {
    const delta = daysUntil(subscription.next_renewal);
    if (delta <= 7) {
      buckets[0].subscriptions.push(subscription);
    } else if (delta <= 21) {
      buckets[1].subscriptions.push(subscription);
    } else {
      buckets[2].subscriptions.push(subscription);
    }
  });

  return buckets.filter((bucket) => bucket.subscriptions.length > 0);
}

export default function RenewalCalendarScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [subscriptions, setSubscriptions] = useState<BudgetSubscription[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = () => {
    try {
      const activeSubscriptions = getSubscriptions(db).filter(
        (subscription) => subscription.status === 'active' || subscription.status === 'trial',
      );
      setSubscriptions(getUpcomingRenewals(activeSubscriptions, 30));
    } catch {
      setSubscriptions([]);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  }, [db]);

  const buckets = useMemo(() => bucketRenewals(subscriptions), [subscriptions]);
  const totalMonthlyExposure = useMemo(
    () =>
      subscriptions.reduce(
        (sum, subscription) =>
          sum + normalizeToMonthly(subscription.price, subscription.billing_cycle, subscription.custom_days),
        0,
      ),
    [subscriptions],
  );
  const nearestRenewal = subscriptions[0]?.next_renewal ?? null;

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
        eyebrow="Renewals"
        eyebrowIcon="event_repeat"
        subtitle="The next 30 days, grouped by urgency, so recurring costs do not sneak up on your plan."
        title="Renewal calendar"
      />

      <BudgetHeroCard
        detail={nearestRenewal ? `Nearest renewal ${formatDate(nearestRenewal)}` : 'No active renewals scheduled'}
        subtitle={`${subscriptions.length} bills due in the next 30 days`}
        title="Upcoming spend"
        value={formatCurrency(totalMonthlyExposure)}
      />

      <View style={styles.metricRow}>
        <BudgetMetricCard
          caption="Bills due in seven days"
          label="This week"
          tone="danger"
          value={String(buckets.find((bucket) => bucket.id === 'week')?.subscriptions.length ?? 0)}
        />
        <BudgetMetricCard
          caption="Bills due in days 8-21"
          label="Next window"
          tone="gold"
          value={String(buckets.find((bucket) => bucket.id === 'next')?.subscriptions.length ?? 0)}
        />
        <BudgetMetricCard
          caption="Bills due in days 22-30"
          label="End of month"
          tone="info"
          value={String(buckets.find((bucket) => bucket.id === 'month')?.subscriptions.length ?? 0)}
        />
      </View>

      {buckets.length > 0 ? (
        buckets.map((bucket) => (
          <BudgetSection
            key={bucket.id}
            subtitle={`${bucket.subscriptions.length} subscription${bucket.subscriptions.length === 1 ? '' : 's'}`}
            title={bucket.label}
          >
            <View style={styles.listColumn}>
              {bucket.subscriptions.map((subscription) => {
                const meta = resolveSubscriptionMeta(subscription);
                return (
                  <Pressable
                    key={subscription.id}
                    onPress={() => router.push(`/(budget)/subscription/${subscription.id}` as never)}
                  >
                    <GlassCard padding={18}>
                      <View style={styles.row}>
                        <View style={styles.left}>
                          <View
                            style={[
                              styles.glyphShell,
                              { backgroundColor: `${meta.accentColor}18` },
                            ]}
                          >
                            <Text style={[styles.glyphText, { color: meta.accentColor }]}>
                              {meta.glyph}
                            </Text>
                          </View>
                          <View style={styles.copy}>
                            <Text style={styles.title}>{subscription.name}</Text>
                            <Text style={styles.meta}>
                              {meta.categoryLabel} · {formatDate(subscription.next_renewal)}
                            </Text>
                          </View>
                        </View>
                        <View style={styles.trailing}>
                          <Text style={styles.amount}>{formatCurrency(subscription.price)}</Text>
                          <Text style={styles.countdown}>
                            {daysUntil(subscription.next_renewal)}d
                          </Text>
                        </View>
                      </View>
                    </GlassCard>
                  </Pressable>
                );
              })}
            </View>
          </BudgetSection>
        ))
      ) : (
        <BudgetEmptyState
          icon="event_available"
          message="You do not have any active renewals in the next 30 days."
          title="All clear"
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
  listColumn: {
    gap: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  left: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  glyphShell: {
    width: 46,
    height: 46,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: BG_SURFACES.high,
  },
  glyphText: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 20,
    lineHeight: 22,
  },
  copy: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  meta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  countdown: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
});
