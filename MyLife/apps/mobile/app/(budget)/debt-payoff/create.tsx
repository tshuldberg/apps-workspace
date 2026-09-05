import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  MaterialSymbol,
  calculateAvalanche,
  calculateSnowball,
  createDebtPayoffDebt,
  createDebtPayoffPlan,
  type DebtInput,
} from '@mylife/budget';
import {
  BudgetStatusPill,
  formatBudgetCurrency,
  formatBudgetMonth,
} from '../../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type Strategy = 'avalanche' | 'snowball';

type DebtDraft = {
  balance: string;
  key: string;
  minPayment: string;
  name: string;
  rate: string;
};

function parseAmountInput(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function payoffMonthLabel(months: number): string {
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return formatBudgetMonth(date.toISOString());
}

export default function CreateDebtPayoffPlanScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [planName, setPlanName] = useState('');
  const [strategy, setStrategy] = useState<Strategy>('snowball');
  const [extraPayment, setExtraPayment] = useState('0.00');
  const [debts, setDebts] = useState<DebtDraft[]>([]);
  const [debtName, setDebtName] = useState('');
  const [debtBalance, setDebtBalance] = useState('');
  const [debtRate, setDebtRate] = useState('');
  const [debtMinPayment, setDebtMinPayment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debtInputs = useMemo<DebtInput[]>(() => {
    return debts
      .map((debt) => {
        const balance = parseAmountInput(debt.balance);
        const minPayment = parseAmountInput(debt.minPayment);
        const rate = Math.round(Number(debt.rate) * 100);

        if (balance === null || minPayment === null || !Number.isFinite(rate)) {
          return null;
        }

        return {
          balance,
          id: debt.key,
          interestRate: rate,
          minimumPayment: minPayment,
          name: debt.name,
        };
      })
      .filter(Boolean) as DebtInput[];
  }, [debts]);

  const previewExtraPayment = parseAmountInput(extraPayment) ?? 0;
  const preview =
    strategy === 'avalanche'
      ? calculateAvalanche(debtInputs, previewExtraPayment)
      : calculateSnowball(debtInputs, previewExtraPayment);

  const addDebt = () => {
    const trimmedName = debtName.trim();
    const balance = parseAmountInput(debtBalance);
    const minPayment = parseAmountInput(debtMinPayment);
    const rate = Number(debtRate);

    if (!trimmedName) {
      setError('Debt name is required.');
      return;
    }
    if (balance === null || balance <= 0) {
      setError('Balance must be greater than zero.');
      return;
    }
    if (!Number.isFinite(rate) || rate < 0) {
      setError('APR must be a valid non-negative number.');
      return;
    }
    if (minPayment === null || minPayment <= 0) {
      setError('Minimum payment must be greater than zero.');
      return;
    }

    setDebts((current) => [
      ...current,
      {
        balance: debtBalance,
        key: uuid(),
        minPayment: debtMinPayment,
        name: trimmedName,
        rate: debtRate,
      },
    ]);
    setDebtName('');
    setDebtBalance('');
    setDebtRate('');
    setDebtMinPayment('');
    setError(null);
  };

  const removeDebt = (key: string) => {
    setDebts((current) => current.filter((debt) => debt.key !== key));
  };

  const handleCreate = () => {
    if (submitting) {
      return;
    }

    const trimmedPlanName = planName.trim();
    if (!trimmedPlanName) {
      setError('Plan name is required.');
      return;
    }

    const nextExtra = parseAmountInput(extraPayment);
    if (nextExtra === null) {
      setError('Extra payment must be a valid number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const planId = uuid();
      createDebtPayoffPlan(db, planId, {
        extra_payment: nextExtra,
        name: trimmedPlanName,
        strategy,
      });

      debtInputs.forEach((debt, index) => {
        createDebtPayoffDebt(db, uuid(), {
          balance: debt.balance,
          interest_rate: debt.interestRate,
          minimum_payment: debt.minimumPayment,
          name: debt.name,
          plan_id: planId,
          sort_order: index,
        });
      });

      router.replace(`/(budget)/debt-payoff/${planId}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create payoff plan.');
      setSubmitting(false);
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
            <Text style={styles.eyebrow}>Planner</Text>
            <Text style={styles.heroTitle}>New Debt Plan</Text>
            <Text style={styles.heroSubtitle}>
              Build a payoff strategy, preview the timeline, then save it as your active plan.
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="payments" size={24} />
          </View>
        </View>

        <View style={styles.previewStats}>
          <View style={styles.previewStat}>
            <Text style={styles.previewLabel}>Debts</Text>
            <Text style={styles.previewValue}>{debtInputs.length}</Text>
          </View>
          <View style={styles.previewStat}>
            <Text style={styles.previewLabel}>Months</Text>
            <Text style={styles.previewValue}>{preview.totalMonths}</Text>
          </View>
          <View style={styles.previewStat}>
            <Text style={styles.previewLabel}>Interest</Text>
            <Text style={styles.previewValue}>
              {formatBudgetCurrency(preview.totalInterest)}
            </Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Plan Setup</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Plan Name</Text>
          <TextInput
            value={planName}
            onChangeText={setPlanName}
            placeholder="Debt Freedom Sprint"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Method</Text>
          <View style={styles.methodRow}>
            <Pressable
              onPress={() => setStrategy('snowball')}
              style={[
                styles.methodChip,
                strategy === 'snowball' ? styles.methodChipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.methodChipLabel,
                  strategy === 'snowball' ? styles.methodChipLabelSelected : null,
                ]}
              >
                Snowball
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setStrategy('avalanche')}
              style={[
                styles.methodChip,
                strategy === 'avalanche' ? styles.methodChipSelected : null,
              ]}
            >
              <Text
                style={[
                  styles.methodChipLabel,
                  strategy === 'avalanche' ? styles.methodChipLabelSelected : null,
                ]}
              >
                Avalanche
              </Text>
            </Pressable>
            <View style={[styles.methodChip, styles.methodChipDisabled]}>
              <Text style={styles.methodChipDisabledLabel}>Custom</Text>
            </View>
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Extra Monthly Payment</Text>
          <TextInput
            value={extraPayment}
            onChangeText={setExtraPayment}
            placeholder="0.00"
            placeholderTextColor={BG_TEXT_TERTIARY}
            keyboardType="decimal-pad"
            style={styles.input}
          />
        </View>

        <View style={styles.previewCard}>
          <BudgetStatusPill
            label={strategy === 'avalanche' ? 'Efficient' : 'Momentum'}
            tone={strategy === 'avalanche' ? 'info' : 'accent'}
          />
          <Text style={styles.previewHeadline}>
            Debt-free by {payoffMonthLabel(preview.totalMonths)}
          </Text>
          <Text style={styles.previewBody}>
            {formatBudgetCurrency(preview.totalPaid)} total paid with{' '}
            {formatBudgetCurrency(preview.totalInterest)} in interest.
          </Text>
        </View>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Add Debt</Text>
          <Text style={styles.sectionMeta}>Preview before save</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Debt Name</Text>
          <TextInput
            value={debtName}
            onChangeText={setDebtName}
            placeholder="Visa Platinum"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
          />
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>Balance</Text>
            <TextInput
              value={debtBalance}
              onChangeText={setDebtBalance}
              placeholder="4200.00"
              placeholderTextColor={BG_TEXT_TERTIARY}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>APR</Text>
            <TextInput
              value={debtRate}
              onChangeText={setDebtRate}
              placeholder="18.90"
              placeholderTextColor={BG_TEXT_TERTIARY}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>Minimum</Text>
            <TextInput
              value={debtMinPayment}
              onChangeText={setDebtMinPayment}
              placeholder="145.00"
              placeholderTextColor={BG_TEXT_TERTIARY}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
        </View>

        <Pressable onPress={addDebt} style={styles.secondaryButton}>
          <Text style={styles.secondaryButtonLabel}>Add Debt</Text>
        </Pressable>
      </GlassCard>

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Debt List</Text>
          <Text style={styles.sectionMeta}>{debtInputs.length} selected</Text>
        </View>

        {debts.length === 0 ? (
          <Text style={styles.emptyBody}>
            Add one or more debts to unlock the payoff preview and save this plan.
          </Text>
        ) : (
          debts.map((debt) => (
            <View key={debt.key} style={styles.debtRow}>
              <View style={styles.debtRowCopy}>
                <Text style={styles.debtName}>{debt.name}</Text>
                <Text style={styles.debtMeta}>
                  {debt.rate}% APR · {formatBudgetCurrency(parseAmountInput(debt.minPayment) ?? 0)} minimum
                </Text>
              </View>
              <View style={styles.debtRowRight}>
                <Text style={styles.debtBalance}>
                  {formatBudgetCurrency(parseAmountInput(debt.balance) ?? 0)}
                </Text>
                <Pressable onPress={() => removeDebt(debt.key)}>
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ))
        )}
      </GlassCard>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Pressable onPress={handleCreate} style={styles.primaryButton}>
        <Text style={styles.primaryButtonLabel}>
          {submitting ? 'Creating…' : 'Create Plan'}
        </Text>
      </Pressable>
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
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 18,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  previewStats: {
    flexDirection: 'row',
    gap: 10,
  },
  previewStat: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  previewLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  previewValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
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
  previewCard: {
    backgroundColor: 'rgba(255, 184, 119, 0.1)',
    borderRadius: 18,
    gap: 8,
    padding: 16,
  },
  previewHeadline: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  previewBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 18,
  },
  secondaryButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
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
  emptyBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
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
  debtRowCopy: {
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
  debtRowRight: {
    alignItems: 'flex-end',
    gap: 6,
  },
  debtBalance: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  removeText: {
    color: '#FFB4AB',
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
});
