import { useEffect, useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  AmountDisplay,
  BG_CARD_RADIUS,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TRANSFER,
  GlassCard,
  createRecurringTemplate,
  createTransaction,
  createTransactionSplits,
  getEnvelopeSuggestion,
  getPayeeSuggestions,
  listAccounts,
  listEnvelopes,
  receiptToBudgetRule,
  updatePayeeCache,
  type Account,
  type Envelope,
  type PayeeCache,
  type ReceiptToBudgetPreviewState,
  type RecurringFrequency,
} from '@mylife/budget';
import { logAutomationEvent } from '@mylife/automations';
import {
  BudgetButton,
  BudgetHeadline,
  BudgetInput,
  BudgetScreen,
  BudgetSectionLabel,
  formatBudgetCurrency,
  parseBudgetCurrencyInput,
} from '../../../components/budget/BudgetPhase2Primitives';
import { useDatabase } from '../../../components/DatabaseProvider';
import { AutomationPreviewSheet } from '../../../components/automations/AutomationPreviewSheet';
import { readRuleEnabled } from '../../../lib/automation-settings';
import { uuid } from '../../../lib/uuid';

type TransactionDirection = 'inflow' | 'outflow' | 'transfer';

type SplitDraft = {
  id: string;
  envelopeId: string;
  amount: string;
};

const DIRECTIONS: TransactionDirection[] = ['outflow', 'inflow', 'transfer'];
const RECURRING_OPTIONS: RecurringFrequency[] = ['weekly', 'biweekly', 'monthly', 'annually'];

function todayIsoDate(): string {
  return new Date().toISOString().slice(0, 10);
}

function amountTone(direction: TransactionDirection): 'income' | 'expense' | 'transfer' {
  if (direction === 'inflow') {
    return 'income';
  }
  if (direction === 'transfer') {
    return 'transfer';
  }
  return 'expense';
}

function directionColor(direction: TransactionDirection): string {
  if (direction === 'inflow') {
    return BG_MONEY;
  }
  if (direction === 'transfer') {
    return BG_TRANSFER;
  }
  return BG_DANGER;
}

export default function BudgetCreateTransactionScreen() {
  const router = useRouter();
  const db = useDatabase();
  const params = useLocalSearchParams<{
    accountId?: string;
    amount?: string;
    date?: string;
    direction?: string;
    envelopeId?: string;
    merchant?: string;
    note?: string;
  }>();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [payeeSuggestions, setPayeeSuggestions] = useState<PayeeCache[]>([]);
  const [amount, setAmount] = useState(params.amount ?? '');
  const [direction, setDirection] = useState<TransactionDirection>(
    params.direction === 'inflow' || params.direction === 'transfer'
      ? params.direction
      : 'outflow',
  );
  const [occurredOn, setOccurredOn] = useState(params.date ?? todayIsoDate());
  const [merchant, setMerchant] = useState(params.merchant ?? '');
  const [note, setNote] = useState(params.note ?? '');
  const [accountId, setAccountId] = useState(params.accountId ?? '');
  const [envelopeId, setEnvelopeId] = useState(params.envelopeId ?? '');
  const [saveAsRecurring, setSaveAsRecurring] = useState(false);
  const [recurringFrequency, setRecurringFrequency] = useState<RecurringFrequency>('monthly');
  const [splitRows, setSplitRows] = useState<SplitDraft[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [photoUri, setPhotoUri] = useState<string | null>(null);
  const [photoMime, setPhotoMime] = useState<string | null>(null);
  const [previewState, setPreviewState] =
    useState<ReceiptToBudgetPreviewState | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  useEffect(() => {
    try {
      const accountRows = listAccounts(db, false);
      const envelopeRows = listEnvelopes(db, false);
      setAccounts(accountRows);
      setEnvelopes(envelopeRows);
      if (!accountId && accountRows[0]) {
        setAccountId(
          params.accountId && accountRows.some((account) => account.id === params.accountId)
            ? params.accountId
            : accountRows[0].id,
        );
      }
      if (!envelopeId && envelopeRows[0]) {
        setEnvelopeId(
          params.envelopeId &&
            envelopeRows.some((envelope) => envelope.id === params.envelopeId)
            ? params.envelopeId
            : envelopeRows[0].id,
        );
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Failed to load form options.');
    }
  }, [accountId, db, envelopeId, params.accountId, params.envelopeId]);

  useEffect(() => {
    if (!merchant.trim()) {
      setPayeeSuggestions([]);
      return;
    }

    try {
      setPayeeSuggestions(getPayeeSuggestions(db, merchant.trim(), 5));
      const suggestedEnvelopeId = getEnvelopeSuggestion(db, merchant.trim());
      if (suggestedEnvelopeId && direction !== 'transfer') {
        setEnvelopeId((current) => current || suggestedEnvelopeId);
      }
    } catch {
      setPayeeSuggestions([]);
    }
  }, [db, direction, merchant]);

  const amountCents = useMemo(() => parseBudgetCurrencyInput(amount) ?? 0, [amount]);
  const splitsEnabled = splitRows.length > 0;

  const addSplit = () => {
    const defaultEnvelopeId = envelopeId || envelopes[0]?.id || '';
    setSplitRows((current) => [
      ...current,
      {
        id: uuid(),
        envelopeId: defaultEnvelopeId,
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

  const handleAttachPhoto = async () => {
    try {
      const mediaPermission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        Alert.alert(
          'Photo access needed',
          'Allow library access to attach a receipt photo.',
        );
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (result.canceled || !result.assets[0]?.uri) {
        return;
      }
      const asset = result.assets[0];
      setPhotoUri(asset.uri);
      setPhotoMime(asset.mimeType ?? 'image/jpeg');
    } catch (pickErr) {
      setError(
        pickErr instanceof Error
          ? pickErr.message
          : 'Could not open the photo library.',
      );
    }
  };

  const handleRemovePhoto = () => {
    setPhotoUri(null);
    setPhotoMime(null);
  };

  /**
   * Legacy save path — runs verbatim when no receipt automation is engaged
   * (rule disabled, no photo attached, or user dismissed the preview sheet).
   * Never touches hub_attachments so behavior exactly matches pre-Phase 5.
   */
  const runLegacySave = (parsedAmount: number, validatedSplits: Array<SplitDraft & { amountCents: number }>) => {
    try {
      const transactionId = uuid();
      createTransaction(db, transactionId, {
        amount: parsedAmount,
        direction,
        occurred_on: occurredOn.trim(),
        merchant: merchant.trim() || null,
        note: note.trim() || null,
        account_id: accountId || null,
        envelope_id: splitsEnabled || direction === 'transfer' ? null : envelopeId || null,
      });

      if (splitsEnabled) {
        createTransactionSplits(
          db,
          validatedSplits.map((row) => ({
            id: uuid(),
            transaction_id: transactionId,
            envelope_id: row.envelopeId,
            amount: row.amountCents,
            memo: null,
          })),
        );
      }

      if (merchant.trim()) {
        updatePayeeCache(db, merchant.trim(), direction === 'outflow' ? envelopeId || null : null);
      }

      if (saveAsRecurring && accountId && merchant.trim()) {
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
      setError(saveError instanceof Error ? saveError.message : 'Failed to create transaction.');
      setSubmitting(false);
    }
  };

  const handleApplyAutomation = () => {
    if (!previewState) return;
    setPreviewVisible(false);
    try {
      receiptToBudgetRule.apply(db, previewState);
      setPreviewState(null);
      router.replace(
        `/(budget)/(tabs)/transactions?refresh=${Date.now()}` as never,
      );
    } catch (applyErr) {
      setError(
        applyErr instanceof Error
          ? applyErr.message
          : 'Failed to apply the receipt automation.',
      );
      setSubmitting(false);
    }
  };

  const handleDismissAutomation = () => {
    setPreviewVisible(false);
    try {
      logAutomationEvent(db, {
        ruleId: receiptToBudgetRule.id,
        outcome: 'dismissed',
      });
    } catch (logErr) {
      console.warn(
        '[MyLife] failed to log receipt-to-budget dismiss:',
        logErr,
      );
    }
    // Fall through to the pre-automation save path so the user never loses
    // their in-progress transaction after declining the shortcut.
    const parsedAmount = parseBudgetCurrencyInput(amount) ?? 0;
    const validatedSplits = splitRows.map((row) => ({
      ...row,
      amountCents: parseBudgetCurrencyInput(row.amount) ?? 0,
    }));
    setPreviewState(null);
    runLegacySave(parsedAmount, validatedSplits);
  };

  const handleSave = () => {
    if (submitting) {
      return;
    }

    const parsedAmount = parseBudgetCurrencyInput(amount);
    if (parsedAmount === null || parsedAmount <= 0) {
      setError('Enter a valid transaction amount.');
      return;
    }
    if (!occurredOn.trim()) {
      setError('A transaction date is required.');
      return;
    }
    if (!accountId && direction !== 'transfer') {
      setError('Choose an account for this transaction.');
      return;
    }
    if (direction === 'outflow' && !splitsEnabled && !envelopeId) {
      setError('Choose an envelope or split this transaction.');
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
        setError('Split amounts must add up to the transaction total.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    // Automation hook: if the receipt rule is enabled and a photo is
    // attached, show the preview sheet BEFORE any write. Dismiss falls
    // through to runLegacySave; Apply uses receiptToBudgetRule.apply which
    // writes bg_transactions + hub_attachments + link atomically.
    const automationEnabled =
      photoUri && photoMime && readRuleEnabled(db, receiptToBudgetRule.id);
    if (automationEnabled && photoUri && photoMime) {
      const candidate = receiptToBudgetRule.check(db, {
        photoUri,
        photoMime,
        transactionDraft: {
          amount: parsedAmount,
          direction,
          occurred_on: occurredOn.trim(),
          merchant: merchant.trim() || null,
          note: note.trim() || null,
          account_id: accountId || null,
          envelope_id:
            splitsEnabled || direction === 'transfer'
              ? null
              : envelopeId || null,
        },
      });
      if (candidate) {
        setPreviewState(candidate);
        setPreviewVisible(true);
        return; // Sheet drives the next step via Apply / Dismiss.
      }
    }

    runLegacySave(parsedAmount, validatedSplits);
  };

  return (
    <BudgetScreen>
      <BudgetHeadline
        title="New Transaction"
        subtitle={params.merchant ? 'Receipt details were prefilled from scan review.' : 'Capture spending, income, or transfers.'}
      />

      <GlassCard style={styles.heroCard}>
        <BudgetSectionLabel>Amount</BudgetSectionLabel>
        <BudgetInput
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          keyboardType="decimal-pad"
        />
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
        <BudgetHeadline title="Schedule" subtitle="Date and recurring options" />
        <BudgetInput
          value={occurredOn}
          onChangeText={setOccurredOn}
          placeholder="YYYY-MM-DD"
          autoCapitalize="none"
        />
        <Pressable
          accessibilityRole="button"
          style={styles.toggleRow}
          onPress={() => setSaveAsRecurring((current) => !current)}
        >
          <View style={styles.toggleCopy}>
            <Text style={styles.toggleTitle}>Save as recurring template</Text>
            <Text style={styles.toggleDescription}>
              Keep a reusable pattern for bills, paychecks, and subscriptions.
            </Text>
          </View>
          <View style={[styles.togglePill, saveAsRecurring ? styles.togglePillOn : null]}>
            <Text style={styles.togglePillText}>{saveAsRecurring ? 'On' : 'Off'}</Text>
          </View>
        </Pressable>
        {saveAsRecurring ? (
          <View style={styles.frequencyRow}>
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

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Account" subtitle="Where this transaction happened" />
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
          <BudgetHeadline title="Envelope" subtitle="Assign the primary budget category" />
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
        <BudgetHeadline title="Payee" subtitle="Autocomplete learns from your previous transactions" />
        <BudgetInput
          value={merchant}
          onChangeText={setMerchant}
          placeholder="Coffee shop"
        />
        {payeeSuggestions.length > 0 ? (
          <View style={styles.suggestionRow}>
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
        <BudgetInput
          value={note}
          onChangeText={setNote}
          placeholder="Notes"
          multiline
        />
      </GlassCard>

      <GlassCard style={styles.card}>
        <BudgetHeadline title="Receipt" subtitle="Scan a receipt to prefill merchant, total, and date." />
        <BudgetButton
          tone="secondary"
          icon="receipt_long"
          label="Open Receipt Scan"
          onPress={() => router.push('/(budget)/receipt-scan' as never)}
        />
        <BudgetButton
          tone="secondary"
          icon="attach_file"
          label={photoUri ? 'Replace attached photo' : 'Attach receipt photo'}
          onPress={() => {
            void handleAttachPhoto();
          }}
        />
        {photoUri ? (
          <View style={styles.photoRow}>
            <Text style={styles.photoLabel} numberOfLines={1}>
              {photoUri.split('/').pop() ?? 'Photo attached'}
            </Text>
            <BudgetButton tone="danger" label="Remove" onPress={handleRemovePhoto} />
          </View>
        ) : null}
      </GlassCard>

      {direction !== 'transfer' ? (
        <GlassCard style={styles.card}>
          <BudgetHeadline
            title="Split transaction"
            subtitle={
              splitsEnabled
                ? `${splitRows.length} split row${splitRows.length === 1 ? '' : 's'}`
                : 'Optional: break this transaction into multiple envelope amounts'
            }
          />
          {!splitsEnabled ? (
            <BudgetButton
              tone="secondary"
              icon="call_split"
              label="Split this transaction"
              onPress={addSplit}
            />
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
            <BudgetButton tone="ghost" icon="add" label="Add Another Split" onPress={addSplit} />
          ) : null}
        </GlassCard>
      ) : null}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <View style={styles.actions}>
        <BudgetButton tone="ghost" label="Cancel" onPress={() => router.back()} />
        <BudgetButton
          label={submitting ? 'Saving…' : `Save ${formatBudgetCurrency(amountCents || 0)}`}
          onPress={handleSave}
          disabled={submitting}
        />
      </View>

      <Text style={[styles.helperText, { color: directionColor(direction) }]}>
        {direction === 'transfer'
          ? 'Transfers stay uncategorized and skip envelope assignment.'
          : 'Outflows can be assigned to a single envelope or split into multiple parts.'}
      </Text>

      <AutomationPreviewSheet
        rule={previewState ? receiptToBudgetRule : null}
        previewState={previewState}
        visible={previewVisible}
        onApply={handleApplyAutomation}
        onDismiss={handleDismissAutomation}
      />
    </BudgetScreen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    gap: 14,
  },
  card: {
    gap: 14,
  },
  directionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: BG_CARD_RADIUS,
    backgroundColor: BG_SURFACES.low,
    paddingHorizontal: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  toggleCopy: {
    flex: 1,
    gap: 4,
  },
  toggleTitle: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
    color: BG_TEXT,
  },
  toggleDescription: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
  togglePill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: BG_SURFACES.high,
  },
  togglePillOn: {
    backgroundColor: `${BG_MONEY}22`,
  },
  togglePillText: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
    color: BG_TEXT,
  },
  frequencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  choiceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  suggestionRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  splitCard: {
    gap: 12,
    backgroundColor: BG_SURFACES.low,
  },
  splitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  splitTitle: {
    fontFamily: BG_FONTS.bold,
    fontSize: 15,
    lineHeight: 20,
    color: BG_TEXT,
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
  helperText: {
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
  },
  photoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'space-between',
  },
  photoLabel: {
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 17,
    color: BG_TEXT_SECONDARY,
  },
});
