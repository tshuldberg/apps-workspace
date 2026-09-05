import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_ACCOUNT_TYPES,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  BG_TRANSFER,
  BG_TYPOGRAPHY,
  AmountDisplay,
  GlassCard,
  MaterialSymbol,
  TxRow,
  createTransaction,
  createTransfer,
  deleteAccount,
  getAccount,
  getAccounts,
  getCurrencies,
  listTransactions,
  updateAccount,
  type Account,
  type AccountType,
  type BudgetTransaction,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';
import { BudgetLineChart } from '../../../components/budget/BudgetLineChart';
import {
  deleteBudgetAccountMeta,
  getBudgetAccountMeta,
  getLinkedBankSummary,
  setBudgetAccountMeta,
  syncBudgetNetWorthSnapshot,
  type BudgetAccountMeta,
} from '../../../lib/budget-phase4';
import { uuid } from '../../../lib/uuid';

const LIABILITY_TYPES = new Set<AccountType>(['credit', 'loan', 'mortgage']);

const ACCOUNT_TYPE_OPTIONS: Array<{ type: AccountType; label: string; icon: string }> = [
  { type: 'checking', label: 'Checking', icon: 'account_balance' },
  { type: 'savings', label: 'Savings', icon: 'savings' },
  { type: 'credit', label: 'Credit', icon: 'credit_card' },
  { type: 'investment', label: 'Investment', icon: 'trending_up' },
  { type: 'loan', label: 'Loan', icon: 'payments' },
  { type: 'mortgage', label: 'Mortgage', icon: 'home' },
  { type: 'cash', label: 'Cash', icon: 'local_atm' },
  { type: 'other', label: 'Other', icon: 'wallet' },
];

function parseCurrencyInput(value: string): number | null {
  const normalized = value.replace(/[^0-9.-]/g, '').trim();
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) {
    return null;
  }
  return Math.round(parsed * 100);
}

function normalizeLast4(value: string) {
  return value.replace(/\D/g, '').slice(-4);
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function startOfMonthISO() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function formatDisplayDate(date: string) {
  const parsed = new Date(`${date}T12:00:00`);
  return parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function formatRelativeSync(timestamp: string | null) {
  if (!timestamp) {
    return 'Local only';
  }

  const elapsedMinutes = Math.max(
    0,
    Math.round((Date.now() - new Date(timestamp).getTime()) / 60_000),
  );

  if (elapsedMinutes < 1) {
    return 'Synced just now';
  }
  if (elapsedMinutes < 60) {
    return `Synced ${elapsedMinutes}m ago`;
  }
  const elapsedHours = Math.round(elapsedMinutes / 60);
  if (elapsedHours < 24) {
    return `Synced ${elapsedHours}h ago`;
  }
  return `Synced ${Math.round(elapsedHours / 24)}d ago`;
}

function transactionSignedImpact(transaction: BudgetTransaction) {
  if (transaction.direction === 'inflow') {
    return transaction.amount;
  }
  if (transaction.direction === 'outflow') {
    return -Math.abs(transaction.amount);
  }
  return transaction.amount;
}

function buildBalanceHistory(account: Account, transactions: BudgetTransaction[]) {
  const recent = [...transactions]
    .sort((left, right) => right.occurred_on.localeCompare(left.occurred_on))
    .slice(0, 7);

  let runningBalance = account.current_balance;
  const points = [{ label: 'Now', value: runningBalance }];

  recent.forEach((transaction) => {
    runningBalance -= transactionSignedImpact(transaction);
    points.push({
      label: formatDisplayDate(transaction.occurred_on),
      value: runningBalance,
    });
  });

  return points.reverse();
}

function applyTransferToBalance(account: Account, role: 'from' | 'to', amount: number) {
  const isLiability = LIABILITY_TYPES.has(account.type);
  if (role === 'from') {
    return isLiability
      ? account.current_balance + amount
      : account.current_balance - amount;
  }

  return isLiability
    ? account.current_balance - amount
    : account.current_balance + amount;
}

export default function BudgetAccountDetailScreen() {
  const db = useDatabase();
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string | string[] }>();
  const accountId = Array.isArray(id) ? id[0] : id;

  const [account, setAccount] = useState<Account | null>(null);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [availableCurrencies, setAvailableCurrencies] = useState<string[]>(['USD']);
  const [meta, setMeta] = useState<BudgetAccountMeta>({
    includeInBudget: true,
    includeInNetWorth: true,
    source: 'manual',
  });
  const [linkedBank, setLinkedBank] = useState<ReturnType<typeof getLinkedBankSummary>>(null);

  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [balance, setBalance] = useState('0.00');
  const [currency, setCurrency] = useState('USD');
  const [institution, setInstitution] = useState('');
  const [last4, setLast4] = useState('');
  const [apr, setApr] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [reconcileVisible, setReconcileVisible] = useState(false);
  const [reconcileAmount, setReconcileAmount] = useState('');
  const [reconcileNote, setReconcileNote] = useState('');
  const [transferVisible, setTransferVisible] = useState(false);
  const [transferFromId, setTransferFromId] = useState('');
  const [transferToId, setTransferToId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');

  const load = useCallback(() => {
    if (!accountId) {
      setError('Account not found.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const nextAccount = getAccount(db, accountId);
      if (!nextAccount) {
        setError('Account not found.');
        setLoading(false);
        return;
      }

      const nextTransactions = listTransactions(db, {
        account_id: accountId,
        limit: 50,
      });
      const nextAccounts = getAccounts(db, true);
      const accountMeta = getBudgetAccountMeta(db, accountId);
      const nextCurrencies = getCurrencies(db).map((row) => row.code);
      const bankSummary = getLinkedBankSummary(db, accountId);

      setAccount(nextAccount);
      setTransactions(nextTransactions);
      setAllAccounts(nextAccounts);
      setAvailableCurrencies(Array.from(new Set(['USD', ...nextCurrencies])));
      setMeta(accountMeta);
      setLinkedBank(bankSummary);

      setName(nextAccount.name);
      setType(nextAccount.type);
      setBalance((nextAccount.current_balance / 100).toFixed(2));
      setCurrency(nextAccount.currency);
      setInstitution(
        bankSummary?.institutionName ??
          accountMeta.institution ??
          '',
      );
      setLast4(bankSummary?.mask ?? accountMeta.last4 ?? '');
      setApr(
        accountMeta.aprPercent == null ? '' : String(accountMeta.aprPercent),
      );
      setTransferFromId(accountId);
      if (nextAccounts.length > 1) {
        const fallback = nextAccounts.find((row) => row.id !== accountId);
        setTransferToId(fallback?.id ?? '');
      } else {
        setTransferToId('');
      }
      setReconcileAmount((nextAccount.current_balance / 100).toFixed(2));
    } catch (loadError) {
      setError(
        loadError instanceof Error ? loadError.message : 'Failed to load account.',
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, db]);

  useEffect(() => {
    load();
  }, [load]);

  const isLiability = account ? LIABILITY_TYPES.has(account.type) : LIABILITY_TYPES.has(type);
  const balancePreview = useMemo(() => {
    const parsed = parseCurrencyInput(balance);
    if (parsed == null) {
      return 0;
    }
    return isLiability ? -Math.abs(parsed) : parsed;
  }, [balance, isLiability]);

  const monthSpending = useMemo(
    () =>
      transactions
        .filter(
          (transaction) =>
            transaction.direction === 'outflow' &&
            transaction.occurred_on >= startOfMonthISO(),
        )
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [transactions],
  );

  const balanceHistory = useMemo(
    () => (account ? buildBalanceHistory(account, transactions) : []),
    [account, transactions],
  );

  const transferCandidates = useMemo(
    () => allAccounts.filter((candidate) => candidate.id !== accountId && candidate.archived === 0),
    [accountId, allAccounts],
  );

  const reconcileDelta = useMemo(() => {
    if (!account) {
      return 0;
    }
    const parsed = parseCurrencyInput(reconcileAmount);
    if (parsed == null) {
      return 0;
    }
    return parsed - account.current_balance;
  }, [account, reconcileAmount]);

  function cycleTransferAccount(currentId: string, direction: 'forward' | 'backward') {
    if (transferCandidates.length === 0) {
      return '';
    }
    const currentIndex = transferCandidates.findIndex((candidate) => candidate.id === currentId);
    if (currentIndex === -1) {
      return transferCandidates[0]?.id ?? '';
    }
    const delta = direction === 'forward' ? 1 : -1;
    const nextIndex = (currentIndex + delta + transferCandidates.length) % transferCandidates.length;
    return transferCandidates[nextIndex]?.id ?? currentId;
  }

  function handleSave() {
    if (!accountId || !account) {
      return;
    }

    const trimmedName = name.trim();
    const parsedBalance = parseCurrencyInput(balance);
    const normalizedCurrency = currency.trim().toUpperCase();
    const normalizedApr = apr.trim();
    const nextApr =
      normalizedApr.length === 0 ? null : Number(normalizedApr);

    if (!trimmedName) {
      setError('Name is required.');
      return;
    }
    if (parsedBalance == null) {
      setError('Enter a valid balance.');
      return;
    }
    if (normalizedCurrency.length !== 3) {
      setError('Use a 3-letter currency code like USD.');
      return;
    }
    if (nextApr !== null && (!Number.isFinite(nextApr) || nextApr < 0)) {
      setError('APR must be a positive number.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      db.transaction(() => {
        updateAccount(db, accountId, {
          currency: normalizedCurrency,
          current_balance: parsedBalance,
          name: trimmedName,
          type,
        });

        setBudgetAccountMeta(db, accountId, {
          ...meta,
          aprPercent: nextApr,
          institution: institution.trim() || undefined,
          last4: normalizeLast4(last4) || undefined,
        });
      });

      syncBudgetNetWorthSnapshot(db);
      load();
    } catch (saveError) {
      setError(
        saveError instanceof Error ? saveError.message : 'Failed to save changes.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  function handleArchiveToggle() {
    if (!accountId || !account) {
      return;
    }

    try {
      updateAccount(db, accountId, {
        archived: account.archived === 1 ? 0 : 1,
      });
      syncBudgetNetWorthSnapshot(db);
      router.replace('/(budget)/accounts?refresh=1' as never);
    } catch (archiveError) {
      Alert.alert(
        'Archive failed',
        archiveError instanceof Error ? archiveError.message : 'Please try again.',
      );
    }
  }

  function handleDelete() {
    if (!accountId) {
      return;
    }

    Alert.alert(
      'Delete account',
      'Delete this account and keep the transaction history orphaned for audit purposes?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: () => {
            try {
              deleteAccount(db, accountId);
              deleteBudgetAccountMeta(db, accountId);
              syncBudgetNetWorthSnapshot(db);
              router.replace('/(budget)/accounts?refresh=1' as never);
            } catch (deleteError) {
              Alert.alert(
                'Delete failed',
                deleteError instanceof Error ? deleteError.message : 'Please try again.',
              );
            }
          },
        },
      ],
    );
  }

  function handleReconcile() {
    if (!account || !accountId) {
      return;
    }

    const actualBalance = parseCurrencyInput(reconcileAmount);
    if (actualBalance == null) {
      Alert.alert('Invalid balance', 'Enter the actual cleared balance.');
      return;
    }

    try {
      db.transaction(() => {
        const delta = actualBalance - account.current_balance;
        if (delta !== 0) {
          createTransaction(db, uuid(), {
            account_id: accountId,
            amount: Math.abs(delta),
            direction: delta > 0 ? 'inflow' : 'outflow',
            merchant: 'Reconciliation adjustment',
            note: reconcileNote.trim() || 'Adjusted from account detail.',
            occurred_on: todayISO(),
          });
        }

        updateAccount(db, accountId, {
          current_balance: actualBalance,
        });
      });

      syncBudgetNetWorthSnapshot(db);
      setReconcileVisible(false);
      setReconcileNote('');
      load();
    } catch (reconcileError) {
      Alert.alert(
        'Reconcile failed',
        reconcileError instanceof Error ? reconcileError.message : 'Please try again.',
      );
    }
  }

  function handleTransfer() {
    if (!account || !transferToId || !transferFromId) {
      return;
    }

    const amount = parseCurrencyInput(transferAmount);
    if (amount == null || amount <= 0) {
      Alert.alert('Invalid transfer', 'Enter a valid transfer amount.');
      return;
    }

    const fromAccount = allAccounts.find((candidate) => candidate.id === transferFromId);
    const toAccount = allAccounts.find((candidate) => candidate.id === transferToId);

    if (!fromAccount || !toAccount || fromAccount.id === toAccount.id) {
      Alert.alert('Choose accounts', 'Select two different accounts.');
      return;
    }

    try {
      db.transaction(() => {
        createTransfer(
          db,
          uuid(),
          uuid(),
          fromAccount.id,
          toAccount.id,
          amount,
          todayISO(),
          transferNote.trim() || undefined,
        );

        updateAccount(db, fromAccount.id, {
          current_balance: applyTransferToBalance(fromAccount, 'from', amount),
        });
        updateAccount(db, toAccount.id, {
          current_balance: applyTransferToBalance(toAccount, 'to', amount),
        });
      });

      syncBudgetNetWorthSnapshot(db);
      setTransferVisible(false);
      setTransferAmount('');
      setTransferNote('');
      load();
    } catch (transferError) {
      Alert.alert(
        'Transfer failed',
        transferError instanceof Error ? transferError.message : 'Please try again.',
      );
    }
  }

  if (loading) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.loadingText}>Loading account...</Text>
      </View>
    );
  }

  if (!account) {
    return (
      <View style={styles.loadingState}>
        <Text style={styles.errorText}>{error ?? 'Account not found.'}</Text>
      </View>
    );
  }

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        style={styles.screen}
      >
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Account detail</Text>
              <Text style={styles.heroTitle}>{account.name}</Text>
              <Text style={styles.heroMeta}>
                {linkedBank
                  ? `${linkedBank.institutionName ?? linkedBank.displayName} • ${formatRelativeSync(linkedBank.lastSuccessfulSync)}`
                  : institution.trim()
                    ? `${institution.trim()} • Manual account`
                    : 'Manual account'}
              </Text>
            </View>
            <Pressable
              onPress={() => setTransferVisible(true)}
              style={styles.heroAction}
            >
              <MaterialSymbol color={BG_TRANSFER} name="swap_horiz" size={18} />
              <Text style={styles.heroActionLabel}>Transfer</Text>
            </Pressable>
          </View>

          <AmountDisplay
            cents={balancePreview}
            currencyCode={currency.trim().toUpperCase() || account.currency}
            size="xl"
            type={balancePreview < 0 ? 'expense' : 'income'}
          />

          <View style={styles.chipRow}>
            <View style={[styles.infoChip, { backgroundColor: `${BG_ACCOUNT_TYPES[type]}22` }]}>
              <MaterialSymbol color={BG_ACCOUNT_TYPES[type]} name={ACCOUNT_TYPE_OPTIONS.find((option) => option.type === type)?.icon ?? 'wallet'} size={14} />
              <Text style={styles.infoChipLabel}>
                {ACCOUNT_TYPE_OPTIONS.find((option) => option.type === type)?.label ?? type}
              </Text>
            </View>
            {(linkedBank?.institutionName ?? institution.trim()).length > 0 ? (
              <View style={styles.infoChip}>
                <MaterialSymbol color={BG_ACCENT_LIGHT} name="account_balance" size={14} />
                <Text style={styles.infoChipLabel}>
                  {linkedBank?.institutionName ?? institution.trim()}
                </Text>
              </View>
            ) : null}
            {(linkedBank?.mask ?? last4).length > 0 ? (
              <View style={styles.infoChip}>
                <MaterialSymbol color={BG_TEXT_TERTIARY} name="credit_card" size={14} />
                <Text style={styles.infoChipLabel}>••{linkedBank?.mask ?? normalizeLast4(last4)}</Text>
              </View>
            ) : null}
          </View>
        </GlassCard>

        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>This month</Text>
            <AmountDisplay cents={monthSpending} size="lg" type="expense" />
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>{isLiability ? 'Outstanding' : 'Available'}</Text>
            <AmountDisplay
              cents={isLiability ? -Math.abs(account.current_balance) : account.current_balance}
              currencyCode={account.currency}
              size="lg"
              type={isLiability ? 'expense' : 'neutral'}
            />
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>APR</Text>
            <Text style={styles.statValue}>
              {isLiability
                ? meta.aprPercent != null
                  ? `${meta.aprPercent}%`
                  : 'Set later'
                : 'N/A'}
            </Text>
          </GlassCard>
        </View>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Balance history</Text>
              <Text style={styles.sectionSubtitle}>Rolling activity reconstructed from recent account transactions.</Text>
            </View>
            <Pressable onPress={() => setReconcileVisible(true)} style={styles.inlineAction}>
              <Text style={styles.inlineActionLabel}>Reconcile</Text>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="tune" size={16} />
            </Pressable>
          </View>
          <BudgetLineChart
            fillFromColor="rgba(255, 184, 119, 0.28)"
            fillToColor="rgba(255, 184, 119, 0.03)"
            formatValue={(value) =>
              new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: account.currency,
                maximumFractionDigits: 0,
              }).format(value / 100)
            }
            points={balanceHistory}
            strokeColor={BG_ACCENT_LIGHT}
          />
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionLabel}>Edit account</Text>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Name</Text>
            <TextInput
              onChangeText={setName}
              placeholder="Account name"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={name}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Current balance</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setBalance}
              placeholder="0.00"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={balance}
            />
          </View>

          <View style={styles.typeRow}>
            {ACCOUNT_TYPE_OPTIONS.map((option) => {
              const selected = option.type === type;
              return (
                <Pressable
                  key={option.type}
                  onPress={() => setType(option.type)}
                  style={[
                    styles.typeChip,
                    selected ? styles.typeChipSelected : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipLabel,
                      selected ? styles.typeChipLabelSelected : null,
                    ]}
                  >
                    {option.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Currency</Text>
            <View style={styles.currencyRow}>
              {availableCurrencies.slice(0, 6).map((code) => {
                const selected = currency.toUpperCase() === code;
                return (
                  <Pressable
                    key={code}
                    onPress={() => setCurrency(code)}
                    style={[
                      styles.currencyChip,
                      selected ? styles.currencyChipSelected : null,
                    ]}
                  >
                    <Text
                      style={[
                        styles.currencyChipLabel,
                        selected ? styles.currencyChipLabelSelected : null,
                      ]}
                    >
                      {code}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <TextInput
              autoCapitalize="characters"
              maxLength={3}
              onChangeText={setCurrency}
              placeholder="Custom code"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={styles.input}
              value={currency}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Institution</Text>
            <TextInput
              editable={!linkedBank}
              onChangeText={setInstitution}
              placeholder="Institution"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={[styles.input, linkedBank ? styles.inputLocked : null]}
              value={institution}
            />
          </View>

          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>Last 4 digits</Text>
            <TextInput
              editable={!linkedBank}
              keyboardType="number-pad"
              maxLength={4}
              onChangeText={setLast4}
              placeholder="1234"
              placeholderTextColor={BG_TEXT_TERTIARY}
              style={[styles.input, linkedBank ? styles.inputLocked : null]}
              value={last4}
            />
          </View>

          {isLiability ? (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>APR</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setApr}
                placeholder="18.9"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={apr}
              />
            </View>
          ) : null}

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <View style={styles.actionRow}>
            <Pressable
              onPress={handleSave}
              style={[styles.primaryAction, submitting ? styles.primaryActionDisabled : null]}
            >
              <Text style={styles.primaryActionLabel}>
                {submitting ? 'Saving...' : 'Save changes'}
              </Text>
            </Pressable>
            <Pressable onPress={() => setReconcileVisible(true)} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionLabel}>Reconcile</Text>
            </Pressable>
          </View>

          <View style={styles.actionRow}>
            <Pressable onPress={handleArchiveToggle} style={styles.secondaryAction}>
              <Text style={styles.secondaryActionLabel}>
                {account.archived === 1 ? 'Restore' : 'Archive'}
              </Text>
            </Pressable>
            <Pressable onPress={handleDelete} style={styles.destructiveAction}>
              <Text style={styles.destructiveActionLabel}>Delete</Text>
            </Pressable>
          </View>
        </GlassCard>

        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionLabel}>Recent transactions</Text>
              <Text style={styles.sectionSubtitle}>
                Filtered to activity already assigned to this account.
              </Text>
            </View>
            <Pressable
              onPress={() =>
                router.push(
                  `/(budget)/transaction/create?accountId=${account.id}` as never,
                )
              }
              style={styles.inlineAction}
            >
              <Text style={styles.inlineActionLabel}>Add</Text>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="add" size={16} />
            </Pressable>
          </View>

          {transactions.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateTitle}>No activity yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                Linked transactions, manual entries, and reconciliation adjustments appear here.
              </Text>
            </View>
          ) : (
            <View style={styles.transactionList}>
              {transactions.slice(0, 8).map((transaction) => (
                <TxRow
                  key={transaction.id}
                  onPress={() => router.push(`/(budget)/transaction/${transaction.id}` as never)}
                  tx={transaction}
                />
              ))}
            </View>
          )}
        </GlassCard>
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setReconcileVisible(false)}
        transparent
        visible={reconcileVisible}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Reconcile</Text>
            <Text style={styles.modalTitle}>Match the account to the cleared balance.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Actual balance</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setReconcileAmount}
                placeholder="0.00"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={reconcileAmount}
              />
            </View>

            <GlassCard style={styles.deltaCard}>
              <Text style={styles.deltaLabel}>Suggested adjustment</Text>
              <AmountDisplay
                cents={Math.abs(reconcileDelta)}
                currencyCode={account.currency}
                size="lg"
                type={reconcileDelta >= 0 ? 'income' : 'expense'}
                showSign
              />
            </GlassCard>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Memo</Text>
              <TextInput
                onChangeText={setReconcileNote}
                placeholder="Cleared against statement"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={reconcileNote}
              />
            </View>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setReconcileVisible(false)}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleReconcile} style={styles.primaryAction}>
                <Text style={styles.primaryActionLabel}>Apply</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>

      <Modal
        animationType="slide"
        onRequestClose={() => setTransferVisible(false)}
        transparent
        visible={transferVisible}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Quick transfer</Text>
            <Text style={styles.modalTitle}>Move funds between linked budget accounts.</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>From</Text>
              <View style={styles.selectorRow}>
                <Pressable
                  onPress={() => setTransferFromId(cycleTransferAccount(transferFromId, 'backward'))}
                  style={styles.selectorButton}
                >
                  <MaterialSymbol color={BG_TEXT} name="arrow_back" size={16} />
                </Pressable>
                <Text style={styles.selectorValue}>
                  {allAccounts.find((candidate) => candidate.id === transferFromId)?.name ?? 'Choose account'}
                </Text>
                <Pressable
                  onPress={() => setTransferFromId(cycleTransferAccount(transferFromId, 'forward'))}
                  style={styles.selectorButton}
                >
                  <MaterialSymbol color={BG_TEXT} name="arrow_forward" size={16} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>To</Text>
              <View style={styles.selectorRow}>
                <Pressable
                  onPress={() => setTransferToId(cycleTransferAccount(transferToId, 'backward'))}
                  style={styles.selectorButton}
                >
                  <MaterialSymbol color={BG_TEXT} name="arrow_back" size={16} />
                </Pressable>
                <Text style={styles.selectorValue}>
                  {allAccounts.find((candidate) => candidate.id === transferToId)?.name ?? 'Choose account'}
                </Text>
                <Pressable
                  onPress={() => setTransferToId(cycleTransferAccount(transferToId, 'forward'))}
                  style={styles.selectorButton}
                >
                  <MaterialSymbol color={BG_TEXT} name="arrow_forward" size={16} />
                </Pressable>
              </View>
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Amount</Text>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setTransferAmount}
                placeholder="0.00"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={transferAmount}
              />
            </View>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Memo</Text>
              <TextInput
                onChangeText={setTransferNote}
                placeholder="Move cash to savings"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={transferNote}
              />
            </View>

            <View style={styles.actionRow}>
              <Pressable
                onPress={() => setTransferVisible(false)}
                style={styles.secondaryAction}
              >
                <Text style={styles.secondaryActionLabel}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleTransfer} style={styles.primaryAction}>
                <Text style={styles.primaryActionLabel}>Transfer</Text>
              </Pressable>
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: BG_SURFACES.base,
  },
  content: {
    padding: 20,
    paddingBottom: 48,
    gap: 18,
  },
  loadingState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.base,
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  loadingText: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
  },
  errorText: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 20,
  },
  heroCard: {
    gap: 18,
  },
  heroTopRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 8,
  },
  eyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  heroTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  heroMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  heroAction: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  heroActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  infoChip: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  infoChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    gap: 10,
    minHeight: 116,
  },
  statLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  statValue: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 20,
    lineHeight: 26,
  },
  sectionCard: {
    gap: 16,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  sectionLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  sectionSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  inlineAction: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  inlineActionLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  fieldGroup: {
    gap: 8,
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
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  inputLocked: {
    color: BG_TEXT_TERTIARY,
  },
  typeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  typeChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  typeChipSelected: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  typeChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  typeChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  currencyRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  currencyChip: {
    backgroundColor: BG_SURFACES.low,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  currencyChipSelected: {
    backgroundColor: `${BG_ACCENT}22`,
  },
  currencyChipLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  currencyChipLabelSelected: {
    color: BG_ACCENT_LIGHT,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 12,
  },
  primaryAction: {
    alignItems: 'center',
    backgroundColor: BG_MONEY,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryActionDisabled: {
    opacity: 0.72,
  },
  primaryActionLabel: {
    color: BG_SURFACES.base,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
    lineHeight: 18,
  },
  secondaryAction: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  secondaryActionLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  destructiveAction: {
    alignItems: 'center',
    backgroundColor: `${BG_DANGER}22`,
    borderRadius: 18,
    flex: 1,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  destructiveActionLabel: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  emptyState: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 18,
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  emptyStateTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  emptyStateSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.regular,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
  },
  transactionList: {
    gap: 12,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.55)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalCard: {
    gap: 16,
    paddingBottom: 20,
  },
  modalEyebrow: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  modalTitle: {
    ...BG_TYPOGRAPHY.headlineMd,
    color: BG_TEXT,
  },
  deltaCard: {
    backgroundColor: BG_SURFACES.low,
    gap: 8,
  },
  deltaLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  selectorRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  selectorButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 14,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  selectorValue: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 14,
    lineHeight: 18,
    textAlign: 'center',
  },
});
