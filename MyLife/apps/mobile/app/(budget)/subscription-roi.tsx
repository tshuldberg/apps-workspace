import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  getROIReport,
  getSubscriptions,
  listTransactions,
  type CatalogCategory,
  type ROIInput,
  type SubscriptionROI,
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
import {
  allCatalogCategories,
  categoryMeta,
  resolveSubscriptionMeta,
} from '../../components/budget/budgetSubscriptionMeta';

type CategoryFilter = 'all' | CatalogCategory;

type RoiRow = SubscriptionROI & {
  accentColor: string;
  category: CatalogCategory;
  categoryLabel: string;
  glyph: string;
};

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function ninetyDaysAgo(): string {
  const date = new Date();
  date.setDate(date.getDate() - 90);
  return date.toISOString().slice(0, 10);
}

function toneForStatus(status: SubscriptionROI['usageStatus']): 'money' | 'gold' | 'danger' {
  if (status === 'active') return 'money';
  if (status === 'underused') return 'gold';
  return 'danger';
}

export default function SubscriptionROIScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [rows, setRows] = useState<RoiRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);

    try {
      const subscriptions = getSubscriptions(db).filter(
        (subscription) => subscription.status === 'active' || subscription.status === 'trial',
      );
      const transactions = listTransactions(db, {
        from_date: ninetyDaysAgo(),
        limit: 2000,
      });
      const today = new Date().toISOString().slice(0, 10);

      const report = getROIReport(
        subscriptions.map((subscription) => {
          const relatedDates = transactions
            .filter((transaction) => {
              const merchant = transaction.merchant?.toLowerCase();
              return merchant ? merchant.includes(subscription.name.toLowerCase().split(' ')[0] ?? '') : false;
            })
            .map((transaction) => transaction.occurred_on);

          const input: ROIInput = {
            relatedTransactionDates: relatedDates,
            subscription,
            today,
          };
          return input;
        }),
      );

      const nextRows = report.subscriptions.map((row) => {
        const original = subscriptions.find((subscription) => subscription.id === row.subscriptionId);
        const meta = resolveSubscriptionMeta({
          catalog_id: original?.catalog_id ?? null,
          color: original?.color ?? null,
          icon: original?.icon ?? null,
          name: row.subscriptionName,
          url: original?.url ?? null,
        });
        return {
          ...row,
          accentColor: meta.accentColor,
          category: meta.category,
          categoryLabel: meta.categoryLabel,
          glyph: meta.glyph,
        };
      });

      setRows(nextRows);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to build the ROI report.');
      setRows([]);
    } finally {
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredRows = useMemo(
    () => rows.filter((row) => categoryFilter === 'all' || row.category === categoryFilter),
    [categoryFilter, rows],
  );

  const monthlyTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.monthlyCostCents, 0),
    [filteredRows],
  );

  const annualTotal = useMemo(
    () => filteredRows.reduce((sum, row) => sum + row.annualCostCents, 0),
    [filteredRows],
  );

  const lowValueRows = useMemo(
    () => filteredRows.filter((row) => row.usageStatus !== 'active'),
    [filteredRows],
  );

  const highValueRows = useMemo(
    () => filteredRows.filter((row) => row.usageStatus === 'active'),
    [filteredRows],
  );

  const refreshControl = (
    <RefreshControl
      onRefresh={() => {
        setRefreshing(true);
        load();
      }}
      refreshing={refreshing}
      tintColor={categoryMeta('finance').color}
    />
  );

  return (
    <BudgetPhaseScreen refreshControl={refreshControl}>
      <BudgetPhaseHeader
        eyebrow="Subscription ROI"
        eyebrowIcon="insights"
        subtitle="Usage is measured from the last 90 days of linked renewal activity."
        title="Value versus spend"
      />

      <BudgetHeroCard
        detail={`${filteredRows.length} tracked subscriptions · ${formatCurrency(annualTotal)} annualized`}
        subtitle="Current monthly exposure"
        title="Portfolio spend"
        value={formatCurrency(monthlyTotal)}
      />

      <View style={styles.metricRow}>
        <BudgetMetricCard
          caption="Needs review or cancellation"
          label="Low value"
          tone="danger"
          value={String(lowValueRows.length)}
        />
        <BudgetMetricCard
          caption="Consistent recent activity"
          label="High value"
          tone="money"
          value={String(highValueRows.length)}
        />
        <BudgetMetricCard
          caption="Potential savings if cancelled"
          label="Low-value monthly"
          tone="gold"
          value={formatCurrency(
            lowValueRows.reduce((sum, row) => sum + row.monthlyCostCents, 0),
          )}
        />
      </View>

      <BudgetSection
        subtitle="Filter the report by the budget catalog buckets already used by MyBudget."
        title="Categories"
      >
        <View style={styles.chipWrap}>
          <BudgetChip
            active={categoryFilter === 'all'}
            label="All"
            onPress={() => setCategoryFilter('all')}
            tone="gold"
          />
          {allCatalogCategories().map((category) => (
            <BudgetChip
              active={categoryFilter === category}
              key={category}
              label={categoryMeta(category).label}
              onPress={() => setCategoryFilter(category)}
              tone={category === 'finance' || category === 'health' ? 'money' : 'info'}
            />
          ))}
        </View>
      </BudgetSection>

      <BudgetSection subtitle="These subscriptions are weak on recent activity relative to cost." title="Low value">
        {lowValueRows.length > 0 ? (
          <View style={styles.listColumn}>
            {lowValueRows.map((row) => (
              <Pressable
                key={row.subscriptionId}
                onPress={() => router.push(`/(budget)/subscription/${row.subscriptionId}` as never)}
              >
                <GlassCard padding={18}>
                  <View style={styles.rowHeader}>
                    <View style={styles.rowIdentity}>
                      <View style={[styles.glyphShell, { backgroundColor: `${row.accentColor}18` }]}>
                        <Text style={[styles.glyphText, { color: row.accentColor }]}>{row.glyph}</Text>
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{row.subscriptionName}</Text>
                        <Text style={styles.rowMeta}>
                          {row.categoryLabel} · {row.daysSinceLastActivity === null ? 'No recent activity' : `${row.daysSinceLastActivity}d ago`}
                        </Text>
                      </View>
                    </View>
                    <BudgetChip active label={row.usageStatus} tone={toneForStatus(row.usageStatus)} />
                  </View>
                  <View style={styles.rowFooter}>
                    <Text style={styles.rowAmount}>{formatCurrency(row.monthlyCostCents)} / mo</Text>
                    <Text style={styles.rowSummary}>{row.summary}</Text>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        ) : (
          <BudgetEmptyState
            icon="task_alt"
            message="Everything in the current filter has recent activity and looks worth keeping."
            title="No low-value subscriptions"
          />
        )}
      </BudgetSection>

      <BudgetSection
        action={
          <BudgetActionButton
            icon="calendar_month"
            label="Renewal Calendar"
            onPress={() => router.push('/(budget)/renewal-calendar' as never)}
            quiet
            tone="info"
          />
        }
        subtitle="Subscriptions with healthy recent usage stay visible here so you can defend what is working."
        title="High value"
      >
        {highValueRows.length > 0 ? (
          <View style={styles.listColumn}>
            {highValueRows.map((row) => (
              <Pressable
                key={row.subscriptionId}
                onPress={() => router.push(`/(budget)/subscription/${row.subscriptionId}` as never)}
              >
                <GlassCard padding={18}>
                  <View style={styles.rowHeader}>
                    <View style={styles.rowIdentity}>
                      <View style={[styles.glyphShell, { backgroundColor: `${row.accentColor}18` }]}>
                        <Text style={[styles.glyphText, { color: row.accentColor }]}>{row.glyph}</Text>
                      </View>
                      <View style={styles.rowCopy}>
                        <Text style={styles.rowTitle}>{row.subscriptionName}</Text>
                        <Text style={styles.rowMeta}>
                          {row.activityCount} linked event{row.activityCount === 1 ? '' : 's'} · {row.categoryLabel}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.rowAmount}>{formatCurrency(row.monthlyCostCents)} / mo</Text>
                  </View>
                </GlassCard>
              </Pressable>
            ))}
          </View>
        ) : (
          <BudgetEmptyState
            icon="search_off"
            message={error ?? 'No subscriptions matched the current filter.'}
            title="Nothing in this slice"
          />
        )}
      </BudgetSection>
    </BudgetPhaseScreen>
  );
}

const styles = StyleSheet.create({
  metricRow: {
    flexDirection: 'row',
    gap: 12,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  listColumn: {
    gap: 10,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  rowIdentity: {
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
  rowCopy: {
    flex: 1,
    gap: 4,
  },
  rowTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  rowMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  rowFooter: {
    marginTop: 12,
    gap: 6,
  },
  rowAmount: {
    fontFamily: BG_FONTS.extraBold,
    fontSize: 16,
    lineHeight: 20,
    color: BG_TEXT,
  },
  rowSummary: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 18,
    color: BG_TEXT_TERTIARY,
  },
});
