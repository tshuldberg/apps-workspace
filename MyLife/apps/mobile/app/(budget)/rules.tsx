import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Switch, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import {
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  GlassCard,
  applyRules,
  deleteTransactionRule,
  getCategorizationAccuracy,
  getEnabledTransactionRules,
  getTransactionRules,
  listEnvelopes,
  listTransactions,
  updateTransactionRule,
  type BudgetTransaction,
  type Envelope,
  type TransactionRule,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetScreen,
  BudgetSectionLabel,
} from '../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../components/DatabaseProvider';

type PreviewRow = {
  transaction: BudgetTransaction;
  envelopeName: string | null;
  ruleName: string | null;
};

function buildEngineRules(rules: TransactionRule[]) {
  return rules.map((rule) => ({
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
}

export default function RulesScreen() {
  const db = useDatabase();
  const router = useRouter();

  const [rules, setRules] = useState<TransactionRule[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [previewRows, setPreviewRows] = useState<PreviewRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [accuracy, setAccuracy] = useState(0);

  const load = useCallback(() => {
    setError(null);
    try {
      setRules(getTransactionRules(db));
      setEnvelopes(listEnvelopes(db, false));
      setAccuracy(getCategorizationAccuracy(db).accuracy);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load rules.');
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load]);

  const envelopeMap = useMemo(
    () => new Map(envelopes.map((envelope) => [envelope.id, envelope.name])),
    [envelopes],
  );

  const handleToggle = (rule: TransactionRule, enabled: boolean) => {
    try {
      updateTransactionRule(db, rule.id, { is_enabled: enabled ? 1 : 0 });
      load();
    } catch (toggleError) {
      setError(toggleError instanceof Error ? toggleError.message : 'Failed to update rule.');
    }
  };

  const handleDelete = (rule: TransactionRule) => {
    Alert.alert('Delete Rule', `Delete the rule for "${rule.payee_pattern}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteTransactionRule(db, rule.id);
            load();
          } catch (deleteError) {
            setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete rule.');
          }
        },
      },
    ]);
  };

  const runPreview = () => {
    try {
      const engineRules = buildEngineRules(getEnabledTransactionRules(db));
      const rows = listTransactions(db, { limit: 24 })
        .filter((transaction) => !transaction.envelope_id)
        .map((transaction) => {
          const result = applyRules(engineRules, {
            payee: transaction.merchant ?? '',
            amount: transaction.amount,
            accountId: transaction.account_id ?? '',
            memo: transaction.note ?? '',
          });

          return {
            transaction,
            envelopeName: result.envelopeId ? envelopeMap.get(result.envelopeId) ?? result.envelopeId : null,
            ruleName: result.matches[0]?.ruleName ?? null,
          };
        });

      setPreviewRows(rows);
    } catch (previewError) {
      setError(previewError instanceof Error ? previewError.message : 'Failed to test rules.');
    }
  };

  return (
    <BudgetScreen>
      <GlassCard style={styles.heroCard}>
        <BudgetHeadline
          title="Rules"
          subtitle={`${rules.length} saved automation rule${rules.length === 1 ? '' : 's'}`}
        />
        <View style={styles.heroMetaRow}>
          <Text style={styles.heroMeta}>Accuracy {accuracy}%</Text>
          <Text style={styles.heroMeta}>
            {rules.filter((rule) => rule.is_enabled === 1).length} enabled
          </Text>
        </View>
        <View style={styles.heroActions}>
          <BudgetButton label="New Rule" onPress={() => router.push('/(budget)/rules/create' as never)} />
          <BudgetButton tone="secondary" label="Test Rules" onPress={runPreview} />
        </View>
      </GlassCard>

      <BudgetSectionLabel>Saved automations</BudgetSectionLabel>
      {rules.length === 0 ? (
        <GlassCard style={styles.emptyCard}>
          <Text style={styles.emptyTitle}>No rules yet</Text>
          <Text style={styles.emptyCopy}>
            Create a payee-based automation rule to keep repetitive transactions categorized.
          </Text>
        </GlassCard>
      ) : (
        rules.map((rule) => (
          <GlassCard key={rule.id} style={styles.ruleCard}>
            <View style={styles.ruleHeader}>
              <View style={styles.ruleCopy}>
                <Text style={styles.ruleTitle}>
                  If payee {rule.match_type.replace('_', ' ')} "{rule.payee_pattern}"
                </Text>
                <Text style={styles.ruleSubtitle}>
                  Set envelope to {envelopeMap.get(rule.envelope_id) ?? rule.envelope_id}
                </Text>
              </View>
              <Switch
                value={rule.is_enabled === 1}
                onValueChange={(value) => handleToggle(rule, value)}
                trackColor={{ true: BG_MONEY, false: BG_SURFACES.high }}
                thumbColor={BG_TEXT}
              />
            </View>

            <View style={styles.ruleFooter}>
              <Text style={styles.ruleFooterCopy}>Priority {rule.priority}</Text>
              <View style={styles.ruleButtons}>
                <BudgetButton
                  tone="secondary"
                  label="Edit"
                  onPress={() =>
                    router.push(
                      (`/(budget)/rules/create?ruleId=${rule.id}&payee=${encodeURIComponent(rule.payee_pattern)}&matchType=${rule.match_type}&envelopeId=${rule.envelope_id}&priority=${rule.priority}`) as never,
                    )
                  }
                />
                <BudgetButton tone="danger" label="Delete" onPress={() => handleDelete(rule)} />
              </View>
            </View>
          </GlassCard>
        ))
      )}

      {previewRows.length > 0 ? (
        <View style={styles.previewSection}>
          <BudgetSectionLabel>Dry run preview</BudgetSectionLabel>
          {previewRows.map((row) => (
            <GlassCard key={row.transaction.id} style={styles.previewCard}>
              <Text style={styles.previewTitle}>{row.transaction.merchant ?? 'Transaction'}</Text>
              <Text style={styles.previewSubtitle}>
                {row.ruleName
                  ? `${row.ruleName} → ${row.envelopeName ?? 'No envelope'}`
                  : 'No matching rule'}
              </Text>
            </GlassCard>
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  heroMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: BG_TEXT,
  },
  emptyCopy: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 19,
    color: BG_TEXT_SECONDARY,
  },
  ruleCard: {
    gap: 14,
  },
  ruleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  ruleCopy: {
    flex: 1,
    gap: 4,
  },
  ruleTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  ruleSubtitle: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
  ruleFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
  },
  ruleFooterCopy: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_TERTIARY,
  },
  ruleButtons: {
    flexDirection: 'row',
    gap: 10,
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
  previewSubtitle: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_ACCENT_LIGHT,
  },
  errorText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
    color: BG_DANGER,
  },
});
