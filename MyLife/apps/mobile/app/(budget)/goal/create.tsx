import React, { useEffect, useMemo, useState } from 'react';
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
  GoalProgressRing,
  GlassCard,
  MaterialSymbol,
  calculateGoalProgress,
  createGoal,
  listEnvelopes,
  suggestMonthlyContribution,
  type Envelope,
} from '@mylife/budget';
import {
  BudgetStatusPill,
  formatBudgetCurrency,
  getBudgetGoalLabel,
  getBudgetGoalTone,
} from '../../../components/budget/BudgetPhase3Shared';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

function parseAmountInput(value: string): number | null {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    return null;
  }
  return Math.round(parsed * 100);
}

export default function BudgetCreateGoalScreen() {
  const router = useRouter();
  const db = useDatabase();

  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [name, setName] = useState('');
  const [targetAmount, setTargetAmount] = useState('5000.00');
  const [completedAmount, setCompletedAmount] = useState('0.00');
  const [targetDate, setTargetDate] = useState('');
  const [envelopeId, setEnvelopeId] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const envelopeRows = listEnvelopes(db, false);
      setEnvelopes(envelopeRows);
      if (envelopeRows.length > 0) {
        setEnvelopeId(envelopeRows[0].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load goal form.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  const parsedTarget = parseAmountInput(targetAmount) ?? 0;
  const parsedCompleted = parseAmountInput(completedAmount) ?? 0;
  const previewGoal = useMemo(
    () => ({
      createdAt: new Date().toISOString(),
      currentAmount: parsedCompleted,
      id: 'preview-goal',
      name: name.trim() || 'Untitled Goal',
      targetAmount: parsedTarget,
      targetDate: targetDate.trim() || null,
    }),
    [completedAmount, name, parsedCompleted, parsedTarget, targetDate],
  );
  const previewProgress = useMemo(
    () => calculateGoalProgress(previewGoal),
    [previewGoal],
  );
  const previewMonthly = useMemo(
    () => suggestMonthlyContribution(previewGoal),
    [previewGoal],
  );

  const handleCreate = () => {
    if (submitting) {
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError('Goal name is required.');
      return;
    }

    if (!envelopeId) {
      setError('Select an envelope before creating a goal.');
      return;
    }

    const nextTarget = parseAmountInput(targetAmount);
    if (nextTarget === null || nextTarget <= 0) {
      setError('Target amount must be greater than zero.');
      return;
    }

    const nextCompleted = parseAmountInput(completedAmount);
    if (nextCompleted === null) {
      setError('Saved amount must be a valid non-negative number.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      createGoal(db, uuid(), {
        completed_amount: nextCompleted,
        envelope_id: envelopeId,
        is_completed: nextCompleted >= nextTarget ? 1 : 0,
        name: trimmedName,
        target_amount: nextTarget,
        target_date: targetDate.trim() || null,
      });
      router.replace(`/(budget)/goals?refresh=${Date.now()}` as never);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create goal.');
      setSubmitting(false);
    }
  };

  const selectedEnvelope =
    envelopes.find((envelope) => envelope.id === envelopeId)?.name ?? 'No envelope';

  if (loading) {
    return (
      <View style={styles.centered}>
        <GlassCard style={styles.loadingCard}>
          <Text style={styles.loadingText}>Preparing goal form…</Text>
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
          <View style={styles.heroCopy}>
            <Text style={styles.eyebrow}>Goal Builder</Text>
            <Text style={styles.heroTitle}>New Goal</Text>
            <Text style={styles.heroSubtitle}>
              Define the target, connect it to an envelope, and preview the pace before you save.
            </Text>
          </View>
          <View style={styles.heroIcon}>
            <MaterialSymbol color={BG_ACCENT_LIGHT} name="flag" size={28} />
          </View>
        </View>

        <View style={styles.previewRow}>
          <GoalProgressRing current={parsedCompleted} size={132} target={parsedTarget} />
          <View style={styles.previewSummary}>
            <BudgetStatusPill
              label={getBudgetGoalLabel(previewProgress.status)}
              tone={getBudgetGoalTone(previewProgress.status)}
            />
            <Text style={styles.previewHeadline}>
              {formatBudgetCurrency(parsedCompleted)} saved of{' '}
              {formatBudgetCurrency(parsedTarget)}
            </Text>
            <Text style={styles.previewBody}>
              Linked to {selectedEnvelope}. Recommended pace:{' '}
              {formatBudgetCurrency(previewMonthly)} / month.
            </Text>
          </View>
        </View>
      </GlassCard>

      <GlassCard style={styles.formCard}>
        <Text style={styles.sectionTitle}>Goal Details</Text>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Goal Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Emergency Fund"
            placeholderTextColor={BG_TEXT_TERTIARY}
            style={styles.input}
          />
        </View>

        <View style={styles.field}>
          <Text style={styles.fieldLabel}>Linked Envelope</Text>
          <View style={styles.chipWrap}>
            {envelopes.map((envelope) => {
              const selected = envelope.id === envelopeId;
              return (
                <Pressable
                  key={envelope.id}
                  onPress={() => setEnvelopeId(envelope.id)}
                  style={[
                    styles.envelopeChip,
                    selected ? styles.envelopeChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.envelopeChipLabel,
                      selected ? styles.envelopeChipLabelSelected : null,
                    ]}
                  >
                    {envelope.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>Target Amount</Text>
            <TextInput
              value={targetAmount}
              onChangeText={setTargetAmount}
              placeholder="5000.00"
              placeholderTextColor={BG_TEXT_TERTIARY}
              keyboardType="decimal-pad"
              style={styles.input}
            />
          </View>
          <View style={styles.fieldFlex}>
            <Text style={styles.fieldLabel}>Already Saved</Text>
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

        {envelopes.length === 0 ? (
          <Text style={styles.errorText}>
            Create at least one envelope before adding a goal.
          </Text>
        ) : null}

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <View style={styles.actions}>
          <Pressable onPress={() => router.back()} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonLabel}>Cancel</Text>
          </Pressable>
          <Pressable
            disabled={envelopes.length === 0}
            onPress={handleCreate}
            style={[
              styles.primaryButton,
              envelopes.length === 0 ? styles.primaryButtonDisabled : null,
            ]}
          >
            <Text style={styles.primaryButtonLabel}>
              {submitting ? 'Creating…' : 'Create Goal'}
            </Text>
          </Pressable>
        </View>
      </GlassCard>
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
    gap: 18,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 184, 119, 0.12)',
    borderRadius: 18,
    height: 56,
    justifyContent: 'center',
    width: 56,
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
  },
  previewRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 16,
  },
  previewSummary: {
    flex: 1,
    gap: 10,
  },
  previewHeadline: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 24,
  },
  previewBody: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
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
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  envelopeChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  envelopeChipSelected: {
    backgroundColor: 'rgba(255, 184, 119, 0.16)',
  },
  envelopeChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  envelopeChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 8,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT,
    borderRadius: 18,
    flex: 1,
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
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 18,
  },
  secondaryButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
  },
  errorText: {
    color: '#FFB4AB',
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
});
