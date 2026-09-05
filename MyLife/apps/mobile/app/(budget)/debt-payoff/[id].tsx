import React, { useEffect, useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
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
  generateAmortizationSchedule,
  getDebtPayoffPlanById,
  getDebtsByPlan,
  projectPayoffDate,
  type DebtPayoffDebt,
  type DebtPayoffPlan,
} from '@mylife/budget';
import {
  BudgetStatusPill,
  BudgetSteppedSlider,
  formatBudgetCurrency,
  formatBudgetMonth,
} from '../../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../../components/DatabaseProvider';

function formatApr(basisPoints: number): string {
  return `${(basisPoints / 100).toFixed(2)}% APR`;
}

function getFutureMonthLabel(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return formatBudgetMonth(date.toISOString());
}

export default function DebtPayoffDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const planId = Array.isArray(id) ? id[0] : id;

  const [plan, setPlan] = useState<DebtPayoffPlan | null>(null);
  const [debts, setDebts] = useState<DebtPayoffDebt[]>([]);
  const [selectedDebtId, setSelectedDebtId] = useState<string | null>(null);
  const [previewExtraPayment, setPreviewExtraPayment] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) {
      setError('Debt payoff plan not found.');
      setLoading(false);
      return;
    }

    try {
      const loadedPlan = getDebtPayoffPlanById(db, planId);
      if (!loadedPlan) {
        setError('Debt payoff plan not found.');
        setLoading(false);
        return;
      }

      const loadedDebts = getDebtsByPlan(db, planId);
      setPlan(loadedPlan);
      setDebts(loadedDebts);
      setPreviewExtraPayment(loadedPlan.extra_payment);
      if (loadedDebts.length > 0) {
        setSelectedDebtId(loadedDebts[0].id);
      }
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load payoff details.');
    } finally {
      setLoading(false);
    }
  }, [db, planId]);

  const selectedDebt = useMemo(
    () => debts.find((debt) => debt.id === selectedDebtId) ?? debts[0] ?? null,
    [debts, selectedDebtId],
  );

  const previewPayment = (selectedDebt?.minimum_payment ?? 0) + previewExtraPayment;
  const schedule = useMemo(
    () =>
      selectedDebt
        ? generateAmortizationSchedule(
            selectedDebt.balance,
            Math.max(previewPayment, selectedDebt.minimum_payment),
            selectedDebt.interest_rate,
          )
        : [],
    [previewPayment, selectedDebt],
  );
  const payoff = useMemo(
    () =>
      selectedDebt
        ? projectPayoffDate(
            selectedDebt.balance,
            Math.max(previewPayment, selectedDebt.minimum_payment),
            selectedDebt.interest_rate,
          )
        : null,
    [previewPayment, selectedDebt],
  );

  const extraOptions = useMemo(() => {
    const values = [
      0,
      plan?.extra_payment ?? 0,
      25_00,
      100_00,
      250_00,
      500_00,
      1_000_00,
    ];

    return Array.from(new Set(values.filter((value) => value >= 0))).sort(
      (a, b) => a - b,
    );
  }, [plan]);

  if (loading) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading payoff detail…</Text>
        </GlassCard>
      </View>
    );
  }

  if (!plan || !selectedDebt) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>{error ?? 'Plan not found.'}</Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.eyebrow}>{plan.name}</Text>
            <Text style={styles.heroTitle}>{selectedDebt.name}</Text>
            <Text style={styles.heroSubtitle}>
              {plan.strategy === 'avalanche' ? 'Avalanche plan' : 'Snowball plan'}
            </Text>
          </View>
          <BudgetStatusPill
            label={plan.strategy === 'avalanche' ? 'Efficient' : 'Momentum'}
            tone={plan.strategy === 'avalanche' ? 'info' : 'accent'}
          />
        </View>

        <Text style={styles.heroAmount}>
          {formatBudgetCurrency(selectedDebt.balance)}
        </Text>

        <View style={styles.heroStats}>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>APR</Text>
            <Text style={styles.heroStatValue}>{formatApr(selectedDebt.interest_rate)}</Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Minimum</Text>
            <Text style={styles.heroStatValue}>
              {formatBudgetCurrency(selectedDebt.minimum_payment)}
            </Text>
          </View>
          <View style={styles.heroStat}>
            <Text style={styles.heroStatLabel}>Payoff</Text>
            <Text style={styles.heroStatValue}>
              {payoff ? getFutureMonthLabel(payoff.months) : 'TBD'}
            </Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Extra Payment Scenario</Text>
        <BudgetSteppedSlider
          label="Additional payment"
          labels={extraOptions.map((value) => formatBudgetCurrency(value))}
          onChange={setPreviewExtraPayment}
          value={previewExtraPayment}
          valueFormatter={(value) => formatBudgetCurrency(value)}
          values={extraOptions}
        />

        <View style={styles.scenarioCard}>
          <Text style={styles.scenarioHeadline}>
            Paying {formatBudgetCurrency(previewPayment)} each month
          </Text>
          <Text style={styles.scenarioBody}>
            {payoff
              ? `Debt-free by ${formatBudgetMonth(payoff.date)} with ${formatBudgetCurrency(payoff.totalInterest)} in projected interest.`
              : 'Add a higher payment to model your payoff date.'}
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Debt Stack</Text>
          <Text style={styles.sectionMeta}>{debts.length} debts</Text>
        </View>

        {debts.map((debt) => {
          const selected = debt.id === selectedDebt.id;
          return (
            <Pressable
              key={debt.id}
              onPress={() => setSelectedDebtId(debt.id)}
              style={[
                styles.debtChip,
                selected ? styles.debtChipSelected : null,
              ]}
            >
              <View style={styles.debtChipLead}>
                <MaterialSymbol
                  color={selected ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
                  name="credit_card"
                  size={16}
                />
                <Text
                  style={[
                    styles.debtChipTitle,
                    selected ? styles.debtChipTitleSelected : null,
                  ]}
                >
                  {debt.name}
                </Text>
              </View>
              <Text style={styles.debtChipValue}>{formatBudgetCurrency(debt.balance)}</Text>
            </Pressable>
          );
        })}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Amortization Preview</Text>
          <Text style={styles.sectionMeta}>
            First {Math.min(12, schedule.length)} months
          </Text>
        </View>

        <View style={styles.tableHeader}>
          <Text style={styles.tableHeaderCell}>Mo</Text>
          <Text style={styles.tableHeaderCell}>Payment</Text>
          <Text style={styles.tableHeaderCell}>Interest</Text>
          <Text style={styles.tableHeaderCell}>Principal</Text>
          <Text style={styles.tableHeaderCell}>Balance</Text>
        </View>

        {schedule.slice(0, 12).map((entry) => (
          <View key={entry.month} style={styles.tableRow}>
            <Text style={styles.tableCell}>{entry.month}</Text>
            <Text style={styles.tableCell}>{formatBudgetCurrency(entry.payment)}</Text>
            <Text style={styles.tableCell}>{formatBudgetCurrency(entry.interest)}</Text>
            <Text style={styles.tableCell}>{formatBudgetCurrency(entry.principal)}</Text>
            <Text style={styles.tableCell}>{formatBudgetCurrency(entry.balance)}</Text>
          </View>
        ))}

        <Pressable
          onPress={() =>
            router.push(
              `/(budget)/transaction/create?direction=outflow&merchant=${encodeURIComponent(
                selectedDebt.name,
              )}&amount=${encodeURIComponent((previewPayment / 100).toFixed(2))}&note=${encodeURIComponent(
                `Debt payment for ${selectedDebt.name}`,
              )}` as never,
            )
          }
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonLabel}>Record Payment</Text>
        </Pressable>
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
  sectionCard: {
    gap: 14,
  },
  sectionTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  scenarioCard: {
    backgroundColor: 'rgba(255, 184, 119, 0.1)',
    borderRadius: 18,
    gap: 6,
    padding: 16,
  },
  scenarioHeadline: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  scenarioBody: {
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
  sectionMeta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  debtChip: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  debtChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
  },
  debtChipLead: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  debtChipTitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  debtChipTitleSelected: {
    color: BG_TEXT,
  },
  debtChipValue: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  tableHeader: {
    flexDirection: 'row',
    gap: 6,
  },
  tableHeaderCell: {
    color: BG_TEXT_TERTIARY,
    flex: 1,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 10,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  tableRow: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  tableCell: {
    color: BG_TEXT_SECONDARY,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 16,
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
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
