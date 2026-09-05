import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Linking,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import Svg, { Circle } from 'react-native-svg';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_MUTED,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  AmountDisplay,
  GlassCard,
  MaterialSymbol,
  SubscriptionRow,
  cancelSubscription,
  getSubscriptions,
  getUpcomingRenewals,
  normalizeToAnnual,
  normalizeToMonthly,
  pauseSubscription,
  resumeSubscription,
  searchCatalog,
  type BudgetSubscription,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';

type StatusFilter = 'all' | 'active' | 'trial' | 'paused' | 'cancelled';

type CategorySummary = {
  id: string;
  label: string;
  monthlyCost: number;
  color: string;
};

const CATEGORY_COLORS = {
  finance: BG_ACCENT_LIGHT,
  music: '#8BCFF0',
  productivity: '#A78BFA',
  streaming: BG_MONEY,
  utilities: '#F59E0B',
  other: BG_TEXT_MUTED,
} as const;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function getToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysUntil(date: string): number {
  const today = new Date(`${getToday()}T00:00:00`);
  const target = new Date(`${date}T00:00:00`);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function resolveCatalogCategory(subscription: BudgetSubscription): string {
  if (subscription.catalog_id) {
    const idMatch = searchCatalog(subscription.catalog_id).find(
      (entry) => entry.id === subscription.catalog_id,
    );
    if (idMatch) {
      return idMatch.category;
    }
  }

  const nameMatch = searchCatalog(subscription.name).find(
    (entry) => entry.name.toLowerCase() === subscription.name.toLowerCase(),
  );

  return nameMatch?.category ?? 'other';
}

function ActionChip({
  active = false,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon?: string;
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
      {icon ? (
        <MaterialSymbol
          color={active ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
          name={icon}
          size={14}
        />
      ) : null}
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

function CategoryDonut({ categories }: { categories: CategorySummary[] }) {
  const total = categories.reduce((sum, category) => sum + category.monthlyCost, 0);
  const size = 164;
  const strokeWidth = 18;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <View style={styles.donutShell}>
      <Svg height={size} width={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          fill="transparent"
          r={radius}
          stroke={BG_SURFACES.high}
          strokeWidth={strokeWidth}
        />
        {categories.map((category) => {
          const length = total > 0 ? (category.monthlyCost / total) * circumference : 0;
          const dashOffset = circumference - offset;
          offset += length;
          return (
            <Circle
              key={category.id}
              cx={size / 2}
              cy={size / 2}
              fill="transparent"
              r={radius}
              stroke={category.color}
              strokeDasharray={`${Math.max(length, 0)} ${circumference}`}
              strokeDashoffset={dashOffset}
              strokeLinecap="round"
              strokeWidth={strokeWidth}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          );
        })}
      </Svg>
      <View style={styles.donutCenter}>
        <Text style={styles.donutLabel}>Monthly</Text>
        <Text style={styles.donutValue}>{formatCurrency(total)}</Text>
      </View>
    </View>
  );
}

export default function BudgetSubscriptionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();

  const [subscriptions, setSubscriptions] = useState<BudgetSubscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      setSubscriptions(getSubscriptions(db));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load subscriptions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load, params.refresh]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const enrichedSubscriptions = useMemo(
    () =>
      subscriptions.map((subscription) => ({
        category: resolveCatalogCategory(subscription),
        subscription,
      })),
    [subscriptions],
  );

  const categorySummaries = useMemo(() => {
    const totals = new Map<string, number>();

    enrichedSubscriptions.forEach(({ category, subscription }) => {
      const current = totals.get(category) ?? 0;
      totals.set(
        category,
        current + normalizeToMonthly(
          subscription.price,
          subscription.billing_cycle,
          subscription.custom_days,
        ),
      );
    });

    return [...totals.entries()]
      .map(([category, monthlyCost]) => ({
        color: CATEGORY_COLORS[category as keyof typeof CATEGORY_COLORS] ?? CATEGORY_COLORS.other,
        id: category,
        label: category[0].toUpperCase() + category.slice(1),
        monthlyCost,
      }))
      .sort((left, right) => right.monthlyCost - left.monthlyCost);
  }, [enrichedSubscriptions]);

  const filteredSubscriptions = useMemo(
    () =>
      enrichedSubscriptions.filter(({ category, subscription }) => {
        if (statusFilter !== 'all' && subscription.status !== statusFilter) {
          return false;
        }
        if (categoryFilter !== 'all' && category !== categoryFilter) {
          return false;
        }
        return true;
      }),
    [categoryFilter, enrichedSubscriptions, statusFilter],
  );

  const activeSubscriptions = useMemo(
    () =>
      subscriptions.filter(
        (subscription) => subscription.status === 'active' || subscription.status === 'trial',
      ),
    [subscriptions],
  );

  const monthlyTotal = useMemo(
    () =>
      activeSubscriptions.reduce(
        (sum, subscription) =>
          sum +
          normalizeToMonthly(
            subscription.price,
            subscription.billing_cycle,
            subscription.custom_days,
          ),
        0,
      ),
    [activeSubscriptions],
  );

  const annualTotal = useMemo(
    () =>
      activeSubscriptions.reduce(
        (sum, subscription) =>
          sum +
          normalizeToAnnual(
            subscription.price,
            subscription.billing_cycle,
            subscription.custom_days,
          ),
        0,
      ),
    [activeSubscriptions],
  );

  const nextRenewal = useMemo(
    () => getUpcomingRenewals(activeSubscriptions, 45, getToday())[0] ?? null,
    [activeSubscriptions],
  );

  const cycleCategoryFilter = useCallback(() => {
    const options = ['all', ...categorySummaries.map((summary) => summary.id)];
    const currentIndex = options.indexOf(categoryFilter);
    const next = options[(currentIndex + 1) % options.length];
    setCategoryFilter(next);
  }, [categoryFilter, categorySummaries]);

  const handlePauseOrResume = useCallback((subscription: BudgetSubscription) => {
    if (subscription.status === 'paused') {
      resumeSubscription(db, subscription.id);
    } else {
      pauseSubscription(db, subscription.id);
    }
    load();
  }, [db, load]);

  const handleCancel = useCallback(async (subscription: BudgetSubscription) => {
    cancelSubscription(db, subscription.id);
    load();

    if (subscription.url) {
      try {
        await Linking.openURL(subscription.url);
        return;
      } catch {
        // fall through to the alert below
      }
    }

    Alert.alert(
      'Subscription marked as cancelled',
      'No cancellation URL was stored for this subscription, so the status was updated locally only.',
    );
  }, [db, load]);

  const categoryLabel =
    categoryFilter === 'all'
      ? 'All Categories'
      : categorySummaries.find((summary) => summary.id === categoryFilter)?.label ??
        'Category';

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={filteredSubscriptions}
      keyExtractor={({ subscription }) => subscription.id}
      ListEmptyComponent={
        !loading ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No subscriptions in this view</Text>
            <Text style={styles.emptyMessage}>
              Add a service from the catalog or switch filters to see more.
            </Text>
          </GlassCard>
        ) : null
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <GlassCard style={styles.heroCard}>
            <Text style={styles.eyebrow}>Subscriptions</Text>
            <View style={styles.heroMetrics}>
              <View style={styles.heroMetric}>
                <AmountDisplay cents={monthlyTotal} size="lg" type="expense" />
                <Text style={styles.heroMetricLabel}>per month</Text>
              </View>
              <View style={styles.heroDivider} />
              <View style={styles.heroMetric}>
                <AmountDisplay cents={annualTotal} size="lg" type="neutral" />
                <Text style={styles.heroMetricLabel}>per year</Text>
              </View>
            </View>
            <Text style={styles.heroSubtitle}>
              {activeSubscriptions.length} active or trial subscriptions
            </Text>
          </GlassCard>

          {nextRenewal ? (
            <GlassCard style={styles.renewalCard}>
              <View style={styles.renewalHeader}>
                <View style={styles.renewalIcon}>
                  <Text style={styles.renewalEmoji}>{nextRenewal.icon ?? '🔁'}</Text>
                </View>
                <View style={styles.renewalCopy}>
                  <Text style={styles.renewalTitle}>Next renewal</Text>
                  <Text style={styles.renewalName}>{nextRenewal.name}</Text>
                  <Text style={styles.renewalMeta}>
                    {daysUntil(nextRenewal.next_renewal)} days • {nextRenewal.next_renewal}
                  </Text>
                </View>
                <AmountDisplay
                  cents={normalizeToMonthly(
                    nextRenewal.price,
                    nextRenewal.billing_cycle,
                    nextRenewal.custom_days,
                  )}
                  size="md"
                  type="expense"
                />
              </View>
            </GlassCard>
          ) : null}

          <View style={styles.filterGroup}>
            <ScrollView
              contentContainerStyle={styles.filterRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {(['all', 'active', 'trial', 'paused', 'cancelled'] as const).map((value) => (
                <ActionChip
                  active={statusFilter === value}
                  key={value}
                  label={value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
                  onPress={() => setStatusFilter(value)}
                />
              ))}
            </ScrollView>

            <ScrollView
              contentContainerStyle={styles.filterRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <ActionChip
                icon="pie_chart"
                label={categoryLabel}
                onPress={cycleCategoryFilter}
              />
              <ActionChip
                icon="calendar_today"
                label="Calendar View"
                onPress={() => router.push('/(budget)/renewal-calendar')}
              />
            </ScrollView>
          </View>

          <GlassCard style={styles.donutCard}>
            <Text style={styles.sectionTitle}>Categories</Text>
            {categorySummaries.length === 0 ? (
              <Text style={styles.sectionSubtitle}>
                Add subscriptions to see where recurring costs stack up.
              </Text>
            ) : (
              <View style={styles.donutLayout}>
                <CategoryDonut categories={categorySummaries} />
                <View style={styles.legendColumn}>
                  {categorySummaries.slice(0, 5).map((summary) => (
                    <View key={summary.id} style={styles.legendRow}>
                      <View
                        style={[styles.legendDot, { backgroundColor: summary.color }]}
                      />
                      <View style={styles.legendCopy}>
                        <Text style={styles.legendLabel}>{summary.label}</Text>
                        <Text style={styles.legendValue}>
                          {formatCurrency(summary.monthlyCost)}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </GlassCard>

          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => router.push('/(budget)/subscription-roi')}
              style={styles.secondaryButton}
            >
              <MaterialSymbol color={BG_TEXT} name="trending_down" size={16} />
              <Text style={styles.secondaryButtonLabel}>ROI Report</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(budget)/subscription/add')}
              style={styles.primaryButton}
            >
              <MaterialSymbol color={BG_SURFACES.lowest} name="add" size={16} />
              <Text style={styles.primaryButtonLabel}>Add Subscription</Text>
            </Pressable>
          </View>

          {error ? (
            <GlassCard style={styles.errorCard}>
              <Text style={styles.errorTitle}>Subscriptions unavailable</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </GlassCard>
          ) : null}
        </View>
      }
      refreshControl={
        <RefreshControl
          colors={[BG_ACCENT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={BG_ACCENT}
        />
      }
      renderItem={({ item }) => {
        const subscription = item.subscription;

        return (
          <Swipeable
            renderLeftActions={() => (
              <View style={styles.leftActionWrap}>
                <Pressable
                  onPress={() => handlePauseOrResume(subscription)}
                  style={styles.pauseAction}
                >
                  <MaterialSymbol
                    color={BG_SURFACES.lowest}
                    name={subscription.status === 'paused' ? 'check_circle' : 'schedule'}
                    size={16}
                  />
                  <Text style={styles.actionTextDark}>
                    {subscription.status === 'paused' ? 'Resume' : 'Pause'}
                  </Text>
                </Pressable>
              </View>
            )}
            renderRightActions={() => (
              <View style={styles.rightActionWrap}>
                <Pressable
                  onPress={() => handleCancel(subscription)}
                  style={styles.cancelAction}
                >
                  <MaterialSymbol color={BG_TEXT} name="close" size={16} />
                  <Text style={styles.actionTextLight}>Cancel</Text>
                </Pressable>
              </View>
            )}
          >
            <SubscriptionRow
              categoryLabel={item.category[0].toUpperCase() + item.category.slice(1)}
              onPress={() => router.push(`/(budget)/subscription/${subscription.id}`)}
              subscription={subscription}
            />
          </Swipeable>
        );
      }}
      style={styles.container}
    />
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
    marginBottom: 16,
  },
  heroCard: {
    gap: 12,
  },
  eyebrow: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  heroMetrics: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
    justifyContent: 'space-between',
  },
  heroMetric: {
    flex: 1,
    gap: 4,
  },
  heroDivider: {
    backgroundColor: BG_SURFACES.high,
    height: 52,
    width: 1,
  },
  heroMetricLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  renewalCard: {
    gap: 10,
  },
  renewalHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  renewalIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  renewalEmoji: {
    fontSize: 18,
  },
  renewalCopy: {
    flex: 1,
    gap: 2,
  },
  renewalTitle: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  renewalName: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  renewalMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  filterGroup: {
    gap: 10,
  },
  filterRow: {
    gap: 8,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  donutCard: {
    gap: 14,
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  sectionSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  donutLayout: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
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
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.bold,
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
  emptyCard: {
    gap: 8,
    marginTop: 12,
  },
  emptyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  emptyMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  leftActionWrap: {
    justifyContent: 'center',
    marginBottom: 12,
    marginRight: 10,
  },
  pauseAction: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 72,
    paddingHorizontal: 16,
    width: 104,
  },
  rightActionWrap: {
    justifyContent: 'center',
    marginBottom: 12,
    marginLeft: 10,
  },
  cancelAction: {
    alignItems: 'center',
    backgroundColor: BG_DANGER,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 72,
    paddingHorizontal: 16,
    width: 104,
  },
  actionTextDark: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  actionTextLight: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
});
