import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  AmountDisplay,
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  buildPerformanceTimeline,
  calculateAllocation,
  calculateHoldingGainLoss,
  calculatePortfolioSummary,
  createHolding,
  createHoldingSnapshot,
  getActiveHoldings,
  getHoldingSnapshots,
  updateHolding,
  type AllocationEntry,
  type AssetClass,
  type Holding,
  type HoldingGainLoss,
  type HoldingInput,
  type HoldingSnapshot,
  type PortfolioSummary,
} from '@mylife/budget';
import {
  BudgetDonutChart,
  BudgetLineChart,
  BudgetStatusPill,
  PHASE3_CHART_COLORS,
  formatBudgetCurrency,
  formatBudgetPercent,
} from '../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const PERIODS = ['1M', '3M', '6M', 'All'] as const;
const ASSET_CLASSES: AssetClass[] = [
  'stock',
  'etf',
  'bond',
  'crypto',
  'cash_equivalent',
  'other',
];

function resolveHoldingInput(holding: Holding): HoldingInput {
  const currentPrice =
    holding.current_price ??
    (holding.current_value != null && holding.shares > 0
      ? Math.round(holding.current_value / holding.shares)
      : Math.round(holding.cost_basis / Math.max(holding.shares, 1)));

  return {
    assetClass: holding.asset_class,
    costBasis: holding.cost_basis,
    currentPrice,
    id: holding.id,
    isActive: holding.is_active === 1,
    name: holding.name,
    shares: holding.shares,
    symbol: holding.symbol,
  };
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function InvestmentsScreen() {
  const db = useDatabase();

  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [portfolio, setPortfolio] = useState<PortfolioSummary | null>(null);
  const [allocation, setAllocation] = useState<AllocationEntry[]>([]);
  const [gains, setGains] = useState<Map<string, HoldingGainLoss>>(new Map());
  const [timeline, setTimeline] = useState<Array<{ date: string; totalValue: number }>>([]);
  const [period, setPeriod] = useState<(typeof PERIODS)[number]>('All');
  const [showAddForm, setShowAddForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [symbol, setSymbol] = useState('');
  const [holdingName, setHoldingName] = useState('');
  const [shares, setShares] = useState('');
  const [costBasis, setCostBasis] = useState('');
  const [currentPrice, setCurrentPrice] = useState('');
  const [assetClass, setAssetClass] = useState<AssetClass>('stock');

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const nextHoldings = getActiveHoldings(db);
      const holdingInputs = nextHoldings.map(resolveHoldingInput);
      const snapshots: HoldingSnapshot[] = [];

      nextHoldings.forEach((holding) => {
        snapshots.push(...getHoldingSnapshots(db, holding.id));
      });

      setHoldings(nextHoldings);
      setPortfolio(calculatePortfolioSummary(holdingInputs));
      setAllocation(calculateAllocation(holdingInputs));
      setGains(
        new Map(
          holdingInputs.map((holding) => [
            holding.id,
            calculateHoldingGainLoss(holding),
          ]),
        ),
      );

      const mergedTimeline = buildPerformanceTimeline(
        snapshots.map((snapshot) => ({
          date: snapshot.date,
          totalValue: snapshot.total_value,
        })),
      );
      setTimeline(mergedTimeline);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load investments.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const filteredTimeline = useMemo(() => {
    if (period === 'All' || timeline.length === 0) {
      return timeline;
    }

    const months = period === '1M' ? 1 : period === '3M' ? 3 : 6;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);

    return timeline.filter((point) => new Date(point.date) >= cutoff);
  }, [period, timeline]);

  const handleAddHolding = () => {
    const parsedShares = Number(shares);
    const parsedCostBasis = Math.round(Number(costBasis) * 100);
    const parsedCurrentPrice = Math.round(Number(currentPrice || '0') * 100);

    if (!symbol.trim() || !holdingName.trim()) {
      setError('Ticker and holding name are required.');
      return;
    }
    if (!Number.isFinite(parsedShares) || parsedShares <= 0) {
      setError('Shares must be greater than zero.');
      return;
    }
    if (!Number.isFinite(parsedCostBasis) || parsedCostBasis < 0) {
      setError('Cost basis must be a valid number.');
      return;
    }

    try {
      createHolding(db, uuid(), {
        account_id: 'manual-investments',
        asset_class: assetClass,
        cost_basis: parsedCostBasis,
        current_price: parsedCurrentPrice > 0 ? parsedCurrentPrice : null,
        current_value:
          parsedCurrentPrice > 0 ? Math.round(parsedShares * parsedCurrentPrice) : null,
        name: holdingName.trim(),
        shares: parsedShares,
        symbol: symbol.trim().toUpperCase(),
      });
      setSymbol('');
      setHoldingName('');
      setShares('');
      setCostBasis('');
      setCurrentPrice('');
      setAssetClass('stock');
      setShowAddForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add holding.');
    }
  };

  const handleRefreshPrices = () => {
    try {
      const today = todayISO();
      holdings.forEach((holding) => {
        const current = resolveHoldingInput(holding);
        const currentValue = Math.round(current.shares * current.currentPrice);

        updateHolding(db, holding.id, {
          current_value: currentValue,
          last_price_update: new Date().toISOString(),
        });

        createHoldingSnapshot(db, uuid(), {
          date: today,
          holding_id: holding.id,
          price_per_share: current.currentPrice,
          shares: current.shares,
          total_value: currentValue,
        });
      });
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to refresh prices.');
    }
  };

  const donutSegments = allocation.map((entry, index) => ({
    color: PHASE3_CHART_COLORS[index % PHASE3_CHART_COLORS.length],
    label: entry.assetClass,
    value: entry.value,
  }));

  const chartPoints = filteredTimeline.map((point) => ({
    label: new Date(point.date).toLocaleDateString('en-US', { month: 'short' }),
    value: point.totalValue,
  }));

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={BG_ACCENT} />
      }
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.eyebrow}>Portfolio</Text>
            <Text style={styles.heroTitle}>Investments</Text>
            <Text style={styles.heroSubtitle}>
              Track every holding, model allocation, and snapshot returns over time.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="trending_up" size={24} />
          </View>
        </View>

        <AmountDisplay cents={portfolio?.totalValue ?? 0} size="xl" />

        <View style={styles.returnRow}>
          <BudgetStatusPill
            label={
              portfolio && portfolio.totalGainLoss >= 0 ? 'Positive Return' : 'Drawdown'
            }
            tone={portfolio && portfolio.totalGainLoss >= 0 ? 'positive' : 'danger'}
          />
          <Text style={styles.returnText}>
            {portfolio
              ? `${formatBudgetCurrency(portfolio.totalGainLoss, { signed: true })} · ${formatBudgetPercent(
                  portfolio.totalReturnPct,
                )}`
              : '$0.00 · 0.0%'}
          </Text>
        </View>

        <View style={styles.heroActions}>
          <Pressable onPress={() => setShowAddForm((current) => !current)} style={styles.inlineButton}>
            <Text style={styles.inlineButtonLabel}>
              {showAddForm ? 'Close Form' : 'Add Holding'}
            </Text>
          </Pressable>
          <Pressable onPress={handleRefreshPrices} style={styles.inlineButton}>
            <Text style={styles.inlineButtonLabel}>Refresh Prices</Text>
          </Pressable>
        </View>
      </GlassCard>

      {showAddForm ? (
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Add Holding</Text>

          <View style={styles.fieldRow}>
            <View style={styles.fieldFlex}>
              <Text style={styles.fieldLabel}>Ticker</Text>
              <TextInput
                value={symbol}
                onChangeText={setSymbol}
                placeholder="AAPL"
                placeholderTextColor={BG_TEXT_TERTIARY}
                autoCapitalize="characters"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldFlex}>
              <Text style={styles.fieldLabel}>Name</Text>
              <TextInput
                value={holdingName}
                onChangeText={setHoldingName}
                placeholder="Apple"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.assetClassWrap}>
            {ASSET_CLASSES.map((option) => {
              const selected = option === assetClass;
              return (
                <Pressable
                  key={option}
                  onPress={() => setAssetClass(option)}
                  style={[
                    styles.assetClassChip,
                    selected ? styles.assetClassChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.assetClassLabel,
                      selected ? styles.assetClassLabelSelected : null,
                    ]}
                  >
                    {option.replace(/_/g, ' ')}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldFlex}>
              <Text style={styles.fieldLabel}>Shares</Text>
              <TextInput
                value={shares}
                onChangeText={setShares}
                placeholder="10"
                placeholderTextColor={BG_TEXT_TERTIARY}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldFlex}>
              <Text style={styles.fieldLabel}>Cost Basis</Text>
              <TextInput
                value={costBasis}
                onChangeText={setCostBasis}
                placeholder="1750.00"
                placeholderTextColor={BG_TEXT_TERTIARY}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldFlex}>
              <Text style={styles.fieldLabel}>Current Price</Text>
              <TextInput
                value={currentPrice}
                onChangeText={setCurrentPrice}
                placeholder="190.25"
                placeholderTextColor={BG_TEXT_TERTIARY}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>

          <Pressable onPress={handleAddHolding} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>Save Holding</Text>
          </Pressable>
        </GlassCard>
      ) : null}

      <View style={styles.splitRow}>
        <GlassCard style={styles.splitCard}>
          <Text style={styles.sectionTitle}>Allocation</Text>
          {donutSegments.length > 0 ? (
            <>
              <BudgetDonutChart
                centerLabel="Diversified"
                centerValue={`${allocation.length} classes`}
                segments={donutSegments}
              />
              <View style={styles.legendList}>
                {allocation.map((entry, index) => (
                  <View key={entry.assetClass} style={styles.legendRow}>
                    <View style={styles.legendLead}>
                      <View
                        style={[
                          styles.legendDot,
                          { backgroundColor: PHASE3_CHART_COLORS[index % PHASE3_CHART_COLORS.length] },
                        ]}
                      />
                      <Text style={styles.legendLabel}>
                        {entry.assetClass.replace(/_/g, ' ')}
                      </Text>
                    </View>
                    <Text style={styles.legendValue}>
                      {entry.percentage.toFixed(1)}%
                    </Text>
                  </View>
                ))}
              </View>
            </>
          ) : (
            <Text style={styles.emptyText}>Add holdings to see allocation.</Text>
          )}
        </GlassCard>

        <GlassCard style={styles.splitCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Performance</Text>
            <View style={styles.periodRow}>
              {PERIODS.map((option) => {
                const selected = option === period;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setPeriod(option)}
                    style={[
                      styles.periodChip,
                      selected ? styles.periodChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.periodLabel,
                        selected ? styles.periodLabelSelected : null,
                      ]}
                    >
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {chartPoints.length >= 2 ? (
            <BudgetLineChart color={BG_ACCENT_LIGHT} data={chartPoints} />
          ) : (
            <Text style={styles.emptyText}>
              Refresh prices to start building a portfolio timeline.
            </Text>
          )}
        </GlassCard>
      </View>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Holdings</Text>
          <Text style={styles.sectionMeta}>
            {portfolio?.holdingCount ?? 0} active positions
          </Text>
        </View>

        {holdings.length === 0 ? (
          <Text style={styles.emptyText}>No holdings yet. Add your first position.</Text>
        ) : (
          holdings
            .map((holding) => ({
              gain: gains.get(holding.id),
              holding,
            }))
            .sort((a, b) => (b.gain?.currentValue ?? 0) - (a.gain?.currentValue ?? 0))
            .map(({ gain, holding }) => (
              <View key={holding.id} style={styles.holdingRow}>
                <View style={styles.holdingLead}>
                  <View style={styles.holdingIcon}>
                    <Text style={styles.holdingIconText}>{holding.symbol.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.holdingCopy}>
                    <Text style={styles.holdingTitle}>{holding.symbol}</Text>
                    <Text style={styles.holdingMeta}>
                      {holding.name} · {holding.shares} shares · {holding.asset_class.replace(/_/g, ' ')}
                    </Text>
                  </View>
                </View>
                <View style={styles.holdingRight}>
                  <Text style={styles.holdingValue}>
                    {formatBudgetCurrency(gain?.currentValue ?? 0)}
                  </Text>
                  <Text
                    style={[
                      styles.holdingReturn,
                      {
                        color:
                          (gain?.gainLoss ?? 0) >= 0 ? BG_MONEY : BG_DANGER,
                      },
                    ]}
                  >
                    {formatBudgetCurrency(gain?.gainLoss ?? 0, { signed: true })} ·{' '}
                    {formatBudgetPercent(gain?.returnPct ?? 0)}
                  </Text>
                </View>
              </View>
            ))
        )}
      </GlassCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.base,
    flex: 1,
  },
  content: {
    gap: 16,
    padding: 16,
    paddingBottom: 96,
  },
  heroCard: {
    gap: 16,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  eyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 30,
    lineHeight: 34,
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 4,
  },
  heroBadge: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  returnRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  returnText: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'right',
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  inlineButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 16,
    flex: 1,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  inlineButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionCard: {
    gap: 14,
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  fieldRow: {
    flexDirection: 'row',
    gap: 10,
  },
  fieldFlex: {
    flex: 1,
    gap: 6,
  },
  fieldLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  assetClassWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  assetClassChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  assetClassChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  assetClassLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  assetClassLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonLabel: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  splitRow: {
    flexDirection: 'row',
    gap: 16,
  },
  splitCard: {
    flex: 1,
    gap: 14,
  },
  legendList: {
    gap: 10,
  },
  legendRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  legendLead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  legendDot: {
    borderRadius: 999,
    height: 10,
    width: 10,
  },
  legendLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  legendValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  periodRow: {
    flexDirection: 'row',
    gap: 8,
  },
  periodChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  periodChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  periodLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
  },
  periodLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  emptyText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionMeta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  holdingRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  holdingLead: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  holdingIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  holdingIconText: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  holdingCopy: {
    flex: 1,
    gap: 4,
  },
  holdingTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  holdingMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  holdingRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  holdingValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  holdingReturn: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
