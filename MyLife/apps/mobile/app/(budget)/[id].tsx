import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  RefreshControl,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AddFAB,
  AmountDisplay,
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_CARD_RADIUS,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TRANSFER,
  GlassCard,
  MaterialSymbol,
  TxRow,
  allocateToEnvelope,
  deleteEnvelope,
  getAllocationMap,
  getEnvelope,
  getGoals,
  getTransactions,
  listEnvelopes,
  moveAllocation,
  suggestMonthlyContribution,
  updateEnvelope,
  type BudgetGoal,
  type BudgetTransaction,
  type Envelope,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetEmptyState,
  BudgetHeadline,
  BudgetInput,
  BudgetMetric,
  BudgetProgressBar,
  BudgetScreen,
  BudgetSectionLabel,
  BudgetSheet,
  currentBudgetMonth,
  formatBudgetCurrency,
  formatBudgetMonth,
  parseBudgetCurrencyInput,
} from '../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../components/DatabaseProvider';

type EnvelopeSnapshot = {
  envelope: Envelope;
  allocated: number;
  activity: number;
  spent: number;
  remaining: number;
  transactions: BudgetTransaction[];
  goal: BudgetGoal | null;
};

function buildGoalContribution(goal: BudgetGoal): number {
  return suggestMonthlyContribution({
    id: goal.id,
    name: goal.name,
    targetAmount: goal.target_amount,
    currentAmount: goal.completed_amount,
    targetDate: goal.target_date,
    createdAt: goal.created_at.slice(0, 10),
  });
}

function computeActivity(transactions: BudgetTransaction[]): number {
  return transactions.reduce((sum, transaction) => {
    if (transaction.direction === 'transfer') {
      return sum;
    }
    if (transaction.direction === 'inflow') {
      return sum + Math.abs(transaction.amount);
    }
    return sum - Math.abs(transaction.amount);
  }, 0);
}

function targetLabel(snapshot: EnvelopeSnapshot): string {
  if (snapshot.goal?.target_date) {
    return 'Save by date';
  }
  if (snapshot.envelope.rollover_enabled === 1) {
    return 'Refill up to';
  }
  return 'Needed for spending';
}

export default function BudgetEnvelopeScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const envelopeId = Array.isArray(id) ? id[0] : id;
  const activeMonth = currentBudgetMonth();

  const [snapshot, setSnapshot] = useState<EnvelopeSnapshot | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('');
  const [budgetAmount, setBudgetAmount] = useState('');
  const [rolloverEnabled, setRolloverEnabled] = useState(false);
  const [moveAmount, setMoveAmount] = useState('');
  const [moveTargetId, setMoveTargetId] = useState('');
  const [moveVisible, setMoveVisible] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const otherEnvelopes = useMemo(
    () =>
      listEnvelopes(db, false)
        .filter((envelope) => envelope.id !== envelopeId)
        .slice(0, 12),
    [db, envelopeId, snapshot?.envelope.updated_at],
  );

  const load = useCallback(() => {
    if (!envelopeId) {
      setError('Envelope not found.');
      setSnapshot(null);
      setLoading(false);
      return;
    }

    setError(null);

    try {
      const envelope = getEnvelope(db, envelopeId);
      if (!envelope) {
        setSnapshot(null);
        setError('Envelope not found.');
        return;
      }

      const allocations = getAllocationMap(db, activeMonth);
      const transactions = getTransactions(db, {
        envelope_id: envelopeId,
        limit: 120,
      });
      const monthTransactions = transactions.filter((transaction) =>
        transaction.occurred_on.startsWith(activeMonth),
      );
      const activity = computeActivity(monthTransactions);
      const allocated = allocations.get(envelopeId) ?? envelope.monthly_budget;
      const spent = Math.abs(Math.min(activity, 0));
      const goal = getGoals(db, envelopeId)[0] ?? null;

      setSnapshot({
        envelope,
        allocated,
        activity,
        spent,
        remaining: allocated + activity,
        transactions,
        goal,
      });
      setName(envelope.name);
      setIcon(envelope.icon ?? '');
      setBudgetAmount((allocated / 100).toFixed(2));
      setRolloverEnabled(envelope.rollover_enabled === 1);
      setMoveTargetId(
        (current) =>
          current || (listEnvelopes(db, false).find((item) => item.id !== envelopeId)?.id ?? ''),
      );
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load envelope.');
      setSnapshot(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeMonth, db, envelopeId]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const handleSave = useCallback(() => {
    if (!snapshot || saving) {
      return;
    }

    const parsedBudget = parseBudgetCurrencyInput(budgetAmount);
    if (!name.trim()) {
      setError('Envelope name is required.');
      return;
    }
    if (parsedBudget === null || parsedBudget < 0) {
      setError('Enter a valid target amount.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      updateEnvelope(db, snapshot.envelope.id, {
        name: name.trim(),
        icon: icon.trim() || null,
        monthly_budget: parsedBudget,
        rollover_enabled: rolloverEnabled ? 1 : 0,
      });
      allocateToEnvelope(db, snapshot.envelope.id, activeMonth, parsedBudget);
      load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to update envelope.');
    } finally {
      setSaving(false);
    }
  }, [budgetAmount, db, icon, load, name, rolloverEnabled, saving, snapshot]);

  const handleDelete = useCallback(() => {
    if (!snapshot || saving) {
      return;
    }

    Alert.alert(
      'Delete Envelope',
      `Delete ${snapshot.envelope.name}? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => {
            try {
              deleteEnvelope(db, snapshot.envelope.id);
              router.replace(`/(budget)?refresh=${Date.now()}` as never);
            } catch (deleteError) {
              setError(
                deleteError instanceof Error
                  ? deleteError.message
                  : 'Failed to delete envelope.',
              );
            }
          },
        },
      ],
    );
  }, [db, router, saving, snapshot]);

  const handleMoveMoney = useCallback(() => {
    if (!snapshot || !moveTargetId) {
      return;
    }

    const parsedAmount = parseBudgetCurrencyInput(moveAmount);
    if (parsedAmount === null || parsedAmount <= 0) {
      setError('Enter a valid move amount.');
      return;
    }
    if (parsedAmount > snapshot.allocated) {
      setError('Move amount cannot exceed the current target.');
      return;
    }

    try {
      moveAllocation(db, snapshot.envelope.id, moveTargetId, activeMonth, parsedAmount);
      setMoveAmount('');
      setMoveVisible(false);
      load();
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : 'Failed to move money.');
    }
  }, [activeMonth, db, load, moveAmount, moveTargetId, snapshot]);

  const progressTone =
    snapshot && snapshot.remaining < 0
      ? BG_DANGER
      : snapshot && snapshot.spent / Math.max(snapshot.allocated, 1) >= 0.8
        ? BG_ACCENT_LIGHT
        : BG_MONEY;

  if (loading) {
    return <BudgetScreen />;
  }

  if (!snapshot) {
    return (
      <BudgetScreen>
        <BudgetEmptyState
          icon="payments"
          title="Envelope unavailable"
          message={error ?? 'This envelope could not be loaded.'}
          action={
            <BudgetButton
              label="Back to Budget"
              onPress={() => router.replace('/(budget)' as never)}
            />
          }
        />
      </BudgetScreen>
    );
  }

  const linkedGoalContribution = snapshot.goal ? buildGoalContribution(snapshot.goal) : 0;

  return (
    <>
      <BudgetScreen
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={BG_ACCENT}
          />
        }
      >
        <BudgetHeadline
          title={snapshot.envelope.name}
          subtitle={`${formatBudgetMonth(activeMonth)} envelope drill-down`}
          right={
            <View style={styles.headerActions}>
              <BudgetButton
                tone="secondary"
                icon="flag"
                label="Targets"
                onPress={() =>
                  router.push(`/(budget)/category-target?envelopeId=${snapshot.envelope.id}` as never)
                }
              />
            </View>
          }
        />

        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.iconShell}>
              <Text style={styles.iconLabel}>{snapshot.envelope.icon ?? '💸'}</Text>
            </View>
            <View style={styles.heroActions}>
              <BudgetButton tone="ghost" icon="edit" label="Save" onPress={handleSave} />
              <BudgetButton tone="danger" icon="delete" label="Delete" onPress={handleDelete} />
            </View>
          </View>

          <BudgetSectionLabel>Allocated this month</BudgetSectionLabel>
          <AmountDisplay cents={snapshot.allocated} size="xl" type="neutral" />
          <BudgetProgressBar
            value={snapshot.spent}
            total={Math.max(snapshot.allocated, 1)}
            tone={progressTone}
          />
          <Text style={styles.progressCopy}>
            {formatBudgetCurrency(snapshot.remaining)} remaining after {formatBudgetCurrency(snapshot.spent)} spent
          </Text>

          <View style={styles.metricGrid}>
            <BudgetMetric
              label="Spent"
              value={formatBudgetCurrency(snapshot.spent)}
              tone="danger"
              icon="arrow_downward"
            />
            <BudgetMetric
              label="Remaining"
              value={formatBudgetCurrency(snapshot.remaining)}
              tone={snapshot.remaining < 0 ? 'danger' : 'money'}
              icon="wallet"
            />
            <BudgetMetric
              label="Rollover"
              value={rolloverEnabled ? 'On' : 'Off'}
              tone={rolloverEnabled ? 'money' : 'neutral'}
              icon="history"
            />
            <BudgetMetric
              label="Target"
              value={formatBudgetCurrency(snapshot.allocated)}
              tone="warning"
              icon="flag"
            />
          </View>
        </GlassCard>

        <GlassCard style={styles.editorCard}>
          <BudgetSectionLabel>Envelope profile</BudgetSectionLabel>
          <BudgetInput value={name} onChangeText={setName} placeholder="Groceries" />
          <View style={styles.inlineFields}>
            <BudgetInput
              value={icon}
              onChangeText={setIcon}
              placeholder="🛒"
              style={styles.iconInput}
            />
            <BudgetInput
              value={budgetAmount}
              onChangeText={setBudgetAmount}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={styles.amountInput}
            />
          </View>
          <View style={styles.rolloverRow}>
            <View style={styles.rolloverCopy}>
              <Text style={styles.rolloverTitle}>Rollover unused funds</Text>
              <Text style={styles.rolloverDescription}>
                Carry leftover budget into the next month automatically.
              </Text>
            </View>
            <Switch
              value={rolloverEnabled}
              onValueChange={setRolloverEnabled}
              trackColor={{ true: BG_MONEY, false: BG_SURFACES.high }}
              thumbColor={BG_TEXT}
            />
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
          <BudgetButton
            label={saving ? 'Saving…' : 'Save Envelope'}
            onPress={handleSave}
            disabled={saving}
          />
        </GlassCard>

        <GlassCard style={styles.goalCard}>
          <BudgetHeadline
            title="Target strategy"
            subtitle={targetLabel(snapshot)}
            right={
              <MaterialSymbol
                name={snapshot.goal ? 'savings' : 'data_usage'}
                size={18}
                color={snapshot.goal ? BG_MONEY : BG_ACCENT_LIGHT}
              />
            }
          />
          <View style={styles.metricGrid}>
            <BudgetMetric
              label="Monthly target"
              value={formatBudgetCurrency(snapshot.allocated)}
              tone="warning"
            />
            <BudgetMetric
              label="Suggested"
              value={
                snapshot.goal
                  ? formatBudgetCurrency(linkedGoalContribution)
                  : formatBudgetCurrency(snapshot.envelope.monthly_budget)
              }
              tone={snapshot.goal ? 'money' : 'neutral'}
            />
          </View>
          {snapshot.goal ? (
            <GlassCard style={styles.linkedGoalCard}>
              <BudgetSectionLabel>Linked goal</BudgetSectionLabel>
              <View style={styles.linkedGoalRow}>
                <View style={styles.goalCopy}>
                  <Text style={styles.linkedGoalTitle}>{snapshot.goal.name}</Text>
                  <Text style={styles.linkedGoalMeta}>
                    {snapshot.goal.target_date
                      ? `Target ${snapshot.goal.target_date}`
                      : 'No target date'}
                  </Text>
                </View>
                <Text style={styles.linkedGoalValue}>
                  {formatBudgetCurrency(snapshot.goal.completed_amount)}
                </Text>
              </View>
              <BudgetButton
                tone="secondary"
                label="Open Goal"
                onPress={() => router.push(`/(budget)/goal/${snapshot.goal?.id}` as never)}
              />
            </GlassCard>
          ) : (
            <Text style={styles.infoCopy}>
              No goal is attached to this envelope yet. Create one from the Goals surface if
              you want a date-driven savings plan here.
            </Text>
          )}
        </GlassCard>

        <GlassCard style={styles.moveCard}>
          <BudgetHeadline
            title="Move money"
            subtitle="Shift this month’s target into another envelope."
          />
          <BudgetButton
            label="Open Move Money Sheet"
            tone="secondary"
            icon="swap_horiz"
            onPress={() => setMoveVisible(true)}
          />
        </GlassCard>

        <View style={styles.transactionsHeader}>
          <BudgetSectionLabel>Current activity</BudgetSectionLabel>
          <Text style={styles.transactionsMeta}>
            {snapshot.transactions.length} total transactions
          </Text>
        </View>

        {snapshot.transactions.length === 0 ? (
          <BudgetEmptyState
            icon="receipt_long"
            title="No envelope activity yet"
            message="Transactions assigned to this envelope will appear here."
          />
        ) : (
          snapshot.transactions.slice(0, 8).map((transaction) => (
            <TxRow
              key={transaction.id}
              tx={transaction}
              onPress={() => router.push(`/(budget)/transaction/${transaction.id}` as never)}
              showDate
            />
          ))
        )}
      </BudgetScreen>

      <BudgetSheet
        visible={moveVisible}
        title="Move Money"
        subtitle={`Shift target dollars from ${snapshot.envelope.name}`}
        onClose={() => setMoveVisible(false)}
      >
        <BudgetInput
          value={moveAmount}
          onChangeText={setMoveAmount}
          placeholder="25.00"
          keyboardType="decimal-pad"
        />
        <View style={styles.targetGrid}>
          {otherEnvelopes.map((envelope) => {
            const selected = moveTargetId === envelope.id;
            return (
              <Pressable
                key={envelope.id}
                accessibilityRole="button"
                onPress={() => setMoveTargetId(envelope.id)}
                style={[
                  styles.targetChip,
                  selected ? styles.targetChipSelected : null,
                ]}
              >
                <Text style={styles.targetChipIcon}>{envelope.icon ?? '💼'}</Text>
                <Text
                  numberOfLines={1}
                  style={[
                    styles.targetChipText,
                    selected ? styles.targetChipTextSelected : null,
                  ]}
                >
                  {envelope.name}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <View style={styles.sheetActions}>
          <BudgetButton tone="ghost" label="Cancel" onPress={() => setMoveVisible(false)} />
          <BudgetButton label="Move Money" onPress={handleMoveMoney} />
        </View>
      </BudgetSheet>

      <AddFAB
        label="Add Transaction"
        onPress={() =>
          router.push(`/(budget)/transaction/create?envelopeId=${snapshot.envelope.id}` as never)
        }
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerActions: {
    minWidth: 132,
  },
  heroCard: {
    gap: 16,
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  iconShell: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${BG_ACCENT}22`,
  },
  iconLabel: {
    fontSize: 24,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
    flexShrink: 1,
  },
  progressCopy: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  editorCard: {
    gap: 14,
  },
  inlineFields: {
    flexDirection: 'row',
    gap: 10,
  },
  iconInput: {
    flex: 0.35,
  },
  amountInput: {
    flex: 1,
  },
  rolloverRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  rolloverCopy: {
    flex: 1,
    gap: 4,
  },
  rolloverTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  rolloverDescription: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_DANGER,
  },
  goalCard: {
    gap: 14,
  },
  linkedGoalCard: {
    gap: 12,
    backgroundColor: BG_SURFACES.low,
  },
  linkedGoalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  goalCopy: {
    flex: 1,
    gap: 4,
  },
  linkedGoalTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: BG_TEXT,
  },
  linkedGoalMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
  linkedGoalValue: {
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_MONEY,
  },
  infoCopy: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: BG_TEXT_SECONDARY,
  },
  moveCard: {
    gap: 14,
  },
  transactionsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  transactionsMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
  targetGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  targetChip: {
    minWidth: '47%',
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  targetChipSelected: {
    backgroundColor: `${BG_TRANSFER}22`,
  },
  targetChipIcon: {
    fontSize: 16,
  },
  targetChipText: {
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_TEXT_SECONDARY,
  },
  targetChipTextSelected: {
    color: BG_TEXT,
  },
  sheetActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
