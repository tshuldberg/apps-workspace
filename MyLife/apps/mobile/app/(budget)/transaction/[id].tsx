import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AmountDisplay,
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
  applyRules,
  createRecurringTemplate,
  deleteSplitsByTransaction,
  deleteTransaction,
  getActiveTemplates,
  getEnabledTransactionRules,
  getPayeeSuggestions,
  getReceiptsByTransaction,
  getSplitsByTransaction,
  getTransaction,
  listAccounts,
  listEnvelopes,
  listTransactions,
  replaceSplits,
  updatePayeeCache,
  updateTransaction,
  type Account,
  type BudgetTransaction,
  type Envelope,
  type PayeeCache,
  type RecurringFrequency,
  type Receipt,
  type TransactionRule,
} from '@mylife/budget';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetInput,
  BudgetScreen,
  BudgetSectionLabel,
  formatBudgetCurrency,
  merchantInitials,
  parseBudgetCurrencyInput,
} from '../../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type TransactionDirection = 'inflow' | 'outflow' | 'transfer';

type SplitDraft = {
  id: string;
  envelopeId: string;
  amount: string;
};

const DIRECTIONS: TransactionDirection[] = ['outflow', 'inflow', 'transfer'];
const RECURRING_OPTIONS: RecurringFrequency[] = ['weekly', 'biweekly', 'monthly', 'annually'];

function amountTone(direction: TransactionDirection): 'income' | 'expense' | 'transfer' {
  if (direction === 'inflow') {
    return 'income';
  }
  if (direction === 'transfer') {
    return 'transfer';
  }
  return 'expense';
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

export default function BudgetTransactionScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const transactionId = Array.isArray(id) ? id[0] : id;

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [payeeSuggestions, setPayeeSuggestions] = useState<PayeeCache[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [relatedTransactions, setRelatedTransactions] = useState<BudgetTransaction[]>([]);
  const [matchedRuleName, setMatchedRuleName] = useState<string | null>(null);
  const [existingRecurring, setExistingRecurring] = useState<string | null>(null);

  const [amount, setAmount] = useState('');
  const [direction, setDirection] = useState<TransactionDirection>('outflow');
  const [occurredOn, setOccurredOn] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [accountId, setAccountId] = useState('');
  const [envelopeId, setEnvelopeId] = useState('');
  const [splitRows, setSplitRows] = useState<SplitDraft[]>([]);
  const [saveAsRecurring, setSaveAsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!transactionId) {
      setError('Transaction not found.');
      setLoading(false);
      return;
    }

    setError(null);
    try {
      const transaction = getTransaction(db, transactionId);
      if (!transaction) {
        setError('Transaction not found.');
        setLoading(false);
        return;
      }

      const accountRows = listAccounts(db, false);
      const envelopeRows = listEnvelopes(db, false);
      const splitRowsFromDb = getSplitsByTransaction(db, transactionId);
      const allTransactions = listTransactions(db, { limit: 100 });
      const enabledRules = getEnabledTransactionRules(db);
      const rulePreview = buildRulePreview(transaction, enabledRules);
      const templates = getActiveTemplates(db);
      const templateMatch =
        templates.find(
          (template) =>
            template.payee === (transaction.merchant ?? '') &&
            template.amount === transaction.amount &&
            template.account_id === (transaction.account_id ?? ''),
        ) ?? null;

      setAccounts(accountRows);
      setEnvelopes(envelopeRows);
      setAmount((transaction.amount / 100).toFixed(2));
      setDirection(transaction.direction);
      setOccurredOn(transaction.occurred_on);
      setMerchant(transaction.merchant ?? '');
      setNote(transaction.note ?? '');
      setAccountId(transaction.account_id ?? accountRows[0]?.id ?? '');
      setEnvelopeId(transaction.envelope_id ?? envelopeRows[0]?.id ?? '');
      setSplitRows(
        splitRowsFromDb.map((row) => ({
          id: row.id,
          envelopeId: row.envelope_id ?? '',
          amount: (row.amount / 100).toFixed(2),
        })),
      );
      setReceipts(getReceiptsByTransaction(db, transactionId));
      setRelatedTransactions(
        allTransactions
          .filter(
            (item) =>
              item.id !== transaction.id &&
              item.merchant &&
              transaction.merchant &&
              item.merchant === transaction.merchant,
          )
          .slice(0, 4),
      );
      setMatchedRuleName(rulePreview.matches[0]?.ruleName ?? null);
      setExistingRecurring(templateMatch ? templateMatch.id : null);
      setSaveAsRecurring(Boolean(templateMatch));
      setRecurringFrequency(templateMatch?.frequency ?? 'monthly');
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load transaction.');
    } finally {
      setLoading(false);
    }
  }, [db, transactionId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!merchant.trim()) {
      setPayeeSuggestions([]);
      return;
    }
    try {
      setPayeeSuggestions(getPayeeSuggestions(db, merchant.trim(), 5));
    } catch {
      setPayeeSuggestions([]);
    }
  }, [db, merchant]);

  const amountCents = useMemo(() => parseBudgetCurrencyInput(amount) ?? 0, [amount]);
  const splitsEnabled = splitRows.length > 0;

  const addSplit = () => {
    setSplitRows((current) => [
      ...current,
      {
        id: uuid(),
        envelopeId: envelopeId || envelopes[0]?.id || '',
        amount: current.length === 0 && amountCents > 0 ? (amountCents / 100).toFixed(2) : '',
      },
    ]);
  };

  const updateSplit = (id: string, patch: Partial<SplitDraft>) => {
    setSplitRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  };

  const removeSplit = (id: string) => {
    setSplitRows((current) => current.filter((row) => row.id !== id));
  };

  const handleSave = () => {
    if (!transactionId || submitting) {
      return;
    }

    const parsedAmount = parseBudgetCurrencyInput(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      setError('Enter a valid amount.');
      return;
    }
    if (!occurredOn.trim()) {
      setError('A date is required.');
      return;
    }

    const validatedSplits = splitRows.map((row) => ({
      ...row,
      amountCents: parseBudgetCurrencyInput(row.amount) ?? 0,
    }));

    if (splitsEnabled) {
      if (validatedSplits.some((row) => !row.envelopeId || row.amountCents <= 0)) {
        setError('Every split needs an envelope and amount.');
        return;
      }
      const totalSplit = validatedSplits.reduce((sum, row) => sum + row.amountCents, 0);
      if (totalSplit !== parsedAmount) {
        setError('Split totals must match the transaction amount.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      updateTransaction(db, transactionId, {
        amount: parsedAmount,
        direction,
        occurred_on: occurredOn.trim(),
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        account_id: accountId || null,
        envelope_id: splitsEnabled || direction === 'transfer' ? null : envelopeId || null,
      });

      if (splitsEnabled) {
        replaceSplits(
          db,
          transactionId,
          validatedSplits.map((row) => ({
            id: row.id.startsWith('txn-') ? uuid() : row.id,
            transaction_id: transactionId,
            envelope_id: row.envelopeId,
            amount: row.amountCents,
            memo: null,
          })),
        );
      } else {
        deleteSplitsByTransaction(db, transactionId);
      }

      if (merchant.trim()) {
        updatePayeeCache(db, merchant.trim(), direction === 'outflow' ? envelopeId || null : null);
      }

      if (saveAsRecurring && accountId && merchant.trim() && !existingRecurring) {
        createRecurringTemplate(db, uuid(), {
          account_id: accountId,
          envelope_id: direction === 'outflow' && !splitsEnabled ? envelopeId || null : null,
          payee: merchant.trim(),
          amount: parsedAmount,
          frequency: recurringFrequency,
          start_date: occurredOn.trim(),
          next_date: occurredOn.trim(),
        });
      }

      router.replace(`/(budget)/(tabs)/transactions?refresh=${Date.now()}` as never);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save transaction.');
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!transactionId || submitting) {
      return;
    }

    Alert.alert('Delete Transaction', 'Delete this transaction permanently?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          try {
            deleteTransaction(db, transactionId);
            router.replace(`/(budget)/(tabs)/transactions?refresh=${Date.now()}` as never);
          } catch (deleteError) {
            setError(
              deleteError instanceof Error
                ? deleteError.message
                : 'Failed to delete transaction.',
            );
          }
        },
      },
    ]);
  };

  if (loading) {
    return <BudgetScreen />;
  }

  if (!transactionId) {
    return (
      <BudgetScreen>
        <Text style={styles.errorText}>{error ?? 'Transaction not found.'}</Text>
      </BudgetScreen>
    );
  }

  return (
    <BudgetScreen>
      <GlassCard style={styles.heroCard}>
        <View style={styles.heroRow}>
          <View style={styles.avatarCircle}>
            <Text style={styles.avatarLabel}>{merchantInitials(merchant || 'Transaction')}</Text>
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>{merchant || 'Transaction'}</Text>
            <Text style={styles.heroMeta}>{occurredOn}</Text>
          </View>
          <View style={styles.heroActions}>
            <BudgetButton tone="ghost" label="Save" onPress={handleSave} />
            <BudgetButton tone="danger" label="Delete" onPress={handleDelete} />
          </View>
        </View>
        <AmountDisplay cents={amountCents} size="xl" type={amountTone(direction)} />
        <View style={styles.directionRow}>
          {DIRECTIONS.map((entry) => (
            <BudgetButton
              key={entry}
              label={entry[0].toUpperCase() + entry.slice(1)}
              tone={direction === entry ? 'primary' : 'secondary'}
              onPress={() => setDirection(entry)}
            />
          ))}
        </View>
      </GlassCard>

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Details" subtitle="Payee, date, account, and notes" />
        <BudgetInput value={amount} onChangeText={setAmount} placeholder="0.00" keyboardType="decimal-pad" />
        <BudgetInput value={occurredOn} onChangeText={setOccurredOn} placeholder="YYYY-MM-DD" />
        <BudgetInput value={merchant} onChangeText={setMerchant} placeholder="Merchant" />
        {payeeSuggestions.length > 0 ? (
          <View style={styles.choiceGrid}>
            {payeeSuggestions.map((suggestion) => (
              <BudgetButton
                key={suggestion.payee}
                label={suggestion.payee}
                tone="secondary"
                onPress={() => setMerchant(suggestion.payee)}
              />
            ))}
          </View>
        ) : null}
        <BudgetInput value={note} onChangeText={setNote} placeholder="Notes" multiline />
      </GlassCard>

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Account" subtitle="Editable account assignment" />
        <View style={styles.choiceGrid}>
          {accounts.map((account) => (
            <BudgetButton
              key={account.id}
              label={account.name}
              tone={accountId === account.id ? 'primary' : 'secondary'}
              onPress={() => setAccountId(account.id)}
            />
          ))}
        </View>
      </GlassCard>

      {direction !== 'transfer' ? (
        <GlassCard style={styles.card}>
          <BudgetHeadline title="Envelope" subtitle="Category assignment or split override" />
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
        </GlassCard>
      ) : null}

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Receipts" subtitle="Linked receipt captures and scan shortcut" />
        {receipts.length === 0 ? (
          <Text style={styles.secondaryText}>No receipt is attached yet.</Text>
        ) : (
          receipts.map((receipt) => (
            <GlassCard key={receipt.id} style={styles.receiptCard}>
              <Text style={styles.receiptTitle}>{receipt.merchant_raw ?? 'Receipt capture'}</Text>
              <Text style={styles.secondaryText}>
                {receipt.date_raw ?? 'No date'} • {receipt.total_raw ?? 'No total'}
              </Text>
            </GlassCard>
          ))
        )}
        <BudgetButton
          tone="secondary"
          icon="receipt_long"
          label="Open Receipt Scan"
          onPress={() => router.push('/(budget)/receipt-scan' as never)}
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Split editor" subtitle="Break the amount into envelope parts when needed" />
        {!splitsEnabled ? (
          <BudgetButton tone="secondary" label="Split this transaction" icon="call_split" onPress={addSplit} />
        ) : null}
        {splitRows.map((row) => (
          <GlassCard key={row.id} style={styles.splitCard}>
            <View style={styles.splitHeader}>
              <Text style={styles.splitTitle}>Split Row</Text>
              <BudgetButton tone="danger" label="Remove" onPress={() => removeSplit(row.id)} />
            </View>
            <BudgetInput
              value={row.amount}
              onChangeText={(value) => updateSplit(row.id, { amount: value })}
              placeholder="0.00"
              keyboardType="decimal-pad"
            />
            <View style={styles.choiceGrid}>
              {envelopes.map((envelope) => (
                <BudgetButton
                  key={`${row.id}:${envelope.id}`}
                  label={envelope.name}
                  tone={row.envelopeId === envelope.id ? 'primary' : 'secondary'}
                  onPress={() => updateSplit(row.id, { envelopeId: envelope.id })}
                />
              ))}
            </View>
          </GlassCard>
        ))}
        {splitsEnabled ? (
          <BudgetButton tone="ghost" label="Add Split Row" icon="add" onPress={addSplit} />
        ) : null}
      </GlassCard>

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Automation" subtitle="Recurring and rules context" />
        <View style={styles.ruleRow}>
          <View style={styles.ruleMeta}>
            <Text style={styles.ruleTitle}>Matched rule</Text>
            <Text style={styles.secondaryText}>
              {matchedRuleName ? `If payee matches "${matchedRuleName}"` : 'No auto-rule match'}
            </Text>
          </View>
          <MaterialSymbol
            name={matchedRuleName ? 'bolt' : 'circle'}
            size={18}
            color={matchedRuleName ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
          />
        </View>
        <View style={styles.ruleRow}>
          <View style={styles.ruleMeta}>
            <Text style={styles.ruleTitle}>Recurring template</Text>
            <Text style={styles.secondaryText}>
              {existingRecurring ? 'This payee already has a saved recurring template.' : 'Create one from this edit if needed.'}
            </Text>
          </View>
          <BudgetButton
            tone={saveAsRecurring ? 'primary' : 'secondary'}
            label={saveAsRecurring ? 'Recurring On' : 'Recurring Off'}
            onPress={() => setSaveAsRecurring((current) => !current)}
          />
        </View>
        {saveAsRecurring ? (
          <View style={styles.choiceGrid}>
            {RECURRING_OPTIONS.map((option) => (
              <BudgetButton
                key={option}
                label={option.replace('_', ' ')}
                tone={recurringFrequency === option ? 'primary' : 'secondary'}
                onPress={() => setRecurringFrequency(option)}
              />
            ))}
          </View>
        ) : null}
      </GlassCard>

      {relatedTransactions.length > 0 ? (
        <View style={styles.relatedSection}>
          <BudgetSectionLabel>Related transactions</BudgetSectionLabel>
          {relatedTransactions.map((transaction) => (
            <TxRow
              key={transaction.id}
              tx={transaction}
              onPress={() => router.push(`/(budget)/transaction/${transaction.id}` as never)}
            />
          ))}
        </View>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
      <Text style={[styles.secondaryText, { color: direction === 'transfer' ? BG_TRANSFER : direction === 'inflow' ? BG_MONEY : BG_DANGER }]}>
        {direction === 'transfer'
          ? 'Transfers stay envelope-free and show up in cyan.'
          : `Current amount: ${formatBudgetCurrency(amountCents)}`}
      </Text>
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  heroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: `${BG_TRANSFER}20`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLabel: {
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TRANSFER,
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
    color: BG_TEXT,
  },
  heroMeta: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT_SECONDARY,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 8,
  },
  directionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    gap: 14,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  receiptCard: {
    gap: 6,
    backgroundColor: BG_SURFACES.low,
  },
  receiptTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  splitCard: {
    gap: 12,
    backgroundColor: BG_SURFACES.low,
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
    alignItems: 'center',
  },
  splitTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    alignItems: 'center',
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  ruleMeta: {
    flex: 1,
    gap: 4,
  },
  ruleTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  relatedSection: {
    gap: 10,
  },
  secondaryText: {
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
});
