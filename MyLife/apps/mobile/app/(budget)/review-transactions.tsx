import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_CARD_RADIUS,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  TxRow,
  applyRules,
  createCategorizationFeedback,
  getCategorizationAccuracy,
  getEnabledTransactionRules,
  getEnvelopeSuggestion,
  listEnvelopes,
  listTransactions,
  updateTransaction,
  type BudgetTransaction,
  type Envelope,
  type TransactionRule,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetEmptyState,
  BudgetHeadline,
  BudgetProgressBar,
  BudgetScreen,
} from '../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../components/DatabaseProvider';
import { uuid } from '../../lib/uuid';

type SuggestedAssignment = {
  envelopeId: string | null;
  source: 'history' | 'rule' | 'none';
  confidence: number;
  ruleName?: string | null;
};

function normalizeMerchant(value: string | null): string {
  return (value ?? '').trim().toLowerCase();
}

function buildRulePreview(tx: BudgetTransaction, rules: TransactionRule[]) {
  const engineRules = rules.map((rule) => ({
    id: rule.id,
    name: rule.payee_pattern,
    priority: rule.priority,
    matchAll: false,
    conditions: [
      {
        field: 'payee' as const,
        operator: rule.match_type === 'exact' ? 'equals' as const : rule.match_type,
        value: rule.payee_pattern,
      },
    ],
    actions: [{ type: 'set_envelope' as const, value: rule.envelope_id }],
    isEnabled: rule.is_enabled === 1,
  }));

  return applyRules(engineRules, {
    payee: tx.merchant ?? '',
    amount: tx.amount,
    accountId: tx.account_id ?? '',
    memo: tx.note ?? '',
  });
}

export default function ReviewTransactionsScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [unreviewed, setUnreviewed] = useState<BudgetTransaction[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [initialCount, setInitialCount] = useState(0);
  const [accuracy, setAccuracy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setError(null);
    try {
      const transactions = listTransactions(db, { limit: 200 }).filter((transaction) => !transaction.envelope_id);
      setUnreviewed(transactions);
      setInitialCount((current) => (current === 0 ? transactions.length : current));
      setEnvelopes(listEnvelopes(db, false));
      setAccuracy(getCategorizationAccuracy(db).accuracy);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load review queue.');
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const suggestions = useMemo(() => {
    const enabledRules = getEnabledTransactionRules(db);
    const map = new Map<string, SuggestedAssignment>();

    unreviewed.forEach((transaction) => {
      const historyEnvelopeId = transaction.merchant ? getEnvelopeSuggestion(db, transaction.merchant) : null;
      if (historyEnvelopeId) {
        map.set(transaction.id, {
          envelopeId: historyEnvelopeId,
          source: 'history',
          confidence: 0.86,
        });
        return;
      }

      const preview = buildRulePreview(transaction, enabledRules);
      map.set(transaction.id, {
        envelopeId: preview.envelopeId,
        source: preview.envelopeId ? 'rule' : 'none',
        confidence: preview.envelopeId ? 0.64 : 0,
        ruleName: preview.matches[0]?.ruleName ?? null,
      });
    });

    return map;
  }, [db, unreviewed]);

  const envelopeMap = useMemo(
    () => new Map(envelopes.map((envelope) => [envelope.id, envelope])),
    [envelopes],
  );

  const reviewedCount = Math.max(initialCount - unreviewed.length, 0);
  const progressTotal = initialCount === 0 ? Math.max(unreviewed.length, 1) : initialCount;

  const applyAssignment = (transaction: BudgetTransaction, envelopeId: string, suggested: SuggestedAssignment) => {
    try {
      updateTransaction(db, transaction.id, { envelope_id: envelopeId });
      createCategorizationFeedback(db, uuid(), {
        transaction_id: transaction.id,
        merchant_normalized: normalizeMerchant(transaction.merchant),
        predicted_envelope_id: suggested.envelopeId,
        actual_envelope_id: envelopeId,
        confidence: suggested.confidence,
        was_accepted: suggested.envelopeId === envelopeId ? 1 : 0,
      });
      setUnreviewed((current) => current.filter((row) => row.id !== transaction.id));
      setExpandedId(null);
      setAccuracy(getCategorizationAccuracy(db).accuracy);
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : 'Failed to update transaction.');
    }
  };

  const handleApproveAll = () => {
    try {
      let applied = 0;
      unreviewed.forEach((transaction) => {
        const suggested = suggestions.get(transaction.id);
        if (!suggested?.envelopeId) {
          return;
        }
        updateTransaction(db, transaction.id, { envelope_id: suggested.envelopeId });
        createCategorizationFeedback(db, uuid(), {
          transaction_id: transaction.id,
          merchant_normalized: normalizeMerchant(transaction.merchant),
          predicted_envelope_id: suggested.envelopeId,
          actual_envelope_id: suggested.envelopeId,
          confidence: suggested.confidence,
          was_accepted: 1,
        });
        applied += 1;
      });

      if (applied > 0) {
        load();
      }
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Failed to approve suggestions.');
    }
  };

  if (unreviewed.length === 0) {
    return (
      <BudgetScreen>
        <BudgetEmptyState
          icon="verified"
          title="Review queue is clear"
          message="Every uncategorized transaction already has an envelope assignment."
          action={<BudgetButton label="Back to Budget" onPress={() => router.back()} />}
        />
      </BudgetScreen>
    );
  }

  return (
    <BudgetScreen>
      <GlassCard style={styles.heroCard}>
        <BudgetHeadline
          title="Review"
          subtitle={`${unreviewed.length} transactions still need category review`}
          right={
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreviewed.length}</Text>
            </View>
          }
        />
        <BudgetProgressBar value={reviewedCount} total={progressTotal} tone={BG_MONEY} />
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {reviewedCount} reviewed of {progressTotal}
          </Text>
          <Text style={styles.metaText}>Accuracy {accuracy}%</Text>
        </View>
        <View style={styles.actionRow}>
          <BudgetButton tone="secondary" label="Approve All Suggestions" onPress={handleApproveAll} />
          <BudgetButton tone="ghost" label="Skip All" onPress={() => setExpandedId(null)} />
        </View>
      </GlassCard>

      {unreviewed.map((transaction) => {
        const suggestion = suggestions.get(transaction.id) ?? {
          envelopeId: null,
          source: 'none',
          confidence: 0,
        };
        const suggestedEnvelope = suggestion.envelopeId ? envelopeMap.get(suggestion.envelopeId) : null;
        const expanded = expandedId === transaction.id;

        return (
          <GlassCard key={transaction.id} style={styles.transactionCard}>
            <TxRow tx={transaction} />
            <View style={styles.suggestionCard}>
              <View style={styles.suggestionHeader}>
                <View style={styles.suggestionCopy}>
                  <Text style={styles.suggestionTitle}>
                    {suggestedEnvelope
                      ? `Suggested: ${suggestedEnvelope.name}`
                      : 'No suggestion yet'}
                  </Text>
                  <Text style={styles.suggestionMeta}>
                    {suggestion.source === 'history'
                      ? `Learned from previous ${transaction.merchant ?? 'merchant'} activity`
                      : suggestion.source === 'rule'
                        ? `Matched rule "${suggestion.ruleName ?? 'Unnamed rule'}"`
                        : 'Choose an envelope manually or create a rule'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.confidenceText,
                    {
                      color:
                        suggestion.source === 'history'
                          ? BG_MONEY
                          : suggestion.source === 'rule'
                            ? BG_ACCENT_LIGHT
                            : BG_TEXT_TERTIARY,
                    },
                  ]}
                >
                  {suggestion.confidence > 0 ? `${Math.round(suggestion.confidence * 100)}%` : 'Manual'}
                </Text>
              </View>

              <View style={styles.actionRow}>
                {suggestedEnvelope ? (
                  <BudgetButton
                    label="Approve"
                    onPress={() => applyAssignment(transaction, suggestedEnvelope.id, suggestion)}
                  />
                ) : null}
                <BudgetButton
                  tone="secondary"
                  label={expanded ? 'Hide Manual Pick' : 'Edit'}
                  onPress={() => setExpandedId(expanded ? null : transaction.id)}
                />
                <BudgetButton
                  tone="ghost"
                  label="Create Rule"
                  onPress={() =>
                    router.push(
                      (`/(budget)/rules/create?payee=${encodeURIComponent(transaction.merchant ?? '')}${suggestion.envelopeId ? `&envelopeId=${suggestion.envelopeId}` : ''}`) as never,
                    )
                  }
                />
              </View>

              {expanded ? (
                <View style={styles.envelopeGrid}>
                  {envelopes.map((envelope) => (
                    <BudgetButton
                      key={`${transaction.id}:${envelope.id}`}
                      label={envelope.name}
                      tone={suggestion.envelopeId === envelope.id ? 'primary' : 'secondary'}
                      onPress={() => applyAssignment(transaction, envelope.id, suggestion)}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          </GlassCard>
        );
      })}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  badge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: `${BG_DANGER}22`,
  },
  badgeText: {
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_DANGER,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  metaText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 10,
    flexWrap: 'wrap',
  },
  transactionCard: {
    gap: 14,
  },
  suggestionCard: {
    gap: 12,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  suggestionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  suggestionCopy: {
    flex: 1,
    gap: 4,
  },
  suggestionTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  suggestionMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
  confidenceText: {
    fontFamily: BG_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  envelopeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_DANGER,
  },
});
