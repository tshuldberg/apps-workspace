import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
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
  GlassCard,
  allocateToEnvelope,
  getAllocationMap,
  getCategoryGroups,
  getEnvelopesByGroup,
  getTransactions,
  listEnvelopes,
  updateEnvelope,
  type Envelope,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetInput,
  BudgetScreen,
  BudgetSectionLabel,
  currentBudgetMonth,
  formatBudgetCurrency,
  monthKeyFromOffset,
  parseBudgetCurrencyInput,
} from '../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../components/DatabaseProvider';

type EnvelopeDraft = {
  amount: string;
  rollover: boolean;
};

type GroupSection = {
  id: string;
  name: string;
  envelopes: Envelope[];
};

function activityForEnvelope(
  envelopeId: string,
  month: string,
  transactions: ReturnType<typeof getTransactions>,
): number {
  return transactions
    .filter(
      (transaction) =>
        transaction.envelope_id === envelopeId && transaction.occurred_on.startsWith(month),
    )
    .reduce((sum, transaction) => {
      if (transaction.direction === 'inflow') {
        return sum + Math.abs(transaction.amount);
      }
      if (transaction.direction === 'transfer') {
        return sum;
      }
      return sum - Math.abs(transaction.amount);
    }, 0);
}

export default function CategoryTargetScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { envelopeId } = useLocalSearchParams<{ envelopeId?: string }>();

  const [month, setMonth] = useState(currentBudgetMonth());
  const [groups, setGroups] = useState<GroupSection[]>([]);
  const [allEnvelopes, setAllEnvelopes] = useState<Envelope[]>([]);
  const [drafts, setDrafts] = useState<Record<string, EnvelopeDraft>>({});
  const [bulkAmount, setBulkAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const monthOptions = useMemo(
    () => [monthKeyFromOffset(0), monthKeyFromOffset(1), monthKeyFromOffset(2)],
    [],
  );

  const load = useCallback(() => {
    setError(null);
    try {
      const envelopes = listEnvelopes(db, false);
      const categoryGroups = getCategoryGroups(db, false);
      const groupedIds = new Set<string>();

      const sections: GroupSection[] = categoryGroups
        .map((group) => {
          const refs = getEnvelopesByGroup(db, group.id);
          const groupEnvelopes = refs
            .map((ref) => envelopes.find((envelope) => envelope.id === ref.id))
            .filter((item): item is Envelope => Boolean(item));

          groupEnvelopes.forEach((entry) => groupedIds.add(entry.id));

          return {
            id: group.id,
            name: group.name,
            envelopes: groupEnvelopes,
          };
        })
        .filter((section) => section.envelopes.length > 0);

      const ungrouped = envelopes.filter((envelope) => !groupedIds.has(envelope.id));
      if (ungrouped.length > 0) {
        sections.push({
          id: 'ungrouped',
          name: 'Ungrouped',
          envelopes: ungrouped,
        });
      }

      const allocations = getAllocationMap(db, month);
      const nextDrafts: Record<string, EnvelopeDraft> = {};
      envelopes.forEach((envelope) => {
        nextDrafts[envelope.id] = {
          amount: ((allocations.get(envelope.id) ?? envelope.monthly_budget) / 100).toFixed(2),
          rollover: envelope.rollover_enabled === 1,
        };
      });

      setAllEnvelopes(envelopes);
      setGroups(sections);
      setDrafts(nextDrafts);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load targets.');
    }
  }, [db, month]);

  useEffect(() => {
    load();
  }, [load]);

  const transactions = useMemo(() => getTransactions(db, { limit: 240 }), [db, month, groups.length]);

  const focusedEnvelopeName = useMemo(
    () => allEnvelopes.find((envelope) => envelope.id === envelopeId)?.name,
    [allEnvelopes, envelopeId],
  );

  const handleDraftChange = useCallback((id: string, patch: Partial<EnvelopeDraft>) => {
    setDrafts((current) => ({
      ...current,
      [id]: {
        ...current[id],
        ...patch,
      },
    }));
  }, []);

  const handleApplyAll = () => {
    const parsed = parseBudgetCurrencyInput(bulkAmount);
    if (parsed === null || parsed < 0) {
      setError('Enter a valid bulk target amount first.');
      return;
    }

    setDrafts((current) => {
      const next = { ...current };
      allEnvelopes.forEach((envelope) => {
        next[envelope.id] = {
          ...next[envelope.id],
          amount: (parsed / 100).toFixed(2),
        };
      });
      return next;
    });
    setError(null);
  };

  const handleSave = () => {
    if (saving) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      allEnvelopes.forEach((envelope) => {
        const draft = drafts[envelope.id];
        const parsedAmount = parseBudgetCurrencyInput(draft?.amount ?? '');
        if (parsedAmount === null || parsedAmount < 0) {
          throw new Error(`Invalid target for ${envelope.name}.`);
        }

        updateEnvelope(db, envelope.id, {
          monthly_budget: parsedAmount,
          rollover_enabled: draft.rollover ? 1 : 0,
        });
        allocateToEnvelope(db, envelope.id, month, parsedAmount);
      });

      Alert.alert('Targets Saved', 'Category targets were updated for this month.');
      router.back();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save targets.');
      setSaving(false);
    }
  };

  return (
    <BudgetScreen>
      <BudgetHeadline
        title="Targets"
        subtitle={
          focusedEnvelopeName
            ? `${focusedEnvelopeName} highlighted in the monthly target editor`
            : 'Update monthly targets and rollover settings in bulk'
        }
      />

      <GlassCard style={styles.periodCard}>
        <BudgetSectionLabel>Budget period</BudgetSectionLabel>
        <View style={styles.periodRow}>
          {monthOptions.map((value) => (
            <BudgetButton
              key={value}
              label={value}
              tone={month === value ? 'primary' : 'secondary'}
              onPress={() => setMonth(value)}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.bulkCard}>
        <BudgetHeadline
          title="Apply to all"
          subtitle="Push a shared target to every envelope, then fine-tune below."
        />
        <View style={styles.bulkRow}>
          <BudgetInput
            value={bulkAmount}
            onChangeText={setBulkAmount}
            placeholder="0.00"
            keyboardType="decimal-pad"
            style={styles.bulkInput}
          />
          <BudgetButton label="Apply" onPress={handleApplyAll} />
        </View>
      </GlassCard>

      {groups.map((group) => (
        <View key={group.id} style={styles.groupSection}>
          <BudgetSectionLabel>{group.name}</BudgetSectionLabel>
          {group.envelopes.map((envelope) => {
            const draft = drafts[envelope.id];
            const allocated = parseBudgetCurrencyInput(draft?.amount ?? '') ?? 0;
            const activity = activityForEnvelope(envelope.id, month, transactions);
            const remaining = allocated + activity;
            const isFocused = envelope.id === envelopeId;

            return (
              <GlassCard
                key={envelope.id}
                style={[
                  styles.envelopeCard,
                  isFocused ? styles.envelopeCardFocused : null,
                ]}
              >
                <View style={styles.envelopeHeader}>
                  <View style={styles.envelopeTitleRow}>
                    <Text style={styles.envelopeIcon}>{envelope.icon ?? '💼'}</Text>
                    <View style={styles.envelopeCopy}>
                      <Text style={styles.envelopeTitle}>{envelope.name}</Text>
                      <Text
                        style={[
                          styles.envelopeStatus,
                          { color: remaining < 0 ? BG_DANGER : BG_MONEY },
                        ]}
                      >
                        {remaining < 0 ? 'Over target' : 'On track'} • {formatBudgetCurrency(remaining)} left
                      </Text>
                    </View>
                  </View>
                  {isFocused ? (
                    <View style={styles.focusedPill}>
                      <Text style={styles.focusedPillText}>Focus</Text>
                    </View>
                  ) : null}
                </View>

                <View style={styles.editorRow}>
                  <BudgetInput
                    value={draft?.amount ?? ''}
                    onChangeText={(value) => handleDraftChange(envelope.id, { amount: value })}
                    placeholder="0.00"
                    keyboardType="decimal-pad"
                    style={styles.targetInput}
                  />
                  <View style={styles.switchShell}>
                    <Text style={styles.switchShellLabel}>Rollover</Text>
                    <Switch
                      value={draft?.rollover ?? false}
                      onValueChange={(value) => handleDraftChange(envelope.id, { rollover: value })}
                      trackColor={{ true: BG_MONEY, false: BG_SURFACES.high }}
                      thumbColor={BG_TEXT}
                    />
                  </View>
                </View>

                <View style={styles.targetMetaRow}>
                  <Text style={styles.targetMeta}>Actual: {formatBudgetCurrency(Math.abs(Math.min(activity, 0)))}</Text>
                  <Text style={styles.targetMeta}>Target: {formatBudgetCurrency(allocated)}</Text>
                </View>
              </GlassCard>
            );
          })}
        </View>
      ))}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.footerActions}>
        <BudgetButton tone="ghost" label="Cancel" onPress={() => router.back()} />
        <BudgetButton label={saving ? 'Saving…' : 'Save Targets'} onPress={handleSave} />
      </View>
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  periodCard: {
    gap: 14,
  },
  periodRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  bulkCard: {
    gap: 12,
  },
  bulkRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'center',
  },
  bulkInput: {
    flex: 1,
  },
  groupSection: {
    gap: 10,
  },
  envelopeCard: {
    gap: 14,
  },
  envelopeCardFocused: {
    backgroundColor: `${BG_ACCENT}18`,
  },
  envelopeHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  envelopeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  envelopeIcon: {
    fontSize: 18,
  },
  envelopeCopy: {
    flex: 1,
    gap: 4,
  },
  envelopeTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
    color: BG_TEXT,
  },
  envelopeStatus: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  focusedPill: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: `${BG_ACCENT_LIGHT}20`,
  },
  focusedPillText: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    color: BG_ACCENT_LIGHT,
  },
  editorRow: {
    flexDirection: 'row',
    gap: 10,
  },
  targetInput: {
    flex: 1,
  },
  switchShell: {
    minWidth: 120,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 12,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  switchShellLabel: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
  targetMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  targetMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_DANGER,
  },
  footerActions: {
    flexDirection: 'row',
    gap: 10,
  },
});
