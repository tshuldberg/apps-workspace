import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  createExpense,
  getExpensesByEvent,
  getExpenseSplitsByExpense,
  calculateSettlements,
  getEvents,
  getRsvpsByEvent,
} from '@mylife/rsvp';
import { Card, Text, EmptyState, colors, spacing } from '@mylife/ui';
import { useDatabase } from '../../components/DatabaseProvider';
import { useRsvpContext } from '../../components/rsvp/RsvpContext';

const ACCENT = colors.modules.rsvp;

export default function ExpensesScreen() {
  const db = useDatabase();
  const { selectedEventId } = useRsvpContext();
  const [tick, setTick] = useState(0);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [paidBy, setPaidBy] = useState('');

  const refresh = () => setTick((v) => v + 1);

  const events = useMemo(() => getEvents(db), [db, tick]);
  const eventId = selectedEventId ?? events[0]?.id ?? null;

  const expenses = useMemo(
    () => (eventId ? getExpensesByEvent(db, eventId) : []),
    [db, eventId, tick],
  );

  const rsvps = useMemo(
    () => (eventId ? getRsvpsByEvent(db, eventId) : []),
    [db, eventId, tick],
  );

  const totalCents = expenses.reduce((sum, e) => sum + e.amountCents, 0);
  const guestCount = rsvps.filter((r) => r.response === 'going').length || 1;
  const perPersonCents = Math.round(totalCents / guestCount);

  // Settlement calculation
  const settlements = useMemo(() => {
    if (expenses.length === 0) return [];
    const expenseData = expenses.map((e) => {
      const splits = getExpenseSplitsByExpense(db, e.id);
      return {
        paidByName: e.paidByName,
        amountCents: e.amountCents,
        splits: splits.map((s) => ({
          participantName: s.participantName,
          amountCents: s.amountCents,
        })),
      };
    });
    return calculateSettlements(expenseData);
  }, [db, expenses]);

  const handleAddExpense = () => {
    if (!eventId || !description.trim() || !amount.trim() || !paidBy.trim()) return;
    const amountCents = Math.round(parseFloat(amount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;

    const id = `exp_${Date.now()}`;
    createExpense(db, id, eventId, {
      description: description.trim(),
      amountCents,
      paidByName: paidBy.trim(),
      splitType: 'equal',
    });

    setDescription('');
    setAmount('');
    setPaidBy('');
    refresh();
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {!eventId ? (
        <EmptyState
          icon={'\uD83D\uDCB0'}
          title="No event selected"
          message="Create an event first to track expenses."
        />
      ) : (
        <>
          {/* Summary */}
          <Card>
            <Text variant="subheading">Expense Summary</Text>
            <View style={styles.statsGrid}>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>
                  ${(totalCents / 100).toFixed(2)}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>Total</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>
                  ${(perPersonCents / 100).toFixed(2)}
                </Text>
                <Text variant="caption" color={colors.textSecondary}>Per Person</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={[styles.statValue, { color: ACCENT }]}>{expenses.length}</Text>
                <Text variant="caption" color={colors.textSecondary}>Items</Text>
              </View>
            </View>
          </Card>

          {/* Expense list */}
          <Card>
            <Text variant="subheading">Expenses</Text>
            <View style={styles.list}>
              {expenses.length === 0 ? (
                <EmptyState
                  icon={'\uD83D\uDCCB'}
                  title="No expenses added yet"
                  message="Add your first expense below."
                />
              ) : (
                expenses.map((expense) => (
                  <View key={expense.id} style={styles.expenseRow}>
                    <View style={styles.mainCopy}>
                      <Text variant="body">{expense.description}</Text>
                      <Text variant="caption" color={colors.textSecondary}>
                        Paid by {expense.paidByName} -- {expense.splitType} split
                      </Text>
                    </View>
                    <Text variant="body">${(expense.amountCents / 100).toFixed(2)}</Text>
                  </View>
                ))
              )}
            </View>
          </Card>

          {/* Settlements */}
          {settlements.length > 0 && (
            <Card>
              <Text variant="subheading">Settlement Plan</Text>
              <View style={styles.list}>
                {settlements.map((s, i) => (
                  <View key={i} style={styles.settlementRow}>
                    <Text variant="body">
                      {s.from} pays {s.to}
                    </Text>
                    <Text variant="body" color={ACCENT}>
                      ${(s.amountCents / 100).toFixed(2)}
                    </Text>
                  </View>
                ))}
              </View>
            </Card>
          )}

          {/* Add expense form */}
          <Card>
            <Text variant="subheading">Add Expense</Text>
            <View style={styles.formGrid}>
              <TextInput
                style={styles.input}
                value={description}
                onChangeText={setDescription}
                placeholder="Description (e.g. Dinner reservation)"
                placeholderTextColor={colors.textTertiary}
              />
              <TextInput
                style={styles.input}
                value={paidBy}
                onChangeText={setPaidBy}
                placeholder="Paid by (name)"
                placeholderTextColor={colors.textTertiary}
              />
              <TextInput
                style={styles.input}
                value={amount}
                onChangeText={setAmount}
                placeholder="Amount in $"
                placeholderTextColor={colors.textTertiary}
                keyboardType="decimal-pad"
              />
              <Pressable style={styles.primaryButton} onPress={handleAddExpense}>
                <Text variant="label" color={colors.background}>Add Expense</Text>
              </Pressable>
            </View>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.md },
  statsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  statCard: {
    flex: 1, padding: spacing.sm, borderRadius: 12,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border, gap: 2,
  },
  statValue: { fontSize: 18, fontWeight: '700' },
  list: { gap: spacing.sm, marginTop: spacing.sm },
  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    padding: spacing.sm, borderRadius: 10,
    backgroundColor: colors.surfaceElevated, borderWidth: 1, borderColor: colors.border,
  },
  settlementRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
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
