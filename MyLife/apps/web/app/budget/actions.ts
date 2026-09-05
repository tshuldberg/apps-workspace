'use server';

import { getAdapter, ensureModuleMigrations } from '@/lib/db';
import {
  BUDGET_HELP_CONTENT,
  calculateNetWorth,
  createAccount,
  createAlertHistory,
  createAoMSnapshot,
  createBudgetAlert,
  createCancellationAction,
  createContact,
  createCurrency,
  createDebtPayoffDebt,
  createDebtPayoffPlan,
  createEnvelope,
  createExpenseSplit,
  createFamily,
  createFamilyMember,
  createGoal,
  createHolding,
  createHoldingSnapshot,
  createLoan,
  createLoanPayment,
  createMilestone,
  createNetWorthSnapshot,
  createSettlement,
  createSplitParticipant,
  createSubscription,
  createSyncLogEntry,
  createTransaction,
  createTransactionRule,
  deleteAccount,
  deleteBudgetAlert,
  deleteCancellationAction,
  deleteContact,
  deleteCurrency,
  deleteDebtPayoffDebt,
  deleteDebtPayoffPlan,
  deleteEnvelope,
  deleteExchangeRate,
  deleteGoal,
  deleteHolding,
  deleteLoan,
  deleteLoanPayment,
  deleteMilestone,
  deleteSubscription,
  deleteTransaction,
  deleteTransactionRule,
  dismissMilestone,
  generateInviteCode,
  getAccount,
  getAccounts,
  getActivityByEnvelope,
  getAlertHistoryByMonth,
  getAoMSnapshotByDate,
  getBaseCurrency,
  getBudgetAlertById,
  getBudgetAlerts,
  getCancellationActionsBySubscription,
  getCategoryGroups,
  getContactById,
  getContacts,
  getCurrencies,
  getDebtPayoffPlanById,
  getDebtPayoffPlans,
  getDebtsByPlan,
  getEnabledTransactionRules,
  getEnvelope,
  getEnvelopesByGroup,
  getEnvelopes,
  getEnvelopeSharingModes,
  getExchangeRates,
  getActiveHoldings,
  getActiveLoans,
  getExpenseSplitById,
  getExpenseSplits,
  getFamilyByInviteCode,
  getFamilyMembers,
  getGoalById,
  getGoals,
  getHoldingById,
  getHoldingSnapshots,
  getLifetimeCost,
  getLoanById,
  getLoanPayments,
  getMilestoneById,
  getMilestones,
  getNetWorthSnapshotByMonth,
  getNetWorthSnapshots,
  getPriceHistory,
  getRecentAoMSnapshots,
  getSettlementsByContact,
  getSplitParticipants,
  getSubscriptionById,
  getSubscriptions,
  getSyncLogSince,
  getTotalIncome,
  getTransaction,
  getTransactions,
  getTransactionRuleById,
  getTransactionRules,
  getUpcomingRenewals,
  isInviteExpired,
  normalizeToAnnual,
  normalizeToMonthly,
  removeFamilyMember,
  setEnvelopeSharingMode,
  setSetting,
  getSetting,
  updateAccount,
  updateBudgetAlert,
  updateContact,
  updateDebtPayoffDebt,
  updateDebtPayoffPlan,
  updateEnvelope,
  updateFamilyMember,
  updateGoal,
  updateHolding,
  updateLoan,
  updateNetWorthSnapshot,
  updateSubscription,
  updateTransaction,
  updateTransactionRule,
  upsertExchangeRate,
  type Account,
  type AccountInsert,
  type AccountUpdate,
  type AlertHistoryInsert,
  type AoMSnapshotInsert,
  type BudgetAlertInsert,
  type BudgetGoalInsert,
  type BudgetGoalUpdate,
  type BudgetSubscriptionFilter,
  type BudgetSubscriptionInsert,
  type BudgetSubscriptionUpdate,
  type BudgetTransactionFilter,
  type BudgetTransactionInsert,
  type BudgetTransactionUpdate,
  type ContactInsert,
  type ContactUpdate,
  type DebtPayoffDebtInsert,
  type DebtPayoffPlanInsert,
  type EnvelopeInsert,
  type EnvelopeSharingInsert,
  type EnvelopeUpdate,
  type ExpenseSplitInsert,
  type Family,
  type FamilyInsert,
  type FamilyMemberInsert,
  type FamilyMemberUpdate,
  type HoldingInsert,
  type HoldingSnapshotInsert,
  type HoldingUpdate,
  type LoanInsert,
  type LoanPaymentInsert,
  type LoanUpdate,
  type NetWorthMilestoneInsert,
  type SettlementInsert,
  type SplitParticipantInsert,
  type TransactionRuleInsert,
  type TransactionRuleUpdate,
} from '@mylife/budget';

function db() {
  const adapter = getAdapter();
  ensureModuleMigrations('budget');
  return adapter;
}

async function runBudgetAction<T>(work: () => T): Promise<T> {
  try {
    return work();
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Budget action failed.';
    throw new Error(message);
  }
}

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return nowIso().slice(0, 10);
}

function currentMonthKey() {
  return todayIso().slice(0, 7);
}

function normalizeNetWorthAccountType(type: Account['type']) {
  return type === 'credit' ? 'credit_card' : type;
}

function buildNetWorthAccountBalances(accounts: Account[]) {
  return JSON.stringify(
    accounts.map((account) => ({
      archived: account.archived,
      balance: account.current_balance,
      id: account.id,
      name: account.name,
      type: account.type,
    })),
  );
}

export async function fetchBudgetHelpContent() {
  return runBudgetAction(() => BUDGET_HELP_CONTENT);
}

// -- Envelopes --

export async function fetchEnvelopes(includeArchived = false) {
  return runBudgetAction(() => getEnvelopes(db(), includeArchived));
}

export async function fetchEnvelopeById(id: string) {
  return runBudgetAction(() => getEnvelope(db(), id));
}

export async function addEnvelope(input: EnvelopeInsert) {
  return runBudgetAction(() => createEnvelope(db(), crypto.randomUUID(), input));
}

export async function editEnvelope(id: string, updates: EnvelopeUpdate) {
  return runBudgetAction(() => {
    updateEnvelope(db(), id, updates);
    return { ok: true };
  });
}

export async function removeEnvelope(id: string) {
  return runBudgetAction(() => {
    deleteEnvelope(db(), id);
    return { ok: true };
  });
}

export async function fetchCategoryGroups() {
  return runBudgetAction(() => getCategoryGroups(db()));
}

export async function fetchEnvelopesByGroup(groupId: string) {
  return runBudgetAction(() => getEnvelopesByGroup(db(), groupId));
}

export async function fetchActivityByMonth(month = currentMonthKey()) {
  return runBudgetAction(() =>
    Object.fromEntries(getActivityByEnvelope(db(), month).entries()),
  );
}

export async function fetchMonthlyIncome(month = currentMonthKey()) {
  return runBudgetAction(() => getTotalIncome(db(), month));
}

// -- Accounts --

export async function fetchAccounts(includeArchived = false) {
  return runBudgetAction(() => getAccounts(db(), includeArchived));
}

export async function fetchAccountById(id: string) {
  return runBudgetAction(() => getAccount(db(), id));
}

export async function addAccount(input: AccountInsert) {
  return runBudgetAction(() => createAccount(db(), crypto.randomUUID(), input));
}

export async function editAccount(id: string, updates: AccountUpdate) {
  return runBudgetAction(() => {
    updateAccount(db(), id, updates);
    return { ok: true };
  });
}

export async function removeAccount(id: string) {
  return runBudgetAction(() => {
    deleteAccount(db(), id);
    return { ok: true };
  });
}

export async function fetchBudgetBankConnectionSummary() {
  return runBudgetAction(() => {
    const adapter = db();
    const connectionRows = adapter.query<{
      connection_count: number;
      synced_count: number;
      stale_count: number;
    }>(
      `SELECT
         COUNT(*) AS connection_count,
         SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS synced_count,
         SUM(CASE WHEN status != 'active' THEN 1 ELSE 0 END) AS stale_count
       FROM bg_bank_connections`,
      [],
    );
    const accountRows = adapter.query<{
      linked_accounts: number;
      last_successful_sync: string | null;
    }>(
      `SELECT
         COUNT(*) AS linked_accounts,
         MAX(c.last_successful_sync) AS last_successful_sync
       FROM bg_bank_accounts ba
       JOIN bg_bank_connections c ON c.id = ba.connection_id
       WHERE ba.is_active = 1`,
      [],
    );

    return {
      connectionCount: Number(connectionRows[0]?.connection_count ?? 0),
      linkedAccountCount: Number(accountRows[0]?.linked_accounts ?? 0),
      staleConnectionCount: Number(connectionRows[0]?.stale_count ?? 0),
      syncedConnectionCount: Number(connectionRows[0]?.synced_count ?? 0),
      lastSuccessfulSync: accountRows[0]?.last_successful_sync ?? null,
    };
  });
}

// -- Transactions --

export async function fetchTransactions(filters?: BudgetTransactionFilter) {
  return runBudgetAction(() => getTransactions(db(), filters));
}

export async function fetchTransactionById(id: string) {
  return runBudgetAction(() => getTransaction(db(), id));
}

export async function addTransaction(input: BudgetTransactionInsert) {
  return runBudgetAction(() =>
    createTransaction(db(), crypto.randomUUID(), input),
  );
}

export async function editTransaction(id: string, updates: BudgetTransactionUpdate) {
  return runBudgetAction(() => {
    updateTransaction(db(), id, updates);
    return { ok: true };
  });
}

export async function removeTransaction(id: string) {
  return runBudgetAction(() => {
    deleteTransaction(db(), id);
    return { ok: true };
  });
}

export async function fetchReviewQueue() {
  return runBudgetAction(() =>
    getTransactions(db(), { limit: 400 }).filter(
      (transaction) =>
        !transaction.envelope_id || !transaction.merchant || !transaction.note,
    ),
  );
}

// -- Subscriptions --

export async function fetchSubscriptions(filters?: BudgetSubscriptionFilter) {
  return runBudgetAction(() => getSubscriptions(db(), filters));
}

export async function fetchSubscriptionById(id: string) {
  return runBudgetAction(() => getSubscriptionById(db(), id));
}

export async function fetchUpcomingSubscriptionRenewals(limit = 8) {
  return runBudgetAction(() =>
    getUpcomingRenewals(getSubscriptions(db())).slice(0, limit),
  );
}

export async function fetchSubscriptionCancellationActions(subscriptionId: string) {
  return runBudgetAction(() =>
    getCancellationActionsBySubscription(db(), subscriptionId),
  );
}

export async function fetchSubscriptionPriceHistory(subscriptionId: string) {
  return runBudgetAction(() => getPriceHistory(db(), subscriptionId));
}

export async function fetchSubscriptionLifetimeCost(subscriptionId: string) {
  return runBudgetAction(() => {
    const adapter = db();
    const subscription = getSubscriptionById(adapter, subscriptionId);
    if (!subscription) {
      return 0;
    }
    return getLifetimeCost(adapter, subscription);
  });
}

export async function addSubscription(input: BudgetSubscriptionInsert) {
  return runBudgetAction(() =>
    createSubscription(db(), crypto.randomUUID(), input),
  );
}

export async function editSubscription(id: string, updates: BudgetSubscriptionUpdate) {
  return runBudgetAction(() => {
    updateSubscription(db(), id, updates);
    return { ok: true };
  });
}

export async function removeSubscription(id: string) {
  return runBudgetAction(() => {
    deleteSubscription(db(), id);
    return { ok: true };
  });
}

export async function getSubscriptionMonthlyCost(price: number, billingCycle: string) {
  return runBudgetAction(() =>
    normalizeToMonthly(price, billingCycle as Parameters<typeof normalizeToMonthly>[1]),
  );
}

export async function getSubscriptionAnnualCost(price: number, billingCycle: string) {
  return runBudgetAction(() =>
    normalizeToAnnual(price, billingCycle as Parameters<typeof normalizeToAnnual>[1]),
  );
}

export async function addCancellationAction(input: {
  subscriptionId: string;
  action: 'cancelled' | 'dismissed' | 'reminded' | 'downgraded' | 'kept';
  savingsAmount?: number | null;
  notes?: string | null;
}) {
  return runBudgetAction(() =>
    createCancellationAction(db(), {
      subscription_id: input.subscriptionId,
      action: input.action,
      acted_on: todayIso(),
      notes: input.notes ?? null,
      savings_amount: input.savingsAmount ?? null,
    }),
  );
}

export async function removeCancellationAction(id: string) {
  return runBudgetAction(() => {
    deleteCancellationAction(db(), id);
    return { ok: true };
  });
}

// -- Goals --

export async function fetchGoals() {
  return runBudgetAction(() => getGoals(db()));
}

export async function fetchGoalById(id: string) {
  return runBudgetAction(() => getGoalById(db(), id));
}

export async function addGoal(input: BudgetGoalInsert) {
  return runBudgetAction(() => createGoal(db(), crypto.randomUUID(), input));
}

export async function editGoal(id: string, updates: BudgetGoalUpdate) {
  return runBudgetAction(() => {
    updateGoal(db(), id, updates);
    return { ok: true };
  });
}

export async function removeGoal(id: string) {
  return runBudgetAction(() => {
    deleteGoal(db(), id);
    return { ok: true };
  });
}

// -- Debt Payoff --

export async function fetchDebtPayoffPlans() {
  return runBudgetAction(() => getDebtPayoffPlans(db()));
}

export async function fetchDebtPayoffPlanById(id: string) {
  return runBudgetAction(() => getDebtPayoffPlanById(db(), id));
}

export async function addDebtPayoffPlan(input: DebtPayoffPlanInsert) {
  return runBudgetAction(() =>
    createDebtPayoffPlan(db(), crypto.randomUUID(), input),
  );
}

export async function editDebtPayoffPlan(id: string, updates: Partial<DebtPayoffPlanInsert>) {
  return runBudgetAction(() => {
    updateDebtPayoffPlan(db(), id, updates);
    return { ok: true };
  });
}

export async function removeDebtPayoffPlan(id: string) {
  return runBudgetAction(() => {
    deleteDebtPayoffPlan(db(), id);
    return { ok: true };
  });
}

export async function fetchDebtsByPlan(planId: string) {
  return runBudgetAction(() => getDebtsByPlan(db(), planId));
}

export async function addDebtPayoffDebt(input: DebtPayoffDebtInsert) {
  return runBudgetAction(() =>
    createDebtPayoffDebt(db(), crypto.randomUUID(), input),
  );
}

export async function editDebtPayoffDebt(id: string, updates: Partial<DebtPayoffDebtInsert>) {
  return runBudgetAction(() => {
    updateDebtPayoffDebt(db(), id, updates);
    return { ok: true };
  });
}

export async function removeDebtPayoffDebt(id: string) {
  return runBudgetAction(() => {
    deleteDebtPayoffDebt(db(), id);
    return { ok: true };
  });
}

// -- Rules --

export async function fetchTransactionRules() {
  return runBudgetAction(() => getTransactionRules(db()));
}

export async function fetchEnabledTransactionRules() {
  return runBudgetAction(() => getEnabledTransactionRules(db()));
}

export async function fetchTransactionRuleById(id: string) {
  return runBudgetAction(() => getTransactionRuleById(db(), id));
}

export async function addTransactionRule(input: TransactionRuleInsert) {
  return runBudgetAction(() =>
    createTransactionRule(db(), crypto.randomUUID(), input),
  );
}

export async function editTransactionRule(id: string, updates: TransactionRuleUpdate) {
  return runBudgetAction(() => {
    updateTransactionRule(db(), id, updates);
    return { ok: true };
  });
}

export async function removeTransactionRule(id: string) {
  return runBudgetAction(() => {
    deleteTransactionRule(db(), id);
    return { ok: true };
  });
}

// -- Alerts --

export async function fetchBudgetAlerts() {
  return runBudgetAction(() => getBudgetAlerts(db()));
}

export async function fetchBudgetAlertById(id: string) {
  return runBudgetAction(() => getBudgetAlertById(db(), id));
}

export async function fetchAlertHistory(month = currentMonthKey()) {
  return runBudgetAction(() => getAlertHistoryByMonth(db(), month));
}

export async function addBudgetAlert(input: BudgetAlertInsert) {
  return runBudgetAction(() =>
    createBudgetAlert(db(), crypto.randomUUID(), input),
  );
}

export async function editBudgetAlert(id: string, updates: Partial<Pick<BudgetAlertInsert, 'threshold_pct' | 'is_enabled'>>) {
  return runBudgetAction(() => {
    updateBudgetAlert(db(), id, updates);
    return { ok: true };
  });
}

export async function removeBudgetAlert(id: string) {
  return runBudgetAction(() => {
    deleteBudgetAlert(db(), id);
    return { ok: true };
  });
}

export async function addBudgetAlertHistory(input: AlertHistoryInsert) {
  return runBudgetAction(() =>
    createAlertHistory(db(), crypto.randomUUID(), input),
  );
}

// -- Currency --

export async function fetchCurrencies() {
  return runBudgetAction(() => getCurrencies(db()));
}

export async function fetchBaseCurrency() {
  return runBudgetAction(() => getBaseCurrency(db()));
}

export async function fetchExchangeRates() {
  return runBudgetAction(() => getExchangeRates(db()));
}

export async function addCurrency(input: {
  code: string;
  name: string;
  symbol: string;
  decimalPlaces?: number;
  isBase?: boolean;
}) {
  return runBudgetAction(() =>
    createCurrency(db(), {
      code: input.code.toUpperCase(),
      decimal_places: input.decimalPlaces ?? 2,
      is_base: input.isBase ? 1 : 0,
      name: input.name,
      symbol: input.symbol,
    }),
  );
}

export async function removeCurrency(code: string) {
  return runBudgetAction(() => {
    deleteCurrency(db(), code);
    return { ok: true };
  });
}

export async function saveExchangeRate(input: {
  fromCurrency: string;
  toCurrency: string;
  rate: number;
  rateDecimal: string;
}) {
  return runBudgetAction(() =>
    upsertExchangeRate(db(), crypto.randomUUID(), {
      from_currency: input.fromCurrency.toUpperCase(),
      rate: input.rate,
      rate_decimal: input.rateDecimal,
      to_currency: input.toCurrency.toUpperCase(),
    }),
  );
}

export async function removeExchangeRate(id: string) {
  return runBudgetAction(() => {
    deleteExchangeRate(db(), id);
    return { ok: true };
  });
}

// -- Investments --

export async function fetchActiveHoldings() {
  return runBudgetAction(() => getActiveHoldings(db()));
}

export async function fetchHoldingById(id: string) {
  return runBudgetAction(() => getHoldingById(db(), id));
}

export async function fetchHoldingSnapshots(holdingId: string, startDate?: string, endDate?: string) {
  return runBudgetAction(() => getHoldingSnapshots(db(), holdingId, startDate, endDate));
}

export async function addHolding(input: HoldingInsert) {
  return runBudgetAction(() => createHolding(db(), crypto.randomUUID(), input));
}

export async function editHolding(id: string, updates: HoldingUpdate) {
  return runBudgetAction(() => {
    updateHolding(db(), id, updates);
    return { ok: true };
  });
}

export async function removeHolding(id: string) {
  return runBudgetAction(() => {
    deleteHolding(db(), id);
    return { ok: true };
  });
}

export async function addHoldingSnapshot(input: HoldingSnapshotInsert) {
  return runBudgetAction(() =>
    createHoldingSnapshot(db(), crypto.randomUUID(), input),
  );
}

export async function refreshHoldingSnapshots() {
  return runBudgetAction(() => {
    const adapter = db();
    const snapshotDate = todayIso();
    const holdings = getActiveHoldings(adapter);

    return holdings.map((holding) =>
      createHoldingSnapshot(adapter, crypto.randomUUID(), {
        date: snapshotDate,
        holding_id: holding.id,
        price_per_share:
          holding.current_price ??
          Math.round(holding.cost_basis / Math.max(holding.shares, 1)),
        shares: holding.shares,
        total_value:
          holding.current_value ??
          Math.round(
            holding.shares *
              (holding.current_price ??
                Math.round(holding.cost_basis / Math.max(holding.shares, 1))),
          ),
      }),
    );
  });
}

// -- Net Worth --

export async function fetchNetWorthSnapshots() {
  return runBudgetAction(() => getNetWorthSnapshots(db()));
}

export async function fetchMilestones() {
  return runBudgetAction(() => getMilestones(db()));
}

export async function fetchMilestoneById(id: string) {
  return runBudgetAction(() => getMilestoneById(db(), id));
}

export async function addMilestone(input: NetWorthMilestoneInsert) {
  return runBudgetAction(() => createMilestone(db(), input));
}

export async function dismissNetWorthMilestone(id: string) {
  return runBudgetAction(() => {
    dismissMilestone(db(), id);
    return { ok: true };
  });
}

export async function removeMilestone(id: string) {
  return runBudgetAction(() => {
    deleteMilestone(db(), id);
    return { ok: true };
  });
}

export async function syncCurrentNetWorthSnapshot() {
  return runBudgetAction(() => {
    const adapter = db();
    const month = currentMonthKey();
    const accounts = getAccounts(adapter, false);
    const snapshot = calculateNetWorth(
      accounts.map((account) => ({
        accountType: normalizeNetWorthAccountType(account.type),
        balance: account.current_balance,
        id: account.id,
        name: account.name,
      })),
    );
    const accountBalances = buildNetWorthAccountBalances(getAccounts(adapter, true));
    const existing = getNetWorthSnapshotByMonth(adapter, month);

    if (existing) {
      updateNetWorthSnapshot(adapter, existing.id, {
        account_balances: accountBalances,
        assets: snapshot.totalAssets,
        liabilities: snapshot.totalLiabilities,
        net_worth: snapshot.netWorth,
      });
      return getNetWorthSnapshots(adapter);
    }

    createNetWorthSnapshot(adapter, crypto.randomUUID(), {
      account_balances: accountBalances,
      assets: snapshot.totalAssets,
      liabilities: snapshot.totalLiabilities,
      month,
      net_worth: snapshot.netWorth,
    });

    return getNetWorthSnapshots(adapter);
  });
}

// -- Loans --

export async function fetchActiveLoans() {
  return runBudgetAction(() => getActiveLoans(db()));
}

export async function fetchLoanById(id: string) {
  return runBudgetAction(() => getLoanById(db(), id));
}

export async function fetchLoanPayments(loanId: string) {
  return runBudgetAction(() => getLoanPayments(db(), loanId));
}

export async function addLoan(input: LoanInsert) {
  return runBudgetAction(() => createLoan(db(), crypto.randomUUID(), input));
}

export async function editLoan(id: string, updates: LoanUpdate) {
  return runBudgetAction(() => {
    updateLoan(db(), id, updates);
    return { ok: true };
  });
}

export async function removeLoan(id: string) {
  return runBudgetAction(() => {
    deleteLoan(db(), id);
    return { ok: true };
  });
}

export async function addLoanPayment(input: LoanPaymentInsert) {
  return runBudgetAction(() =>
    createLoanPayment(db(), crypto.randomUUID(), input),
  );
}

export async function removeLoanPayment(id: string) {
  return runBudgetAction(() => {
    deleteLoanPayment(db(), id);
    return { ok: true };
  });
}

// -- AoM --

export async function fetchRecentAoMSnapshots(limit = 12) {
  return runBudgetAction(() => getRecentAoMSnapshots(db(), limit));
}

export async function syncCurrentAoMSnapshot(ageDays: number, sampleSize: number) {
  return runBudgetAction(() => {
    const adapter = db();
    const today = todayIso();
    const existing = getAoMSnapshotByDate(adapter, today);

    if (existing) {
      return existing;
    }

    return createAoMSnapshot(adapter, {
      age_days: ageDays,
      date: today,
      sample_size: sampleSize,
    } as AoMSnapshotInsert);
  });
}

// -- Family --

export async function fetchBudgetFamilySnapshot() {
  return runBudgetAction(() => {
    const adapter = db();
    const families = adapter.query<Family>(
      'SELECT * FROM bg_families ORDER BY created_at DESC LIMIT 1',
      [],
    );
    const family = families[0] ?? null;

    if (!family) {
      return {
        activity: [],
        envelopes: getEnvelopes(adapter, false),
        family: null,
        members: [],
        sharingModes: [],
      };
    }

    return {
      activity: getSyncLogSince(adapter, family.id, '1970-01-01T00:00:00.000Z')
        .slice(-16)
        .reverse(),
      envelopes: getEnvelopes(adapter, false),
      family,
      members: getFamilyMembers(adapter, family.id),
      sharingModes: getEnvelopeSharingModes(adapter, family.id),
    };
  });
}

export async function createBudgetFamily(input: { name?: string; ownerName?: string; ownerEmoji?: string }) {
  return runBudgetAction(() => {
    const adapter = db();
    const familyId = crypto.randomUUID();
    const family = createFamily(adapter, familyId, {
      created_by_device_id: 'web-desktop',
      invite_code: generateInviteCode(),
      name: input.name ?? 'Budget Circle',
    } as FamilyInsert);

    const member = createFamilyMember(adapter, crypto.randomUUID(), {
      avatar_emoji: input.ownerEmoji ?? '🪙',
      device_id: 'web-desktop',
      display_name: input.ownerName ?? 'You',
      family_id: family.id,
      last_sync_at: nowIso(),
      role: 'owner',
    } as FamilyMemberInsert);

    createSyncLogEntry(adapter, crypto.randomUUID(), {
      applied: 1,
      device_id: 'web-desktop',
      family_id: family.id,
      operation: 'create',
      payload: JSON.stringify({ summary: 'Created the family workspace' }),
      record_id: family.id,
      table_name: 'bg_families',
      timestamp: nowIso(),
    });

    createSyncLogEntry(adapter, crypto.randomUUID(), {
      applied: 1,
      device_id: 'web-desktop',
      family_id: family.id,
      operation: 'create',
      payload: JSON.stringify({ summary: 'Added the owner profile' }),
      record_id: member.id,
      table_name: 'bg_family_members',
      timestamp: nowIso(),
    });

    return { family, member };
  });
}

export async function joinBudgetFamily(inviteCode: string, memberName = 'You') {
  return runBudgetAction(() => {
    const adapter = db();
    const family = getFamilyByInviteCode(adapter, inviteCode.trim().toUpperCase());

    if (!family) {
      throw new Error('Invite code not found.');
    }

    if (isInviteExpired(family.updated_at)) {
      throw new Error('Invite code has expired.');
    }

    const member = createFamilyMember(adapter, crypto.randomUUID(), {
      avatar_emoji: '🧾',
      device_id: `web-${crypto.randomUUID()}`,
      display_name: memberName,
      family_id: family.id,
      last_sync_at: nowIso(),
      role: 'member',
    } as FamilyMemberInsert);

    createSyncLogEntry(adapter, crypto.randomUUID(), {
      applied: 1,
      device_id: member.device_id,
      family_id: family.id,
      operation: 'create',
      payload: JSON.stringify({ summary: 'Joined the family with an invite code' }),
      record_id: member.id,
      table_name: 'bg_family_members',
      timestamp: nowIso(),
    });

    return { family, member };
  });
}

export async function addBudgetFamilyMember(input: FamilyMemberInsert) {
  return runBudgetAction(() => {
    const adapter = db();
    const member = createFamilyMember(adapter, crypto.randomUUID(), input);

    createSyncLogEntry(adapter, crypto.randomUUID(), {
      applied: 1,
      device_id: input.device_id,
      family_id: input.family_id,
      operation: 'create',
      payload: JSON.stringify({ summary: `Added ${input.display_name} to the family` }),
      record_id: member.id,
      table_name: 'bg_family_members',
      timestamp: nowIso(),
    });

    return member;
  });
}

export async function editBudgetFamilyMember(id: string, familyId: string, updates: FamilyMemberUpdate) {
  return runBudgetAction(() => {
    const adapter = db();
    const member = updateFamilyMember(adapter, id, updates);

    if (member) {
      createSyncLogEntry(adapter, crypto.randomUUID(), {
        applied: 1,
        device_id: member.device_id,
        family_id: familyId,
        operation: 'update',
        payload: JSON.stringify({ summary: `Updated ${member.display_name}'s family access` }),
        record_id: member.id,
        table_name: 'bg_family_members',
        timestamp: nowIso(),
      });
    }

    return member;
  });
}

export async function removeBudgetFamilyMember(id: string, familyId: string) {
  return runBudgetAction(() => {
    const adapter = db();
    removeFamilyMember(adapter, id);
    createSyncLogEntry(adapter, crypto.randomUUID(), {
      applied: 1,
      device_id: 'web-desktop',
      family_id: familyId,
      operation: 'delete',
      payload: JSON.stringify({ summary: 'Removed a family member' }),
      record_id: id,
      table_name: 'bg_family_members',
      timestamp: nowIso(),
    });
    return { ok: true };
  });
}

export async function saveBudgetEnvelopeSharingMode(input: EnvelopeSharingInsert) {
  return runBudgetAction(() => {
    const adapter = db();
    const existing = getEnvelopeSharingModes(adapter, input.family_id).find(
      (record) => record.envelope_id === input.envelope_id,
    );
    const record = setEnvelopeSharingMode(
      adapter,
      existing?.id ?? crypto.randomUUID(),
      input,
    );

    createSyncLogEntry(adapter, crypto.randomUUID(), {
      applied: 1,
      device_id: 'web-desktop',
      family_id: input.family_id,
      operation: existing ? 'update' : 'create',
      payload: JSON.stringify({ summary: 'Adjusted envelope sharing visibility' }),
      record_id: record.id,
      table_name: 'bg_envelope_sharing',
      timestamp: nowIso(),
    });

    return record;
  });
}

// -- Splitting --

export async function fetchContacts() {
  return runBudgetAction(() => getContacts(db()));
}

export async function fetchContactById(id: string) {
  return runBudgetAction(() => getContactById(db(), id));
}

export async function addContact(input: ContactInsert) {
  return runBudgetAction(() => createContact(db(), crypto.randomUUID(), input));
}

export async function editContact(id: string, updates: ContactUpdate) {
  return runBudgetAction(() => updateContact(db(), id, updates));
}

export async function removeContact(id: string) {
  return runBudgetAction(() => {
    deleteContact(db(), id);
    return { ok: true };
  });
}

export async function fetchExpenseSplits(settled?: boolean) {
  return runBudgetAction(() =>
    getExpenseSplits(db(), settled === undefined ? undefined : { settled }),
  );
}

export async function fetchExpenseSplitById(id: string) {
  return runBudgetAction(() => getExpenseSplitById(db(), id));
}

export async function fetchSplitParticipants(splitId: string) {
  return runBudgetAction(() => getSplitParticipants(db(), splitId));
}

export async function fetchSettlementsByContact(contactId: string) {
  return runBudgetAction(() => getSettlementsByContact(db(), contactId));
}

export async function addExpenseSplit(input: ExpenseSplitInsert) {
  return runBudgetAction(() =>
    createExpenseSplit(db(), crypto.randomUUID(), input),
  );
}

export async function addSplitParticipant(input: SplitParticipantInsert) {
  return runBudgetAction(() =>
    createSplitParticipant(db(), crypto.randomUUID(), input),
  );
}

export async function addSettlement(input: SettlementInsert) {
  return runBudgetAction(() =>
    createSettlement(db(), crypto.randomUUID(), input),
  );
}

// -- Settings --

export async function fetchBudgetSetting(key: string) {
  return runBudgetAction(() => getSetting(db(), key));
}

export async function saveBudgetSetting(key: string, value: string) {
  return runBudgetAction(() => {
    setSetting(db(), key, value);
    return { ok: true };
  });
}
