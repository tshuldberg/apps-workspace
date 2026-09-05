'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Account, BudgetGoal, BudgetTransaction, CategoryGroup, Envelope } from '@mylife/budget';
import {
  addAccount,
  addEnvelope,
  addGoal,
  addTransaction,
  editGoal,
  fetchAccounts,
  fetchActivityByMonth,
  fetchCategoryGroups,
  fetchEnvelopes,
  fetchEnvelopesByGroup,
  fetchGoals,
  fetchTransactions,
  removeGoal,
} from './actions';
import { BudgetDonutChart, BudgetLineChart } from './charts';
import {
  ACCENT_LIGHT,
  BudgetCard,
  BudgetEmptyState,
  BudgetMetricCard,
  BudgetPill,
  BudgetSectionHeader,
  CONTENT_MAX_WIDTH,
  DANGER,
  INFO,
  MONEY,
  TEXT,
  TEXT_SECONDARY,
  TEXT_TERTIARY,
  buttonStyle,
  formatBudgetCurrency,
  formatBudgetDate,
  groupByDate,
  inputStyle,
  monthRange,
  withAlpha,
} from './ui';

type GroupSection = {
  accent: string;
  envelopes: Array<{
    envelope: Envelope;
    remaining: number;
    spent: number;
  }>;
  id: string;
  name: string;
  totalBudget: number;
  totalRemaining: number;
  totalSpent: number;
};

const GROUP_COLORS = [MONEY, ACCENT_LIGHT, INFO, '#A78BFA', '#F59E0B', '#F97316'] as const;

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function parseCurrencyInput(value: string) {
  const normalized = value.replace(/[^0-9.-]/g, '').trim();
  if (!normalized) {
    return 0;
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) : 0;
}

function monthKeyFromDate(date: string) {
  return date.slice(0, 7);
}

function accountBucket(type: Account['type']) {
  switch (type) {
    case 'cash':
    case 'checking':
    case 'savings':
      return 'Cash';
    case 'credit':
      return 'Credit';
    case 'investment':
      return 'Investment';
    case 'loan':
      return 'Loan';
    case 'mortgage':
      return 'Mortgage';
    default:
      return 'Other';
  }
}

function balanceForNetWorth(account: Account) {
  return account.type === 'credit' || account.type === 'loan' || account.type === 'mortgage'
    ? -Math.abs(account.current_balance)
    : account.current_balance;
}

function buildGroupedEnvelopes(args: {
  activityByEnvelope: Record<string, number>;
  envelopes: Envelope[];
  groups: CategoryGroup[];
  memberships: Record<string, Array<{ id: string; name: string }>>;
}) {
  const envelopeMap = new Map(args.envelopes.map((envelope) => [envelope.id, envelope]));
  const assigned = new Set<string>();
  const sections: GroupSection[] = [];

  args.groups.forEach((group, index) => {
    const rows = (args.memberships[group.id] ?? [])
      .map((member) => {
        const envelope = envelopeMap.get(member.id);
        if (!envelope || envelope.archived !== 0) {
          return null;
        }
        const spent = Math.abs(Math.min(args.activityByEnvelope[envelope.id] ?? 0, 0));
        assigned.add(envelope.id);
        return {
          envelope,
          remaining: envelope.monthly_budget - spent,
          spent,
        };
      })
      .filter(
        (
          row,
        ): row is {
          envelope: Envelope;
          remaining: number;
          spent: number;
        } => Boolean(row),
      );

    if (rows.length === 0) {
      return;
    }

    sections.push({
      accent: GROUP_COLORS[index % GROUP_COLORS.length],
      envelopes: rows,
      id: group.id,
      name: group.name,
      totalBudget: rows.reduce((sum, row) => sum + row.envelope.monthly_budget, 0),
      totalRemaining: rows.reduce((sum, row) => sum + row.remaining, 0),
      totalSpent: rows.reduce((sum, row) => sum + row.spent, 0),
    });
  });

  const ungrouped = args.envelopes
    .filter((envelope) => envelope.archived === 0 && !assigned.has(envelope.id))
    .map((envelope) => {
      const spent = Math.abs(Math.min(args.activityByEnvelope[envelope.id] ?? 0, 0));
      return {
        envelope,
        remaining: envelope.monthly_budget - spent,
        spent,
      };
    });

  if (ungrouped.length > 0) {
    sections.push({
      accent: TEXT_TERTIARY,
      envelopes: ungrouped,
      id: '__ungrouped__',
      name: 'Uncategorized',
      totalBudget: ungrouped.reduce((sum, row) => sum + row.envelope.monthly_budget, 0),
      totalRemaining: ungrouped.reduce((sum, row) => sum + row.remaining, 0),
      totalSpent: ungrouped.reduce((sum, row) => sum + row.spent, 0),
    });
  }

  return sections;
}

function QuickCreateCard({
  children,
  kicker,
  title,
}: {
  children: ReactNode;
  kicker: string;
  title: string;
}) {
  return (
    <BudgetCard padding={20} tone={withAlpha('#1F1F25', 0.96)}>
      <div style={{ display: 'grid', gap: 16 }}>
        <div style={{ display: 'grid', gap: 8 }}>
          <p
            style={{
              color: TEXT_TERTIARY,
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: 1.2,
              margin: 0,
              textTransform: 'uppercase',
            }}
          >
            {kicker}
          </p>
          <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', margin: 0 }}>
            {title}
          </h2>
        </div>
        {children}
      </div>
    </BudgetCard>
  );
}

function EmptyHomeCard({
  description,
  title,
}: {
  description: string;
  title: string;
}) {
  return (
    <div
      style={{
        borderRadius: 20,
        border: `1px dashed ${withAlpha(ACCENT_LIGHT, 0.16)}`,
        background: withAlpha('#ffffff', 0.02),
        padding: 18,
      }}
    >
      <div style={{ display: 'grid', gap: 8 }}>
        <strong style={{ color: TEXT, fontSize: 15 }}>{title}</strong>
        <span style={{ color: TEXT_SECONDARY, fontSize: 13, lineHeight: 1.7 }}>
          {description}
        </span>
      </div>
    </div>
  );
}

export default function BudgetPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [goals, setGoals] = useState<BudgetGoal[]>([]);
  const [groupSections, setGroupSections] = useState<GroupSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState<string | null>(null);
  const [transactions, setTransactions] = useState<BudgetTransaction[]>([]);
  const [transactionFilter, setTransactionFilter] = useState<'all' | 'inflow' | 'outflow'>('all');
  const [submitting, setSubmitting] = useState<string | null>(null);

  const [envelopeName, setEnvelopeName] = useState('');
  const [envelopeBudget, setEnvelopeBudget] = useState('');
  const [accountName, setAccountName] = useState('');
  const [accountBalance, setAccountBalance] = useState('');
  const [accountType, setAccountType] = useState<Account['type']>('checking');
  const [transactionAmount, setTransactionAmount] = useState('');
  const [transactionDate, setTransactionDate] = useState(todayIso());
  const [transactionDirection, setTransactionDirection] = useState<'outflow' | 'inflow'>('outflow');
  const [transactionMerchant, setTransactionMerchant] = useState('');
  const [transactionNote, setTransactionNote] = useState('');
  const [transactionAccountId, setTransactionAccountId] = useState('');
  const [transactionEnvelopeId, setTransactionEnvelopeId] = useState('');
  const [goalName, setGoalName] = useState('');
  const [goalEnvelopeId, setGoalEnvelopeId] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCompleted, setGoalCompleted] = useState('');
  const [goalDate, setGoalDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setPageError(null);

    try {
      const currentMonth = todayIso().slice(0, 7);
      const [nextEnvelopes, nextAccounts, nextTransactions, nextGoals, nextGroups, nextActivity] =
        await Promise.all([
          fetchEnvelopes(),
          fetchAccounts(),
          fetchTransactions({ limit: 400 }),
          fetchGoals(),
          fetchCategoryGroups(),
          fetchActivityByMonth(currentMonth),
        ]);

      const memberships = Object.fromEntries(
        await Promise.all(
          nextGroups.map(async (group) => [group.id, await fetchEnvelopesByGroup(group.id)] as const),
        ),
      );

      setEnvelopes(nextEnvelopes as Envelope[]);
      setAccounts(nextAccounts as Account[]);
      setTransactions(nextTransactions as BudgetTransaction[]);
      setGoals(nextGoals as BudgetGoal[]);
      setGroupSections(
        buildGroupedEnvelopes({
          activityByEnvelope: nextActivity as Record<string, number>,
          envelopes: nextEnvelopes as Envelope[],
          groups: nextGroups as CategoryGroup[],
          memberships,
        }),
      );
      setGoalEnvelopeId((current) => current || (nextEnvelopes[0]?.id ?? ''));
      setTransactionEnvelopeId((current) => current || (nextEnvelopes[0]?.id ?? ''));
      setTransactionAccountId((current) => current || (nextAccounts[0]?.id ?? ''));
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Failed to load budget dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const currentMonth = todayIso().slice(0, 7);
  const currentMonthRange = monthRange(currentMonth);
  const monthTransactions = useMemo(
    () =>
      transactions.filter(
        (transaction) =>
          transaction.occurred_on >= currentMonthRange.from &&
          transaction.occurred_on <= currentMonthRange.to,
      ),
    [currentMonthRange.from, currentMonthRange.to, transactions],
  );

  const cashAccounts = useMemo(
    () =>
      accounts.filter(
        (account) => !account.archived && ['cash', 'checking', 'savings'].includes(account.type),
      ),
    [accounts],
  );

  const totalBudgeted = useMemo(
    () => envelopes.filter((envelope) => envelope.archived === 0).reduce((sum, envelope) => sum + envelope.monthly_budget, 0),
    [envelopes],
  );
  const totalSpent = useMemo(
    () =>
      monthTransactions
        .filter((transaction) => transaction.direction === 'outflow')
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0),
    [monthTransactions],
  );
  const totalIncome = useMemo(
    () =>
      monthTransactions
        .filter((transaction) => transaction.direction === 'inflow')
        .reduce((sum, transaction) => sum + transaction.amount, 0),
    [monthTransactions],
  );
  const totalCash = useMemo(
    () => cashAccounts.reduce((sum, account) => sum + account.current_balance, 0),
    [cashAccounts],
  );
  const totalNetWorth = useMemo(
    () => accounts.reduce((sum, account) => sum + balanceForNetWorth(account), 0),
    [accounts],
  );
  const readyToBudget = Math.max(totalCash - totalBudgeted, 0);

  const allocationData = useMemo(
    () =>
      groupSections.map((section) => ({
        color: section.accent,
        label: section.name,
        value: section.totalBudget,
      })),
    [groupSections],
  );

  const spendTrend = useMemo(() => {
    const monthLabels = Array.from({ length: 6 }, (_, index) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - index));
      return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    });

    return monthLabels.map((month) => {
      const monthTotal = transactions
        .filter(
          (transaction) =>
            transaction.direction === 'outflow' &&
            monthKeyFromDate(transaction.occurred_on) === month,
        )
        .reduce((sum, transaction) => sum + Math.abs(transaction.amount), 0);

      return {
        label: new Date(`${month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short' }),
        value: monthTotal,
      };
    });
  }, [transactions]);

  const filteredTransactions = useMemo(
    () =>
      monthTransactions.filter((transaction) =>
        transactionFilter === 'all' ? true : transaction.direction === transactionFilter,
      ),
    [monthTransactions, transactionFilter],
  );

  const groupedTransactions = useMemo(
    () => groupByDate(filteredTransactions.slice(0, 16)),
    [filteredTransactions],
  );

  const groupedAccounts = useMemo(() => {
    const groups = new Map<string, Account[]>();
    accounts.filter((account) => !account.archived).forEach((account) => {
      const key = accountBucket(account.type);
      const bucket = groups.get(key);
      if (bucket) {
        bucket.push(account);
      } else {
        groups.set(key, [account]);
      }
    });
    return Array.from(groups.entries());
  }, [accounts]);

  const topGoals = useMemo(
    () =>
      [...goals]
        .sort((left, right) => {
          const leftProgress = left.target_amount > 0 ? left.completed_amount / left.target_amount : 0;
          const rightProgress = right.target_amount > 0 ? right.completed_amount / right.target_amount : 0;
          return rightProgress - leftProgress;
        })
        .slice(0, 6),
    [goals],
  );

  async function runAction(actionKey: string, action: () => Promise<void>) {
    setSubmitting(actionKey);
    setPageError(null);
    try {
      await action();
      await load();
    } catch (error) {
      setPageError(error instanceof Error ? error.message : 'Budget action failed.');
    } finally {
      setSubmitting(null);
    }
  }

  const createEnvelope = async () => {
    await runAction('envelope', async () => {
      await addEnvelope({
        monthly_budget: parseCurrencyInput(envelopeBudget),
        name: envelopeName.trim(),
      });
      setEnvelopeName('');
      setEnvelopeBudget('');
    });
  };

  const createAccount = async () => {
    await runAction('account', async () => {
      await addAccount({
        current_balance: parseCurrencyInput(accountBalance),
        name: accountName.trim(),
        type: accountType,
      });
      setAccountName('');
      setAccountBalance('');
      setAccountType('checking');
    });
  };

  const createTransaction = async () => {
    await runAction('transaction', async () => {
      await addTransaction({
        account_id: transactionAccountId || null,
        amount: parseCurrencyInput(transactionAmount),
        direction: transactionDirection,
        envelope_id: transactionEnvelopeId || null,
        merchant: transactionMerchant.trim() || null,
        note: transactionNote.trim() || null,
        occurred_on: transactionDate,
      });
      setTransactionAmount('');
      setTransactionMerchant('');
      setTransactionNote('');
      setTransactionDate(todayIso());
    });
  };

  const createGoal = async () => {
    await runAction('goal', async () => {
      await addGoal({
        completed_amount: parseCurrencyInput(goalCompleted),
        envelope_id: goalEnvelopeId,
        name: goalName.trim(),
        target_amount: parseCurrencyInput(goalTarget),
        target_date: goalDate || null,
      });
      setGoalName('');
      setGoalTarget('');
      setGoalCompleted('');
      setGoalDate('');
    });
  };

  const toggleGoalComplete = async (goal: BudgetGoal) => {
    await runAction(`goal-toggle-${goal.id}`, async () => {
      await editGoal(goal.id, { is_completed: goal.is_completed === 1 ? 0 : 1 });
    });
  };

  const deleteGoalRow = async (goal: BudgetGoal) => {
    if (!window.confirm(`Delete ${goal.name}?`)) {
      return;
    }

    await runAction(`goal-delete-${goal.id}`, async () => {
      await removeGoal(goal.id);
    });
  };

  if (loading) {
    return (
      <div style={{ display: 'grid', gap: 20, maxWidth: CONTENT_MAX_WIDTH }}>
        <BudgetCard glow padding={28}>
          <div style={{ height: 220, borderRadius: 24, background: withAlpha('#ffffff', 0.04) }} />
        </BudgetCard>
        <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(4, minmax(0, 1fr))' }}>
          {Array.from({ length: 4 }).map((_, index) => (
            <BudgetCard key={index}>
              <div style={{ height: 120, borderRadius: 18, background: withAlpha('#ffffff', 0.04) }} />
            </BudgetCard>
          ))}
        </div>
      </div>
    );
  }

  if (pageError && envelopes.length === 0 && accounts.length === 0 && transactions.length === 0) {
    return (
      <BudgetEmptyState
        action={
          <button onClick={() => void load()} style={buttonStyle('primary')} type="button">
            Try Again
          </button>
        }
        description={pageError}
        icon="warning"
        title="Budget dashboard could not load"
      />
    );
  }

  return (
    <div style={{ display: 'grid', gap: 24, maxWidth: CONTENT_MAX_WIDTH }}>
      {pageError ? (
        <BudgetCard padding={18} tone={withAlpha(DANGER, 0.08)}>
          <div style={{ color: DANGER, fontSize: 14, fontWeight: 600 }}>{pageError}</div>
        </BudgetCard>
      ) : null}

      <BudgetCard glow padding={28}>
        <div
          style={{
            display: 'grid',
            gap: 24,
            gridTemplateColumns: 'minmax(0, 1.4fr) minmax(320px, 0.8fr)',
          }}
        >
          <div style={{ display: 'grid', gap: 16 }}>
            <BudgetPill accent={MONEY}>Mission Control</BudgetPill>
            <div style={{ display: 'grid', gap: 10 }}>
              <h1 style={{ fontSize: 48, fontWeight: 800, letterSpacing: '-0.07em', margin: 0 }}>
                Budget
              </h1>
              <p style={{ color: TEXT_SECONDARY, fontSize: 16, lineHeight: 1.8, margin: 0, maxWidth: 720 }}>
                Ready to budget cash, grouped envelopes, cash position, and live spending drift in one desktop planning surface.
              </p>
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link href="/budget/transactions" style={buttonStyle('primary')}>
                Go To Transactions
              </Link>
              <Link href="/budget/reports" style={buttonStyle('secondary')}>
                Open Reports
              </Link>
              <Link href="/budget/accounts" style={buttonStyle('ghost')}>
                Review Accounts
              </Link>
            </div>
          </div>

          <div
            style={{
              borderRadius: 24,
              background: `linear-gradient(180deg, ${withAlpha(MONEY, 0.12)}, ${withAlpha(ACCENT_LIGHT, 0.12)})`,
              border: `1px solid ${withAlpha(ACCENT_LIGHT, 0.18)}`,
              padding: 22,
              display: 'grid',
              gap: 12,
            }}
          >
            <p style={{ color: TEXT_TERTIARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, margin: 0, textTransform: 'uppercase' }}>
              Ready To Budget
            </p>
            <div style={{ color: MONEY, fontSize: 44, fontWeight: 800, letterSpacing: '-0.08em' }}>
              {formatBudgetCurrency(readyToBudget)}
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: TEXT_SECONDARY, fontSize: 14 }}>
                <span>Cash on hand</span>
                <strong style={{ color: TEXT }}>{formatBudgetCurrency(totalCash)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: TEXT_SECONDARY, fontSize: 14 }}>
                <span>Assigned this month</span>
                <strong style={{ color: TEXT }}>{formatBudgetCurrency(totalBudgeted)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', color: TEXT_SECONDARY, fontSize: 14 }}>
                <span>Monthly spend</span>
                <strong style={{ color: DANGER }}>{formatBudgetCurrency(totalSpent)}</strong>
              </div>
            </div>
          </div>
        </div>
      </BudgetCard>

      <div style={{ display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))' }}>
        <BudgetMetricCard
          label="Net Cash"
          subvalue={`${cashAccounts.length} liquid accounts`}
          tone="money"
          value={formatBudgetCurrency(totalCash)}
        />
        <BudgetMetricCard
          label="Income"
          subvalue={`${monthTransactions.filter((transaction) => transaction.direction === 'inflow').length} inflows this month`}
          tone="accent"
          value={formatBudgetCurrency(totalIncome)}
        />
        <BudgetMetricCard
          label="Spent"
          subvalue={`${monthTransactions.filter((transaction) => transaction.direction === 'outflow').length} outflows this month`}
          tone="danger"
          value={formatBudgetCurrency(totalSpent)}
        />
        <BudgetMetricCard
          label="Net Worth"
          subvalue={`${accounts.filter((account) => !account.archived).length} active accounts`}
          tone={totalNetWorth >= 0 ? 'info' : 'danger'}
          value={formatBudgetCurrency(totalNetWorth)}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'minmax(0, 1.05fr) minmax(0, 1.3fr) minmax(320px, 0.8fr)',
          alignItems: 'start',
        }}
      >
        <BudgetCard padding={24}>
          <BudgetSectionHeader
            description="Allocation mix by category group plus the recent monthly spending line."
            title="Allocation"
          />
          <BudgetDonutChart data={allocationData} />
          <div style={{ display: 'grid', gap: 10 }}>
            {allocationData.map((item) => (
              <div
                key={item.label}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                  padding: '10px 12px',
                  borderRadius: 18,
                  background: withAlpha('#ffffff', 0.02),
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 999, background: item.color }} />
                  <span style={{ color: TEXT, fontSize: 14, fontWeight: 600 }}>{item.label}</span>
                </div>
                <span style={{ color: TEXT_SECONDARY, fontSize: 13 }}>
                  {formatBudgetCurrency(item.value)}
                </span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 18 }}>
            <BudgetLineChart color={ACCENT_LIGHT} data={spendTrend} />
          </div>
        </BudgetCard>

        <BudgetCard padding={24}>
            <BudgetSectionHeader
            action={groupSections[0]?.envelopes[0] ? (
              <Link href={`/budget/envelope/${groupSections[0].envelopes[0].envelope.id}`} style={buttonStyle('ghost')}>
                Open Envelope Detail
              </Link>
            ) : undefined}
            description="Current month envelope health grouped by budgeting structure."
            title="Envelopes"
          />
          {groupSections.length === 0 ? (
            <EmptyHomeCard
              description="Create your first envelope to start assigning dollars to real categories."
              title="No envelopes yet"
            />
          ) : (
            <div style={{ display: 'grid', gap: 16 }}>
              {groupSections.map((section) => (
                <div
                  key={section.id}
                  style={{
                    display: 'grid',
                    gap: 12,
                    padding: 16,
                    borderRadius: 22,
                    background: withAlpha('#ffffff', 0.02),
                    boxShadow: `inset 0 0 0 1px ${withAlpha(section.accent, 0.16)}`,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                    <div style={{ display: 'grid', gap: 6 }}>
                      <p style={{ color: section.accent, fontSize: 11, fontWeight: 800, letterSpacing: 1.1, margin: 0, textTransform: 'uppercase' }}>
                        {section.name}
                      </p>
                      <strong style={{ fontSize: 18, letterSpacing: '-0.03em' }}>
                        {formatBudgetCurrency(section.totalRemaining)} available
                      </strong>
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <BudgetPill accent={section.accent}>
                        {formatBudgetCurrency(section.totalBudget)} budgeted
                      </BudgetPill>
                      <BudgetPill accent={section.totalSpent > section.totalBudget ? DANGER : MONEY}>
                        {formatBudgetCurrency(section.totalSpent)} spent
                      </BudgetPill>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 10 }}>
                    {section.envelopes.map((row) => {
                      const percent =
                        row.envelope.monthly_budget > 0
                          ? Math.min((row.spent / row.envelope.monthly_budget) * 100, 100)
                          : 0;

                      return (
                        <Link
                          key={row.envelope.id}
                          href={`/budget/envelope/${row.envelope.id}`}
                          style={{
                            display: 'grid',
                            gap: 8,
                            padding: '12px 14px',
                            borderRadius: 18,
                            textDecoration: 'none',
                            background: withAlpha('#ffffff', 0.025),
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                            <strong style={{ color: TEXT, fontSize: 14 }}>{row.envelope.name}</strong>
                            <span
                              style={{
                                color: row.remaining >= 0 ? MONEY : DANGER,
                                fontSize: 13,
                                fontWeight: 700,
                              }}
                            >
                              {formatBudgetCurrency(row.remaining)}
                            </span>
                          </div>
                          <div
                            style={{
                              height: 6,
                              borderRadius: 999,
                              background: withAlpha('#ffffff', 0.06),
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${percent}%`,
                                height: '100%',
                                borderRadius: 999,
                                background:
                                  row.remaining >= 0
                                    ? `linear-gradient(90deg, ${MONEY}, ${ACCENT_LIGHT})`
                                    : DANGER,
                              }}
                            />
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: TEXT_SECONDARY, fontSize: 12 }}>
                            <span>{formatBudgetCurrency(row.spent)} spent</span>
                            <span>{formatBudgetCurrency(row.envelope.monthly_budget)} budgeted</span>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </BudgetCard>

        <BudgetCard padding={24}>
          <BudgetSectionHeader
            action={
              <Link href="/budget/goals" style={buttonStyle('secondary')}>
                Open Goals
              </Link>
            }
            description="Progress rings, completion controls, and the closest savings targets."
            title="Goals"
          />

          <QuickCreateCard kicker="New Goal" title="Create A Savings Goal">
            <div style={{ display: 'grid', gap: 10 }}>
              <input placeholder="Goal name" style={inputStyle()} value={goalName} onChange={(event) => setGoalName(event.target.value)} />
              <select style={inputStyle()} value={goalEnvelopeId} onChange={(event) => setGoalEnvelopeId(event.target.value)}>
                {envelopes.length === 0 ? <option value="">No envelopes</option> : null}
                {envelopes.map((envelope) => (
                  <option key={envelope.id} value={envelope.id}>
                    {envelope.name}
                  </option>
                ))}
              </select>
              <input placeholder="Target amount (0.00)" style={inputStyle()} value={goalTarget} onChange={(event) => setGoalTarget(event.target.value)} />
              <input placeholder="Completed amount (0.00)" style={inputStyle()} value={goalCompleted} onChange={(event) => setGoalCompleted(event.target.value)} />
              <input style={inputStyle()} type="date" value={goalDate} onChange={(event) => setGoalDate(event.target.value)} />
              <button
                disabled={!goalName.trim() || !goalEnvelopeId}
                onClick={() => void createGoal()}
                style={buttonStyle('primary')}
                type="button"
              >
                {submitting === 'goal' ? 'Creating...' : 'Create'}
              </button>
            </div>
          </QuickCreateCard>

          <div style={{ display: 'grid', gap: 12, marginTop: 16 }}>
            {topGoals.length === 0 ? (
              <EmptyHomeCard
                description="Goals turn true expenses and long-term targets into visible progress."
                title="No goals yet"
              />
            ) : (
              topGoals.map((goal) => {
                const progress = goal.target_amount > 0 ? Math.min((goal.completed_amount / goal.target_amount) * 100, 100) : 0;

                return (
                  <div
                    key={goal.id}
                    style={{
                      display: 'grid',
                      gap: 10,
                      padding: 14,
                      borderRadius: 18,
                      background: withAlpha('#ffffff', 0.02),
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                      <div style={{ display: 'grid', gap: 6 }}>
                        <Link href={`/budget/goals/${goal.id}`} style={{ color: TEXT, fontSize: 15, fontWeight: 700, textDecoration: 'none' }}>
                          {goal.name}
                        </Link>
                        <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                          {formatBudgetCurrency(goal.completed_amount)} of {formatBudgetCurrency(goal.target_amount)}
                        </span>
                      </div>
                      <BudgetPill accent={goal.is_completed === 1 ? MONEY : ACCENT_LIGHT}>
                        {goal.is_completed === 1 ? 'Complete' : `${Math.round(progress)}%`}
                      </BudgetPill>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 999,
                        background: withAlpha('#ffffff', 0.06),
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${progress}%`,
                          height: '100%',
                          borderRadius: 999,
                          background: `linear-gradient(90deg, ${ACCENT_LIGHT}, ${MONEY})`,
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button onClick={() => void toggleGoalComplete(goal)} style={buttonStyle('ghost')} type="button">
                        {goal.is_completed === 1 ? 'Reopen' : 'Complete'}
                      </button>
                      <button onClick={() => void deleteGoalRow(goal)} style={buttonStyle('danger')} type="button">
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </BudgetCard>
      </div>

      <div
        style={{
          display: 'grid',
          gap: 20,
          gridTemplateColumns: 'minmax(0, 1.1fr) minmax(0, 0.9fr)',
          alignItems: 'start',
        }}
      >
        <div style={{ display: 'grid', gap: 20 }}>
          <QuickCreateCard kicker="New Transaction" title="Log Activity Fast">
            <div style={{ display: 'grid', gap: 10 }}>
              <input placeholder="0.00" style={inputStyle()} value={transactionAmount} onChange={(event) => setTransactionAmount(event.target.value)} />
              <input style={inputStyle()} type="date" value={transactionDate} onChange={(event) => setTransactionDate(event.target.value)} />
              <input placeholder="Merchant (optional)" style={inputStyle()} value={transactionMerchant} onChange={(event) => setTransactionMerchant(event.target.value)} />
              <select style={inputStyle()} value={transactionDirection} onChange={(event) => setTransactionDirection(event.target.value as 'outflow' | 'inflow')}>
                <option value="outflow">Expense</option>
                <option value="inflow">Income</option>
              </select>
              <select style={inputStyle()} value={transactionAccountId} onChange={(event) => setTransactionAccountId(event.target.value)}>
                {accounts.length === 0 ? <option value="">No accounts</option> : null}
                {accounts.map((account) => (
                  <option key={account.id} value={account.id}>
                    {account.name}
                  </option>
                ))}
              </select>
              <select style={inputStyle()} value={transactionEnvelopeId} onChange={(event) => setTransactionEnvelopeId(event.target.value)}>
                <option value="">No envelope</option>
                {envelopes.map((envelope) => (
                  <option key={envelope.id} value={envelope.id}>
                    {envelope.name}
                  </option>
                ))}
              </select>
              <input placeholder="Note (optional)" style={inputStyle()} value={transactionNote} onChange={(event) => setTransactionNote(event.target.value)} />
              <button
                disabled={!transactionAmount.trim()}
                onClick={() => void createTransaction()}
                style={buttonStyle('primary')}
                type="button"
              >
                {submitting === 'transaction' ? 'Creating...' : 'Create'}
              </button>
            </div>
          </QuickCreateCard>

          <BudgetCard padding={24}>
            <BudgetSectionHeader
              action={
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <select style={inputStyle()} value={transactionFilter} onChange={(event) => setTransactionFilter(event.target.value as 'all' | 'inflow' | 'outflow')}>
                    <option value="all">All</option>
                    <option value="inflow">Inflow</option>
                    <option value="outflow">Outflow</option>
                  </select>
                  <Link href="/budget/transactions" style={buttonStyle('ghost')}>
                    Open List
                  </Link>
                </div>
              }
              description="Recent activity grouped by day with amount tone by transaction direction."
              title="Transactions"
            />
            <p style={{ color: TEXT_TERTIARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, margin: '0 0 14px', textTransform: 'uppercase' }}>
              Transactions
            </p>

            {groupedTransactions.length === 0 ? (
              <EmptyHomeCard
                description="Once transactions start flowing, this section becomes the daily review queue."
                title="No transactions for the current filter"
              />
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {groupedTransactions.map(([date, rows]) => (
                  <div key={date} style={{ display: 'grid', gap: 10 }}>
                    <strong style={{ color: TEXT, fontSize: 14 }}>{formatBudgetDate(date)}</strong>
                    {rows.map((transaction) => (
                      <Link
                        key={transaction.id}
                        href={`/budget/transaction/${transaction.id}`}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: 18,
                          textDecoration: 'none',
                          background: withAlpha('#ffffff', 0.02),
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ color: TEXT, display: 'block', fontSize: 14 }}>
                            {transaction.merchant || transaction.note || 'Transaction'}
                          </strong>
                          <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>
                            {transaction.note || 'Manual entry'}
                          </span>
                        </div>
                        <span
                          style={{
                            color:
                              transaction.direction === 'inflow'
                                ? MONEY
                                : transaction.direction === 'transfer'
                                  ? INFO
                                  : DANGER,
                            fontSize: 14,
                            fontWeight: 800,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatBudgetCurrency(
                            transaction.direction === 'outflow'
                              ? -Math.abs(transaction.amount)
                              : transaction.amount,
                            { signed: true },
                          )}
                        </span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </BudgetCard>
        </div>

        <div style={{ display: 'grid', gap: 20 }}>
          <QuickCreateCard kicker="New Account" title="Add A Funding Source">
            <div style={{ display: 'grid', gap: 10 }}>
              <input placeholder="Account name" style={inputStyle()} value={accountName} onChange={(event) => setAccountName(event.target.value)} />
              <input placeholder="0.00" style={inputStyle()} value={accountBalance} onChange={(event) => setAccountBalance(event.target.value)} />
              <select style={inputStyle()} value={accountType} onChange={(event) => setAccountType(event.target.value as Account['type'])}>
                <option value="checking">Checking</option>
                <option value="savings">Savings</option>
                <option value="cash">Cash</option>
                <option value="credit">Credit</option>
                <option value="investment">Investment</option>
                <option value="loan">Loan</option>
                <option value="mortgage">Mortgage</option>
                <option value="other">Other</option>
              </select>
              <button
                disabled={!accountName.trim()}
                onClick={() => void createAccount()}
                style={buttonStyle('primary')}
                type="button"
              >
                {submitting === 'account' ? 'Creating...' : 'Create'}
              </button>
            </div>
          </QuickCreateCard>

          <BudgetCard padding={24}>
            <BudgetSectionHeader
              action={
                <Link href="/budget/accounts" style={buttonStyle('ghost')}>
                  Open Accounts
                </Link>
              }
              description="Grouped account balances for cash, debt, and investment surfaces."
              title="Accounts"
            />
            <p style={{ color: TEXT_TERTIARY, fontSize: 11, fontWeight: 800, letterSpacing: 1.2, margin: '0 0 14px', textTransform: 'uppercase' }}>
              Accounts
            </p>

            {groupedAccounts.length === 0 ? (
              <EmptyHomeCard
                description="Accounts power ready-to-budget, net worth, debt, and transfer planning."
                title="No accounts yet"
              />
            ) : (
              <div style={{ display: 'grid', gap: 16 }}>
                {groupedAccounts.map(([groupName, rows]) => (
                  <div key={groupName} style={{ display: 'grid', gap: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                      <strong style={{ fontSize: 15 }}>{groupName}</strong>
                      <BudgetPill accent={groupName === 'Cash' ? MONEY : groupName === 'Investment' ? INFO : ACCENT_LIGHT}>
                        {formatBudgetCurrency(rows.reduce((sum, account) => sum + balanceForNetWorth(account), 0))}
                      </BudgetPill>
                    </div>
                    {rows.map((account) => (
                      <Link
                        key={account.id}
                        href="/budget/accounts"
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 12,
                          alignItems: 'center',
                          padding: '12px 14px',
                          borderRadius: 18,
                          textDecoration: 'none',
                          background: withAlpha('#ffffff', 0.02),
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <strong style={{ color: TEXT, display: 'block', fontSize: 14 }}>{account.name}</strong>
                          <span style={{ color: TEXT_SECONDARY, fontSize: 12 }}>{account.type}</span>
                        </div>
                        <span style={{ color: balanceForNetWorth(account) >= 0 ? TEXT : DANGER, fontSize: 14, fontWeight: 800 }}>
                          {formatBudgetCurrency(account.current_balance)}
                        </span>
                      </Link>
                    ))}
                  </div>
                ))}
              </div>
            )}
          </BudgetCard>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 20, gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))' }}>
        <QuickCreateCard kicker="New Envelope" title="Create An Envelope">
          <div style={{ display: 'grid', gap: 10 }}>
            <input placeholder="Envelope name" style={inputStyle()} value={envelopeName} onChange={(event) => setEnvelopeName(event.target.value)} />
            <input placeholder="0.00" style={inputStyle()} value={envelopeBudget} onChange={(event) => setEnvelopeBudget(event.target.value)} />
            <button
              disabled={!envelopeName.trim()}
              onClick={() => void createEnvelope()}
              style={buttonStyle('primary')}
              type="button"
            >
              {submitting === 'envelope' ? 'Creating...' : 'Create'}
            </button>
          </div>
        </QuickCreateCard>

        <BudgetCard padding={24}>
          <BudgetSectionHeader
            action={
              <Link href="/budget/reports" style={buttonStyle('secondary')}>
                Open Reporting Deck
              </Link>
            }
            description="Current month posture with plan, spend, and goal metadata pinned in one place."
            title="Command Notes"
          />
          <div style={{ display: 'grid', gap: 12 }}>
            <div
              style={{
                borderRadius: 18,
                background: withAlpha('#ffffff', 0.02),
                padding: 14,
                color: TEXT_SECONDARY,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: TEXT }}>Month window:</strong> {formatBudgetDate(currentMonthRange.from)} to {formatBudgetDate(currentMonthRange.to)}
            </div>
            <div
              style={{
                borderRadius: 18,
                background: withAlpha('#ffffff', 0.02),
                padding: 14,
                color: TEXT_SECONDARY,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: TEXT }}>Goal rail:</strong> {goals.filter((goal) => goal.is_completed === 0).length} active targets, {goals.filter((goal) => goal.is_completed === 1).length} completed.
            </div>
            <div
              style={{
                borderRadius: 18,
                background: withAlpha('#ffffff', 0.02),
                padding: 14,
                color: TEXT_SECONDARY,
                fontSize: 14,
                lineHeight: 1.7,
              }}
            >
              <strong style={{ color: TEXT }}>Recent activity:</strong> {transactions.length} total transactions synced into the local budget ledger.
            </div>
          </div>
        </BudgetCard>
      </div>
    </div>
  );
}
