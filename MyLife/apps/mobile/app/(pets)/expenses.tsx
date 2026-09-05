import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createPetExpense,
  listPets,
  listExpensesForPet,
  calculateMonthlySpending,
  calculateBudgetProgress,
  getCostOfOwnershipBreakdown,
  getExpenseTrend,
  calculateAverageMonthlyCost,
} from '@mylife/pets';
import type { ExpenseCategory } from '@mylife/pets';
import { Card, Text, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

const ACCENT = colors.modules.pets;
const CATEGORIES: ExpenseCategory[] = ['vet', 'food', 'grooming', 'medication', 'supplies', 'boarding', 'training', 'other'];

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  vet: '#EF4444',
  food: '#F59E0B',
  grooming: '#8B5CF6',
  medication: '#3B82F6',
  supplies: '#10B981',
  boarding: '#EC4899',
  training: '#06B6D4',
  other: colors.textSecondary,
};

export default function ExpensesScreen() {
  const db = useDatabase();
  const [selectedPetId, setSelectedPetId] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const [category, setCategory] = useState<ExpenseCategory>('food');
  const [label, setLabel] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [spentOn, setSpentOn] = useState(new Date().toISOString().slice(0, 10));

  const refresh = () => setTick((v) => v + 1);
  const pets = useMemo(() => listPets(db), [db, tick]);
  const selectedPet = pets.find((p) => p.id === selectedPetId) ?? pets[0] ?? null;

  const expenses = useMemo(
    () => (selectedPet ? listExpensesForPet(db, selectedPet.id) : []),
    [db, selectedPet, tick],
  );

  const totalCents = useMemo(
    () => expenses.reduce((sum, e) => sum + e.amountCents, 0),
    [expenses],
  );

  const monthlySpending = useMemo(
    () => calculateMonthlySpending(expenses),
    [expenses],
  );

  const breakdown = useMemo(
    () => getCostOfOwnershipBreakdown(expenses),
    [expenses],
  );

  const now = new Date().toISOString().slice(0, 10);

  const trend = useMemo(
    () => getExpenseTrend(expenses, 6, now),
    [expenses, now],
  );

  const thisMonthTotal = useMemo(
    () => monthlySpending.reduce((sum, s) => sum + s.totalCents, 0),
    [monthlySpending],
  );

  const avgMonthlyCost = selectedPet
    ? calculateAverageMonthlyCost(expenses, selectedPet.createdAt)
    : 0;

  const handleAdd = () => {
    if (!selectedPet || !label.trim() || !amountStr.trim()) return;
    const amountCents = Math.round(parseFloat(amountStr) * 100);
    if (isNaN(amountCents) || amountCents < 0) return;
    createPetExpense(db, uuid(), {
      petId: selectedPet.id,
      category,
      label: label.trim(),
      amountCents,
      spentOn: spentOn.trim(),
    });
    setLabel('');
    setAmountStr('');
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Pet selector */}
      <View style={styles.chipRow}>
        {pets.map((pet) => {
          const selected = pet.id === selectedPet?.id;
          return (
            <Pressable
              key={pet.id}
              onPress={() => setSelectedPetId(pet.id)}
              style={[styles.chip, selected && styles.chipActive]}
            >
              <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                {pet.name}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* Cost summary */}
      <Card>
        <Text variant="subheading">Cost Summary</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>
              ${(totalCents / 100).toFixed(0)}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>Lifetime</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>
              ${(avgMonthlyCost / 100).toFixed(0)}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>Avg/Month</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={[styles.statValue, { color: ACCENT }]}>
              ${(thisMonthTotal / 100).toFixed(0)}
            </Text>
            <Text variant="caption" color={colors.textSecondary}>This Month</Text>
          </View>
        </View>
      </Card>

      {/* Category breakdown */}
      {breakdown.length > 0 && (
        <Card>
          <Text variant="subheading">By Category</Text>
          <View style={styles.list}>
            {breakdown.map((item) => (
              <View key={item.category} style={styles.breakdownRow}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[item.category as ExpenseCategory] ?? ACCENT }]} />
                <Text variant="body" style={styles.breakdownLabel}>{item.category}</Text>
                <Text variant="body" color={colors.textSecondary}>
                  ${(item.totalCents / 100).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Monthly trend */}
      {trend.length > 0 && (
        <Card>
          <Text variant="subheading">Monthly Trend</Text>
          <View style={styles.list}>
            {trend.map((m) => (
              <View key={m.month} style={styles.breakdownRow}>
                <Text variant="body" style={styles.breakdownLabel}>{m.month}</Text>
                <Text variant="body" color={colors.textSecondary}>
                  ${(m.totalCents / 100).toFixed(0)}
                </Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Expense history */}
      <Card>
        <Text variant="subheading">Recent Expenses</Text>
        <View style={styles.list}>
          {expenses.length === 0 ? (
            <Text variant="caption" color={colors.textSecondary}>
              No expenses recorded yet.
            </Text>
          ) : (
            expenses.slice(0, 20).map((expense) => (
              <View key={expense.id} style={styles.historyRow}>
                <View style={[styles.dot, { backgroundColor: CATEGORY_COLORS[expense.category] }]} />
                <View style={styles.mainCopy}>
                  <Text variant="body">{expense.label}</Text>
                  <Text variant="caption" color={colors.textSecondary}>
                    {expense.spentOn} -- {expense.category}
                  </Text>
                </View>
                <Text variant="body">${(expense.amountCents / 100).toFixed(2)}</Text>
              </View>
            ))
          )}
        </View>
      </Card>

      {/* Add expense form */}
      {selectedPet && (
        <Card>
          <Text variant="subheading">Add Expense</Text>
          <View style={styles.formGrid}>
            <View style={styles.chipRow}>
              {CATEGORIES.map((c) => {
                const selected = c === category;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCategory(c)}
                    style={[styles.chip, selected && { backgroundColor: CATEGORY_COLORS[c], borderColor: CATEGORY_COLORS[c] }]}
                  >
                    <Text variant="caption" color={selected ? colors.background : colors.textSecondary}>
                      {c}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              style={styles.input}
              value={label}
              onChangeText={setLabel}
              placeholder="Description"
              placeholderTextColor={colors.textTertiary}
            />
            <TextInput
              style={styles.input}
              value={amountStr}
              onChangeText={setAmountStr}
              placeholder="Amount in $"
              placeholderTextColor={colors.textTertiary}
              keyboardType="decimal-pad"
            />
            <TextInput
              style={styles.input}
              value={spentOn}
              onChangeText={setSpentOn}
              placeholder="Date (YYYY-MM-DD)"
              placeholderTextColor={colors.textTertiary}
            />
            <Pressable style={styles.primaryButton} onPress={handleAdd}>
              <Text variant="label" color={colors.background}>Add Expense</Text>
            </Pressable>
          </View>
        </Card>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs,
    backgroundColor: colors.surfaceElevated,
  },
  chipActive: { backgroundColor: ACCENT, borderColor: ACCENT },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  breakdownRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  breakdownLabel: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  historyRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  mainCopy: { flex: 1, gap: 2 },
  formGrid: { gap: spacing.sm, marginTop: spacing.sm },
  input: {
    borderWidth: 1, borderColor: colors.border, borderRadius: 12,
    paddingHorizontal: spacing.md, paddingVertical: spacing.sm,
    color: colors.text, backgroundColor: colors.surfaceElevated,
  },
  primaryButton: {
    backgroundColor: ACCENT, borderRadius: 12,
    paddingVertical: spacing.sm, alignItems: 'center',
  },
});
