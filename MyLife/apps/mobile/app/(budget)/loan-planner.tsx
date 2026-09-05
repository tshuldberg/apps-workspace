import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
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
  GlassCard,
  MaterialSymbol,
  compareScenarios,
  createLoan,
  generateLoanAmortization,
  getLoanSummary,
  type LoanInput,
} from '@mylife/budget';
import {
  BudgetSteppedSlider,
  formatBudgetCurrency,
  formatBudgetMonth,
} from '../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type TermUnit = 'months' | 'years';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function toCents(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function getPayoffMonthLabel(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return formatBudgetMonth(date.toISOString());
}

export default function LoanPlannerScreen() {
  const db = useDatabase();

  const [principal, setPrincipal] = useState('250000');
  const [rate, setRate] = useState('6.25');
  const [term, setTerm] = useState('30');
  const [termUnit, setTermUnit] = useState<TermUnit>('years');
  const [extraPayment, setExtraPayment] = useState('0');
  const [comparisonExtra, setComparisonExtra] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const baseInput = useMemo<LoanInput | null>(() => {
    const nextPrincipal = toCents(principal);
    const nextRate = Math.round(Number(rate) * 100);
    const termValue = parseInt(term, 10);
    const nextExtra = toCents(extraPayment);

    if (
      nextPrincipal === null ||
      nextPrincipal <= 0 ||
      !Number.isFinite(nextRate) ||
      nextRate < 0 ||
      !Number.isFinite(termValue) ||
      termValue <= 0 ||
      nextExtra === null
    ) {
      return null;
    }

    return {
      extraPayment: nextExtra > 0 ? nextExtra : undefined,
      interestRate: nextRate,
      principal: nextPrincipal,
      termMonths: termUnit === 'years' ? termValue * 12 : termValue,
    };
  }, [extraPayment, principal, rate, term, termUnit]);

  const summary = useMemo(
    () => (baseInput ? getLoanSummary(baseInput) : null),
    [baseInput],
  );

  const schedule = useMemo(
    () => (baseInput ? generateLoanAmortization(baseInput) : []),
    [baseInput],
  );

  const comparisonInput = useMemo<LoanInput | null>(() => {
    if (!baseInput) {
      return null;
    }

    return {
      ...baseInput,
      extraPayment: comparisonExtra > 0 ? comparisonExtra : undefined,
    };
  }, [baseInput, comparisonExtra]);

  const comparison = useMemo(
    () =>
      baseInput && comparisonInput
        ? compareScenarios(baseInput, comparisonInput)
        : null,
    [baseInput, comparisonInput],
  );

  const comparisonValues = useMemo(() => {
    const values = [
      0,
      25_00,
      100_00,
      250_00,
      500_00,
      1_000_00,
      1_500_00,
    ];

    return Array.from(new Set(values)).sort((a, b) => a - b);
  }, []);

  const handleSave = () => {
    if (!baseInput || saving) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      createLoan(db, uuid(), {
        current_balance: baseInput.principal,
        extra_payment: baseInput.extraPayment ?? 0,
        interest_rate: baseInput.interestRate,
        loan_type: 'personal',
        monthly_payment: summary?.monthlyPayment ?? 0,
        name: `Loan Plan ${todayISO()}`,
        original_principal: baseInput.principal,
        start_date: todayISO(),
        term_months: baseInput.termMonths,
      });
      setSaving(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save loan plan.');
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View>
            <Text style={styles.eyebrow}>Calculator</Text>
            <Text style={styles.heroTitle}>Loan Planner</Text>
            <Text style={styles.heroSubtitle}>
              Model the payment, interest, and payoff speed before you commit.
            </Text>
          </View>
          <View style={styles.heroBadge}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="tune" size={24} />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>Principal</Text>
            <TextInput
              value={principal}
              onChangeText={setPrincipal}
              placeholder="250000"
              placeholderTextColor={BG_TEXT_TERTIARY}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>APR</Text>
            <TextInput
              value={rate}
              onChangeText={setRate}
              placeholder="6.25"
              placeholderTextColor={BG_TEXT_TERTIARY}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>Term</Text>
            <TextInput
              value={term}
              onChangeText={setTerm}
              placeholder="30"
              placeholderTextColor={BG_TEXT_TERTIARY}
              keyboardType="number-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.termUnitRow}>
            <Pressable
              onPress={() => setTermUnit('years')}
              style={[
                styles.termChip,
                termUnit === 'years' ? styles.termChipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.termChipLabel,
                  termUnit === 'years' ? styles.termChipLabelSelected : null,
                ]}
              >
                Years
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setTermUnit('months')}
              style={[
                styles.termChip,
                termUnit === 'months' ? styles.termChipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.termChipLabel,
                  termUnit === 'months' ? styles.termChipLabelSelected : null,
                ]}
              >
                Months
              </Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Base Extra Payment</Text>
          <TextInput
            value={extraPayment}
            onChangeText={setExtraPayment}
            placeholder="0"
            placeholderTextColor={BG_TEXT_TERTIARY}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>
      </GlassCard>

      <GlassCard style={styles.resultCard}>
        <Text style={styles.sectionTitle}>Results</Text>

        {summary ? (
          <>
            <Text style={styles.paymentLabel}>Estimated Monthly Payment</Text>
            <Text style={styles.paymentValue}>
              {formatBudgetCurrency(summary.monthlyPayment)}
            </Text>

            <View style={styles.summaryRow}>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>Total Interest</Text>
                <Text style={[styles.summaryValue, { color: BG_DANGER }]}>
                  {formatBudgetCurrency(summary.totalInterest)}
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>Total Paid</Text>
                <Text style={styles.summaryValue}>
                  {formatBudgetCurrency(summary.totalPayments)}
                </Text>
              </View>
              <View style={styles.summaryStat}>
                <Text style={styles.summaryLabel}>Payoff</Text>
                <Text style={[styles.summaryValue, { color: BG_MONEY }]}>
                  {getPayoffMonthLabel(summary.payoffMonths)}
                </Text>
              </View>
            </View>
          </>
        ) : (
          <Text style={styles.errorText}>
            Enter a valid loan amount, rate, and term to see the payment plan.
          </Text>
        )}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Scenario Comparison</Text>
        <BudgetSteppedSlider
          label="Extra payment preview"
          labels={comparisonValues.map((value) => formatBudgetCurrency(value))}
          onChange={setComparisonExtra}
          value={comparisonExtra}
          valueFormatter={(value) => formatBudgetCurrency(value)}
          values={comparisonValues}
        />

        {comparison ? (
          <View style={styles.compareRow}>
            <View style={styles.compareCard}>
              <Text style={styles.compareLabel}>Base</Text>
              <Text style={styles.compareValue}>
                {formatBudgetCurrency(comparison.original.monthlyPayment)}
              </Text>
              <Text style={styles.compareMeta}>
                {comparison.original.payoffMonths} months ·{' '}
                {formatBudgetCurrency(comparison.original.totalInterest)} interest
              </Text>
            </View>
            <View style={styles.compareCard}>
              <Text style={styles.compareLabel}>With Extra</Text>
              <Text style={styles.compareValue}>
                {formatBudgetCurrency(comparison.modified.monthlyPayment)}
              </Text>
              <Text style={styles.compareMeta}>
                {comparison.modified.payoffMonths} months ·{' '}
                {formatBudgetCurrency(comparison.modified.totalInterest)} interest
              </Text>
            </View>
          </View>
        ) : null}

        {comparison ? (
          <View style={styles.compareSummary}>
            <Text style={styles.compareSummaryHeadline}>
              {comparison.monthsSaved >= 0
                ? `${comparison.monthsSaved} months faster`
                : `${Math.abs(comparison.monthsSaved)} months longer`}
            </Text>
            <Text
              style={[
                styles.compareSummaryBody,
                {
                  color: comparison.interestSaved >= 0 ? BG_MONEY : BG_DANGER,
                },
              ]}
            >
              {comparison.interestSaved >= 0 ? 'Interest saved: ' : 'Additional interest: '}
              {formatBudgetCurrency(Math.abs(comparison.interestSaved))}
            </Text>
          </View>
        ) : null}
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Amortization Preview</Text>
          <Text style={styles.sectionMeta}>First 12 months</Text>
        </View>

        {schedule.slice(0, 12).map((entry) => (
          <View key={entry.month} style={styles.scheduleRow}>
            <Text style={styles.scheduleCell}>{entry.month}</Text>
            <Text style={styles.scheduleCell}>
              {formatBudgetCurrency(entry.payment)}
            </Text>
            <Text style={styles.scheduleCell}>
              {formatBudgetCurrency(entry.interestPortion)}
            </Text>
            <Text style={styles.scheduleCell}>
              {formatBudgetCurrency(entry.principalPortion)}
            </Text>
            <Text style={styles.scheduleCell}>
              {formatBudgetCurrency(entry.remainingBalance)}
            </Text>
          </View>
        ))}

        <Pressable onPress={handleSave} style={styles.primaryButton}>
          <Text style={styles.primaryButtonLabel}>
            {saving ? 'Saving…' : 'Save as Plan'}
          </Text>
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
  field: {
    gap: 6,
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
  termUnitRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    flex: 1,
    gap: 10,
  },
  termChip: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    flex: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 12,
  },
  termChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  termChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  termChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  resultCard: {
    gap: 14,
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
  paymentLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.1,
    textTransform: 'uppercase',
  },
  paymentValue: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.extraBold,
    fontSize: 42,
    lineHeight: 46,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 10,
  },
  summaryStat: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  summaryLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  compareRow: {
    flexDirection: 'row',
    gap: 10,
  },
  compareCard: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 8,
    padding: 16,
  },
  compareLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  compareValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  compareMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 13,
    lineHeight: 18,
  },
  compareSummary: {
    backgroundColor: 'rgba(255, 184, 119, 0.1)',
    borderRadius: 18,
    gap: 6,
    padding: 16,
  },
  compareSummaryHeadline: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  compareSummaryBody: {
    fontFamily: BG_FONTS.semiBold,
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
  scheduleRow: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  scheduleCell: {
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
