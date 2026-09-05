import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  calculateAvalanche,
  calculateSnowball,
  getDebtPayoffPlans,
  getDebtsByPlan,
  type DebtInput,
  type DebtPayoffDebt,
  type DebtPayoffPlan,
} from '@mylife/budget';
import {
  BudgetStatusPill,
  BudgetSteppedSlider,
  formatBudgetCurrency,
  formatBudgetMonth,
} from '../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../components/DatabaseProvider';

type StrategyMode = 'avalanche' | 'custom' | 'snowball';

type PlanInsight = {
  debts: DebtPayoffDebt[];
  plan: DebtPayoffPlan;
  totalBalance: number;
  totalMinimum: number;
};

function formatApr(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}% APR`;
}

function getPayoffMonthLabel(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return formatBudgetMonth(date.toISOString());
}

function toDebtInputs(debts: DebtPayoffDebt[]): DebtInput[] {
  return debts.map((debt) => ({
    balance: debt.balance,
    id: debt.id,
    interestRate: debt.interest_rate,
    minimumPayment: debt.minimum_payment,
    name: debt.name,
  }));
}

export default function DebtPayoffScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [plans, setPlans] = useState<PlanInsight[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [previewMethod, setPreviewMethod] = useState<StrategyMode>('snowball');
  const [previewExtraPayment, setPreviewExtraPayment] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    try {
      const loadedPlans = getDebtPayoffPlans(db)
        .map((plan) => {
          const debts = getDebtsByPlan(db, plan.id);
          return {
            debts,
            plan,
            totalBalance: debts.reduce((sum, debt) => sum + debt.balance, 0),
            totalMinimum: debts.reduce((sum, debt) => sum + debt.minimum_payment, 0),
          };
        })
        .sort((a, b) => b.plan.created_at.localeCompare(a.plan.created_at));

      setPlans(loadedPlans);
      if (loadedPlans.length > 0) {
        setSelectedPlanId((current) => current ?? loadedPlans[0].plan.id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load debt payoff plans.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan.plan.id === selectedPlanId) ?? plans[0] ?? null,
    [plans, selectedPlanId],
  );

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    setPreviewMethod(selectedPlan.plan.strategy);
    setPreviewExtraPayment(selectedPlan.plan.extra_payment);
  }, [selectedPlan]);

  const strategyInputs = useMemo(
    () => toDebtInputs(selectedPlan?.debts ?? []),
    [selectedPlan],
  );

  const avalanche = useMemo(
    () => calculateAvalanche(strategyInputs, previewExtraPayment),
    [previewExtraPayment, strategyInputs],
  );
  const snowball = useMemo(
    () => calculateSnowball(strategyInputs, previewExtraPayment),
    [previewExtraPayment, strategyInputs],
  );

  const currentResult = previewMethod === 'avalanche' ? avalanche : snowball;
  const comparisonResult = previewMethod === 'avalanche' ? snowball : avalanche;

  const previewExtraValues = useMemo(() => {
    const rawValues = [
      0,
      selectedPlan?.plan.extra_payment ?? 0,
      25_00,
      100_00,
      250_00,
      500_00,
      1_000_00,
    ];

    return Array.from(new Set(rawValues.filter((value) => value >= 0))).sort(
      (a, b) => a - b,
    );
  }, [selectedPlan]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading debt payoff plans…</Text>
        </GlassCard>
      </View>
    );
  }

  if (plans.length === 0) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>Create your first payoff plan</Text>
          <Text style={styles.emptyBody}>
            Compare snowball and avalanche strategies, then track every debt from one hub.
          </Text>
          <Pressable
            onPress={() => router.push('/(budget)/debt-payoff/create' as never)}
            style={styles.primaryButton}
          >
            <Text style={styles.primaryButtonLabel}>New Payoff Plan</Text>
          </Pressable>
        </GlassCard>
      </View>
    );
  }

  if (!selectedPlan) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>{error ?? 'No debt plan selected.'}</Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.eyebrow}>Financial Freedom</Text>
            <Text style={styles.heroTitle}>Debt Payoff</Text>
            <Text style={styles.heroSubtitle}>{selectedPlan.plan.name}</Text>
          </View>
          <View style={styles.heroBadge}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="payments" size={22} />
          </View>
        </View>

        <Text style={styles.heroAmount}>
          {formatBudgetCurrency(selectedPlan.totalBalance)}
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Projected payoff</Text>
            <Text style={styles.heroStatValue}>
              {getPayoffMonthLabel(currentResult.totalMonths)}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Monthly payment</Text>
            <Text style={styles.heroStatValue}>
              {formatBudgetCurrency(selectedPlan.totalMinimum + previewExtraPayment)}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Interest</Text>
            <Text style={[styles.heroStatValue, { color: BG_DANGER }]}>
              {formatBudgetCurrency(currentResult.totalInterest)}
            </Text>
          </View>
        </View>
      </GlassCard>

      {plans.length > 1 ? (
        <View style={styles.planTabs}>
          {plans.map((plan) => {
            const selected = plan.plan.id === selectedPlan.plan.id;
            return (
              <GlassCard
                key={plan.plan.id}
                onPress={() => setSelectedPlanId(plan.plan.id)}
                padding={0}
                style={[styles.planChip, selected ? styles.planChipSelected : null]}
              >
                <Text
                  style={[
                    styles.planChipLabel,
                    selected ? styles.planChipLabelSelected : null,
                  ]}
                >
                  {plan.plan.name}
                </Text>
              </GlassCard>
            );
          })}
        </View>
      ) : null}

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Method Preview</Text>
        <View style={styles.methodRow}>
          <Pressable
            onPress={() => setPreviewMethod('snowball')}
            style={[
              styles.methodChip,
              previewMethod === 'snowball' ? styles.methodChipSelected : null,
            ]}
          >
            <Text
              style={[
                styles.methodChipLabel,
                previewMethod === 'snowball' ? styles.methodChipLabelSelected : null,
              ]}
            >
              Snowball
            </Text>
          </Pressable>
          <Pressable
            onPress={() => setPreviewMethod('avalanche')}
            style={[
              styles.methodChip,
              previewMethod === 'avalanche' ? styles.methodChipSelected : null,
            ]}
          >
            <Text
              style={[
                styles.methodChipLabel,
                previewMethod === 'avalanche' ? styles.methodChipLabelSelected : null,
              ]}
            >
              Avalanche
            </Text>
          </Pressable>
          <View style={[styles.methodChip, styles.methodChipDisabled]}>
            <Text style={styles.methodChipDisabledLabel}>Custom</Text>
          </View>
        </View>

        <BudgetSteppedSlider
          label="Extra monthly payment"
          labels={previewExtraValues.map((value) => formatBudgetCurrency(value))}
          onChange={setPreviewExtraPayment}
          value={previewExtraPayment}
          valueFormatter={(value) => formatBudgetCurrency(value)}
          values={previewExtraValues}
        />

        <View style={styles.comparisonRow}>
          <View style={styles.comparisonCard}>
            <BudgetStatusPill
              label={previewMethod === 'avalanche' ? 'Efficient' : 'Momentum'}
              tone={previewMethod === 'avalanche' ? 'info' : 'accent'}
            />
            <Text style={styles.comparisonTitle}>
              {previewMethod === 'avalanche' ? 'Avalanche' : 'Snowball'}
            </Text>
            <Text style={styles.comparisonValue}>{currentResult.totalMonths} months</Text>
            <Text style={styles.comparisonMeta}>
              {formatBudgetCurrency(currentResult.totalInterest)} interest
            </Text>
          </View>
          <View style={styles.comparisonCard}>
            <BudgetStatusPill
              label={previewMethod === 'avalanche' ? 'Alternate' : 'Alternate'}
              tone="neutral"
            />
            <Text style={styles.comparisonTitle}>
              {previewMethod === 'avalanche' ? 'Snowball' : 'Avalanche'}
            </Text>
            <Text style={styles.comparisonValue}>
              {comparisonResult.totalMonths} months
            </Text>
            <Text style={styles.comparisonMeta}>
              {formatBudgetCurrency(comparisonResult.totalInterest)} interest
            </Text>
          </View>
        </View>

        <Text style={styles.interestNote}>
          {previewMethod === 'custom'
            ? 'Custom ordering is not persisted by the current plan model.'
            : `${previewMethod === 'avalanche' ? 'Avalanche' : 'Snowball'} saves ${formatBudgetCurrency(
                Math.max(
                  0,
                  comparisonResult.totalInterest - currentResult.totalInterest,
                ),
              )} in interest versus the alternate strategy.`}
        </Text>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Debts</Text>
          <Pressable
            onPress={() => router.push('/(budget)/debt-payoff/create' as never)}
            style={styles.inlineButton}
          >
            <Text style={styles.inlineButtonLabel}>Create Plan</Text>
          </Pressable>
        </View>

        {selectedPlan.debts.map((debt) => (
          <Pressable
            key={debt.id}
            onPress={() => router.push(`/(budget)/debt-payoff/${selectedPlan.plan.id}` as never)}
            style={styles.debtRow}
          >
            <View style={styles.debtLead}>
              <View style={styles.debtIcon}>
                <MaterialSymbol color={BG_ACCENT_LIGHT} name="credit_card" size={18} />
              </View>
              <View style={styles.debtCopy}>
                <Text style={styles.debtName}>{debt.name}</Text>
                <Text style={styles.debtMeta}>
                  {formatApr(debt.interest_rate)} · Minimum{' '}
                  {formatBudgetCurrency(debt.minimum_payment)}
                </Text>
              </View>
            </View>
            <View style={styles.debtRight}>
              <Text style={styles.debtBalance}>
                {formatBudgetCurrency(debt.balance)}
              </Text>
              <Text style={styles.debtEta}>
                {getPayoffMonthLabel(
                  Math.max(
                    1,
                    previewMethod === 'avalanche'
                      ? avalanche.totalMonths
                      : snowball.totalMonths,
                  ),
                )}
              </Text>
            </View>
          </Pressable>
        ))}
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
  centered: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  loadingCard: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    width: '100%',
  },
  loadingText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
  },
  emptyCard: {
    alignItems: 'center',
    gap: 12,
    minHeight: 240,
    justifyContent: 'center',
    width: '100%',
  },
  emptyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 24,
    lineHeight: 28,
    textAlign: 'center',
  },
  emptyBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
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
    fontFamily: BG_FONTS.medium,
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
  heroAmount: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
  },
  heroStats: {
    flexDirection: 'row',
    gap: 10,
  },
  heroStat: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  heroStatLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroStatValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  planTabs: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  planChip: {
    borderRadius: 999,
  },
  planChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  planChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  planChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
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
  methodRow: {
    flexDirection: 'row',
    gap: 10,
  },
  methodChip: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 14,
  },
  methodChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  methodChipDisabled: {
    opacity: 0.45,
  },
  methodChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  methodChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  methodChipDisabledLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  comparisonRow: {
    flexDirection: 'row',
    gap: 10,
  },
  comparisonCard: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 8,
    padding: 16,
  },
  comparisonTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  comparisonValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 28,
    lineHeight: 30,
  },
  comparisonMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  interestNote: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  inlineButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 12,
  },
  inlineButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  debtRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  debtLead: {
    alignItems: 'center',
    flex: 1,
    flexDirection: 'row',
    gap: 12,
  },
  debtIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  debtCopy: {
    flex: 1,
    gap: 4,
  },
  debtName: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  debtMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  debtRight: {
    alignItems: 'flex-end',
    gap: 4,
  },
  debtBalance: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  debtEta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
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
