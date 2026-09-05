import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BG_DANGER,
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  createTransactionRule,
  listEnvelopes,
  listTransactions,
  updateTransactionRule,
  type Envelope,
  type MatchType,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetInput,
  BudgetScreen,
  BudgetSectionLabel,
} from '../../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

const MATCH_TYPES: MatchType[] = ['contains', 'exact', 'starts_with'];

export default function CreateRuleScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{
    ruleId?: string;
    payee?: string;
    matchType?: MatchType;
    envelopeId?: string;
    priority?: string;
  }>();

  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [payeePattern, setPayeePattern] = useState(params.payee ?? '');
  const [matchType, setMatchType] = useState<MatchType>(params.matchType ?? 'contains');
  const [envelopeId, setEnvelopeId] = useState(params.envelopeId ?? '');
  const [priority, setPriority] = useState(params.priority ?? '0');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    try {
      const rows = listEnvelopes(db, false);
      setEnvelopes(rows);
      if (!envelopeId && rows[0]) {
        setEnvelopeId(rows[0].id);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load envelopes.');
    }
  }, [db, envelopeId]);

  const previewMatches = useMemo(() => {
    if (!payeePattern.trim()) {
      return [];
    }

    const normalized = payeePattern.trim().toLowerCase();
    return listTransactions(db, { limit: 24 }).filter((transaction) => {
      const merchant = (transaction.merchant ?? '').toLowerCase();
      if (matchType === 'exact') {
        return merchant === normalized;
      }
      if (matchType === 'starts_with') {
        return merchant.startsWith(normalized);
      }
      return merchant.includes(normalized);
    });
  }, [db, matchType, payeePattern]);

  const handleSave = () => {
    if (submitting) {
      return;
    }
    if (!payeePattern.trim()) {
      setError('Enter a payee pattern.');
      return;
    }
    if (!envelopeId) {
      setError('Choose an envelope.');
      return;
    }

    const parsedPriority = Number(priority);
    if (!Number.isFinite(parsedPriority)) {
      setError('Priority must be a number.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (params.ruleId) {
        updateTransactionRule(db, params.ruleId, {
          payee_pattern: payeePattern.trim(),
          match_type: matchType,
          envelope_id: envelopeId,
          priority: parsedPriority,
        });
      } else {
        createTransactionRule(db, uuid(), {
          payee_pattern: payeePattern.trim(),
          match_type: matchType,
          envelope_id: envelopeId,
          priority: parsedPriority,
        });
      }

      router.replace('/(budget)/rules' as never);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save rule.');
      setSubmitting(false);
    }
  };

  return (
    <BudgetScreen>
      <BudgetHeadline
        title={params.ruleId ? 'Edit Rule' : 'New Rule'}
        subtitle="Build a payee-based auto-categorization rule with live match preview."
      />

      <GlassCard style={styles.card}>
        <BudgetSectionLabel>Condition</BudgetSectionLabel>
        <BudgetInput
          value={payeePattern}
          onChangeText={setPayeePattern}
          placeholder="Starbucks"
          autoFocus
        />
        <View style={styles.choiceGrid}>
          {MATCH_TYPES.map((option) => (
            <BudgetButton
              key={option}
              label={option.replace('_', ' ')}
              tone={matchType === option ? 'primary' : 'secondary'}
              onPress={() => setMatchType(option)}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <BudgetSectionLabel>Action</BudgetSectionLabel>
        <Text style={styles.actionTitle}>Set envelope to:</Text>
        <View style={styles.choiceGrid}>
          {envelopes.map((envelope) => (
            <BudgetButton
              key={envelope.id}
              label={envelope.name}
              tone={envelopeId === envelope.id ? 'primary' : 'secondary'}
              onPress={() => setEnvelopeId(envelope.id)}
            />
          ))}
        </View>
        <BudgetInput
          value={priority}
          onChangeText={setPriority}
          placeholder="0"
          keyboardType="number-pad"
        />
        <Text style={styles.helperText}>
          Lower numbers run first. This builder persists the supported payee rule model that exists
          in MyBudget today.
        </Text>
      </GlassCard>

      <View style={styles.previewSection}>
        <BudgetSectionLabel>Preview matching transactions</BudgetSectionLabel>
        {previewMatches.length === 0 ? (
          <GlassCard style={styles.previewCard}>
            <Text style={styles.previewTitle}>No recent matches</Text>
            <Text style={styles.helperText}>
              Adjust the payee pattern or operator to preview recent transaction hits.
            </Text>
          </GlassCard>
        ) : (
          previewMatches.map((transaction) => (
            <GlassCard key={transaction.id} style={styles.previewCard}>
              <Text style={styles.previewTitle}>{transaction.merchant ?? 'Transaction'}</Text>
              <Text style={styles.previewMeta}>
                {transaction.occurred_on} • {(transaction.amount / 100).toFixed(2)}
              </Text>
            </GlassCard>
          ))
        )}
      </View>

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <View style={styles.actions}>
        <BudgetButton tone="ghost" label="Cancel" onPress={() => router.back()} />
        <BudgetButton
          label={submitting ? 'Saving…' : params.ruleId ? 'Save Rule' : 'Create Rule'}
          onPress={handleSave}
          disabled={submitting}
        />
      </View>
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  actionTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  helperText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
  previewSection: {
    gap: 10,
  },
  previewCard: {
    gap: 6,
    backgroundColor: BG_SURFACES.low,
  },
  previewTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  previewMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_DANGER,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
});
