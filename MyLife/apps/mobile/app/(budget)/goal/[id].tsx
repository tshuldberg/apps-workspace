import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AmountDisplay,
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GoalProgressRing,
  GlassCard,
  MaterialSymbol,
  calculateGoalProgress,
  calculateGoalProjection,
  deleteGoal,
  getGoalById,
  listEnvelopes,
  suggestMonthlyContribution,
  updateGoal,
  type Envelope,
} from '@mylife/budget';
import {
  BudgetLineChart,
  BudgetStatusPill,
  daysUntilBudgetDate,
  formatBudgetCurrency,
  formatBudgetDate,
  getBudgetGoalLabel,
  getBudgetGoalTone,
  relativeBudgetDate,
  type BudgetChartPoint,
} from '../../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../../components/DatabaseProvider';

function parseAmountInput(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

function buildContributionHistory(
  createdAt: string,
  currentAmount: number,
): BudgetChartPoint[] {
  const today = new Date();
  const start = new Date(createdAt);
  const monthSpan = Math.max(
    1,
    (today.getFullYear() - start.getFullYear()) * 12 +
      (today.getMonth() - start.getMonth()),
  );
  const pointCount = Math.max(4, Math.min(6, monthSpan + 1));

  return Array.from({ length: pointCount }, (_, index) => {
    const ratio = pointCount === 1 ? 1 : index / (pointCount - 1);
    const point = new Date(today.getFullYear(), today.getMonth() - (pointCount - 1 - index), 1);

    return {
      label: point.toLocaleDateString('en-US', { month: 'short' }),
      value: Math.round(currentAmount * ratio),
    };
  });
}

export default function BudgetGoalScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const goalId = Array.isArray(id) ? id[0] : id;

  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [goalName, setGoalName] = useState('');
  const [goalCreatedAt, setGoalCreatedAt] = useState(new Date().toISOString());
  const [envelopeId, setEnvelopeId] = useState('');
  const [targetAmount, setTargetAmount] = useState('0.00');
  const [completedAmount, setCompletedAmount] = useState('0.00');
  const [targetDate, setTargetDate] = useState('');
  const [isCompleted, setIsCompleted] = useState(0);

  useEffect(() => {
    if (!goalId) {
      setError('Goal not found.');
      setLoading(false);
      return;
    }

    try {
      const goal = getGoalById(db, goalId);
      if (!goal) {
        setError('Goal not found.');
        setLoading(false);
        return;
      }

      setEnvelopes(listEnvelopes(db, true));
      setGoalName(goal.name);
      setGoalCreatedAt(goal.created_at);
      setEnvelopeId(goal.envelope_id);
      setTargetAmount((goal.target_amount / 100).toFixed(2));
      setCompletedAmount((goal.completed_amount / 100).toFixed(2));
      setTargetDate(goal.target_date ?? '');
      setIsCompleted(goal.is_completed);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goal.');
    } finally {
      setLoading(false);
    }
  }, [db, goalId]);

  const goToList = () => {
    router.replace(`/(budget)/goals?refresh=${Date.now()}` as never);
  };

  const envelopeName = useMemo(
    () => envelopes.find((envelope) => envelope.id === envelopeId)?.name ?? 'Unlinked envelope',
    [envelopes, envelopeId],
  );

  const parsedTarget = parseAmountInput(targetAmount) ?? 0;
  const parsedCompleted = parseAmountInput(completedAmount) ?? 0;
  const engineGoal = useMemo(
    () => ({
      createdAt: goalCreatedAt,
      currentAmount: parsedCompleted,
      id: goalId ?? 'goal',
      name: goalName || 'Goal',
      targetAmount: parsedTarget,
      targetDate: targetDate.trim() || null,
    }),
    [goalCreatedAt, goalId, goalName, parsedCompleted, parsedTarget, targetDate],
  );

  const progress = useMemo(
    () => calculateGoalProgress(engineGoal),
    [engineGoal],
  );
  const recommendedMonthly = useMemo(
    () => suggestMonthlyContribution(engineGoal),
    [engineGoal],
  );
  const projectedMonthly = useMemo(() => {
    const start = new Date(goalCreatedAt);
    const now = new Date();
    const elapsedMonths = Math.max(
      1,
      (now.getFullYear() - start.getFullYear()) * 12 +
        (now.getMonth() - start.getMonth()) +
        1,
    );
    return Math.round(parsedCompleted / elapsedMonths);
  }, [goalCreatedAt, parsedCompleted]);
  const projection = useMemo(
    () => calculateGoalProjection(engineGoal, projectedMonthly),
    [engineGoal, projectedMonthly],
  );
  const contributionHistory = useMemo(
    () => buildContributionHistory(goalCreatedAt, parsedCompleted),
    [goalCreatedAt, parsedCompleted],
  );
  const remaining = Math.max(0, parsedTarget - parsedCompleted);
  const daysRemaining = daysUntilBudgetDate(targetDate.trim() || null);

  const handleSave = () => {
    if (!goalId || submitting) {
      return;
    }

    const trimmedName = goalName.trim();
    if (!trimmedName) {
      setError('Goal name is required.');
      return;
    }

    const nextTarget = parseAmountInput(targetAmount);
    if (nextTarget === null || nextTarget <= 0) {
      setError('Target amount must be greater than zero.');
      return;
    }

    const nextCompleted = parseAmountInput(completedAmount);
    if (nextCompleted === null) {
      setError('Saved amount must be a valid non-negative value.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      updateGoal(db, goalId, {
        completed_amount: nextCompleted,
        is_completed: isCompleted === 1 || nextCompleted >= nextTarget ? 1 : 0,
        name: trimmedName,
        target_amount: nextTarget,
        target_date: targetDate.trim() || null,
      });
      setEditing(false);
      goToList();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save goal.');
      setSubmitting(false);
    }
  };

  const handleToggleCompleted = () => {
    if (!goalId || submitting) {
      return;
    }

    const nextCompletedState = isCompleted === 1 ? 0 : 1;
    const nextCompletedAmount =
      nextCompletedState === 1 ? Math.max(parsedCompleted, parsedTarget) : parsedCompleted;

    setSubmitting(true);
    setError(null);
    try {
      updateGoal(db, goalId, {
        completed_amount: nextCompletedAmount,
        is_completed: nextCompletedState,
      });
      setCompletedAmount((nextCompletedAmount / 100).toFixed(2));
      setIsCompleted(nextCompletedState);
      setSubmitting(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update goal.');
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!goalId || submitting) {
      return;
    }

    Alert.alert('Delete Goal', 'Delete this goal? This action cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          setSubmitting(true);
          setError(null);
          try {
            deleteGoal(db, goalId);
            goToList();
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete goal.');
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>Loading goal…</Text>
        </GlassCard>
      </View>
    );
  }

  if (!goalId || (error && !goalName)) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>{error ?? 'Goal not found.'}</Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
    >
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroHeader}>
          <View style={styles.heroTitleBlock}>
            <Text style={styles.eyebrow}>Savings Goal</Text>
            <Text style={styles.heroTitle}>{goalName}</Text>
            <Text style={styles.heroSubtitle}>{envelopeName}</Text>
          </View>
          <View style={styles.heroActions}>
            <Pressable
              accessibilityLabel={editing ? 'Close Goal Editor' : 'Edit Goal'}
              onPress={() => setEditing((current) => !current)}
              style={styles.iconButton}
            >
              <MaterialSymbol color={BG_TEXT} name={editing ? 'close' : 'edit'} size={18} />
            </Pressable>
            <Pressable accessibilityLabel="Delete Goal" onPress={handleDelete} style={styles.iconButton}>
              <MaterialSymbol color={BG_TEXT} name="delete" size={18} />
            </Pressable>
          </View>
        </View>

        <View style={styles.heroBody}>
          <GoalProgressRing current={parsedCompleted} size={200} target={parsedTarget} />
          <View style={styles.heroSummary}>
            <BudgetStatusPill
              label={getBudgetGoalLabel(progress.status)}
              tone={getBudgetGoalTone(progress.status)}
            />
            <View style={styles.heroAmountRow}>
              <View style={styles.heroAmountStat}>
                <Text style={styles.heroAmountLabel}>Saved</Text>
                <AmountDisplay cents={parsedCompleted} size="lg" />
              </View>
              <View style={styles.heroAmountStat}>
                <Text style={styles.heroAmountLabel}>Target</Text>
                <Text style={styles.heroAmountValue}>
                  {formatBudgetCurrency(parsedTarget)}
                </Text>
              </View>
              <View style={styles.heroAmountStat}>
                <Text style={styles.heroAmountLabel}>Remaining</Text>
                <Text style={styles.heroAmountValue}>
                  {formatBudgetCurrency(remaining)}
                </Text>
              </View>
            </View>

            <View style={styles.pacingCard}>
              <Text style={styles.pacingHeadline}>Pacing</Text>
              <Text style={styles.pacingBody}>
                {targetDate
                  ? `${formatBudgetDate(targetDate)} · ${relativeBudgetDate(targetDate)}`
                  : 'Flexible timeline'}
              </Text>
              <Text style={styles.pacingBody}>
                {daysRemaining !== null
                  ? `${Math.max(daysRemaining, 0)} days remaining`
                  : 'No target date set'}
              </Text>
              <Text style={styles.pacingRecommendation}>
                Recommended contribution: {formatBudgetCurrency(recommendedMonthly)} / month
              </Text>
              <Text style={styles.pacingProjection}>
                Projected finish: {projection.projectedDate ? formatBudgetDate(projection.projectedDate) : 'Needs more funding'}
              </Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {editing ? (
        <GlassCard style={styles.editCard}>
          <Text style={styles.sectionTitle}>Edit Goal</Text>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              value={goalName}
              onChangeText={setGoalName}
              placeholder="Emergency Fund"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
            />
          </View>

          <View style={styles.fieldRow}>
            <View style={styles.fieldFlex}>
              <Text style={styles.fieldLabel}>Target</Text>
              <TextInput
                value={targetAmount}
                onChangeText={setTargetAmount}
                placeholder="0.00"
                placeholderTextColor={BG_TEXT_TERTIARY}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
            <View style={styles.fieldFlex}>
              <Text style={styles.fieldLabel}>Saved</Text>
              <TextInput
                value={completedAmount}
                onChangeText={setCompletedAmount}
                placeholder="0.00"
                placeholderTextColor={BG_TEXT_TERTIARY}
                keyboardType="decimal-pad"
                style={styles.input}
              />
            </View>
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Target Date</Text>
            <TextInput
              value={targetDate}
              onChangeText={setTargetDate}
              placeholder="2026-12-31"
              placeholderTextColor={BG_TEXT_TERTIARY}
              autoCapitalize="none"
              style={styles.input}
            />
          </View>

          <View style={styles.editStatusRow}>
            <BudgetStatusPill
              label={isCompleted === 1 ? 'Achieved' : 'In Progress'}
              tone={isCompleted === 1 ? 'positive' : 'accent'}
            />
            <Pressable onPress={handleToggleCompleted} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonLabel}>
                {isCompleted === 1 ? 'Mark Active' : 'Mark Complete'}
              </Text>
            </Pressable>
          </View>

          <Pressable onPress={handleSave} style={styles.primaryButton}>
            <Text style={styles.primaryButtonLabel}>
              {submitting ? 'Saving…' : 'Save Goal'}
            </Text>
          </Pressable>
        </GlassCard>
      ) : (
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contribution History</Text>
            <Text style={styles.sectionMeta}>
              Avg. {formatBudgetCurrency(projectedMonthly)} / month
            </Text>
          </View>
          <BudgetLineChart color={BG_ACCENT_LIGHT} data={contributionHistory} />
          <Text style={styles.sectionHelper}>
            This view reflects the goal’s saved balance trajectory from its creation date.
          </Text>
        </GlassCard>
      )}

      <GlassCard style={styles.sectionCard}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Linked Envelope</Text>
          <BudgetStatusPill label={envelopeName} tone="info" />
        </View>
        <Text style={styles.sectionHelper}>
          Contributions to this goal should be tagged to the linked envelope so the plan and transaction history stay aligned.
        </Text>
        <Pressable
          disabled={!envelopeId}
          onPress={() =>
            router.push(
              `/(budget)/transaction/create?direction=transfer&envelopeId=${encodeURIComponent(
                envelopeId,
              )}&note=${encodeURIComponent(`Contribution to ${goalName}`)}` as never,
            )
          }
          style={[
            styles.primaryButton,
            !envelopeId ? styles.primaryButtonDisabled : null,
          ]}
        >
          <Text style={styles.primaryButtonLabel}>Add Contribution</Text>
        </Pressable>
      </GlassCard>

      {error ? (
        <Text style={styles.errorText}>{error}</Text>
      ) : null}
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
    lineHeight: 22,
  },
  heroCard: {
    gap: 20,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroTitleBlock: {
    flex: 1,
    gap: 4,
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
    fontSize: 28,
    lineHeight: 32,
  },
  heroSubtitle: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 16,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroBody: {
    alignItems: 'center',
    gap: 20,
  },
  heroSummary: {
    alignItems: 'stretch',
    gap: 14,
    width: '100%',
  },
  heroAmountRow: {
    flexDirection: 'row',
    gap: 10,
  },
  heroAmountStat: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    flex: 1,
    gap: 6,
    padding: 14,
  },
  heroAmountLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  heroAmountValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  pacingCard: {
    backgroundColor: 'rgba(255, 184, 119, 0.08)',
    borderRadius: 20,
    gap: 6,
    padding: 16,
  },
  pacingHeadline: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  pacingBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 19,
  },
  pacingRecommendation: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 19,
    marginTop: 4,
  },
  pacingProjection: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  editCard: {
    gap: 14,
  },
  sectionCard: {
    gap: 14,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  sectionTitle: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 24,
  },
  sectionMeta: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  sectionHelper: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
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
  editStatusRow: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT,
    borderRadius: 18,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  primaryButtonDisabled: {
    opacity: 0.45,
  },
  primaryButtonLabel: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 16,
    justifyContent: 'center',
    minHeight: 44,
    paddingHorizontal: 14,
  },
  secondaryButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    textAlign: 'center',
  },
});
