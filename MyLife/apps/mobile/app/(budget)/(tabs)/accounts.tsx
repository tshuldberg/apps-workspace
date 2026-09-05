import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
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
  BG_DANGER,
  BG_FONTS,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  AccountCard,
  AmountDisplay,
  GlassCard,
  MaterialSymbol,
  SectionHeader,
  calculateNetWorth,
  createTransfer,
  deleteAccount,
  getNetWorthSnapshotByMonth,
  listAccounts,
  updateAccount,
  type Account,
  type AccountType,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';
import { uuid } from '../../../lib/uuid';

type BankConnectionStatusRow = {
  id: string;
  display_name: string;
  institution_name: string | null;
  status: 'active' | 'requires_reauth' | 'disconnected' | 'error';
  last_successful_sync: string | null;
  last_attempted_sync: string | null;
  sync_status: 'idle' | 'running' | 'error' | null;
  sync_last_successful_sync: string | null;
  sync_last_attempted_sync: string | null;
};

type AccountGroup = {
  type: AccountType;
  label: string;
  accounts: Account[];
};

const TYPE_ORDER: AccountType[] = [
  'checking',
  'savings',
  'cash',
  'credit',
  'investment',
  'loan',
  'mortgage',
  'other',
];

const TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash',
  checking: 'Checking',
  savings: 'Savings',
  credit: 'Credit',
  investment: 'Investment',
  loan: 'Loan',
  mortgage: 'Mortgage',
  other: 'Other',
};

function formatCurrency(cents: number): string {
  const abs = Math.abs(cents);
  const sign = cents < 0 ? '-' : '';
  return `${sign}${new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(abs / 100)}`;
}

function formatSyncAge(timestamp: string | null): string {
  if (!timestamp) {
    return 'No successful sync yet';
  }

  const diffMs = Date.now() - new Date(timestamp).getTime();
  const diffMinutes = Math.max(Math.round(diffMs / (1000 * 60)), 0);

  if (diffMinutes < 1) {
    return 'Synced just now';
  }
  if (diffMinutes < 60) {
    return `Synced ${diffMinutes}m ago`;
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) {
    return `Synced ${diffHours}h ago`;
  }

  const diffDays = Math.round(diffHours / 24);
  return `Synced ${diffDays}d ago`;
}

function parseCurrencyToCents(value: string): number | null {
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

function currentMonth(): string {
  return new Date().toISOString().slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthValue] = month.split('-').map(Number);
  const date = new Date(year, monthValue - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function ActionButton({
  icon,
  label,
  onPress,
  tone = 'secondary',
}: {
  icon: string;
  label: string;
  onPress: () => void;
  tone?: 'secondary' | 'primary';
}) {
  const backgroundColor = tone === 'primary' ? BG_ACCENT : BG_SURFACES.high;
  const color = tone === 'primary' ? BG_SURFACES.lowest : BG_TEXT;

  return (
    <Pressable onPress={onPress} style={[styles.actionButton, { backgroundColor }]}>
      <MaterialSymbol color={color} name={icon} size={16} />
      <Text style={[styles.actionButtonLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

export default function BudgetAccountsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();

  const [accounts, setAccounts] = useState<Account[]>([]);
  const [connections, setConnections] = useState<BankConnectionStatusRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showTransferSheet, setShowTransferSheet] = useState(false);
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferNote, setTransferNote] = useState('');
  const [includeArchived, setIncludeArchived] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const nextAccounts = listAccounts(db, includeArchived);
      const nextConnections = db.query<BankConnectionStatusRow>(
        `SELECT
          c.id,
          c.display_name,
          c.institution_name,
          c.status,
          c.last_successful_sync,
          c.last_attempted_sync,
          s.sync_status,
          s.last_successful_sync AS sync_last_successful_sync,
          s.last_attempted_sync AS sync_last_attempted_sync
        FROM bg_bank_connections c
        LEFT JOIN bg_bank_sync_state s ON s.connection_id = c.id
        ORDER BY c.updated_at DESC`,
      );

      setAccounts(nextAccounts);
      setConnections(nextConnections);
      if (!fromAccountId && nextAccounts[0]) {
        setFromAccountId(nextAccounts[0].id);
      }
      if (!toAccountId && nextAccounts[1]) {
        setToAccountId(nextAccounts[1].id);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load accounts.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db, fromAccountId, includeArchived, toAccountId]);

  useEffect(() => {
    load();
  }, [load, params.refresh]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const activeAccounts = useMemo(
    () => accounts.filter((account) => account.archived === 0),
    [accounts],
  );

  const netWorth = useMemo(
    () =>
      calculateNetWorth(
        activeAccounts.map((account) => ({
          id: account.id,
          name: account.name,
          accountType: account.type,
          balance: account.current_balance,
        })),
      ),
    [activeAccounts],
  );

  const availableCash = useMemo(
    () =>
      activeAccounts
        .filter((account) =>
          account.type === 'checking' ||
          account.type === 'savings' ||
          account.type === 'cash',
        )
        .reduce((sum, account) => sum + account.current_balance, 0),
    [activeAccounts],
  );

  const deltaVsLastMonth = useMemo(() => {
    const prior = getNetWorthSnapshotByMonth(db, shiftMonth(currentMonth(), -1));
    return prior ? netWorth.netWorth - prior.net_worth : null;
  }, [db, netWorth.netWorth]);

  const groupedAccounts = useMemo<AccountGroup[]>(
    () =>
      TYPE_ORDER.map((type) => ({
        accounts: accounts.filter((account) => account.type === type),
        label: TYPE_LABELS[type],
        type,
      })).filter((group) => group.accounts.length > 0),
    [accounts],
  );

  const latestSync = useMemo(() => {
    return connections.reduce<string | null>((latest, connection) => {
      const candidate =
        connection.sync_last_successful_sync ??
        connection.last_successful_sync ??
        connection.sync_last_attempted_sync ??
        connection.last_attempted_sync;
      if (!candidate) {
        return latest;
      }
      if (!latest || candidate > latest) {
        return candidate;
      }
      return latest;
    }, null);
  }, [connections]);

  const transferAccounts = useMemo(
    () => activeAccounts.filter((account) => account.type !== 'mortgage'),
    [activeAccounts],
  );

  const cycleAccount = useCallback(
    (currentId: string, direction: 'forward' | 'backward') => {
      if (transferAccounts.length === 0) {
        return '';
      }
      const currentIndex = transferAccounts.findIndex((account) => account.id === currentId);
      const startIndex = currentIndex >= 0 ? currentIndex : 0;
      const delta = direction === 'forward' ? 1 : -1;
      const nextIndex =
        (startIndex + delta + transferAccounts.length) % transferAccounts.length;
      return transferAccounts[nextIndex].id;
    },
    [transferAccounts],
  );

  const handleAccountAction = useCallback(
    (account: Account) => {
      Alert.alert(account.name, 'Choose what to do with this account.', [
        {
          text: 'Edit',
          onPress: () => router.push(`/(budget)/account/${account.id}`),
        },
        {
          text: account.archived === 1 ? 'Unarchive' : 'Archive',
          onPress: () => {
            try {
              updateAccount(db, account.id, {
                archived: account.archived === 1 ? 0 : 1,
              });
              load();
            } catch (err) {
              Alert.alert(
                'Account update failed',
                err instanceof Error ? err.message : 'Please try again.',
              );
            }
          },
        },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: () => {
            Alert.alert(
              'Delete account?',
              'This removes the account record. Existing transactions keep their history but may lose the linked account.',
              [
                { text: 'Cancel', style: 'cancel' },
                {
                  style: 'destructive',
                  text: 'Delete',
                  onPress: () => {
                    try {
                      deleteAccount(db, account.id);
                      load();
                    } catch (err) {
                      Alert.alert(
                        'Delete failed',
                        err instanceof Error ? err.message : 'Please try again.',
                      );
                    }
                  },
                },
              ],
            );
          },
        },
        { style: 'cancel', text: 'Cancel' },
      ]);
    },
    [db, load, router],
  );

  const handleTransfer = useCallback(() => {
    const cents = parseCurrencyToCents(transferAmount);
    if (cents == null || cents <= 0) {
      Alert.alert('Invalid amount', 'Enter a valid transfer amount.');
      return;
    }
    if (!fromAccountId || !toAccountId || fromAccountId === toAccountId) {
      Alert.alert('Choose accounts', 'Select two different accounts.');
      return;
    }

    try {
      createTransfer(
        db,
        uuid(),
        uuid(),
        fromAccountId,
        toAccountId,
        cents,
        new Date().toISOString().slice(0, 10),
        transferNote.trim() || undefined,
      );
      setShowTransferSheet(false);
      setTransferAmount('');
      setTransferNote('');
      load();
    } catch (err) {
      Alert.alert(
        'Transfer failed',
        err instanceof Error ? err.message : 'Please try again.',
      );
    }
  }, [db, fromAccountId, load, toAccountId, transferAmount, transferNote]);

  return (
    <>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            colors={[BG_ACCENT]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={BG_ACCENT}
          />
        }
        style={styles.container}
      >
        <GlassCard style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={styles.heroCopy}>
              <Text style={styles.eyebrow}>Accounts</Text>
              <Text style={styles.heroTitle}>See every dollar and every liability in one place.</Text>
            </View>
            <Pressable
              onPress={() => router.push('/(budget)/net-worth')}
              style={styles.heroLink}
            >
              <Text style={styles.heroLinkLabel}>View Detail</Text>
              <MaterialSymbol color={BG_ACCENT_LIGHT} name="arrow_forward" size={16} />
            </Pressable>
          </View>

          <AmountDisplay
            cents={netWorth.netWorth}
            size="xl"
            type={netWorth.netWorth >= 0 ? 'income' : 'expense'}
          />
          <Text style={styles.heroMeta}>
            {deltaVsLastMonth == null
              ? 'No saved comparison from last month yet'
              : `${deltaVsLastMonth >= 0 ? '+' : '-'}${formatCurrency(Math.abs(deltaVsLastMonth))} vs last month`}
          </Text>
        </GlassCard>

        <View style={styles.statsRow}>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Assets</Text>
            <AmountDisplay cents={netWorth.totalAssets} size="lg" type="income" />
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Liabilities</Text>
            <AmountDisplay cents={netWorth.totalLiabilities} size="lg" type="expense" />
          </GlassCard>
          <GlassCard style={styles.statCard}>
            <Text style={styles.statLabel}>Available Cash</Text>
            <AmountDisplay cents={availableCash} size="lg" type="neutral" />
          </GlassCard>
        </View>

        {connections.length > 0 ? (
          <GlassCard style={styles.syncCard}>
            <View style={styles.syncHeader}>
              <View style={styles.syncIcon}>
                <MaterialSymbol color={BG_ACCENT_LIGHT} name="sync" size={18} />
              </View>
              <View style={styles.syncCopy}>
                <Text style={styles.syncTitle}>Bank sync status</Text>
                <Text style={styles.syncMeta}>
                  {connections.length} connection{connections.length === 1 ? '' : 's'} • {formatSyncAge(latestSync)}
                </Text>
              </View>
              <ActionButton icon="refresh" label="Refresh" onPress={onRefresh} />
            </View>
            <Text style={styles.syncDetail}>
              {connections[0].institution_name ?? connections[0].display_name} is {connections[0].sync_status ?? connections[0].status}.
            </Text>
          </GlassCard>
        ) : null}

        <View style={styles.actionsRow}>
          <ActionButton
            icon="add_card"
            label="Add Account"
            onPress={() => router.push('/(budget)/account/create')}
          />
          <ActionButton
            icon="account_balance"
            label="Connect Bank"
            onPress={() => router.push('/(budget)/connect-bank')}
          />
          <ActionButton
            icon="swap_horiz"
            label="Transfer"
            onPress={() => setShowTransferSheet(true)}
            tone="primary"
          />
        </View>

        <Pressable
          onPress={() => setIncludeArchived((current) => !current)}
          style={styles.archiveToggle}
        >
          <MaterialSymbol
            color={includeArchived ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
            name={includeArchived ? 'visibility' : 'visibility_off'}
            size={16}
          />
          <Text
            style={[
              styles.archiveToggleLabel,
              { color: includeArchived ? BG_ACCENT_LIGHT : BG_TEXT_SECONDARY },
            ]}
          >
            {includeArchived ? 'Showing archived accounts' : 'Hide archived accounts'}
          </Text>
        </Pressable>

        {error ? (
          <GlassCard style={styles.errorCard}>
            <Text style={styles.errorTitle}>Accounts unavailable</Text>
            <Text style={styles.errorMessage}>{error}</Text>
          </GlassCard>
        ) : null}

        {groupedAccounts.length === 0 && !loading ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No accounts yet</Text>
            <Text style={styles.emptyMessage}>
              Add a checking, savings, credit, or investment account to start building your balance sheet.
            </Text>
          </GlassCard>
        ) : null}

        {groupedAccounts.map((group) => (
          <GlassCard key={group.type} style={styles.groupCard}>
            <SectionHeader
              action={
                <Text style={styles.groupMeta}>
                  {formatCurrency(
                    group.accounts.reduce((sum, account) => {
                      if (
                        account.type === 'credit' ||
                        account.type === 'loan' ||
                        account.type === 'mortgage'
                      ) {
                        return sum - Math.abs(account.current_balance);
                      }
                      return sum + account.current_balance;
                    }, 0),
                  )}
                </Text>
              }
              title={group.label}
            />
            <View style={styles.groupBody}>
              {group.accounts.map((account) => (
                <AccountCard
                  account={account}
                  key={account.id}
                  onLongPress={() => handleAccountAction(account)}
                  onPress={() => router.push(`/(budget)/account/${account.id}`)}
                  updatedLabel={
                    connections.length > 0
                      ? formatSyncAge(latestSync)
                      : account.archived === 1
                        ? 'Archived from active totals'
                        : 'Tracked locally'
                  }
                />
              ))}
            </View>
          </GlassCard>
        ))}
      </ScrollView>

      <Modal
        animationType="slide"
        onRequestClose={() => setShowTransferSheet(false)}
        transparent
        visible={showTransferSheet}
      >
        <View style={styles.modalScrim}>
          <GlassCard style={styles.modalCard}>
            <Text style={styles.modalEyebrow}>Quick Transfer</Text>
            <Text style={styles.modalTitle}>Move cash between accounts</Text>

            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>From</Text>
              <View style={styles.selectorRow}>
                <Pressable
                  onPress={() => setFromAccountId(cycleAccount(fromAccountId, 'backward'))}
                  style={styles.selectorButton}
                >
                  <MaterialSymbol color={BG_TEXT} name="arrow_back" size={16} />
                </Pressable>
                <Text style={styles.selectorValue}>
                  {transferAccounts.find((account) => account.id === fromAccountId)?.name ?? 'Choose account'}
                </Text>
                <Pressable
                  onPress={() => setFromAccountId(cycleAccount(fromAccountId, 'forward'))}
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
                  onPress={() => setToAccountId(cycleAccount(toAccountId, 'backward'))}
                  style={styles.selectorButton}
                >
                  <MaterialSymbol color={BG_TEXT} name="arrow_back" size={16} />
                </Pressable>
                <Text style={styles.selectorValue}>
                  {transferAccounts.find((account) => account.id === toAccountId)?.name ?? 'Choose account'}
                </Text>
                <Pressable
                  onPress={() => setToAccountId(cycleAccount(toAccountId, 'forward'))}
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
              <Text style={styles.fieldLabel}>Note</Text>
              <TextInput
                onChangeText={setTransferNote}
                placeholder="Optional note"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.input}
                value={transferNote}
              />
            </View>

            <View style={styles.modalActions}>
              <ActionButton
                icon="close"
                label="Cancel"
                onPress={() => setShowTransferSheet(false)}
              />
              <ActionButton
                icon="check_circle"
                label="Create Transfer"
                onPress={handleTransfer}
                tone="primary"
              />
            </View>
          </GlassCard>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.lowest,
    flex: 1,
  },
  content: {
    gap: 16,
    paddingBottom: 136,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  heroCard: {
    gap: 12,
  },
  heroHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 4,
  },
  eyebrow: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 24,
    lineHeight: 30,
  },
  heroMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  heroLink: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  heroLinkLabel: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    gap: 8,
    minHeight: 120,
  },
  statLabel: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  syncCard: {
    gap: 10,
  },
  syncHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  syncIcon: {
    alignItems: 'center',
    backgroundColor: `${BG_ACCENT}22`,
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  syncCopy: {
    flex: 1,
    gap: 2,
  },
  syncTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  syncMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
  },
  syncDetail: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    alignItems: 'center',
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  actionButtonLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  archiveToggle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  archiveToggleLabel: {
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  errorCard: {
    gap: 6,
  },
  errorTitle: {
    color: BG_DANGER,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  errorMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  emptyCard: {
    gap: 8,
  },
  emptyTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 18,
    lineHeight: 22,
  },
  emptyMessage: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  groupCard: {
    gap: 14,
  },
  groupMeta: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 13,
    lineHeight: 18,
  },
  groupBody: {
    gap: 12,
  },
  modalScrim: {
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    flex: 1,
    justifyContent: 'flex-end',
    padding: 20,
  },
  modalCard: {
    gap: 16,
  },
  modalEyebrow: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  modalTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 22,
    lineHeight: 28,
  },
  fieldGroup: {
    gap: 8,
  },
  fieldLabel: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 12,
    lineHeight: 16,
    textTransform: 'uppercase',
  },
  selectorRow: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 12,
    minHeight: 52,
    paddingHorizontal: 12,
  },
  selectorButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.low,
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  selectorValue: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    textAlign: 'center',
  },
  input: {
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    color: BG_TEXT,
    fontFamily: BG_FONTS.medium,
    fontSize: 16,
    lineHeight: 20,
    minHeight: 52,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
  },
});
