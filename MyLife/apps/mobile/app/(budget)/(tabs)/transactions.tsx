import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Swipeable } from 'react-native-gesture-handler';
import {
  BG_ACCENT,
  BG_ACCENT_LIGHT,
  BG_DANGER,
  BG_FONTS,
  BG_MONEY,
  BG_SURFACES,
  BG_TEXT,
  BG_TEXT_SECONDARY,
  BG_TEXT_TERTIARY,
  AmountDisplay,
  GlassCard,
  MaterialSymbol,
  TxRow,
  deleteTransaction,
  getSplitsByTransaction,
  listAccounts,
  listEnvelopes,
  listTransactions,
  type Account,
  type BudgetTransaction,
  type Envelope,
  type TransactionSplit,
} from '@mylife/budget';
import { useDatabase } from '../../../components/DatabaseProvider';

type DirectionFilter = 'all' | 'inflow' | 'outflow' | 'transfer';
type SortKey = 'date' | 'amount' | 'payee';
type DateFilter = '30d' | '90d' | 'all';

type ListEntry =
  | {
      type: 'header';
      id: string;
      total: number;
      transactionCount: number;
    }
  | {
      type: 'item';
      id: string;
      transaction: BudgetTransaction;
    };

const PAGE_SIZE = 50;

function formatCurrency(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

function formatDateLabel(date: string): string {
  return new Date(`${date}T00:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

function subtractDays(date: Date, days: number): string {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy.toISOString().slice(0, 10);
}

function matchesDateWindow(date: string, filter: DateFilter): boolean {
  if (filter === 'all') {
    return true;
  }
  const days = filter === '30d' ? 30 : 90;
  return date >= subtractDays(new Date(), days);
}

function buildListEntries(transactions: BudgetTransaction[]): ListEntry[] {
  const groups = new Map<string, BudgetTransaction[]>();

  transactions.forEach((transaction) => {
    const existing = groups.get(transaction.occurred_on) ?? [];
    existing.push(transaction);
    groups.set(transaction.occurred_on, existing);
  });

  const entries: ListEntry[] = [];
  [...groups.entries()]
    .sort((left, right) => right[0].localeCompare(left[0]))
    .forEach(([date, dateTransactions]) => {
      const total = dateTransactions.reduce((sum, transaction) => {
        if (transaction.direction === 'transfer') {
          return sum;
        }
        return sum + (transaction.direction === 'outflow' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount));
      }, 0);

      entries.push({
        id: `header-${date}`,
        total,
        transactionCount: dateTransactions.length,
        type: 'header',
      });
      dateTransactions.forEach((transaction) => {
        entries.push({
          id: transaction.id,
          transaction,
          type: 'item',
        });
      });
    });

  return entries;
}

function ActionChip({
  active = false,
  icon,
  label,
  onPress,
}: {
  active?: boolean;
  icon?: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.actionChip,
        { backgroundColor: active ? `${BG_ACCENT}22` : BG_SURFACES.high },
      ]}
    >
      {icon ? (
        <MaterialSymbol
          color={active ? BG_ACCENT_LIGHT : BG_TEXT_TERTIARY}
          name={icon}
          size={14}
        />
      ) : null}
      <Text
        style={[
          styles.actionChipLabel,
          { color: active ? BG_ACCENT_LIGHT : BG_TEXT_SECONDARY },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export default function BudgetTransactionsScreen() {
  const db = useDatabase();
  const router = useRouter();
  const params = useLocalSearchParams<{ refresh?: string }>();

  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [splitsByTransaction, setSplitsByTransaction] = useState<Record<string, TransactionSplit[]>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState<DirectionFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('30d');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [reviewOnly, setReviewOnly] = useState(false);
  const [splitOnly, setSplitOnly] = useState(false);
  const [accountFilter, setAccountFilter] = useState<string>('all');
  const [envelopeFilter, setEnvelopeFilter] = useState<string>('all');
  const [page, setPage] = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);

    try {
      const nextTransactions = listTransactions(db, { limit: 500 });
      const nextAccounts = listAccounts(db, true);
      const nextEnvelopes = listEnvelopes(db, true);
      const nextSplits: Record<string, TransactionSplit[]> = {};

      nextTransactions.forEach((transaction) => {
        nextSplits[transaction.id] = getSplitsByTransaction(db, transaction.id);
      });

      setTransactions(nextTransactions);
      setAccounts(nextAccounts);
      setEnvelopes(nextEnvelopes);
      setSplitsByTransaction(nextSplits);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load transactions.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [db]);

  useEffect(() => {
    load();
  }, [load, params.refresh]);

  useEffect(() => {
    const handle = setTimeout(() => {
      setDebouncedQuery(query.trim().toLowerCase());
    }, 200);

    return () => clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    setPage(1);
  }, [
    accountFilter,
    dateFilter,
    debouncedQuery,
    directionFilter,
    envelopeFilter,
    reviewOnly,
    sortKey,
    splitOnly,
  ]);

  const accountMap = useMemo(
    () => new Map(accounts.map((account) => [account.id, account])),
    [accounts],
  );

  const envelopeMap = useMemo(
    () => new Map(envelopes.map((envelope) => [envelope.id, envelope])),
    [envelopes],
  );

  const filteredTransactions = useMemo(() => {
    const matchesQuery = (transaction: BudgetTransaction): boolean => {
      if (!debouncedQuery) {
        return true;
      }

      const accountName = transaction.account_id
        ? accountMap.get(transaction.account_id)?.name ?? ''
        : '';
      const envelopeName = transaction.envelope_id
        ? envelopeMap.get(transaction.envelope_id)?.name ?? ''
        : '';

      return [
        transaction.merchant ?? '',
        transaction.note ?? '',
        transaction.occurred_on,
        accountName,
        envelopeName,
      ]
        .join(' ')
        .toLowerCase()
        .includes(debouncedQuery);
    };

    const base = transactions.filter((transaction) => {
      if (directionFilter !== 'all' && transaction.direction !== directionFilter) {
        return false;
      }
      if (accountFilter !== 'all' && transaction.account_id !== accountFilter) {
        return false;
      }
      if (envelopeFilter !== 'all' && transaction.envelope_id !== envelopeFilter) {
        return false;
      }
      if (!matchesDateWindow(transaction.occurred_on, dateFilter)) {
        return false;
      }
      if (reviewOnly && transaction.envelope_id && transaction.merchant?.trim()) {
        return false;
      }
      if (splitOnly && (splitsByTransaction[transaction.id]?.length ?? 0) === 0) {
        return false;
      }
      return matchesQuery(transaction);
    });

    return [...base].sort((left, right) => {
      if (sortKey === 'amount') {
        return Math.abs(right.amount) - Math.abs(left.amount);
      }
      if (sortKey === 'payee') {
        return (left.merchant ?? '').localeCompare(right.merchant ?? '');
      }
      return right.occurred_on.localeCompare(left.occurred_on);
    });
  }, [
    accountFilter,
    accountMap,
    dateFilter,
    debouncedQuery,
    directionFilter,
    envelopeFilter,
    envelopeMap,
    reviewOnly,
    sortKey,
    splitOnly,
    splitsByTransaction,
    transactions,
  ]);

  const pagedTransactions = useMemo(
    () => filteredTransactions.slice(0, page * PAGE_SIZE),
    [filteredTransactions, page],
  );

  const listEntries = useMemo(
    () => buildListEntries(pagedTransactions),
    [pagedTransactions],
  );

  const netTotal = useMemo(
    () =>
      filteredTransactions.reduce((sum, transaction) => {
        if (transaction.direction === 'transfer') {
          return sum;
        }
        return sum + (transaction.direction === 'outflow' ? -Math.abs(transaction.amount) : Math.abs(transaction.amount));
      }, 0),
    [filteredTransactions],
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load();
  }, [load]);

  const cycleAccountFilter = useCallback(() => {
    const options = ['all', ...accounts.map((account) => account.id)];
    const currentIndex = options.indexOf(accountFilter);
    const next = options[(currentIndex + 1) % options.length];
    setAccountFilter(next);
  }, [accountFilter, accounts]);

  const cycleEnvelopeFilter = useCallback(() => {
    const options = ['all', ...envelopes.map((envelope) => envelope.id)];
    const currentIndex = options.indexOf(envelopeFilter);
    const next = options[(currentIndex + 1) % options.length];
    setEnvelopeFilter(next);
  }, [envelopeFilter, envelopes]);

  const handleDelete = useCallback((transaction: BudgetTransaction) => {
    Alert.alert(
      'Delete transaction',
      `Remove ${transaction.merchant ?? 'this transaction'} from your budget?`,
      [
        { style: 'cancel', text: 'Cancel' },
        {
          style: 'destructive',
          text: 'Delete',
          onPress: () => {
            deleteTransaction(db, transaction.id);
            load();
          },
        },
      ],
    );
  }, [db, load]);

  const accountLabel =
    accountFilter === 'all'
      ? 'All Accounts'
      : accountMap.get(accountFilter)?.name ?? 'Account';
  const envelopeLabel =
    envelopeFilter === 'all'
      ? 'All Categories'
      : envelopeMap.get(envelopeFilter)?.name ?? 'Category';

  return (
    <FlatList
      contentContainerStyle={styles.content}
      data={listEntries}
      keyExtractor={(entry) => entry.id}
      ListHeaderComponent={
        <View style={styles.header}>
          <GlassCard style={styles.heroCard}>
            <Text style={styles.eyebrow}>Transactions</Text>
            <AmountDisplay
              cents={netTotal}
              size="xl"
              type={netTotal >= 0 ? 'income' : 'expense'}
            />
            <Text style={styles.heroSubtitle}>
              {filteredTransactions.length} matching transactions
            </Text>
          </GlassCard>

          <GlassCard style={styles.searchCard}>
            <View style={styles.searchRow}>
              <MaterialSymbol color={BG_TEXT_TERTIARY} name="search" size={18} />
              <TextInput
                onChangeText={setQuery}
                placeholder="Search payee, note, account, or category"
                placeholderTextColor={BG_TEXT_TERTIARY}
                style={styles.searchInput}
                value={query}
              />
            </View>
          </GlassCard>

          <View style={styles.filterSection}>
            <ScrollView
              contentContainerStyle={styles.filterRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {(['all', 'outflow', 'inflow', 'transfer'] as const).map((value) => (
                <ActionChip
                  active={directionFilter === value}
                  key={value}
                  label={value === 'all' ? 'All' : value[0].toUpperCase() + value.slice(1)}
                  onPress={() => setDirectionFilter(value)}
                />
              ))}
            </ScrollView>

            <ScrollView
              contentContainerStyle={styles.filterRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              <ActionChip
                icon="account_balance_wallet"
                label={accountLabel}
                onPress={cycleAccountFilter}
              />
              <ActionChip
                icon="pie_chart"
                label={envelopeLabel}
                onPress={cycleEnvelopeFilter}
              />
              <ActionChip
                active={reviewOnly}
                icon="warning"
                label="Review Needed"
                onPress={() => setReviewOnly((current) => !current)}
              />
              <ActionChip
                active={splitOnly}
                icon="currency_exchange"
                label="Split"
                onPress={() => setSplitOnly((current) => !current)}
              />
            </ScrollView>

            <ScrollView
              contentContainerStyle={styles.filterRow}
              horizontal
              showsHorizontalScrollIndicator={false}
            >
              {(['30d', '90d', 'all'] as const).map((value) => (
                <ActionChip
                  active={dateFilter === value}
                  icon="calendar_today"
                  key={value}
                  label={value === 'all' ? 'All Time' : `Last ${value}`}
                  onPress={() => setDateFilter(value)}
                />
              ))}
              {(['date', 'amount', 'payee'] as const).map((value) => (
                <ActionChip
                  active={sortKey === value}
                  icon="sort"
                  key={value}
                  label={`Sort: ${value[0].toUpperCase() + value.slice(1)}`}
                  onPress={() => setSortKey(value)}
                />
              ))}
            </ScrollView>
          </View>

          <View style={styles.ctaRow}>
            <Pressable
              onPress={() => router.push('/(budget)/connect-bank')}
              style={styles.secondaryButton}
            >
              <MaterialSymbol color={BG_TEXT} name="account_balance" size={16} />
              <Text style={styles.secondaryButtonLabel}>Connect Bank</Text>
            </Pressable>
            <Pressable
              onPress={() => router.push('/(budget)/transaction/create')}
              style={styles.primaryButton}
            >
              <MaterialSymbol color={BG_SURFACES.lowest} name="add" size={16} />
              <Text style={styles.primaryButtonLabel}>Add Manually</Text>
            </Pressable>
          </View>

          {error ? (
            <GlassCard style={styles.errorCard}>
              <Text style={styles.errorTitle}>Transactions unavailable</Text>
              <Text style={styles.errorMessage}>{error}</Text>
            </GlassCard>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Nothing matches these filters</Text>
            <Text style={styles.emptyMessage}>
              Connect a bank or add a transaction manually to start the feed.
            </Text>
          </GlassCard>
        ) : null
      }
      onEndReached={() => {
        if (pagedTransactions.length < filteredTransactions.length) {
          setPage((current) => current + 1);
        }
      }}
      onEndReachedThreshold={0.4}
      refreshControl={
        <RefreshControl
          colors={[BG_ACCENT]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={BG_ACCENT}
        />
      }
      renderItem={({ item }) => {
        if (item.type === 'header') {
          const date = item.id.replace('header-', '');
          return (
            <View style={styles.dayHeader}>
              <Text style={styles.dayHeaderTitle}>{formatDateLabel(date)}</Text>
              <View style={styles.dayHeaderMeta}>
                <Text style={styles.dayHeaderCount}>
                  {item.transactionCount} tx
                </Text>
                <Text
                  style={[
                    styles.dayHeaderTotal,
                    { color: item.total >= 0 ? BG_MONEY : BG_DANGER },
                  ]}
                >
                  {item.total >= 0 ? '+' : ''}
                  {formatCurrency(item.total)}
                </Text>
              </View>
            </View>
          );
        }

        const account = item.transaction.account_id
          ? accountMap.get(item.transaction.account_id)
          : null;
        const envelope = item.transaction.envelope_id
          ? envelopeMap.get(item.transaction.envelope_id)
          : null;

        return (
          <Swipeable
            renderLeftActions={() => (
              <View style={styles.leftActionWrap}>
                <Pressable
                  onPress={() => router.push(`/(budget)/transaction/${item.transaction.id}`)}
                  style={styles.editAction}
                >
                  <MaterialSymbol color={BG_SURFACES.lowest} name="edit" size={16} />
                  <Text style={styles.actionTextDark}>Edit</Text>
                </Pressable>
              </View>
            )}
            renderRightActions={() => (
              <View style={styles.rightActionWrap}>
                <Pressable
                  onPress={() => handleDelete(item.transaction)}
                  style={styles.deleteAction}
                >
                  <MaterialSymbol color={BG_TEXT} name="delete" size={16} />
                  <Text style={styles.actionTextLight}>Delete</Text>
                </Pressable>
              </View>
            )}
          >
            <TxRow
              category={
                envelope
                  ? {
                      color: envelope.color,
                      icon: envelope.icon,
                      name: envelope.name,
                    }
                  : {
                      color: null,
                      icon: 'warning',
                      name: 'Review needed',
                    }
              }
              hasSplit={(splitsByTransaction[item.transaction.id]?.length ?? 0) > 0}
              onPress={() => router.push(`/(budget)/transaction/${item.transaction.id}`)}
              showDate={false}
              tx={{
                ...item.transaction,
                merchant:
                  item.transaction.merchant?.trim() ||
                  account?.name ||
                  'Transaction',
              }}
            />
          </Swipeable>
        );
      }}
      style={styles.container}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: BG_SURFACES.lowest,
    flex: 1,
  },
  content: {
    paddingBottom: 136,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  header: {
    gap: 16,
    marginBottom: 16,
  },
  heroCard: {
    gap: 10,
  },
  eyebrow: {
    color: BG_ACCENT_LIGHT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 11,
    letterSpacing: 1.2,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  heroSubtitle: {
    color: BG_TEXT_SECONDARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 13,
    lineHeight: 18,
  },
  searchCard: {
    paddingVertical: 10,
  },
  searchRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
  },
  searchInput: {
    color: BG_TEXT,
    flex: 1,
    fontFamily: BG_FONTS.medium,
    fontSize: 15,
    lineHeight: 20,
    minHeight: 40,
  },
  filterSection: {
    gap: 10,
  },
  filterRow: {
    gap: 8,
  },
  actionChip: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    minHeight: 34,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  actionChipLabel: {
    fontFamily: BG_FONTS.semiBold,
    fontSize: 12,
    lineHeight: 16,
  },
  ctaRow: {
    flexDirection: 'row',
    gap: 12,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: BG_SURFACES.high,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonLabel: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.semiBold,
    fontSize: 14,
    lineHeight: 18,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 18,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  primaryButtonLabel: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.bold,
    fontSize: 14,
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
    marginTop: 12,
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
  dayHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 10,
    marginTop: 8,
  },
  dayHeaderTitle: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 16,
    lineHeight: 20,
  },
  dayHeaderMeta: {
    alignItems: 'flex-end',
    gap: 2,
  },
  dayHeaderCount: {
    color: BG_TEXT_TERTIARY,
    fontFamily: BG_FONTS.medium,
    fontSize: 11,
    lineHeight: 14,
    textTransform: 'uppercase',
  },
  dayHeaderTotal: {
    fontFamily: BG_FONTS.bold,
    fontSize: 12,
    lineHeight: 16,
  },
  leftActionWrap: {
    justifyContent: 'center',
    marginBottom: 12,
    marginRight: 10,
  },
  editAction: {
    alignItems: 'center',
    backgroundColor: BG_ACCENT_LIGHT,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 68,
    paddingHorizontal: 16,
    width: 96,
  },
  rightActionWrap: {
    justifyContent: 'center',
    marginBottom: 12,
    marginLeft: 10,
  },
  deleteAction: {
    alignItems: 'center',
    backgroundColor: BG_DANGER,
    borderRadius: 18,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 68,
    paddingHorizontal: 16,
    width: 104,
  },
  actionTextDark: {
    color: BG_SURFACES.lowest,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
  actionTextLight: {
    color: BG_TEXT,
    fontFamily: BG_FONTS.bold,
    fontSize: 13,
    lineHeight: 16,
  },
});
